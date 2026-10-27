import { useCallback, useEffect, useState } from "react";
import api from "../services/api";
import Toast from "../components/Toast";

const toInputDate = (d) => {
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
};

const PRESETS = [
  { id: "today", label: "Aujourd'hui", range: () => { const t = new Date(); return [t, t]; } },
  { id: "week", label: "7 derniers jours", range: () => { const t = new Date(); const f = new Date(); f.setDate(t.getDate() - 6); return [f, t]; } },
  { id: "month", label: "Ce mois", range: () => { const t = new Date(); return [new Date(t.getFullYear(), t.getMonth(), 1), t]; } },
  { id: "last-month", label: "Mois dernier", range: () => { const t = new Date(); return [new Date(t.getFullYear(), t.getMonth() - 1, 1), new Date(t.getFullYear(), t.getMonth(), 0)]; } },
];

const dh = (n) => `${Number(n || 0).toFixed(2)} DH`;

function StaffPerformancePage({ onBack, modules }) {
  const mods = modules || { gaming: true, coiffure: true, stock: true };
  const [preset, setPreset] = useState("month");
  const [dateFrom, setDateFrom] = useState(() => toInputDate(PRESETS[2].range()[0]));
  const [dateTo, setDateTo] = useState(() => toInputDate(new Date()));
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  const load = useCallback(
    () =>
      api
        .get("/reports/staff", { params: { date_from: dateFrom, date_to: dateTo } })
        .then((res) => setReport(res.data))
        .catch((e) => setToast({ message: "Erreur: " + (e.response?.data?.message || e.message), type: "error" }))
        .finally(() => setLoading(false)),
    [dateFrom, dateTo]
  );

  useEffect(() => {
    load();
  }, [load]);

  const applyPreset = (p) => {
    const [from, to] = p.range();
    setPreset(p.id);
    setDateFrom(toInputDate(from));
    setDateTo(toInputDate(to));
  };

  const staff = report?.staff || [];
  const coiffeurs = report?.coiffeurs || [];
  const best = staff.find((s) => s.total_revenue > 0);

  return (
    <div style={styles.container} className="perf-page">
      {toast && <Toast {...toast} onClose={() => setToast(null)} />}

      <button onClick={onBack} style={styles.backBtn}>← Retour</button>
      <h1 style={styles.title}>Performance de l'équipe</h1>
      <p style={styles.subtitle}>Ventes encaissées par chaque membre (tickets non annulés) et par coiffeur.</p>

      <div style={styles.filters}>
        {PRESETS.map((p) => (
          <button key={p.id} onClick={() => applyPreset(p)} style={{ ...styles.chip, ...(preset === p.id ? styles.chipActive : {}) }}>
            {p.label}
          </button>
        ))}
        <label style={styles.dateLabel}>
          Du
          <input type="date" value={dateFrom} onChange={(e) => { setPreset(null); setDateFrom(e.target.value); }} style={styles.dateInput} />
        </label>
        <label style={styles.dateLabel}>
          au
          <input type="date" value={dateTo} onChange={(e) => { setPreset(null); setDateTo(e.target.value); }} style={styles.dateInput} />
        </label>
      </div>

      {loading && !report ? (
        <div style={styles.empty}>Chargement…</div>
      ) : (
        <>
          {best && (
            <div style={styles.highlight}>
              🏆 Meilleur chiffre sur la période : <strong>{best.name}</strong> avec {dh(best.total_revenue)}
            </div>
          )}

          <section style={styles.card}>
            <h2 style={styles.cardTitle}>Par membre de l'équipe</h2>
            <div style={styles.tableWrap}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Membre</th>
                    <th style={styles.thNum}>Tickets</th>
                    <th style={styles.thNum}>CA ventes</th>
                    <th style={styles.thNum}>Panier moyen</th>
                    <th style={styles.thNum}>Remises</th>
                    <th style={styles.thNum}>Annulés</th>
                    {mods.gaming && <th style={styles.thNum}>Jeux</th>}
                    <th style={styles.thNum}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {staff.map((s) => (
                    <tr key={s.id} style={s.is_active ? undefined : styles.rowInactive}>
                      <td style={styles.td}>
                        <strong>{s.name}</strong>
                        <span style={styles.role}>{s.role === "admin" ? "Admin" : "Agent"}{!s.is_active && " · désactivé"}</span>
                      </td>
                      <td style={styles.tdNum}>{s.tickets}</td>
                      <td style={styles.tdNum}>{dh(s.revenue)}</td>
                      <td style={styles.tdNum}>{dh(s.average)}</td>
                      <td style={{ ...styles.tdNum, color: s.discount > 0 ? "#b45309" : undefined }}>{dh(s.discount)}</td>
                      <td style={{ ...styles.tdNum, color: s.cancelled > 0 ? "#dc2626" : undefined }}>
                        {s.cancelled}
                        {s.cancelled > 0 && <span style={styles.sub}>{dh(s.cancelled_amount)}</span>}
                      </td>
                      {mods.gaming && (
                        <td style={styles.tdNum}>
                          {dh(s.gaming_revenue)}
                          <span style={styles.sub}>{s.gaming_sessions} session(s)</span>
                        </td>
                      )}
                      <td style={{ ...styles.tdNum, fontWeight: 800 }}>{dh(s.total_revenue)}</td>
                    </tr>
                  ))}
                  {staff.length === 0 && (
                    <tr><td style={styles.td} colSpan={8}>Aucun membre.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {mods.coiffure && coiffeurs.length > 0 && (
            <section style={styles.card}>
              <h2 style={styles.cardTitle}>Par coiffeur</h2>
              <div style={styles.tableWrap}>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th style={styles.th}>Coiffeur</th>
                      <th style={styles.thNum}>Tickets</th>
                      <th style={styles.thNum}>Chiffre d'affaires</th>
                      <th style={styles.thNum}>Panier moyen</th>
                      <th style={styles.thNum}>Remises</th>
                      <th style={styles.thNum}>Annulés</th>
                    </tr>
                  </thead>
                  <tbody>
                    {coiffeurs.map((c) => (
                      <tr key={c.id}>
                        <td style={styles.td}><strong>{c.name}</strong></td>
                        <td style={styles.tdNum}>{c.tickets}</td>
                        <td style={{ ...styles.tdNum, fontWeight: 800 }}>{dh(c.revenue)}</td>
                        <td style={styles.tdNum}>{dh(c.average)}</td>
                        <td style={styles.tdNum}>{dh(c.discount)}</td>
                        <td style={{ ...styles.tdNum, color: c.cancelled > 0 ? "#dc2626" : undefined }}>{c.cancelled}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </>
      )}

      <style>{`
        @media (max-width: 600px) {
          .perf-page { padding: 20px 16px !important; }
        }
      `}</style>
    </div>
  );
}

const styles = {
  container: { minHeight: "100vh", backgroundColor: "#f7f5f2", padding: "40px", color: "#1a1410" },
  backBtn: { background: "rgba(0, 0, 0, 0.04)", border: "1px solid #e8e2d8", color: "#6b6155", padding: "10px 20px", borderRadius: "8px", cursor: "pointer", fontSize: "14px", marginBottom: "16px" },
  title: { margin: 0, fontSize: "30px", fontWeight: "700" },
  subtitle: { margin: "6px 0 20px", color: "#6b6155", fontSize: "14px" },
  filters: { display: "flex", flexWrap: "wrap", gap: "8px", alignItems: "center", marginBottom: "20px" },
  chip: { padding: "8px 14px", borderRadius: "20px", background: "#ffffff", border: "1px solid #e8e2d8", color: "#6b6155", fontSize: "13px", fontWeight: 600, cursor: "pointer" },
  chipActive: { background: "rgba(201,162,75,0.15)", borderColor: "rgba(201,162,75,0.5)", color: "#a5822f" },
  dateLabel: { display: "flex", alignItems: "center", gap: "6px", fontSize: "13px", color: "#6b6155", fontWeight: 600 },
  dateInput: { padding: "7px 10px", border: "1px solid #d9d2c4", borderRadius: "8px", fontSize: "13px", background: "#ffffff", color: "#1a1410" },
  highlight: { background: "rgba(201,162,75,0.12)", border: "1px solid rgba(201,162,75,0.35)", borderRadius: "12px", padding: "12px 16px", marginBottom: "20px", fontSize: "14px" },
  card: { background: "#ffffff", border: "1px solid #e8e2d8", borderRadius: "16px", padding: "20px", marginBottom: "20px" },
  cardTitle: { margin: "0 0 14px", fontSize: "17px", fontWeight: 700 },
  tableWrap: { overflowX: "auto" },
  table: { width: "100%", borderCollapse: "collapse", fontSize: "13.5px", minWidth: "640px" },
  th: { textAlign: "left", padding: "10px 12px", borderBottom: "2px solid #e8e2d8", color: "#6b6155", fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.4px" },
  thNum: { textAlign: "right", padding: "10px 12px", borderBottom: "2px solid #e8e2d8", color: "#6b6155", fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.4px", whiteSpace: "nowrap" },
  td: { padding: "12px", borderBottom: "1px solid #f0ebe2", verticalAlign: "top" },
  tdNum: { padding: "12px", borderBottom: "1px solid #f0ebe2", textAlign: "right", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap", verticalAlign: "top" },
  rowInactive: { opacity: 0.55 },
  role: { display: "block", fontSize: "12px", color: "#8a8070", marginTop: "2px" },
  sub: { display: "block", fontSize: "11.5px", color: "#8a8070", marginTop: "2px" },
  empty: { padding: "60px 20px", textAlign: "center", color: "#6b6155" },
};

export default StaffPerformancePage;
