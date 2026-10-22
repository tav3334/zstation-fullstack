import { useCallback, useEffect, useState } from "react";
import api from "../services/api";
import Toast from "../components/Toast";
import useConfirm from "../hooks/useConfirm";

const ROLE_LABELS = { admin: "Admin", agent: "Agent" };

function TeamManagement({ onBack }) {
  const [team, setTeam] = useState([]);
  const [limitMessage, setLimitMessage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [toast, setToast] = useState(null);
  const [formData, setFormData] = useState({ name: "", email: "", password: "", role: "agent" });
  const [saving, setSaving] = useState(false);
  const { confirm, ConfirmModal } = useConfirm();

  const showToast = useCallback((message, type = "info", duration = 3000) => {
    setToast({ message, type, duration });
  }, []);

  const loadTeam = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/team");
      setTeam(res.data.team);
      setLimitMessage(res.data.limit_message);
    } catch (e) {
      showToast("Erreur chargement équipe: " + (e.response?.data?.message || e.message), "error");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadTeam();
  }, [loadTeam]);

  const openAddModal = () => {
    setFormData({ name: "", email: "", password: "", role: "agent" });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post("/team", formData);
      showToast("Membre de l'équipe créé avec succès", "success");
      setShowModal(false);
      loadTeam();
    } catch (e) {
      showToast(e.response?.data?.message || "Erreur lors de la création", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (member) => {
    if (!(await confirm(`Êtes-vous sûr de vouloir supprimer ${member.name} ?`))) return;
    try {
      await api.delete(`/team/${member.id}`);
      showToast("Membre supprimé avec succès", "success");
      loadTeam();
    } catch (e) {
      showToast(e.response?.data?.message || "Erreur lors de la suppression", "error");
    }
  };

  if (loading) {
    return (
      <div style={styles.loadingContainer}>
        <div style={styles.spinner}></div>
        <p>Chargement...</p>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {toast && <Toast {...toast} onClose={() => setToast(null)} />}
      {ConfirmModal}

      <div style={styles.header}>
        <div>
          <button onClick={onBack} style={styles.backBtn}>← Retour</button>
          <h1 style={styles.title}>Mon Équipe</h1>
        </div>
        <button onClick={openAddModal} style={styles.addBtn}>+ Ajouter un membre</button>
      </div>

      {limitMessage && (
        <div style={styles.limitBanner}>{limitMessage}</div>
      )}

      <div style={styles.grid}>
        {team.map((member) => (
          <div key={member.id} style={styles.card}>
            <div style={styles.avatar}>{member.name.charAt(0).toUpperCase()}</div>
            <div style={styles.cardName}>{member.name}</div>
            <div style={styles.cardEmail}>{member.email}</div>
            <div style={{
              ...styles.roleBadge,
              background: member.role === "admin" ? "rgba(201,162,75,0.12)" : "rgba(59,130,246,0.1)",
              color: member.role === "admin" ? "#a5822f" : "#2563eb",
            }}>
              {ROLE_LABELS[member.role] || member.role}
            </div>
            <div style={styles.cardActions}>
              <button onClick={() => handleDelete(member)} style={styles.deleteBtn}>🗑️ Supprimer</button>
            </div>
          </div>
        ))}
      </div>

      {team.length === 0 && (
        <div style={styles.emptyState}>
          <div style={styles.emptyIcon}>👥</div>
          <div>Aucun membre dans l'équipe</div>
        </div>
      )}

      {showModal && (
        <div style={styles.modalOverlay}>
          <div style={styles.modal}>
            <div style={styles.modalHeader}>
              <h2 style={styles.modalTitle}>Ajouter un membre</h2>
              <button onClick={() => setShowModal(false)} style={styles.modalCloseBtn}>✕</button>
            </div>
            <form onSubmit={handleSubmit} style={styles.form}>
              <div style={styles.formGroup}>
                <label style={styles.label}>Nom</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  style={styles.input}
                  required
                />
              </div>
              <div style={styles.formGroup}>
                <label style={styles.label}>Email</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  style={styles.input}
                  required
                />
              </div>
              <div style={styles.formGroup}>
                <label style={styles.label}>Mot de passe</label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  style={styles.input}
                  minLength={6}
                  required
                />
              </div>
              <div style={styles.formGroup}>
                <label style={styles.label}>Rôle</label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  style={styles.input}
                >
                  <option value="agent">Agent</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div style={styles.modalActions}>
                <button type="button" onClick={() => setShowModal(false)} style={styles.cancelBtn}>Annuler</button>
                <button type="submit" style={styles.submitBtn} disabled={saving}>
                  {saving ? "Création..." : "Ajouter"}
                </button>
              </div>
            </form>
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
  header: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "20px" },
  backBtn: { background: "rgba(0, 0, 0, 0.04)", border: "1px solid #e8e2d8", color: "#6b6155", padding: "10px 20px", borderRadius: "8px", cursor: "pointer", fontSize: "14px", marginBottom: "16px" },
  title: { margin: 0, fontSize: "32px", fontWeight: "700", color: "#1a1410" },
  addBtn: { background: "linear-gradient(135deg, #e0b85c 0%, #c9a24b 100%)", border: "none", color: "#1a1408", padding: "12px 24px", borderRadius: "12px", cursor: "pointer", fontSize: "15px", fontWeight: "700", boxShadow: "0 4px 12px rgba(201, 162, 75, 0.35)" },
  limitBanner: { background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.3)", color: "#92400e", padding: "12px 18px", borderRadius: "10px", marginBottom: "24px", fontSize: "14px", fontWeight: "500" },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "20px" },
  card: { background: "#ffffff", borderRadius: "16px", border: "1px solid #e8e2d8", padding: "24px", textAlign: "center" },
  avatar: { width: "60px", height: "60px", borderRadius: "50%", background: "linear-gradient(135deg, #e0b85c 0%, #c9a24b 100%)", color: "#1a1408", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "24px", fontWeight: "700", margin: "0 auto 12px" },
  cardName: { fontSize: "16px", fontWeight: "700", color: "#1a1410", marginBottom: "4px" },
  cardEmail: { fontSize: "13px", color: "#6b6155", marginBottom: "12px", wordBreak: "break-all" },
  roleBadge: { display: "inline-block", padding: "4px 12px", borderRadius: "20px", fontSize: "12px", fontWeight: "700", marginBottom: "14px" },
  cardActions: { display: "flex", gap: "8px", justifyContent: "center" },
  deleteBtn: { padding: "8px 16px", background: "rgba(239, 68, 68, 0.1)", border: "1px solid rgba(239, 68, 68, 0.3)", borderRadius: "8px", color: "#dc2626", cursor: "pointer", fontSize: "13px", fontWeight: "600" },
  emptyState: { textAlign: "center", padding: "60px 20px", color: "#6b6155" },
  emptyIcon: { fontSize: "48px", marginBottom: "16px" },
  modalOverlay: { position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0, 0, 0, 0.8)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 10000, padding: "20px" },
  modal: { backgroundColor: "#ffffff", borderRadius: "20px", width: "90%", maxWidth: "480px", boxShadow: "0 20px 60px rgba(0, 0, 0, 0.25)" },
  modalHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "24px", borderBottom: "1px solid #e8e2d8" },
  modalTitle: { margin: 0, fontSize: "22px", fontWeight: "700", color: "#1a1410" },
  modalCloseBtn: { background: "rgba(0, 0, 0, 0.06)", border: "none", color: "#1a1410", width: "36px", height: "36px", borderRadius: "50%", cursor: "pointer", fontSize: "20px" },
  form: { padding: "24px" },
  formGroup: { display: "flex", flexDirection: "column", marginBottom: "20px" },
  label: { fontSize: "14px", fontWeight: "600", color: "#1a1410", marginBottom: "8px" },
  input: { padding: "12px", background: "#f7f5f2", border: "1px solid #e8e2d8", borderRadius: "10px", color: "#1a1410", fontSize: "14px" },
  modalActions: { display: "flex", gap: "12px", marginTop: "24px" },
  cancelBtn: { flex: 1, padding: "14px", background: "rgba(0, 0, 0, 0.04)", border: "1px solid #e8e2d8", borderRadius: "10px", color: "#6b6155", fontSize: "15px", fontWeight: "600", cursor: "pointer" },
  submitBtn: { flex: 2, padding: "14px", background: "linear-gradient(135deg, #e0b85c 0%, #c9a24b 100%)", border: "none", borderRadius: "10px", color: "#1a1408", fontSize: "15px", fontWeight: "700", cursor: "pointer", boxShadow: "0 4px 12px rgba(201, 162, 75, 0.35)" },
};

export default TeamManagement;
