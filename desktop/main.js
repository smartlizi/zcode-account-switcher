'use strict';
/**
 * Electron 主进程
 *
 * 职责：
 *   1. 创建应用窗口
 *   2. 通过 IPC 桥接渲染进程 ↔ 已验证的后端模块（manager / switcher）
 *
 * 安全：contextIsolation=true + preload 受限 API，渲染进程不直接接触 Node。
 *
 * 注意：若启动无窗口，请检查环境变量 ELECTRON_RUN_AS_NODE 是否被设为 1
 *      （会让 electron 退化成纯 node）。启动脚本已自动清除它。
 */
const fs = require('fs');
const path = require('path');

// ===== 全局错误捕获 → 写日志（便于排查启动崩溃）=====
const LOG_FILE = path.join(__dirname, 'main.log');
function logErr(stage, e) {
  const line = `[${new Date().toISOString()}] ${stage}: ${e && e.stack ? e.stack : e}\n`;
  try { fs.appendFileSync(LOG_FILE, line, 'utf8'); } catch (_) {}
}
process.on('uncaughtException', (e) => logErr('uncaughtException', e));
process.on('unhandledRejection', (e) => logErr('unhandledRejection', e));

const { app, BrowserWindow, ipcMain, shell, dialog } = require('electron');

// 路径适配：开发时 src 在上级目录 ../src，打包后 electron-builder
// 把 src/ 以 extraResources 形式放到 process.resourcesPath/app-src/
const isPacked = app.isPackaged;
const SRC_DIR = isPacked
  ? path.join(process.resourcesPath, 'app-src')
  : path.join(__dirname, '..', 'src');

// 复用 src/ 里已验证的后端逻辑（开发/打包双模式兼容）
const manager = require(path.join(SRC_DIR, 'manager'));
const switcher = require(path.join(SRC_DIR, 'switcher'));
const oauth = require(path.join(SRC_DIR, 'oauth'));
const quota = require(path.join(SRC_DIR, 'quota'));
const { ZaiAuthFlow } = require(path.join(SRC_DIR, 'oauthCli'));

const DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL; // 开发模式由 vite 提供
let mainWindow = null;

// 通用日志（信息级，写 main.log）
function logInfo(msg) {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  try { fs.appendFileSync(LOG_FILE, line, 'utf8'); } catch (_) {}
}

function timestampName() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

function safeFileName(name) {
  return String(name || '')
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '_')
    .replace(/\s+/g, '_')
    .replace(/[. ]+$/g, '')
    .slice(0, 120) || `zcode-accounts-${timestampName()}`;
}

function exportDefaultName(accounts) {
  const first = accounts && accounts[0] && accounts[0].meta ? accounts[0].meta : null;
  const base = safeFileName(first?.email || first?.label || first?.id);
  const suffix = accounts.length > 1 ? `-等${accounts.length}个账号` : '';
  return `${base}${suffix}.zcas.json`;
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 1080,
    minHeight: 680,
    title: 'ZCode Account Switcher',
    backgroundColor: '#0b1220',
    autoHideMenuBar: true,
    icon: path.join(__dirname, 'assets', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false, // preload 需要 require 路径相关能力，关闭 sandbox
    },
  });

  if (DEV_SERVER_URL) {
    mainWindow.loadURL(DEV_SERVER_URL);
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadFile(path.join(__dirname, 'dist-renderer', 'index.html'));
  }

  // 捕获渲染进程的 console 与错误，便于排查白屏/JS 报错
  mainWindow.webContents.on('console-message', (_e, level, message) => {
    const tag = ['LOG', 'WARN', 'ERROR'][level] || 'LOG';
    logInfo(`[renderer:${tag}] ${message}`);
  });
  mainWindow.webContents.on('render-process-gone', (_e, details) => {
    logErr('render-process-gone', new Error(JSON.stringify(details)));
  });
  mainWindow.webContents.on('did-fail-load', (_e, code, desc) => {
    logInfo(`[did-fail-load] ${code} ${desc}`);
  });
  mainWindow.webContents.on('did-finish-load', () => {
    logInfo('[did-finish-load] renderer loaded');
  });

  // 外部链接用系统浏览器打开
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

// ===== IPC 处理器（全部 try/catch，返回 {ok, data?, error?} 统一结构）=====

