import React, { useEffect, useRef, useState } from 'react';
import { Loader2, UserPlus, CheckCircle2, LogIn, ShieldCheck } from 'lucide-react';
import { useI18n } from '../i18n.js';

export default function AddAccountModal({ onClose, onDone, showToast }) {
  const { t } = useI18n();
  const [phase, setPhase] = useState('opening');
  const [progressMsg, setProgressMsg] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(true);
  const unsubFlowRef = useRef(null);

  const cleanup = () => {
    if (unsubFlowRef.current) {
      unsubFlowRef.current();
      unsubFlowRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      cleanup();
      try {
        window.api.oauthCancel();
      } catch (_) {}
    };
  }, []);

  useEffect(() => {
    start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const start = async () => {
    setError('');
    setBusy(true);
    setPhase('opening');
    setProgressMsg(t('addAccount.openingMessage'));
    unsubFlowRef.current = window.api.onFlowEvent((event) => handleFlowEvent(event));

    const r = await window.api.oauthStart({});
    if (!r.ok) {
      if (unsubFlowRef.current) {
        unsubFlowRef.current();
        unsubFlowRef.current = null;
      }
      fail(r.error);
    }
  };

  const handleFlowEvent = (event) => {
    switch (event.type) {
      case 'browser-open':
        setPhase('opening');
        setProgressMsg(event.message || t('addAccount.openingMessage'));
        break;
      case 'waiting-login':
        setPhase('waiting');
        setProgressMsg(event.message || t('addAccount.waitingTitle'));
        break;
      case 'exchanging':
        setPhase('exchanging');
        setProgressMsg(event.message || t('addAccount.progressSaved'));
        if (event.email) setEmail(event.email);
        break;
      case 'saved':
        setPhase('saved');
        setBusy(false);
        cleanup();
        if (event.email) setEmail(event.email);
        if (event.skipped) {
          showToast('info', t('addAccount.alreadySavedInfo', { label: event.account?.label || t('common.unknown') }));
        } else {
          showToast('success', t('addAccount.addedSuccess', { label: event.account?.label || event.email || t('common.unknown') }));
        }
        setTimeout(() => onDone(event.account?.id), 800);
        break;
      case 'error':
        setBusy(false);
        cleanup();
        setError(event.message || t('addAccount.flowError'));
        setPhase('error');
        break;
      default:
        break;
    }
  };

  const fail = (msg) => {
    setError(msg || t('addAccount.operationFailed'));
    setBusy(false);
    setPhase('error');
  };

  const retry = () => {
    cleanup();
    setError('');
    start();
  };

  const handleClose = () => {
    if (phase === 'exchanging' || phase === 'saved') return;
    cleanup();
    window.api.oauthCancel();
    onClose();
  };

  const phaseLabel = t(`addAccount.phaseLabel.${phase}`);

  return (
    <div className="modal-overlay" onClick={phase === 'exchanging' || phase === 'saved' ? undefined : handleClose}>
      <div className="modal modal-wide" onClick={(e) => e.stopPropagation()}>
        <h2>
          <UserPlus size={18} />
          {t('addAccount.title')}
          {phaseLabel && <span className="phase-tag">{phaseLabel}</span>}
        </h2>

        {phase === 'opening' && (
          <div className="oauth-panel">
            <div className="install-box">
              <Loader2 size={28} className="spin" />
              <strong>{progressMsg || t('addAccount.openingMessage')}</strong>
              <span className="progress-hint">{t('addAccount.openingHint')}</span>
            </div>
          </div>
        )}

        {phase === 'waiting' && (
          <div className="oauth-panel">
            <div className="waiting-box">
              <LogIn size={34} />
              <strong>{t('addAccount.waitingTitle')}</strong>
              <span>{t('addAccount.waitingHint')}</span>
              <span className="progress-hint">{t('addAccount.waitingHint2')}</span>
              <Loader2 size={20} className="spin" />
            </div>
          </div>
        )}

        {phase === 'exchanging' && (
          <div className="oauth-panel">
            <div className="install-box">
              <ShieldCheck size={28} color="#22c55e" />
              <strong>{t('addAccount.savingTitle')}</strong>
              <Loader2 size={20} className="spin" />
              <span className="progress-hint">{t('addAccount.savingHint')}</span>
            </div>
          </div>
        )}

        {phase === 'saved' && (
          <div className="oauth-panel">
            <div className="logged-in-box">
              <CheckCircle2 size={32} color="#22c55e" />
              <strong>{t('addAccount.savedTitle')}</strong>
              {email && <span className="login-email">{email}</span>}
            </div>
          </div>
        )}

        {phase === 'error' && (
          <div className="oauth-panel">
            <div className="oauth-error">
              <strong>{t('addAccount.error')}:</strong>{error}
            </div>
          </div>
        )}

        <div className="modal-actions">
          <button className="btn" onClick={handleClose} disabled={busy}>
            {phase === 'saved' || phase === 'error' ? t('addAccount.close') : t('addAccount.cancel')}
          </button>
          {phase === 'error' && (
            <button className="btn btn-primary" onClick={retry} disabled={busy}>
              {t('addAccount.retry')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
