import { useEffect, useState } from 'react';
import { AlertTriangle, AlertCircle, Clock, X, Crown } from 'lucide-react';
import api from '../services/api';

/**
 * Banner displayed to admins showing their organization's subscription status.
 * Shows nothing when subscription is healthy (>7 days remaining).
 */
function SubscriptionBanner({ organizationId }) {
  const [status, setStatus] = useState(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    api.get('/subscription/status')
      .then(res => setStatus(res.data))
      .catch(() => {});
  }, []);

  if (!status || dismissed) return null;

  const { subscription, days_remaining, in_grace_period, grace_days_remaining, is_expired, is_active } = status;

  // No subscription at all — show a different message
  if (!subscription) return <NoBanner onDismiss={() => setDismissed(true)} />;

  // Show nothing when healthy: active, not expired, and more than 7 days left (or unlimited)
  if (is_active && !in_grace_period && !is_expired && (days_remaining === null || days_remaining > 7)) return null;

  if (is_expired && !in_grace_period) {
    return (
      <BannerWrap color="#dc2626" bg="#fef2f2" border="#fecaca" onDismiss={() => setDismissed(true)}>
        <AlertCircle size={18} />
        <span>
          <strong>Abonnement expiré.</strong> Votre accès sera limité. Contactez l'administrateur pour renouveler.
        </span>
      </BannerWrap>
    );
  }

  if (in_grace_period) {
    return (
      <BannerWrap color="#b45309" bg="#fffbeb" border="#fde68a" onDismiss={() => setDismissed(true)}>
        <AlertTriangle size={18} />
        <span>
          <strong>Période de grâce :</strong> votre abonnement a expiré.
          Il vous reste <strong>{grace_days_remaining} jour(s)</strong> avant le blocage.
          Contactez l'administrateur pour renouveler.
        </span>
      </BannerWrap>
    );
  }

  if (!is_active) {
    return (
      <BannerWrap color="#dc2626" bg="#fef2f2" border="#fecaca" onDismiss={() => setDismissed(true)}>
        <AlertCircle size={18} />
        <span>
          <strong>Abonnement suspendu.</strong> Contactez l'administrateur système.
        </span>
      </BannerWrap>
    );
  }

  // Expiring soon (≤7 days)
  if (days_remaining <= 7) {
    return (
      <BannerWrap color="#b45309" bg="#fffbeb" border="#fde68a" onDismiss={() => setDismissed(true)}>
        <Clock size={18} />
        <span>
          <strong>Abonnement bientôt expiré :</strong> expire dans <strong>{days_remaining} jour(s)</strong>.
          Pensez à renouveler.
        </span>
      </BannerWrap>
    );
  }

  return null;
}

function NoBanner({ onDismiss }) {
  return (
    <BannerWrap color="#6b6155" bg="#f3f0ea" border="#e8e2d8" onDismiss={onDismiss}>
      <Crown size={18} />
      <span>Aucun abonnement actif pour cette organisation. Contactez l'administrateur système.</span>
    </BannerWrap>
  );
}

function BannerWrap({ color, bg, border, onDismiss, children }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      padding: '12px 18px',
      background: bg,
      border: `1px solid ${border}`,
      borderRadius: '12px',
      color,
      fontSize: '14px',
      margin: '0 0 16px 0',
      flexWrap: 'wrap',
    }}>
      {children}
      <button
        onClick={onDismiss}
        style={{ marginLeft: 'auto', background: 'transparent', border: 'none', color, cursor: 'pointer', padding: '2px', display: 'flex', alignItems: 'center' }}
      >
        <X size={16} />
      </button>
    </div>
  );
}

export default SubscriptionBanner;