const wrap = async (fn, channel) => {
  try {
    const data = await fn();
    return { ok: true, data };
  } catch (e) {
    logInfo(`[ipc:${channel || 'call'}] error: ${e && e.message ? e.message : e}`);
    return { ok: false, error: e.message || String(e) };
  }
};

// 把 OAuth 安装/操作进度推给渲染进程（用于 AddAccountModal 实时显示）
// 把添加账号的流程事件推给渲染进程
function sendFlowEvent(event) {
  logInfo('[oauth-flow] ' + event.type + (event.message ? ': ' + event.message : ''));
  try {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('oauth:flow-event', event);
    }
  } catch (_) {}
}

ipcMain.handle('account:status', async () =>
  wrap(() => {
    const cur = manager.current();
    const running = switcher.isZCodeRunning();
    const hasLast = switcher.hasLastBackup();
    return { current: cur, zcodeRunning: running, hasLastBackup: hasLast };
  }, 'status')
);

ipcMain.handle('account:list', async () => wrap(() => manager.list(), 'list'));

ipcMain.handle('account:capture', async (_evt, opts) =>
  wrap(() => manager.capture(opts || {}), 'capture')
);

ipcMain.handle('account:use', async (_evt, id) =>
  wrap(() => manager.use(id, { restart: true, force: true }), 'use')
);

ipcMain.handle('account:delete', async (_evt, id) =>
  wrap(() => ({ removed: manager.remove(id) }), 'delete')
);

ipcMain.handle('account:rename', async (_evt, id, label) =>
  wrap(() => manager.rename(id, label), 'rename')
);

ipcMain.handle('account:export', async (_evt, ids) =>
  wrap(async () => {
    const payload = manager.exportAccounts(ids);
    if (!payload.accounts.length) throw new Error('没有可导出的账号');
    const result = await dialog.showSaveDialog(mainWindow, {
      title: '导出账号快照',
      defaultPath: exportDefaultName(payload.accounts),
      filters: [
        { name: 'JSON 文件', extensions: ['json'] },
      ],
    });
    if (result.canceled || !result.filePath) return { canceled: true };
    fs.writeFileSync(result.filePath, JSON.stringify(payload, null, 2), 'utf8');
    return { canceled: false, path: result.filePath, count: payload.accounts.length };
  }, 'export')
);

ipcMain.handle('account:import', async () =>
  wrap(async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: '导入账号快照',
      properties: ['openFile', 'multiSelections'],
      filters: [
        { name: 'JSON 文件', extensions: ['json'] },
      ],
    });
    if (result.canceled || !result.filePaths || result.filePaths.length === 0) return { canceled: true };

    const imported = [];
    const skipped = [];
    const files = [];
    for (const filePath of result.filePaths) {
      try {
        const raw = fs.readFileSync(filePath, 'utf8');
        const payload = JSON.parse(raw);
        const r = manager.importAccounts(payload, { overwrite: false });
        imported.push(...(r.imported || []));
        skipped.push(...(r.skipped || []));
        files.push({ path: filePath, imported: r.imported?.length || 0, skipped: r.skipped?.length || 0 });
      } catch (e) {
        const reason = e && e.message ? e.message : String(e);
        skipped.push({ file: filePath, reason });
        files.push({ path: filePath, error: reason });
      }
    }
    return {
      canceled: false,
      path: result.filePaths[0],
      paths: result.filePaths,
      fileCount: result.filePaths.length,
      files,
      imported,
      skipped,
      count: imported.length,
    };
  }, 'import')
);

// ===== OAuth 添加账号（CLI OAuth + 系统浏览器）=====
// 流程：init 拿授权链接 → openExternal 打开系统浏览器 → 后台 poll 轮询登录
//   → 检测到 ready → finishLogin 写盘 + 快照。
// 前端调一次 oauth-start，全程通过 oauth:flow-event 事件接收阶段进度。

// 进行中的登录流程 + 轮询定时器（模块级，跨请求保留）
let _loginFlow = null;   // { flow: ZaiAuthFlow, flowId: string }
let _pollTimer = null;   // setInterval handle

function stopOauthPolling() {
  if (_pollTimer) {
    clearInterval(_pollTimer);
    _pollTimer = null;
  }
}

