import { useCallback, useEffect, useState } from "react";
import api from "../services/api";
import Toast from "../components/Toast";

const TYPE_LABELS = {
  sale: { label: "Vente", icon: "🛒", color: "#dc2626" },
  sale_cancel: { label: "Annulation vente", icon: "↩️", color: "#059669" },
  manual_adjustment: { label: "Ajustement manuel", icon: "✏️", color: "#2563eb" },
  initial_stock: { label: "Stock initial", icon: "🆕", color: "#a5822f" },
};

const SOURCE_LABELS = {
  salon: "Salon",
  gaming: "Gaming",
};

function StockMovementsPage({ onBack }) {
  const [movements, setMovements] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [filters, setFilters] = useState({ source: "", type: "", productName: "", dateFrom: "", dateTo: "" });

  const limit = 50;

  const showToast = useCallback((message, type = "info", duration = 3000) => {
    setToast({ message, type, duration });
  }, []);

  const loadMovements = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit };
      if (filters.source) params.movable_type = filters.source;
      if (filters.type) params.type = filters.type;
      if (filters.productName) params.product_name = filters.productName;
      if (filters.dateFrom) params.date_from = filters.dateFrom;
      if (filters.dateTo) params.date_to = filters.dateTo;

      const res = await api.get("/stock-movements", { params });
      setMovements(res.data.movements || []);
      setTotal(res.data.total || 0);
    } catch (e) {
      showToast("Erreur chargement: " + (e.response?.data?.message || e.message), "error");
    } finally {
      setLoading(false);
    }
  }, [page, filters, showToast]);

  useEffect(() => {
    loadMovements();
  }, [loadMovements]);

  const resetFilters = () => {
    setFilters({ source: "", type: "", productName: "", dateFrom: "", dateTo: "" });
    setPage(1);
  };

  const updateFilter = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(1);
  };

  const totalPages = Math.max(1, Math.ceil(total / limit));

  if (loading && movements.length === 0) {
    return (
      <div style={styles.loadingContainer}>
        <div style={styles.spinner}></div>
        <p>Chargement des mouvements...</p>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {toast && <Toast {...toast} onClose={() => setToast(null)} />}

      <div style={styles.header}>
        <div>
          <button onClick={onBack} style={styles.backBtn}>← Retour</button>
          <h1 style={styles.title}>Mouvements de Stock</h1>
        </div>
      </div>

      <div style={styles.filtersCard}>
        <h3 style={styles.filtersTitle}>🔍 Filtres</h3>
        <div style={styles.filtersGrid}>
          <div style={styles.filterGroup}>
            <label style={styles.filterLabel}>Source</label>
            <select value={filters.source} onChange={(e) => updateFilter("source", e.target.value)} style={styles.filterInput}>
              <option value="">Toutes</option>
              <option value="salon">Salon</option>
              <option value="gaming">Gaming</option>
            </select>
          </div>
          <div style={styles.filterGroup}>
            <label style={styles.filterLabel}>Type de mouvement</label>
            <select value={filters.type} onChange={(e) => updateFilter("type", e.target.value)} style={styles.filterInput}>
              <option value="">Tous</option>
              {Object.entries(TYPE_LABELS).map(([key, { label }]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>
          <div style={styles.filterGroup}>
            <label style={styles.filterLabel}>Produit</label>
            <input
              type="text"
              value={filters.productName}
              onChange={(e) => updateFilter("productName", e.target.value)}
              placeholder="Rechercher un produit..."
              style={styles.filterInput}
            />
          </div>
          <div style={styles.filterGroup}>
            <label style={styles.filterLabel}>Date de début</label>
            <input type="date" value={filters.dateFrom} onChange={(e) => updateFilter("dateFrom", e.target.value)} style={styles.filterInput} />
          </div>
          <div style={styles.filterGroup}>
            <label style={styles.filterLabel}>Date de fin</label>
            <input type="date" value={filters.dateTo} onChange={(e) => updateFilter("dateTo", e.target.value)} style={styles.filterInput} />
          </div>
          <div style={styles.filterGroup}>
            <label style={styles.filterLabel}>&nbsp;</label>
            <button onClick={resetFilters} style={styles.resetBtn}>🔄 Réinitialiser</button>
          </div>
        </div>
      </div>

      <div style={styles.tableCard}>
        <div style={styles.tableHeader}>
          <h3 style={styles.tableTitle}>📋 Mouvements ({total})</h3>
        </div>
        <div style={styles.tableContainer}>
          <table style={styles.table}>
            <thead>
              <tr style={styles.tableHeaderRow}>
                <th style={styles.th}>Date</th>
                <th style={styles.th}>Produit</th>
                <th style={styles.th}>Source</th>
                <th style={styles.th}>Type</th>
                <th style={styles.th}>Avant</th>
                <th style={styles.th}>Variation</th>
                <th style={styles.th}>Après</th>
                <th style={styles.th}>Ticket</th>
                <th style={styles.th}>Utilisateur</th>
                <th style={styles.th}>Motif</th>
              </tr>
            </thead>
            <tbody>
              {movements.map((m) => {
                const typeInfo = TYPE_LABELS[m.type] || { label: m.type, icon: "•", color: "#6b6155" };
                const isPositive = m.quantity_change > 0;
                return (
                  <tr key={m.id} style={styles.tableRow}>
                    <td style={styles.td}>
                      {new Date(m.created_at).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </td>
                    <td style={styles.td}><strong>{m.product_name}</strong></td>
                    <td style={styles.td}>{SOURCE_LABELS[m.source] || m.source}</td>
                    <td style={styles.td}>
                      <span style={{ ...styles.typeBadge, color: typeInfo.color, borderColor: typeInfo.color + "55", background: typeInfo.color + "14" }}>
                        {typeInfo.icon} {typeInfo.label}
                      </span>
                    </td>
                    <td style={styles.td}>{m.quantity_before}</td>
                    <td style={styles.td}>
                      <strong style={{ color: isPositive ? "#059669" : "#dc2626" }}>
                        {isPositive ? "+" : ""}{m.quantity_change}
                      </strong>
                    </td>
                    <td style={styles.td}><strong>{m.quantity_after}</strong></td>
                    <td style={styles.td}>{m.ticket_number || "-"}</td>
                    <td style={styles.td}>{m.user_name || "-"}</td>
                    <td style={styles.td}>{m.reason || "-"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {movements.length === 0 && (
            <div style={styles.emptyState}>
              <div style={styles.emptyIcon}>📭</div>
              <div>Aucun mouvement trouvé</div>
            </div>
          )}
        </div>

        {totalPages > 1 && (
          <div style={styles.pagination}>
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              style={{ ...styles.pageBtn, opacity: page <= 1 ? 0.5 : 1 }}
            >
              ← Précédent
            </button>
            <span style={styles.pageInfo}>Page {page} / {totalPages}</span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              style={{ ...styles.pageBtn, opacity: page >= totalPages ? 0.5 : 1 }}
            >
              Suivant →
            </button>
          </div>
        )}
      </div>
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
  th: { padding: "14px 16px", textAlign: "left", color: "#6b6155", fontSize: "12px", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.5px", whiteSpace: "nowrap" },
  tableRow: { borderBottom: "1px solid #e8e2d8" },
  td: { padding: "14px 16px", color: "#1a1410", fontSize: "13.5px", whiteSpace: "nowrap" },
  typeBadge: { display: "inline-flex", alignItems: "center", gap: "5px", padding: "4px 10px", borderRadius: "12px", fontSize: "12px", fontWeight: "600", border: "1px solid" },
  emptyState: { textAlign: "center", padding: "60px 20px", color: "#6b6155" },
  emptyIcon: { fontSize: "48px", marginBottom: "16px" },
  pagination: { display: "flex", justifyContent: "center", alignItems: "center", gap: "16px", padding: "20px", borderTop: "1px solid #e8e2d8" },
  pageBtn: { padding: "8px 16px", background: "rgba(0, 0, 0, 0.04)", border: "1px solid #e8e2d8", borderRadius: "8px", color: "#1a1410", cursor: "pointer", fontSize: "13px", fontWeight: "600" },
  pageInfo: { fontSize: "13px", color: "#6b6155", fontWeight: "600" },
};

export default StockMovementsPage;
