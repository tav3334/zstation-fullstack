import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, DollarSign, FileText, RefreshCw } from "lucide-react";
import api from "../services/api";
import Toast from "../components/Toast";

const STATUS_LABELS = { paid: "Payée", failed: "Échouée", refunded: "Remboursée" };
const STATUS_COLORS = {
  paid: { bg: "#dcfce7", color: "#166534" },
  failed: { bg: "#fee2e2", color: "#991b1b" },
  refunded: { bg: "#fef3c7", color: "#92400e" },
};

function SuperAdminInvoices({ onBack }) {
  const [invoices, setInvoices] = useState([]);
  const [total, setTotal] = useState(0);
  const [lastPage, setLastPage] = useState(1);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [filters, setFilters] = useState({ dateFrom: "", dateTo: "" });

  const limit = 25;

  const showToast = useCallback((message, type = "info", duration = 3500) => {
    setToast({ message, type, duration });
  }, []);

  const buildParams = useCallback(() => {
    const params = {};
    if (filters.dateFrom) params.date_from = filters.dateFrom;
    if (filters.dateTo) params.date_to = filters.dateTo;
    return params;
  }, [filters]);

  const loadInvoices = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/super-admin/invoices", {
        params: { ...buildParams(), page, limit },
      });
      setInvoices(res.data.invoices);
      setTotal(res.data.total);
      setLastPage(res.data.last_page);
      setTotalRevenue(res.data.total_revenue);
    } catch (e) {
      showToast("Erreur de chargement: " + (e.response?.data?.message || e.message), "error");
    } finally {
      setLoading(false);
    }
  }, [buildParams, page, showToast]);

  useEffect(() => {
    loadInvoices();
  }, [loadInvoices]);

  const updateFilter = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(1);
  };

  const resetFilters = () => {
    setFilters({ dateFrom: "", dateTo: "" });
    setPage(1);
  };

  return (
    <div style={styles.container}>
      {toast && <Toast {...toast} onClose={() => setToast(null)} />}

      <div style={styles.header}>
        <button onClick={onBack} style={styles.backBtn}><ArrowLeft size={16} /> Retour</button>
        <h1 style={styles.title}>Historique de Facturation</h1>
      </div>

      <div style={styles.statsGrid}>
        <div style={styles.statCard}>
          <div style={{ ...styles.statIcon, background: "rgba(16,185,129,0.1)" }}>
            <DollarSign size={22} color="#10b981" />
          </div>
          <div>
            <div style={styles.statValue}>{Number(totalRevenue).toLocaleString("fr-MA")} DH</div>
            <div style={styles.statLabel}>Revenu total (filtré)</div>
          </div>
        </div>
        <div style={styles.statCard}>
          <div style={{ ...styles.statIcon, background: "rgba(201,162,75,0.1)" }}>
            <FileText size={22} color="#c9a24b" />
          </div>
          <div>
            <div style={styles.statValue}>{total}</div>
            <div style={styles.statLabel}>Factures</div>
          </div>
        </div>
      </div>

      <div style={styles.filtersCard}>
        <div style={styles.filtersRow}>
          <div style={styles.filterGroup}>
            <label style={styles.filterLabel}>Date de début</label>
            <input
              type="date"
              value={filters.dateFrom}
              onChange={(e) => updateFilter("dateFrom", e.target.value)}
              style={styles.input}
            />
          </div>
          <div style={styles.filterGroup}>
            <label style={styles.filterLabel}>Date de fin</label>
            <input
              type="date"
              value={filters.dateTo}
              onChange={(e) => updateFilter("dateTo", e.target.value)}
              style={styles.input}
            />
          </div>
          <button onClick={resetFilters} style={styles.resetBtn}>
            <RefreshCw size={14} /> Réinitialiser
          </button>
        </div>
      </div>

      <div style={styles.tableCard}>
        {loading ? (
          <div style={styles.loadingBox}>Chargement...</div>
        ) : invoices.length === 0 ? (
          <div style={styles.emptyState}>
            <FileText size={40} color="#d9d2c4" />
            <div>Aucune facture pour la période sélectionnée</div>
          </div>
        ) : (
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Date</th>
                <th style={styles.th}>Organisation</th>
                <th style={styles.th}>Plan</th>
                <th style={styles.th}>Montant</th>
                <th style={styles.th}>Statut</th>
                <th style={styles.th}>Session Stripe</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => {
                const statusStyle = STATUS_COLORS[inv.status] || STATUS_COLORS.paid;
                return (
                  <tr key={inv.id} style={styles.tr}>
                    <td style={styles.td}>{new Date(inv.paid_at).toLocaleString("fr-FR")}</td>
                    <td style={styles.td}>{inv.organization?.name || "—"}</td>
                    <td style={styles.td}>{inv.plan_name}</td>
                    <td style={styles.tdAmount}>{Number(inv.amount).toLocaleString("fr-MA")} {inv.currency}</td>
                    <td style={styles.td}>
                      <span style={{ ...styles.statusBadge, background: statusStyle.bg, color: statusStyle.color }}>
                        {STATUS_LABELS[inv.status] || inv.status}
                      </span>
                    </td>
                    <td style={styles.tdMono}>{inv.stripe_session_id || "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        {lastPage > 1 && (
          <div style={styles.pagination}>
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              style={{ ...styles.pageBtn, opacity: page <= 1 ? 0.5 : 1 }}
            >
              Précédent
            </button>
            <span style={styles.pageInfo}>Page {page} / {lastPage}</span>
            <button
              onClick={() => setPage((p) => Math.min(lastPage, p + 1))}
              disabled={page >= lastPage}
              style={{ ...styles.pageBtn, opacity: page >= lastPage ? 0.5 : 1 }}
            >
              Suivant
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

const styles = {
  container: { minHeight: "100vh", backgroundColor: "#f7f5f2", padding: "40px" },
  header: { marginBottom: "24px" },
  backBtn: { display: "inline-flex", alignItems: "center", gap: "6px", background: "rgba(0, 0, 0, 0.04)", border: "1px solid #e8e2d8", color: "#6b6155", padding: "10px 20px", borderRadius: "8px", cursor: "pointer", fontSize: "14px", marginBottom: "16px" },
  title: { margin: 0, fontSize: "32px", fontWeight: "700", color: "#1a1410" },
  statsGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px", marginBottom: "20px" },
  statCard: { background: "#ffffff", borderRadius: "16px", border: "1px solid #e8e2d8", padding: "20px", display: "flex", alignItems: "center", gap: "14px" },
  statIcon: { width: "48px", height: "48px", borderRadius: "12px", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  statValue: { fontSize: "22px", fontWeight: "800", color: "#1a1410" },
  statLabel: { fontSize: "12.5px", color: "#6b6155", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.4px" },
  filtersCard: { background: "#ffffff", borderRadius: "16px", border: "1px solid #e8e2d8", padding: "20px", marginBottom: "20px" },
  filtersRow: { display: "flex", gap: "16px", alignItems: "flex-end", flexWrap: "wrap" },
  filterGroup: { display: "flex", flexDirection: "column", gap: "6px" },
  filterLabel: { fontSize: "12.5px", fontWeight: "600", color: "#6b6155" },
  input: { padding: "10px 12px", background: "#f7f5f2", border: "1px solid #e8e2d8", borderRadius: "8px", color: "#1a1410", fontSize: "14px" },
  resetBtn: { display: "inline-flex", alignItems: "center", gap: "6px", padding: "10px 16px", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: "8px", color: "#dc2626", cursor: "pointer", fontSize: "13px", fontWeight: "600" },
  tableCard: { background: "#ffffff", borderRadius: "16px", border: "1px solid #e8e2d8", overflow: "hidden" },
  loadingBox: { padding: "60px", textAlign: "center", color: "#6b6155" },
  emptyState: { padding: "60px 20px", textAlign: "center", color: "#6b6155", display: "flex", flexDirection: "column", alignItems: "center", gap: "12px" },
  table: { width: "100%", borderCollapse: "collapse" },
  th: { textAlign: "left", padding: "14px 20px", fontSize: "12px", fontWeight: "700", color: "#6b6155", textTransform: "uppercase", letterSpacing: "0.4px", borderBottom: "1px solid #e8e2d8", background: "#faf9f6" },
  tr: { borderBottom: "1px solid #f0ece3" },
  td: { padding: "14px 20px", fontSize: "13.5px", color: "#1a1410" },
  tdAmount: { padding: "14px 20px", fontSize: "14px", color: "#166534", fontWeight: "700" },
  tdMono: { padding: "14px 20px", fontSize: "12px", color: "#8a8070", fontFamily: "monospace" },
  statusBadge: { display: "inline-block", padding: "4px 12px", borderRadius: "20px", fontSize: "12px", fontWeight: "700" },
  pagination: { display: "flex", alignItems: "center", justifyContent: "center", gap: "16px", padding: "20px" },
  pageBtn: { padding: "8px 18px", background: "linear-gradient(135deg, #e0b85c 0%, #c9a24b 100%)", border: "none", borderRadius: "8px", color: "#1a1408", fontSize: "13px", fontWeight: "700", cursor: "pointer" },
  pageInfo: { fontSize: "13px", color: "#6b6155", fontWeight: "600" },
};

export default SuperAdminInvoices;
