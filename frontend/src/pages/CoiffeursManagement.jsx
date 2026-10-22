import { useCallback, useEffect, useState } from "react";
import api from "../services/api";
import Toast from "../components/Toast";
import useConfirm from "../hooks/useConfirm";

function CoiffeursManagement({ onBack }) {
  const [coiffeurs, setCoiffeurs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingCoiffeur, setEditingCoiffeur] = useState(null);
  const [toast, setToast] = useState(null);
  const { confirm, ConfirmModal } = useConfirm();
  const [formData, setFormData] = useState({ name: "", phone: "" });

  const showToast = useCallback((message, type = "info", duration = 3000) => {
    setToast({ message, type, duration });
  }, []);

  const loadCoiffeurs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/coiffeurs/all");
      setCoiffeurs(res.data);
    } catch (e) {
      showToast("Erreur chargement coiffeurs: " + (e.response?.data?.message || e.message), "error");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadCoiffeurs();
  }, [loadCoiffeurs]);

  const openAddModal = () => {
    setEditingCoiffeur(null);
    setFormData({ name: "", phone: "" });
    setShowModal(true);
  };

  const openEditModal = (coiffeur) => {
    setEditingCoiffeur(coiffeur);
    setFormData({ name: coiffeur.name, phone: coiffeur.phone || "" });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingCoiffeur) {
        await api.put(`/coiffeurs/${editingCoiffeur.id}`, formData);
        showToast("Coiffeur modifié avec succès", "success");
      } else {
        await api.post("/coiffeurs", formData);
        showToast("Coiffeur créé avec succès", "success");
      }
      setShowModal(false);
      loadCoiffeurs();
    } catch (e) {
      showToast("Erreur: " + (e.response?.data?.message || e.message), "error");
    }
  };

  const handleDelete = async (id) => {
    if (!(await confirm("Êtes-vous sûr de vouloir supprimer ce coiffeur ?"))) return;
    try {
      const res = await api.delete(`/coiffeurs/${id}`);
      showToast(res.data.message, "success");
      loadCoiffeurs();
    } catch (e) {
      showToast("Erreur: " + (e.response?.data?.message || e.message), "error");
    }
  };

  const toggleActive = async (coiffeur) => {
    try {
      await api.put(`/coiffeurs/${coiffeur.id}`, { is_active: !coiffeur.is_active });
      showToast(coiffeur.is_active ? "Coiffeur désactivé" : "Coiffeur activé", "success");
      loadCoiffeurs();
    } catch (e) {
      showToast("Erreur: " + (e.response?.data?.message || e.message), "error");
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
          <h1 style={styles.title}>Gestion des Coiffeurs</h1>
        </div>
        <button onClick={openAddModal} style={styles.addBtn}>+ Ajouter un coiffeur</button>
      </div>

      <div style={styles.grid}>
        {coiffeurs.map((coiffeur) => (
          <div key={coiffeur.id} style={styles.card}>
            <div style={styles.avatar}>{coiffeur.name.charAt(0).toUpperCase()}</div>
            <div style={styles.cardName}>{coiffeur.name}</div>
            {coiffeur.phone && <div style={styles.cardPhone}>{coiffeur.phone}</div>}
            <button
              onClick={() => toggleActive(coiffeur)}
              style={{
                ...styles.statusBtn,
                background: coiffeur.is_active ? "#dcfce7" : "#fee2e2",
                color: coiffeur.is_active ? "#166534" : "#991b1b",
              }}
            >
              {coiffeur.is_active ? "✓ Actif" : "✕ Inactif"}
            </button>
            <div style={styles.cardActions}>
              <button onClick={() => openEditModal(coiffeur)} style={styles.editBtn}>✏️ Modifier</button>
              <button onClick={() => handleDelete(coiffeur.id)} style={styles.deleteBtn}>🗑️</button>
            </div>
          </div>
        ))}
      </div>

      {coiffeurs.length === 0 && (
        <div style={styles.emptyState}>
          <div style={styles.emptyIcon}>💈</div>
          <div>Aucun coiffeur enregistré</div>
        </div>
      )}

      {showModal && (
        <div style={styles.modalOverlay}>
          <div style={styles.modal}>
            <div style={styles.modalHeader}>
              <h2 style={styles.modalTitle}>{editingCoiffeur ? "Modifier le coiffeur" : "Ajouter un coiffeur"}</h2>
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
                <label style={styles.label}>Téléphone (optionnel)</label>
                <input
                  type="text"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  style={styles.input}
                />
              </div>
              <div style={styles.modalActions}>
                <button type="button" onClick={() => setShowModal(false)} style={styles.cancelBtn}>Annuler</button>
                <button type="submit" style={styles.submitBtn}>{editingCoiffeur ? "Modifier" : "Ajouter"}</button>
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
  header: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "30px" },
  backBtn: { background: "rgba(0, 0, 0, 0.04)", border: "1px solid #e8e2d8", color: "#6b6155", padding: "10px 20px", borderRadius: "8px", cursor: "pointer", fontSize: "14px", marginBottom: "16px" },
  title: { margin: 0, fontSize: "32px", fontWeight: "700", color: "#1a1410" },
  addBtn: { background: "linear-gradient(135deg, #e0b85c 0%, #c9a24b 100%)", border: "none", color: "#1a1408", padding: "12px 24px", borderRadius: "12px", cursor: "pointer", fontSize: "15px", fontWeight: "700", boxShadow: "0 4px 12px rgba(201, 162, 75, 0.35)" },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "20px" },
  card: { background: "#ffffff", borderRadius: "16px", border: "1px solid #e8e2d8", padding: "24px", textAlign: "center" },
  avatar: { width: "60px", height: "60px", borderRadius: "50%", background: "linear-gradient(135deg, #e0b85c 0%, #c9a24b 100%)", color: "#1a1408", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "24px", fontWeight: "700", margin: "0 auto 12px" },
  cardName: { fontSize: "16px", fontWeight: "700", color: "#1a1410", marginBottom: "4px" },
  cardPhone: { fontSize: "13px", color: "#6b6155", marginBottom: "12px" },
  statusBtn: { padding: "6px 12px", border: "none", borderRadius: "6px", fontSize: "13px", fontWeight: "600", cursor: "pointer", marginBottom: "12px" },
  cardActions: { display: "flex", gap: "8px", justifyContent: "center" },
  editBtn: { padding: "8px 16px", background: "rgba(59, 130, 246, 0.1)", border: "1px solid rgba(59, 130, 246, 0.3)", borderRadius: "8px", color: "#2563eb", cursor: "pointer", fontSize: "13px", fontWeight: "600" },
  deleteBtn: { padding: "8px 12px", background: "rgba(239, 68, 68, 0.1)", border: "1px solid rgba(239, 68, 68, 0.3)", borderRadius: "8px", color: "#dc2626", cursor: "pointer", fontSize: "13px", fontWeight: "600" },
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

export default CoiffeursManagement;
