import { useCallback, useEffect, useState } from "react";
import api from "../services/api";
import Toast from "../components/Toast";

// Libellés et couleurs des actions (clés = server/src/lib/activity.js)
const ACTIONS = {
  login: { label: "Connexion", color: "#2563eb" },
  pin_switch: { label: "Changement de caissier", color: "#2563eb" },
  logout: { label: "Déconnexion", color: "#6b6155" },
  profile_update: { label: "Profil modifié", color: "#6b6155" },
  password_change: { label: "Mot de passe changé", color: "#b45309" },
  pin_change: { label: "Code PIN modifié", color: "#b45309" },
  sale_discount: { label: "Remise accordée", color: "#b45309" },
  sale_cancel: { label: "Ticket annulé", color: "#dc2626" },
  register_opening: { label: "Fond de caisse", color: "#047857" },
  register_withdraw: { label: "Retrait de caisse", color: "#dc2626" },
  register_close: { label: "Clôture de caisse", color: "#047857" },
  team_create: { label: "Membre ajouté", color: "#a5822f" },
  team_update: { label: "Membre modifié", color: "#a5822f" },
  team_deactivate: { label: "Compte désactivé", color: "#dc2626" },
  team_activate: { label: "Compte réactivé", color: "#047857" },
  team_password_reset: { label: "Mot de passe réinitialisé", color: "#b45309" },
  team_delete: { label: "Membre supprimé", color: "#dc2626" },
};

const LIMIT = 50;

function ActivityLogPage({ onBack }) {
  const [logs, setLogs] = useState([]);
  const [team, setTeam] = useState([]);
  const [total, setTotal] = useState(0);
  const [lastPage, setLastPage] = useState(1);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({ user_id: "", action: "", date_from: "", date_to: "" });
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  const load = useCallback(() => {
    const params = { page, limit: LIMIT };
    Object.entries(filters).forEach(([k, v]) => {
      if (v) params[k] = v;
    });
    return api
      .get("/activity-logs", { params })
      .then((res) => {
        setLogs(res.data.logs || []);
        setTotal(res.data.total || 0);
        setLastPage(res.data.last_page || 1);
      })
      .catch((e) => setToast({ message: "Erreur: " + (e.response?.data?.message || e.message), type: "error" }))
      .finally(() => setLoading(false));
  }, [filters, page]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    api.get("/team").then((res) => setTeam(res.data.team || [])).catch(() => setTeam([]));
  }, []);

  const setFilter = (key, value) => {
    setPage(1);
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <div style={styles.container} className="activity-page">
      {toast && <Toast {...toast} onClose={() => setToast(null)} />}

      <button onClick={onBack} style={styles.backBtn}>← Retour</button>
      <h1 style={styles.title}>Journal d'activité</h1>
      <p style={styles.subtitle}>Connexions, remises, annulations, opérations de caisse et gestion de l'équipe.</p>

      <div style={styles.filters}>
        <select value={filters.user_id} onChange={(e) => setFilter("user_id", e.target.value)} style={styles.input}>
          <option value="">Tous les membres</option>
          {team.map((m) => (
            <option key={m.id} value={m.id}>{m.name}</option>
          ))}
        </select>
        <select value={filters.action} onChange={(e) => setFilter("action", e.target.value)} style={styles.input}>
          <option value="">Toutes les actions</option>
          {Object.entries(ACTIONS).map(([key, a]) => (
            <option key={key} value={key}>{a.label}</option>
          ))}
        </select>
        <label style={styles.dateLabel}>
          Du
          <input type="date" value={filters.date_from} onChange={(e) => setFilter("date_from", e.target.value)} style={styles.input} />
        </label>
        <label style={styles.dateLabel}>
          au
          <input type="date" value={filters.date_to} onChange={(e) => setFilter("date_to", e.target.value)} style={styles.input} />
        </label>
      </div>

      <div style={styles.card}>
        {loading && logs.length === 0 ? (
          <div style={styles.empty}>Chargement…</div>
        ) : logs.length === 0 ? (
          <div style={styles.empty}>Aucune activité pour ces filtres.</div>
        ) : (
          logs.map((log) => {
            const action = ACTIONS[log.action] || { label: log.action, color: "#6b6155" };
            const date = new Date(log.created_at);
            return (
              <div key={log.id} style={styles.row}>
                <div style={styles.when}>
                  <div style={styles.time}>{date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</div>
                  <div style={styles.date}>{date.toLocaleDateString("fr-FR")}</div>
                </div>
                <div style={styles.what}>
                  <span style={{ ...styles.badge, color: action.color, borderColor: action.color }}>{action.label}</span>
                  <div style={styles.desc}>{log.description}</div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {lastPage > 1 && (
        <div style={styles.pager}>
          <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} style={styles.pageBtn}>← Précédent</button>
          <span style={styles.pageInfo}>Page {page} / {lastPage} · {total} entrées</span>
          <button onClick={() => setPage((p) => Math.min(lastPage, p + 1))} disabled={page >= lastPage} style={styles.pageBtn}>Suivant →</button>
        </div>
      )}

      <style>{`
        @media (max-width: 600px) {
          .activity-page { padding: 20px 16px !important; }
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
  filters: { display: "flex", flexWrap: "wrap", gap: "10px", alignItems: "center", marginBottom: "20px" },
  input: { padding: "9px 12px", border: "1px solid #d9d2c4", borderRadius: "8px", fontSize: "13.5px", background: "#ffffff", color: "#1a1410", fontFamily: "inherit" },
  dateLabel: { display: "flex", alignItems: "center", gap: "6px", fontSize: "13px", color: "#6b6155", fontWeight: 600 },
  card: { background: "#ffffff", border: "1px solid #e8e2d8", borderRadius: "16px", padding: "6px 20px" },
  row: { display: "flex", gap: "16px", padding: "14px 0", borderBottom: "1px solid #f0ebe2" },
  when: { width: "78px", flexShrink: 0 },
  time: { fontSize: "15px", fontWeight: 700, fontVariantNumeric: "tabular-nums" },
  date: { fontSize: "12px", color: "#8a8070" },
  what: { flex: 1, minWidth: 0 },
  badge: { display: "inline-block", fontSize: "11.5px", fontWeight: 700, border: "1px solid", borderRadius: "20px", padding: "2px 10px", marginBottom: "5px" },
  desc: { fontSize: "14px", lineHeight: 1.45, wordBreak: "break-word" },
  empty: { padding: "50px 10px", textAlign: "center", color: "#6b6155" },
  pager: { display: "flex", alignItems: "center", justifyContent: "center", gap: "14px", marginTop: "18px", flexWrap: "wrap" },
  pageBtn: { padding: "9px 16px", background: "#ffffff", border: "1px solid #e8e2d8", borderRadius: "8px", cursor: "pointer", fontSize: "13.5px", fontWeight: 600, color: "#1a1410" },
  pageInfo: { fontSize: "13px", color: "#6b6155" },
};

export default ActivityLogPage;
