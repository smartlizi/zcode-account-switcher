'use strict';
/**
 * ZCode OAuth 登录 —— Authorization Code 流程（与官方 ZCode 客户端一致）。
 *
 * 背景：早期版本用的 CLI device flow（/oauth/cli/init + /oauth/cli/poll）已被
 * 官方服务端废弃（2026-06 起端点返回 404）。反编译官方客户端 app.asar 后确认
 * 其早已改用标准 Authorization Code OAuth，本模块与之对齐。
 *
 * 官方客户端真实配置（提取自 out/host/index.js provider Dm）：
 *   authorizeUrl : https://chat.z.ai/api/oauth/authorize
 *   tokenUrl     : https://zcode.z.ai/api/v1/oauth/token
 *   redirectUri  : zcode://zai-auth/callback   ← 自定义协议回调
 *   appId        : client_P8X5CMWmlaRO9gyO-KSqtg
 *
 * 流程：
 *   1. buildAuthorizeUrl(state) → 浏览器打开登录页，用户登录
 *   2. 浏览器跳转 zcode://zai-auth/callback?code=<授权码>&state=<state>
 *   3. 主进程 protocol.handle('zcode') 捕获回调，校验 state（防 CSRF）
 *   4. exchangeCode(code) → POST token 端点换 { token, zai.access_token, ... }
 *
 * 本模块是无状态网络层：state 的生成与校验由主进程负责（更内聚）。
 * exchangeCode 返回的 tokenSet 结构与 oauth.finishLogin() 期望完全对齐，
 * 写盘 / billing 初始化逻辑零改动。
 */

// ===== 官方客户端真实 OAuth 配置（不可随意改，服务端校验）=====
const APP_ID = 'client_P8X5CMWmlaRO9gyO-KSqtg';
const REDIRECT_URI = 'zcode://zai-auth/callback';
const AUTHORIZE_URL = 'https://chat.z.ai/api/oauth/authorize';
const TOKEN_URL = 'https://zcode.z.ai/api/v1/oauth/token';

/**
 * 拼接授权页 URL。
 * @param {string} state - 主进程生成的随机串（CSRF 防护，回调时原样回传校验）
 * @returns {string} 完整 authorize URL
 */
function buildAuthorizeUrl(state) {
  const q = new URLSearchParams({
    response_type: 'code',
    client_id: APP_ID,
    redirect_uri: REDIRECT_URI,
    state: state,
  });
  return AUTHORIZE_URL + '?' + q.toString();
}

/**
 * 用授权码换取 token 集合。
 *
 * 逆向自官方客户端 ZaiProviderAdapter.exchangeToken()：
 *   POST {tokenUrl} { provider:'zai', code, redirect_uri, state }
 * 成功响应 { code:0, data:{ token, zai:{ access_token, refresh_token }, user } }
 *
 * @param {string} code - 回调拿到的授权码
 * @param {string} state - authorize 时用的 state（服务端校验须与之一致，不能传空）
 * @returns {Promise<{token:string, zaiAccessToken:string, refreshToken?:string, user:object}>}
 *   与 oauth.finishLogin() 期望的 tokenSet 同构
 */
async function exchangeCode(code, state) {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      provider: 'zai',
      code: code,
      redirect_uri: REDIRECT_URI,
      state: state || '',
    }),
  });
  let json;
  try {
    json = await res.json();
  } catch (_) {
    const t = await res.text().catch(() => '');
    throw new Error('OAuth token HTTP ' + res.status + ': ' + (t || '').slice(0, 200));
  }
  if (!json || json.code !== 0) {
    throw new Error((json && json.msg) || ('token 交换失败 HTTP ' + res.status));
  }
  const d = (json && json.data) || {};
  if (!d.token || !(d.zai && d.zai.access_token)) {
    throw new Error('token 响应缺少 data.token / data.zai.access_token');
  }
  return {
    token: d.token,
    zaiAccessToken: d.zai.access_token,
    refreshToken: d.zai.refresh_token,
    user: d.user || {},
  };
}

module.exports = {
  buildAuthorizeUrl,
  exchangeCode,
  APP_ID,
  REDIRECT_URI,
  AUTHORIZE_URL,
  TOKEN_URL,
};
