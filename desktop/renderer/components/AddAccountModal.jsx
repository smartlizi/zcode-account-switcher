import React, { useEffect, useRef, useState } from 'react';
import { Loader2, UserPlus, CheckCircle2, LogIn, ShieldCheck } from 'lucide-react';

/**
 * 添加账号弹窗（CLI OAuth + 系统浏览器跳转）
 *
 * 用户只需点「开始」，工具会：
 *   1. 调 CLI OAuth init 拿授权链接，自动用系统浏览器打开
 *   2. 用户在自带浏览器里登录 Z.ai 账号（无需回工具点任何按钮）
 *   3. 工具后台轮询 poll 接口，登录成功的瞬间自动写盘 + 快照
 *   4. 弹窗显示「✓ 已添加」并自动关闭
 *
 * 相比旧的无痕浏览器方案：
 *   - 去掉 Chromium 170MB 依赖
 *   - CLI OAuth 返回的 JWT 自带 billing 权限，登录后即可查额度
 *   - 用户自带浏览器风控更友好
 *
 * 全程通过 onFlowEvent 事件接收主进程的阶段回调。
 */
export default function AddAccountModal({ onClose, onDone, showToast }) {
  // phase: opening | waiting | exchanging | saved | error
  const [phase, setPhase] = useState('opening');
  const [progressMsg, setProgressMsg] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  // 局部 busy：只禁用弹窗内按钮，不影响工具栏（全局 busy 会卡死所有操作）
  const [busy, setBusy] = useState(true);
  const unsubFlowRef = useRef(null);

  const cleanup = () => {
    if (unsubFlowRef.current) { unsubFlowRef.current(); unsubFlowRef.current = null; }
  };
  // 卸载兜底：取消事件订阅 + 通知主进程停轮询
  useEffect(() => {
    return () => {
      cleanup();
      try { window.api.oauthCancel(); } catch (_) {}
    };
  }, []);

  // 入口：启动 CLI OAuth 流程
  useEffect(() => {
    start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const start = async () => {
    setError('');
    setBusy(true);
    setPhase('opening');
    setProgressMsg('正在打开系统浏览器...');

    // 先订阅事件，避免漏早期事件
    unsubFlowRef.current = window.api.onFlowEvent((event) => handleFlowEvent(event));

    const r = await window.api.oauthStart({});
    if (!r.ok) {
      if (unsubFlowRef.current) { unsubFlowRef.current(); unsubFlowRef.current = null; }
      fail(r.error);
      return;
    }
    // oauthStart 返回后，流程在后台跑（开浏览器 + 轮询），后续靠 onFlowEvent 推进
  };

  // 处理流程事件
  const handleFlowEvent = (event) => {
    switch (event.type) {
      case 'browser-open':
        setPhase('opening');
        setProgressMsg(event.message || '正在打开系统浏览器');
        break;
      case 'waiting-login':
        setPhase('waiting');
        setProgressMsg(event.message || '等待登录');
        break;
      case 'exchanging':
        setPhase('exchanging');
        setProgressMsg(event.message || '正在保存账号...');
        if (event.email) setEmail(event.email);
        break;
      case 'saved':
        setPhase('saved');
        setBusy(false);
        cleanup();
        if (event.email) setEmail(event.email);
        if (event.skipped) {
          showToast('info', '该账号已存在（' + (event.account?.label || '已有') + '）');
        } else {
          showToast('success', `已添加账号：${event.account?.label || event.email || '新账号'}`);
        }
        // 传新账号 id 给 onDone，App 只刷新这一个账号的额度（不全量）
        setTimeout(() => onDone(event.account?.id), 800);
        break;
      case 'error':
        setBusy(false);
        cleanup();
        setError(event.message || '流程出错');
        setPhase('error');
        break;
      default:
        break;
    }
  };

  const fail = (msg) => {
    setError(msg || '操作失败');
    setBusy(false);
    setPhase('error');
  };

  const retry = () => {
    cleanup();
    setError('');
    start();
  };

  // 关闭时取消流程（停轮询；系统浏览器由用户自行关闭）
  const handleClose = () => {
    if (phase === 'exchanging' || phase === 'saved') return;
    cleanup();
    window.api.oauthCancel();
    onClose();
  };

  const phaseLabel = {
    opening: '打开登录页',
    waiting: '等待登录',
    exchanging: '保存中',
    saved: '完成',
    error: '出错',
  }[phase] || '';

  return (
    <div className="modal-overlay" onClick={phase === 'exchanging' || phase === 'saved' ? undefined : handleClose}>
      <div className="modal modal-wide" onClick={(e) => e.stopPropagation()}>
        <h2>
          <UserPlus size={18} />
          添加账号
          {phaseLabel && <span className="phase-tag">{phaseLabel}</span>}
        </h2>

        {/* opening 通用 loading */}
        {phase === 'opening' && (
          <div className="oauth-panel">
            <div className="install-box">
              <Loader2 size={28} className="spin" />
              <strong>{progressMsg || '准备中...'}</strong>
              <span className="progress-hint">即将跳转到系统浏览器登录</span>
            </div>
          </div>
        )}

        {/* 等待用户登录 */}
        {phase === 'waiting' && (
          <div className="oauth-panel">
            <div className="waiting-box">
              <LogIn size={34} />
              <strong>请在系统浏览器窗口中登录</strong>
              <span>工具会自动检测登录状态，登录成功后自动完成添加</span>
              <span className="progress-hint">支持账号密码 / 手机号登录（登录后无需做任何操作）</span>
              <Loader2 size={20} className="spin" />
            </div>
          </div>
        )}

        {/* 正在保存账号 */}
        {phase === 'exchanging' && (
          <div className="oauth-panel">
            <div className="install-box">
              <ShieldCheck size={28} color="#22c55e" />
              <strong>登录成功，正在保存账号...</strong>
              <Loader2 size={20} className="spin" />
              <span className="progress-hint">全程自动化，请稍候</span>
            </div>
          </div>
        )}

        {/* 成功 */}
        {phase === 'saved' && (
          <div className="oauth-panel">
            <div className="logged-in-box">
              <CheckCircle2 size={32} color="#22c55e" />
              <strong>账号已添加成功</strong>
              {email && <span className="login-email">{email}</span>}
            </div>
          </div>
        )}

        {/* 错误 */}
        {phase === 'error' && (
          <div className="oauth-panel">
            <div className="oauth-error">
              <strong>出错：</strong>{error}
            </div>
          </div>
        )}

        {/* 底部操作 */}
        <div className="modal-actions">
          <button className="btn" onClick={handleClose} disabled={busy}>
            {phase === 'saved' || phase === 'error' ? '关闭' : '取消'}
          </button>
          {phase === 'error' && (
            <button className="btn btn-primary" onClick={retry} disabled={busy}>
              重试
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
