import React, { useState, useEffect, useRef } from 'react';
import { RefreshCw, Trash2, Pencil, Check } from 'lucide-react';
import { useLanguage } from '../LanguageContext.jsx';

function fmtDate(ts) {
  if (!ts) return '-';
  const d = new Date(ts);
  const p = (n) => String(n).padStart(2, '0');
  return `${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

function fmtNumber(value, locale = 'zh-CN') {
  if (value == null) return '—';
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(value);
}

function healthText(health, t) {
  if (!health) return t('card.notChecked');
  if (health.status === 'healthy') return t('card.healthy');
  if (health.status === 'warning') return t('card.warning');
  return t('card.error');
}

function humanizeSummary(summary, t) {
  if (!summary) return '';
  const s = String(summary);
  if (s.includes('无法在当前机器环境解密') || s.includes('user_info 无法')) {
    return t('card.healthHint.userInfoDecrypt');
  }
  if (s.includes('user_info 存在，但解密后不是有效 JSON')) {
    return t('card.healthHint.userInfoInvalid');
  }
  if (s.includes('未找到 user_info')) {
    return t('card.healthHint.userInfoMissing');
  }
  if (s.includes('credentials 结构异常')) {
    return t('card.healthHint.credentialsCorrupt');
  }
  return s;
}

function planBadge(provider) {
  const raw = String(provider || '').toLowerCase().replace(/^builtin:/, '');
  if (raw.includes('max')) return { label: 'Max', tier: 'max' };
  if (raw.includes('pro')) return { label: 'Pro', tier: 'pro' };
  if (raw.includes('lite')) return { label: 'Lite', tier: 'lite' };
  if (raw.includes('start-plan') || raw.includes('start')) return { label: 'Start Plan', tier: 'start' };
  return null;
}

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
  const { t, lang } = useLanguage();
  const locale = lang === 'zh' ? 'zh-CN' : 'en-US';
  const [editName, setEditName] = useState(account.label);
  const inputRef = useRef(null);

  useEffect(() => {
    if (renaming) {
      setEditName(account.label);
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 0);
    }
  }, [renaming, account.label]);

  const handleKey = (e) => {
    if (e.key === 'Enter') onRenameCommit(editName.trim());
    if (e.key === 'Escape') onRenameCommit(account.label);
  };

  return (
    <div className={`account-card ${isCurrent ? 'current' : ''} ${selected ? 'export-selected' : ''}`}>
      <label className="account-export-check" title={t('card.exportCheck')}>
        <input
          type="checkbox"
          checked={!!selected}
          onChange={(e) => onSelectedChange?.(e.target.checked)}
          disabled={busy}
          aria-label={`${t('card.exportCheck')} - ${account.label}`}
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
              {t('card.current')}
            </span>
          )}
          <span className={`health-badge ${account.health?.status || 'unknown'}`} title={account.health?.summary || t('card.notChecked')}>
            {healthText(account.health, t)}
          </span>
          {(() => {
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
          <span>{t('card.capturedAt')} {fmtDate(account.capturedAt)}</span>
          {account.sizeKb ? <span>{account.sizeKb} KB</span> : null}
        </div>
        {account.health?.status && account.health.status !== 'healthy' && (
          <div className="account-summary">{humanizeSummary(account.health.summary, t)}</div>
        )}
      </div>

      <div className="account-quota-block" title={quota?.ok && quota.data && !quota.data.isEmpty ? `Quota refreshed at ${fmtDate(quota.data.refreshedAt)}` : t('card.quota')}>
        <span className="account-quota-title">{t('card.quota')}</span>
        {onRefreshQuota && (
          <button
            className="btn btn-ghost btn-icon account-quota-refresh"
            title={t('card.refreshQuota')}
            aria-label={`${t('card.refreshQuota')} - ${account.label}`}
            onClick={() => onRefreshQuota(account.id)}
            disabled={busy || quota?.loading}
          >
            <RefreshCw size={13} className={quota?.loading ? 'spin' : ''} />
          </button>
        )}
        {quota?.loading ? (
          <span className="account-quota-state">{t('card.refreshing')}</span>
        ) : quota?.ok && quota.data ? (
          quota.data.isEmpty || !quota.data.items || quota.data.items.length === 0 ? (
            <span className="account-quota-state hint">{t('card.noQuotaData')}</span>
          ) : (
            <div className="quota-items">
              {quota.data.items.map((item, idx) => {
                const remainingPct = item.percentUsed == null ? null : Math.max(0, Math.min(100, 100 - item.percentUsed));
                const tense = remainingPct != null && remainingPct < 20 ? 'tense' : '';
                return (
                  <div className={`quota-item ${tense}`} key={idx} title={`${item.name}: ${fmtNumber(item.remaining, locale)} / ${fmtNumber(item.total, locale)}`}>
                    <span className="quota-item-name" title={item.name}>{item.name}</span>
                    <div
                      className="account-quota-bar remaining"
                      role="progressbar"
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={remainingPct == null ? undefined : Math.round(remainingPct)}
                      aria-label={`${item.name} ${t('card.quota')} ${remainingPct == null ? 'N/A' : remainingPct.toFixed(0) + '%'}`}
                    >
                      <span style={{ width: `${remainingPct == null ? 0 : remainingPct}%` }} />
                    </div>
                    <span className="quota-item-stats-inline" title={`${fmtNumber(item.remaining, locale)} / ${fmtNumber(item.total, locale)}`}>
                      <span className="qi-remain">{fmtNumber(item.remaining, locale)}</span>
                    </span>
                  </div>
                );
              })}
            </div>
          )
        ) : quota && quota.ok === false ? (
          <span className="account-quota-state hint" title={quota.error || 'Quota unavailable'}>{quota.error || 'Quota unavailable'}</span>
        ) : (
          <span className="account-quota-state hint">{t('card.clickToRefresh')}</span>
        )}
      </div>

      <div className="account-actions">
        <button
          className="btn btn-ghost btn-icon"
          title={t('card.rename')}
          aria-label={`${t('card.rename')} - ${account.label}`}
          onClick={onRenameStart}
          disabled={busy || renaming}
        >
          <Pencil size={15} />
        </button>
        <button
          className="btn btn-ghost btn-icon"
          title={t('card.delete')}
          aria-label={`${t('card.delete')} - ${account.label}`}
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
          title={isCurrent ? t('card.alreadyCurrent') : t('card.switchTo')}
        >
          {busy ? (
            <RefreshCw size={14} className="spin" />
          ) : isCurrent ? (
            <Check size={14} />
          ) : (
            <RefreshCw size={14} />
          )}
          {isCurrent ? t('card.current') : busy ? t('card.switching') : t('card.switch')}
        </button>
      </div>
    </div>
  );
}
