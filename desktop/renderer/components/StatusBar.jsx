import React from 'react';
import { RefreshCw } from 'lucide-react';
import { useLanguage } from '../LanguageContext.jsx';

function formatNumber(value, locale = 'zh-CN') {
  if (value == null) return '—';
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(value);
}

export default function StatusBar({ status, loading, quota, quotaLoading, onRefreshQuota, currentQuota }) {
  const { t, lang } = useLanguage();
  const locale = lang === 'zh' ? 'zh-CN' : 'en-US';

  const cur = status?.current;
  const running = status?.zcodeRunning;

  const curQ = currentQuota?.ok && currentQuota?.data;
  const curItems = curQ?.items || [];
  const curSumRemaining = curItems.reduce((a, b) => a + (b.remaining || 0), 0);
  const curSumTotal = curItems.reduce((a, b) => a + (b.total || 0), 0);
  const curSumUsed = curItems.reduce((a, b) => a + (b.used || 0), 0);
  const curRemainingPct = curSumTotal > 0 ? Math.max(0, Math.min(100, (1 - curSumUsed / curSumTotal) * 100)) : null;

  return (
    <section className="overview-grid" aria-label="Status overview">
      <div className="overview-card identity-card">
        <div className="identity-head">
          <div className="identity-avatar">
            {cur?.avatar ? <img src={cur.avatar} alt="" /> : <span>{(cur?.email || cur?.label || '?').slice(0, 1).toUpperCase()}</span>}
          </div>
          <div className="identity-copy">
            <span className="eyebrow">{t('status.current')}</span>
            {loading ? (
              <strong>{t('status.loading')}</strong>
            ) : cur ? (
              <strong>{cur.email || cur.label || cur.name}</strong>
            ) : (
              <strong className="warn-text">{t('status.notRecognized')}</strong>
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
                  <div className="overview-quota-item" key={idx} title={`${item.name}: ${formatNumber(item.remaining, locale)} / ${formatNumber(item.total, locale)}`}>
                    <div className="overview-quota-item-head">
                      <span className="overview-quota-item-name">{item.name}</span>
                      <span className="overview-quota-item-pct">{item.percentUsed == null ? '—' : `${remainingPct.toFixed(0)}%`}</span>
                    </div>
                    <div
                      className="quota-bar"
                      role="progressbar"
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={Math.round(remainingPct)}
                      aria-label={`${item.name} ${remainingPct.toFixed(0)}%`}
                    >
                      <span style={{ width: `${remainingPct}%` }} />
                    </div>
                    <div className="overview-quota-item-stats">
                      <span>{t('status.remaining')} {formatNumber(item.remaining, locale)}</span>
                      <span>{t('status.total')} {formatNumber(item.total, locale)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : currentQuota?.error ? (
            <div className="quota-empty">{t('status.quotaUnavailable')}</div>
          ) : (
            <div className="quota-empty">{t('status.noQuotaData')}</div>
          )
        )}
      </div>

      <div className="overview-card quota-card">
        <div className="quota-head">
          <div>
            <span className="eyebrow">{t('status.totalQuota')}</span>
            <strong>{quota?.isEmpty ? t('status.noBilling') : (quota?.display?.remaining || '—') + ' ' + t('status.available')}</strong>
          </div>
          <button className="btn btn-ghost btn-icon" onClick={onRefreshQuota} disabled={quotaLoading} title={t('status.refreshQuota')} aria-label={t('status.refreshQuota')}>
            <RefreshCw size={15} className={quotaLoading ? 'spin' : ''} />
          </button>
        </div>
        {quota?.isEmpty || !quota?.items?.length ? (
          <div className="quota-empty">{t('status.noBilling')}</div>
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
                    <span className="overview-quota-item-pct">{item.percentUsed == null ? '—' : `${remainingPct.toFixed(0)}%`}</span>
                  </div>
                  <div
                    className="quota-bar"
                    role="progressbar"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={Math.round(remainingPct)}
                    aria-label={`${item.name} ${remainingPct.toFixed(0)}%`}
                  >
                    <span style={{ width: `${remainingPct}%` }} />
                  </div>
                  <div className="overview-quota-item-stats">
                    <span>{t('status.remaining')} {formatNumber(item.remaining, locale)}</span>
                    <span>{t('status.total')} {formatNumber(item.total, locale)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="overview-card runtime-card">
        <span className="eyebrow">{t('status.runtime')}</span>
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
            <span className="foot-label">{t('status.current')}</span>
            <span className="foot-email" title={status?.current?.email || status?.current?.label}>
              {status?.current ? (status.current.email || status.current.label || '-') : '-'}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
