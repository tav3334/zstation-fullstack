import { useCallback, useEffect, useState } from "react";
import {
  Gamepad2,
  Crown,
  User,
  BarChart3,
  LogOut,
  Check,
  Monitor,
  Zap,
  Clock,
  ChevronLeft,
  ChevronRight,
  LayoutDashboard,
  Play,
  Square,
  Scissors,
  ShoppingCart,
  History,
  Package
} from "lucide-react";
import api from "../services/api";
import SubscriptionBanner from "../components/SubscriptionBanner";
import MachineCard from "../components/MachineCard";
import StartSessionModal from "../components/StartSessionModal";
import PaymentModal from "../components/PaymentModal";
import StatsCard from "../components/StatsCard";
import Toast from "../components/Toast";
import SaleModal from "../components/SaleModal";
import PosPage from "./PosPage";
import SalesHistoryPage from "./SalesHistoryPage";
import SalonStockManagement from "./SalonStockManagement";
import MySalesSummary from "../components/MySalesSummary";
import { can } from "../utils/permissions";
import { clearReopenPos, shouldReopenPos } from "../utils/session";
import UserProfile from "../components/UserProfile";
import MatchCountModal from "../components/MatchCountModal";

function Dashboard({ user, onLogout, onUserUpdated }) {
  const [machines, setMachines] = useState([]);
  const [games, setGames] = useState([]);
  const [selectedMachine, setSelectedMachine] = useState(null);
  const [selectedGame, setSelectedGame] = useState("");
  const [selectedPricing, setSelectedPricing] = useState("");
  const [paymentSessions, setPaymentSessions] = useState([]);
  const [activeTab, setActiveTab] = useState('machines');
  const [showSale, setShowSale] = useState(false);
  const [showPos, setShowPos] = useState(shouldReopenPos);
  const [showHistory, setShowHistory] = useState(false);
  const [showStock, setShowStock] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [toast, setToast] = useState(null);
  const [matchCountSession, setMatchCountSession] = useState(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Drapeau « rouvrir la caisse » posé par un changement de caissier : à usage unique
  useEffect(() => {
    clearReopenPos();
  }, []);

  // Helper pour afficher un toast
  const showToast = useCallback((message, type = "info", duration = 3000) => {
    setToast({ message, type, duration });
  }, []);

  // Horloge temps réel
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Set default theme on mount
  useEffect(() => {
    if (!localStorage.getItem("theme")) {
      document.documentElement.setAttribute("data-theme", "light");
      localStorage.setItem("theme", "light");
    }
  }, []);

  // ================= LOAD DATA =================
  const loadMachines = useCallback(async () => {
    try {
      const res = await api.get("/machines");
      setMachines(res.data);
    } catch (e) {
      showToast("Erreur chargement machines: " + (e.response?.data?.message || e.message), "error");
    }
  }, [showToast]);

  const loadGames = useCallback(async () => {
    try {
      const res = await api.get("/games");

      if (!res.data || res.data.length === 0) {
        showToast("Aucun jeu disponible. Ajoutez des jeux dans la base de données.", "warning");
      }

      setGames(res.data);
    } catch (e) {
      showToast("Erreur chargement jeux: " + (e.response?.data?.message || e.message), "error");
    }
  }, [showToast]);

  useEffect(() => {
    queueMicrotask(() => {
      loadMachines();
      loadGames();
    });

    // Recharger les machines toutes les 10 secondes
    const machineInterval = setInterval(loadMachines, 10000);

    // Vérifier l'auto-stop toutes les 30 secondes
    const autoStopInterval = setInterval(async () => {
      try {
        await api.get('/sessions/check-auto-stop');
        await loadMachines(); // Recharger après auto-stop
      } catch {
        // Ignore polling errors; next interval will retry.
      }
    }, 30000);

    return () => {
      clearInterval(machineInterval);
      clearInterval(autoStopInterval);
    };
  }, [loadGames, loadMachines]);

  // ================= START SESSION =================
  const startSession = async () => {
    if (!selectedMachine || !selectedGame || !selectedPricing) {
      showToast("Veuillez sélectionner machine, jeu et durée", "warning");
      return;
    }

    try {
      await api.post("/sessions/start", {
        machine_id: selectedMachine.id,
        game_id: Number(selectedGame),
        game_pricing_id: Number(selectedPricing),
        customer_id: null,
      });

      showToast("Session démarrée avec succès!", "success");

      // Reset modal
      setSelectedMachine(null);
      setSelectedGame("");
      setSelectedPricing("");

      // Reload machines
      await loadMachines();
    } catch (e) {
      showToast("Erreur démarrage session: " + (e.response?.data?.message || e.message), "error");
    }
  };

  // ================= STOP SESSION =================
  const stopSession = async (sessionId) => {
    try {
      // Récupérer les informations de la session d'abord
      const sessionResponse = await api.get(`/sessions/status/${sessionId}`);
      const sessionStatus = sessionResponse.data;

      // Vérifier si c'est une session par match
      if (sessionStatus.pricing_mode === 'per_match') {
        // Demander le nombre de matchs via le modal
        setMatchCountSession({
          id: sessionId,
          game: { name: sessionStatus.machine || 'FIFA/PES' },
          gamePricing: {
            price: parseFloat(sessionStatus.price_per_match) || 6
          }
        });
        return;
      }

      // Mode par temps: arrêter normalement
      const res = await api.post(`/sessions/stop/${sessionId}`);

      // Ajouter le modal de paiement à la liste (permet plusieurs modals simultanés)
      setPaymentSessions(prev => [...prev, res.data]);
      await loadMachines();
    } catch (e) {
      showToast("Erreur arrêt session: " + (e.response?.data?.message || e.message), "error");
    }
  };

  // ================= STOP SESSION WITH MATCH COUNT =================
  const stopSessionWithMatchCount = async (matchCount) => {
    if (!matchCountSession) return;

    try {
      const res = await api.post(`/sessions/stop/${matchCountSession.id}`, {
        matches_played: matchCount
      });

      // Fermer le modal de saisie de matchs
      setMatchCountSession(null);

      // Ajouter le modal de paiement à la liste
      setPaymentSessions(prev => [...prev, res.data]);
      await loadMachines();
    } catch (e) {
      showToast("Erreur arrêt session: " + (e.response?.data?.message || e.message), "error");
      setMatchCountSession(null);
    }
  };

  // ================= PROCESS PAYMENT =================
  const processPayment = async (sessionId, amountGiven) => {
    try {
      const res = await api.post('/payments', {
        session_id: sessionId,
        amount_given: amountGiven
      });

      const receipt = res.data.receipt;

      if (!receipt) {
        showToast("Erreur: Reçu non généré par le serveur", "error");
        return;
      }

      showToast(`Paiement enregistré avec succès! Montant: ${receipt.amount} - Monnaie: ${receipt.change}`, "success", 5000);

      // Retirer ce modal de la liste
      setPaymentSessions(prev => prev.filter(ps => ps.session.id !== sessionId));
      await loadMachines();
    } catch (e) {
      showToast("Erreur paiement: " + (e.response?.data?.message || e.message), "error");
    }
  };

  // ================= EXTEND SESSION =================
  const extendSession = async (sessionId, pricingId) => {
    try {
      const res = await api.post(`/sessions/extend/${sessionId}`, {
        game_pricing_id: pricingId
      });

      showToast(`Session prolongée avec succès. Total payé: ${res.data.total_paid} DH`, "success");
      await loadMachines();
    } catch (e) {
      showToast("Erreur prolongation: " + (e.response?.data?.message || e.message), "error");
    }
  };

  // Calculer les stats en temps réel
  const activeSessions = machines.filter(m => m.status === 'in_session').length;
  const availableMachines = machines.filter(m => m.status === 'available').length;

  // Menu items — "Machines" masqué si le module Gaming n'est pas activé pour l'organisation
  const modules = user?.modules || { gaming: true, coiffure: true, stock: true };
  const menuItems = [
    modules.gaming && { id: 'machines', label: 'Machines', icon: Monitor, count: machines.length },
    { id: 'pos', label: 'Caisse', icon: ShoppingCart },
    { id: 'sale', label: 'Vente', icon: Scissors },
    { id: 'history', label: can(user, 'view_all_sales') ? 'Ventes' : 'Mes ventes', icon: History },
    modules.stock && can(user, 'access_stock') && { id: 'stock', label: 'Stock', icon: Package },
    { id: 'stats', label: 'Statistiques', icon: BarChart3 },
    { id: 'profile', label: 'Mon Profil', icon: User },
  ].filter(Boolean);

  if (showHistory) {
    return <SalesHistoryPage onBack={() => setShowHistory(false)} user={user} />;
  }

  if (showStock) {
    return <SalonStockManagement onBack={() => setShowStock(false)} />;
  }

  if (showPos) {
    return <PosPage user={user} onBack={() => setShowPos(false)} />;
  }

  // ================= RENDER =================
  return (
    <div className="z-app-container" style={styles.appContainer}>
      {/* Toast Notification */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          duration={toast.duration}
          onClose={() => setToast(null)}
        />
      )}

      {/* Sidebar */}
      <aside style={{
        ...styles.sidebar,
        width: sidebarCollapsed ? '70px' : '240px'
      }}>
        {/* Logo */}
        <div style={styles.sidebarHeader}>
          <div style={styles.logoBox}>
            <svg width="26" height="26" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="9" cy="23" r="4" stroke="#fff" strokeWidth="2.2"/>
              <circle cx="23" cy="23" r="4" stroke="#fff" strokeWidth="2.2"/>
              <path d="M11.5 20.5L25 7" stroke="#fff" strokeWidth="2.2" strokeLinecap="round"/>
              <path d="M20 20.5L6.5 7" stroke="#fff" strokeWidth="2.2" strokeLinecap="round"/>
            </svg>
          </div>
          {!sidebarCollapsed && (
            <div style={styles.logoText}>
              <span style={styles.logoTitle}>Tonsor</span>
              <span style={styles.logoSubtitle}>Point de Vente</span>
            </div>
          )}
        </div>

        {/* Menu Items */}
        <nav style={styles.sidebarNav}>
          {menuItems.map(item => (
            <button
              key={item.id}
              style={{
                ...styles.menuItem,
                ...(activeTab === item.id && styles.menuItemActive)
              }}
              onClick={() => {
                if (item.id === 'sale') {
                  setShowSale(true);
                } else if (item.id === 'history') {
                  setShowHistory(true);
                } else if (item.id === 'stock') {
                  setShowStock(true);
                } else if (item.id === 'pos') {
                  setShowPos(true);
                } else if (item.id === 'profile') {
                  setShowProfile(true);
                } else {
                  setActiveTab(item.id);
                }
              }}
            >
              <item.icon size={20} />
              {!sidebarCollapsed && (
                <>
                  <span style={styles.menuLabel}>{item.label}</span>
                  {item.count !== undefined && (
                    <span style={styles.menuBadge}>{item.count}</span>
                  )}
                </>
              )}
            </button>
          ))}
        </nav>

        {/* Sidebar Footer */}
        <div style={styles.sidebarFooter}>
          <button
            style={styles.collapseBtn}
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          >
            {sidebarCollapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
          </button>
        </div>
      </aside>

      {/* Main Area */}
      <div className="z-main-area" style={{...styles.mainArea, marginLeft: sidebarCollapsed ? '70px' : '240px'}}>
        {/* Top Bar */}
        <header className="z-top-bar" style={styles.topBar}>
          <div style={styles.topBarLeft}>
            <h1 style={styles.pageTitle}>
              {activeTab === 'machines' ? 'Gestion des Machines' : 'Statistiques de Vente'}
            </h1>
          </div>
          <div style={styles.topBarRight}>
            <div style={styles.clockDisplay}>
              <Clock size={16} />
              <span>{currentTime.toLocaleTimeString('fr-FR')}</span>
            </div>
            <div style={styles.userPill}>
              <div style={styles.userAvatarSmall}>
                {user.name?.charAt(0).toUpperCase()}
              </div>
              {user.role === "agent" ? <User size={14} style={{color: '#6b6155'}} /> : <Crown size={14} style={{color: '#f59e0b'}} />}
              <span style={styles.userNameSmall}>{user.name}</span>
            </div>
            <button style={styles.logoutBtnSmall} onClick={onLogout}>
              <LogOut size={18} />
            </button>
          </div>
        </header>

        {/* Quick Stats Bar */}
        <div className="z-stats-row" style={styles.statsRow}>
          <div style={{...styles.miniStatCard, borderLeft: '4px solid #10b981'}}>
            <div style={{...styles.miniStatIcon, background: 'rgba(16, 185, 129, 0.15)'}}>
              <Check size={20} color="#10b981" />
            </div>
            <div style={styles.miniStatInfo}>
              <div style={styles.miniStatValue}>{availableMachines}</div>
              <div style={styles.miniStatLabel}>Disponibles</div>
            </div>
          </div>

          <div style={{...styles.miniStatCard, borderLeft: '4px solid #f59e0b'}}>
            <div style={{...styles.miniStatIcon, background: 'rgba(245, 158, 11, 0.15)'}}>
              <Play size={20} color="#f59e0b" />
            </div>
            <div style={styles.miniStatInfo}>
              <div style={styles.miniStatValue}>{activeSessions}</div>
              <div style={styles.miniStatLabel}>Sessions actives</div>
            </div>
          </div>

          <div style={{...styles.miniStatCard, borderLeft: '4px solid #c9a24b'}}>
            <div style={{...styles.miniStatIcon, background: 'rgba(201, 162, 75, 0.15)'}}>
              <Monitor size={20} color="#c9a24b" />
            </div>
            <div style={styles.miniStatInfo}>
              <div style={styles.miniStatValue}>{machines.length}</div>
              <div style={styles.miniStatLabel}>Total machines</div>
            </div>
          </div>

          <div style={{...styles.miniStatCard, borderLeft: '4px solid #e0b85c'}}>
            <div style={{...styles.miniStatIcon, background: 'rgba(224, 184, 92, 0.15)'}}>
              <Gamepad2 size={20} color="#e0b85c" />
            </div>
            <div style={styles.miniStatInfo}>
              <div style={styles.miniStatValue}>{games.length}</div>
              <div style={styles.miniStatLabel}>Jeux disponibles</div>
            </div>
          </div>
        </div>

        {/* Content */}
        <main className="z-content" style={styles.content}>
          <SubscriptionBanner organizationId={user?.organization_id} />
          {activeTab === 'stats' ? (
            <>
              <div style={{ ...styles.dashboardCard, marginBottom: '20px' }}>
                <div style={styles.cardHeader}>
                  <h3 style={styles.cardTitle}>
                    <User size={18} /> Mes ventes du jour
                  </h3>
                </div>
                <div style={styles.cardBody}>
                  <MySalesSummary />
                </div>
              </div>
              <div style={styles.dashboardCard}>
                <div style={styles.cardHeader}>
                  <h3 style={styles.cardTitle}>
                    <BarChart3 size={18} /> Statistiques de vente
                  </h3>
                </div>
                <div style={styles.cardBody}>
                  <StatsCard />
                </div>
              </div>
            </>
          ) : (
            <>
              {machines.length === 0 ? (
                <div style={styles.emptyState}>
                  <Monitor size={64} color="#6b6155" />
                  <p>Chargement des machines...</p>
                </div>
              ) : (
                <div className="agent-machines-grid z-machines-grid" style={styles.machinesGrid}>
                  {machines.map((machine) => (
                    <MachineCard
                      key={machine.id}
                      machine={machine}
                      onStart={() => setSelectedMachine(machine)}
                      onStop={stopSession}
                      onExtend={extendSession}
                      games={games}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </main>
      </div>

      {/* Modals */}
      {selectedMachine && (
        <StartSessionModal
          machine={selectedMachine}
          games={games}
          selectedGame={selectedGame}
          setSelectedGame={setSelectedGame}
          selectedPricing={selectedPricing}
          setSelectedPricing={setSelectedPricing}
          onConfirm={startSession}
          onClose={() => {
            setSelectedMachine(null);
            setSelectedGame("");
            setSelectedPricing("");
          }}
        />
      )}

      {matchCountSession && (
        <MatchCountModal
          session={matchCountSession}
          onConfirm={stopSessionWithMatchCount}
          onClose={() => setMatchCountSession(null)}
        />
      )}

      {paymentSessions.map((paymentSession, index) => (
        <PaymentModal
          key={paymentSession.session.id}
          session={paymentSession}
          onConfirm={processPayment}
          onClose={() => setPaymentSessions(prev => prev.filter(ps => ps.session.id !== paymentSession.session.id))}
          zIndex={2000 + index * 10}
        />
      ))}

      {showSale && (
        <SaleModal
          onClose={() => setShowSale(false)}
          onSale={(message, type = "success") => {
            showToast(message, type);
          }}
          modules={modules}
        />
      )}

      {showProfile && (
        <UserProfile
          user={user}
          onClose={() => setShowProfile(false)}
          showToast={showToast}
          onUserUpdated={onUserUpdated}
        />
      )}

      {/* Bottom Navigation - Mobile only */}
      <nav className="z-bottom-nav">
        {menuItems.map(item => (
          <button
            key={item.id}
            className={`z-bottom-nav-item${activeTab === item.id ? ' active' : ''}`}
            onClick={() => {
              if (item.id === 'products') {
                setShowProducts(true);
              } else if (item.id === 'sale') {
                setShowSale(true);
              } else if (item.id === 'history') {
                setShowHistory(true);
              } else if (item.id === 'stock') {
                setShowStock(true);
              } else if (item.id === 'pos') {
                setShowPos(true);
              } else if (item.id === 'profile') {
                setShowProfile(true);
              } else {
                setActiveTab(item.id);
              }
            }}
          >
            <item.icon size={22} />
            <span>{item.label}</span>
          </button>
        ))}
        <button
          className="z-bottom-nav-item"
          onClick={onLogout}
          style={{ color: '#ef4444' }}
        >
          <LogOut size={22} />
          <span>Déconnexion</span>
        </button>
      </nav>
    </div>
  );
}

// ================= STYLES =================
const styles = {
  // App Layout
  appContainer: {
    display: 'flex',
    minHeight: '100vh',
    background: '#f7f5f2',
    width: '100%'
  },

  // Sidebar
  sidebar: {
    background: '#ffffff',
    borderRight: '1px solid #e8e2d8',
    display: 'flex',
    flexDirection: 'column',
    transition: 'width 0.3s ease',
    position: 'fixed',
    height: '100vh',
    zIndex: 100
  },
  sidebarHeader: {
    padding: '20px',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    borderBottom: '1px solid #e8e2d8'
  },
  logoBox: {
    width: '40px',
    height: '40px',
    background: 'linear-gradient(135deg, #e0b85c, #c9a24b)',
    borderRadius: '10px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    boxShadow: '0 0 20px rgba(201, 162, 75, 0.4)'
  },
  logoText: {
    display: 'flex',
    flexDirection: 'column'
  },
  logoTitle: {
    color: '#1a1410',
    fontWeight: '800',
    fontSize: '16px'
  },
  logoSubtitle: {
    color: '#6b6155',
    fontSize: '11px',
    fontWeight: '500'
  },
  sidebarNav: {
    flex: 1,
    padding: '12px',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px'
  },
  menuItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '12px 14px',
    borderRadius: '10px',
    border: 'none',
    background: 'transparent',
    color: '#6b6155',
    cursor: 'pointer',
    transition: 'all 0.2s',
    width: '100%',
    textAlign: 'left',
    fontSize: '14px',
    fontWeight: '500'
  },
  menuItemActive: {
    background: '#c9a24b',
    color: '#fff'
  },
  menuLabel: {
    flex: 1
  },
  menuBadge: {
    background: '#f3f0ea',
    color: '#6b6155',
    padding: '2px 8px',
    borderRadius: '10px',
    fontSize: '12px',
    fontWeight: '600'
  },
  sidebarFooter: {
    padding: '12px',
    borderTop: '1px solid #e8e2d8'
  },
  collapseBtn: {
    width: '100%',
    padding: '10px',
    background: '#f3f0ea',
    border: 'none',
    borderRadius: '8px',
    color: '#6b6155',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.2s'
  },

  // Main Area
  mainArea: {
    flex: 1,
    marginLeft: '240px',
    transition: 'margin-left 0.3s ease',
    display: 'flex',
    flexDirection: 'column',
    minHeight: '100vh'
  },

  // Top Bar
  topBar: {
    background: '#ffffff',
    padding: '16px 24px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottom: '1px solid #e8e2d8',
    position: 'sticky',
    top: 0,
    zIndex: 50
  },
  topBarLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px'
  },
  pageTitle: {
    margin: 0,
    fontSize: '20px',
    fontWeight: '700',
    color: '#1a1410'
  },
  topBarRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px'
  },
  clockDisplay: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    color: '#6b6155',
    fontSize: '14px',
    fontWeight: '500'
  },
  userPill: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    background: '#f3f0ea',
    padding: '6px 12px 6px 6px',
    borderRadius: '20px'
  },
  userAvatarSmall: {
    width: '28px',
    height: '28px',
    borderRadius: '50%',
    background: '#c9a24b',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '12px',
    fontWeight: '700'
  },
  userNameSmall: {
    color: '#1a1410',
    fontSize: '13px',
    fontWeight: '500'
  },
  logoutBtnSmall: {
    padding: '8px',
    background: '#ef4444',
    border: 'none',
    borderRadius: '8px',
    color: '#fff',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.2s'
  },

  // Stats Row
  statsRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: '16px',
    padding: '20px 24px',
    background: '#f7f5f2'
  },
  miniStatCard: {
    background: 'linear-gradient(160deg, #ffffff 0%, #f9f7f3 100%)',
    borderRadius: '14px',
    padding: '16px',
    border: '1px solid #e8e2d8',
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
    transition: 'transform 0.2s ease, box-shadow 0.2s ease'
  },
  miniStatIcon: {
    width: '46px',
    height: '46px',
    borderRadius: '12px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0
  },
  miniStatInfo: {
    display: 'flex',
    flexDirection: 'column'
  },
  miniStatValue: {
    fontSize: '24px',
    fontWeight: '800',
    color: '#1a1410'
  },
  miniStatLabel: {
    fontSize: '12px',
    color: '#6b6155',
    fontWeight: '500'
  },

  // Content
  content: {
    flex: 1,
    padding: '24px',
    overflowY: 'auto',
    background: '#f7f5f2'
  },

  // Dashboard Cards
  dashboardCard: {
    background: '#ffffff',
    borderRadius: '16px',
    border: '1px solid #e8e2d8',
    overflow: 'hidden'
  },
  cardHeader: {
    padding: '16px 20px',
    borderBottom: '1px solid #e8e2d8',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  cardTitle: {
    margin: 0,
    fontSize: '16px',
    fontWeight: '600',
    color: '#1a1410',
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  },
  cardBody: {
    padding: '20px'
  },

  // Machines Grid
  machinesGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
    gap: '20px'
  },

  // Empty State
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '16px',
    padding: '60px 24px',
    color: '#6b6155',
    fontSize: '16px'
  }
};

// Add comprehensive responsive styles
const styleSheet = document.createElement("style");
styleSheet.textContent = `
  /* Prevent horizontal scroll */
  body, html {
    overflow-x: hidden !important;
    max-width: 100vw !important;
  }

  /* Mini stat card hover */
  .z-stats-row > div:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
  }

  /* Machines grid */
  .agent-machines-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
    gap: 20px;
    width: 100%;
    max-width: 100%;
  }

  /* ========== TABLET (1024px and below) ========== */
  @media (max-width: 1024px) {
    .agent-machines-grid {
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)) !important;
    }
  }

  /* ========== MOBILE (768px and below) ========== */
  @media (max-width: 768px) {
    /* Hide sidebar on mobile */
    aside {
      display: none !important;
    }

    /* Full width main area */
    div[style*="marginLeft"] {
      margin-left: 0 !important;
    }

    /* Stats row */
    div[style*="gridTemplateColumns: repeat(4"] {
      grid-template-columns: repeat(2, 1fr) !important;
      padding: 16px !important;
      gap: 12px !important;
    }

    /* Top bar */
    header[style*="topBar"] {
      flex-wrap: wrap !important;
      gap: 12px !important;
      padding: 12px 16px !important;
    }

    /* Page title */
    h1 {
      font-size: 18px !important;
    }

    /* Machines grid - single column */
    .agent-machines-grid {
      grid-template-columns: 1fr !important;
      gap: 16px !important;
    }

    /* Content padding */
    main {
      padding: 16px !important;
    }
  }

  /* ========== SMALL MOBILE (480px and below) ========== */
  @media (max-width: 480px) {
    /* Stats row - 2 columns */
    div[style*="gridTemplateColumns: repeat(4"] {
      grid-template-columns: repeat(2, 1fr) !important;
      padding: 12px !important;
      gap: 10px !important;
    }

    /* Stat cards smaller */
    div[style*="miniStatCard"] {
      padding: 12px !important;
    }

    div[style*="miniStatValue"] {
      font-size: 20px !important;
    }

    /* Top bar */
    header {
      padding: 10px 12px !important;
    }

    h1 {
      font-size: 16px !important;
    }

    /* Content */
    main {
      padding: 12px !important;
    }
  }
`;

// Only append once
if (!document.getElementById('agent-dashboard-responsive-styles')) {
  styleSheet.id = 'agent-dashboard-responsive-styles';
  document.head.appendChild(styleSheet);
}

export default Dashboard;
