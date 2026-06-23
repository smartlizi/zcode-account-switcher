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
import { useLanguage } from './LanguageContext.jsx';

export default function App() {
  const { t, lang, switchLanguage } = useLanguage();
  const [status, setStatus] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const accountsRef = useRef(accounts);
  accountsRef.current = accounts;
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [quota, setQuota] = useState(null);
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
          next[id] = { loading: false, ok: false, error: r.error || 'Quota query failed' };
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
          : { loading: false, ok: false, error: (item && item.error) || 'Quota unavailable' };
      }
      return next;
    });
  }, []);

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
      [id]:
        r && r.ok
          ? { loading: false, ok: true, data: r.data, error: null }
          : { loading: false, ok: false, error: (r && r.error) || 'Quota unavailable' },
    }));
  }, []);

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
      if (!r.ok) { showToast('error', r.error || 'Export failed'); return; }
      if (r.data?.canceled) return;
      showToast('success', t('toast.exported', { count: r.data?.count || 0 }));
      if (selectedIds.length) setSelectedAccountIds({});
    } finally {
      setBusy(false);
    }
  }, [selectedIds, showToast, t]);

  const handleImportAccounts = useCallback(async () => {
    setBusy(true);
    try {
      const r = await window.api.importAccounts();
      if (!r.ok) { showToast('error', r.error || 'Import failed'); return; }
      if (r.data?.canceled) return;

      const imported = r.data?.imported || [];
      const skipped = r.data?.skipped || [];
      const s = await window.api.status();
      const l = await window.api.list();
      if (s.ok) setStatus(s.data);
      if (l.ok) setAccounts(l.data);

      const ids = imported.map((x) => x.id).filter(Boolean);
      const fileErrors = (r.data?.files || []).filter((x) => x.error).length;
      const fileText = r.data?.fileCount > 1 ? (lang === 'zh' ? `（${r.data.fileCount} 个文件）` : ` (${r.data.fileCount} files)`) : '';
      const skippedText = skipped.length ? (lang === 'zh' ? `，跳过 ${skipped.length} 项` : `, ${skipped.length} skipped`) : '';
      const errorText = fileErrors ? (lang === 'zh' ? `，${fileErrors} 个文件失败` : `, ${fileErrors} files failed`) : '';
      if (ids.length) {
        showToast('success', t('toast.imported', { count: ids.length, fileText, skippedText, errorText }));
        await refreshImportedQuotas(ids);
      } else {
        showToast(skipped.length || fileErrors ? 'info' : 'error',
          skipped.length || fileErrors
            ? t('toast.imported.none', { fileText, skippedText, errorText })
            : t('toast.imported.noData'));
      }
    } finally {
      setBusy(false);
    }
  }, [refreshImportedQuotas, showToast, t, lang]);

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
    const tId = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(tId);
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
        const name = item.name || 'Unknown';
        if (!byModel[name]) byModel[name] = { remaining: 0, total: 0, pctSum: 0, pctCount: 0 };
        const slot = byModel[name];
        if (item.remaining != null) slot.remaining += item.remaining;
        if (item.total != null) slot.total += item.total;
        if (item.percentUsed != null) { slot.pctSum += item.percentUsed; slot.pctCount++; }
      }
    }
    if (!hasAny) return null;
    const items = Object.entries(byModel).map(([name, s]) => {
      const used = (s.total != null && s.remaining != null) ? Math.max(0, s.total - s.remaining) : null;
      const total = s.total || null;
      const percentUsed = (total && used != null) ? (used / total) * 100 : null;
      return { name, total, used, remaining: s.remaining || null, percentUsed };
    });
    const totalRemaining = items.reduce((a, b) => a + (b.remaining || 0), 0);
    return {
      isEmpty: items.length === 0,
      items,
      refreshedAt: latestRefresh || null,
      display: {
        remaining: new Intl.NumberFormat(lang === 'zh' ? 'zh-CN' : 'en-US', { maximumFractionDigits: 0 }).format(totalRemaining),
      },
    };
  }, [accountQuotas, lang]);

  const onFilterChange = useCallback((key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }, []);
  const clearFilters = useCallback(() => {
    setSearch('');
    setFilters({ health: 'all', quota: 'all' });
  }, []);

  const filteredAccounts = (() => {
    const q = search.trim().toLowerCase();
    return accounts.filter((acc) => {
      if (q) {
        const hay = [acc.label, acc.email, acc.name, acc.provider]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
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
  })();

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
      showToast('error', 'Capture failed: ' + r.error);
      return;
    }
    if (r.data.created) {
      showToast('success', t('toast.captured', { label: r.data.meta.label }));
      setCaptureOpen(false);
      await refresh();
    } else if (r.data.skipped) {
      showToast('info', r.data.message + ' (use overwrite or delete first)');
    }
  };

  const handleUse = async (acc) => {
    setConfirm({
      title: t('switch.title'),
      desc: t('switch.desc', { label: acc.label }),
      wide: true,
      detail: (
        <div>
          <div className="confirm-grid">
            <div className="confirm-card">
              <span className="confirm-label">{t('switch.current')}</span>
              <strong className="confirm-email">{status?.current?.email || status?.current?.label || '-'}</strong>
              <small>{status?.current?.provider || '-'} · {status?.current?.shortId || '-'}</small>
            </div>
            <div className="confirm-card target">
              <span className="confirm-label">{t('switch.target')}</span>
              <strong className="confirm-email">{acc.email || acc.label}</strong>
              <small>{acc.provider} · {acc.id}</small>
            </div>
          </div>
          <div className="confirm-notes">
            <div>{t('switch.snapshotStatus')}<strong>{acc.health?.summary || t('card.notChecked')}</strong></div>
            <div>{t('switch.quotaOverview')}<strong>{accountQuotas[acc.id]?.ok ? `Remaining ${accountQuotas[acc.id].data?.display?.remaining || 'Unknown'} / Total ${accountQuotas[acc.id].data?.display?.total || 'Unknown'}` : (accountQuotas[acc.id]?.error || 'N/A')}</strong></div>
            <div>{t('switch.process')}</div>
          </div>
        </div>
      ),
      confirmText: t('switch.confirm'),
      onOk: async () => {
        setConfirm(null);
        setBusy(true);
        showToast('info', t('toast.switching'));
        const r = await window.api.use(acc.id);
        setBusy(false);
        if (r.ok) {
          showToast('success', t('toast.switched', { label: acc.label }));
          setAccountQuotas((prev) => ({
            ...prev,
            [acc.id]: { ...(prev[acc.id] || {}), loading: true, ok: false, error: null },
          }));
          await refreshListOnly();
          await refreshOneAccountQuota(acc.id);
        } else {
          showToast('error', 'Switch failed: ' + r.error);
        }
      },
    });
  };

  const handleDelete = async (acc) => {
    setConfirm({
      title: t('delete.title'),
      desc: t('delete.desc', { label: acc.label }),
      danger: true,
      confirmText: t('delete.confirm'),
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
          showToast('error', 'Delete failed');
        }
      },
    });
  };

  const handleDeleteSelected = async () => {
    const selectedAccounts = accounts.filter((acc) => selectedAccountIds[acc.id]);
    if (!selectedAccounts.length) return;
    setConfirm({
      title: t('delete.batch.title'),
      desc: t('delete.batch.desc', { count: selectedAccounts.length }),
      danger: true,
      confirmText: t('delete.batch.confirm', { count: selectedAccounts.length }),
      detail: (
        <div className="confirm-notes">
          {selectedAccounts.slice(0, 8).map((acc) => (
            <div key={acc.id}>Delete: <strong>{acc.email || acc.label || acc.id}</strong></div>
          ))}
          {selectedAccounts.length > 8 && <div>And {selectedAccounts.length - 8} more…</div>}
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
        showToast(failed ? 'info' : 'success',
          failed
            ? t('toast.batchDeleted.partial', { n: removed, failed })
            : t('toast.batchDeleted', { n: removed }));
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
      showToast('error', 'Rename failed: ' + r.error);
    }
  };

  const handleRollback = async () => {
    setConfirm({
      title: t('rollback.title'),
      desc: t('rollback.desc'),
      onOk: async () => {
        setConfirm(null);
        setBusy(true);
        showToast('info', t('toast.rollingBack'));
        const r = await window.api.rollback();
        setBusy(false);
        if (r.ok) {
          showToast('success', t('toast.rolledBack'));
          await refresh();
        } else {
          showToast('error', 'Rollback failed: ' + r.error);
        }
      },
    });
  };

  return (
    <div className="app">
      {/* Topbar */}
      <header className="topbar">
        <h1>
          <span className="logo-dot" />
          {t('app.title')}
        </h1>
        <div className="topbar-actions">
          <button
            className="btn btn-ghost btn-icon"
            title={t('app.refresh')}
            aria-label={t('app.refresh')}
            onClick={async () => { await refresh(); await refreshQuota(); }}
            disabled={busy}
          >
            <RefreshCw size={16} className={loading ? 'spin' : ''} />
          </button>
          {/* Language switcher */}
          <button
            className="btn btn-ghost btn-icon"
            title={lang === 'zh' ? 'Switch to English' : '切换到中文'}
            aria-label={lang === 'zh' ? 'Switch to English' : '切换到中文'}
            onClick={() => switchLanguage(lang === 'zh' ? 'en' : 'zh')}
          >
            <Languages size={16} />
          </button>
          <button
            className="btn"
            onClick={handleImportAccounts}
            disabled={busy}
            title={t('app.import')}
          >
            <Upload size={16} />
            {t('app.import')}
          </button>
          <button
            className="btn"
            onClick={handleExportAccounts}
            disabled={busy || accounts.length === 0}
            title={selectedCount ? `Export selected ${selectedCount} accounts` : 'Export all accounts (login data included, keep file safe)'}
          >
            <Download size={16} />
            {selectedCount ? t('app.export.selected', { n: selectedCount }) : t('app.export.all')}
          </button>
          <button
            className="btn"
            onClick={() => setCaptureOpen(true)}
            disabled={busy}
          >
            {t('app.capture')}
          </button>
          <button
            className="btn btn-primary"
            onClick={() => setAddOpen(true)}
            disabled={busy}
          >
            <Plus size={16} />
            {t('app.add')}
          </button>
        </div>
      </header>

      <StatusBar status={status} loading={loading} quota={aggregateQuota} quotaLoading={quotaLoading} onRefreshQuota={refreshQuota} currentQuota={currentAccountId ? accountQuotas[currentAccountId] : null} />

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
          <span>{selectedCount ? t('export.selected', { n: selectedCount }) : t('export.hint')}</span>
          <div className="export-select-actions">
            <button className="btn btn-ghost btn-sm" onClick={toggleVisibleSelected} disabled={busy || visibleIds.length === 0}>
              {allVisibleSelected ? t('export.deselectAll') : t('export.selectAll')}
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => setSelectedAccountIds({})} disabled={busy || selectedCount === 0}>
              {t('export.clearSelection')}
            </button>
            <button className="btn btn-danger btn-sm" onClick={handleDeleteSelected} disabled={busy || selectedCount === 0}>
              {t('export.deleteSelected')}
            </button>
          </div>
        </div>
      )}

      <main className="account-list">
        {loading ? (
          <div className="empty">
            <RefreshCw size={40} className="empty-icon spin" />
            <p>{t('status.loading')}</p>
          </div>
        ) : accounts.length === 0 ? (
          <div className="empty">
            <Users size={56} className="empty-icon" />
            <strong className="empty-title">{t('empty.noAccounts.title')}</strong>
            <p>{t('empty.noAccounts.desc')}</p>
            <div className="empty-actions">
              <button className="btn btn-primary empty-action" onClick={() => setAddOpen(true)} disabled={busy}>
                <Plus size={16} />
                {t('app.add')}
              </button>
              <button className="btn empty-action" onClick={handleImportAccounts} disabled={busy}>
                <Upload size={16} />
                {t('app.import')}
              </button>
              <button className="btn empty-action" onClick={() => setCaptureOpen(true)} disabled={busy}>
                {t('app.capture')}
              </button>
            </div>
          </div>
        ) : filteredAccounts.length === 0 ? (
          <div className="empty">
            <SearchX size={56} className="empty-icon" />
            <strong className="empty-title">{t('empty.noMatch.title')}</strong>
            <p>{t('empty.noMatch.desc')}</p>
            <button className="btn btn-primary btn-sm empty-action" onClick={clearFilters}>
              {t('toolbar.filter.clear')}
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
          aria-label={t('footer.rollback')}
          title={status?.hasLastBackup ? t('footer.rollback') : 'No backup available'}
        >
          <Undo2 size={14} />
          {t('footer.rollback')}
        </button>
        <span className="footer-tip">
          <Info size={13} />
          {t('footer.tip')}
        </span>
      </footer>

      {captureOpen && (
        <CaptureModal
          onClose={() => setCaptureOpen(false)}
          onConfirm={handleCapture}
          busy={busy}
          defaultName={status?.current ? 'Account-' + status.current.shortId : ''}
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
