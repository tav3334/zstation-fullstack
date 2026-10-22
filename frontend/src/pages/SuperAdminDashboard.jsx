import { useCallback, useEffect, useState } from 'react';
import {
  Users, Monitor, Gamepad2, LogOut, Search, Plus,
  Edit2, Trash2, X, AlertCircle, Activity,
  Download, RefreshCw, LayoutDashboard,
  ChevronLeft, ChevronRight, Zap, Wifi, WifiOff, Clock,
  TrendingUp, DollarSign, PlayCircle, Calendar, Building2, Crown,
  Scissors, Package, History, ArrowLeftRight, User
} from 'lucide-react';
import api from '../services/api';
import Toast from '../components/Toast';
import SuperAdminGames from './SuperAdminGames';
import SuperAdminOrganizations from './SuperAdminOrganizations';
import SuperAdminSubscriptions from './SuperAdminSubscriptions';
import ServicesManagement from './ServicesManagement';
import CoiffeursManagement from './CoiffeursManagement';
import SalonStockManagement from './SalonStockManagement';
import SalesHistoryPage from './SalesHistoryPage';
import StockMovementsPage from './StockMovementsPage';
import UserProfile from '../components/UserProfile';
import SuperAdminInvoices from './SuperAdminInvoices';
import '../styles/superadmin.module.css';

