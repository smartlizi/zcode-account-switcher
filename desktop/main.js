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

const { app, BrowserWindow, ipcMain, shell, dialog, protocol } = require('electron');
const crypto = require('crypto');

// 路径适配：开发时 src 在上级目录 ../src，打包后 electron-builder
// 把 src/ 以 extraResources 形式放到 process.resourcesPath/app-src/
// 注意：不能用 app.isPackaged 判断 —— 它在部分环境（如本机当前）会误判为 true，
// 导致开发态走打包分支、require 找不到模块。改用文件系统事实判断更可靠：
// 开发态 ../src/manager.js 存在；打包后 files 不含 src/，故该路径不存在。
const DEV_SRC = path.join(__dirname, '..', 'src');
const PACKED_SRC = path.join(process.resourcesPath, 'app-src');
const SRC_DIR = fs.existsSync(path.join(DEV_SRC, 'manager.js'))
  ? DEV_SRC
  : PACKED_SRC;

// 复用 src/ 里已验证的后端逻辑（开发/打包双模式兼容）
const manager = require(path.join(SRC_DIR, 'manager'));
const switcher = require(path.join(SRC_DIR, 'switcher'));
const oauth = require(path.join(SRC_DIR, 'oauth'));
const quota = require(path.join(SRC_DIR, 'quota'));
const oauthCli = require(path.join(SRC_DIR, 'oauthCli'));

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
    title: 'ZCode 账号切换器',
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
  logInfo('[oauth-flow] ' + event.type + (event.message ? ': ' + event.message : '') + ', mainWindow=' + (mainWindow ? (mainWindow.isDestroyed() ? 'destroyed' : 'alive') : 'null'));
  try {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('oauth:flow-event', event);
    }
  } catch (e) {
    logInfo('[oauth-flow] send error: ' + (e && e.message));
  }
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

// ===== OAuth 添加账号（Authorization Code + 系统浏览器 + zcode:// 协议回调）=====
// 流程：buildAuthorizeUrl → openExternal 开系统浏览器 → 用户登录 →
//   浏览器跳 zcode://zai-auth/callback?code=&state= → protocol.handle 捕获 →
//   exchangeCode 换 token → finishLogin 写盘 + 快照。
// 前端调一次 oauth-start，全程通过 oauth:flow-event 事件接收阶段进度。
//
// 与官方 ZCode 客户端走完全相同的 OAuth 配置（端点 / appId / 回调 URI），
// 替换了已被官方废弃的 device flow（/oauth/cli/init 返回 404）。

// 进行中的登录会话（模块级，跨请求 + 跨进程保留）
let _oauthState = null;     // 本地生成的 state，回调时校验防 CSRF / 串扰
let _oauthResolve = null;   // 登录 promise 的 resolve（{ code } 或 { error }）
let _oauthTimer = null;     // 超时计时器（10 分钟）

// 清理「等回调」状态（清 timer + 置空 resolver），不主动 reject
function stopOauthWait() {
  if (_oauthTimer) { clearTimeout(_oauthTimer); _oauthTimer = null; }
  _oauthResolve = null;
}

/**
 * 处理 zcode:// 协议回调 URL。
 * 校验 state（防 CSRF / 重放 / 跨会话串扰），通过则 resolve 登录 promise。
 * 解析失败或 state 不符静默忽略（浏览器可能重复触发、或残留旧链接）。
 */
function handleOAuthCallback(rawUrl) {
  logInfo('[oauth-callback] received: ' + (rawUrl || '').slice(0, 200));
  if (!rawUrl || typeof rawUrl !== 'string') return;
  let url;
  try { url = new URL(rawUrl); } catch (_) { return; }
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  logInfo('[oauth-callback] code=' + (code ? 'present' : 'absent') + ', state=' + (state || 'absent') + ', expectedState=' + (_oauthState || 'none'));
  if (!code) return;                       // 无授权码，忽略
  if (_oauthState && state && state !== _oauthState) {
    logInfo('[oauth-callback] state mismatch, ignored');
    return;                                // 非本次会话的回调，丢弃
  }
  const resolve = _oauthResolve;
  if (resolve) {
    stopOauthWait();
    resolve({ code });
  }
}

