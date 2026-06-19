import React, { useEffect, useRef } from 'react';
import { AlertTriangle } from 'lucide-react';
import { useI18n } from '../i18n.js';

export default function ConfirmDialog({ title, desc, detail, danger, confirmText, cancelText, onCancel, onOk, wide }) {
  const { t } = useI18n();
  const cancelRef = useRef(null);

  useEffect(() => {
    cancelRef.current?.focus();
    const onKey = (e) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className={`modal ${wide ? 'modal-wide' : ''}`} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <h2 style={danger ? { color: '#ef4444' } : undefined}>
          <AlertTriangle size={18} />
          {title}
        </h2>
        <p>{desc}</p>
        {detail ? <div className="confirm-detail">{detail}</div> : null}
        <div className="modal-actions">
          <button className="btn" ref={cancelRef} onClick={onCancel}>
            {cancelText || t('confirm.cancel')}
          </button>
          <button
            className={danger ? 'btn' : 'btn btn-primary'}
            onClick={onOk}
            style={danger ? { background: '#ef4444', color: '#fff', fontWeight: 600 } : undefined}
          >
            {confirmText || t('confirm.confirm')}
          </button>
        </div>
      </div>
    </div>
  );
}
