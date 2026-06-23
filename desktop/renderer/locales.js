/**
 * i18n locale dictionary for ZCode Account Switcher
 *
 * Usage: import { t, setLanguage, getLanguage } from './locales.js'
 *   t('key')        → returns translated string
 *   t('key.subkey') → nested lookup
 *   setLanguage('en') / setLanguage('zh')
 */

const LOCALES = {
  zh: {
    /* ===== App ===== */
    'app.title': 'ZCode 账号切换器',
    'app.refresh': '刷新',
    'app.import': '导入账号',
    'app.export.selected': '导出已选 {n}',
    'app.export.all': '导出账号',
    'app.capture': '捕获当前账号',
    'app.add': '添加账号',

    /* ===== Status bar ===== */
    'status.current': '当前账号',
    'status.loading': '读取中…',
    'status.notRecognized': '未识别（可能未登录）',
    'status.quotaLoading': '额度加载中…',
    'status.quotaUnavailable': '额度不可查',
    'status.noQuotaData': '暂无额度数据',
    'status.totalQuota': '总额度概览',
    'status.noBilling': '暂无计费数据',
    'status.available': '可用',
    'status.refreshQuota': '刷新额度',
    'status.runtime': '运行状态',
    'status.running': '运行中',
    'status.notRunning': '未运行',
    'status.rollbackAvailable': '可回滚备份',
    'status.yes': '有',
    'status.no': '无',
    'status.remaining': '剩',
    'status.total': '总',

    /* ===== Account card ===== */
    'card.unknown': '未知',
    'card.notChecked': '未检查',
    'card.healthy': '健康',
    'card.warning': '注意',
    'card.error': '异常',
    'card.current': '当前',
    'card.quota': '额度',
    'card.refreshQuota': '刷新此账号额度',
    'card.refreshing': '刷新中…',
    'card.noQuotaData': '暂无模型额度数据',
    'card.clickToRefresh': '点击刷新获取额度',
    'card.rename': '重命名',
    'card.delete': '删除',
    'card.alreadyCurrent': '已是当前账号',
    'card.switchTo': '切换到此账号',
    'card.switch': '一键切换',
    'card.switching': '切换中…',
    'card.capturedAt': '捕获于',
    'card.exportCheck': '勾选后导出此账号',
    'card.healthHint.userInfoDecrypt': '该账号在另一台机器上捕获，本机无法读取其详细资料，但不影响切换',
    'card.healthHint.userInfoInvalid': '账号资料数据异常，但不影响切换',
    'card.healthHint.userInfoMissing': '账号资料信息不完整，但不影响切换',
    'card.healthHint.credentialsCorrupt': '登录态文件结构异常，建议重新捕获该账号',

    /* ===== Toolbar ===== */
    'toolbar.search.placeholder': '搜索名称 / 邮箱 / 提供方',
    'toolbar.search.aria': '搜索账号',
    'toolbar.search.clear': '清空搜索',
    'toolbar.search.result': '匹配 {shown} / {total} 个账号',
    'toolbar.search.total': '共 {total} 个账号',
    'toolbar.filter.health': '健康',
    'toolbar.filter.quota': '额度',
    'toolbar.filter.all': '全部',
    'toolbar.filter.healthy': '健康',
    'toolbar.filter.warning': '注意',
    'toolbar.filter.error': '异常',
    'toolbar.filter.available': '可查',
    'toolbar.filter.unavailable': '不可查',
    'toolbar.filter.clear': '清空筛选',

    /* ===== Capture modal ===== */
    'capture.title': '捕获当前账号',
    'capture.desc': '把 ZCode 当前登录的账号存为一个快照，之后可一键切换回来，无需重新登录。',
    'capture.placeholder': '给这个账号起个名字（如：主账号）',
    'capture.cancel': '取消',
    'capture.confirm': '捕获',

    /* ===== Add account modal ===== */
    'add.title': '添加账号',
    'add.phase.opening': '打开登录页',
    'add.phase.waiting': '等待登录',
    'add.phase.exchanging': '保存中',
    'add.phase.saved': '完成',
    'add.phase.error': '出错',
    'add.progress.opening': '正在打开系统浏览器...',
    'add.progress.waiting': '等待登录',
    'add.progress.exchanging': '正在保存账号...',
    'add.hint.opening': '即将跳转到系统浏览器登录',
    'add.waiting.title': '请在系统浏览器窗口中登录',
    'add.waiting.desc': '工具会自动检测登录状态，登录成功后自动完成添加',
    'add.waiting.hint': '支持账号密码 / 手机号登录（登录后无需做任何操作）',
    'add.exchanging.title': '登录成功，正在保存账号...',
    'add.exchanging.hint': '全程自动化，请稍候',
    'add.saved.title': '账号已添加成功',
    'add.error.prefix': '出错：',
    'add.close': '关闭',
    'add.cancel': '取消',
    'add.retry': '重试',

    /* ===== Confirm dialog ===== */
    'confirm.cancel': '取消',
    'confirm.confirm': '确定',

    /* ===== Empty states ===== */
    'empty.noAccounts.title': '还没有保存任何账号',
    'empty.noAccounts.desc': '点击下方添加，或先在 ZCode 登录后捕获当前登录态。',
    'empty.noMatch.title': '没有匹配账号',
    'empty.noMatch.desc': '当前搜索或筛选条件下没有结果，请更换关键词或清空筛选。',

    /* ===== Export bar ===== */
    'export.selected': '已选择 {n} 个账号用于导出',
    'export.hint': '勾选账号后可只导出所选；不勾选则导出全部',
    'export.selectAll': '全选当前结果',
    'export.deselectAll': '取消全选当前结果',
    'export.clearSelection': '清空选择',
    'export.deleteSelected': '删除已选',

    /* ===== Footer ===== */
    'footer.rollback': '回滚上次切换',
    'footer.tip': '切换会自动关闭并重启 ZCode',

    /* ===== Confirm switch ===== */
    'switch.title': '切换账号',
    'switch.desc': '将关闭并重启 ZCode，切换到「{label}」。',
    'switch.current': '当前账号',
    'switch.target': '目标账号',
    'switch.confirm': '切换并重启',
    'switch.snapshotStatus': '快照状态：',
    'switch.quotaOverview': '额度概览：',
    'switch.process': '将执行：关闭 ZCode → 备份 .last → 写入登录态 → 重启 ZCode',

    /* ===== Confirm delete ===== */
    'delete.title': '删除账号快照',
    'delete.desc': '确定删除「{label}」？该账号的登录态快照将被清除（不影响 ZCode 当前登录态）。',
    'delete.confirm': '删除',
    'delete.batch.title': '批量删除账号快照',
    'delete.batch.desc': '确定删除已选的 {count} 个账号？这些账号的登录态快照将被清除（不影响 ZCode 当前登录态）。',
    'delete.batch.confirm': '删除 {count} 个账号',

    /* ===== Confirm rollback ===== */
    'rollback.title': '回滚到切换前',
    'rollback.desc': '将恢复到上一次切换前的登录态（使用 .last 备份），并重启 ZCode。',

    /* ===== Toast messages ===== */
    'toast.captured': '已捕获账号：{label}',
    'toast.switched': '已切换到「{label}」',
    'toast.rolledBack': '已回滚',
    'toast.deleted': '已删除',
    'toast.renamed': '已重命名',
    'toast.switching': '正在切换，请稍候（会自动重启 ZCode）…',
    'toast.rollingBack': '正在回滚…',
    'toast.exported': '已导出 {count} 个账号，请妥善保管导出文件',
    'toast.imported': '已导入 {count} 个账号{fileText}{skippedText}{errorText}，正在刷新额度',
    'toast.imported.none': '没有新账号导入{fileText}{skippedText}{errorText}',
    'toast.imported.noData': '导入文件中没有可用账号',
    'toast.accountExists': '该账号已存在（{label}）',
    'toast.accountAdded': '已添加账号：{label}',
    'toast.batchDeleted': '已删除 {n} 个账号',
    'toast.batchDeleted.partial': '已删除 {n} 个账号，{failed} 个删除失败',

    /* ===== CLI ===== */
    'cli.usage': '用法:',
    'cli.statusCurrent': '当前登录账号',
    'cli.statusNone': '无法识别当前登录账号（可能未登录，或登录态已加密无法读取）',
    'cli.noAccounts': '（暂无已保存的账号，使用 `capture` 添加）',
    'cli.quotaTotal': '总量:',
    'cli.quotaUsed': '已用:',
    'cli.quotaRemaining': '剩余:',
    'cli.quotaProgress': '进度:',
    'cli.quotaRefresh': '刷新:',
    'cli.quotaItems': '分项额度:',
  },

  en: {
    /* ===== App ===== */
    'app.title': 'ZCode Account Switcher',
    'app.refresh': 'Refresh',
    'app.import': 'Import',
    'app.export.selected': 'Export Selected ({n})',
    'app.export.all': 'Export All',
    'app.capture': 'Capture Current',
    'app.add': 'Add Account',

    /* ===== Status bar ===== */
    'status.current': 'Current Account',
    'status.loading': 'Loading…',
    'status.notRecognized': 'Not recognized (not logged in)',
    'status.quotaLoading': 'Loading quota…',
    'status.quotaUnavailable': 'Quota unavailable',
    'status.noQuotaData': 'No quota data',
    'status.totalQuota': 'Total Quota',
    'status.noBilling': 'No billing data',
    'status.available': 'available',
    'status.refreshQuota': 'Refresh quota',
    'status.runtime': 'Runtime',
    'status.running': 'Running',
    'status.notRunning': 'Not running',
    'status.rollbackAvailable': 'Rollback Available',
    'status.yes': 'Yes',
    'status.no': 'No',
    'status.remaining': 'Remaining',
    'status.total': 'Total',

    /* ===== Account card ===== */
    'card.unknown': 'Unknown',
    'card.notChecked': 'Not checked',
    'card.healthy': 'Healthy',
    'card.warning': 'Warning',
    'card.error': 'Error',
    'card.current': 'Current',
    'card.quota': 'Quota',
    'card.refreshQuota': 'Refresh quota for this account',
    'card.refreshing': 'Refreshing…',
    'card.noQuotaData': 'No quota data available',
    'card.clickToRefresh': 'Click to refresh quota',
    'card.rename': 'Rename',
    'card.delete': 'Delete',
    'card.alreadyCurrent': 'Already current',
    'card.switchTo': 'Switch to this account',
    'card.switch': 'Switch',
    'card.switching': 'Switching…',
    'card.capturedAt': 'Captured at',
    'card.exportCheck': 'Check to export this account',
    'card.healthHint.userInfoDecrypt': 'This account was captured on another machine. Local details cannot be read, but switching still works.',
    'card.healthHint.userInfoInvalid': 'Account profile data is abnormal, but switching still works.',
    'card.healthHint.userInfoMissing': 'Account profile info is incomplete, but switching still works.',
    'card.healthHint.credentialsCorrupt': 'Login state file appears corrupted. Try re-capturing this account.',

    /* ===== Toolbar ===== */
    'toolbar.search.placeholder': 'Search name / email / provider',
    'toolbar.search.aria': 'Search accounts',
    'toolbar.search.clear': 'Clear search',
    'toolbar.search.result': '{shown} / {total} accounts shown',
    'toolbar.search.total': '{total} accounts',
    'toolbar.filter.health': 'Health',
    'toolbar.filter.quota': 'Quota',
    'toolbar.filter.all': 'All',
    'toolbar.filter.healthy': 'Healthy',
    'toolbar.filter.warning': 'Warning',
    'toolbar.filter.error': 'Error',
    'toolbar.filter.available': 'Available',
    'toolbar.filter.unavailable': 'Unavailable',
    'toolbar.filter.clear': 'Clear filters',

    /* ===== Capture modal ===== */
    'capture.title': 'Capture Current Account',
    'capture.desc': 'Save ZCode\'s current logged-in account as a snapshot. You can switch back to it anytime without re-logging in.',
    'capture.placeholder': 'Name this account (e.g. Main Account)',
    'capture.cancel': 'Cancel',
    'capture.confirm': 'Capture',

    /* ===== Add account modal ===== */
    'add.title': 'Add Account',
    'add.phase.opening': 'Opening',
    'add.phase.waiting': 'Waiting',
    'add.phase.exchanging': 'Saving',
    'add.phase.saved': 'Done',
    'add.phase.error': 'Error',
    'add.progress.opening': 'Opening system browser…',
    'add.progress.waiting': 'Waiting for login',
    'add.progress.exchanging': 'Saving account…',
    'add.hint.opening': 'You will be redirected to the system browser to log in',
    'add.waiting.title': 'Please log in using your system browser',
    'add.waiting.desc': 'The tool will automatically detect your login status and complete the process',
    'add.waiting.hint': 'Use your password or phone to log in (no action needed after login)',
    'add.exchanging.title': 'Login successful, saving account…',
    'add.exchanging.hint': 'Fully automated, please wait',
    'add.saved.title': 'Account added successfully',
    'add.error.prefix': 'Error: ',
    'add.close': 'Close',
    'add.cancel': 'Cancel',
    'add.retry': 'Retry',

    /* ===== Confirm dialog ===== */
    'confirm.cancel': 'Cancel',
    'confirm.confirm': 'Confirm',

    /* ===== Empty states ===== */
    'empty.noAccounts.title': 'No saved accounts yet',
    'empty.noAccounts.desc': 'Add an account below, or log into ZCode first, then capture your current session.',
    'empty.noMatch.title': 'No matching accounts',
    'empty.noMatch.desc': 'No results match your search or filter criteria. Try different keywords.',

    /* ===== Export bar ===== */
    'export.selected': '{n} account(s) selected for export',
    'export.hint': 'Check accounts to export only selected ones; uncheck to export all',
    'export.selectAll': 'Select all current results',
    'export.deselectAll': 'Deselect all current results',
    'export.clearSelection': 'Clear selection',
    'export.deleteSelected': 'Delete selected',

    /* ===== Footer ===== */
    'footer.rollback': 'Rollback',
    'footer.tip': 'Switching will close and restart ZCode',

    /* ===== Confirm switch ===== */
    'switch.title': 'Switch Account',
    'switch.desc': 'ZCode will close and restart to switch to "{label}".',
    'switch.current': 'Current Account',
    'switch.target': 'Target Account',
    'switch.confirm': 'Switch & Restart',
    'switch.snapshotStatus': 'Snapshot status: ',
    'switch.quotaOverview': 'Quota overview: ',
    'switch.process': 'Steps: Close ZCode → Backup .last → Write login state → Restart ZCode',

    /* ===== Confirm delete ===== */
    'delete.title': 'Delete Account Snapshot',
    'delete.desc': 'Are you sure you want to delete "{label}"? The login snapshot will be removed (current ZCode session is not affected).',
    'delete.confirm': 'Delete',
    'delete.batch.title': 'Batch Delete Account Snapshots',
    'delete.batch.desc': 'Delete the {count} selected accounts? Their login snapshots will be removed (current ZCode session is not affected).',
    'delete.batch.confirm': 'Delete {count} accounts',

    /* ===== Confirm rollback ===== */
    'rollback.title': 'Rollback to Previous',
    'rollback.desc': 'Restore the login state from before the last switch (using .last backup) and restart ZCode.',

    /* ===== Toast messages ===== */
    'toast.captured': 'Captured: {label}',
    'toast.switched': 'Switched to "{label}"',
    'toast.rolledBack': 'Rolled back',
    'toast.deleted': 'Deleted',
    'toast.renamed': 'Renamed',
    'toast.switching': 'Switching, please wait (ZCode will restart automatically)…',
    'toast.rollingBack': 'Rolling back…',
    'toast.exported': 'Exported {count} account(s). Please keep the file secure.',
    'toast.imported': 'Imported {count} account(s){fileText}{skippedText}{errorText}. Refreshing quota…',
    'toast.imported.none': 'No new accounts were imported{fileText}{skippedText}{errorText}',
    'toast.imported.noData': 'No usable accounts found in the import file',
    'toast.accountExists': 'Account already exists ({label})',
    'toast.accountAdded': 'Account added: {label}',
    'toast.batchDeleted': 'Deleted {n} account(s)',
    'toast.batchDeleted.partial': 'Deleted {n} account(s), {failed} failed',

    /* ===== CLI ===== */
    'cli.usage': 'Usage:',
    'cli.statusCurrent': 'Current Account',
    'cli.statusNone': 'Cannot identify current account (not logged in, or login state is encrypted)',
    'cli.noAccounts': '(No saved accounts yet. Use `capture` to add one.)',
    'cli.quotaTotal': 'Total:',
    'cli.quotaUsed': 'Used:',
    'cli.quotaRemaining': 'Remaining:',
    'cli.quotaProgress': 'Progress:',
    'cli.quotaRefresh': 'Refreshed:',
    'cli.quotaItems': 'Itemized Quota:',
  },
};

