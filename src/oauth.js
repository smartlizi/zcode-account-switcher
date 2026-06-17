'use strict';
/**
 * ZCode OAuth 凭据写盘 + 账号快照
 *
 * 流程（CLI OAuth + 系统浏览器）：
 *   1. oauthCli.ZaiAuthFlow.poll() 在用户登录后拿到 {token, zaiAccessToken, refreshToken, user}
 *      （token 是 CLI OAuth 返回的 zcode JWT，自带 billing 查询权限）
 *   2. finishLogin(tokenSet) → writeOAuthCredentials 加密写盘
 *   3. manager.capture() 做账号快照
 *
 * 本模块不负责登录 URL 生成 / 网络换 token（那些在 oauthCli.js）。
 * 这里只保留：把换好的 token 集合安全地写入 ZCode 登录态文件 + 工具函数。
 */
const fs = require('fs');
const path = require('path');
const { CREDENTIALS_FILE, CONFIG_FILE } = require('./paths');
const { encrypt } = require('./zcodeCrypto');
const { extractFingerprint } = require('./fingerprint');
const manager = require('./manager');

// ===== Z.ai provider 配置（写盘字段用）=====
// 与 oauthBrowser.OAUTH 保持一致；bigmodel 入口已移除（新流程仅 zai）
const PROVIDER = {
  id: 'zai',
  providerIds: ['builtin:zai-start-plan', 'builtin:zai-coding-plan', 'builtin:zai'],
};

/**
 * 把 oauthBrowser 换好的 token 集合写入 ZCode 登录态文件，然后捕获账号快照。
 *
 * @param {object} opts
 * @param {object} opts.tokenSet - oauthBrowser.exchangeToken() 的返回
 * @param {string} opts.tokenSet.token - zcode JWT（必填）
 * @param {string} [opts.tokenSet.zaiAccessToken] - zai oauth access_token
 * @param {string} [opts.tokenSet.refreshToken] - zai refresh_token
 * @param {object} [opts.tokenSet.user] - 用户信息（email/name/avatar...）
 * @param {string} [opts.label] - 账号自定义名称（空则用邮箱）
 * @param {string} [opts.note='']
 * @param {boolean} [opts.overwrite=true]
 */
async function finishLogin({ tokenSet, label, note = '', overwrite = true } = {}) {
  if (!tokenSet || !tokenSet.token) throw new Error('缺少 token（zcode JWT）');

  const userInfo = normalizeUserInfo(tokenSet.user || {});

  // 保留原登录态内容（写盘前快照到内存），capture 后恢复 —— 确保新增账号不影响当前登录账号
  const prevCredentials = fs.existsSync(CREDENTIALS_FILE) ? fs.readFileSync(CREDENTIALS_FILE, 'utf8') : null;
  const prevConfig = fs.existsSync(CONFIG_FILE) ? fs.readFileSync(CONFIG_FILE, 'utf8') : null;

  // 写入新账号 token（capture 快照需要读到 v2 目录的最新登录态）
  writeOAuthCredentials(tokenSet, userInfo);

  const captured = manager.capture({ label, note, overwrite });

  // 恢复原登录态：把 v2 目录的 credentials/config 写回 capture 之前的内容
  // 这样 ZCode 客户端与工具前端读取的"当前账号"都保持不变（新增账号不切换）
  if (prevCredentials !== null) fs.writeFileSync(CREDENTIALS_FILE, prevCredentials, 'utf8');
  if (prevConfig !== null) fs.writeFileSync(CONFIG_FILE, prevConfig, 'utf8');

  return {
    userInfo,
    fingerprint: extractFingerprint(),
    account: captured.meta,
    created: captured.created,
    skipped: captured.skipped,
  };
}

