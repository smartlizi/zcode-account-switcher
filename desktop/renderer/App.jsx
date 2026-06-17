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
} from 'lucide-react';
import AccountCard from './components/AccountCard.jsx';
import StatusBar from './components/StatusBar.jsx';
import Toolbar from './components/Toolbar.jsx';
import CaptureModal from './components/CaptureModal.jsx';
import AddAccountModal from './components/AddAccountModal.jsx';
import ConfirmDialog from './components/ConfirmDialog.jsx';

export default function App() {
  const [status, setStatus] = useState(null); // {current, zcodeRunning, hasLastBackup}
  const [accounts, setAccounts] = useState([]);
  const accountsRef = useRef(accounts); // 供 refreshQuota 等回调读取最新账号列表，避免依赖重建
  accountsRef.current = accounts;
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false); // 全局忙态（切换/回滚进行中，禁用所有按钮）
  const [quota, setQuota] = useState(null);
  const [quotaLoading, setQuotaLoading] = useState(false);
  const [accountQuotas, setAccountQuotas] = useState({});
  const accountQuotasRef = useRef(accountQuotas);
  accountQuotasRef.current = accountQuotas;
  const [toast, setToast] = useState(null); // {type, msg}
  const [captureOpen, setCaptureOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [confirm, setConfirm] = useState(null); // {title, desc, onOk}
  const [renamingId, setRenamingId] = useState(null); // 正在重命名的账号 id
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState({ health: 'all', quota: 'all' });
  const [selectedAccountIds, setSelectedAccountIds] = useState({});

  const showToast = useCallback((type, msg) => setToast({ type, msg }), []);

  // 刷新所有数据
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
          next[id] = { loading: false, ok: false, error: r.error || '额度批量查询失败' };
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
          : { loading: false, ok: false, error: (item && item.error) || '额度不可查' };
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

  // 轻量刷新：只拉取 status + 账号列表，不刷新任何账号额度（用于切换账号后，避免全量额度刷新）
  const refreshListOnly = useCallback(async () => {
    const s = await window.api.status();
    const l = await window.api.list();
    if (s.ok) setStatus(s.data);
    if (l.ok) setAccounts(l.data);
  }, []);

  // 仅刷新某一个账号的额度：只改这一个 id 的状态，不影响其它卡片
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
          : { loading: false, ok: false, error: (r && r.error) || '额度不可查' },
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
      if (!r.ok) { showToast('error', r.error || '导出失败'); return; }
      if (r.data?.canceled) return;
      showToast('success', `已导出 ${r.data?.count || 0} 个账号，请妥善保管导出文件`);
      if (selectedIds.length) setSelectedAccountIds({});
    } finally {
      setBusy(false);
    }
  }, [selectedIds, showToast]);

  const handleImportAccounts = useCallback(async () => {
    setBusy(true);
    try {
      const r = await window.api.importAccounts();
      if (!r.ok) { showToast('error', r.error || '导入失败'); return; }
      if (r.data?.canceled) return;

      const imported = r.data?.imported || [];
      const skipped = r.data?.skipped || [];
      const s = await window.api.status();
      const l = await window.api.list();
      if (s.ok) setStatus(s.data);
      if (l.ok) setAccounts(l.data);

      const ids = imported.map((x) => x.id).filter(Boolean);
      const fileErrors = (r.data?.files || []).filter((x) => x.error).length;
      const fileText = r.data?.fileCount > 1 ? `，共 ${r.data.fileCount} 个文件` : '';
      const skippedText = skipped.length ? `，跳过 ${skipped.length} 项` : '';
      const errorText = fileErrors ? `，${fileErrors} 个文件失败` : '';
      if (ids.length) {
        showToast('success', `已导入 ${ids.length} 个账号${fileText}${skippedText}${errorText}，正在刷新额度`);
        await refreshImportedQuotas(ids);
      } else {
        showToast(skipped.length || fileErrors ? 'info' : 'error', skipped.length || fileErrors ? `没有新账号导入${fileText}${skippedText}${errorText}` : '导入文件中没有可用账号');
      }
    } finally {
      setBusy(false);
    }
  }, [refreshImportedQuotas, showToast]);

  const refreshQuota = useCallback(async () => {
    // 总额度现在是所有账号合计，刷新 = 重新拉取所有账号额度
    setQuotaLoading(true);
    await refreshAccountQuotas(accountsRef.current);
    setQuotaLoading(false);
  }, [refreshAccountQuotas]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await refresh();
      // refresh() 已拉取所有账号额度，accountQuotas 更新后 aggregateQuota 自动计算合计，无需再单独刷新
      setLoading(false);
    })();
  }, [refresh]);

  // toast 自动消失
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  // 当前登录账号对应的快照 id（用于卡片显"当前"角标）
  // 注意：账号 id 优先用 emailShortId（同邮箱去重），故这里也优先用 emailShortId 匹配 acc.id
  const currentAccountId = status?.current?.emailShortId || status?.current?.shortId || null;

  // 自动刷新当前账号额度：每 60s 轮询一次，保证使用中的账号额度是最新的（无需手动点刷新）
  useEffect(() => {
    if (!currentAccountId || loading) return;
    const timer = setInterval(() => {
      refreshOneAccountQuota(currentAccountId);
    }, 60000);
    return () => clearInterval(timer);
  }, [currentAccountId, loading, refreshOneAccountQuota]);

  // 总额度概览：聚合列表【所有账号】的额度，按模型名分组累加，随 accountQuotas 动态变化
  const aggregateQuota = useMemo(() => {
    const byModel = {}; // { modelName: { remaining, total, percentUsedSum, count } }
    let hasAny = false;
    let latestRefresh = 0;
    for (const q of Object.values(accountQuotas)) {
      if (!q?.ok || !q?.data?.items) continue;
      hasAny = true;
      if (q.data.refreshedAt && q.data.refreshedAt > latestRefresh) latestRefresh = q.data.refreshedAt;
      for (const item of q.data.items) {
        const name = item.name || '未知模型';
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
        remaining: new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 0 }).format(totalRemaining),
      },
    };
  }, [accountQuotas]);

  // 搜索 + 筛选：组合生效，默认显示全部
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
      // 搜索：名称 / 邮箱 / 名称(name) / 提供方
      if (q) {
        const hay = [acc.label, acc.email, acc.name, acc.provider]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      // 健康状态
      if (filters.health !== 'all') {
        const h = acc.health?.status || 'unknown';
        if (h !== filters.health) return false;
      }
      // 额度状态：可查 / 不可查
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

  // 捕获
  const handleCapture = async (label) => {
    setBusy(true);
    const r = await window.api.capture({ label, note: '' });
    setBusy(false);
    if (!r.ok) {
      showToast('error', '捕获失败：' + r.error);
      return;
    }
    if (r.data.created) {
      showToast('success', `已捕获账号：${r.data.meta.label}`);
      setCaptureOpen(false);
      await refresh();
    } else if (r.data.skipped) {
      showToast('info', r.data.message + '（如需更新请先删除再捕获）');
    }
  };

  // 切换
  const handleUse = async (acc) => {
    setConfirm({
      title: '切换账号',
      desc: `将关闭并重启 ZCode，切换到「${acc.label}」。`,
      wide: true,
      detail: (
        <div>
          <div className="confirm-grid">
            <div className="confirm-card">
              <span className="confirm-label">当前账号</span>
              <strong className="confirm-email">{status?.current?.email || status?.current?.label || '未识别'}</strong>
              <small>{status?.current?.provider || '-'} · {status?.current?.shortId || '-'}</small>
            </div>
            <div className="confirm-card target">
              <span className="confirm-label">目标账号</span>
              <strong className="confirm-email">{acc.email || acc.label}</strong>
              <small>{acc.provider} · {acc.id}</small>
            </div>
          </div>
          <div className="confirm-notes">
            <div>快照状态：<strong>{acc.health?.summary || '未检查'}</strong></div>
            <div>额度概览：<strong>{accountQuotas[acc.id]?.ok ? `剩余 ${accountQuotas[acc.id].data?.display?.remaining || '未知'} / 总量 ${accountQuotas[acc.id].data?.display?.total || '未知'}` : (accountQuotas[acc.id]?.error || '暂不可查')}</strong></div>
            <div>将执行：关闭 ZCode → 备份 .last → 写入登录态 → 重启 ZCode</div>
          </div>
        </div>
      ),
      confirmText: '切换并重启',
      onOk: async () => {
        setConfirm(null);
        setBusy(true);
        showToast('info', '正在切换，请稍候（会自动重启 ZCode）…');
        const r = await window.api.use(acc.id);
        setBusy(false);
        if (r.ok) {
          showToast('success', `已切换到「${acc.label}」`);
          // 切换瞬间立即把目标账号额度置 loading 态，
          // 这样左上角当前账号卡片马上显示"额度加载中…"，无需等 60s 定时器
          setAccountQuotas((prev) => ({
            ...prev,
            [acc.id]: { ...(prev[acc.id] || {}), loading: true, ok: false, error: null },
          }));
          // 仅刷新状态+列表，不刷新所有账号额度（其它账号额度不变，无需重拉）
          await refreshListOnly();
          // 只刷新切换后的目标账号额度
          await refreshOneAccountQuota(acc.id);
        } else {
          showToast('error', '切换失败：' + r.error);
        }
      },
    });
  };

  // 删除
  const handleDelete = async (acc) => {
    setConfirm({
      title: '删除账号快照',
      desc: `确定删除「${acc.label}」？该账号的登录态快照将被清除（不影响 ZCode 当前登录态）。`,
      danger: true,
      confirmText: '删除',
      onOk: async () => {
        setConfirm(null);
        setBusy(true);
        const r = await window.api.remove(acc.id);
        setBusy(false);
        if (r.ok && r.data.removed) {
          showToast('success', '已删除');
          // 仅刷新状态+列表，不刷新所有账号额度（其他账号额度不变，无需重拉）
          await refreshListOnly();
          // 清理被删账号在 accountQuotas 里的残留条目，避免脏数据
          setAccountQuotas((prev) => {
            if (!prev[acc.id]) return prev;
            const next = { ...prev };
            delete next[acc.id];
            return next;
          });
        } else {
          showToast('error', '删除失败');
        }
      },
    });
  };

  const handleDeleteSelected = async () => {
    const selectedAccounts = accounts.filter((acc) => selectedAccountIds[acc.id]);
    if (!selectedAccounts.length) return;
    setConfirm({
      title: '批量删除账号快照',
      desc: `确定删除已选的 ${selectedAccounts.length} 个账号？这些账号的登录态快照将被清除（不影响 ZCode 当前登录态）。`,
      danger: true,
      confirmText: `删除 ${selectedAccounts.length} 个账号`,
      detail: (
        <div className="confirm-notes">
          {selectedAccounts.slice(0, 8).map((acc) => (
            <div key={acc.id}>将删除：<strong>{acc.email || acc.label || acc.id}</strong></div>
          ))}
          {selectedAccounts.length > 8 && <div>另有 {selectedAccounts.length - 8} 个账号…</div>}
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
        showToast(failed ? 'info' : 'success', failed ? `已删除 ${removed} 个账号，${failed} 个删除失败` : `已删除 ${removed} 个账号`);
      },
    });
  };

  // 重命名（inline 编辑）
  const handleRename = async (acc, newLabel) => {
    setRenamingId(null);
    if (!newLabel || newLabel === acc.label) return;
    setBusy(true);
    const r = await window.api.rename(acc.id, newLabel);
    setBusy(false);
    if (r.ok) {
      showToast('success', '已重命名');
      await refresh();
    } else {
      showToast('error', '重命名失败：' + r.error);
    }
  };

  // 回滚
  const handleRollback = async () => {
    setConfirm({
      title: '回滚到切换前',
      desc: '将恢复到上一次切换前的登录态（使用 .last 备份），并重启 ZCode。',
      onOk: async () => {
        setConfirm(null);
        setBusy(true);
        showToast('info', '正在回滚…');
        const r = await window.api.rollback();
        setBusy(false);
        if (r.ok) {
          showToast('success', '已回滚');
          await refresh();
        } else {
          showToast('error', '回滚失败：' + r.error);
        }
      },
    });
  };

  return (
    <div className="app">
      {/* 顶栏 */}
      <header className="topbar">
        <h1>
          <span className="logo-dot" />
          ZCode 账号切换器
        </h1>
        <div className="topbar-actions">
          <button
            className="btn btn-ghost btn-icon"
            title="刷新"
            aria-label="刷新账号列表和额度"
            onClick={async () => { await refresh(); await refreshQuota(); }}
            disabled={busy}
          >
            <RefreshCw size={16} className={loading ? 'spin' : ''} />
          </button>
          <button
            className="btn"
            onClick={handleImportAccounts}
            disabled={busy}
            title="从导出的账号快照文件导入"
          >
            <Upload size={16} />
            导入账号
          </button>
          <button
            className="btn"
            onClick={handleExportAccounts}
            disabled={busy || accounts.length === 0}
            title={selectedCount ? `导出已勾选的 ${selectedCount} 个账号` : '未勾选时导出全部账号，导出的文件包含账号登录态，请妥善保管'}
          >
            <Download size={16} />
            {selectedCount ? `导出已选 ${selectedCount}` : '导出账号'}
          </button>
          <button
            className="btn"
            onClick={() => setCaptureOpen(true)}
            disabled={busy}
          >
            捕获当前账号
          </button>
          <button
            className="btn btn-primary"
            onClick={() => setAddOpen(true)}
            disabled={busy}
          >
            <Plus size={16} />
            添加账号
          </button>
        </div>
      </header>

      {/* 状态栏 */}
      <StatusBar status={status} loading={loading} quota={aggregateQuota} quotaLoading={quotaLoading} onRefreshQuota={refreshQuota} currentQuota={currentAccountId ? accountQuotas[currentAccountId] : null} />

      {/* 搜索 + 筛选工具栏（有账号时才显示）*/}
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

      {/* 导出选择条 */}
      {!loading && accounts.length > 0 && (
        <div className="export-select-bar">
          <span>{selectedCount ? `已选择 ${selectedCount} 个账号用于导出` : '勾选账号后可只导出所选；不勾选则导出全部'}</span>
          <div className="export-select-actions">
            <button className="btn btn-ghost btn-sm" onClick={toggleVisibleSelected} disabled={busy || visibleIds.length === 0}>
              {allVisibleSelected ? '取消全选当前结果' : '全选当前结果'}
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => setSelectedAccountIds({})} disabled={busy || selectedCount === 0}>
              清空选择
            </button>
            <button className="btn btn-danger btn-sm" onClick={handleDeleteSelected} disabled={busy || selectedCount === 0}>
              删除已选
            </button>
          </div>
        </div>
      )}

      {/* 账号列表 */}
      <main className="account-list">
        {loading ? (
          <div className="empty">
            <RefreshCw size={40} className="empty-icon spin" />
            <p>加载中…</p>
          </div>
        ) : accounts.length === 0 ? (
          <div className="empty">
            <Users size={56} className="empty-icon" />
            <strong className="empty-title">还没有保存任何账号</strong>
            <p>
              点击下方添加，或先在 ZCode 登录后捕获当前登录态。
            </p>
            <div className="empty-actions">
              <button className="btn btn-primary empty-action" onClick={() => setAddOpen(true)} disabled={busy}>
                <Plus size={16} />
                添加账号
              </button>
              <button className="btn empty-action" onClick={handleImportAccounts} disabled={busy}>
                <Upload size={16} />
                导入账号
              </button>
              <button className="btn empty-action" onClick={() => setCaptureOpen(true)} disabled={busy}>
                捕获当前账号
              </button>
            </div>
          </div>
        ) : filteredAccounts.length === 0 ? (
          <div className="empty">
            <SearchX size={56} className="empty-icon" />
            <strong className="empty-title">没有匹配账号</strong>
            <p>
              当前搜索或筛选条件下没有结果，请更换关键词或清空筛选。
            </p>
            <button className="btn btn-primary btn-sm empty-action" onClick={clearFilters}>
              清空筛选
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

      {/* 底栏 */}
      <footer className="footer">
        <button
          className="btn btn-ghost btn-sm"
          onClick={handleRollback}
          disabled={busy || !status?.hasLastBackup}
          aria-label="回滚到上一次切换前的登录态"
          title={
            status?.hasLastBackup
              ? '回滚到上一次切换前的登录态'
              : '暂无可回滚的备份'
          }
        >
          <Undo2 size={14} />
          回滚上次切换
        </button>
        <span className="footer-tip">
          <Info size={13} />
          切换会自动关闭并重启 ZCode
        </span>
      </footer>

      {/* 弹窗 */}
      {captureOpen && (
        <CaptureModal
          onClose={() => setCaptureOpen(false)}
          onConfirm={handleCapture}
          busy={busy}
          defaultName={status?.current ? '账号-' + status.current.shortId : ''}
        />
      )}
      {addOpen && (
        <AddAccountModal
          onClose={() => setAddOpen(false)}
          onDone={async (newAccountId) => {
            setAddOpen(false);
            // 只刷新账号列表数据 + 当前状态，不刷新原有账号的额度
            const s = await window.api.status();
            const l = await window.api.list();
            if (s.ok) setStatus(s.data);
            if (l.ok) setAccounts(l.data);

            const accountsAfterAdd = l.ok && Array.isArray(l.data) ? l.data : [];
            const exists = accountsAfterAdd.some((acc) => acc.id === newAccountId);
            const latest = accountsAfterAdd[accountsAfterAdd.length - 1];
            const targetId = exists ? newAccountId : latest?.id;

            // 自动刷新新增账号的额度（用列表中真实存在的 id，避免异步事件里的旧 id 造成快照找不到）
            if (targetId) {
              // 先置 loading 态，避免卡片短暂显示"额度不可查"
              setAccountQuotas((prev) => ({
                ...prev,
                [targetId]: { loading: true, ok: false, error: null },
              }));
              await refreshOneAccountQuota(targetId);
              // 新账号服务端 billing 可能未即时就绪（部分模型额度延迟初始化）：
              // 渐进式自动重试 3 次（8s / 20s / 40s），覆盖服务端初始化窗口
              [8000, 20000, 40000].forEach((delay) => {
                setTimeout(() => {
                  setAccountQuotas((prev) => {
                    if (prev[targetId]?.ok && prev[targetId]?.data?.items?.length) return prev; // 已有数据就不重试
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

      {/* Toast */}
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