/** localStorage key for persisting language choice */
const STORAGE_KEY = 'zcas_lang';

/**
 * Get the persisted language from localStorage, fallback to 'zh'
 */
function loadPersistedLang() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'en' || stored === 'zh') return stored;
  } catch (_) {}
  return 'zh';
}

/**
 * Save language choice to localStorage
 */
function persistLang(lang) {
  try {
    localStorage.setItem(STORAGE_KEY, lang);
  } catch (_) {}
}

/** Current language state */
let _currentLang = loadPersistedLang();

/**
 * Get the current language
 */
export function getLanguage() {
  return _currentLang;
}

/**
 * Set the current language ('zh' or 'en') and persist to localStorage
 */
export function setLanguage(lang) {
  if (lang === 'zh' || lang === 'en') {
    _currentLang = lang;
    persistLang(lang);
  }
}

/**
 * Translate a key to the current language.
 * Supports nested keys like 'app.title' and interpolation like 'Hello {name}'.
 * Falls back to the key itself if not found.
 */
export function t(key, ...args) {
  const loc = LOCALES[_currentLang];
  if (!loc) return key;

  const value = loc[key];
  if (value == null) return key;

  // Support simple interpolation with a single object argument
  if (args.length === 1 && typeof args[0] === 'object') {
    let result = value;
    for (const [k, v] of Object.entries(args[0])) {
      result = result.replace(`{${k}}`, v);
    }
    return result;
  }

  return value;
}

/**
 * Get both locale objects for external use
 */
export function getLocales() {
  return LOCALES;
}

export default { t, setLanguage, getLanguage, getLocales };
