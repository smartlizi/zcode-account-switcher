'use strict';
/**
 * ZCode 额度查询
 *
 * 读取当前 credentials/config 中的 token，调用 ZCode billing API，返回总额/已用/剩余概览。
 */
const fs = require('fs');
const { CREDENTIALS_FILE, CONFIG_FILE } = require('./paths');
const { decrypt, isEncrypted } = require('./zcodeCrypto');

const BILLING_CURRENT_URL = 'https://zcode.z.ai/api/v1/zcode-plan/billing/current';
const BILLING_BALANCE_URL = 'https://zcode.z.ai/api/v1/zcode-plan/billing/balance';

// ZCode 客户端请求 billing/current 时带 app_version + platform 参数，
// 服务端根据这些参数路由到正确的 billing plan 版本；
// 缺少参数时服务端可能返回空 plans（新账号场景下尤为明显）。
const CLIENT_APP_VERSION = '4.1.10';
const CLIENT_PLATFORM = 'win32-x64';

function buildBillingUrl(baseUrl) {
  var url = new URL(baseUrl);
  url.searchParams.set('app_version', CLIENT_APP_VERSION);
  url.searchParams.set('platform', CLIENT_PLATFORM);
  return url.toString();
}

async function getQuotaOverview() {
  const tokens = readCandidateTokens();
  if (tokens.length === 0) throw new Error('未找到可用于查询额度的 ZCode token，请先登录或切换账号');
  return queryQuotaByTokens(tokens);
}

async function queryQuotaByToken(token) {
  return queryQuotaByTokens([token]);
}

async function queryQuotaByTokens(tokens) {
  let lastError = null;
  let authFailCount = 0;
  for (const token of tokens) {
    try {
      const current = await fetchBilling(buildBillingUrl(BILLING_CURRENT_URL), token);
      const balance = await fetchBilling(BILLING_BALANCE_URL, token);
      const overview = normalizeQuota(current.data, balance.data);

      return {
        ...overview,
        refreshedAt: Date.now(),
        raw: { current: current.data, balance: balance.data },
      };
    } catch (e) {
      lastError = e;
      // 401/403 计数：若所有候选 token 都鉴权失败，说明 token 整体过期，提示重新登录
      if (e && /HTTP 40[13]/.test(e.message)) authFailCount++;
      // 401/403 说明该 token 不适用，继续试下一个候选 token（不再 break）
    }
  }

  // 所有 token 都 401/403：可能是服务端首次激活延迟（token 已写入但服务端缓存未刷新），
  // 等 1.5s 后用第一个候选 token 重试一次，避免误报"过期"。
  // 手动刷新能成功就是这个原因——首次查询失败后过几秒再查就成功了。
  if (authFailCount > 0 && authFailCount === tokens.length && tokens.length > 0) {
    await new Promise((r) => setTimeout(r, 1500));
    try {
      const token = tokens[0];
      const current = await fetchBilling(buildBillingUrl(BILLING_CURRENT_URL), token);
      const balance = await fetchBilling(BILLING_BALANCE_URL, token);
      const overview = normalizeQuota(current.data, balance.data);
      return {
        ...overview,
        refreshedAt: Date.now(),
        raw: { current: current.data, balance: balance.data },
      };
    } catch (e) {
      lastError = e;
    }
    // 重试仍失败 → token 真的过期，给出明确指引
    throw new Error('该账号 Token 已过期，请删除后重新登录');
  }
  throw lastError || new Error('额度查询失败');
}

function getAccountQuota(id) {
  const manager = require('./manager');
  const snapshot = manager.load(id);
  const tokens = readCandidateTokensFromSnapshot(snapshot);
  if (tokens.length === 0) throw new Error('该账号快照里未找到可用于查询额度的 token');
  return queryQuotaByTokens(tokens);
}

async function fetchBilling(url, token) {
  // 429 退避重试：多个账号首次启动时并发查询，服务端可能限流。
  // 渐进退避 500ms / 1.5s / 4s，避免一次性失败导致额度卡片显示错误。
  const retryDelays = [500, 1500, 4000];
  let lastError = null;
  for (let attempt = 0; attempt <= retryDelays.length; attempt++) {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        accept: 'application/json, text/plain, */*',
        authorization: 'Bearer ' + token,
      },
    });
    const text = await response.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch (_) { data = text; }
    if (response.ok) return { status: response.status, data };

    // 429 限流：退避后重试（最后一次 429 也退避，让后续 token 在 queryQuotaByTokens 里继续）
    if (response.status === 429 && attempt < retryDelays.length) {
      lastError = new Error('服务端限流，正在重试...');
      await new Promise((r) => setTimeout(r, retryDelays[attempt]));
      continue;
    }

    // 401/403 说明 token 无效或过期，转成友好提示（JWT 有有效期，过期是正常现象）
    if (response.status === 401 || response.status === 403) {
      throw new Error('Token 已过期或无效（HTTP ' + response.status + '）');
    }
    const msg = typeof data === 'object' && data ? (data.message || data.msg || data.error) : text;
    throw new Error(`额度接口 HTTP ${response.status}: ${msg || response.statusText}`);
  }
  throw lastError || new Error('额度查询失败');
}

