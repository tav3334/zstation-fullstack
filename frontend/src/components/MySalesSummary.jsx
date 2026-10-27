import { useEffect, useState } from "react";
import api from "../services/api";

const dh = (n) => `${Number(n || 0).toFixed(2)} DH`;

// « Mes ventes du jour » : tickets encaissés par l'utilisateur connecté (+ sessions de jeu payées).
function MySalesSummary({ refreshKey = 0, compact = false }) {
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    api
      .get("/sales/my-summary")
      .then((res) => alive && setSummary(res.data))
      .catch((e) => alive && setError(e.response?.data?.message || e.message));
    return () => {
      alive = false;
    };
  }, [refreshKey]);

  if (error) return <div style={styles.error}>Impossible de charger vos ventes : {error}</div>;
  if (!summary) return <div style={styles.loading}>Chargement de vos ventes…</div>;

  const methods = [
    { label: "Espèces", value: summary.by_method.cash },
    { label: "Carte", value: summary.by_method.card },
    { label: "Mobile", value: summary.by_method.mobile },
    { label: "Crédit", value: summary.by_method.credit },
  ].filter((m) => m.value > 0);
  const gaming = summary.gaming;

  return (
    <div style={styles.wrap}>
      <div style={{ ...styles.kpis, gridTemplateColumns: compact ? "repeat(2, 1fr)" : "repeat(auto-fit, minmax(140px, 1fr))" }}>
        <div style={styles.kpi}>
          <div style={styles.kpiLabel}>Tickets</div>
          <div style={styles.kpiValue}>{summary.tickets}</div>
        </div>
        <div style={styles.kpi}>
          <div style={styles.kpiLabel}>Chiffre d'affaires</div>
          <div style={styles.kpiValue}>{dh(summary.revenue)}</div>
        </div>
        <div style={styles.kpi}>
          <div style={styles.kpiLabel}>Panier moyen</div>
          <div style={styles.kpiValue}>{dh(summary.average)}</div>
        </div>
        {gaming.sessions_paid > 0 && (
          <div style={styles.kpi}>
            <div style={styles.kpiLabel}>Jeux ({gaming.sessions_paid})</div>
            <div style={styles.kpiValue}>{dh(gaming.revenue)}</div>
          </div>
        )}
      </div>

      {methods.length > 0 && (
        <div style={styles.methods}>
          {methods.map((m) => (
            <span key={m.label} style={styles.method}>
              {m.label} <strong>{dh(m.value)}</strong>
            </span>
          ))}
        </div>
      )}

      {(summary.discount > 0 || summary.cancelled > 0) && (
        <div style={styles.notes}>
          {summary.discount > 0 && <span>Remises accordées : {dh(summary.discount)}</span>}
          {summary.cancelled > 0 && <span>Tickets annulés : {summary.cancelled}</span>}
        </div>
      )}
    </div>
  );
}

const styles = {
  wrap: { display: "flex", flexDirection: "column", gap: "12px" },
  kpis: { display: "grid", gap: "10px" },
  kpi: { background: "#f7f5f2", border: "1px solid #e8e2d8", borderRadius: "12px", padding: "12px 14px" },
  kpiLabel: { fontSize: "11.5px", fontWeight: 700, color: "#6b6155", textTransform: "uppercase", letterSpacing: "0.4px" },
  kpiValue: { fontSize: "20px", fontWeight: 800, color: "#1a1410", marginTop: "4px", fontVariantNumeric: "tabular-nums" },
  methods: { display: "flex", flexWrap: "wrap", gap: "8px" },
  method: { fontSize: "13px", color: "#3f3a30", background: "rgba(201,162,75,0.1)", borderRadius: "20px", padding: "5px 12px" },
  notes: { display: "flex", flexWrap: "wrap", gap: "14px", fontSize: "12.5px", color: "#b45309", fontWeight: 600 },
  loading: { padding: "16px", color: "#6b6155", fontSize: "13.5px" },
  error: { padding: "12px", color: "#b91c1c", fontSize: "13px" },
};

export default MySalesSummary;
