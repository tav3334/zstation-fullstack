import { useCallback, useEffect, useState } from "react";
import {
  Crown,
  Package,
  LogOut,
  Calendar,
  BarChart3,
  TrendingUp,
  CalendarDays,
  RefreshCw,
  DollarSign,
  ShoppingBag,
  Activity,
  ShoppingCart,
  Zap,
  Monitor,
  Gamepad2,
  Clock,
  FileSpreadsheet,
  FileText,
  User,
  ChevronLeft,
  ChevronRight,
  LayoutDashboard,
  History,
  Wallet,
  Scissors,
  Users,
  ArrowLeftRight,
  UserPlus
} from "lucide-react";
import api from "../services/api";
import Toast from "../components/Toast";
import ServicesManagement from "./ServicesManagement";
import CoiffeursManagement from "./CoiffeursManagement";
import SalonStockManagement from "./SalonStockManagement";
import SalesHistoryPage from "./SalesHistoryPage";
import StockMovementsPage from "./StockMovementsPage";
import TeamManagement from "./TeamManagement";
import MachinesGamesManagement from "./MachinesGamesManagement";
import UserProfile from "../components/UserProfile";
import SubscriptionBanner from "../components/SubscriptionBanner";
import PricingPage from "./PricingPage";
import OrganizationSettings from "./OrganizationSettings";
import CustomersManagement from "./CustomersManagement";
import PosPage from "./PosPage";
import StaffPerformancePage from "./StaffPerformancePage";
import ActivityLogPage from "./ActivityLogPage";
import { clearReopenPos, shouldReopenPos } from "../utils/session";

