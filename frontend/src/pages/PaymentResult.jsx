import { useEffect, useState } from 'react';
import { CheckCircle, XCircle, Loader, ArrowRight, AlertTriangle } from 'lucide-react';
import api from '../services/api';

function PaymentResult({ type, sessionId, onContinue }) {
  const [countdown, setCountdown] = useState(5);
  const isSuccess = type === 'success';
  // 'checking' | 'confirmed' | 'pending' | 'error'
  const [verifyState, setVerifyState] = useState(isSuccess ? 'checking' : 'confirmed');

  useEffect(() => {
    if (!isSuccess) return;
    if (!sessionId) { setVerifyState('confirmed'); return; }

    let cancelled = false;
    api.get('/subscription/checkout/verify', { params: { session_id: sessionId } })
      .then(res => {
        if (cancelled) return;
        setVerifyState(res.data.paid ? 'confirmed' : 'pending');
      })
      .catch(() => { if (!cancelled) setVerifyState('error'); });

    return () => { cancelled = true; };
  }, [isSuccess, sessionId]);

  useEffect(() => {
    if (verifyState !== 'confirmed') return;
    const t = setInterval(() => {
      setCountdown(c => {
        if (c <= 1) { clearInterval(t); onContinue(); return 0; }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [verifyState, onContinue]);

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        {isSuccess && verifyState === 'checking' ? (
          <>
            <div style={{ ...styles.iconBox, background: 'rgba(201,162,75,0.1)', border: '1px solid rgba(201,162,75,0.3)' }}>
              <Loader size={48} color="#c9a24b" style={{ animation: 'spin 1s linear infinite' }} />
            </div>
            <h1 style={{ ...styles.title, color: '#c9a24b' }}>Vérification du paiement...</h1>
            <p style={styles.sub}>Merci de patienter pendant que nous confirmons votre paiement.</p>
          </>
        ) : isSuccess && verifyState === 'pending' ? (
          <>
            <div style={{ ...styles.iconBox, background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)' }}>
              <AlertTriangle size={48} color="#f59e0b" />
            </div>
            <h1 style={{ ...styles.title, color: '#f59e0b' }}>Paiement en cours de traitement</h1>
            <p style={styles.sub}>
              Votre paiement n'a pas encore été confirmé.<br />
              Cela peut prendre quelques instants — réessayez ou contactez le support si cela persiste.
            </p>
            <button onClick={onContinue} style={styles.btn}>
              Continuer <ArrowRight size={16} />
            </button>
          </>
        ) : isSuccess ? (
          <>
            <div style={{ ...styles.iconBox, background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)' }}>
              <CheckCircle size={48} color="#10b981" />
            </div>
            <h1 style={{ ...styles.title, color: '#10b981' }}>Paiement réussi !</h1>
            <p style={styles.sub}>
              Votre abonnement a été activé avec succès.<br />
              Bienvenue sur Tonsor.
            </p>
            <div style={styles.countdown}>
              <Loader size={14} color="#c9a24b" style={{ animation: 'spin 1s linear infinite' }} />
              Redirection dans <strong>{countdown}s</strong>...
            </div>
            <button onClick={onContinue} style={styles.btn}>
              Accéder au tableau de bord <ArrowRight size={16} />
            </button>
          </>
        ) : (
          <>
            <div style={{ ...styles.iconBox, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)' }}>
              <XCircle size={48} color="#ef4444" />
            </div>
            <h1 style={{ ...styles.title, color: '#ef4444' }}>Paiement annulé</h1>
            <p style={styles.sub}>
              Votre paiement n'a pas été effectué.<br />
              Vous pouvez réessayer à tout moment.
            </p>
            <button onClick={onContinue} style={{ ...styles.btn, background: '#374151' }}>
              Retour aux plans
            </button>
          </>
        )}
      </div>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

const styles = {
  page: {
    minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: '#0a0f1e', fontFamily: 'Inter, system-ui, sans-serif',
  },
  card: {
    background: '#111827', border: '1px solid #1f2937', borderRadius: 24,
    padding: '48px 40px', textAlign: 'center', maxWidth: 420, width: '90%',
  },
  iconBox: {
    width: 88, height: 88, borderRadius: '50%',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    margin: '0 auto 24px',
  },
  title: { fontSize: 26, fontWeight: 800, margin: '0 0 12px' },
  sub: { color: '#9ca3af', fontSize: 15, lineHeight: 1.6, margin: '0 0 24px' },
  countdown: {
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    color: '#6b7280', fontSize: 13, marginBottom: 20,
  },
  btn: {
    display: 'inline-flex', alignItems: 'center', gap: 8,
    background: '#c9a24b', color: '#fff',
    border: 'none', borderRadius: 12, padding: '13px 28px',
    fontWeight: 700, fontSize: 15, cursor: 'pointer', width: '100%',
    justifyContent: 'center',
  },
};

export default PaymentResult;
