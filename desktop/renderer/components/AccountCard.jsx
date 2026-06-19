import React, { useState, useEffect, useRef } from 'react';
import { RefreshCw, Trash2, Pencil, Check } from 'lucide-react';
import { useI18n } from '../i18n.js';

function fmtDate(ts, locale) {
  if (!ts) return '-';
  const d = new Date(ts);
  const p = (n) => String(n).padStart(2, '0');
  if (locale === 'zh-CN') {
    return `${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
  }
  return `${d.getMonth() + 1}/${d.getDate()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

function fmtNumber(value, locale) {
  if (value == null) return locale === 'zh-CN' ? '未知' : 'Unknown';
  return new Intl.NumberFormat(locale === 'zh-CN' ? 'zh-CN' : 'en', { maximumFractionDigits: 0 }).format(value);
}

function healthText(health, t) {
  if (!health) return t('account.healthUnknown');
  if (health.status === 'healthy') return t('account.healthHealthy');
  if (health.status === 'warning') return t('account.healthWarning');
  return t('account.healthError');
}

function humanizeSummary(summary) {
  if (!summary) return '';
  return String(summary);
}

function planBadge(provider, t) {
  const raw = String(provider || '').toLowerCase().replace(/^builtin:/, '');
  if (raw.includes('max')) return { label: t('account.plan.max'), tier: 'max' };
  if (raw.includes('pro')) return { label: t('account.plan.pro'), tier: 'pro' };
  if (raw.includes('lite')) return { label: t('account.plan.lite'), tier: 'lite' };
  if (raw.includes('start-plan') || raw.includes('start')) return { label: t('account.plan.start'), tier: 'start' };
  if (raw.includes('zai')) return { label: t('account.plan.zai'), tier: 'zai' };
  return { label: t('account.plan.std'), tier: 'std' };
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
  const { locale, t } = useI18n();
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
      <label className="account-export-check" title={t('account.selectedForExport')}>
        <input
          type="checkbox"
          checked={!!selected}
          onChange={(e) => onSelectedChange?.(e.target.checked)}
          disabled={busy}
          aria-label={t('account.selectExport', { label: account.label })}
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
              {t('account.current')}
            </span>
          )}
          <span className={`health-badge ${account.health?.status || 'unknown'}`} title={account.health?.summary || t('account.healthUnknown')}>
            {healthText(account.health, t)}
          </span>
          {(() => {
            const badge = quota?.ok && quota.data ? quota.data.planTier : null;
            const fallback = badge ? null : planBadge(account.provider, t);
            const final = badge || fallback;
            if (!final) return null;
            return (
              <span className={`plan-badge plan-${final.tier}`} title={account.provider}>{final.label}</span>
            );
          })()}
        </div>
        <div className="account-meta">
          <span>{t('account.capturedAt', { date: fmtDate(account.capturedAt, locale) })}</span>
          {account.sizeKb ? <span>{account.sizeKb} KB</span> : null}
        </div>
        {account.health?.status && account.health.status !== 'healthy' && (
          <div className="account-summary">{humanizeSummary(account.health.summary)}</div>
        )}
      </div>

      <div className="account-quota-block" title={quota?.ok && quota.data && !quota.data.isEmpty ? t('account.quotaRefreshedAt', { date: fmtDate(quota.data.refreshedAt, locale) }) : t('account.quota')}>
        <span className="account-quota-title">{t('account.quota')}</span>
        {onRefreshQuota && (
          <button
            className="btn btn-ghost btn-icon account-quota-refresh"
            title={t('account.refreshQuota')}
            aria-label={t('account.refreshQuotaLabel', { label: account.label })}
            onClick={() => onRefreshQuota(account.id)}
            disabled={busy || quota?.loading}
          >
            <RefreshCw size={13} className={quota?.loading ? 'spin' : ''} />
          </button>
        )}
        {quota?.loading ? (
          <span className="account-quota-state">{t('account.refreshing')}</span>
        ) : quota?.ok && quota.data ? (
          quota.data.isEmpty || !quota.data.items || quota.data.items.length === 0 ? (
            <span className="account-quota-state hint">{t('account.noQuotaHint')}</span>
          ) : (
            <div className="quota-items">
              {quota.data.items.map((item, idx) => {
                const remainingPct = item.percentUsed == null ? null : Math.max(0, Math.min(100, 100 - item.percentUsed));
                const tense = remainingPct != null && remainingPct < 20 ? 'tense' : '';
                return (
                  <div className={`quota-item ${tense}`} key={idx} title={`${item.name}: ${t('account.remaining')} ${fmtNumber(item.remaining, locale)} / ${t('account.total')} ${fmtNumber(item.total, locale)}`}>
                    <span className="quota-item-name" title={item.name}>{item.name}</span>
                    <div
                      className="account-quota-bar remaining"
                      role="progressbar"
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={remainingPct == null ? undefined : Math.round(remainingPct)}
                      aria-label={`${item.name} ${t('account.remaining')} ${remainingPct == null ? t('common.unknown') : `${remainingPct.toFixed(0)}%`}`}
                    >
                      <span style={{ width: `${remainingPct == null ? 0 : remainingPct}%` }} />
                    </div>
                    <span className="quota-item-stats-inline" title={`${t('account.remaining')} ${fmtNumber(item.remaining, locale)} / ${t('account.total')} ${fmtNumber(item.total, locale)}`}>
                      <span className="qi-remain">{fmtNumber(item.remaining, locale)}</span>
                    </span>
                  </div>
                );
              })}
            </div>
          )
        ) : quota && quota.ok === false ? (
          <span className="account-quota-state hint" title={quota.error || t('account.quotaUnavailable')}>{quota.error || t('account.quotaUnavailable')}</span>
        ) : (
          <span className="account-quota-state hint">{t('account.clickToRefresh')}</span>
        )}
      </div>

      <div className="account-actions">
        <button
          className="btn btn-ghost btn-icon"
          title={t('account.rename')}
          aria-label={`${t('account.rename')} ${account.label}`}
          onClick={onRenameStart}
          disabled={busy || renaming}
        >
          <Pencil size={15} />
        </button>
        <button
          className="btn btn-ghost btn-icon"
          title={t('account.delete')}
          aria-label={`${t('account.delete')} ${account.label}`}
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
          title={isCurrent ? t('account.switchToCurrent') : t('account.switchToThis')}
        >
          {busy ? (
            <RefreshCw size={14} className="spin" />
          ) : isCurrent ? (
            <Check size={14} />
          ) : (
            <RefreshCw size={14} />
          )}
          {isCurrent ? t('account.current') : busy ? t('account.switching') : t('account.oneClickSwitch')}
        </button>
      </div>
    </div>
  );
}