ipcMain.handle('account:oauth-start', async (_evt, opts) => {
  const { label, note } = opts || {};
  try {
    // 1. 发起 OAuth 流程，拿授权链接
    const flow = new ZaiAuthFlow();
    const { flowId, authorizeUrl } = await flow.init();
    _loginFlow = { flow, flowId };

    // 2. 打开系统浏览器（用户在自带浏览器里登录，风控更友好）
    sendFlowEvent({ type: 'browser-open', message: '正在打开系统浏览器，请在浏览器中登录 Z.ai 账号' });
    await shell.openExternal(authorizeUrl);
    sendFlowEvent({ type: 'waiting-login', message: '请在浏览器窗口中登录（支持账号密码 / 手机号）' });

    // 3. 后台轮询登录完成（每 2s，与参考项目一致）
    stopOauthPolling();
    _pollTimer = setInterval(async () => {
      const current = _loginFlow;
      if (!current) return;
      try {
        const data = await current.flow.poll(current.flowId);

        if (data.status === 'failed') {
          stopOauthPolling();
          _loginFlow = null;
          sendFlowEvent({ type: 'error', message: '登录失败或已取消' });
          return;
        }

        if (data.status === 'ready') {
          stopOauthPolling();
          _loginFlow = null;

          // 构造 oauth.finishLogin() 所需的 tokenSet 结构：
          //   { token, zaiAccessToken, refreshToken, user }
          // CLI OAuth 的 poll 返回正好对齐，写盘逻辑可原样复用。
          const tokenSet = {
            token: data.token,
            zaiAccessToken: (data.zai && data.zai.access_token) || undefined,
            refreshToken: (data.zai && data.zai.refresh_token) || undefined,
            user: data.user || {},
          };

          try {
            sendFlowEvent({ type: 'exchanging', message: '登录成功，正在保存账号并初始化额度…' });
            const result = await oauth.finishLogin({ tokenSet, label, note: note || '', overwrite: true });
            logInfo('[oauth-start] finishLogin done, billingReady=' + result.billingReady);
            sendFlowEvent({
              type: 'saved',
              account: result.account,
              email: (result.userInfo && result.userInfo.email) || '',
              skipped: result.skipped,
              billingReady: result.billingReady,
            });
          } catch (e) {
            sendFlowEvent({ type: 'error', message: '保存账号失败：' + (e.message || e) });
          }
        }
        // 其它状态（pending）继续轮询
      } catch (e) {
        // 单次轮询网络抖动不打断流程，下次重试
        logInfo('[oauth-start] poll error: ' + (e && e.message));
      }
    }, 2000);

    return { ok: true, authorizeUrl };
  } catch (e) {
    logInfo('[oauth-start] error: ' + (e && e.message));
    sendFlowEvent({ type: 'error', message: '启动登录失败：' + (e.message || e) });
    return { ok: false, error: e.message || String(e) };
  }
});

// 取消登录流程（停轮询；系统浏览器由用户自行关闭）
ipcMain.handle('account:oauth-cancel', async () =>
  wrap(() => {
    stopOauthPolling();
    _loginFlow = null;
    return { stopped: true };
  }, 'oauth-cancel')
);

ipcMain.handle('shell:open-external', async (_evt, url) =>
  wrap(() => shell.openExternal(url), 'open-external')
);

ipcMain.handle('account:quota', async () =>
  wrap(() => quota.getQuotaOverview(), 'quota')
);

ipcMain.handle('account:quota-one', async (_evt, id) =>
  wrap(() => quota.getAccountQuota(id), 'quota-one')
);

ipcMain.handle('account:quota-many', async (_evt, ids) =>
  wrap(async () => {
    const list = Array.isArray(ids) ? ids : [];
    const out = {};
    for (const id of list) {
      try {
        out[id] = { ok: true, data: await quota.getAccountQuota(id) };
      } catch (e) {
        out[id] = { ok: false, error: e.message || String(e) };
      }
    }
    return out;
  }, 'quota-many')
);

ipcMain.handle('account:rollback', async () =>
  wrap(() => switcher.rollback({ restart: true, force: true }), 'rollback')
);

// ===== 生命周期 =====
app.whenReady().then(() => {
  logInfo(`main start (electron ${process.versions.electron}, chrome ${process.versions.chrome})`);
  logInfo('backend modules loaded: manager, switcher');
  createWindow();
});

app.on('window-all-closed', () => {
  // 退出前停止 OAuth 轮询（系统浏览器由用户自行关闭）
  stopOauthPolling();
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  stopOauthPolling();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
