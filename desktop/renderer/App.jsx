import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Plus,
  RefreshCw,
  Undo2,
  Users,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Info,
  SearchX,
  Upload,
  Download,
  Languages,
} from 'lucide-react';
import AccountCard from './components/AccountCard.jsx';
import StatusBar from './components/StatusBar.jsx';
import Toolbar from './components/Toolbar.jsx';
import CaptureModal from './components/CaptureModal.jsx';
import AddAccountModal from './components/AddAccountModal.jsx';
import ConfirmDialog from './components/ConfirmDialog.jsx';
import { useI18n } from './i18n.js';

export default function App() {
  const { locale, setLocale, t } = useI18n();
  const [status, setStatus] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const accountsRef = useRef(accounts);
  accountsRef.current = accounts;
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [quotaLoading, setQuotaLoading] = useState(false);
  const [accountQuotas, setAccountQuotas] = useState({});
  const accountQuotasRef = useRef(accountQuotas);
  accountQuotasRef.current = accountQuotas;
  const [toast, setToast] = useState(null);
  const [captureOpen, setCaptureOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [confirm, setConfirm] = useState(null);
  const [renamingId, setRenamingId] = useState(null);
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState({ health: 'all', quota: 'all' });
  const [selectedAccountIds, setSelectedAccountIds] = useState({});

  const nextLocale = locale === 'zh-CN' ? 'en' : locale === 'en' ? 'ru' : 'zh-CN';

  useEffect(() => {
    document.documentElement.lang = locale;
    document.title = t('app.title');
  }, [locale, t]);

  const showToast = useCallback((type, msg) => setToast({ type, msg }), []);

  const refreshAccountQuotas = useCallback(async (list) => {
    const ids = (Array.isArray(list) ? list : []).map((x) => x.id).filter(Boolean);
    if (ids.length === 0) {
      setAccountQuotas({});
      return;
    }

    setAccountQuotas((prev) => {
      const next = { ...prev };
      ids.forEach((id) => {
        next[id] = { ...(prev[id] || {}), loading: true, ok: false, error: null };
      });
      return next;
    });

    const r = await window.api.accountQuotas(ids);
    if (!r.ok) {
      setAccountQuotas((prev) => {
        const next = { ...prev };
        ids.forEach((id) => {
          next[id] = { loading: false, ok: false, error: r.error || t('account.quotaUnavailable') };
        });
        return next;
      });
      return;
    }

    setAccountQuotas((prev) => {
      const next = { ...prev };
      for (const id of ids) {
        const item = r.data[id];
        next[id] = item && item.ok
          ? { loading: false, ok: true, data: item.data, error: null }
          : { loading: false, ok: false, error: (item && item.error) || t('account.quotaUnavailable') };
      }
      return next;
    });
  }, [t]);

  const refresh = useCallback(async () => {
    const s = await window.api.status();
    const l = await window.api.list();
    if (s.ok) setStatus(s.data);
    if (l.ok) {
      setAccounts(l.data);
      await refreshAccountQuotas(l.data);
    }
  }, [refreshAccountQuotas]);

  const refreshListOnly = useCallback(async () => {
    const s = await window.api.status();
    const l = await window.api.list();
    if (s.ok) setStatus(s.data);
    if (l.ok) setAccounts(l.data);
  }, []);

  const refreshOneAccountQuota = useCallback(async (id) => {
    if (!id) return;
    setAccountQuotas((prev) => ({
      ...prev,
      [id]: { ...(prev[id] || {}), loading: true, ok: false, error: null },
    }));
    const r = await window.api.accountQuota(id);
    setAccountQuotas((prev) => ({
      ...prev,
        [id]: r && r.ok
          ? { loading: false, ok: true, data: r.data, error: null }
          : { loading: false, ok: false, error: (r && r.error) || t('account.quotaUnavailable') },
    }));
  }, [t]);

  const refreshImportedQuotas = useCallback(async (ids) => {
    const uniqueIds = Array.from(new Set((ids || []).filter(Boolean)));
    for (const id of uniqueIds) await refreshOneAccountQuota(id);
    [8000, 20000, 40000].forEach((delay) => {
      setTimeout(() => {
        const latest = accountsRef.current;
        const existingIds = new Set(latest.map((acc) => acc.id));
        uniqueIds.forEach((id) => {
          if (!existingIds.has(id)) return;
          const q = accountQuotasRef.current[id];
          if (!(q?.ok && q?.data?.items?.length)) refreshOneAccountQuota(id);
        });
      }, delay);
    });
  }, [refreshOneAccountQuota]);

  useEffect(() => {
    const validIds = new Set(accounts.map((acc) => acc.id));
    setSelectedAccountIds((prev) => {
      let changed = false;
      const next = {};
      for (const id of Object.keys(prev)) {
        if (validIds.has(id)) next[id] = true;
        else changed = true;
      }
      return changed ? next : prev;
    });
  }, [accounts]);

  const selectedIds = useMemo(() => Object.keys(selectedAccountIds).filter((id) => selectedAccountIds[id]), [selectedAccountIds]);

  const handleExportAccounts = useCallback(async () => {
    setBusy(true);
    try {
      const ids = selectedIds.length ? selectedIds : undefined;
      const r = await window.api.exportAccounts(ids);
      if (!r.ok) {
        showToast('error', r.error || t('toast.exportFailed'));
        return;
      }
      if (r.data?.canceled) return;
      showToast('success', t('toast.exportSuccess', { count: r.data?.count || 0 }));
      if (selectedIds.length) setSelectedAccountIds({});
    } finally {
      setBusy(false);
    }
  }, [selectedIds, showToast, t]);

  const handleImportAccounts = useCallback(async () => {
    setBusy(true);
    try {
      const r = await window.api.importAccounts();
      if (!r.ok) {
        showToast('error', r.error || t('toast.importFailed'));
        return;
      }
      if (r.data?.canceled) return;

      const imported = r.data?.imported || [];
      const skipped = r.data?.skipped || [];
      const s = await window.api.status();
      const l = await window.api.list();
      if (s.ok) setStatus(s.data);
      if (l.ok) setAccounts(l.data);

      const ids = imported.map((x) => x.id).filter(Boolean);
      const fileErrors = (r.data?.files || []).filter((x) => x.error).length;
      const fileText = r.data?.fileCount > 1
        ? (locale === 'zh-CN' ? `，共 ${r.data.fileCount} 个文件` : locale === 'ru' ? `, ${r.data.fileCount} файлов` : `, ${r.data.fileCount} files`)
        : '';
      const skippedText = skipped.length
        ? (locale === 'zh-CN' ? `，跳过 ${skipped.length} 项` : locale === 'ru' ? `, пропущено ${skipped.length}` : `, skipped ${skipped.length}`)
        : '';
      const errorText = fileErrors
        ? (locale === 'zh-CN' ? `，${fileErrors} 个文件失败` : locale === 'ru' ? `, ${fileErrors} файлов с ошибкой` : `, ${fileErrors} files failed`)
        : '';

      if (ids.length) {
        showToast('success', t('toast.importSuccess', { count: ids.length, fileText, skippedText, errorText }));
        await refreshImportedQuotas(ids);
      } else {
        showToast(skipped.length || fileErrors ? 'info' : 'error', skipped.length || fileErrors ? t('toast.importNoNewAccounts', { fileText, skippedText, errorText }) : t('toast.importNoAvailableAccounts'));
      }
    } finally {
      setBusy(false);
    }
  }, [locale, refreshImportedQuotas, showToast, t]);

  const refreshQuota = useCallback(async () => {
    setQuotaLoading(true);
    await refreshAccountQuotas(accountsRef.current);
    setQuotaLoading(false);
  }, [refreshAccountQuotas]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await refresh();
      setLoading(false);
    })();
  }, [refresh]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(timer);
  }, [toast]);

  const currentAccountId = status?.current?.emailShortId || status?.current?.shortId || null;

  useEffect(() => {
    if (!currentAccountId || loading) return;
    const timer = setInterval(() => {
      refreshOneAccountQuota(currentAccountId);
    }, 60000);
    return () => clearInterval(timer);
  }, [currentAccountId, loading, refreshOneAccountQuota]);

  const aggregateQuota = useMemo(() => {
    const byModel = {};
    let hasAny = false;
    let latestRefresh = 0;
    for (const q of Object.values(accountQuotas)) {
      if (!q?.ok || !q?.data?.items) continue;
      hasAny = true;
      if (q.data.refreshedAt && q.data.refreshedAt > latestRefresh) latestRefresh = q.data.refreshedAt;
      for (const item of q.data.items) {
        const name = item.name || t('common.unknown');
        if (!byModel[name]) byModel[name] = { remaining: 0, total: 0, pctSum: 0, pctCount: 0 };
        const slot = byModel[name];
        if (item.remaining != null) slot.remaining += item.remaining;
        if (item.total != null) slot.total += item.total;
        if (item.percentUsed != null) {
          slot.pctSum += item.percentUsed;
          slot.pctCount++;
        }
      }
    }
    if (!hasAny) return null;
    const items = Object.entries(byModel).map(([name, s]) => {
      const used = s.total != null && s.remaining != null ? Math.max(0, s.total - s.remaining) : null;
      const total = s.total || null;
      const percentUsed = total && used != null ? (used / total) * 100 : null;
      return { name, total, used, remaining: s.remaining || null, percentUsed };
    });
    const totalRemaining = items.reduce((a, b) => a + (b.remaining || 0), 0);
    return {
      isEmpty: items.length === 0,
      items,
      refreshedAt: latestRefresh || null,
      display: {
        remaining: new Intl.NumberFormat(locale === 'zh-CN' ? 'zh-CN' : locale === 'ru' ? 'ru' : 'en', { maximumFractionDigits: 0 }).format(totalRemaining),
      },
    };
  }, [accountQuotas, locale, t]);

  const onFilterChange = useCallback((key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }, []);

  const clearFilters = useCallback(() => {
    setSearch('');
    setFilters({ health: 'all', quota: 'all' });
  }, []);

  const filteredAccounts = accounts.filter((acc) => {
    const q = search.trim().toLowerCase();
    if (q) {
      const hay = [acc.label, acc.email, acc.name, acc.provider].filter(Boolean).join(' ').toLowerCase();
      if (!hay.includes(q)) return false;
    }
    if (filters.health !== 'all') {
      const h = acc.health?.status || 'unknown';
      if (h !== filters.health) return false;
    }
    if (filters.quota !== 'all') {
      const ok = accountQuotas[acc.id]?.ok;
      if (filters.quota === 'available' && !ok) return false;
      if (filters.quota === 'unavailable' && ok) return false;
    }
    return true;
  });

  const visibleIds = filteredAccounts.map((acc) => acc.id);
  const selectedCount = selectedIds.length;
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedAccountIds[id]);

  const toggleAccountSelected = useCallback((id, checked) => {
    setSelectedAccountIds((prev) => {
      const next = { ...prev };
      if (checked) next[id] = true;
      else delete next[id];
      return next;
    });
  }, []);

  const toggleVisibleSelected = useCallback(() => {
    setSelectedAccountIds((prev) => {
      const next = { ...prev };
      if (allVisibleSelected) visibleIds.forEach((id) => delete next[id]);
      else visibleIds.forEach((id) => { next[id] = true; });
      return next;
    });
  }, [allVisibleSelected, visibleIds]);

  const handleCapture = async (label) => {
    setBusy(true);
    const r = await window.api.capture({ label, note: '' });
    setBusy(false);
    if (!r.ok) {
      showToast('error', t('capture.failure', { error: r.error }));
      return;
    }
    if (r.data.created) {
      showToast('success', t('capture.success', { label: r.data.meta.label }));
      setCaptureOpen(false);
      await refresh();
    } else if (r.data.skipped) {
      showToast('info', `${t('capture.alreadyExists', { label: r.data.account?.label || t('common.unknown') })} ${t('capture.alreadyExistsHint')}`);
    }
  };

  const handleUse = async (acc) => {
    setConfirm({
      title: t('confirm.switchAccount'),
      desc: t('confirm.switchAccountDesc', { label: acc.label }),
      wide: true,
      detail: (
        <div>
          <div className="confirm-grid">
            <div className="confirm-card">
              <span className="confirm-label">{t('confirm.currentAccount')}</span>
              <strong className="confirm-email">{status?.current?.email || status?.current?.label || t('common.notChecked')}</strong>
              <small>{status?.current?.provider || t('common.none')} · {status?.current?.shortId || t('common.none')}</small>
            </div>
            <div className="confirm-card target">
              <span className="confirm-label">{t('confirm.targetAccount')}</span>
              <strong className="confirm-email">{acc.email || acc.label}</strong>
              <small>{acc.provider} · {acc.id}</small>
            </div>
          </div>
          <div className="confirm-notes">
            <div>{t('confirm.healthStatus')}: <strong>{acc.health?.summary || t('common.notChecked')}</strong></div>
            <div>{t('confirm.quotaOverview')}: <strong>{accountQuotas[acc.id]?.ok ? `${t('account.remaining')} ${accountQuotas[acc.id].data?.display?.remaining || t('common.unknown')} / ${t('account.total')} ${accountQuotas[acc.id].data?.display?.total || t('common.unknown')}` : (accountQuotas[acc.id]?.error || t('account.quotaUnavailable'))}</strong></div>
            <div>{t('confirm.willExecute')}</div>
          </div>
        </div>
      ),
      confirmText: t('confirm.switchAndRestart'),
      onOk: async () => {
        setConfirm(null);
        setBusy(true);
        showToast('info', t('toast.switching'));
        const r = await window.api.use(acc.id);
        setBusy(false);
        if (r.ok) {
          showToast('success', t('toast.switchedTo', { label: acc.label }));
          setAccountQuotas((prev) => ({
            ...prev,
            [acc.id]: { ...(prev[acc.id] || {}), loading: true, ok: false, error: null },
          }));
          await refreshListOnly();
          await refreshOneAccountQuota(acc.id);
        } else {
          showToast('error', t('toast.switchFailed', { error: r.error }));
        }
      },
    });
  };

  const handleDelete = async (acc) => {
    setConfirm({
      title: t('confirm.deleteSnapshot'),
      desc: t('confirm.deleteSnapshotDesc', { label: acc.label }),
      danger: true,
      confirmText: t('confirm.delete'),
      onOk: async () => {
        setConfirm(null);
        setBusy(true);
        const r = await window.api.remove(acc.id);
        setBusy(false);
        if (r.ok && r.data.removed) {
          showToast('success', t('toast.deleted'));
          await refreshListOnly();
          setAccountQuotas((prev) => {
            if (!prev[acc.id]) return prev;
            const next = { ...prev };
            delete next[acc.id];
            return next;
          });
        } else {
          showToast('error', t('toast.deletedFailed'));
        }
      },
    });
  };

  const handleDeleteSelected = async () => {
    const selectedAccounts = accounts.filter((acc) => selectedAccountIds[acc.id]);
    if (!selectedAccounts.length) return;
    setConfirm({
      title: t('confirm.bulkDeleteSnapshot'),
      desc: t('confirm.bulkDeleteSnapshotDesc', { count: selectedAccounts.length }),
      danger: true,
      confirmText: t('confirm.deleteSelectedCount', { count: selectedAccounts.length }),
      detail: (
        <div className="confirm-notes">
          {selectedAccounts.slice(0, 8).map((acc) => (
            <div key={acc.id}>{t('confirm.willDelete', { label: acc.email || acc.label || acc.id })}</div>
          ))}
          {selectedAccounts.length > 8 && (
            <div>
              {locale === 'zh-CN'
                ? `另外还有 ${selectedAccounts.length - 8} 个账号…`
                : locale === 'ru'
                  ? `Ещё ${selectedAccounts.length - 8} аккаунтов…`
                  : `${selectedAccounts.length - 8} more accounts…`}
            </div>
          )}
        </div>
      ),
      onOk: async () => {
        setConfirm(null);
        setBusy(true);
        let removed = 0;
        let failed = 0;
        for (const acc of selectedAccounts) {
          const r = await window.api.remove(acc.id);
          if (r.ok && r.data.removed) removed++;
          else failed++;
        }
        setBusy(false);
        setSelectedAccountIds({});
        await refreshListOnly();
        setAccountQuotas((prev) => {
          const next = { ...prev };
          selectedAccounts.forEach((acc) => delete next[acc.id]);
          return next;
        });
        showToast(failed ? 'info' : 'success', failed ? t('toast.deletedSelectedPartial', { removed, failed }) : t('toast.deletedSelectedSuccess', { count: removed }));
      },
    });
  };

  const handleRename = async (acc, newLabel) => {
    setRenamingId(null);
    if (!newLabel || newLabel === acc.label) return;
    setBusy(true);
    const r = await window.api.rename(acc.id, newLabel);
    setBusy(false);
    if (r.ok) {
      showToast('success', t('toast.renamed'));
      await refresh();
    } else {
      showToast('error', t('toast.renameFailed', { error: r.error }));
    }
  };

  const handleRollback = async () => {
    setConfirm({
      title: t('confirm.rollbackToLastSwitch'),
      desc: t('confirm.rollbackToLastSwitchDesc'),
      onOk: async () => {
        setConfirm(null);
        setBusy(true);
        showToast('info', t('toast.rollbacking'));
        const r = await window.api.rollback();
        setBusy(false);
        if (r.ok) {
          showToast('success', t('toast.rolledBack'));
          await refresh();
        } else {
          showToast('error', t('toast.rollbackFailed', { error: r.error }));
        }
      },
    });
  };

  const currentQuota = currentAccountId ? accountQuotas[currentAccountId] : null;

  return (
    <div className="app">
      <header className="topbar">
        <h1>
          <span className="logo-dot" />
          {t('app.title')}
        </h1>
        <div className="topbar-actions">
          <button
            className="btn btn-ghost btn-icon"
            title={nextLocale === 'en' ? 'Switch to English' : nextLocale === 'ru' ? 'Переключить на русский' : '切换到中文'}
            aria-label={nextLocale === 'en' ? 'Switch to English' : nextLocale === 'ru' ? 'Переключить на русский' : '切换到中文'}
            onClick={() => setLocale(nextLocale)}
            disabled={busy}
          >
            <Languages size={16} />
          </button>
          <button
            className="btn btn-ghost btn-icon"
            title={t('topbar.refreshAccounts')}
            aria-label={t('topbar.refreshAccounts')}
            onClick={async () => {
              await refresh();
              await refreshQuota();
            }}
            disabled={busy}
          >
            <RefreshCw size={16} className={loading ? 'spin' : ''} />
          </button>
          <button className="btn" onClick={handleImportAccounts} disabled={busy} title={t('topbar.importAccounts')}>
            <Upload size={16} />
            {t('topbar.importAccounts')}
          </button>
          <button
            className="btn"
            onClick={handleExportAccounts}
            disabled={busy || accounts.length === 0}
            title={selectedCount ? t('toolbarState.selectedForExport', { count: selectedCount }) : t('toolbarState.exportSelectedOnly')}
          >
            <Download size={16} />
            {t('topbar.exportAccounts')}
          </button>
          <button className="btn" onClick={() => setCaptureOpen(true)} disabled={busy}>
            {t('topbar.captureCurrent')}
          </button>
          <button className="btn btn-primary" onClick={() => setAddOpen(true)} disabled={busy}>
            <Plus size={16} />
            {t('topbar.addAccount')}
          </button>
        </div>
      </header>

      <StatusBar status={status} loading={loading} quota={aggregateQuota} quotaLoading={quotaLoading} onRefreshQuota={refreshQuota} currentQuota={currentQuota} />

      {!loading && accounts.length > 0 && (
        <Toolbar
          search={search}
          onSearch={setSearch}
          filters={filters}
          onFilter={onFilterChange}
          total={accounts.length}
          shown={filteredAccounts.length}
          onClearFilters={clearFilters}
        />
      )}

      {!loading && accounts.length > 0 && (
        <div className="export-select-bar">
          <span>{selectedCount ? t('toolbarState.selectedForExport', { count: selectedCount }) : t('toolbarState.exportSelectedOnly')}</span>
          <div className="export-select-actions">
            <button className="btn btn-ghost btn-sm" onClick={toggleVisibleSelected} disabled={busy || visibleIds.length === 0}>
              {allVisibleSelected ? t('toolbarState.unselectVisible') : t('toolbarState.selectVisible')}
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => setSelectedAccountIds({})} disabled={busy || selectedCount === 0}>
              {t('toolbarState.clearSelection')}
            </button>
            <button className="btn btn-danger btn-sm" onClick={handleDeleteSelected} disabled={busy || selectedCount === 0}>
              {t('toolbarState.deleteSelected')}
            </button>
          </div>
        </div>
      )}

      <main className="account-list">
        {loading ? (
          <div className="empty">
            <RefreshCw size={40} className="empty-icon spin" />
            <p>{t('common.loading')}</p>
          </div>
        ) : accounts.length === 0 ? (
          <div className="empty">
            <Users size={56} className="empty-icon" />
            <strong className="empty-title">{t('empty.noAccounts')}</strong>
            <p>{t('empty.noAccountsHint')}</p>
            <div className="empty-actions">
              <button className="btn btn-primary empty-action" onClick={() => setAddOpen(true)} disabled={busy}>
                <Plus size={16} />
                {t('empty.addAccount')}
              </button>
              <button className="btn empty-action" onClick={handleImportAccounts} disabled={busy}>
                <Upload size={16} />
                {t('empty.importAccounts')}
              </button>
              <button className="btn empty-action" onClick={() => setCaptureOpen(true)} disabled={busy}>
                {t('empty.captureCurrent')}
              </button>
            </div>
          </div>
        ) : filteredAccounts.length === 0 ? (
          <div className="empty">
            <SearchX size={56} className="empty-icon" />
            <strong className="empty-title">{t('empty.noMatches')}</strong>
            <p>{t('empty.noMatchesHint')}</p>
            <button className="btn btn-primary btn-sm empty-action" onClick={clearFilters}>
              {t('empty.clearFilters')}
            </button>
          </div>
        ) : (
          filteredAccounts.map((acc) => (
            <AccountCard
              key={acc.id}
              account={acc}
              quota={accountQuotas[acc.id]}
              isCurrent={acc.id === currentAccountId}
              busy={busy}
              renaming={renamingId === acc.id}
              selected={!!selectedAccountIds[acc.id]}
              onSelectedChange={(checked) => toggleAccountSelected(acc.id, checked)}
              onUse={() => handleUse(acc)}
              onDelete={() => handleDelete(acc)}
              onRenameStart={() => setRenamingId(acc.id)}
              onRenameCommit={(label) => handleRename(acc, label)}
              onRefreshQuota={refreshOneAccountQuota}
            />
          ))
        )}
      </main>

      <footer className="footer">
        <button
          className="btn btn-ghost btn-sm"
          onClick={handleRollback}
          disabled={busy || !status?.hasLastBackup}
          aria-label={t('footer.rollbackLastSwitch')}
          title={status?.hasLastBackup ? t('footer.rollbackLastSwitch') : t('footer.noRollbackBackup')}
        >
          <Undo2 size={14} />
          {t('footer.rollbackLastSwitch')}
        </button>
        <span className="footer-tip">
          <Info size={13} />
          {t('footer.switchWillRestart')}
        </span>
      </footer>

      {captureOpen && (
        <CaptureModal
          onClose={() => setCaptureOpen(false)}
          onConfirm={handleCapture}
          busy={busy}
          defaultName={status?.current ? t('capture.defaultName', { shortId: status.current.shortId }) : ''}
        />
      )}

      {addOpen && (
        <AddAccountModal
          onClose={() => setAddOpen(false)}
          onDone={async (newAccountId) => {
            setAddOpen(false);
            const s = await window.api.status();
            const l = await window.api.list();
            if (s.ok) setStatus(s.data);
            if (l.ok) setAccounts(l.data);

            const accountsAfterAdd = l.ok && Array.isArray(l.data) ? l.data : [];
            const exists = accountsAfterAdd.some((acc) => acc.id === newAccountId);
            const latest = accountsAfterAdd[accountsAfterAdd.length - 1];
            const targetId = exists ? newAccountId : latest?.id;

            if (targetId) {
              setAccountQuotas((prev) => ({
                ...prev,
                [targetId]: { loading: true, ok: false, error: null },
              }));
              await refreshOneAccountQuota(targetId);
              [8000, 20000, 40000].forEach((delay) => {
                setTimeout(() => {
                  setAccountQuotas((prev) => {
                    if (prev[targetId]?.ok && prev[targetId]?.data?.items?.length) return prev;
                    refreshOneAccountQuota(targetId);
                    return prev;
                  });
                }, delay);
              });
            }
          }}
          showToast={showToast}
        />
      )}

      {confirm && (
        <ConfirmDialog
          title={confirm.title}
          desc={confirm.desc}
          detail={confirm.detail}
          danger={confirm.danger}
          confirmText={confirm.confirmText}
          wide={confirm.wide}
          onCancel={() => setConfirm(null)}
          onOk={confirm.onOk}
        />
      )}

      {toast && (
        <div className={`toast ${toast.type}`}>
          {toast.type === 'success' && <CheckCircle2 size={16} color="#22c55e" />}
          {toast.type === 'error' && <XCircle size={16} color="#ef4444" />}
          {toast.type === 'info' && <AlertTriangle size={16} color="#f59e0b" />}
          {toast.msg}
        </div>
      )}
    </div>
  );
}
