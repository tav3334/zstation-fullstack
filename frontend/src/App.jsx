import { useState, useEffect, lazy, Suspense } from 'react';
import './App.css';
import api from './services/api';
import { AlertCircle, Crown, LogOut } from 'lucide-react';

// Lazy load pages for better performance
const LandingPage = lazy(() => import('./pages/LandingPage'));
const Login = lazy(() => import('./pages/Login'));
const SignupPage = lazy(() => import('./pages/SignupPage'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));
const SuperAdminDashboard = lazy(() => import('./pages/SuperAdminDashboard'));
const PricingPage = lazy(() => import('./pages/PricingPage'));
const PaymentResult = lazy(() => import('./pages/PaymentResult'));

// Loading component
const LoadingScreen = () => (
  <div style={{
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #c9a24b 0%, #8a6a26 100%)',
    color: '#fff'
  }}>
    <div style={{
      width: '50px',
      height: '50px',
      border: '4px solid rgba(255,255,255,0.3)',
      borderTop: '4px solid #fff',
      borderRadius: '50%',
      animation: 'spin 1s linear infinite'
    }}></div>
    <h2 style={{ marginTop: '20px' }}>Chargement...</h2>
    <style>{`
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
    `}</style>
  </div>
);

// Shown to admins/agents when their org subscription is fully expired (post grace)
const SubscriptionBlockedScreen = ({ user, onLogout, onRenew }) => (
  <div style={{
    display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center',
    minHeight: '100vh', background: '#f7f5f2', color: '#1a1410', padding: '40px', textAlign: 'center'
  }}>
    <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'rgba(239,68,68,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '24px' }}>
      <AlertCircle size={40} color="#ef4444" />
    </div>
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
      <Crown size={20} color="#c9a24b" />
      <h1 style={{ margin: 0, fontSize: '28px', fontWeight: 800 }}>Abonnement expiré</h1>
    </div>
    <p style={{ color: '#6b6155', fontSize: '16px', maxWidth: '440px', lineHeight: 1.7, margin: '0 0 32px' }}>
      L'abonnement de votre organisation a expiré et la période de grâce est terminée.
      Contactez votre administrateur système pour renouveler l'accès.
    </p>
    <div style={{ color: '#6b6155', fontSize: '14px', marginBottom: '32px' }}>
      Connecté en tant que <strong style={{ color: '#1a1410' }}>{user?.name}</strong>
    </div>
    <div style={{ display: 'flex', gap: '12px' }}>
      <button
        onClick={onLogout}
        style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 28px', background: '#e8e2d8', color: '#1a1410', border: 'none', borderRadius: '12px', cursor: 'pointer', fontWeight: 600, fontSize: '14px' }}
      >
        <LogOut size={16} /> Se déconnecter
      </button>
      {(user?.role === 'admin') && (
        <button
          onClick={onRenew}
          style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 28px', background: '#c9a24b', color: '#fff', border: 'none', borderRadius: '12px', cursor: 'pointer', fontWeight: 600, fontSize: '14px' }}
        >
          <Crown size={16} /> Renouveler mon abonnement
        </button>
      )}
    </div>
  </div>
);

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [subscriptionBlocked, setSubscriptionBlocked] = useState(false);
  const [subscriptionStatus, setSubscriptionStatus] = useState(null);
  // 'pricing' | 'payment_success' | 'payment_cancel' | null
  const [screen, setScreen] = useState(() => {
    const path = window.location.pathname;
    if (path === '/payment/success') return 'payment_success';
    if (path === '/payment/cancel')  return 'payment_cancel';
    return null;
  });
  const [checkoutSessionId] = useState(() => new URLSearchParams(window.location.search).get('session_id'));
  const [showLoginForm, setShowLoginForm] = useState(() => window.location.pathname === '/login');
  const [showSignupForm, setShowSignupForm] = useState(false);
  const [pendingPlanName, setPendingPlanName] = useState(null);

  useEffect(() => {
    const init = async () => {
      const token = localStorage.getItem('token');
      const savedUser = localStorage.getItem('user');
      if (token && savedUser) {
        try {
          api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
          let parsedUser = JSON.parse(savedUser);
          // Rôle, permissions et code PIN ont pu changer depuis la dernière connexion
          try {
            const meRes = await api.get('/me');
            parsedUser = { ...parsedUser, ...meRes.data.user };
            localStorage.setItem('user', JSON.stringify(parsedUser));
          } catch {
            // hors ligne ou erreur ponctuelle : on garde l'utilisateur en cache (un 401 déconnecte déjà)
          }
          setUser(parsedUser);
          // Après un retour Stripe (succès/annulation), laisser PaymentResult gérer
          // la vérification/activation — ne pas court-circuiter l'écran avec le
          // statut d'abonnement, qui peut ne pas encore refléter le paiement.
          const path = window.location.pathname;
          if (path !== '/payment/success' && path !== '/payment/cancel') {
            await checkSubscription(parsedUser);
          }
        } catch {
          localStorage.removeItem('token');
          localStorage.removeItem('user');
        }
      }
      setLoading(false);
    };
    init();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const checkSubscription = async (userData) => {
    if (userData.role === 'super_admin' || !userData.organization_id) return;
    try {
      const res = await api.get('/subscription/status');
      const status = res.data;
      setSubscriptionStatus(status);
      if (!status.subscription) {
        // Aucun abonnement du tout → page pricing pour en choisir un
        setScreen('pricing');
      } else if (status.is_blocked) {
        setSubscriptionBlocked(true);
      } else if (!status.is_active || status.is_expired) {
        // Expiré ou suspendu mais encore en grâce → page pricing pour renouveler
        setScreen('pricing');
      }
    } catch {
      // pas de blocage si l'endpoint échoue
    }
  };

  const handleLogin = async (userData) => {
    setLoading(true);
    await checkSubscription(userData);
    setUser(userData);
    setLoading(false);
  };

  const handleSignupSuccess = async (userData) => {
    setLoading(true);
    await checkSubscription(userData);
    setUser(userData);
    setShowSignupForm(false);
    setLoading(false);
  };

  const handleLogout = async () => {
    try { await api.post('/logout'); } catch { void 0; }
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    delete api.defaults.headers.common['Authorization'];
    setUser(null);
    setSubscriptionBlocked(false);
    setSubscriptionStatus(null);
    setScreen(null);
    setShowLoginForm(false);
    setShowSignupForm(false);
    setPendingPlanName(null);
    window.history.replaceState({}, '', '/');
  };

  const handlePaymentContinue = async () => {
    window.history.replaceState({}, '', '/');
    setScreen(null);
    // Recharger le statut abonnement après paiement réussi
    if (user) await checkSubscription(user);
  };

  if (loading) return <LoadingScreen />;

  return (
    <Suspense fallback={<LoadingScreen />}>
      {!user ? (
        showLoginForm ? (
          <Login
            onLogin={handleLogin}
            onBack={() => { setShowLoginForm(false); window.history.replaceState({}, '', '/'); }}
          />
        ) : showSignupForm ? (
          <SignupPage
            planName={pendingPlanName}
            onSignup={handleSignupSuccess}
            onBack={() => { setShowSignupForm(false); setPendingPlanName(null); window.history.replaceState({}, '', '/'); }}
            onGoToLogin={() => { setShowSignupForm(false); setShowLoginForm(true); window.history.replaceState({}, '', '/login'); }}
          />
        ) : (
          <LandingPage
            onLoginClick={() => { setShowLoginForm(true); window.history.replaceState({}, '', '/login'); }}
            onSelectPlan={(planName) => { setPendingPlanName(planName); setShowSignupForm(true); window.history.replaceState({}, '', '/signup'); }}
          />
        )
      ) : screen === 'payment_success' ? (
        <PaymentResult type="success" sessionId={checkoutSessionId} onContinue={handlePaymentContinue} />
      ) : screen === 'payment_cancel' ? (
        <PaymentResult type="cancel" onContinue={handlePaymentContinue} />
      ) : subscriptionBlocked ? (
        <SubscriptionBlockedScreen user={user} onLogout={handleLogout} onRenew={() => { setSubscriptionBlocked(false); setScreen('pricing'); }} />
      ) : screen === 'pricing' ? (
        <PricingPage
          user={user}
          onLogout={handleLogout}
          currentPlan={subscriptionStatus?.subscription?.plan?.name}
          subscriptionStatus={subscriptionStatus}
          onSubscriptionChanged={() => user && checkSubscription(user)}
          autoSelectPlanName={pendingPlanName}
          onAutoSelectDone={() => setPendingPlanName(null)}
        />
      ) : user.role === 'super_admin' ? (
        <SuperAdminDashboard user={user} onLogout={handleLogout} onUserUpdated={(u) => setUser((prev) => ({ ...prev, ...u }))} />
      ) : user.role === 'admin' ? (
        <AdminDashboard user={user} onLogout={handleLogout} onUserUpdated={(u) => setUser((prev) => ({ ...prev, ...u }))} />
      ) : (
        <Dashboard user={user} onLogout={handleLogout} onUserUpdated={(u) => setUser((prev) => ({ ...prev, ...u }))} />
      )}
    </Suspense>
  );
}

export default App;
