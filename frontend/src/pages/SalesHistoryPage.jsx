import { useCallback, useEffect, useState } from "react";
import api from "../services/api";
import Toast from "../components/Toast";
import TicketPrint from "../components/TicketPrint";

const PAYMENT_LABELS = {
  cash: "💵 Espèces",
  card: "💳 Carte",
  mobile: "📱 Mobile",
};

function SalesHistoryPage({ onBack }) {
  const [sales, setSales] = useState([]);
  const [total, setTotal] = useState(0);
  const [lastPage, setLastPage] = useState(1);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [reprintSale, setReprintSale] = useState(null);
  const [cancelTarget, setCancelTarget] = useState(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelling, setCancelling] = useState(false);

  const [filters, setFilters] = useState({ startDate: "", endDate: "", ticketNumber: "", status: "" });

  const [stats, setStats] = useState({ totalSales: 0, totalRevenue: 0, averageSale: 0 });

  const limit = 25;

  const showToast = useCallback((message, type = "info", duration = 3000) => {
    setToast({ message, type, duration });
  }, []);

  const buildParams = useCallback(() => {
    const params = {};
    if (filters.startDate) params.date_from = filters.startDate;
    if (filters.endDate) params.date_to = filters.endDate;
    if (filters.ticketNumber) params.ticket_number = filters.ticketNumber;
    if (filters.status) params.status = filters.status;
    return params;
  }, [filters]);

  const loadSales = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/sales", { params: { ...buildParams(), page, limit } });
      setSales(res.data.sales || []);
      setTotal(res.data.total || 0);
      setLastPage(res.data.last_page || 1);
    } catch (e) {
      showToast("Erreur chargement: " + (e.response?.data?.message || e.message), "error");
    } finally {
      setLoading(false);
    }
  }, [buildParams, page, showToast]);

  const loadStats = useCallback(async () => {
    try {
      const res = await api.get("/sales/stats", { params: buildParams() });
      setStats({
        totalSales: res.data.total_sales || 0,
        totalRevenue: res.data.total_revenue || 0,
        averageSale: res.data.average_sale || 0,
      });
    } catch {
      // Les stats sont secondaires — un échec n'empêche pas de consulter la liste
    }
  }, [buildParams]);

  useEffect(() => {
    loadSales();
  }, [loadSales]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  // Revenir à la page 1 à chaque changement de filtre
  const updateFilter = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(1);
  };

  const resetFilters = () => {
    setFilters({ startDate: "", endDate: "", ticketNumber: "", status: "" });
    setPage(1);
  };

  const handleCancel = async () => {
    if (!cancelTarget) return;
    setCancelling(true);
    try {
      await api.post(`/sales/${cancelTarget.id}/cancel`, { reason: cancelReason || undefined });
      showToast(`Ticket ${cancelTarget.ticket_number} annulé, stock restitué`, "success");
      setCancelTarget(null);
      setCancelReason("");
      loadSales();
      loadStats();
    } catch (e) {
      showToast("Erreur: " + (e.response?.data?.message || e.message), "error");
    } finally {
      setCancelling(false);
    }
  };

  const describeItems = (sale) => {
    const parts = [
      ...(sale.services || []).map((s) => `${s.quantity}x ${s.service_name}`),
      ...(sale.products || []).map((p) => `${p.quantity}x ${p.product_name}`),
    ];
    return parts.join(", ") || "-";
  };

  if (loading && sales.length === 0) {
    return (
      <div style={styles.loadingContainer}>
        <div style={styles.spinner}></div>
        <p>Chargement de l'historique...</p>
      </div>
    );
  }

  if (reprintSale) {
    return (
      <TicketPrint
        sale={reprintSale}
        onClose={() => setReprintSale(null)}
        onNewSale={() => setReprintSale(null)}
      />
    );
  }

  return (
    <div style={styles.container}>
      {toast && <Toast {...toast} onClose={() => setToast(null)} />}

      <div style={styles.header}>
        <div>
          <button onClick={onBack} style={styles.backBtn}>← Retour</button>
          <h1 style={styles.title}>Historique des Ventes</h1>
        </div>
      </div>

      <div style={styles.statsGrid}>
        <div style={styles.statCard}>
          <div style={styles.statIcon}>📊</div>
          <div style={styles.statValue}>{stats.totalSales}</div>
          <div style={styles.statLabel}>Ventes Totales</div>
        </div>
        <div style={styles.statCard}>
          <div style={styles.statIcon}>💰</div>
          <div style={styles.statValue}>{stats.totalRevenue.toFixed(2)} DH</div>
          <div style={styles.statLabel}>Revenu Total</div>
        </div>
        <div style={styles.statCard}>
          <div style={styles.statIcon}>📈</div>
          <div style={styles.statValue}>{stats.averageSale.toFixed(2)} DH</div>
          <div style={styles.statLabel}>Vente Moyenne</div>
        </div>
      </div>

      <div style={styles.filtersCard}>
        <h3 style={styles.filtersTitle}>🔍 Filtres</h3>
        <div style={styles.filtersGrid}>
          <div style={styles.filterGroup}>
            <label style={styles.filterLabel}>Date de début</label>
            <input type="date" value={filters.startDate} onChange={(e) => updateFilter("startDate", e.target.value)} style={styles.filterInput} />
          </div>
          <div style={styles.filterGroup}>
            <label style={styles.filterLabel}>Date de fin</label>
            <input type="date" value={filters.endDate} onChange={(e) => updateFilter("endDate", e.target.value)} style={styles.filterInput} />
          </div>
          <div style={styles.filterGroup}>
            <label style={styles.filterLabel}>N° Ticket</label>
            <input type="text" value={filters.ticketNumber} onChange={(e) => updateFilter("ticketNumber", e.target.value)} placeholder="TCK-000123" style={styles.filterInput} />
          </div>
          <div style={styles.filterGroup}>
            <label style={styles.filterLabel}>Statut</label>
            <select value={filters.status} onChange={(e) => updateFilter("status", e.target.value)} style={styles.filterInput}>
              <option value="">Tous</option>
              <option value="active">Actifs</option>
              <option value="cancelled">Annulés</option>
            </select>
          </div>
          <div style={styles.filterGroup}>
            <label style={styles.filterLabel}>&nbsp;</label>
            <button onClick={resetFilters} style={styles.resetBtn}>🔄 Réinitialiser</button>
          </div>
        </div>
      </div>

      <div style={styles.tableCard}>
        <div style={styles.tableHeader}>
          <h3 style={styles.tableTitle}>📋 Tickets ({total})</h3>
        </div>
        <div style={styles.tableContainer}>
          <table style={styles.table}>
            <thead>
              <tr style={styles.tableHeaderRow}>
                <th style={styles.th}>Ticket</th>
                <th style={styles.th}>Date</th>
                <th style={styles.th}>Détail</th>
                <th style={styles.th}>Coiffeur</th>
                <th style={styles.th}>Remise</th>
                <th style={styles.th}>Total</th>
                <th style={styles.th}>Paiement</th>
                <th style={styles.th}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {sales.map((sale) => {
                const isCancelled = !!sale.cancelled_at;
                return (
                  <tr key={sale.id} style={{ ...styles.tableRow, ...(isCancelled ? styles.tableRowCancelled : {}) }}>
                    <td style={styles.td}>
                      <strong>{sale.ticket_number}</strong>
                      {isCancelled && <span style={styles.cancelledBadge}>Annulé</span>}
                    </td>
                    <td style={styles.td}>
                      {new Date(sale.sale_date).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </td>
                    <td style={styles.td}>{describeItems(sale)}</td>
                    <td style={styles.td}>{sale.coiffeur?.name || "-"}</td>
                    <td style={styles.td}>{parseFloat(sale.discount) > 0 ? `${parseFloat(sale.discount).toFixed(2)} DH` : "-"}</td>
                    <td style={styles.td}><strong style={styles.totalPrice}>{parseFloat(sale.total).toFixed(2)} DH</strong></td>
                    <td style={styles.td}>{PAYMENT_LABELS[sale.payment_method] || sale.payment_method}</td>
                    <td style={styles.td}>
                      <div style={styles.actionsCell}>
                        <button onClick={() => setReprintSale(sale)} style={styles.reprintBtn}>🖨️ Réimprimer</button>
                        {!isCancelled && (
                          <button onClick={() => setCancelTarget(sale)} style={styles.cancelBtn}>✕ Annuler</button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {sales.length === 0 && (
            <div style={styles.emptyState}>
              <div style={styles.emptyIcon}>📭</div>
              <div>Aucune vente trouvée</div>
            </div>
          )}
        </div>

        {lastPage > 1 && (
          <div style={styles.pagination}>
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              style={{ ...styles.pageBtn, opacity: page <= 1 ? 0.5 : 1 }}
            >
              ← Précédent
            </button>
            <span style={styles.pageInfo}>Page {page} / {lastPage}</span>
            <button
              onClick={() => setPage((p) => Math.min(lastPage, p + 1))}
              disabled={page >= lastPage}
              style={{ ...styles.pageBtn, opacity: page >= lastPage ? 0.5 : 1 }}
            >
              Suivant →
            </button>
          </div>
        )}
      </div>

      {cancelTarget && (
        <div style={styles.modalOverlay}>
          <div style={styles.modal}>
            <h2 style={styles.modalTitle}>Annuler le ticket {cancelTarget.ticket_number} ?</h2>
            <p style={styles.modalText}>
              Le stock consommé (produits vendus et produits utilisés par les prestations) sera automatiquement restitué. Cette action est irréversible.
            </p>
            <label style={styles.filterLabel}>Motif (optionnel)</label>
            <input
              type="text"
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="Ex: erreur de saisie, client absent..."
              style={styles.filterInput}
            />
            <div style={styles.modalActions}>
              <button
                onClick={() => { setCancelTarget(null); setCancelReason(""); }}
                style={styles.modalCancelBtn}
                disabled={cancelling}
              >
                Retour
              </button>
              <button onClick={handleCancel} style={styles.modalConfirmBtn} disabled={cancelling}>
                {cancelling ? "Annulation..." : "Confirmer l'annulation"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  container: { minHeight: "100vh", backgroundColor: "#f7f5f2", padding: "40px" },
  loadingContainer: { display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100vh", backgroundColor: "#f7f5f2", color: "#1a1410" },
  spinner: { width: "50px", height: "50px", border: "4px solid rgba(0, 0, 0, 0.06)", borderTop: "4px solid #c9a24b", borderRadius: "50%", animation: "spin 1s linear infinite" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "30px" },
  backBtn: { background: "rgba(0, 0, 0, 0.04)", border: "1px solid #e8e2d8", color: "#6b6155", padding: "10px 20px", borderRadius: "8px", cursor: "pointer", fontSize: "14px", marginBottom: "16px" },
  title: { margin: 0, fontSize: "32px", fontWeight: "700", color: "#1a1410" },
  statsGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "20px", marginBottom: "30px" },
  statCard: { background: "linear-gradient(135deg, #ffffff 0%, #f9f7f3 100%)", borderRadius: "16px", border: "1px solid #e8e2d8", padding: "24px", textAlign: "center" },
  statIcon: { fontSize: "36px", marginBottom: "12px" },
  statValue: { fontSize: "26px", fontWeight: "700", color: "#c9a24b", marginBottom: "8px" },
  statLabel: { fontSize: "13px", color: "#6b6155", textTransform: "uppercase", letterSpacing: "0.5px" },
  filtersCard: { background: "#ffffff", borderRadius: "16px", border: "1px solid #e8e2d8", padding: "24px", marginBottom: "30px" },
  filtersTitle: { margin: "0 0 20px 0", fontSize: "18px", fontWeight: "600", color: "#1a1410" },
  filtersGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "16px" },
  filterGroup: { display: "flex", flexDirection: "column" },
  filterLabel: { fontSize: "13px", fontWeight: "600", color: "#6b6155", marginBottom: "8px" },
  filterInput: { padding: "10px 12px", background: "#f7f5f2", border: "1px solid #e8e2d8", borderRadius: "8px", color: "#1a1410", fontSize: "14px" },
  resetBtn: { padding: "10px 12px", background: "rgba(239, 68, 68, 0.1)", border: "1px solid rgba(239, 68, 68, 0.3)", borderRadius: "8px", color: "#dc2626", cursor: "pointer", fontSize: "14px", fontWeight: "600" },
  tableCard: { background: "#ffffff", borderRadius: "16px", border: "1px solid #e8e2d8", overflow: "hidden" },
  tableHeader: { padding: "20px 24px", borderBottom: "1px solid #e8e2d8" },
  tableTitle: { margin: 0, fontSize: "18px", fontWeight: "600", color: "#1a1410" },
  tableContainer: { overflowX: "auto" },
  table: { width: "100%", borderCollapse: "collapse" },
  tableHeaderRow: { background: "#f3f0ea" },
  th: { padding: "16px", textAlign: "left", color: "#6b6155", fontSize: "13px", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.5px" },
  tableRow: { borderBottom: "1px solid #e8e2d8" },
  tableRowCancelled: { opacity: 0.55 },
  td: { padding: "16px", color: "#1a1410", fontSize: "14px" },
  totalPrice: { color: "#a5822f", fontSize: "15px" },
  cancelledBadge: { marginLeft: "8px", padding: "2px 8px", background: "rgba(239, 68, 68, 0.1)", border: "1px solid rgba(239, 68, 68, 0.3)", borderRadius: "10px", color: "#dc2626", fontSize: "11px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.3px" },
  actionsCell: { display: "flex", gap: "8px" },
  reprintBtn: { padding: "8px 14px", background: "rgba(201, 162, 75, 0.1)", border: "1px solid rgba(201, 162, 75, 0.3)", borderRadius: "8px", color: "#a5822f", cursor: "pointer", fontSize: "13px", fontWeight: "600" },
  cancelBtn: { padding: "8px 14px", background: "rgba(239, 68, 68, 0.08)", border: "1px solid rgba(239, 68, 68, 0.25)", borderRadius: "8px", color: "#dc2626", cursor: "pointer", fontSize: "13px", fontWeight: "600" },
  emptyState: { textAlign: "center", padding: "60px 20px", color: "#6b6155" },
  emptyIcon: { fontSize: "48px", marginBottom: "16px" },
  pagination: { display: "flex", justifyContent: "center", alignItems: "center", gap: "16px", padding: "20px", borderTop: "1px solid #e8e2d8" },
  pageBtn: { padding: "8px 16px", background: "rgba(0, 0, 0, 0.04)", border: "1px solid #e8e2d8", borderRadius: "8px", color: "#1a1410", cursor: "pointer", fontSize: "13px", fontWeight: "600" },
  pageInfo: { fontSize: "13px", color: "#6b6155", fontWeight: "600" },
  modalOverlay: { position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0, 0, 0, 0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 10000, padding: "20px" },
  modal: { background: "#ffffff", borderRadius: "16px", border: "1px solid #e8e2d8", padding: "28px", width: "440px", maxWidth: "100%", boxShadow: "0 20px 60px rgba(0, 0, 0, 0.25)" },
  modalTitle: { margin: "0 0 10px 0", fontSize: "19px", fontWeight: "700", color: "#1a1410" },
  modalText: { margin: "0 0 18px 0", fontSize: "13.5px", color: "#6b6155", lineHeight: 1.5 },
  modalActions: { display: "flex", gap: "10px", marginTop: "20px" },
  modalCancelBtn: { flex: 1, padding: "12px", background: "rgba(0, 0, 0, 0.04)", border: "1px solid #e8e2d8", borderRadius: "10px", color: "#6b6155", fontSize: "14px", fontWeight: "600", cursor: "pointer" },
  modalConfirmBtn: { flex: 1, padding: "12px", background: "#dc2626", border: "none", borderRadius: "10px", color: "#ffffff", fontSize: "14px", fontWeight: "700", cursor: "pointer" },
};

export default SalesHistoryPage;