function readBestToken() {
  return readCandidateTokens()[0] || null;
}

function readCandidateTokens() {
  const credentials = readJson(CREDENTIALS_FILE);
  const config = readJson(CONFIG_FILE);
  return readCandidateTokensFromObjects(credentials, config);
}

function readBestTokenFromSnapshot(snapshot) {
  if (!snapshot) return null;
  return readCandidateTokensFromSnapshot(snapshot)[0] || null;
}

function readCandidateTokensFromSnapshot(snapshot) {
  if (!snapshot) return [];
  return readCandidateTokensFromObjects(parseJsonText(snapshot.credentials), parseJsonText(snapshot.config));
}

function readCandidateTokensFromObjects(credentials, config) {
  const activeProvider = safeDecrypt(credentials && credentials['oauth:active_provider']) || 'zai';
  const tokens = [];
  const add = (value) => {
    const plain = safeDecrypt(value);
    if (plain && looksLikeToken(plain) && !tokens.includes(plain)) tokens.push(plain);
  };

  // 顺序很重要：zcodejwttoken(data.token) 才是调 zcode.z.ai/billing 的正确 token，
  // 必须排最前；oauth:*:access_token 是 chat.z.ai 的 OAuth token，查 zcode billing 会 401。
  add(credentials && credentials.zcodejwttoken);
  add(credentials && credentials['oauth:zai:access_token']);
  add(credentials && credentials['oauth:bigmodel:access_token']);
  add(credentials && credentials[`oauth:${activeProvider}:access_token`]);

  const providers = config && config.provider && typeof config.provider === 'object' ? config.provider : {};
  for (const provider of Object.values(providers)) {
    const apiKey = provider && provider.options && provider.options.apiKey;
    if (apiKey && looksLikeToken(apiKey) && !tokens.includes(apiKey)) tokens.push(apiKey);
  }

  return tokens;
}

function safeDecrypt(value) {
  if (!value) return null;
  try { return isEncrypted(value) ? decrypt(value) : value; } catch (_) { return null; }
}

function looksLikeToken(value) {
  return typeof value === 'string' && value.trim().length > 20;
}

/**
 * 从 billing/current 的 plans 数组提取账号付费等级（复刻 ZCode 客户端逻辑）。
 * 逆向依据：ZCode app.asar out/host/index.js 的 rz()/XN()/summarizeStartPlans()。
 *
 * 判定规则（按优先级，Max 优先于 Pro 避免模糊匹配）：
 *   - 有 status=active 且 plan_id/name 含 max   → "Max"
 *   - 有 status=active 且 plan_id/name 含 pro   → "Pro"
 *   - 有 status=active 且 plan_id/name 含 lite  → "Lite"
 *   - 有 status=active 且 plan_id/name 含 start → "Start Plan"
 *   - 否则返回 null（免费/编码套餐，无付费等级）
 */
function extractPlanTier(currentData) {
  const cur = unwrap(currentData);
  const plans = Array.isArray(cur && cur.plans) ? cur.plans : [];
  if (plans.length === 0) return null;

  const activePlans = plans.filter((p) => String(p && p.status || '').toLowerCase() === 'active');
  if (activePlans.length === 0) return null;

  const matchKey = (p, kw) => {
    const id = String((p && p.plan_id) || '').toLowerCase();
    const name = String((p && p.name) || '').toLowerCase();
    return id.includes(kw) || name.includes(kw);
  };

  if (activePlans.some((p) => matchKey(p, 'max'))) return { label: 'Max', tier: 'max' };
  if (activePlans.some((p) => matchKey(p, 'pro'))) return { label: 'Pro', tier: 'pro' };
  if (activePlans.some((p) => matchKey(p, 'lite'))) return { label: 'Lite', tier: 'lite' };
  if (activePlans.some((p) => matchKey(p, 'start-plan') || matchKey(p, 'start plan'))) return { label: 'Start Plan', tier: 'start' };
  return null;
}