ipcMain.handle('account:oauth-start', async (_evt, opts) => {
  const { label, note } = opts || {};
  try {
    stopOauthWait();

    // 1. 生成 state（CSRF 防护），拼授权 URL（与官方客户端同款配置）
    _oauthState = crypto.randomBytes(16).toString('hex');
    const authorizeUrl = oauthCli.buildAuthorizeUrl(_oauthState);

    // 2. 准备「等回调」promise：协议回调到达时 resolve，超时自动失败
    const loginPromise = new Promise((resolve) => {
      _oauthResolve = resolve;
      _oauthTimer = setTimeout(() => resolve({ error: 'timeout' }), 10 * 60 * 1000);
    });

    // 3. 开系统浏览器登录页 → 等用户登录完成
    sendFlowEvent({ type: 'browser-open', message: '正在打开系统浏览器，请在浏览器中登录 Z.ai 账号' });
    await shell.openExternal(authorizeUrl);
    sendFlowEvent({ type: 'waiting-login', message: '请在浏览器窗口中登录（登录后自动完成，无需任何操作）' });

    const result = await loginPromise;
    if (result.error) {
      _oauthState = null;
      throw new Error(result.error === 'timeout' ? '登录超时（10 分钟），请重试' : result.error);
    }

    // 4. 授权码换 token，写盘 + 初始化额度（tokenSet 与 finishLogin 期望同构）
    //    state 必须传给 token 端点（服务端校验须与 authorize 时一致，否则 parameter error）
    //    注意：要在 exchangeCode 用完 _oauthState 后才清空
    sendFlowEvent({ type: 'exchanging', message: '登录成功，正在保存账号并初始化额度…' });
    const tokenSet = await oauthCli.exchangeCode(result.code, _oauthState);
    _oauthState = null;
    const r = await oauth.finishLogin({ tokenSet, label, note: note || '', overwrite: true });
    logInfo('[oauth-start] finishLogin done, billingReady=' + r.billingReady);
    sendFlowEvent({
      type: 'saved',
      account: r.account,
      email: (r.userInfo && r.userInfo.email) || '',
      skipped: r.skipped,
      billingReady: r.billingReady,
    });
    return { ok: true };
  } catch (e) {
    logInfo('[oauth-start] error: ' + (e && e.message));
    sendFlowEvent({ type: 'error', message: '登录失败：' + (e.message || e) });
    stopOauthWait();
    _oauthState = null;
    return { ok: false, error: e.message || String(e) };
  }
});

