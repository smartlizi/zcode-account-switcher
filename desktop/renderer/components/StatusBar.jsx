import React from 'react';
import { RefreshCw } from 'lucide-react';
import { useI18n } from '../i18n.js';

function formatNumber(value, locale) {
  if (value == null) return locale === 'zh-CN' ? '未知' : 'Unknown';
  return new Intl.NumberFormat(locale === 'zh-CN' ? 'zh-CN' : 'en', { maximumFractionDigits: 0 }).format(value);
}

export default function StatusBar({ status, loading, quota, quotaLoading, onRefreshQuota, currentQuota }) {
  const { locale, t } = useI18n();
  const cur = status?.current;
  const running = status?.zcodeRunning;

  const curQ = currentQuota?.ok && currentQuota?.data;
  const curItems = curQ?.items || [];

  return (
    <section className="overview-grid" aria-label={t('status.overview')}>
      <div className="overview-card identity-card">
        <div className="identity-head">
          <div className="identity-avatar">
            {cur?.avatar ? <img src={cur.avatar} alt="" /> : <span>{(cur?.email || cur?.label || '?').slice(0, 1).toUpperCase()}</span>}
          </div>
          <div className="identity-copy">
            <span className="eyebrow">{t('status.currentAccount')}</span>
            {loading ? (
              <strong>{t('status.reading')}</strong>
            ) : cur ? (
              <strong>{cur.email || cur.label || cur.name}</strong>
            ) : (
              <strong className="warn-text">{t('status.unrecognized')}</strong>
            )}
          </div>
        </div>
        {cur && !loading && (
          currentQuota?.loading ? (
            <div className="quota-empty">{t('status.quotaLoading')}</div>
          ) : curItems.length > 0 ? (
            <div className="overview-quota-items">
              {curItems.map((item, idx) => {
                const remainingPct = item.percentUsed == null
                  ? 100
                  : Math.max(0, Math.min(100, 100 - item.percentUsed));
                return (
                  <div className="overview-quota-item" key={idx} title={`${item.name}: ${t('account.remaining')} ${formatNumber(item.remaining, locale)} / ${t('account.total')} ${formatNumber(item.total, locale)}`}>
                    <div className="overview-quota-item-head">
                      <span className="overview-quota-item-name">{item.name}</span>
                      <span className="overview-quota-item-pct">{item.percentUsed == null ? '—' : `${t('account.remaining')} ${remainingPct.toFixed(0)}%`}</span>
                    </div>
                    <div
                      className="quota-bar"
                      role="progressbar"
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={Math.round(remainingPct)}
                      aria-label={`${item.name} ${t('account.remaining')} ${remainingPct.toFixed(0)}%`}
                    >
                      <span style={{ width: `${remainingPct}%` }} />
                    </div>
                    <div className="overview-quota-item-stats">
                      <span>{t('account.remaining')} {formatNumber(item.remaining, locale)}</span>
                      <span>{t('account.total')} {formatNumber(item.total, locale)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : currentQuota?.error ? (
            <div className="quota-empty">{t('account.quotaUnavailable')}</div>
          ) : (
            <div className="quota-empty">{t('status.noQuotaData')}</div>
          )
        )}
      </div>

      <div className="overview-card quota-card">
        <div className="quota-head">
          <div>
            <span className="eyebrow">{t('status.totalQuotaOverview')}</span>
            <strong>{quota?.isEmpty ? t('status.noBillingData') : `${quota?.display?.remaining || t('common.unknown')} ${t('status.availableSuffix')}`}</strong>
          </div>
          <button className="btn btn-ghost btn-icon" onClick={onRefreshQuota} disabled={quotaLoading} title={t('status.refreshQuota')} aria-label={t('status.refreshQuota')}>
            <RefreshCw size={15} className={quotaLoading ? 'spin' : ''} />
          </button>
        </div>
        {quota?.isEmpty || !quota?.items?.length ? (
          <div className="quota-empty">{t('status.noBillingData')}</div>
        ) : (
          <div className="overview-quota-items">
            {quota.items.map((item, idx) => {
              const remainingPct = item.percentUsed == null
                ? 100
                : Math.max(0, Math.min(100, 100 - item.percentUsed));
              return (
                <div className="overview-quota-item" key={idx}>
                  <div className="overview-quota-item-head">
                    <span className="overview-quota-item-name">{item.name}</span>
                    <span className="overview-quota-item-pct">{item.percentUsed == null ? '—' : `${t('account.remaining')} ${remainingPct.toFixed(0)}%`}</span>
                  </div>
                  <div
                    className="quota-bar"
                    role="progressbar"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={Math.round(remainingPct)}
                    aria-label={`${item.name} ${t('account.remaining')} ${remainingPct.toFixed(0)}%`}
                  >
                    <span style={{ width: `${remainingPct}%` }} />
                  </div>
                  <div className="overview-quota-item-stats">
                    <span>{t('account.remaining')} {formatNumber(item.remaining, locale)}</span>
                    <span>{t('account.total')} {formatNumber(item.total, locale)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="overview-card runtime-card">
        <span className="eyebrow">{t('status.runningState')}</span>
        <strong>
          <span className={`status-dot ${running ? 'on' : 'off'}`} />
          ZCode {running ? t('status.running') : t('status.notRunning')}
        </strong>
        <div className="runtime-foot">
          <div className="foot-row">
            <span className="foot-label">{t('status.rollbackAvailable')}</span>
            <span>{status?.hasLastBackup ? t('status.yes') : t('status.no')}</span>
          </div>
          <div className="foot-row">
            <span className="foot-label">{t('status.currentAccountLabel')}</span>
            <span className="foot-email" title={status?.current?.email || status?.current?.label}>
              {status?.current ? (status.current.email || status.current.label || '-') : '-'}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
