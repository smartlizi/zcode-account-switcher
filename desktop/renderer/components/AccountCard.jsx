import React, { useState, useEffect, useRef } from 'react';
import { RefreshCw, Trash2, Pencil, Check } from 'lucide-react';

function fmtDate(ts) {
  if (!ts) return '-';
  const d = new Date(ts);
  const p = (n) => String(n).padStart(2, '0');
  return `${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

function fmtNumber(value) {
  if (value == null) return '未知';
  return new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 0 }).format(value);
}

function healthText(health) {
  if (!health) return '未检查';
  if (health.status === 'healthy') return '健康';
  if (health.status === 'warning') return '注意';
  return '异常';
}

/**
 * 把后端 accountHealth.js 输出的技术性 warning/error 文案，
 * 转成对普通用户友好的提示（不改后端逻辑，仅前端展示映射）。
 */
function humanizeSummary(summary) {
  if (!summary) return '';
  const s = String(summary);
  // user_info 加密绑定本机指纹，换机器/复制快照无法解密 → 正常现象
  if (s.includes('无法在当前机器环境解密') || s.includes('user_info 无法')) {
    return '该账号在另一台机器上捕获，本机无法读取其详细资料，但不影响切换';
  }
  if (s.includes('user_info 存在，但解密后不是有效 JSON')) {
    return '账号资料数据异常，但不影响切换';
  }
  if (s.includes('未找到 user_info')) {
    return '账号资料信息不完整，但不影响切换';
  }
  if (s.includes('credentials 结构异常')) {
    return '登录态文件结构异常，建议重新捕获该账号';
  }
  return s;
}

/**
 * 把 provider（如 builtin:zai-coding-plan）解析成 {label, tier} 彩色徽章信息。
 * 真实付费等级只有四种：Start Plan / Lite / Pro / Max。
 * provider 字段编码的是套餐类型（如 zai-coding-plan 免费编码套餐、zai-start-plan），
 * 不直接编码付费等级。无法判定具体付费等级时返回 null（不显示徽章，避免误标）。
 */
function planBadge(provider) {
  const raw = String(provider || '').toLowerCase().replace(/^builtin:/, '');
  // 关键词匹配，Max 优先于 Pro（避免 pro 模糊匹配）
  if (raw.includes('max')) return { label: 'Max', tier: 'max' };
  if (raw.includes('pro')) return { label: 'Pro', tier: 'pro' };
  if (raw.includes('lite')) return { label: 'Lite', tier: 'lite' };
  if (raw.includes('start-plan') || raw.includes('start')) return { label: 'Start Plan', tier: 'start' };
  // 无法判定具体付费等级（如 zai-coding-plan 免费编码套餐）→ 不显示徽章
  return null;
}

/**
 * 单账号卡片
 */
export default function AccountCard({
  account,
  quota,
  isCurrent,
  busy,
  renaming,
  selected,
  onSelectedChange,
  onUse,
  onDelete,
  onRenameStart,
  onRenameCommit,
  onRefreshQuota,
}) {
  const [editName, setEditName] = useState(account.label);
  const inputRef = useRef(null);

  useEffect(() => {
    if (renaming) {
      setEditName(account.label);
      // 聚焦并选中
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 0);
    }
  }, [renaming, account.label]);

  const handleKey = (e) => {
    if (e.key === 'Enter') onRenameCommit(editName.trim());
    if (e.key === 'Escape') onRenameCommit(account.label); // 取消
  };

  return (
    <div className={`account-card ${isCurrent ? 'current' : ''} ${selected ? 'export-selected' : ''}`}>
      <label className="account-export-check" title="勾选后导出此账号">
        <input
          type="checkbox"
          checked={!!selected}
          onChange={(e) => onSelectedChange?.(e.target.checked)}
          disabled={busy}
          aria-label={'选择导出 ' + account.label}
        />
        <span />
      </label>
      <div className="account-avatar">
        {account.avatar ? <img src={account.avatar} alt="" /> : <span>{(account.email || account.label || '?').slice(0, 1).toUpperCase()}</span>}
      </div>
      <div className="account-info">
        <div className="account-name-row">
          {renaming ? (
            <input
              ref={inputRef}
              className="modal-input"
              style={{ height: 32, marginBottom: 0, width: 220, fontSize: 14 }}
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onKeyDown={handleKey}
              onBlur={() => onRenameCommit(editName.trim())}
            />
          ) : (
            <span className="account-name">{account.label}</span>
          )}
          {isCurrent && (
            <span className="account-badge">
              <Check size={11} />
              当前
            </span>
          )}
          <span className={`health-badge ${account.health?.status || 'unknown'}`} title={account.health?.summary || '尚未检查'}>
            {healthText(account.health)}
          </span>
          {(() => {
            // 优先用 billing/current 实时返回的 planTier（准确，复刻 ZCode 客户端判定），
            // 回退到 provider 静态判定（仅 start-plan 能命中）
            const badge = quota?.ok && quota.data ? quota.data.planTier : null;
            const fallback = badge ? null : planBadge(account.provider);
            const final = badge || fallback;
            if (!final) return null;
            return (
              <span className={`plan-badge plan-${final.tier}`} title={account.provider}>{final.label}</span>
            );
          })()}
        </div>
        <div className="account-meta">
          <span>捕获于 {fmtDate(account.capturedAt)}</span>
          {account.sizeKb ? <span>{account.sizeKb} KB</span> : null}
        </div>
        {account.health?.status && account.health.status !== 'healthy' && (
          <div className="account-summary">{humanizeSummary(account.health.summary)}</div>
        )}
      </div>

      {/* 额度块：全部单行 —— 标题 | 刷新 | [模型 条 数字]×N（刷新时间移到 hover 提示，避免与数字重叠）*/}
      <div className="account-quota-block" title={quota?.ok && quota.data && !quota.data.isEmpty ? `额度刷新于 ${fmtDate(quota.data.refreshedAt)}` : '额度'}>
        <span className="account-quota-title">额度</span>
        {onRefreshQuota && (
          <button
            className="btn btn-ghost btn-icon account-quota-refresh"
            title="刷新此账号额度"
            aria-label={'刷新 ' + account.label + ' 的额度'}
            onClick={() => onRefreshQuota(account.id)}
            disabled={busy || quota?.loading}
          >
            <RefreshCw size={13} className={quota?.loading ? 'spin' : ''} />
          </button>
        )}
        {quota?.loading ? (
          <span className="account-quota-state">刷新中…</span>
        ) : quota?.ok && quota.data ? (
          quota.data.isEmpty || !quota.data.items || quota.data.items.length === 0 ? (
            <span className="account-quota-state hint">暂无模型额度数据</span>
          ) : (
            <div className="quota-items">
              {quota.data.items.map((item, idx) => {
                // 进度条语义：剩余额度比例（满额度→满条，用到 0→空条）
                const remainingPct = item.percentUsed == null ? null : Math.max(0, Math.min(100, 100 - item.percentUsed));
                // 接近耗尽（剩余 < 20%）用警示色，保留数字双重表达（符合 color-not-only）
                const tense = remainingPct != null && remainingPct < 20 ? 'tense' : '';
                return (
                  <div className={`quota-item ${tense}`} key={idx} title={`${item.name}：剩 ${fmtNumber(item.remaining)} / 总 ${fmtNumber(item.total)}`}>
                    <span className="quota-item-name" title={item.name}>{item.name}</span>
                    <div
                      className="account-quota-bar remaining"
                      role="progressbar"
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={remainingPct == null ? undefined : Math.round(remainingPct)}
                      aria-label={`${item.name} 剩余额度 ${remainingPct == null ? '未知' : remainingPct.toFixed(0) + '%'}`}
                    >
                      <span style={{ width: `${remainingPct == null ? 0 : remainingPct}%` }} />
                    </div>
                    <span className="quota-item-stats-inline" title={`剩余 ${fmtNumber(item.remaining)} / 总量 ${fmtNumber(item.total)}`}>
                      <span className="qi-remain">{fmtNumber(item.remaining)}</span>
                    </span>
                  </div>
                );
              })}
            </div>
          )
        ) : quota && quota.ok === false ? (
          <span className="account-quota-state hint" title={quota.error || '额度获取失败'}>{quota.error || '额度获取失败'}</span>
        ) : (
          <span className="account-quota-state hint">点击刷新获取额度</span>
        )}
      </div>

      <div className="account-actions">
        <button
          className="btn btn-ghost btn-icon"
          title="重命名"
          aria-label={'重命名 ' + account.label}
          onClick={onRenameStart}
          disabled={busy || renaming}
        >
          <Pencil size={15} />
        </button>
        <button
          className="btn btn-ghost btn-icon"
          title="删除"
          aria-label={'删除 ' + account.label}
          onClick={onDelete}
          disabled={busy}
          style={{ color: '#ef4444' }}
        >
          <Trash2 size={15} />
        </button>
        <button
          className="btn btn-primary btn-sm"
          onClick={onUse}
          disabled={busy || isCurrent}
          title={isCurrent ? '已是当前账号' : '切换到此账号'}
        >
          {busy ? (
            <RefreshCw size={14} className="spin" />
          ) : isCurrent ? (
            <Check size={14} />
          ) : (
            <RefreshCw size={14} />
          )}
          {isCurrent ? '当前' : busy ? '切换中…' : '一键切换'}
        </button>
      </div>
    </div>
  );
}