function SuperAdminDashboard({ user, onLogout, onUserUpdated }) {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [showGamesManagement, setShowGamesManagement] = useState(false);
  const [showOrganizationsManagement, setShowOrganizationsManagement] = useState(false);
  const [showSubscriptionsManagement, setShowSubscriptionsManagement] = useState(false);
  const [showServicesManagement, setShowServicesManagement] = useState(false);
  const [showCoiffeursManagement, setShowCoiffeursManagement] = useState(false);
  const [showSalonStock, setShowSalonStock] = useState(false);
  const [showSalesHistoryPage, setShowSalesHistoryPage] = useState(false);
  const [showStockMovements, setShowStockMovements] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showInvoices, setShowInvoices] = useState(false);
  const [toast, setToast] = useState(null);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Horloge temps réel
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // États pour les données
  const [users, setUsers] = useState([]);
  const [machines, setMachines] = useState([]);
  const [games, setGames] = useState([]);

  // États pour les statistiques
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalMachines: 0,
    totalGames: 0,
    activeUsers: 0
  });

  // États pour les statistiques avancées
  const [dashboardStats, setDashboardStats] = useState({
    sessions_today: 0,
    active_sessions: 0,
    revenue_today: 0,
    revenue_month: 0,
    total_completed_sessions: 0,
    machines_available: 0,
    machines_occupied: 0
  });

  // États pour les modals
  const [showUserModal, setShowUserModal] = useState(false);
  const [showMachineModal, setShowMachineModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [deletingItem, setDeletingItem] = useState(null);

  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  }, []);

  const loadAllData = useCallback(async () => {
    setLoading(true);
    try {
      const [usersRes, machinesRes, gamesRes, statsRes] = await Promise.all([
        api.get('/super-admin/users'),
        api.get('/super-admin/machines'),
        api.get('/super-admin/games'),
        api.get('/super-admin/stats')
      ]);
      setUsers(usersRes.data.users || usersRes.data || []);
      setMachines(machinesRes.data.machines || machinesRes.data || []);
      setGames(gamesRes.data.games || gamesRes.data || []);
      if (statsRes.data.stats) {
        setDashboardStats(statsRes.data.stats);
      }
    } catch {
      showToast('Erreur lors du chargement des données', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  // Charger TOUTES les données au démarrage pour les statistiques
  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  // Calculer les statistiques
  useEffect(() => {
    setStats({
      totalUsers: users.length,
      totalMachines: machines.length,
      totalGames: games.length,
      activeUsers: users.filter(u => u.role === 'agent' || u.role === 'admin').length
    });
  }, [users, machines, games]);

  // ========== GESTION DES UTILISATEURS ==========
  const fetchUsers = async () => {
    try {
      setLoading(true);
      const response = await api.get('/super-admin/users');
      setUsers(response.data.users || response.data);
    } catch {
      showToast('Erreur lors du chargement des utilisateurs', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUser = (user) => {
    setDeletingItem({ type: 'user', data: user });
    setShowDeleteConfirm(true);
  };

  const confirmDelete = async () => {
    if (!deletingItem) return;

    try {
      if (deletingItem.type === 'user') {
        await api.delete(`/super-admin/users/${deletingItem.data.id}`);
        showToast('Utilisateur supprimé avec succès', 'success');
        fetchUsers();
      } else if (deletingItem.type === 'machine') {
        await api.delete(`/super-admin/machines/${deletingItem.data.id}`);
        showToast('Machine supprimée avec succès', 'success');
        fetchMachines();
      } else if (deletingItem.type === 'game') {
        await api.delete(`/super-admin/games/${deletingItem.data.id}`);
        showToast('Jeu supprimé avec succès', 'success');
        fetchGames();
      }
    } catch (error) {
      showToast(error.response?.data?.message || 'Erreur lors de la suppression', 'error');
    } finally {
      setShowDeleteConfirm(false);
      setDeletingItem(null);
    }
  };

  // ========== GESTION DES MACHINES ==========
  const fetchMachines = async () => {
    try {
      setLoading(true);
      const response = await api.get('/super-admin/machines');
      setMachines(response.data.machines || response.data);
    } catch {
      showToast('Erreur lors du chargement des machines', 'error');
    } finally {
      setLoading(false);
    }
  };

  // ========== GESTION DES JEUX ==========
  const fetchGames = async () => {
    try {
      setLoading(true);
      const response = await api.get('/super-admin/games');
      setGames(response.data.games || response.data);
    } catch {
      showToast('Erreur lors du chargement des jeux', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Filtrer les données selon la recherche
  const getFilteredData = () => {
    const query = searchQuery.toLowerCase();
    if (activeTab === 'users') {
      return users.filter(u =>
        u.name?.toLowerCase().includes(query) ||
        u.email?.toLowerCase().includes(query) ||
        u.role?.toLowerCase().includes(query)
      );
    } else if (activeTab === 'machines') {
      return machines.filter(m =>
        m.machine_number?.toString().includes(query) ||
        m.type?.toLowerCase().includes(query)
      );
    } else if (activeTab === 'games') {
      return games.filter(g =>
        g.name?.toLowerCase().includes(query)
      );
    }
    return [];
  };

  // Export CSV - uniquement les champs essentiels
  const exportToCSV = (data, filename) => {
    if (!data || data.length === 0) {
      showToast('Aucune donnée à exporter', 'error');
      return;
    }

    let headers, rows;

    if (filename === 'users') {
      // Export utilisateurs: nom, email, rôle, statut
      headers = ['Nom', 'Email', 'Rôle', 'Statut'];
      rows = data.map(item => [
        `"${item.name || ''}"`,
        `"${item.email || ''}"`,
        item.role === 'admin' ? 'Admin' : item.role === 'agent' ? 'Agent' : item.role,
        item.is_active ? 'Actif' : 'Inactif'
      ]);
    } else if (filename === 'machines') {
      // Export machines: nom, type, statut, jeu actuel
      headers = ['Nom', 'Type', 'Statut', 'Jeu Actuel'];
      rows = data.map(item => [
        `"${item.name || ''}"`,
        item.type === 'ps5' ? 'PS5' : item.type === 'ps4' ? 'PS4' : item.type === 'pc' ? 'PC' : item.type,
        item.status === 'available' ? 'Disponible' : item.status === 'occupied' ? 'Occupée' : item.status === 'maintenance' ? 'Maintenance' : item.status,
        `"${item.current_game || '-'}"`
      ]);
    } else if (filename === 'games') {
      // Export jeux: nom, genre, prix/heure, statut
      headers = ['Nom', 'Genre', 'Prix/Heure (DH)', 'Statut'];
      rows = data.map(item => [
        `"${item.name || ''}"`,
        `"${item.genre || '-'}"`,
        item.price_per_hour ? `${parseFloat(item.price_per_hour).toFixed(2)}` : '-',
        item.is_active ? 'Actif' : 'Inactif'
      ]);
    } else {
      // Fallback: exporter tout sauf created_at, updated_at, id
      const excludeKeys = ['id', 'created_at', 'updated_at', 'deleted_at', 'password', 'remember_token'];
      const keys = Object.keys(data[0]).filter(k => !excludeKeys.includes(k));
      headers = keys;
      rows = data.map(item => keys.map(k => `"${item[k] || ''}"`));
    }

    const csv = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
    const blob = new Blob(["\uFEFF" + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    const dateStr = new Date().toLocaleDateString('fr-FR').replace(/\//g, '-');
    link.download = `${filename}_${dateStr}.csv`;
    link.click();
    showToast(`Export ${filename} réussi!`, 'success');
  };

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'organizations', label: 'Organisations', icon: Building2 },
    { id: 'users', label: 'Utilisateurs', icon: Users, count: stats.totalUsers },
    { id: 'machines', label: 'Machines', icon: Monitor, count: stats.totalMachines },
    { id: 'games', label: 'Jeux', icon: Gamepad2, count: stats.totalGames },
    { id: 'services', label: 'Prestations', icon: Scissors },
    { id: 'coiffeurs', label: 'Coiffeurs', icon: Users },
    { id: 'salon-stock', label: 'Stock Salon', icon: Package },
    { id: 'sales-history', label: 'Historique Ventes', icon: History },
    { id: 'stock-movements', label: 'Mouvements Stock', icon: ArrowLeftRight },
    { id: 'subscriptions', label: 'Abonnements', icon: Crown },
    { id: 'invoices', label: 'Facturation', icon: DollarSign },
    { id: 'profile', label: 'Mon Profil', icon: User },
  ];

  // Si on est en mode gestion des jeux, afficher uniquement cette page
  if (showGamesManagement) {
    return <SuperAdminGames onBack={() => setShowGamesManagement(false)} />;
  }

  // Si on est en mode gestion des organisations
  if (showOrganizationsManagement) {
    return <SuperAdminOrganizations onBack={() => setShowOrganizationsManagement(false)} />;
  }

  // Si on est en mode gestion des abonnements
  if (showSubscriptionsManagement) {
    return <SuperAdminSubscriptions onBack={() => setShowSubscriptionsManagement(false)} />;
  }

  if (showInvoices) {
    return <SuperAdminInvoices onBack={() => setShowInvoices(false)} />;
  }

  // Si on est en mode gestion du salon de coiffure
  if (showServicesManagement) {
    return <ServicesManagement onBack={() => setShowServicesManagement(false)} />;
  }

  if (showCoiffeursManagement) {
    return <CoiffeursManagement onBack={() => setShowCoiffeursManagement(false)} />;
  }

  if (showSalonStock) {
    return <SalonStockManagement onBack={() => setShowSalonStock(false)} />;
  }

  if (showSalesHistoryPage) {
    return <SalesHistoryPage onBack={() => setShowSalesHistoryPage(false)} />;
  }

  if (showStockMovements) {
    return <StockMovementsPage onBack={() => setShowStockMovements(false)} />;
  }

  return (
    <div className="z-app-container" style={styles.appContainer}>
      {/* Sidebar */}
      <aside style={{
        ...styles.sidebar,
        width: sidebarCollapsed ? '70px' : '260px'
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
              <span style={styles.logoSubtitle}>Super Admin</span>
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
                if (item.id === 'games') {
                  setShowGamesManagement(true);
                } else if (item.id === 'organizations') {
                  setShowOrganizationsManagement(true);
                } else if (item.id === 'subscriptions') {
                  setShowSubscriptionsManagement(true);
                } else if (item.id === 'services') {
                  setShowServicesManagement(true);
                } else if (item.id === 'coiffeurs') {
                  setShowCoiffeursManagement(true);
                } else if (item.id === 'salon-stock') {
                  setShowSalonStock(true);
                } else if (item.id === 'sales-history') {
                  setShowSalesHistoryPage(true);
                } else if (item.id === 'stock-movements') {
                  setShowStockMovements(true);
                } else if (item.id === 'invoices') {
                  setShowInvoices(true);
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
      <div className="z-main-area" style={{...styles.mainArea, marginLeft: sidebarCollapsed ? '70px' : '260px'}}>
        {/* Top Bar */}
        <header className="z-top-bar" style={styles.topBar}>
          <div style={styles.topBarLeft}>
            <h1 style={styles.pageTitle}>
              {activeTab === 'dashboard' ? 'Dashboard' :
               activeTab === 'users' ? 'Gestion Utilisateurs' :
               activeTab === 'machines' ? 'Gestion Machines' : 'Gestion Jeux'}
            </h1>
          </div>
          <div style={styles.topBarRight}>
            <div style={styles.clockDisplay}>
              <Clock size={16} />
              <span>{currentTime.toLocaleTimeString('fr-FR')}</span>
            </div>
            <button
              style={{ ...styles.userPill, cursor: 'pointer' }}
              onClick={() => setShowProfile(true)}
              title="Mon Profil"
            >
              <div style={styles.userAvatarSmall}>
                {user.name?.charAt(0).toUpperCase()}
              </div>
              <span style={styles.userNameSmall}>{user.name}</span>
            </button>
            <button style={styles.logoutBtnSmall} onClick={onLogout}>
              <LogOut size={18} />
            </button>
          </div>
        </header>

        {/* Content */}
        <main className="z-content" style={styles.content}>
          {/* Dashboard View */}
          {activeTab === 'dashboard' && (
            <DashboardView
              stats={stats}
              dashboardStats={dashboardStats}
              machines={machines}
              users={users}
              games={games}
              onNavigate={setActiveTab}
              onGamesClick={() => setShowGamesManagement(true)}
            />
          )}

          {/* Data Tables with Toolbar */}
          {(activeTab === 'users' || activeTab === 'machines') && (
            <>
              <div style={styles.toolbar}>
                <div style={styles.searchContainer}>
                  <Search size={18} style={styles.searchIcon} />
                  <input
                    type="text"
                    placeholder={`Rechercher...`}
                    style={styles.searchInput}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <div style={styles.toolbarActions}>
                  <button
                    style={styles.exportBtn}
                    onClick={() => exportToCSV(
                      activeTab === 'users' ? users : machines,
                      activeTab
                    )}
                  >
                    <Download size={16} />
                    <span>Export CSV</span>
                  </button>
                  <button style={styles.refreshBtn} onClick={loadAllData} disabled={loading}>
                    <RefreshCw size={16} className={loading ? 'spin' : ''} />
                  </button>
                  <button
                    style={styles.createBtn}
                    onClick={() => {
                      setEditingItem(null);
                      if (activeTab === 'users') setShowUserModal(true);
                      else if (activeTab === 'machines') setShowMachineModal(true);
                    }}
                  >
                    <Plus size={16} />
                    <span>Ajouter</span>
                  </button>
                </div>
              </div>

              {activeTab === 'users' && (
                <UsersTable
                  users={getFilteredData()}
                  loading={loading}
                  onEdit={(user) => { setEditingItem(user); setShowUserModal(true); }}
                  onDelete={handleDeleteUser}
                />
              )}
              {activeTab === 'machines' && (
                <MachinesTable
                  machines={getFilteredData()}
                  loading={loading}
                  onEdit={(machine) => { setEditingItem(machine); setShowMachineModal(true); }}
                  onDelete={(machine) => {
                    setDeletingItem({ type: 'machine', data: machine });
                    setShowDeleteConfirm(true);
                  }}
                />
              )}
            </>
          )}
        </main>
      </div>

      {/* Modals */}
      {showUserModal && (
        <UserModal
          user={editingItem}
          onClose={() => setShowUserModal(false)}
          onSuccess={() => {
            setShowUserModal(false);
            fetchUsers();
            showToast(editingItem ? 'Utilisateur modifié avec succès' : 'Utilisateur créé avec succès');
          }}
        />
      )}

      {showMachineModal && (
        <MachineModal
          machine={editingItem}
          onClose={() => setShowMachineModal(false)}
          onSuccess={() => {
            setShowMachineModal(false);
            fetchMachines();
            showToast(editingItem ? 'Machine modifiée avec succès' : 'Machine créée avec succès');
          }}
        />
      )}


      {showDeleteConfirm && (
        <DeleteConfirmModal
          item={deletingItem}
          onConfirm={confirmDelete}
          onCancel={() => {
            setShowDeleteConfirm(false);
            setDeletingItem(null);
          }}
        />
      )}

      {/* Toast Notifications */}
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* User Profile Modal */}
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
            style={activeTab === item.id ? { color: '#c9a24b' } : {}}
            onClick={() => {
              if (item.id === 'games') {
                setShowGamesManagement(true);
              } else if (item.id === 'organizations') {
                setShowOrganizationsManagement(true);
              } else if (item.id === 'subscriptions') {
                setShowSubscriptionsManagement(true);
              } else if (item.id === 'services') {
                setShowServicesManagement(true);
              } else if (item.id === 'coiffeurs') {
                setShowCoiffeursManagement(true);
              } else if (item.id === 'salon-stock') {
                setShowSalonStock(true);
              } else if (item.id === 'sales-history') {
                setShowSalesHistoryPage(true);
              } else if (item.id === 'stock-movements') {
                setShowStockMovements(true);
              } else if (item.id === 'invoices') {
                setShowInvoices(true);
              } else if (item.id === 'profile') {
                setShowProfile(true);
              } else {
                setActiveTab(item.id);
              }
            }}
          >
            <item.icon size={20} />
            <span style={{ fontSize: '9px' }}>{item.label}</span>
          </button>
        ))}
        <button
          className="z-bottom-nav-item"
          onClick={onLogout}
          style={{ color: '#ef4444' }}
        >
          <LogOut size={20} />
          <span style={{ fontSize: '9px' }}>Déco.</span>
        </button>
      </nav>
    </div>
  );
}

// ========== DASHBOARD VIEW ==========
function DashboardView({ stats, dashboardStats, machines, users, games, onNavigate, onGamesClick }) {
  const availableMachines = dashboardStats.machines_available || machines.filter(m => m.status === 'available').length;
  const occupiedMachines = dashboardStats.machines_occupied || machines.filter(m => m.status !== 'available').length;
  const totalMachines = availableMachines + occupiedMachines;
  const availablePercent = totalMachines > 0 ? Math.round((availableMachines / totalMachines) * 100) : 0;

  // Helper pour formater les prix des jeux
  const getGamePrice = (game) => {
    if (game.pricings && game.pricings.length > 0) {
      const pricing1h = game.pricings.find(p => p.duration_minutes === 60);
      if (pricing1h) return `${pricing1h.price} DH/h`;
      const pricing30min = game.pricings.find(p => p.duration_minutes === 30);
      if (pricing30min) return `${pricing30min.price} DH/30min`;
      return `${game.pricings[0].price} DH`;
    }
    return '-';
  };

  return (
    <div style={styles.dashboardGrid}>
      {/* Stats Row - Ressources principales pour Super Admin */}
      <div style={styles.statsRow}>
        <StatCardEnhanced
          icon={<Users size={24} />}
          label="Utilisateurs"
          value={stats.totalUsers}
          gradient="linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)"
          iconBg="rgba(59, 130, 246, 0.2)"
          onClick={() => onNavigate('users')}
          clickable
        />
        <StatCardEnhanced
          icon={<Monitor size={24} />}
          label="Machines"
          value={stats.totalMachines}
          gradient="linear-gradient(135deg, #ec4899 0%, #db2777 100%)"
          iconBg="rgba(236, 72, 153, 0.2)"
          onClick={() => onNavigate('machines')}
          clickable
        />
        <StatCardEnhanced
          icon={<Gamepad2 size={24} />}
          label="Jeux"
          value={stats.totalGames}
          gradient="linear-gradient(135deg, #14b8a6 0%, #0d9488 100%)"
          iconBg="rgba(20, 184, 166, 0.2)"
          onClick={onGamesClick}
          clickable
        />
        <StatCardEnhanced
          icon={<Wifi size={24} />}
          label="Machines Libres"
          value={availableMachines}
          gradient="linear-gradient(135deg, #10b981 0%, #059669 100%)"
          iconBg="rgba(16, 185, 129, 0.2)"
        />
      </div>

      {/* Machines Map - Design amélioré */}
      <div style={styles.machineMapCard}>
        <div style={styles.machineMapHeader}>
          <div style={styles.machineMapTitleSection}>
            <div style={styles.machineMapIcon}>
              <Monitor size={20} />
            </div>
            <div>
              <h3 style={styles.machineMapTitle}>Carte des Machines</h3>
              <p style={styles.machineMapSubtitle}>{totalMachines} machines au total</p>
            </div>
          </div>
          <div style={styles.machineStatusBadges}>
            <div style={styles.statusBadgeGreen}>
              <div style={styles.statusDot} />
              <span>{availableMachines} Libres</span>
            </div>
            <div style={styles.statusBadgeRed}>
              <div style={{...styles.statusDot, background: '#ef4444'}} />
              <span>{occupiedMachines} Occupées</span>
            </div>
          </div>
        </div>

        {/* Barre de progression */}
        <div style={styles.progressBarContainer}>
          <div style={styles.progressBarBg}>
            <div style={{
              ...styles.progressBarFill,
              width: `${availablePercent}%`
            }} />
          </div>
          <span style={styles.progressLabel}>{availablePercent}% disponible</span>
        </div>

        <div style={styles.machinesGridEnhanced}>
          {machines.length === 0 ? (
            <div style={styles.emptyMachinesEnhanced}>
              <div style={styles.emptyIcon}>
                <Monitor size={48} />
              </div>
              <p style={styles.emptyText}>Aucune machine configurée</p>
              <p style={styles.emptySubtext}>Ajoutez des machines pour commencer</p>
            </div>
          ) : (
            machines.map(machine => (
              <MachineCardEnhanced key={machine.id} machine={machine} />
            ))
          )}
        </div>
      </div>

      {/* Bottom Row - Design amélioré */}
      <div style={styles.bottomRow}>
        {/* Recent Users */}
        <div style={styles.listCard}>
          <div style={styles.listCardHeader}>
            <div style={styles.listCardTitleSection}>
              <div style={{...styles.listCardIcon, background: 'linear-gradient(135deg, #c9a24b 0%, #a5822f 100%)'}}>
                <Users size={18} />
              </div>
              <h3 style={styles.listCardTitle}>Derniers Utilisateurs</h3>
            </div>
            <span style={styles.listCardCount}>{users.length}</span>
          </div>
          <div style={styles.listCardContent}>
            {users.length === 0 ? (
              <div style={styles.emptyList}>
                <Users size={32} color="#d9d2c4" />
                <p>Aucun utilisateur</p>
              </div>
            ) : (
              users.slice(0, 5).map((u, index) => (
                <div key={u.id} style={{
                  ...styles.listItem,
                  animationDelay: `${index * 0.1}s`
                }}>
                  <div style={styles.listItemAvatar}>
                    {u.name?.charAt(0).toUpperCase()}
                  </div>
                  <div style={styles.listItemInfo}>
                    <span style={styles.listItemName}>{u.name}</span>
                    <span style={styles.listItemMeta}>{u.email}</span>
                  </div>
                  <span style={getRoleBadgeStyleEnhanced(u.role)}>{getRoleLabel(u.role)}</span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Games List */}
        <div style={styles.listCard}>
          <div style={styles.listCardHeader}>
            <div style={styles.listCardTitleSection}>
              <div style={{...styles.listCardIcon, background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)'}}>
                <Gamepad2 size={18} />
              </div>
              <h3 style={styles.listCardTitle}>Catalogue Jeux</h3>
            </div>
            <span style={styles.listCardCount}>{games.length}</span>
          </div>
          <div style={styles.listCardContent}>
            {games.length === 0 ? (
              <div style={styles.emptyList}>
                <Gamepad2 size={32} color="#d9d2c4" />
                <p>Aucun jeu configuré</p>
              </div>
            ) : (
              games.slice(0, 5).map((g, index) => (
                <div key={g.id} style={{
                  ...styles.listItem,
                  animationDelay: `${index * 0.1}s`
                }}>
                  <div style={{...styles.listItemAvatar, background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)'}}>
                    <Gamepad2 size={16} />
                  </div>
                  <div style={styles.listItemInfo}>
                    <span style={styles.listItemName}>{g.name}</span>
                    <span style={styles.listItemPrice}>{getGamePrice(g)}</span>
                  </div>
                  <span style={getGameStatusBadge(g.active)}>
                    {g.active ? 'Actif' : 'Inactif'}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ========== ENHANCED STAT CARD ==========
function StatCardEnhanced({ icon, label, value, gradient, iconBg, onClick, clickable, isPrice }) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      style={{
        ...styles.statCardEnhanced,
        transform: hovered ? 'translateY(-6px) scale(1.02)' : 'none',
        boxShadow: hovered
          ? '0 20px 40px rgba(0, 0, 0, 0.3)'
          : '0 4px 12px rgba(0, 0, 0, 0.15)',
        cursor: clickable ? 'pointer' : 'default'
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onClick}
    >
      <div style={{...styles.statIconEnhanced, background: iconBg}}>
        <div style={{color: gradient.includes('#10b981') ? '#10b981' :
                           gradient.includes('#c9a24b') ? '#c9a24b' :
                           gradient.includes('#f59e0b') ? '#f59e0b' :
                           gradient.includes('#e0b85c') ? '#e0b85c' :
                           gradient.includes('#3b82f6') ? '#3b82f6' :
                           gradient.includes('#ec4899') ? '#ec4899' :
                           gradient.includes('#14b8a6') ? '#14b8a6' : '#6b6155'}}>
          {icon}
        </div>
      </div>
      <div style={styles.statContentEnhanced}>
        <div style={{
          ...styles.statValueEnhanced,
          fontSize: isPrice ? '24px' : '32px'
        }}>{value}</div>
        <div style={styles.statLabelEnhanced}>{label}</div>
      </div>
      {clickable && (
        <div style={{
          ...styles.clickIndicator,
          opacity: hovered ? 1 : 0
        }}>
          <ChevronRight size={18} />
        </div>
      )}
    </div>
  );
}

// ========== ENHANCED MACHINE CARD ==========
function MachineCardEnhanced({ machine }) {
  const isAvailable = machine.status === 'available';
  const [hovered, setHovered] = useState(false);

  return (
    <div
      style={{
        ...styles.machineCardEnhanced,
        background: isAvailable
          ? 'linear-gradient(135deg, #064e3b 0%, #065f46 100%)'
          : 'linear-gradient(135deg, #7f1d1d 0%, #991b1b 100%)',
        borderColor: isAvailable ? '#10b981' : '#ef4444',
        transform: hovered ? 'translateY(-4px) scale(1.05)' : 'scale(1)',
        boxShadow: hovered
          ? `0 12px 24px ${isAvailable ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`
          : '0 2px 8px rgba(0, 0, 0, 0.2)'
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div style={styles.machineCardTop}>
        <span style={styles.machineNumberEnhanced}>#{machine.machine_number}</span>
        <div style={{
          ...styles.machineStatusIcon,
          background: isAvailable ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'
        }}>
          {isAvailable ? <Wifi size={14} /> : <WifiOff size={14} />}
        </div>
      </div>
      <div style={styles.machineTypeEnhanced}>{machine.type || 'Standard'}</div>
      <div style={{
        ...styles.machineStatusText,
        color: isAvailable ? '#6ee7b7' : '#fca5a5'
      }}>
        {isAvailable ? 'Disponible' : 'Occupée'}
      </div>
    </div>
  );
}

// Les anciens composants MiniStatCard et MachineCard ont été remplacés par StatCardEnhanced et MachineCardEnhanced

// ========== SKELETON LOADER ==========
function SkeletonRow({ columns = 5 }) {
  return (
    <tr style={styles.tr}>
      {Array(columns).fill(0).map((_, i) => (
        <td key={i} style={styles.td}>
          <div style={styles.skeleton}></div>
        </td>
      ))}
    </tr>
  );
}

function SkeletonTable({ rows = 5, columns = 5 }) {
  return (
    <div style={styles.tableWrapper}>
      <table style={styles.table}>
        <thead>
          <tr>
            {Array(columns).fill(0).map((_, i) => (
              <th key={i} style={styles.th}>
                <div style={{...styles.skeleton, width: '80px', height: '14px'}}></div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array(rows).fill(0).map((_, i) => (
            <SkeletonRow key={i} columns={columns} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ========== TABLE ROW WITH HOVER ==========
function TableRow({ children, onClick }) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <tr
      style={{
        ...styles.tr,
        ...(isHovered && styles.trHover)
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={onClick}
    >
      {children}
    </tr>
  );
}

// ========== USERS TABLE ==========
function UsersTable({ users, loading, onEdit, onDelete }) {
  if (loading) {
    return <SkeletonTable rows={5} columns={5} />;
  }

  if (users.length === 0) {
    return (
      <div style={styles.emptyState}>
        <Users size={64} color="#6b6155" />
        <p>Aucun utilisateur trouvé</p>
      </div>
    );
  }

  return (
    <div style={styles.tableWrapper}>
      <table style={styles.table}>
        <thead>
          <tr>
            <th style={styles.th}>Utilisateur</th>
            <th style={styles.th}>Email</th>
            <th style={styles.th}>Rôle</th>
            <th style={styles.th}>Date de création</th>
            <th style={styles.th}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {users.map((user, index) => (
            <TableRow key={user.id}>
              <td style={{...styles.td, animationDelay: `${index * 0.05}s`}} className="fade-in-row">
                <div style={styles.userCell}>
                  <div style={styles.miniAvatar}>{user.name?.charAt(0).toUpperCase()}</div>
                  <strong style={{color: '#1a1410'}}>{user.name}</strong>
                </div>
              </td>
              <td style={styles.td}>{user.email}</td>
              <td style={styles.td}>
                <span style={getRoleBadgeStyle(user.role)}>{getRoleLabel(user.role)}</span>
              </td>
              <td style={styles.td}>{new Date(user.created_at).toLocaleDateString('fr-FR')}</td>
              <td style={styles.td}>
                <div style={styles.actionBtns}>
                  <ActionButton type="edit" onClick={() => onEdit(user)} title="Modifier" />
                  <ActionButton type="delete" onClick={() => onDelete(user)} title="Supprimer" />
                </div>
              </td>
            </TableRow>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ========== ACTION BUTTON WITH HOVER ==========
function ActionButton({ type, onClick, title }) {
  const [isHovered, setIsHovered] = useState(false);

  const baseStyle = type === 'edit' ? styles.editIconBtn : styles.deleteIconBtn;
  const hoverStyle = type === 'edit' ? styles.editIconBtnHover : styles.deleteIconBtnHover;

  return (
    <button
      style={{
        ...baseStyle,
        ...(isHovered && hoverStyle)
      }}
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      title={title}
    >
      {type === 'edit' ? <Edit2 size={16} /> : <Trash2 size={16} />}
    </button>
  );
}

// ========== MACHINES TABLE ==========
function MachinesTable({ machines, loading, onEdit, onDelete }) {
  if (loading) {
    return <SkeletonTable rows={5} columns={6} />;
  }

  if (machines.length === 0) {
    return (
      <div style={styles.emptyState}>
        <Monitor size={64} color="#6b6155" />
        <p>Aucune machine trouvée</p>
      </div>
    );
  }

  return (
    <div style={styles.tableWrapper}>
      <table style={styles.table}>
        <thead>
          <tr>
            <th style={styles.th}>Machine</th>
            <th style={styles.th}>Type</th>
            <th style={styles.th}>Organisation</th>
            <th style={styles.th}>Statut</th>
            <th style={styles.th}>Date de création</th>
            <th style={styles.th}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {machines.map((machine) => (
            <TableRow key={machine.id}>
              <td style={styles.td}>
                <div style={styles.userCell}>
                  <div style={{...styles.miniAvatar, background: '#e0b85c'}}>
                    <Monitor size={16} />
                  </div>
                  <strong style={{color: '#1a1410'}}>Machine #{machine.machine_number}</strong>
                </div>
              </td>
              <td style={styles.td}>{machine.type || 'Standard'}</td>
              <td style={styles.td}>
                <span style={{
                  padding: '4px 10px',
                  borderRadius: '6px',
                  fontSize: '11px',
                  fontWeight: '600',
                  background: 'rgba(201, 162, 75, 0.15)',
                  color: '#8a6a1f'
                }}>
                  {machine.organization_name || 'Non assignée'}
                </span>
              </td>
              <td style={styles.td}>
                <span style={getStatusBadgeStyle(machine.status)}>
                  {machine.status === 'available' ? 'Disponible' : machine.status === 'maintenance' ? 'Maintenance' : 'Occupée'}
                </span>
              </td>
              <td style={styles.td}>{new Date(machine.created_at).toLocaleDateString('fr-FR')}</td>
              <td style={styles.td}>
                <div style={styles.actionBtns}>
                  <ActionButton type="edit" onClick={() => onEdit(machine)} title="Modifier" />
                  <ActionButton type="delete" onClick={() => onDelete(machine)} title="Supprimer" />
                </div>
              </td>
            </TableRow>
          ))}
        </tbody>
      </table>
    </div>
  );
}


// ========== DELETE CONFIRM MODAL ==========
function DeleteConfirmModal({ item, onConfirm, onCancel }) {
  return (
    <div style={styles.modalOverlay} onClick={onCancel}>
      <div style={{...styles.modalContent, maxWidth: '450px'}} onClick={(e) => e.stopPropagation()}>
        <div style={styles.deleteModalHeader}>
          <AlertCircle size={48} color="#ef4444" />
        </div>
        <h3 style={styles.deleteModalTitle}>Confirmer la suppression</h3>
        <p style={styles.deleteModalText}>
          Êtes-vous sûr de vouloir supprimer{' '}
          <strong>
            {item?.type === 'user' && item.data.name}
            {item?.type === 'machine' && `Machine #${item.data.machine_number}`}
            {item?.type === 'game' && item.data.name}
          </strong>
          ? Cette action est irréversible.
        </p>
        <div style={styles.deleteModalActions}>
          <button style={styles.cancelBtnModal} onClick={onCancel}>
            <X size={18} />
            Annuler
          </button>
          <button style={styles.deleteBtnModal} onClick={onConfirm}>
            <Trash2 size={18} />
            Supprimer
          </button>
        </div>
      </div>
    </div>
  );
}

// ========== USER MODAL ==========
function UserModal({ user, onClose, onSuccess }) {
  const [formData, setFormData] = useState({
    name: user?.name || '',
    email: user?.email || '',
    password: '',
    password_confirmation: '',
    role: user?.role || 'agent',
    organization_id: user?.organization_id || ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [organizations, setOrganizations] = useState([]);

  useEffect(() => {
    api.get('/super-admin/organizations').then(res => {
      setOrganizations(res.data.organizations || []);
    }).catch(() => {});
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!user && !formData.password) {
      setError('Le mot de passe est requis pour la création');
      return;
    }

    if (formData.password && formData.password !== formData.password_confirmation) {
      setError('Les mots de passe ne correspondent pas');
      return;
    }

    try {
      setLoading(true);
      const payload = { ...formData };
      if (!formData.password) {
        delete payload.password;
        delete payload.password_confirmation;
      }

      if (user) {
        await api.put(`/super-admin/users/${user.id}`, payload);
      } else {
        await api.post('/super-admin/users', payload);
      }
      onSuccess();
    } catch (err) {
      setError(err.response?.data?.message || 'Erreur lors de la sauvegarde');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.modalOverlay} onClick={onClose}>
      <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <div style={styles.modalHeader}>
          <h3 style={styles.modalTitle}>
            {user ? 'Modifier Utilisateur' : 'Nouvel Utilisateur'}
          </h3>
          <button style={styles.closeBtn} onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={styles.formCompact}>
          <div style={styles.formRow}>
            <div style={styles.formGroup}>
              <label style={styles.labelSmall}>Nom</label>
              <input
                type="text"
                style={styles.inputSmall}
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                placeholder="Nom complet"
              />
            </div>
            <div style={styles.formGroup}>
              <label style={styles.labelSmall}>Rôle</label>
              <select
                style={styles.inputSmall}
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                required
              >
                <option value="agent">Agent</option>
                <option value="admin">Admin</option>
              </select>
            </div>
          </div>

          <div style={styles.formGroup}>
            <label style={styles.labelSmall}>Email</label>
            <input
              type="email"
              style={styles.inputSmall}
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              required
              placeholder="email@exemple.com"
            />
          </div>

          <div style={styles.formGroup}>
            <label style={styles.labelSmall}>Organisation</label>
            <select
              style={styles.inputSmall}
              value={formData.organization_id}
              onChange={(e) => setFormData({ ...formData, organization_id: e.target.value })}
            >
              <option value="">-- Aucune --</option>
              {organizations.map(org => (
                <option key={org.id} value={org.id}>{org.name}</option>
              ))}
            </select>
          </div>

          <div style={styles.formRow}>
            <div style={styles.formGroup}>
              <label style={styles.labelSmall}>{user ? 'Nouveau MDP' : 'Mot de passe'}</label>
              <input
                type="password"
                style={styles.inputSmall}
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                required={!user}
                placeholder="••••••••"
              />
            </div>
            <div style={styles.formGroup}>
              <label style={styles.labelSmall}>Confirmer</label>
              <input
                type="password"
                style={styles.inputSmall}
                value={formData.password_confirmation}
                onChange={(e) => setFormData({ ...formData, password_confirmation: e.target.value })}
                required={!user || formData.password}
                placeholder="••••••••"
              />
            </div>
          </div>

          {error && <div style={styles.errorSmall}>{error}</div>}

          <div style={styles.modalActionsCompact}>
            <button type="button" style={styles.cancelBtnSmall} onClick={onClose}>Annuler</button>
            <button type="submit" style={styles.submitBtnSmall} disabled={loading}>
              {loading ? '...' : user ? 'Modifier' : 'Créer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ========== MACHINE MODAL ==========
function MachineModal({ machine, onClose, onSuccess }) {
  const [formData, setFormData] = useState({
    machine_number: machine?.machine_number || '',
    type: machine?.type || 'Standard',
    status: machine?.status || 'available',
    organization_id: machine?.organization_id || ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [organizations, setOrganizations] = useState([]);

  useEffect(() => {
    api.get('/super-admin/organizations').then(res => {
      setOrganizations(res.data.organizations || []);
    }).catch(() => {});
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!machine && !formData.organization_id) {
      setError('L\'organisation est requise');
      return;
    }

    try {
      setLoading(true);
      if (machine) {
        await api.put(`/super-admin/machines/${machine.id}`, formData);
      } else {
        await api.post('/super-admin/machines', formData);
      }
      onSuccess();
    } catch (err) {
      setError(err.response?.data?.message || 'Erreur lors de la sauvegarde');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.modalOverlay} onClick={onClose}>
      <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <div style={styles.modalHeader}>
          <h3 style={styles.modalTitle}>
            {machine ? 'Modifier Machine' : 'Nouvelle Machine'}
          </h3>
          <button style={styles.closeBtn} onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.formGroup}>
            <label style={styles.label}>Organisation *</label>
            <select
              style={styles.input}
              value={formData.organization_id}
              onChange={(e) => setFormData({ ...formData, organization_id: e.target.value })}
              required
            >
              <option value="">-- Sélectionner une organisation --</option>
              {organizations.map(org => (
                <option key={org.id} value={org.id}>{org.name}</option>
              ))}
            </select>
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>Numéro de Machine</label>
            <input
              type="number"
              style={styles.input}
              value={formData.machine_number}
              onChange={(e) => setFormData({ ...formData, machine_number: e.target.value })}
              min="1"
              placeholder="Auto-généré si vide"
            />
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>Type</label>
            <input
              type="text"
              style={styles.input}
              value={formData.type}
              onChange={(e) => setFormData({ ...formData, type: e.target.value })}
              placeholder="Ex: PS5 Pro, Xbox Series X, PC Gaming"
            />
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>Statut</label>
            <select
              style={styles.input}
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value })}
            >
              <option value="available">Disponible</option>
              <option value="in_session">En session</option>
              <option value="maintenance">Maintenance</option>
            </select>
          </div>

          {error && <div style={styles.error}>{error}</div>}

          <div style={styles.modalActions}>
            <button type="button" style={styles.cancelBtn} onClick={onClose}>
              Annuler
            </button>
            <button type="submit" style={styles.submitBtn} disabled={loading}>
              {loading ? 'Enregistrement...' : machine ? 'Modifier' : 'Créer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}


// ========== HELPER FUNCTIONS ==========
function getRoleLabel(role) {
  const labels = {
    super_admin: 'Super Admin',
    admin: 'Admin',
    agent: 'Agent'
  };
  return labels[role] || role;
}

function getRoleBadgeStyle(role) {
  const baseStyle = {
    padding: '6px 14px',
    borderRadius: '20px',
    fontSize: '12px',
    fontWeight: '700',
    display: 'inline-block',
    letterSpacing: '0.5px'
  };

  if (role === 'super_admin') {
    return { ...baseStyle, background: '#e0b85c', color: '#fff' };
  } else if (role === 'admin') {
    return { ...baseStyle, background: '#f59e0b', color: '#fff' };
  } else {
    return { ...baseStyle, background: '#3b82f6', color: '#fff' };
  }
}

function getStatusBadgeStyle(status) {
  const baseStyle = {
    padding: '6px 14px',
    borderRadius: '20px',
    fontSize: '12px',
    fontWeight: '700',
    display: 'inline-block',
    letterSpacing: '0.5px'
  };

  if (status === 'available') {
    return { ...baseStyle, background: '#10b981', color: '#fff' };
  } else {
    return { ...baseStyle, background: '#ef4444', color: '#fff' };
  }
}

// Badge de rôle amélioré pour le dashboard
function getRoleBadgeStyleEnhanced(role) {
  const baseStyle = {
    padding: '4px 10px',
    borderRadius: '6px',
    fontSize: '11px',
    fontWeight: '600',
    display: 'inline-block'
  };

  if (role === 'super_admin') {
    return { ...baseStyle, background: 'rgba(224, 184, 92, 0.15)', color: '#8a6a1f' };
  } else if (role === 'admin') {
    return { ...baseStyle, background: 'rgba(245, 158, 11, 0.12)', color: '#b45309' };
  } else {
    return { ...baseStyle, background: 'rgba(59, 130, 246, 0.12)', color: '#1d4ed8' };
  }
}

// Badge de statut de jeu
function getGameStatusBadge(isActive) {
  return {
    padding: '4px 10px',
    borderRadius: '6px',
    fontSize: '11px',
    fontWeight: '600',
    background: isActive ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
    color: isActive ? '#15803d' : '#b91c1c'
  };
}

// ========== STYLES ==========
const styles = {
  // App Layout
  appContainer: {
    display: 'flex',
    minHeight: '100vh',
    background: '#f7f5f2',
    width: '100%'
  },

  // Sidebar - Enhanced
  sidebar: {
    background: 'linear-gradient(180deg, #ffffff 0%, #f7f5f2 100%)',
    borderRight: '1px solid #e8e2d8',
    display: 'flex',
    flexDirection: 'column',
    transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    position: 'fixed',
    height: '100vh',
    zIndex: 100,
    boxShadow: '4px 0 24px rgba(0, 0, 0, 0.06)'
  },
  sidebarHeader: {
    padding: '24px 20px',
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
    borderBottom: '1px solid #e8e2d8'
  },
  logoBox: {
    width: '46px',
    height: '46px',
    background: 'linear-gradient(135deg, #c9a24b 0%, #e0b85c 50%, #c9a24b 100%)',
    backgroundSize: '200% 200%',
    borderRadius: '14px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    boxShadow: '0 4px 16px rgba(201, 162, 75, 0.5), inset 0 1px 0 rgba(255,255,255,0.2)',
    border: '1px solid rgba(255,255,255,0.1)',
    position: 'relative',
    overflow: 'hidden'
  },
  logoText: {
    display: 'flex',
    flexDirection: 'column'
  },
  logoTitle: {
    color: '#1a1410',
    fontWeight: '800',
    fontSize: '17px',
    letterSpacing: '-0.5px'
  },
  logoSubtitle: {
    color: '#c9a24b',
    fontSize: '11px',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: '1px'
  },
  sidebarNav: {
    flex: 1,
    padding: '16px 12px',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px'
  },
  menuItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '14px 16px',
    borderRadius: '12px',
    border: 'none',
    background: 'transparent',
    color: '#6b6155',
    cursor: 'pointer',
    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
    width: '100%',
    textAlign: 'left',
    fontSize: '14px',
    fontWeight: '500'
  },
  menuItemActive: {
    background: 'linear-gradient(135deg, #c9a24b 0%, #a5822f 100%)',
    color: '#fff',
    boxShadow: '0 4px 12px rgba(201, 162, 75, 0.4)'
  },
  menuLabel: {
    flex: 1
  },
  menuBadge: {
    background: 'rgba(201, 162, 75, 0.15)',
    color: '#8a6a1f',
    padding: '4px 10px',
    borderRadius: '8px',
    fontSize: '12px',
    fontWeight: '700'
  },
  sidebarFooter: {
    padding: '16px 12px',
    borderTop: '1px solid #e8e2d8'
  },
  collapseBtn: {
    width: '100%',
    padding: '12px',
    background: 'rgba(201, 162, 75, 0.1)',
    border: '1px solid rgba(201, 162, 75, 0.25)',
    borderRadius: '10px',
    color: '#8a6a1f',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.2s'
  },

  // Main Area
  mainArea: {
    flex: 1,
    marginLeft: '260px',
    transition: 'margin-left 0.3s ease',
    display: 'flex',
    flexDirection: 'column',
    minHeight: '100vh'
  },

  // Top Bar - Enhanced
  topBar: {
    background: 'rgba(255, 255, 255, 0.85)',
    backdropFilter: 'blur(12px)',
    padding: '16px 28px',
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
    fontSize: '22px',
    fontWeight: '700',
    color: '#1a1410',
    letterSpacing: '-0.5px'
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
    fontWeight: '600',
    padding: '8px 14px',
    background: '#f3f0ea',
    borderRadius: '10px'
  },
  userPill: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    background: 'linear-gradient(135deg, rgba(201, 162, 75, 0.1) 0%, rgba(224, 184, 92, 0.1) 100%)',
    border: '1px solid rgba(201, 162, 75, 0.2)',
    padding: '6px 14px 6px 6px',
    borderRadius: '30px'
  },
  userAvatarSmall: {
    width: '32px',
    height: '32px',
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #c9a24b 0%, #e0b85c 100%)',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '13px',
    fontWeight: '700',
    boxShadow: '0 2px 8px rgba(201, 162, 75, 0.3)'
  },
  userNameSmall: {
    color: '#1a1410',
    fontSize: '14px',
    fontWeight: '600'
  },
  logoutBtnSmall: {
    padding: '10px',
    background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
    border: 'none',
    borderRadius: '10px',
    color: '#fff',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.2s',
    boxShadow: '0 2px 8px rgba(239, 68, 68, 0.3)'
  },

  // Content
  content: {
    flex: 1,
    padding: '24px',
    overflowY: 'auto'
  },

  // Dashboard Grid
  dashboardGrid: {
    display: 'flex',
    flexDirection: 'column',
    gap: '24px'
  },
  statsRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: '16px'
  },
  // Enhanced Stat Card Styles
  statCardEnhanced: {
    background: '#ffffff',
    borderRadius: '16px',
    padding: '24px',
    border: '1px solid #e8e2d8',
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    position: 'relative',
    overflow: 'hidden'
  },
  statIconEnhanced: {
    width: '56px',
    height: '56px',
    borderRadius: '14px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0
  },
  statContentEnhanced: {
    flex: 1,
    minWidth: 0
  },
  statValueEnhanced: {
    fontSize: '32px',
    fontWeight: '800',
    color: '#1a1410',
    lineHeight: 1.1,
    marginBottom: '4px'
  },
  statLabelEnhanced: {
    fontSize: '13px',
    color: '#6b6155',
    fontWeight: '500'
  },
  clickIndicator: {
    position: 'absolute',
    right: '16px',
    top: '50%',
    transform: 'translateY(-50%)',
    color: '#6b6155',
    transition: 'opacity 0.2s'
  },

  // Machine Map Card - Enhanced
  machineMapCard: {
    background: '#ffffff',
    borderRadius: '20px',
    border: '1px solid #e8e2d8',
    overflow: 'hidden'
  },
  machineMapHeader: {
    padding: '20px 24px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottom: '1px solid #e8e2d8'
  },
  machineMapTitleSection: {
    display: 'flex',
    alignItems: 'center',
    gap: '14px'
  },
  machineMapIcon: {
    width: '44px',
    height: '44px',
    borderRadius: '12px',
    background: 'linear-gradient(135deg, #c9a24b 0%, #a5822f 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#fff'
  },
  machineMapTitle: {
    margin: 0,
    fontSize: '16px',
    fontWeight: '700',
    color: '#1a1410'
  },
  machineMapSubtitle: {
    margin: '2px 0 0 0',
    fontSize: '12px',
    color: '#6b6155'
  },
  machineStatusBadges: {
    display: 'flex',
    gap: '12px'
  },
  statusBadgeGreen: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 14px',
    background: 'rgba(16, 185, 129, 0.1)',
    borderRadius: '10px',
    border: '1px solid rgba(16, 185, 129, 0.2)',
    color: '#10b981',
    fontSize: '13px',
    fontWeight: '600'
  },
  statusBadgeRed: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 14px',
    background: 'rgba(239, 68, 68, 0.1)',
    borderRadius: '10px',
    border: '1px solid rgba(239, 68, 68, 0.2)',
    color: '#ef4444',
    fontSize: '13px',
    fontWeight: '600'
  },
  statusDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    background: '#10b981'
  },
  progressBarContainer: {
    padding: '0 24px 16px 24px',
    display: 'flex',
    alignItems: 'center',
    gap: '12px'
  },
  progressBarBg: {
    flex: 1,
    height: '8px',
    background: '#f3f0ea',
    borderRadius: '4px',
    overflow: 'hidden'
  },
  progressBarFill: {
    height: '100%',
    background: 'linear-gradient(90deg, #10b981 0%, #6ee7b7 100%)',
    borderRadius: '4px',
    transition: 'width 0.5s ease'
  },
  progressLabel: {
    fontSize: '12px',
    color: '#6b6155',
    fontWeight: '500',
    minWidth: '90px',
    textAlign: 'right'
  },
  machinesGridEnhanced: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))',
    gap: '14px',
    padding: '20px 24px 24px 24px'
  },
  emptyMachinesEnhanced: {
    gridColumn: '1 / -1',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '12px',
    padding: '60px 40px'
  },
  emptyIcon: {
    width: '80px',
    height: '80px',
    borderRadius: '20px',
    background: '#f3f0ea',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#6b6155'
  },
  emptyText: {
    margin: 0,
    fontSize: '16px',
    fontWeight: '600',
    color: '#6b6155'
  },
  emptySubtext: {
    margin: 0,
    fontSize: '13px',
    color: '#6b6155'
  },
  machineCardEnhanced: {
    padding: '16px',
    borderRadius: '14px',
    border: '2px solid',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    cursor: 'default'
  },
  machineCardTop: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  machineNumberEnhanced: {
    fontSize: '18px',
    fontWeight: '800',
    color: '#fff'
  },
  machineStatusIcon: {
    width: '28px',
    height: '28px',
    borderRadius: '8px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#fff'
  },
  machineTypeEnhanced: {
    fontSize: '11px',
    color: 'rgba(255,255,255,0.8)',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: '0.5px'
  },
  machineStatusText: {
    fontSize: '10px',
    fontWeight: '500'
  },

  // List Cards - Enhanced
  listCard: {
    background: '#ffffff',
    borderRadius: '20px',
    border: '1px solid #e8e2d8',
    overflow: 'hidden',
    flex: 1
  },
  listCardHeader: {
    padding: '18px 20px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottom: '1px solid #e8e2d8'
  },
  listCardTitleSection: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px'
  },
  listCardIcon: {
    width: '36px',
    height: '36px',
    borderRadius: '10px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#fff'
  },
  listCardTitle: {
    margin: 0,
    fontSize: '15px',
    fontWeight: '600',
    color: '#1a1410'
  },
  listCardCount: {
    padding: '4px 12px',
    background: '#f3f0ea',
    borderRadius: '20px',
    fontSize: '12px',
    fontWeight: '700',
    color: '#6b6155'
  },
  listCardContent: {
    padding: '8px'
  },
  emptyList: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '8px',
    padding: '40px 20px',
    color: '#6b6155',
    fontSize: '13px'
  },
  listItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '12px',
    borderRadius: '12px',
    transition: 'background 0.2s',
    cursor: 'default'
  },
  listItemAvatar: {
    width: '40px',
    height: '40px',
    borderRadius: '10px',
    background: 'linear-gradient(135deg, #c9a24b 0%, #a5822f 100%)',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '14px',
    fontWeight: '700',
    flexShrink: 0
  },
  listItemInfo: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    minWidth: 0
  },
  listItemName: {
    color: '#1a1410',
    fontSize: '14px',
    fontWeight: '600',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis'
  },
  listItemMeta: {
    color: '#6b6155',
    fontSize: '12px',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis'
  },
  listItemPrice: {
    color: '#10b981',
    fontSize: '12px',
    fontWeight: '600'
  },

  // Bottom Row
  bottomRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '24px'
  },

  // Export Button
  exportBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '10px 14px',
    background: '#f3f0ea',
    color: '#1a1410',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontWeight: '600',
    fontSize: '13px',
    transition: 'all 0.2s'
  },

  // Pricing Grid
  pricingGrid: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px'
  },
  pricingBadge: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '8px 12px',
    background: '#f3f0ea',
    borderRadius: '8px',
    border: '1px solid #e8e2d8',
    minWidth: '70px'
  },
  pricingDuration: {
    fontSize: '10px',
    color: '#6b6155',
    fontWeight: '600',
    textTransform: 'uppercase'
  },
  pricingPrice: {
    fontSize: '14px',
    color: '#10b981',
    fontWeight: '700',
    marginTop: '2px'
  },

  // Pricing form fields
  pricingFieldsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(5, 1fr)',
    gap: '8px'
  },
  pricingFieldItem: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '10px 6px',
    background: '#f3f0ea',
    borderRadius: '10px',
    border: '1px solid #e8e2d8'
  },
  pricingFieldLabel: {
    fontSize: '11px',
    color: '#6b6155',
    fontWeight: '600',
    marginBottom: '6px'
  },
  pricingFieldInput: {
    width: '100%',
    padding: '8px 4px',
    border: '1px solid #e8e2d8',
    borderRadius: '6px',
    fontSize: '14px',
    fontWeight: '700',
    textAlign: 'center',
    outline: 'none',
    background: '#ffffff',
    color: '#10b981',
    transition: 'all 0.2s'
  },
  pricingFieldUnit: {
    fontSize: '10px',
    color: '#6b6155',
    fontWeight: '600',
    marginTop: '4px'
  },

  // Legacy styles below
  container: {
    minHeight: '100vh',
    background: '#f7f5f2',
    padding: '0',
    margin: '0',
    width: '100%'
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    background: '#ffffff',
    padding: '20px 30px',
    borderRadius: '0',
    marginBottom: '0',
    boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
    borderBottom: '1px solid #e8e2d8'
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px'
  },
  logoContainer: {
    width: '56px',
    height: '56px',
    background: '#c9a24b',
    borderRadius: '14px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 2px 8px rgba(201, 162, 75, 0.3)'
  },
  title: {
    margin: 0,
    fontSize: '26px',
    fontWeight: '800',
    color: '#1a1410'
  },
  subtitle: {
    margin: '4px 0 0 0',
    fontSize: '13px',
    color: '#6b6155',
    fontWeight: '500'
  },
  headerRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '20px'
  },
  userInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px'
  },
  userAvatar: {
    width: '48px',
    height: '48px',
    borderRadius: '50%',
    background: '#c9a24b',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '18px',
    fontWeight: '800',
    boxShadow: '0 2px 8px rgba(201, 162, 75, 0.3)'
  },
  userName: {
    fontWeight: '700',
    fontSize: '14px',
    color: '#1a1410'
  },
  userRole: {
    fontSize: '12px',
    color: '#6b6155',
    fontWeight: '500'
  },
  logoutBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '11px 22px',
    background: '#ef4444',
    color: '#fff',
    border: 'none',
    borderRadius: '10px',
    cursor: 'pointer',
    fontWeight: '700',
    fontSize: '14px',
    transition: 'all 0.3s',
    boxShadow: '0 2px 8px rgba(239, 68, 68, 0.3)'
  },
  statsContainer: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
    gap: '20px',
    padding: '20px 30px',
    background: '#f7f5f2',
    width: '100%'
  },
  statCard: {
    background: '#ffffff',
    borderRadius: '16px',
    padding: '24px',
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
    transition: 'all 0.3s',
    border: '1px solid #e8e2d8'
  },
  statCardActive: {
    transform: 'translateY(-4px)',
    boxShadow: '0 4px 16px rgba(201, 162, 75, 0.3)',
    background: '#ffffff'
  },
  statCardHover: {
    transform: 'translateY(-6px)',
    boxShadow: '0 8px 24px rgba(201, 162, 75, 0.4)',
    borderColor: '#c9a24b'
  },
  statIcon: {
    width: '56px',
    height: '56px',
    borderRadius: '14px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#fff',
    flexShrink: 0
  },
  statContent: {
    flex: 1
  },
  statValue: {
    fontSize: '32px',
    fontWeight: '800',
    color: '#1a1410',
    lineHeight: 1
  },
  statTitle: {
    fontSize: '13px',
    color: '#6b6155',
    marginTop: '6px',
    fontWeight: '600'
  },
  mainContent: {
    background: '#f7f5f2',
    borderRadius: '0',
    padding: '30px',
    minHeight: 'calc(100vh - 240px)',
    width: '100%'
  },
  toolbar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '24px',
    gap: '16px',
    flexWrap: 'wrap'
  },
  searchContainer: {
    position: 'relative',
    flex: '1 1 300px',
    maxWidth: '400px'
  },
  searchIcon: {
    position: 'absolute',
    left: '14px',
    top: '50%',
    transform: 'translateY(-50%)',
    color: '#6b6155'
  },
  searchInput: {
    width: '100%',
    padding: '12px 14px 12px 44px',
    border: '2px solid #e8e2d8',
    borderRadius: '12px',
    fontSize: '14px',
    outline: 'none',
    transition: 'all 0.3s',
    fontWeight: '500',
    background: '#ffffff',
    color: '#1a1410'
  },
  toolbarActions: {
    display: 'flex',
    gap: '12px',
    flexWrap: 'wrap'
  },
  refreshBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '12px 20px',
    background: '#ffffff',
    color: '#c9a24b',
    border: '2px solid #c9a24b',
    borderRadius: '10px',
    cursor: 'pointer',
    fontWeight: '700',
    fontSize: '14px',
    transition: 'all 0.3s'
  },
  createBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '12px 24px',
    background: '#c9a24b',
    color: '#fff',
    border: 'none',
    borderRadius: '10px',
    cursor: 'pointer',
    fontWeight: '700',
    fontSize: '14px',
    transition: 'all 0.3s',
    boxShadow: '0 2px 8px rgba(201, 162, 75, 0.3)'
  },
  tableWrapper: {
    overflowX: 'auto',
    borderRadius: '12px',
    border: '1px solid #e8e2d8'
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    background: '#ffffff'
  },
  th: {
    background: '#f3f0ea',
    padding: '16px 20px',
    textAlign: 'left',
    fontSize: '13px',
    fontWeight: '800',
    color: '#6b6155',
    textTransform: 'uppercase',
    borderBottom: '2px solid #e8e2d8',
    letterSpacing: '0.5px'
  },
  tr: {
    borderBottom: '1px solid #e8e2d8',
    transition: 'all 0.3s ease'
  },
  trHover: {
    background: '#f3f0ea',
    transform: 'scale(1.01)',
    boxShadow: '0 4px 12px rgba(0,0,0,0.08)'
  },
  td: {
    padding: '18px 20px',
    fontSize: '14px',
    color: '#3a3428',
    fontWeight: '500',
    transition: 'all 0.3s ease'
  },
  userCell: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px'
  },
  miniAvatar: {
    width: '36px',
    height: '36px',
    borderRadius: '50%',
    background: '#c9a24b',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '14px',
    fontWeight: '700'
  },
  actionBtns: {
    display: 'flex',
    gap: '8px'
  },
  editIconBtn: {
    padding: '10px',
    background: '#3b82f6',
    color: '#fff',
    border: 'none',
    borderRadius: '10px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.3s ease'
  },
  editIconBtnHover: {
    background: '#2563eb',
    transform: 'scale(1.15) rotate(5deg)',
    boxShadow: '0 4px 12px rgba(59, 130, 246, 0.5)'
  },
  deleteIconBtn: {
    padding: '10px',
    background: '#ef4444',
    color: '#fff',
    border: 'none',
    borderRadius: '10px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.3s ease'
  },
  deleteIconBtnHover: {
    background: '#dc2626',
    transform: 'scale(1.15) rotate(-5deg)',
    boxShadow: '0 4px 12px rgba(239, 68, 68, 0.5)'
  },
  priceTag: {
    fontWeight: '700',
    color: '#10b981'
  },
  loading: {
    textAlign: 'center',
    padding: '80px',
    fontSize: '16px',
    color: '#6b6155',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '16px'
  },
  emptyState: {
    textAlign: 'center',
    padding: '80px',
    fontSize: '16px',
    color: '#6b6155',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '16px'
  },
  skeleton: {
    background: 'linear-gradient(90deg, #eee9e0 25%, #f6f3ee 50%, #eee9e0 75%)',
    backgroundSize: '200% 100%',
    animation: 'shimmer 1.5s infinite',
    borderRadius: '6px',
    height: '20px',
    width: '100%'
  },
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0, 0, 0, 0.6)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    backdropFilter: 'blur(4px)',
    animation: 'fadeIn 0.2s'
  },
  modalContent: {
    background: '#ffffff',
    borderRadius: '16px',
    padding: '0',
    width: '90%',
    maxWidth: '420px',
    boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
    animation: 'slideUp 0.3s',
    border: '1px solid #e8e2d8'
  },
  modalHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px 20px',
    borderBottom: '1px solid #e8e2d8'
  },
  modalTitle: {
    margin: 0,
    fontSize: '16px',
    fontWeight: '700',
    color: '#1a1410'
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: '#6b6155',
    padding: '4px',
    borderRadius: '6px',
    transition: 'all 0.2s'
  },
  deleteModalHeader: {
    textAlign: 'center',
    padding: '30px 30px 0 30px'
  },
  deleteModalTitle: {
    margin: '16px 0 12px 0',
    fontSize: '22px',
    fontWeight: '800',
    color: '#1a1410',
    textAlign: 'center'
  },
  deleteModalText: {
    margin: '0 0 24px 0',
    fontSize: '15px',
    color: '#6b6155',
    textAlign: 'center',
    padding: '0 30px',
    lineHeight: '1.6'
  },
  deleteModalActions: {
    display: 'flex',
    gap: '12px',
    padding: '0 30px 30px 30px'
  },
  cancelBtnModal: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    padding: '14px',
    background: '#f3f0ea',
    color: '#1a1410',
    border: 'none',
    borderRadius: '10px',
    cursor: 'pointer',
    fontWeight: '700',
    fontSize: '14px',
    transition: 'all 0.2s'
  },
  deleteBtnModal: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    padding: '14px',
    background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
    color: '#fff',
    border: 'none',
    borderRadius: '10px',
    cursor: 'pointer',
    fontWeight: '700',
    fontSize: '14px',
    transition: 'all 0.2s'
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
    padding: '24px 30px 30px 30px'
  },
  formCompact: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    padding: '16px 20px 20px 20px'
  },
  formGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    flex: 1
  },
  formRow: {
    display: 'flex',
    gap: '12px'
  },
  label: {
    fontSize: '13px',
    fontWeight: '700',
    color: '#6b6155',
    textTransform: 'uppercase',
    letterSpacing: '0.5px'
  },
  labelSmall: {
    fontSize: '11px',
    fontWeight: '700',
    color: '#6b6155',
    textTransform: 'uppercase',
    letterSpacing: '0.3px'
  },
  input: {
    padding: '12px 14px',
    border: '2px solid #e8e2d8',
    borderRadius: '10px',
    fontSize: '14px',
    outline: 'none',
    transition: 'all 0.3s',
    fontWeight: '500',
    background: '#ffffff',
    color: '#1a1410'
  },
  inputSmall: {
    padding: '10px 12px',
    border: '1px solid #e8e2d8',
    borderRadius: '8px',
    fontSize: '13px',
    outline: 'none',
    transition: 'all 0.3s',
    fontWeight: '500',
    background: '#ffffff',
    color: '#1a1410'
  },
  error: {
    padding: '14px',
    background: 'rgba(239, 68, 68, 0.1)',
    border: '2px solid rgba(239, 68, 68, 0.3)',
    borderRadius: '10px',
    color: '#b91c1c',
    fontSize: '14px',
    fontWeight: '700'
  },
  errorSmall: {
    padding: '8px 12px',
    background: 'rgba(239, 68, 68, 0.1)',
    border: '1px solid rgba(239, 68, 68, 0.3)',
    borderRadius: '6px',
    color: '#b91c1c',
    fontSize: '12px',
    fontWeight: '600'
  },
  modalActions: {
    display: 'flex',
    gap: '12px',
    marginTop: '10px'
  },
  cancelBtn: {
    flex: 1,
    padding: '14px',
    background: '#f3f0ea',
    color: '#1a1410',
    border: 'none',
    borderRadius: '10px',
    cursor: 'pointer',
    fontWeight: '700',
    fontSize: '14px',
    transition: 'all 0.2s'
  },
  submitBtn: {
    flex: 1,
    padding: '14px',
    background: '#c9a24b',
    color: '#fff',
    border: 'none',
    borderRadius: '10px',
    cursor: 'pointer',
    fontWeight: '700',
    fontSize: '14px',
    transition: 'all 0.2s'
  },
  modalActionsCompact: {
    display: 'flex',
    gap: '10px',
    marginTop: '8px'
  },
  cancelBtnSmall: {
    flex: 1,
    padding: '10px',
    background: '#f3f0ea',
    color: '#1a1410',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontWeight: '600',
    fontSize: '13px',
    transition: 'all 0.2s'
  },
  submitBtnSmall: {
    flex: 1,
    padding: '10px',
    background: '#c9a24b',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontWeight: '600',
    fontSize: '13px',
    transition: 'all 0.2s'
  }
};

export default SuperAdminDashboard;