/**
 * 把 token 集合加密写入 credentials.json + config.json。
 *
 * 写盘字段（与 ZCode 客户端真实结构一致）：
 *   credentials.json:
 *     oauth:active_provider          = enc(zai)
 *     oauth:zai:access_token         = enc(zaiAccessToken)
 *     oauth:zai:refresh_token        = enc(refreshToken)
 *     oauth:zai:user_info            = enc(user JSON)
 *     zcodejwttoken                  = enc(token)            ← 调 API 用的 JWT
 *   config.json:
 *     provider[builtin:zai-*].options.apiKey = token(明文 JWT，含 user_id)
 */
function writeOAuthCredentials(tokenSet, userInfo = {}) {
  backupCurrentLoginState('oauth');

  const credentials = readJsonIfExists(CREDENTIALS_FILE, {});
  const config = readJsonIfExists(CONFIG_FILE, {});

  const zcodeJwtToken = tokenSet.token;          // 调 API 的 JWT
  const accessToken = tokenSet.zaiAccessToken;    // zai oauth access_token
  const refreshToken = tokenSet.refreshToken;

  credentials['oauth:active_provider'] = encrypt(PROVIDER.id);
  if (accessToken) credentials[`oauth:${PROVIDER.id}:access_token`] = encrypt(accessToken);
  if (refreshToken) credentials[`oauth:${PROVIDER.id}:refresh_token`] = encrypt(refreshToken);
  if (zcodeJwtToken) credentials.zcodejwttoken = encrypt(zcodeJwtToken);
  credentials[`oauth:${PROVIDER.id}:user_info`] = encrypt(JSON.stringify(userInfo || {}));

  if (!config.provider || typeof config.provider !== 'object') config.provider = {};
  if (zcodeJwtToken) updateConfigProviders(config, PROVIDER, zcodeJwtToken);

  atomicWriteJson(CREDENTIALS_FILE, credentials);
  atomicWriteJson(CONFIG_FILE, config);

  return { credentialsFile: CREDENTIALS_FILE, configFile: CONFIG_FILE };
}

/**
 * 把 zai 的 apiKey(JWT) 写到 config.json 各 zai provider 槽位，并禁用其它 provider。
 */
function updateConfigProviders(config, provider, apiKey) {
  for (const id of provider.providerIds) {
    if (!config.provider[id] || typeof config.provider[id] !== 'object') {
      config.provider[id] = { enabled: true, options: {} };
    }
    if (!config.provider[id].options || typeof config.provider[id].options !== 'object') {
      config.provider[id].options = {};
    }
    config.provider[id].enabled = true;
    config.provider[id].options.apiKey = apiKey;
  }
}

// ===== 工具函数 =====

/** 归一化 oauthBrowser 返回的 user 对象为标准 userInfo */
function normalizeUserInfo(user) {
  const u = user || {};
  return {
    email: u.email || u.mail || '',
    name: u.name || u.username || u.nickName || u.displayName || '',
    avatar: u.avatar || u.avatarUrl || u.picture || '',
    user_id: u.user_id || u.userId || u.id || u.customerNumber || u.sub || '',
  };
}

function backupCurrentLoginState(reason = 'backup') {
  const dir = path.join(__dirname, '..', '.last', reason + '-' + timestamp());
  fs.mkdirSync(dir, { recursive: true });
  if (fs.existsSync(CREDENTIALS_FILE)) fs.copyFileSync(CREDENTIALS_FILE, path.join(dir, 'credentials.json'));
  if (fs.existsSync(CONFIG_FILE)) fs.copyFileSync(CONFIG_FILE, path.join(dir, 'config.json'));
  return dir;
}

function readJsonIfExists(filePath, fallback) {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (e) {
    throw new Error('读取 JSON 失败 ' + filePath + ': ' + e.message);
  }
}

function atomicWriteJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tmp = filePath + '.zcas.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(tmp, filePath);
}

function timestamp() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

module.exports = {
  PROVIDER,
  finishLogin,
  writeOAuthCredentials,
  updateConfigProviders,
  normalizeUserInfo,
};
