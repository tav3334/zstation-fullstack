import { useEffect, useState } from "react";
import { Printer, X } from "lucide-react";
import api from "../services/api";
import MySalesSummary from "./MySalesSummary";
import TicketPrint from "./TicketPrint";

const PAYMENT_LABELS = { cash: "Espèces", card: "Carte", mobile: "Mobile", mixed: "Mixte" };

const todayString = () => {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};

// Panneau latéral de la caisse : résumé de mes ventes du jour + mes derniers tickets (réimpression).
function PosTicketsPanel({ onClose, refreshKey }) {
  const [sales, setSales] = useState(null);
  const [error, setError] = useState("");
  const [reprint, setReprint] = useState(null);

  useEffect(() => {
    let alive = true;
    const today = todayString();
    api
      .get("/sales", { params: { mine: 1, date_from: today, date_to: today, limit: 30 } })
      .then((res) => alive && setSales(res.data.sales || []))
      .catch((e) => alive && setError(e.response?.data?.message || e.message));
    return () => {
      alive = false;
    };
  }, [refreshKey]);

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && !reprint && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, reprint]);

  if (reprint) {
    return <TicketPrint sale={reprint} onClose={() => setReprint(null)} onNewSale={() => setReprint(null)} />;
  }

  return (
    <div style={styles.overlay} onClick={onClose} role="presentation">
      <aside style={styles.panel} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Mes tickets du jour">
        <div style={styles.header}>
          <h2 style={styles.title}>Mes ventes du jour</h2>
          <button onClick={onClose} style={styles.close} aria-label="Fermer">
            <X size={18} />
          </button>
        </div>

        <div style={styles.body}>
          <MySalesSummary refreshKey={refreshKey} compact />

          <h3 style={styles.subtitle}>Mes tickets</h3>
          {error && <div style={styles.error}>{error}</div>}
          {!sales && !error && <div style={styles.muted}>Chargement…</div>}
          {sales?.length === 0 && <div style={styles.muted}>Aucun ticket aujourd'hui.</div>}
          {sales?.map((sale) => {
            const cancelled = !!sale.cancelled_at;
            return (
              <div key={sale.id} style={{ ...styles.row, ...(cancelled ? styles.rowCancelled : {}) }}>
                <div style={styles.rowInfo}>
                  <div style={styles.ticket}>
                    {sale.ticket_number}
                    {cancelled && <span style={styles.cancelledTag}>Annulé</span>}
                  </div>
                  <div style={styles.meta}>
                    {new Date(sale.sale_date).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                    {" · "}
                    {sale.paid_on_credit ? "Crédit" : PAYMENT_LABELS[sale.payment_method] || sale.payment_method}
                  </div>
                </div>
                <div style={styles.total}>{parseFloat(sale.total).toFixed(2)} DH</div>
                <button onClick={() => setReprint(sale)} style={styles.printBtn} title="Réimprimer" aria-label={`Réimprimer ${sale.ticket_number}`}>
                  <Printer size={16} />
                </button>
              </div>
            );
          })}
        </div>
      </aside>
    </div>
  );
}

const styles = {
  overlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 9000, display: "flex", justifyContent: "flex-end" },
  panel: { width: "min(440px, 100%)", height: "100%", background: "#ffffff", display: "flex", flexDirection: "column", boxShadow: "-10px 0 40px rgba(0,0,0,0.2)" },
  header: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 18px", borderBottom: "1px solid #e8e2d8" },
  title: { margin: 0, fontSize: "18px", fontWeight: 800, color: "#1a1410" },
  close: { display: "flex", alignItems: "center", justifyContent: "center", width: "34px", height: "34px", borderRadius: "50%", border: "1px solid #e8e2d8", background: "rgba(0,0,0,0.04)", cursor: "pointer", color: "#1a1410" },
  body: { flex: 1, overflowY: "auto", padding: "16px 18px 24px" },
  subtitle: { margin: "22px 0 8px", fontSize: "13px", fontWeight: 700, color: "#6b6155", textTransform: "uppercase", letterSpacing: "0.5px" },
  row: { display: "flex", alignItems: "center", gap: "10px", padding: "10px 0", borderBottom: "1px solid #f0ebe2" },
  rowCancelled: { opacity: 0.55 },
  rowInfo: { flex: 1, minWidth: 0 },
  ticket: { fontSize: "14px", fontWeight: 700, color: "#1a1410", display: "flex", alignItems: "center", gap: "8px" },
  cancelledTag: { fontSize: "11px", fontWeight: 700, color: "#dc2626", background: "rgba(220,38,38,0.1)", padding: "1px 8px", borderRadius: "10px" },
  meta: { fontSize: "12px", color: "#8a8070", marginTop: "2px" },
  total: { fontSize: "14px", fontWeight: 800, color: "#a5822f", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" },
  printBtn: { display: "flex", alignItems: "center", justifyContent: "center", width: "36px", height: "36px", borderRadius: "10px", border: "1px solid #e8e2d8", background: "#f7f5f2", cursor: "pointer", color: "#1a1410" },
  muted: { color: "#6b6155", fontSize: "13.5px", padding: "8px 0" },
  error: { color: "#b91c1c", fontSize: "13px", padding: "8px 0" },
};

export default PosTicketsPanel;