function AdminDashboard({ user, onLogout, onUserUpdated }) {
  const [stats, setStats] = useState(null);
  const [payments, setPayments] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [filter, setFilter] = useState("today");
  const [loading, setLoading] = useState(true);
  const [customDateStart, setCustomDateStart] = useState("");
  const [customDateEnd, setCustomDateEnd] = useState("");
  const [showCustomDate, setShowCustomDate] = useState(false);
  const [toast, setToast] = useState(null);
  const [showServicesManagement, setShowServicesManagement] = useState(false);
  const [showCoiffeursManagement, setShowCoiffeursManagement] = useState(false);
  const [showSalonStock, setShowSalonStock] = useState(false);
  const [showSalesHistoryPage, setShowSalesHistoryPage] = useState(false);
  const [showStockMovements, setShowStockMovements] = useState(false);
  const [showTeamManagement, setShowTeamManagement] = useState(false);
  const [showCustomersManagement, setShowCustomersManagement] = useState(false);
  const [showMachinesGames, setShowMachinesGames] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showPos, setShowPos] = useState(shouldReopenPos);
  const [showStaffPerformance, setShowStaffPerformance] = useState(false);
  const [showActivityLog, setShowActivityLog] = useState(false);
  const [showSubscription, setShowSubscription] = useState(false);
  const [subscriptionStatus, setSubscriptionStatus] = useState(null);
  const [showOrgSettings, setShowOrgSettings] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [activeTab, setActiveTab] = useState('dashboard');
  const [cashRegister, setCashRegister] = useState(null);

  // Drapeau « rouvrir la caisse » posé par un changement de caissier : à usage unique
  useEffect(() => {
    clearReopenPos();
  }, []);

  const showToast = useCallback((message, type = "info", duration = 3000) => {
    setToast({ message, type, duration });
  }, []);

  const loadSubscriptionStatus = useCallback(async () => {
    try {
      const res = await api.get('/subscription/status');
      setSubscriptionStatus(res.data);
    } catch {
      setSubscriptionStatus(null);
    }
  }, []);

  // Horloge temps réel
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (filter === "custom" && customDateStart && customDateEnd) {
        params.start_date = customDateStart;
        params.end_date = customDateEnd;
      } else if (filter !== "custom") {
        params.period = filter;
      }

      const [statsRes, paymentsRes, sessionsRes, cashRes] = await Promise.all([
        api.get("/dashboard/stats", { params }),
        api.get("/dashboard/payments", { params: { ...params, limit: 20 } }),
        api.get("/dashboard/sessions", { params: { ...params, limit: 20 } }),
        api.get("/cash-register/today").catch(() => ({ data: { register: null } }))
      ]);

      setStats(statsRes.data);
      setPayments(paymentsRes.data.payments || []);
      setSessions(sessionsRes.data.sessions || []);
      setCashRegister(cashRes.data.register || null);
      setLoading(false);
    } catch (e) {
      showToast("Erreur de chargement: " + (e.response?.data?.message || e.message), "error");
      setLoading(false);
    }
  }, [customDateEnd, customDateStart, filter, showToast]);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, [loadData]);

  const applyCustomFilter = () => {
    if (!customDateStart || !customDateEnd) {
      showToast("Veuillez sélectionner une date de début et de fin", "warning");
      return;
    }
    setFilter("custom");
    setShowCustomDate(false);
    showToast("Filtre personnalisé appliqué", "success");
    loadData();
  };

  const exportToExcel = async () => {
    try {
      const XLSX = await import('xlsx');
      const wb = XLSX.utils.book_new();

      const periodText = filter === 'today' ? 'Aujourd\'hui' : filter === 'week' ? '7 Jours' : filter === 'month' ? '30 Jours' : 'Personnalisé';
      const totalRevenue = (stats?.stats?.total_revenue || 0) + (stats?.stats?.product_revenue || 0);

      // Feuille 1: Résumé
      const statsData = [
        ['TONSOR - RAPPORT STATISTIQUES'],
        [''],
        ['Période', periodText],
        ['Date d\'export', new Date().toLocaleString('fr-FR')],
        [''],
        ['RECETTES'],
        ['Sessions', `${(stats?.stats?.total_revenue || 0).toFixed(2)} DH`],
        ['Produits', `${(stats?.stats?.product_revenue || 0).toFixed(2)} DH`],
        ['TOTAL', `${totalRevenue.toFixed(2)} DH`],
        [''],
        ['ACTIVITÉ'],
        ['Nombre de Sessions', stats?.stats?.total_sessions || 0],
        ['Ventes Produits', stats?.stats?.total_product_sales || 0],
        ['Sessions Actives', stats?.stats?.active_sessions || 0],
        ['Machines Disponibles', `${stats?.stats?.available_machines || 0}/${stats?.stats?.total_machines || 0}`],
      ];
      const ws1 = XLSX.utils.aoa_to_sheet(statsData);
      ws1['!cols'] = [{ wch: 25 }, { wch: 20 }];
      XLSX.utils.book_append_sheet(wb, ws1, 'Résumé');

      // Feuille 2: Top Jeux
      const gamesData = [
        ['TOP JEUX'],
        [''],
        ['#', 'Jeu', 'Sessions', 'Recettes (DH)'],
        ...(stats?.top_games || []).map((game, idx) => [
          idx + 1, game.game_name, game.sessions_count, `${game.total_revenue.toFixed(2)}`
        ])
      ];
      const ws2 = XLSX.utils.aoa_to_sheet(gamesData);
      ws2['!cols'] = [{ wch: 5 }, { wch: 30 }, { wch: 12 }, { wch: 15 }];
      XLSX.utils.book_append_sheet(wb, ws2, 'Top Jeux');

      // Feuille 3: Top Produits
      const productsData = [
        ['TOP PRODUITS'],
        [''],
        ['#', 'Produit', 'Qté Vendue', 'Recettes (DH)'],
        ...(stats?.top_products || []).map((product, idx) => [
          idx + 1, product.product_name, product.total_quantity, `${product.total_revenue.toFixed(2)}`
        ])
      ];
      const ws3 = XLSX.utils.aoa_to_sheet(productsData);
      ws3['!cols'] = [{ wch: 5 }, { wch: 30 }, { wch: 12 }, { wch: 15 }];
      XLSX.utils.book_append_sheet(wb, ws3, 'Top Produits');

      const dateStr = new Date().toLocaleDateString('fr-FR').replace(/\//g, '-');
      const fileName = `Tonsor_Stats_${periodText.replace(/\s/g, '_')}_${dateStr}.xlsx`;
      XLSX.writeFile(wb, fileName);
      showToast("Export Excel réussi!", "success");
    } catch {
      showToast("Erreur lors de l'export Excel", "error");
    }
  };

  const exportToPDF = async () => {
    try {
      const { jsPDF } = await import('jspdf');
      const autoTable = (await import('jspdf-autotable')).default;

      const doc = new jsPDF();
      const periodText = filter === 'today' ? 'Aujourd\'hui' : filter === 'week' ? '7 Jours' : filter === 'month' ? '30 Jours' : 'Personnalisé';
      const totalRevenue = (stats?.stats?.total_revenue || 0) + (stats?.stats?.product_revenue || 0);

      // Header avec couleur orange (Admin)
      doc.setFontSize(22);
      doc.setTextColor(245, 158, 11); // Orange
      doc.text('TONSOR', 105, 18, { align: 'center' });
      doc.setFontSize(14);
      doc.setTextColor(100, 100, 100);
      doc.text('Rapport de Statistiques', 105, 26, { align: 'center' });

      // Infos période
      doc.setFontSize(11);
      doc.setTextColor(0, 0, 0);
      doc.text(`Periode: ${periodText}`, 14, 40);
      doc.text(`Date: ${new Date().toLocaleString('fr-FR')}`, 14, 47);

      // Tableau Recettes
      let lastY = 55;
      autoTable(doc, {
        startY: lastY,
        head: [['RECETTES', 'Montant']],
        body: [
          ['Sessions', `${(stats?.stats?.total_revenue || 0).toFixed(2)} DH`],
          ['Produits', `${(stats?.stats?.product_revenue || 0).toFixed(2)} DH`],
          ['TOTAL', `${totalRevenue.toFixed(2)} DH`],
        ],
        theme: 'grid',
        headStyles: { fillColor: [245, 158, 11] },
        styles: { fontSize: 11 },
        columnStyles: { 1: { halign: 'right' } },
      });
      lastY = doc.lastAutoTable.finalY + 10;

      // Tableau Activité
      autoTable(doc, {
        startY: lastY,
        head: [['ACTIVITE', 'Valeur']],
        body: [
          ['Sessions', `${stats?.stats?.total_sessions || 0}`],
          ['Ventes Produits', `${stats?.stats?.total_product_sales || 0}`],
          ['Sessions Actives', `${stats?.stats?.active_sessions || 0}`],
          ['Machines Dispo.', `${stats?.stats?.available_machines || 0}/${stats?.stats?.total_machines || 0}`],
        ],
        theme: 'grid',
        headStyles: { fillColor: [245, 158, 11] },
        styles: { fontSize: 11 },
        columnStyles: { 1: { halign: 'right' } },
      });
      lastY = doc.lastAutoTable.finalY + 10;

      // Top Jeux si disponible
      if (stats?.top_games?.length > 0) {
        autoTable(doc, {
          startY: lastY,
          head: [['#', 'Top Jeux', 'Sessions', 'Recettes']],
          body: stats.top_games.slice(0, 5).map((game, idx) => [
            idx + 1,
            game.game_name,
            game.sessions_count,
            `${game.total_revenue.toFixed(2)} DH`
          ]),
          theme: 'grid',
          headStyles: { fillColor: [59, 130, 246] },
          styles: { fontSize: 10 },
        });
        lastY = doc.lastAutoTable.finalY + 10;
      }

      // Top Produits si disponible
      if (stats?.top_products?.length > 0) {
        autoTable(doc, {
          startY: lastY,
          head: [['#', 'Top Produits', 'Qte', 'Recettes']],
          body: stats.top_products.slice(0, 5).map((product, idx) => [
            idx + 1,
            product.product_name,
            product.total_quantity,
            `${product.total_revenue.toFixed(2)} DH`
          ]),
          theme: 'grid',
          headStyles: { fillColor: [224, 184, 92] },
          styles: { fontSize: 10 },
        });
      }

      const dateStr = new Date().toLocaleDateString('fr-FR').replace(/\//g, '-');
      const fileName = `Tonsor_Stats_${periodText.replace(/\s/g, '_')}_${dateStr}.pdf`;
      doc.save(fileName);
      showToast("Export PDF reussi!", "success");
    } catch (error) {
      console.error('PDF Export Error:', error);
      showToast("Erreur lors de l'export PDF", "error");
    }
  };

  // Menu items — certains sont conditionnés aux modules activés pour l'organisation
  const modules = user?.modules || { gaming: true, coiffure: true, stock: true };
  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'pos', label: 'Caisse', icon: ShoppingCart },
    modules.coiffure && { id: 'services', label: 'Prestations', icon: Scissors },
    modules.coiffure && { id: 'coiffeurs', label: 'Coiffeurs', icon: Users },
    modules.stock && { id: 'salon-stock', label: 'Stock Produits', icon: Package },
    { id: 'sales-history', label: 'Historique Ventes', icon: History },
    { id: 'customers', label: 'Clients', icon: UserPlus },
    { id: 'stock-movements', label: 'Mouvements Stock', icon: ArrowLeftRight },
    { id: 'team', label: 'Mon Équipe', icon: Users },
    { id: 'staff-performance', label: 'Performance équipe', icon: TrendingUp },
    { id: 'activity-log', label: "Journal d'activité", icon: Activity },
    modules.gaming && { id: 'machines-games', label: 'Machines & Jeux', icon: Gamepad2 },
    { id: 'org-settings', label: 'Informations légales', icon: FileText },
    { id: 'subscription', label: 'Abonnement', icon: Crown },
    { id: 'profile', label: 'Mon Profil', icon: User },
  ].filter(Boolean);

  if (showStaffPerformance) {
    return <StaffPerformancePage onBack={() => setShowStaffPerformance(false)} modules={modules} />;
  }

  if (showActivityLog) {
    return <ActivityLogPage onBack={() => setShowActivityLog(false)} />;
  }

  if (showPos) {
    return <PosPage user={user} onBack={() => setShowPos(false)} />;
  }

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

  if (showTeamManagement) {
    return <TeamManagement onBack={() => setShowTeamManagement(false)} currentUser={user} />;
  }

  if (showCustomersManagement) {
    return <CustomersManagement onBack={() => setShowCustomersManagement(false)} />;
  }

  if (showMachinesGames) {
    return <MachinesGamesManagement onBack={() => setShowMachinesGames(false)} />;
  }

  if (showOrgSettings) {
    return <OrganizationSettings onBack={() => setShowOrgSettings(false)} />;
  }

  if (showSubscription) {
    return (
      <PricingPage
        user={user}
        onBack={() => setShowSubscription(false)}
        currentPlan={subscriptionStatus?.subscription?.plan?.name}
        subscriptionStatus={subscriptionStatus}
        onSubscriptionChanged={loadSubscriptionStatus}
      />
    );
  }

  if (loading && !stats) {
    return (
      <div style={styles.loadingContainer}>
        <RefreshCw size={32} color="#f59e0b" className="spin" />
        <p style={styles.loadingText}>Chargement du dashboard...</p>
      </div>
    );
  }

  return (
    <div className="z-app-container" style={styles.appContainer}>
      {/* Toast */}
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
              <span style={styles.logoSubtitle}>Admin Panel</span>
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
                if (item.id === 'services') {
                  setShowServicesManagement(true);
                } else if (item.id === 'coiffeurs') {
                  setShowCoiffeursManagement(true);
                } else if (item.id === 'salon-stock') {
                  setShowSalonStock(true);
                } else if (item.id === 'sales-history') {
                  setShowSalesHistoryPage(true);
                } else if (item.id === 'customers') {
                  setShowCustomersManagement(true);
                } else if (item.id === 'stock-movements') {
                  setShowStockMovements(true);
                } else if (item.id === 'team') {
                  setShowTeamManagement(true);
                } else if (item.id === 'machines-games') {
                  setShowMachinesGames(true);
                } else if (item.id === 'org-settings') {
                  setShowOrgSettings(true);
                } else if (item.id === 'subscription') {
                  loadSubscriptionStatus();
                  setShowSubscription(true);
                } else if (item.id === 'staff-performance') {
                  setShowStaffPerformance(true);
                } else if (item.id === 'activity-log') {
                  setShowActivityLog(true);
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
                <span style={styles.menuLabel}>{item.label}</span>
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
            <h1 style={styles.pageTitle}>Dashboard Admin</h1>
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
              <Crown size={14} style={{color: '#f59e0b'}} />
              <span style={styles.userNameSmall}>{user.name}</span>
            </div>
            <button style={styles.logoutBtnSmall} onClick={onLogout}>
              <LogOut size={18} />
            </button>
          </div>
        </header>

        {/* Subscription Banner */}
        <div style={{ padding: '16px 24px 0 24px' }}>
          <SubscriptionBanner organizationId={user?.organization_id} />
        </div>

        {/* Filter Bar */}
        <div style={styles.filterBar}>
          <div style={styles.filterGroup}>
            {[
              { id: "today", icon: <Calendar size={16} />, label: "Aujourd'hui" },
              { id: "week", icon: <BarChart3 size={16} />, label: "7 Jours" },
              { id: "month", icon: <TrendingUp size={16} />, label: "30 Jours" }
            ].map((filterItem) => (
              <button
                key={filterItem.id}
                onClick={() => setFilter(filterItem.id)}
                style={{
                  ...styles.filterBtn,
                  ...(filter === filterItem.id ? styles.filterBtnActive : {})
                }}
              >
                {filterItem.icon}
                <span>{filterItem.label}</span>
              </button>
            ))}
            <button
              onClick={() => setShowCustomDate(!showCustomDate)}
              style={{
                ...styles.filterBtn,
                ...(filter === "custom" ? styles.filterBtnActive : {})
              }}
            >
              <CalendarDays size={16} />
              <span>Personnalisé</span>
            </button>
          </div>
          <div style={styles.filterGroup}>
            <button onClick={exportToExcel} style={styles.exportExcelBtn} disabled={loading || !stats}>
              <FileSpreadsheet size={16} />
              <span>Excel</span>
            </button>
            <button onClick={exportToPDF} style={styles.exportPdfBtn} disabled={loading || !stats}>
              <FileText size={16} />
              <span>PDF</span>
            </button>
            <button onClick={loadData} style={styles.refreshBtn} disabled={loading}>
              <RefreshCw size={16} className={loading ? 'spin' : ''} />
            </button>
          </div>
        </div>

        {/* Custom Date Picker */}
        {showCustomDate && (
          <div style={styles.customDatePicker}>
            <h4 style={styles.datePickerTitle}><Calendar size={20} /> Sélectionner une période</h4>
            <div style={styles.dateInputs}>
              <div style={styles.dateInputGroup}>
                <label style={styles.dateLabel}>Date de début</label>
                <input
                  type="date"
                  value={customDateStart}
                  onChange={(e) => setCustomDateStart(e.target.value)}
                  style={styles.dateInput}
                />
              </div>
              <div style={styles.dateInputGroup}>
                <label style={styles.dateLabel}>Date de fin</label>
                <input
                  type="date"
                  value={customDateEnd}
                  onChange={(e) => setCustomDateEnd(e.target.value)}
                  style={styles.dateInput}
                />
              </div>
            </div>
            <div style={styles.datePickerActions}>
              <button onClick={applyCustomFilter} style={styles.applyBtn}>Appliquer</button>
              <button onClick={() => setShowCustomDate(false)} style={styles.cancelBtn}>Annuler</button>
            </div>
          </div>
        )}

        {/* Content */}
        <main className="z-content" style={styles.content}>
          {/* Stats Grid */}
          <div className="z-stats-grid" style={styles.statsGrid}>
            <StatCard
              icon={<DollarSign size={22} />}
              label="Recettes Sessions"
              value={(stats?.stats?.total_revenue || 0).toFixed(2) + " DH"}
              color="#10b981"
              bgColor="rgba(16, 185, 129, 0.1)"
            />
            <StatCard
              icon={<ShoppingBag size={22} />}
              label="Recettes Produits"
              value={(stats?.stats?.product_revenue || 0).toFixed(2) + " DH"}
              color="#f59e0b"
              bgColor="rgba(245, 158, 11, 0.1)"
            />
            <StatCard
              icon={<Scissors size={22} />}
              label="Recettes Prestations"
              value={(stats?.stats?.service_revenue || 0).toFixed(2) + " DH"}
              color="#c9a24b"
              bgColor="rgba(201, 162, 75, 0.1)"
            />
            <StatCard
              icon={<Activity size={22} />}
              label="Sessions"
              value={stats?.stats?.total_sessions || 0}
              color="#3b82f6"
              bgColor="rgba(59, 130, 246, 0.1)"
            />
            <StatCard
              icon={<ShoppingCart size={22} />}
              label="Ventes Produits"
              value={stats?.stats?.total_product_sales || 0}
              color="#ec4899"
              bgColor="rgba(236, 72, 153, 0.1)"
            />
            <StatCard
              icon={<Scissors size={22} />}
              label="Ventes Prestations"
              value={stats?.stats?.total_service_sales || 0}
              color="#a5822f"
              bgColor="rgba(165, 130, 47, 0.1)"
            />
            <StatCard
              icon={<Zap size={22} />}
              label="Sessions Actives"
              value={stats?.stats?.active_sessions || 0}
              color="#14b8a6"
              bgColor="rgba(20, 184, 166, 0.1)"
            />
            <StatCard
              icon={<Monitor size={22} />}
              label="Machines"
              value={`${stats?.stats?.available_machines || 0}/${stats?.stats?.total_machines || 0}`}
              color="#e0b85c"
              bgColor="rgba(224, 184, 92, 0.1)"
            />
            <StatCard
              icon={<Wallet size={22} />}
              label="Solde en Caisse"
              value={(cashRegister?.current_balance || 0).toFixed(2) + " DH"}
              color="#f59e0b"
              bgColor="rgba(245, 158, 11, 0.15)"
              highlight={true}
            />
          </div>

          {/* Details Grid */}
          <div className="z-details-grid" style={styles.detailsGrid}>
            {/* Top Games */}
            <div style={styles.card}>
              <div style={styles.cardHeader}>
                <h3 style={styles.cardTitle}>
                  <Gamepad2 size={18} /> Top Jeux
                </h3>
              </div>
              <div style={styles.cardBody}>
                {(stats?.top_games || []).map((game, idx) => (
                  <div key={game.game_id} style={styles.listItem}>
                    <div style={styles.listItemLeft}>
                      <div style={styles.listItemRank}>{idx + 1}</div>
                      <div>
                        <div style={styles.listItemTitle}>{game.game_name}</div>
                        <div style={styles.listItemSubtitle}>{game.sessions_count} sessions</div>
                      </div>
                    </div>
                    <div style={styles.listItemAmount}>{game.total_revenue.toFixed(2)} DH</div>
                  </div>
                ))}
                {(!stats?.top_games || stats.top_games.length === 0) && (
                  <div style={styles.emptyState}>Aucune donnée disponible</div>
                )}
              </div>
            </div>

            {/* Top Products */}
            <div style={styles.card}>
              <div style={styles.cardHeader}>
                <h3 style={styles.cardTitle}>
                  <ShoppingBag size={18} /> Top Produits
                </h3>
              </div>
              <div style={styles.cardBody}>
                {(stats?.top_products || []).map((product, idx) => (
                  <div key={product.product_name} style={styles.listItem}>
                    <div style={styles.listItemLeft}>
                      <div style={{...styles.listItemRank, background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b'}}>{idx + 1}</div>
                      <div>
                        <div style={styles.listItemTitle}>{product.product_name}</div>
                        <div style={styles.listItemSubtitle}>{product.total_quantity} vendus</div>
                      </div>
                    </div>
                    <div style={{...styles.listItemAmount, color: '#f59e0b'}}>{product.total_revenue.toFixed(2)} DH</div>
                  </div>
                ))}
                {(!stats?.top_products || stats.top_products.length === 0) && (
                  <div style={styles.emptyState}>Aucune donnée disponible</div>
                )}
              </div>
            </div>

            {/* Top Services */}
            <div style={styles.card}>
              <div style={styles.cardHeader}>
                <h3 style={styles.cardTitle}>
                  <Scissors size={18} /> Top Prestations
                </h3>
              </div>
              <div style={styles.cardBody}>
                {(stats?.top_services || []).map((service, idx) => (
                  <div key={service.service_name} style={styles.listItem}>
                    <div style={styles.listItemLeft}>
                      <div style={{...styles.listItemRank, background: 'rgba(201, 162, 75, 0.1)', color: '#c9a24b'}}>{idx + 1}</div>
                      <div>
                        <div style={styles.listItemTitle}>{service.service_name}</div>
                        <div style={styles.listItemSubtitle}>{service.total_quantity} vendues</div>
                      </div>
                    </div>
                    <div style={{...styles.listItemAmount, color: '#c9a24b'}}>{service.total_revenue.toFixed(2)} DH</div>
                  </div>
                ))}
                {(!stats?.top_services || stats.top_services.length === 0) && (
                  <div style={styles.emptyState}>Aucune donnée disponible</div>
                )}
              </div>
            </div>

            {/* Revenue by Method */}
            <div style={styles.card}>
              <div style={styles.cardHeader}>
                <h3 style={styles.cardTitle}>
                  <DollarSign size={18} /> Paiements Sessions
                </h3>
              </div>
              <div style={styles.cardBody}>
                {(stats?.revenue_by_method || []).map((item, idx) => (
                  <div key={idx} style={styles.listItem}>
                    <div style={styles.listItemLeft}>
                      <div style={{
                        ...styles.methodIcon,
                        background: item.method === 'cash' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(59, 130, 246, 0.1)'
                      }}>
                        {item.method === 'cash' ? '💵' : '💳'}
                      </div>
                      <div style={styles.listItemTitle}>
                        {item.method === 'cash' ? 'Espèces' : item.method === 'card' ? 'Carte' : 'Mobile'}
                      </div>
                    </div>
                    <div style={styles.listItemAmount}>{item.total.toFixed(2)} DH</div>
                  </div>
                ))}
                {(!stats?.revenue_by_method || stats.revenue_by_method.length === 0) && (
                  <div style={styles.emptyState}>Aucune donnée disponible</div>
                )}
              </div>
            </div>

            {/* Product Revenue by Method */}
            <div style={styles.card}>
              <div style={styles.cardHeader}>
                <h3 style={styles.cardTitle}>
                  <ShoppingCart size={18} /> Paiements Produits
                </h3>
              </div>
              <div style={styles.cardBody}>
                {(stats?.product_revenue_by_method || []).map((item, idx) => (
                  <div key={idx} style={styles.listItem}>
                    <div style={styles.listItemLeft}>
                      <div style={{
                        ...styles.methodIcon,
                        background: item.method === 'cash' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(59, 130, 246, 0.1)'
                      }}>
                        {item.method === 'cash' ? '💵' : '💳'}
                      </div>
                      <div style={styles.listItemTitle}>
                        {item.method === 'cash' ? 'Espèces' : item.method === 'card' ? 'Carte' : 'Mobile'}
                      </div>
                    </div>
                    <div style={{...styles.listItemAmount, color: '#f59e0b'}}>{item.total.toFixed(2)} DH</div>
                  </div>
                ))}
                {(!stats?.product_revenue_by_method || stats.product_revenue_by_method.length === 0) && (
                  <div style={styles.emptyState}>Aucune donnée disponible</div>
                )}
              </div>
            </div>
          </div>

          {/* Recent Payments */}
          <div style={styles.card}>
            <div style={styles.cardHeader}>
              <h3 style={styles.cardTitle}>
                <Clock size={18} /> Derniers Paiements
              </h3>
              <div style={styles.badge}>{payments.length} total</div>
            </div>
            <div style={styles.cardBody}>
              {payments.slice(0, 10).map((payment) => (
                <div key={payment.id} style={styles.paymentRow}>
                  <div style={styles.paymentInfo}>
                    <div style={styles.paymentMachine}>{payment.machine_name || "N/A"}</div>
                    <div style={styles.paymentGame}>
                      <Gamepad2 size={12} /> {payment.game_name || "N/A"}
                    </div>
                  </div>
                  <div style={{
                    ...styles.paymentMethod,
                    background: payment.payment_method === 'cash' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(59, 130, 246, 0.1)',
                    color: payment.payment_method === 'cash' ? '#10b981' : '#3b82f6'
                  }}>
                    {payment.payment_method === 'cash' ? '💵 Espèces' : '💳 Carte'}
                  </div>
                  <div style={styles.paymentAmountCol}>
                    <div style={styles.paymentAmount}>{payment.amount} DH</div>
                    <div style={styles.paymentDate}>
                      {new Date(payment.payment_date).toLocaleString('fr-FR', {
                        day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
                      })}
                    </div>
                  </div>
                </div>
              ))}
              {payments.length === 0 && (
                <div style={styles.emptyState}>Aucun paiement enregistré</div>
              )}
            </div>
          </div>

          {/* Recent Sessions */}
          <div style={{...styles.card, marginTop: '20px'}}>
            <div style={styles.cardHeader}>
              <h3 style={styles.cardTitle}>
                <Activity size={18} /> Dernières Sessions
              </h3>
              <div style={styles.badge}>{sessions.length} total</div>
            </div>
            <div style={styles.cardBody}>
              {sessions.slice(0, 10).map((session) => (
                <div key={session.id} style={styles.paymentRow}>
                  <div style={styles.paymentInfo}>
                    <div style={styles.paymentMachine}>{session.machine_name || "N/A"}</div>
                    <div style={styles.paymentGame}>
                      <Gamepad2 size={12} /> {session.game_name || "N/A"} • {session.customer_name || "Invité"}
                    </div>
                  </div>
                  <div style={{
                    ...styles.sessionStatus,
                    background: session.is_active ? 'rgba(245, 158, 11, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                    color: session.is_active ? '#f59e0b' : '#10b981'
                  }}>
                    {session.is_active ? '⏳ En cours' : '✅ Terminée'}
                  </div>
                  <div style={styles.paymentAmountCol}>
                    <div style={styles.paymentDate}>
                      {new Date(session.start_time).toLocaleString('fr-FR', {
                        day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
                      })}
                    </div>
                    {session.duration_minutes && (
                      <div style={styles.paymentGame}>{session.duration_minutes} min</div>
                    )}
                  </div>
                </div>
              ))}
              {sessions.length === 0 && (
                <div style={styles.emptyState}>Aucune session enregistrée</div>
              )}
            </div>
          </div>
        </main>
      </div>

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
            style={activeTab === item.id ? { color: '#f59e0b' } : {}}
            onClick={() => {
              if (item.id === 'services') {
                setShowServicesManagement(true);
              } else if (item.id === 'coiffeurs') {
                setShowCoiffeursManagement(true);
              } else if (item.id === 'salon-stock') {
                setShowSalonStock(true);
              } else if (item.id === 'sales-history') {
                setShowSalesHistoryPage(true);
              } else if (item.id === 'customers') {
                setShowCustomersManagement(true);
              } else if (item.id === 'stock-movements') {
                setShowStockMovements(true);
              } else if (item.id === 'team') {
                setShowTeamManagement(true);
              } else if (item.id === 'machines-games') {
                setShowMachinesGames(true);
              } else if (item.id === 'org-settings') {
                setShowOrgSettings(true);
              } else if (item.id === 'subscription') {
                loadSubscriptionStatus();
                setShowSubscription(true);
              } else if (item.id === 'staff-performance') {
                setShowStaffPerformance(true);
              } else if (item.id === 'activity-log') {
                setShowActivityLog(true);
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
          <span>Déco.</span>
        </button>
      </nav>
    </div>
  );
}

// Stat Card Component
function StatCard({ icon, label, value, color, bgColor, highlight }) {
  return (
    <div style={{
      ...styles.statCard,
      ...(highlight && {
        border: `2px solid ${color}`,
        background: 'linear-gradient(135deg, #ffffff 0%, rgba(245, 158, 11, 0.06) 100%)'
      })
    }}>
      <div style={{...styles.statIconBox, background: bgColor}}>
        <span style={{color}}>{icon}</span>
      </div>
      <div style={styles.statInfo}>
        <span style={styles.statLabel}>{label}</span>
        <span style={{...styles.statValue, color, ...(highlight && { fontSize: '24px' })}}>{value}</span>
      </div>
    </div>
  );
}

// Styles
const styles = {
  appContainer: {
    display: 'flex',
    minHeight: '100vh',
    background: '#f7f5f2',
    width: '100%'
  },

  loadingContainer: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#f7f5f2',
    gap: '16px'
  },
  loadingText: {
    color: '#6b6155',
    fontSize: '14px'
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
    background: 'linear-gradient(135deg, #f59e0b, #d97706)',
    borderRadius: '10px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    boxShadow: '0 0 20px rgba(245, 158, 11, 0.4)'
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
    background: '#f59e0b',
    color: '#fff'
  },
  menuLabel: {
    flex: 1
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
    background: '#f59e0b',
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

  // Filter Bar
  filterBar: {
    background: '#ffffff',
    padding: '16px 24px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '16px',
    flexWrap: 'wrap',
    borderBottom: '1px solid #e8e2d8'
  },
  filterGroup: {
    display: 'flex',
    gap: '10px',
    flexWrap: 'wrap'
  },
  filterBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 16px',
    background: '#f3f0ea',
    border: '1px solid #d9d2c4',
    borderRadius: '8px',
    color: '#6b6155',
    fontSize: '13px',
    fontWeight: '500',
    cursor: 'pointer',
    transition: 'all 0.2s'
  },
  filterBtnActive: {
    background: '#f59e0b',
    borderColor: '#f59e0b',
    color: '#fff'
  },
  exportExcelBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 16px',
    background: 'rgba(16, 185, 129, 0.1)',
    border: '1px solid rgba(16, 185, 129, 0.3)',
    borderRadius: '8px',
    color: '#10b981',
    fontSize: '13px',
    fontWeight: '500',
    cursor: 'pointer',
    transition: 'all 0.2s'
  },
  exportPdfBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 16px',
    background: 'rgba(239, 68, 68, 0.1)',
    border: '1px solid rgba(239, 68, 68, 0.3)',
    borderRadius: '8px',
    color: '#ef4444',
    fontSize: '13px',
    fontWeight: '500',
    cursor: 'pointer',
    transition: 'all 0.2s'
  },
  refreshBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '8px',
    background: 'rgba(59, 130, 246, 0.1)',
    border: '1px solid rgba(59, 130, 246, 0.3)',
    borderRadius: '8px',
    color: '#3b82f6',
    cursor: 'pointer',
    transition: 'all 0.2s'
  },

  // Custom Date Picker
  customDatePicker: {
    background: '#ffffff',
    padding: '20px 24px',
    borderBottom: '1px solid #e8e2d8'
  },
  datePickerTitle: {
    margin: '0 0 16px 0',
    fontSize: '16px',
    fontWeight: '600',
    color: '#1a1410',
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  },
  dateInputs: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '16px',
    marginBottom: '16px'
  },
  dateInputGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px'
  },
  dateLabel: {
    fontSize: '12px',
    color: '#6b6155',
    fontWeight: '500'
  },
  dateInput: {
    padding: '10px 12px',
    background: '#f3f0ea',
    border: '1px solid #d9d2c4',
    borderRadius: '8px',
    color: '#1a1410',
    fontSize: '14px'
  },
  datePickerActions: {
    display: 'flex',
    gap: '12px'
  },
  applyBtn: {
    flex: 1,
    padding: '10px',
    background: '#10b981',
    border: 'none',
    borderRadius: '8px',
    color: '#fff',
    fontWeight: '600',
    cursor: 'pointer'
  },
  cancelBtn: {
    flex: 1,
    padding: '10px',
    background: '#f3f0ea',
    border: '1px solid #d9d2c4',
    borderRadius: '8px',
    color: '#6b6155',
    fontWeight: '600',
    cursor: 'pointer'
  },

  // Content
  content: {
    flex: 1,
    padding: '24px',
    overflowY: 'auto',
    background: '#f7f5f2'
  },

  // Stats Grid
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '16px',
    marginBottom: '24px'
  },
  statCard: {
    background: '#ffffff',
    borderRadius: '12px',
    padding: '18px',
    border: '1px solid #e8e2d8',
    display: 'flex',
    alignItems: 'center',
    gap: '14px'
  },
  statIconBox: {
    width: '48px',
    height: '48px',
    borderRadius: '10px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  statInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px'
  },
  statLabel: {
    fontSize: '12px',
    color: '#6b6155',
    fontWeight: '500'
  },
  statValue: {
    fontSize: '20px',
    fontWeight: '700'
  },

  // Details Grid
  detailsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '20px',
    marginBottom: '24px'
  },

  // Cards
  card: {
    background: '#ffffff',
    borderRadius: '12px',
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
    fontSize: '15px',
    fontWeight: '600',
    color: '#1a1410',
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  },
  badge: {
    padding: '4px 10px',
    background: 'rgba(245, 158, 11, 0.1)',
    borderRadius: '6px',
    fontSize: '12px',
    fontWeight: '600',
    color: '#f59e0b'
  },
  cardBody: {
    padding: '0'
  },

  // List Items
  listItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '14px 20px',
    borderBottom: '1px solid #e8e2d8',
    transition: 'background 0.2s'
  },
  listItemLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px'
  },
  listItemRank: {
    width: '28px',
    height: '28px',
    borderRadius: '8px',
    background: 'rgba(201, 162, 75, 0.1)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '12px',
    fontWeight: '700',
    color: '#c9a24b'
  },
  listItemTitle: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#1a1410'
  },
  listItemSubtitle: {
    fontSize: '12px',
    color: '#6b6155'
  },
  listItemAmount: {
    fontSize: '16px',
    fontWeight: '700',
    color: '#10b981'
  },
  methodIcon: {
    width: '36px',
    height: '36px',
    borderRadius: '8px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '16px'
  },

  // Payment Row
  paymentRow: {
    display: 'grid',
    gridTemplateColumns: '2fr 1fr 1fr',
    gap: '16px',
    alignItems: 'center',
    padding: '14px 20px',
    borderBottom: '1px solid #e8e2d8'
  },
  paymentInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px'
  },
  paymentMachine: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#1a1410'
  },
  paymentGame: {
    fontSize: '12px',
    color: '#6b6155',
    display: 'flex',
    alignItems: 'center',
    gap: '4px'
  },
  paymentMethod: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '6px 12px',
    borderRadius: '6px',
    fontSize: '12px',
    fontWeight: '600',
    width: 'fit-content'
  },
  sessionStatus: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '6px 12px',
    borderRadius: '6px',
    fontSize: '12px',
    fontWeight: '600',
    width: 'fit-content'
  },
  paymentAmountCol: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: '4px'
  },
  paymentAmount: {
    fontSize: '16px',
    fontWeight: '700',
    color: '#10b981'
  },
  paymentDate: {
    fontSize: '12px',
    color: '#6b6155'
  },

  emptyState: {
    textAlign: 'center',
    padding: '40px 20px',
    color: '#6b6155',
    fontSize: '14px'
  }
};

