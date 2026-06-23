#!/usr/bin/env node
'use strict';
/**
 * ZCode Account Switcher CLI
 *
 * Supports both Chinese (zh) and English (en) output via --lang flag.
 * Default: auto-detect from system locale, fallback to zh.
 */
try {
  if (process.stdout.isTTY && typeof process.stdout.handle?.setEncoding === 'function') {
    process.stdout.handle.setEncoding('utf8');
  }
} catch (_) {}
try { process.stdout.setDefaultEncoding('utf8'); } catch (_) {}
try { process.stderr.setDefaultEncoding('utf8'); } catch (_) {}

const manager = require('./manager');
const switcher = require('./switcher');
const quota = require('./quota');
const { findZCodeExe, CREDENTIALS_FILE, CONFIG_FILE } = require('./paths');

/** Simple i18n for CLI */
const LANG = (() => {
  const idx = process.argv.indexOf('--lang');
  if (idx !== -1 && process.argv[idx + 1]) {
    const v = process.argv[idx + 1].toLowerCase();
    if (v === 'en' || v === 'english') return 'en';
  }
  // Also check LANG env var / system locale
  const sysLang = (process.env.LANG || '').toLowerCase();
  if (sysLang.startsWith('en')) return 'en';
  return 'zh';
})();

const I18N = {
  zh: {
    err_no_id: '请提供账号 id 或序号',
    err_no_accounts: '没有已保存的账号',
    err_out_of_range: '序号超出范围（1~{max}）',
    err_prefix_match: 'id 前缀匹配到多个账号，请输入更完整的 id',
    err_not_found: '找不到账号: {input}',
    err_no_name: '请提供新名称',
    no_accounts_hint: '  （暂无已保存的账号，使用 `capture` 添加）',
    table_header: '  序号  id          名称                 provider                 捕获时间            大小',
    table_separator: '  ----  ----------  -------------------  -----------------------  ------------------  ----',
    unknown: '未知',
    quota_title: '=== ZCode Quota ===',
    total: '总量:   ',
    used: '已用:   ',
    remaining: '剩余:   ',
    progress: '进度:   ',
    refreshed: '刷新:   ',
    quota_items: '▶ 分项额度:',
    item_line: '  - {name}: 剩余 {remaining} / 总量 {total} ({unit})',
    status_title: '=== ZCode Account Switcher ===',
    zcode_path: 'ZCode 客户端: ',
    zcode_not_found: '未找到',
    running_status: '运行状态:     ',
    running: '✅ 运行中',
    not_running: '⛔ 未运行',
    login_dir: '登录态目录:   ',
    current_account: '▶ 当前登录账号:',
    fingerprint: '  指纹 ID:  ',
    source: '  来源:     ',
    provider: '  Provider: ',
    no_current: '\n⚠ 无法识别当前登录账号（可能未登录，或登录态已加密无法读取）',
    saved_snapshots: '▶ 已保存账号快照:',
    captured: '✅ 已捕获账号: {label}  (id={id})',
    skipped: 'ℹ {msg}。如要覆盖，加 --overwrite。',
    switching: '🔄 切换到账号: {label}  (id={id})',
    switched: '✅ 登录态已切换。',
    restarted: '🚀 ZCode 已自动重启，登录态即刻生效。',
    not_restarted: 'ℹ ZCode 未自动重启（使用 --no-restart 关闭了，或启动失败）。手动启动即可。',
    deleted: '🗑 已删除账号: {id}',
    not_found_id: '⚠ 未找到账号: {id}',
    renamed: '✏ 已重命名: {label}',
    rolled_back: '↩ 已回滚到切换前的登录态。',
    restarted_after_rollback: '🚀 ZCode 已重启。',
    zcode_not_running: 'ZCode 未在运行。',
    closing: '关闭 ZCode...',
    closed: '✅ 已关闭。',
    close_timeout: '⚠ 关闭超时。',
    launched: '🚀 已启动 ZCode。',
    help_title: 'ZCode Account Switcher\n',
    usage: '用法:',
    help_status: '  status                          查看当前账号 + 已保存列表',
    help_capture: '  capture [--name 名称]           把当前登录态存为快照',
    help_list: '  list                            列出所有账号',
    help_quota: '  quota                           查询当前账号额度',
    help_use: '  use <id|序号> [--no-restart]    切换账号（默认自动重启 ZCode）',
    help_delete: '  delete <id|序号>                删除账号',
    help_rename: '  rename <id|序号> <新名称>       重命名',
    help_rollback: '  rollback                        回滚到切换前',
    help_kill: '  kill / launch                   手动关闭 / 启动 ZCode',
  },
  en: {
    err_no_id: 'Please provide an account ID or number',
    err_no_accounts: 'No saved accounts',
    err_out_of_range: 'Number out of range (1~{max})',
    err_prefix_match: 'ID prefix matches multiple accounts, please provide a complete ID',
    err_not_found: 'Account not found: {input}',
    err_no_name: 'Please provide a new name',
    no_accounts_hint: '  (No saved accounts yet. Use `capture` to add one.)',
    table_header: '  #     id           name                 provider                  captured at          size',
    table_separator: '  ----  ----------  -------------------  -----------------------  ------------------  ----',
    unknown: 'Unknown',
    quota_title: '=== ZCode Quota ===',
    total: 'Total:   ',
    used: 'Used:   ',
    remaining: 'Remaining:   ',
    progress: 'Progress:   ',
    refreshed: 'Refreshed:   ',
    quota_items: '▶ Itemized Quota:',
    item_line: '  - {name}: {remaining} / {total} ({unit})',
    status_title: '=== ZCode Account Switcher ===',
    zcode_path: 'ZCode: ',
    zcode_not_found: 'Not found',
    running_status: 'Status:     ',
    running: '✅ Running',
    not_running: '⛔ Not running',
    login_dir: 'Login state directory:   ',
    current_account: '▶ Current Account:',
    fingerprint: '  ID:  ',
    source: '  Source:     ',
    provider: '  Provider: ',
    no_current: '\n⚠ Cannot identify current account (not logged in, or login state is encrypted)',
    saved_snapshots: '▶ Saved Account Snapshots:',
    captured: '✅ Captured: {label}  (id={id})',
    skipped: 'ℹ {msg} Use --overwrite to replace it.',
    switching: '🔄 Switching to: {label}  (id={id})',
    switched: '✅ Login state switched.',
    restarted: '🚀 ZCode restarted automatically. Login state is active.',
    not_restarted: 'ℹ ZCode was not restarted (--no-restart was used, or launch failed). Start it manually.',
    deleted: '🗑 Deleted account: {id}',
    not_found_id: '⚠ Account not found: {id}',
    renamed: '✏ Renamed: {label}',
    rolled_back: '↩ Rolled back to previous login state.',
    restarted_after_rollback: '🚀 ZCode restarted.',
    zcode_not_running: 'ZCode is not running.',
    closing: 'Closing ZCode...',
    closed: '✅ Closed.',
    close_timeout: '⚠ Close timed out.',
    launched: '🚀 ZCode launched.',
    help_title: 'ZCode Account Switcher\n',
    usage: 'Usage:',
    help_status: '  status                          View current account + saved list',
    help_capture: '  capture [--name label]           Save current login as a snapshot',
    help_list: '  list                            List all saved accounts',
    help_quota: '  quota                           Query current account quota',
    help_use: '  use <id|#num> [--no-restart]     Switch account (auto-restarts ZCode)',
    help_delete: '  delete <id|#num>                Delete an account snapshot',
    help_rename: '  rename <id|#num> <new-name>     Rename an account',
    help_rollback: '  rollback                        Rollback to previous state',
    help_kill: '  kill / launch                   Manually stop / start ZCode',
  },
};

