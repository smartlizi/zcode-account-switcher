import React, { useEffect, useRef } from 'react';
import { Search, X } from 'lucide-react';
import { useI18n } from '../i18n.js';

export default function Toolbar({
  search,
  onSearch,
  filters = {},
  onFilter,
  total,
  shown,
  onClearFilters,
}) {
  const { t } = useI18n();
  const inputRef = useRef(null);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === '/' && document.activeElement !== inputRef.current) {
        const tag = (document.activeElement && document.activeElement.tagName) || '';
        if (tag !== 'INPUT' && tag !== 'TEXTAREA') {
          e.preventDefault();
          inputRef.current?.focus();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const hasFilters =
    !!search ||
    (filters.health && filters.health !== 'all') ||
    (filters.quota && filters.quota !== 'all');

  return (
    <section className="toolbar" aria-label={t('toolbar.label')}>
      <div className="toolbar-top">
        <div className="search-box">
          <Search size={15} className="search-icon" />
          <input
            ref={inputRef}
            type="text"
            className="search-input"
            placeholder={t('toolbar.searchPlaceholder')}
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            aria-label={t('toolbar.searchAccounts')}
          />
          {search ? (
            <button
              className="search-clear"
              onClick={() => onSearch('')}
              title={t('toolbar.clearSearch')}
              aria-label={t('toolbar.clearSearch')}
            >
              <X size={14} />
            </button>
          ) : null}
        </div>
        <div className="results-count" aria-live="polite">
          {hasFilters ? t('toolbar.resultsMatched', { shown, total }) : t('toolbar.resultsTotal', { total })}
        </div>
      </div>

      <div className="toolbar-filters">
        <FilterGroup
          label={t('toolbar.health')}
          value={filters.health || 'all'}
          onChange={(v) => onFilter('health', v)}
          options={[
            { value: 'all', label: t('toolbar.all') },
            { value: 'healthy', label: t('toolbar.healthy') },
            { value: 'warning', label: t('toolbar.warning') },
            { value: 'error', label: t('toolbar.error') },
          ]}
        />
        <FilterGroup
          label={t('toolbar.quota')}
          value={filters.quota || 'all'}
          onChange={(v) => onFilter('quota', v)}
          options={[
            { value: 'all', label: t('toolbar.all') },
            { value: 'available', label: t('toolbar.available') },
            { value: 'unavailable', label: t('toolbar.unavailable') },
          ]}
        />
        {hasFilters ? (
          <button className="filter-clear" onClick={onClearFilters} aria-label={t('toolbar.clearSearchAndFilters')}>
            <X size={13} />
            {t('toolbar.clearFilters')}
          </button>
        ) : null}
      </div>
    </section>
  );
}

function FilterGroup({ label, value, onChange, options }) {
  return (
    <div className="filter-group" role="group" aria-label={label}>
      <span className="filter-label">{label}</span>
      <div className="segmented">
        {options.map((opt) => (
          <button
            key={opt.value}
            className={`segment ${value === opt.value ? 'active' : ''}`}
            aria-pressed={value === opt.value}
            onClick={() => onChange(opt.value)}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}
