import React, { useState, useEffect, useRef } from 'react';
import { UserPlus, Loader2 } from 'lucide-react';
import { useLanguage } from '../LanguageContext.jsx';

export default function CaptureModal({ onClose, onConfirm, busy, defaultName }) {
  const { t } = useLanguage();
  const [name, setName] = useState(defaultName || '');
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const submit = () => onConfirm(name.trim() || defaultName);

  const handleKey = (e) => {
    if (e.key === 'Enter') submit();
    if (e.key === 'Escape') onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>
          <UserPlus size={18} />
          {t('capture.title')}
        </h2>
        <p>
          {t('capture.desc')}
        </p>
        <input
          ref={inputRef}
          className="modal-input"
          placeholder={t('capture.placeholder')}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={handleKey}
          disabled={busy}
        />
        <div className="modal-actions">
          <button className="btn" onClick={onClose} disabled={busy}>
            {t('capture.cancel')}
          </button>
          <button className="btn btn-primary" onClick={submit} disabled={busy}>
            {busy ? <Loader2 size={15} className="spin" /> : <UserPlus size={15} />}
            {t('capture.confirm')}
          </button>
        </div>
      </div>
    </div>
  );
}