// Responsive styles
const adminStyleSheet = document.createElement("style");
adminStyleSheet.textContent = `
  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
  .spin {
    animation: spin 1s linear infinite;
  }

  @media (max-width: 1024px) {
    div[style*="gridTemplateColumns: repeat(3"] {
      grid-template-columns: repeat(2, 1fr) !important;
    }
    div[style*="gridTemplateColumns: repeat(2"] {
      grid-template-columns: 1fr !important;
    }
  }

  @media (max-width: 768px) {
    aside {
      display: none !important;
    }
    div[style*="marginLeft"] {
      margin-left: 0 !important;
    }
    div[style*="gridTemplateColumns: repeat(3"] {
      grid-template-columns: 1fr !important;
    }
    div[style*="gridTemplateColumns: repeat(2, 1fr)"][style*="gap: 16px"] {
      grid-template-columns: 1fr !important;
    }
    div[style*="gridTemplateColumns: 2fr 1fr 1fr"] {
      grid-template-columns: 1fr !important;
      gap: 10px !important;
    }
  }
`;

if (!document.getElementById('admin-dashboard-responsive-styles')) {
  adminStyleSheet.id = 'admin-dashboard-responsive-styles';
  document.head.appendChild(adminStyleSheet);
}

export default AdminDashboard;