function normalizeQuota(currentData, balanceData) {
  const current = unwrap(currentData);
  const balance = unwrap(balanceData);
  const pool = flattenNumbers({ current, balance });

  let total = sumNumbers(pool, ['total_units']) ?? firstNumber(pool, ['total', 'totalQuota', 'totalCredits', 'quotaTotal', 'amountTotal', 'creditTotal']);
  let used = sumNumbers(pool, ['used_units']) ?? firstNumber(pool, ['used', 'usedQuota', 'usedCredits', 'quotaUsed', 'amountUsed', 'consumed', 'totalUsed']);
  let remaining = sumNumbers(pool, ['remaining_units']) ?? firstNumber(pool, ['remaining', 'remain', 'balance', 'available', 'availableQuota', 'left', 'quotaRemaining']);

  if (total == null && used != null && remaining != null) total = used + remaining;
  if (used == null && total != null && remaining != null) used = Math.max(0, total - remaining);
  if (remaining == null && total != null && used != null) remaining = Math.max(0, total - used);

  const percentUsed = total && used != null ? clamp((used / total) * 100, 0, 100) : null;

  // 计费数据是否为空（plans 和 balances 都是空数组 → 账号本身无套餐数据）
  const isEmpty = Array.isArray(current.plans) && current.plans.length === 0
    && Array.isArray(balance.balances) && balance.balances.length === 0;

  return {
    total: total ?? null,
    used: used ?? null,
    remaining: remaining ?? null,
    percentUsed,
    isEmpty,
    planTier: extractPlanTier(currentData),
    items: normalizeQuotaItems(balance),
    display: {
      total: formatQuota(total),
      used: formatQuota(used),
      remaining: formatQuota(remaining),
      percentUsed: percentUsed == null ? '未知' : percentUsed.toFixed(1) + '%',
    },
  };
}

function unwrap(data) {
  let cur = data;
  for (let i = 0; i < 4; i++) {
    if (!cur || typeof cur !== 'object') return cur;
    if (cur.data !== undefined) { cur = cur.data; continue; }
    if (cur.result !== undefined) { cur = cur.result; continue; }
    break;
  }
  return cur || {};
}

function flattenNumbers(obj, prefix = '', out = {}) {
  if (!obj || typeof obj !== 'object') return out;
  for (const [key, value] of Object.entries(obj)) {
    const p = prefix ? prefix + '.' + key : key;
    const n = toNumber(value);
    if (n != null) out[p] = n;
    else if (value && typeof value === 'object') flattenNumbers(value, p, out);
  }
  return out;
}

function firstNumber(obj, keys) {
  for (const [path, value] of Object.entries(obj || {})) {
    const name = path.split('.').pop();
    if (keys.includes(name)) return value;
  }
  return null;
}

function sumNumbers(obj, keys) {
  let total = 0;
  let count = 0;
  for (const [path, value] of Object.entries(obj || {})) {
    const name = path.split('.').pop();
    if (keys.includes(name)) {
      total += value;
      count++;
    }
  }
  return count ? total : null;
}

function normalizeQuotaItems(balance) {
  const balances = balance && Array.isArray(balance.balances) ? balance.balances : [];
  return balances.map((item) => {
    const total = toNumber(item.total_units);
    const used = toNumber(item.used_units);
    const remaining = toNumber(item.remaining_units) ?? toNumber(item.available_units);
    return {
      name: item.show_name || item.name || item.entitlement_id || item.plan_id || '未知模型',
      total,
      used,
      remaining,
      percentUsed: total && used != null ? clamp((used / total) * 100, 0, 100) : null,
      unit: item.unit_type || item.meter || 'quota',
      periodEnd: item.period_end || item.expires_at,
    };
  });
}

function toNumber(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value.replace(/,/g, ''));
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function formatQuota(value) {
  if (value == null) return '未知';
  return new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 2 }).format(value);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function readJson(filePath) {
  try {
    if (!fs.existsSync(filePath)) return null;
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (_) {
    return null;
  }
}

function parseJsonText(text) {
  try { return text ? JSON.parse(text) : null; } catch (_) { return null; }
}

module.exports = {
  BILLING_CURRENT_URL,
  BILLING_BALANCE_URL,
  buildBillingUrl,
  CLIENT_APP_VERSION,
  CLIENT_PLATFORM,
  getQuotaOverview,
  getAccountQuota,
  queryQuotaByToken,
  readBestToken,
  readCandidateTokens,
  readBestTokenFromSnapshot,
  readCandidateTokensFromSnapshot,
  normalizeQuota,
};