// 取消登录流程：通知等待中的 promise 失败（系统浏览器由用户自行关闭）
ipcMain.handle('account:oauth-cancel', async () =>
  wrap(() => {
    if (_oauthResolve) {
      const resolve = _oauthResolve;
      stopOauthWait();
      resolve({ error: 'cancelled' });
    }
    _oauthState = null;
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

// ===== 单实例锁 + 协议回调跨进程转发 =====
// OAuth 回调通过 zcode:// 协议唤起程序，若用户已有实例运行则会触发 second-instance。
// 把回调 URL 转发给首个实例处理（谁运行谁接，浏览器一次回调只唤起一个程序）。
//
// requestSingleInstanceLock 返回 false 的两种情况：
//   1. 真实环境被协议唤起的第二实例：argv 含 zcode://，应直接 quit（OS 已转发给首个实例）
//   2. 沙箱环境主实例：lockfile 写不进，argv 不含 zcode:// → 降级运行（无单实例保护）
let _singleInstanceLockAcquired = false;
try {
  _singleInstanceLockAcquired = app.requestSingleInstanceLock();
  logInfo('[single-instance] requestLock returned=' + _singleInstanceLockAcquired + ', argv=' + JSON.stringify(process.argv));
} catch (e) {
  logInfo('[single-instance] requestLock threw: ' + (e && e.message));
}
if (_singleInstanceLockAcquired) {
  app.on('second-instance', (_e, argv) => {
    logInfo('[second-instance] argv: ' + JSON.stringify(argv));
    const url = argv.find((a) => typeof a === 'string' && a.startsWith('zcode://'));
    if (url) handleOAuthCallback(url);
    else logInfo('[second-instance] no zcode:// url in argv');
    if (mainWindow) { mainWindow.show(); mainWindow.focus(); }
  });
} else {
  // 锁失败：argv 含 zcode:// = 被协议唤起的第二实例（OS 已转发给首个实例），直接退出。
  // argv 不含 zcode:// = 沙箱环境主实例，降级继续运行。
  // 注意：app.quit() 在 whenReady 之前调用可能被 Electron 忽略（进程继续执行到创建窗口），
  //       所以补 process.exit(0) 强制立即退出，避免新实例弹出空窗口覆盖主实例窗口。
  const argvHasZcode = process.argv.some((a) => typeof a === 'string' && a.startsWith('zcode://'));
  if (argvHasZcode) {
    logInfo('[single-instance] second instance (zcode:// in argv), exiting');
    try { app.quit(); } catch (_) {}
    process.exit(0);
  } else {
    logInfo('[single-instance] lock failed without zcode:// (sandbox?), degraded mode');
  }
}

// macOS open-url（whenReady 前可能触发，需缓存到 ready后再处理）
let _macPendingUrl = null;
app.on('open-url', (e, url) => {
  e.preventDefault();
  if (app.isReady()) handleOAuthCallback(url);
  else _macPendingUrl = url;
});

// ===== 生命周期 =====
app.whenReady().then(() => {
  logInfo(`main start (electron ${process.versions.electron}, chrome ${process.versions.chrome})`);
  logInfo('backend modules loaded: manager, switcher');

  // 注册 zcode:// 协议处理器：浏览器登录后跳转 zcode://zai-auth/callback?code=&state=
  // 捕获回调交给 handleOAuthCallback（state 校验 + resolve 登录 promise）
  protocol.handle('zcode', (req) => {
    logInfo('[protocol.handle] zcode url: ' + (req.url || '').slice(0, 200));
    handleOAuthCallback(req.url);
    return new Response(
      '<html><body style="font-family:sans-serif;text-align:center;padding:60px">' +
      '<h2>✅ 登录成功</h2><p>已返回 ZCode Account Switcher，可关闭此页面。</p></body></html>',
      { headers: { 'content-type': 'text/html; charset=utf-8' } }
    );
  });
  // setAsDefaultProtocolClient 注册系统协议 handler：
  //   打包后 process.execPath 就是 exe 本身，直接 "<exe>" "%1" 能启动
  //   开发模式下 electron.exe 需要知道加载哪个 app 目录，否则浏览器唤起
  //   zcode:// 时系统启动 electron.exe "%1" 但找不到 main.js → "error launching app"。
  //   故开发模式显式传 [appPath] 让命令行变成 electron.exe "<appPath>" "%1"。
  const protoArgs = app.isPackaged ? [] : [app.getAppPath()];
  const regOk = app.setAsDefaultProtocolClient('zcode', process.execPath, protoArgs);
  logInfo('[setAsDefaultProtocolClient] zcode registered=' + regOk + ', execPath=' + process.execPath + ', args=' + JSON.stringify(protoArgs));

  // 处理 macOS 在 whenReady 前缓存的回调 URL
  if (_macPendingUrl) {
    handleOAuthCallback(_macPendingUrl);
    _macPendingUrl = null;
  }

  createWindow();
});

app.on('window-all-closed', () => {
  // 退出前停止 OAuth 等待（系统浏览器由用户自行关闭）
  stopOauthWait();
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  stopOauthWait();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
