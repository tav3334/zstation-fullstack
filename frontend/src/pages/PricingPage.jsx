import { useEffect, useState } from 'react';
import { Crown, Zap, Star, Check, LogOut, Loader, XCircle, ArrowLeft, RefreshCw } from 'lucide-react';
import api from '../services/api';
import useConfirm from '../hooks/useConfirm';

const PLAN_ICONS = { Basique: Zap, Pro: Star, Premium: Crown };
const PLAN_COLORS = {
  Basique:  { accent: '#c9a24b', bg: 'rgba(201, 162, 75,0.08)',  border: 'rgba(201, 162, 75,0.3)'  },
  Pro:      { accent: '#f59e0b', bg: 'rgba(245,158,11,0.08)',  border: 'rgba(245,158,11,0.3)'  },
  Premium:  { accent: '#10b981', bg: 'rgba(16,185,129,0.08)',  border: 'rgba(16,185,129,0.3)'  },
};

function PricingPage({ user, onLogout, onBack, currentPlan, subscriptionStatus, onSubscriptionChanged, autoSelectPlanName, onAutoSelectDone }) {
  const [plans, setPlans]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [paying, setPaying]     = useState(null); // plan_id en cours
  const [cancelling, setCancelling] = useState(false);
  const [cancelMessage, setCancelMessage] = useState(null);
  const [checkoutError, setCheckoutError] = useState(null);
  const { confirm, ConfirmModal } = useConfirm();

  useEffect(() => {
    api.get('/subscription/plans')
      .then(res => setPlans(res.data.plans || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleChoose = async (plan) => {
    setPaying(plan.id);
    setCheckoutError(null);
    try {
      const res = await api.post('/subscription/checkout', { plan_id: plan.id });
      window.location.href = res.data.checkout_url;
    } catch (err) {
      setCheckoutError(err.response?.data?.message || 'Erreur lors de la création du paiement.');
      setPaying(null);
    }
  };

  const handleCancelSubscription = async () => {
    const ok = await confirm(
      "Annuler votre abonnement ? Vous conservez l'accès jusqu'à la fin de la période déjà payée.",
      { confirmLabel: 'Annuler l\'abonnement', cancelLabel: 'Garder mon abonnement' }
    );
    if (!ok) return;

    setCancelling(true);
    setCancelMessage(null);
    try {
      const res = await api.post('/subscription/cancel');
      setCancelMessage({ type: 'success', text: res.data.message });
      onSubscriptionChanged?.();
    } catch (err) {
      setCancelMessage({ type: 'error', text: err.response?.data?.message || "Erreur lors de l'annulation." });
    } finally {
      setCancelling(false);
    }
  };

  const handleResumeSubscription = async () => {
    setCancelling(true);
    setCancelMessage(null);
    try {
      const res = await api.post('/subscription/resume');
      setCancelMessage({ type: 'success', text: res.data.message });
      onSubscriptionChanged?.();
    } catch (err) {
      setCancelMessage({ type: 'error', text: err.response?.data?.message || "Erreur lors de la reprise." });
    } finally {
      setCancelling(false);
    }
  };

  // Si un plan a été pré-sélectionné (ex: choisi depuis la landing page avant inscription),
  // lance automatiquement le paiement Stripe dès que les plans sont chargés.
  useEffect(() => {
    if (loading || !autoSelectPlanName || plans.length === 0 || paying) return;
    const match = plans.find((p) => p.name === autoSelectPlanName);
    if (match) {
      handleChoose(match);
      onAutoSelectDone?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, plans, autoSelectPlanName]);

  return (
    <div style={styles.page}>
      {/* Header */}
      <div style={styles.header}>
        <div style={styles.logo}>
          {onBack && (
            <button onClick={onBack} style={styles.backBtn} title="Retour au dashboard">
              <ArrowLeft size={18} />
            </button>
          )}
          <Crown size={22} color="#c9a24b" />
          <span style={styles.logoText}>Tonsor</span>
        </div>
        <div style={styles.headerRight}>
          <span style={styles.userBadge}>{user?.name}</span>
          {onLogout && (
            <button onClick={onLogout} style={styles.logoutBtn} title="Se déconnecter">
              <LogOut size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Hero */}
      <div style={styles.hero}>
        <div style={styles.heroBadge}>Abonnements</div>
        <h1 style={styles.heroTitle}>Choisissez votre plan</h1>
        <p style={styles.heroSub}>
          Gérez votre salon de coiffure avec les outils qu'il vous faut.
          {currentPlan && (
            <span style={{ color: '#f59e0b' }}> Plan actuel : <strong>{currentPlan}</strong></span>
          )}
        </p>

        {subscriptionStatus?.subscription?.is_recurring && (
          <div style={styles.recurringBox}>
            {subscriptionStatus.subscription.cancel_at_period_end ? (
              <>
                <p style={styles.recurringCancelled}>
                  Votre abonnement est annulé — accès conservé jusqu'au{' '}
                  <strong>{new Date(subscriptionStatus.subscription.ends_at).toLocaleDateString('fr-FR')}</strong>.
                </p>
                <button onClick={handleResumeSubscription} disabled={cancelling} style={styles.resumeSubBtn}>
                  <RefreshCw size={15} />
                  {cancelling ? 'Reprise...' : 'Reprendre mon abonnement'}
                </button>
              </>
            ) : (
              <button onClick={handleCancelSubscription} disabled={cancelling} style={styles.cancelSubBtn}>
                <XCircle size={15} />
                {cancelling ? 'Annulation...' : 'Annuler mon abonnement'}
              </button>
            )}
            {cancelMessage && (
              <p style={{ ...styles.cancelMessage, color: cancelMessage.type === 'error' ? '#dc2626' : '#166534' }}>
                {cancelMessage.text}
              </p>
            )}
          </div>
        )}

        {checkoutError && (
          <p style={{ ...styles.cancelMessage, color: '#dc2626', marginTop: 16 }}>{checkoutError}</p>
        )}
      </div>

      {ConfirmModal}

      {/* Cards */}
      {loading ? (
        <div style={styles.center}><Loader size={32} color="#c9a24b" style={{ animation: 'spin 1s linear infinite' }} /></div>
      ) : (
        <div style={styles.grid}>
          {plans.map((plan) => {
            const colors  = PLAN_COLORS[plan.name] || PLAN_COLORS.Basique;
            const Icon    = PLAN_ICONS[plan.name]  || Zap;
            const limits  = plan.limits  || {};
            const features = plan.features || [];
            const isPopular = plan.name === 'Pro';
            const isCurrent = currentPlan === plan.name;
            const isLoading = paying === plan.id;

            return (
              <div key={plan.id} style={{
                ...styles.card,
                border: `2px solid ${isPopular ? colors.accent : colors.border}`,
                background: isPopular ? colors.bg : '#ffffff',
                transform: isPopular ? 'scale(1.04)' : 'none',
              }}>
                {isPopular && (
                  <div style={{ ...styles.popularBadge, background: colors.accent }}>
                    Populaire
                  </div>
                )}

                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                  <div style={{ ...styles.iconBox, background: colors.bg, border: `1px solid ${colors.border}` }}>
                    <Icon size={22} color={colors.accent} />
                  </div>
                  <div>
                    <div style={{ ...styles.planName, color: colors.accent }}>{plan.name}</div>
                    <div style={styles.planDesc}>{plan.description}</div>
                  </div>
                </div>

                <div style={styles.price}>
                  <span style={{ ...styles.priceAmount, color: colors.accent }}>
                    {Number(plan.price).toLocaleString('fr-MA')}
                  </span>
                  <span style={styles.priceCurrency}> DH</span>
                  <span style={styles.pricePeriod}>/mois</span>
                </div>

                <div style={styles.divider} />

                {/* Limites */}
                <div style={styles.limits}>
                  <LimitRow label="Postes de coiffure" value={limits.max_machines} color={colors.accent} />
                  <LimitRow label="Agents"             value={limits.max_users}    color={colors.accent} />
                  <LimitRow label="Grâce"    value={`${plan.grace_days}j`} color={colors.accent} raw />
                </div>

                {/* Features */}
                {features.length > 0 && (
                  <ul style={styles.featureList}>
                    {features.map((f, i) => (
                      <li key={i} style={styles.featureItem}>
                        <Check size={14} color={colors.accent} style={{ flexShrink: 0 }} />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                )}

                <button
                  onClick={() => !isCurrent && handleChoose(plan)}
                  disabled={isCurrent || !!paying}
                  style={{
                    ...styles.btn,
                    background: isCurrent ? '#e8e2d8' : colors.accent,
                    color: isCurrent ? '#6b6155' : '#fff',
                    cursor: isCurrent || paying ? 'not-allowed' : 'pointer',
                    opacity: paying && !isLoading ? 0.6 : 1,
                  }}
                >
                  {isLoading ? (
                    <span style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center' }}>
                      <Loader size={16} /> Redirection...
                    </span>
                  ) : isCurrent ? 'Plan actuel' : 'Choisir ce plan'}
                </button>
              </div>
            );
          })}
        </div>
      )}

      <p style={styles.footer}>
        Paiement sécurisé par <strong>Stripe</strong> · Vous serez débité de 30 jours d'accès.<br />
        <span style={{ fontSize: 12, color: '#8a8070' }}>
          Montant facturé en DH (MAD)
        </span>
      </p>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function LimitRow({ label, value, color, raw }) {
  const display = raw ? value : (value === 0 ? 'Illimité' : value);
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
      <span style={{ color: '#6b6155' }}>{label}</span>
      <span style={{ color, fontWeight: 600 }}>{display}</span>
    </div>
  );
}

const styles = {
  page: {
    minHeight: '100vh',
    background: '#f7f5f2',
    color: '#1a1410',
    fontFamily: 'Inter, system-ui, sans-serif',
    padding: '0 0 60px',
  },
  header: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '18px 32px',
    borderBottom: '1px solid #e8e2d8',
    background: '#ffffff',
  },
  logo: { display: 'flex', alignItems: 'center', gap: 10 },
  backBtn: {
    background: 'transparent', border: '1px solid #d9d2c4', borderRadius: 8,
    color: '#6b6155', cursor: 'pointer', padding: '6px 8px', display: 'flex', alignItems: 'center',
    marginRight: 4,
  },
  logoText: { fontWeight: 800, fontSize: 18, letterSpacing: 1 },
  headerRight: { display: 'flex', alignItems: 'center', gap: 12 },
  userBadge: { fontSize: 13, color: '#6b6155', background: '#f3f0ea', padding: '4px 12px', borderRadius: 20 },
  logoutBtn: {
    background: 'transparent', border: '1px solid #d9d2c4', borderRadius: 8,
    color: '#6b6155', cursor: 'pointer', padding: '6px 8px', display: 'flex', alignItems: 'center',
  },
  hero: { textAlign: 'center', padding: '52px 20px 36px' },
  heroBadge: {
    display: 'inline-block', background: 'rgba(201, 162, 75,0.15)', color: '#ddbc73',
    border: '1px solid rgba(201, 162, 75,0.3)', borderRadius: 20,
    fontSize: 12, fontWeight: 600, padding: '4px 14px', marginBottom: 16, letterSpacing: 1,
  },
  heroTitle: { fontSize: 36, fontWeight: 800, margin: '0 0 12px', letterSpacing: -0.5 },
  heroSub: { fontSize: 16, color: '#6b6155', margin: 0 },
  recurringBox: { marginTop: 24, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 },
  recurringCancelled: {
    fontSize: 13, color: '#92400e', background: 'rgba(245, 158, 11, 0.12)',
    border: '1px solid rgba(245, 158, 11, 0.3)', borderRadius: 10, padding: '10px 18px', margin: 0,
  },
  cancelSubBtn: {
    display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 20px',
    background: 'transparent', color: '#dc2626', border: '1px solid #f3b4b4', borderRadius: 10,
    cursor: 'pointer', fontWeight: 600, fontSize: 13,
  },
  resumeSubBtn: {
    display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 20px',
    background: '#166534', color: '#fff', border: 'none', borderRadius: 10,
    cursor: 'pointer', fontWeight: 600, fontSize: 13,
  },
  cancelMessage: { fontSize: 13, margin: 0, fontWeight: 600 },
  center: { display: 'flex', justifyContent: 'center', padding: 60 },
  grid: {
    display: 'flex', flexWrap: 'wrap', gap: 24, justifyContent: 'center',
    padding: '0 24px', maxWidth: 1100, margin: '0 auto',
  },
  card: {
    flex: '1 1 300px', maxWidth: 360,
    borderRadius: 20, padding: '28px 24px',
    position: 'relative', transition: 'transform 0.2s',
  },
  popularBadge: {
    position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)',
    fontSize: 11, fontWeight: 700, color: '#fff',
    padding: '3px 14px', borderRadius: 20, letterSpacing: 0.5,
  },
  iconBox: { width: 44, height: 44, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  planName: { fontSize: 18, fontWeight: 800 },
  planDesc: { fontSize: 12, color: '#6b6155', marginTop: 2 },
  price: { margin: '16px 0 4px' },
  priceAmount: { fontSize: 36, fontWeight: 900 },
  priceCurrency: { fontSize: 20, fontWeight: 700, color: '#6b6155' },
  pricePeriod: { fontSize: 14, color: '#6b6155' },
  divider: { height: 1, background: '#e8e2d8', margin: '16px 0' },
  limits: { marginBottom: 12 },
  featureList: { listStyle: 'none', padding: 0, margin: '0 0 20px' },
  featureItem: { display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#4a4234', marginBottom: 8 },
  btn: {
    width: '100%', padding: '13px', borderRadius: 12, border: 'none',
    fontWeight: 700, fontSize: 15, marginTop: 8, transition: 'opacity 0.2s',
  },
  footer: { textAlign: 'center', color: '#8a8070', fontSize: 13, marginTop: 40 },
};

export default PricingPage;
