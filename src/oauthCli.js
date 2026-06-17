'use strict';
/**
 * ZCode CLI OAuth 登录流程（移植自 zcode2api 的 ZaiAuthFlow）。
 *
 * 与 Web OAuth（chat.z.ai/api/oauth/authorize）不同，CLI OAuth 走的是
 * zcode.z.ai 专门为第三方 CLI 工具设计的接口，返回的 JWT 自带 billing
 * 查询权限，无需登录 ZCode 客户端「激活」即可查询额度。
 *
 * 流程：
 *   1. init()  → POST /oauth/cli/init  → 拿 { flow_id, authorize_url }
 *   2. 用户在【系统浏览器】打开 authorize_url 登录
 *   3. poll(flow_id) → 轮询直到 status=ready，拿 { token, zai.access_token, zai.refresh_token, user }
 *
 * poll 返回的 data 结构与原 oauthBrowser.exchangeToken() 完全对齐，
 * 所以 oauth.finishLogin() 写盘逻辑可原样复用。
 *
 * poll_token：init / poll 请求都要带 Authorization: Bearer <poll_token>，
 * 用于标识同一次登录流程（与参考项目一致）。
 */
const crypto = require('crypto');

const API_BASE = 'https://zcode.z.ai/api/v1';

class ZaiAuthFlow {
  constructor(apiBase) {
    this.apiBase = apiBase || API_BASE;
    // poll_token：标识同一次登录流程，init 和 poll 都要带
    this.pollToken = crypto.randomBytes(32).toString('hex');
  }

  /**
   * 发起 OAuth 流程。
   * @returns {Promise<{flowId:string, authorizeUrl:string}>}
   */
  async init() {
    const res = await fetch(this.apiBase + '/oauth/cli/init', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + this.pollToken,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ provider: 'zai' }),
    });
    if (!res.ok) {
      const t = await res.text().catch(() => '');
      throw new Error('OAuth init HTTP ' + res.status + ': ' + (t || '').slice(0, 200));
    }
    const json = await res.json();
    const data = (json && json.data) || {};
    const flowId = data.flow_id;
    const authorizeUrl = data.authorize_url;
    if (!flowId || !authorizeUrl) {
      throw new Error('返回的 OAuth 流程数据不完整');
    }
    return { flowId: flowId, authorizeUrl: authorizeUrl };
  }

  /**
   * 轮询登录状态。
   * @param {string} flowId
   * @returns {Promise<{status:string, token?:string, zai?:object, user?:object}>}
   *   status: 'pending' | 'ready' | 'failed'
   *   ready 时附带 token / zai.access_token / zai.refresh_token / user
   */
  async poll(flowId) {
    const res = await fetch(this.apiBase + '/oauth/cli/poll/' + flowId, {
      headers: { Authorization: 'Bearer ' + this.pollToken },
    });
    if (!res.ok) {
      throw new Error('OAuth poll HTTP ' + res.status);
    }
    const json = await res.json();
    return (json && json.data) || {};
  }
}

module.exports = { ZaiAuthFlow, API_BASE };