function _(key, params = {}) {
  let text = (I18N[LANG] || I18N.zh)[key] || key;
  for (const [k, v] of Object.entries(params)) {
    text = text.replace(`{${k}}`, v);
  }
  return text;
}

function parseArgs(argv) {
  const out = { _: [], flags: {}, kv: {} };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--lang') { i++; continue; } // skip --lang value
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith('--') || next === '--lang') {
        out.flags[key] = true;
      } else {
        out.kv[key] = next;
        i++;
      }
    } else {
      out._.push(a);
    }
  }
  return out;
}

function fmtDate(ts) {
  if (!ts) return '-';
  const d = new Date(ts);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

function resolveId(input) {
  if (!input) throw new Error(_('err_no_id'));
  const list = manager.list();
  if (list.length === 0) throw new Error(_('err_no_accounts'));
  if (/^\d+$/.test(input)) {
    const idx = parseInt(input, 10);
    if (idx < 1 || idx > list.length) throw new Error(_('err_out_of_range', { max: list.length }));
    return list[idx - 1].id;
  }
  const exact = list.find((x) => x.id === input);
  if (exact) return exact.id;
  const pref = list.filter((x) => x.id.startsWith(input));
  if (pref.length === 1) return pref[0].id;
  if (pref.length > 1) throw new Error(_('err_prefix_match'));
  throw new Error(_('err_not_found', { input }));
}

function printTable(list) {
  if (list.length === 0) {
    console.log(_('no_accounts_hint'));
    return;
  }
  console.log('');
  console.log(_('table_header'));
  console.log(_('table_separator'));
  list.forEach((a, i) => {
    const no = String(i + 1).padStart(4);
    const id = (a.id || '').padEnd(10).slice(0, 10);
    const label = (a.label || '').padEnd(19).slice(0, 19);
    const prov = (a.provider || '').padEnd(23).slice(0, 23);
    const dt = fmtDate(a.capturedAt).padEnd(18);
    const sz = (a.sizeKb || 0) + 'KB';
    console.log(`  ${no}  ${id}  ${label}  ${prov}  ${dt}  ${sz}`);
  });
  console.log('');
}

function fmtQuota(value) {
  if (value == null) return _('unknown');
  const locale = LANG === 'en' ? 'en-US' : 'zh-CN';
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(value);
}

function printQuota(q) {
  console.log(_('quota_title'));
  console.log(_('total') + fmtQuota(q.total));
  console.log(_('used') + fmtQuota(q.used));
  console.log(_('remaining') + fmtQuota(q.remaining));
  console.log(_('progress') + (q.percentUsed == null ? _('unknown') : q.percentUsed.toFixed(1) + '%'));
  if (q.refreshedAt) console.log(_('refreshed') + fmtDate(q.refreshedAt));
  if (q.items && q.items.length) {
    console.log('');
    console.log(_('quota_items'));
    q.items.forEach((item) => {
      console.log(_('item_line', { name: item.name, remaining: fmtQuota(item.remaining), total: fmtQuota(item.total), unit: item.unit || 'quota' }));
    });
  }
}

const cmd = (process.argv[2] || 'status').toLowerCase();
const args = parseArgs(process.argv.slice(3));

async function main() {
  switch (cmd) {
    case 'status': {
      const cur = manager.current();
      console.log(_('status_title'));
      console.log(_('zcode_path') + (findZCodeExe() || _('zcode_not_found')));
      console.log(_('running_status') + (switcher.isZCodeRunning() ? _('running') : _('not_running')));
      console.log(_('login_dir') + require('path').dirname(CREDENTIALS_FILE));
      if (cur) {
        console.log('');
        console.log(_('current_account'));
        console.log(_('fingerprint') + cur.shortId + (cur.userId ? '  (user_id=' + cur.userId + ')' : ''));
        console.log(_('source') + cur.source);
        console.log(_('provider') + cur.provider);
      } else {
        console.log(_('no_current'));
      }
      console.log('');
      console.log(_('saved_snapshots'));
      printTable(manager.list());
      return;
    }

    case 'list': {
      printTable(manager.list());
      return;
    }

    case 'quota': {
      const q = await quota.getQuotaOverview();
      printQuota(q);
      return;
    }

    case 'capture': {
      const r = manager.capture({
        label: args.kv.name,
        note: args.kv.note || '',
        overwrite: !!args.flags.overwrite,
      });
      if (r.created) {
        console.log(_('captured', { label: r.meta.label, id: r.meta.id }));
      } else if (r.skipped) {
        console.log(_('skipped', { msg: r.message }));
      }
      return;
    }

    case 'use': {
      const id = resolveId(args._[0]);
      const meta = JSON.parse(require('fs').readFileSync(manager.metaPath(id), 'utf8'));
      console.log(_('switching', { label: meta.label, id }));
      const opts = {
        restart: !args.flags['no-restart'],
        force: args.flags.force !== false,
      };
      const r = await manager.use(id, opts);
      console.log(_('switched'));
      if (r.restarted) console.log(_('restarted'));
      else console.log(_('not_restarted'));
      return;
    }

    case 'delete':
    case 'remove': {
      const id = resolveId(args._[0]);
      const ok = manager.remove(id);
      console.log(ok ? _('deleted', { id }) : _('not_found_id', { id }));
      return;
    }

    case 'rename': {
      const id = resolveId(args._[0]);
      const newName = args._[1];
      if (!newName) throw new Error(_('err_no_name'));
      const m = manager.rename(id, newName);
      console.log(_('renamed', { label: m.label }));
      return;
    }

    case 'rollback': {
      const r = await switcher.rollback({
        restart: !args.flags['no-restart'],
        force: args.flags.force !== false,
      });
      console.log(_('rolled_back'));
      if (r.restarted) console.log(_('restarted_after_rollback'));
      return;
    }

    case 'kill': {
      const running = switcher.isZCodeRunning();
      if (!running) { console.log(_('zcode_not_running')); return; }
      console.log(_('closing'));
      const ok = await switcher.killZCode();
      console.log(ok ? _('closed') : _('close_timeout'));
      return;
    }

    case 'launch': {
      try { switcher.launchZCode(); console.log(_('launched')); }
      catch (e) { console.error('❌ ' + e.message); process.exit(1); }
      return;
    }

    default:
      console.log(_('help_title'));
      console.log(_('usage'));
      console.log(_('help_status'));
      console.log(_('help_capture'));
      console.log(_('help_list'));
      console.log(_('help_quota'));
      console.log(_('help_use'));
      console.log(_('help_delete'));
      console.log(_('help_rename'));
      console.log(_('help_rollback'));
      console.log(_('help_kill'));
  }
}

main().catch((e) => {
  console.error('❌ ' + e.message);
  process.exit(1);
});
