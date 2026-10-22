import { useCallback, useEffect, useState } from "react";
import api from "../services/api";
import Toast from "../components/Toast";
import useConfirm from "../hooks/useConfirm";

const STATUS_LABELS = { available: "Disponible", in_session: "En session", maintenance: "Maintenance" };
const STATUS_COLORS = {
  available: { bg: "#dcfce7", color: "#166534" },
  in_session: { bg: "#dbeafe", color: "#1e40af" },
  maintenance: { bg: "#fee2e2", color: "#991b1b" },
};

const EMPTY_MACHINE = { type: "", status: "available" };
const EMPTY_GAME = { name: "", price_6min: "", price_30min: "", price_1h: "", price_2h: "", price_3h: "" };

function MachinesGamesManagement({ onBack }) {
  const [tab, setTab] = useState("machines"); // 'machines' | 'games'
  const [machines, setMachines] = useState([]);
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  const [showMachineModal, setShowMachineModal] = useState(false);
  const [editingMachine, setEditingMachine] = useState(null);
  const [machineForm, setMachineForm] = useState(EMPTY_MACHINE);

  const [showGameModal, setShowGameModal] = useState(false);
  const [editingGame, setEditingGame] = useState(null);
  const [gameForm, setGameForm] = useState(EMPTY_GAME);
  const [saving, setSaving] = useState(false);
  const { confirm, ConfirmModal } = useConfirm();

  const [matchModalGame, setMatchModalGame] = useState(null); // game object or null
  const [editingMatchPricing, setEditingMatchPricing] = useState(null);
  const [matchForm, setMatchForm] = useState({ matches_count: "", price: "", description: "" });

  const showToast = useCallback((message, type = "info", duration = 3500) => {
    setToast({ message, type, duration });
  }, []);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [mRes, gRes] = await Promise.all([
        api.get("/machine-management"),
        api.get("/game-management"),
      ]);
      setMachines(mRes.data.machines);
      setGames(gRes.data.games);
    } catch (e) {
      showToast("Erreur de chargement: " + (e.response?.data?.message || e.message), "error");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // ---- Machines ----
  const openAddMachine = () => {
    setEditingMachine(null);
    setMachineForm(EMPTY_MACHINE);
    setShowMachineModal(true);
  };
  const openEditMachine = (m) => {
    setEditingMachine(m);
    setMachineForm({ type: m.type, status: m.status });
    setShowMachineModal(true);
  };
  const submitMachine = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editingMachine) {
        await api.put(`/machine-management/${editingMachine.id}`, machineForm);
        showToast("Machine modifiée avec succès", "success");
      } else {
        await api.post("/machine-management", machineForm);
        showToast("Machine créée avec succès", "success");
      }
      setShowMachineModal(false);
      loadAll();
    } catch (e) {
      showToast(e.response?.data?.message || "Erreur", "error");
    } finally {
      setSaving(false);
    }
  };
  const deleteMachine = async (m) => {
    if (!(await confirm(`Supprimer la machine "${m.type}" ?`))) return;
    try {
      await api.delete(`/machine-management/${m.id}`);
      showToast("Machine supprimée avec succès", "success");
      loadAll();
    } catch (e) {
      showToast(e.response?.data?.message || "Erreur", "error");
    }
  };

  // ---- Games ----
  const openAddGame = () => {
    setEditingGame(null);
    setGameForm(EMPTY_GAME);
    setShowGameModal(true);
  };
  const openEditGame = (g) => {
    setEditingGame(g);
    setGameForm({
      name: g.name,
      price_6min: g.price_6min,
      price_30min: g.price_30min,
      price_1h: g.price_1h,
      price_2h: g.price_2h,
      price_3h: g.price_3h,
    });
    setShowGameModal(true);
  };
  const submitGame = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editingGame) {
        await api.put(`/game-management/${editingGame.id}`, gameForm);
        showToast("Jeu modifié avec succès", "success");
      } else {
        await api.post("/game-management", gameForm);
        showToast("Jeu créé avec succès", "success");
      }
      setShowGameModal(false);
      loadAll();
    } catch (e) {
      showToast(e.response?.data?.message || "Erreur", "error");
    } finally {
      setSaving(false);
    }
  };
  const deleteGame = async (g) => {
    if (!(await confirm(`Supprimer le jeu "${g.name}" ?`))) return;
    try {
      await api.delete(`/game-management/${g.id}`);
      showToast("Jeu supprimé avec succès", "success");
      loadAll();
    } catch (e) {
      showToast(e.response?.data?.message || "Erreur", "error");
    }
  };

  // ---- Match pricings ----
  const openMatchPricings = (g) => setMatchModalGame(g);
  const closeMatchPricings = () => { setMatchModalGame(null); setEditingMatchPricing(null); };
  const openAddMatchPricing = () => {
    setEditingMatchPricing(null);
    setMatchForm({ matches_count: "", price: "", description: "" });
  };
  const openEditMatchPricing = (p) => {
    setEditingMatchPricing(p);
    setMatchForm({ matches_count: p.matches_count, price: p.price, description: p.description || "" });
  };
  const submitMatchPricing = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editingMatchPricing) {
        await api.put(`/game-management/${matchModalGame.id}/match-pricings/${editingMatchPricing.id}`, matchForm);
        showToast("Tarif par match modifié avec succès", "success");
      } else {
        await api.post(`/game-management/${matchModalGame.id}/match-pricings`, matchForm);
        showToast("Tarif par match ajouté avec succès", "success");
      }
      setEditingMatchPricing(null);
      setMatchForm({ matches_count: "", price: "", description: "" });
      const res = await api.get("/game-management");
      setGames(res.data.games);
      setMatchModalGame(res.data.games.find((g) => g.id === matchModalGame.id));
    } catch (e) {
      showToast(e.response?.data?.message || "Erreur", "error");
    } finally {
      setSaving(false);
    }
  };
  const deleteMatchPricing = async (p) => {
    if (!(await confirm(`Supprimer le tarif "${p.matches_count} match(s)" ?`))) return;
    try {
      await api.delete(`/game-management/${matchModalGame.id}/match-pricings/${p.id}`);
      showToast("Tarif supprimé avec succès", "success");
      const res = await api.get("/game-management");
      setGames(res.data.games);
      setMatchModalGame(res.data.games.find((g) => g.id === matchModalGame.id));
    } catch (e) {
      showToast(e.response?.data?.message || "Erreur", "error");
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
          <h1 style={styles.title}>Machines & Jeux</h1>
        </div>
        <button onClick={tab === "machines" ? openAddMachine : openAddGame} style={styles.addBtn}>
          + Ajouter {tab === "machines" ? "une machine" : "un jeu"}
        </button>
      </div>

      <div style={styles.tabs}>
        <button
          onClick={() => setTab("machines")}
          style={{ ...styles.tabBtn, ...(tab === "machines" ? styles.tabBtnActive : {}) }}
        >
          Machines ({machines.length})
        </button>
        <button
          onClick={() => setTab("games")}
          style={{ ...styles.tabBtn, ...(tab === "games" ? styles.tabBtnActive : {}) }}
        >
          Jeux ({games.length})
        </button>
      </div>

      {tab === "machines" ? (
        <div style={styles.grid}>
          {machines.map((m) => {
            const statusStyle = STATUS_COLORS[m.status] || STATUS_COLORS.available;
            return (
              <div key={m.id} style={styles.card}>
                <div style={styles.cardName}>{m.type}</div>
                <div style={{ ...styles.statusBadge, background: statusStyle.bg, color: statusStyle.color }}>
                  {STATUS_LABELS[m.status] || m.status}
                </div>
                <div style={styles.cardActions}>
                  <button onClick={() => openEditMachine(m)} style={styles.editBtn}>✏️ Modifier</button>
                  <button onClick={() => deleteMachine(m)} style={styles.deleteBtn}>🗑️</button>
                </div>
              </div>
            );
          })}
          {machines.length === 0 && (
            <div style={styles.emptyState}>
              <div style={styles.emptyIcon}>🎮</div>
              <div>Aucune machine enregistrée</div>
            </div>
          )}
        </div>
      ) : (
        <div style={styles.grid}>
          {games.map((g) => (
            <div key={g.id} style={styles.card}>
              <div style={styles.cardName}>{g.name}</div>
              <div style={styles.pricesGrid}>
                <div style={styles.priceRow}><span>6 min</span><b>{g.price_6min} DH</b></div>
                <div style={styles.priceRow}><span>30 min</span><b>{g.price_30min} DH</b></div>
                <div style={styles.priceRow}><span>1h</span><b>{g.price_1h} DH</b></div>
                <div style={styles.priceRow}><span>2h</span><b>{g.price_2h} DH</b></div>
                <div style={styles.priceRow}><span>3h</span><b>{g.price_3h} DH</b></div>
              </div>
              {g.match_pricings?.length > 0 && (
                <div style={styles.matchPricingsSummary}>
                  {g.match_pricings.length} tarif{g.match_pricings.length > 1 ? "s" : ""} par match
                </div>
              )}
              <div style={styles.cardActions}>
                <button onClick={() => openEditGame(g)} style={styles.editBtn}>✏️ Modifier</button>
                <button onClick={() => deleteGame(g)} style={styles.deleteBtn}>🗑️</button>
              </div>
              <button onClick={() => openMatchPricings(g)} style={styles.matchBtn}>🏆 Tarifs par match</button>
            </div>
          ))}
          {games.length === 0 && (
            <div style={styles.emptyState}>
              <div style={styles.emptyIcon}>🕹️</div>
              <div>Aucun jeu enregistré</div>
            </div>
          )}
        </div>
      )}

      {showMachineModal && (
        <div style={styles.modalOverlay}>
          <div style={styles.modal}>
            <div style={styles.modalHeader}>
              <h2 style={styles.modalTitle}>{editingMachine ? "Modifier la machine" : "Ajouter une machine"}</h2>
              <button onClick={() => setShowMachineModal(false)} style={styles.modalCloseBtn}>✕</button>
            </div>
            <form onSubmit={submitMachine} style={styles.form}>
              <div style={styles.formGroup}>
                <label style={styles.label}>Nom / Type</label>
                <input
                  type="text"
                  value={machineForm.type}
                  onChange={(e) => setMachineForm({ ...machineForm, type: e.target.value })}
                  style={styles.input}
                  placeholder="Ex: PS5 - Poste 1"
                  required
                />
              </div>
              <div style={styles.formGroup}>
                <label style={styles.label}>Statut</label>
                <select
                  value={machineForm.status}
                  onChange={(e) => setMachineForm({ ...machineForm, status: e.target.value })}
                  style={styles.input}
                >
                  <option value="available">Disponible</option>
                  <option value="maintenance">Maintenance</option>
                </select>
              </div>
              <div style={styles.modalActions}>
                <button type="button" onClick={() => setShowMachineModal(false)} style={styles.cancelBtn}>Annuler</button>
                <button type="submit" style={styles.submitBtn} disabled={saving}>
                  {saving ? "Enregistrement..." : editingMachine ? "Modifier" : "Ajouter"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showGameModal && (
        <div style={styles.modalOverlay}>
          <div style={styles.modal}>
            <div style={styles.modalHeader}>
              <h2 style={styles.modalTitle}>{editingGame ? "Modifier le jeu" : "Ajouter un jeu"}</h2>
              <button onClick={() => setShowGameModal(false)} style={styles.modalCloseBtn}>✕</button>
            </div>
            <form onSubmit={submitGame} style={styles.form}>
              <div style={styles.formGroup}>
                <label style={styles.label}>Nom du jeu</label>
                <input
                  type="text"
                  value={gameForm.name}
                  onChange={(e) => setGameForm({ ...gameForm, name: e.target.value })}
                  style={styles.input}
                  required
                />
              </div>
              <div style={styles.priceFormGrid}>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Prix 6 min (DH)</label>
                  <input type="number" min="0" step="0.5" value={gameForm.price_6min}
                    onChange={(e) => setGameForm({ ...gameForm, price_6min: e.target.value })}
                    style={styles.input} required />
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Prix 30 min (DH)</label>
                  <input type="number" min="0" step="0.5" value={gameForm.price_30min}
                    onChange={(e) => setGameForm({ ...gameForm, price_30min: e.target.value })}
                    style={styles.input} required />
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Prix 1h (DH)</label>
                  <input type="number" min="0" step="0.5" value={gameForm.price_1h}
                    onChange={(e) => setGameForm({ ...gameForm, price_1h: e.target.value })}
                    style={styles.input} required />
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Prix 2h (DH)</label>
                  <input type="number" min="0" step="0.5" value={gameForm.price_2h}
                    onChange={(e) => setGameForm({ ...gameForm, price_2h: e.target.value })}
                    style={styles.input} required />
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Prix 3h (DH)</label>
                  <input type="number" min="0" step="0.5" value={gameForm.price_3h}
                    onChange={(e) => setGameForm({ ...gameForm, price_3h: e.target.value })}
                    style={styles.input} required />
                </div>
              </div>
              <div style={styles.modalActions}>
                <button type="button" onClick={() => setShowGameModal(false)} style={styles.cancelBtn}>Annuler</button>
                <button type="submit" style={styles.submitBtn} disabled={saving}>
                  {saving ? "Enregistrement..." : editingGame ? "Modifier" : "Ajouter"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {matchModalGame && (
        <div style={styles.modalOverlay}>
          <div style={styles.modal}>
            <div style={styles.modalHeader}>
              <h2 style={styles.modalTitle}>Tarifs par match — {matchModalGame.name}</h2>
              <button onClick={closeMatchPricings} style={styles.modalCloseBtn}>✕</button>
            </div>
            <div style={styles.form}>
              {(matchModalGame.match_pricings || []).map((p) => (
                <div key={p.id} style={styles.matchPricingRow}>
                  <div>
                    <b>{p.matches_count} match{p.matches_count > 1 ? "s" : ""}</b> — {p.price} DH
                    {p.description && <div style={styles.matchPricingDesc}>{p.description}</div>}
                  </div>
                  <div style={{ display: "flex", gap: "6px" }}>
                    <button onClick={() => openEditMatchPricing(p)} style={styles.editBtnSmall}>✏️</button>
                    <button onClick={() => deleteMatchPricing(p)} style={styles.deleteBtnSmall}>🗑️</button>
                  </div>
                </div>
              ))}
              {(!matchModalGame.match_pricings || matchModalGame.match_pricings.length === 0) && (
                <p style={{ color: "#6b6155", fontSize: "14px" }}>Aucun tarif par match pour ce jeu.</p>
              )}

              <form onSubmit={submitMatchPricing} style={{ marginTop: "20px", borderTop: "1px solid #e8e2d8", paddingTop: "20px" }}>
                <h3 style={{ fontSize: "15px", marginBottom: "14px" }}>
                  {editingMatchPricing ? "Modifier le tarif" : "Ajouter un tarif par match"}
                </h3>
                <div style={styles.priceFormGrid}>
                  <div style={styles.formGroup}>
                    <label style={styles.label}>Nombre de matchs</label>
                    <input type="number" min="1" value={matchForm.matches_count}
                      onChange={(e) => setMatchForm({ ...matchForm, matches_count: e.target.value })}
                      style={styles.input} required />
                  </div>
                  <div style={styles.formGroup}>
                    <label style={styles.label}>Prix (DH)</label>
                    <input type="number" min="0" step="0.5" value={matchForm.price}
                      onChange={(e) => setMatchForm({ ...matchForm, price: e.target.value })}
                      style={styles.input} required />
                  </div>
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Description (optionnel)</label>
                  <input type="text" value={matchForm.description}
                    onChange={(e) => setMatchForm({ ...matchForm, description: e.target.value })}
                    style={styles.input} placeholder="Ex: Tournoi rapide" />
                </div>
                <div style={styles.modalActions}>
                  {editingMatchPricing && (
                    <button type="button" onClick={openAddMatchPricing} style={styles.cancelBtn}>Annuler modification</button>
                  )}
                  <button type="submit" style={styles.submitBtn} disabled={saving}>
                    {saving ? "Enregistrement..." : editingMatchPricing ? "Modifier le tarif" : "Ajouter le tarif"}
                  </button>
                </div>
              </form>
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
  header: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "20px" },
  backBtn: { background: "rgba(0, 0, 0, 0.04)", border: "1px solid #e8e2d8", color: "#6b6155", padding: "10px 20px", borderRadius: "8px", cursor: "pointer", fontSize: "14px", marginBottom: "16px" },
  title: { margin: 0, fontSize: "32px", fontWeight: "700", color: "#1a1410" },
  addBtn: { background: "linear-gradient(135deg, #e0b85c 0%, #c9a24b 100%)", border: "none", color: "#1a1408", padding: "12px 24px", borderRadius: "12px", cursor: "pointer", fontSize: "15px", fontWeight: "700", boxShadow: "0 4px 12px rgba(201, 162, 75, 0.35)" },
  tabs: { display: "flex", gap: "8px", marginBottom: "24px", borderBottom: "1px solid #e8e2d8" },
  tabBtn: { background: "none", border: "none", padding: "12px 20px", fontSize: "15px", fontWeight: "600", color: "#6b6155", cursor: "pointer", borderBottom: "2px solid transparent" },
  tabBtnActive: { color: "#a5822f", borderBottomColor: "#c9a24b" },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: "20px" },
  card: { background: "#ffffff", borderRadius: "16px", border: "1px solid #e8e2d8", padding: "24px" },
  cardName: { fontSize: "17px", fontWeight: "700", color: "#1a1410", marginBottom: "12px" },
  statusBadge: { display: "inline-block", padding: "4px 12px", borderRadius: "20px", fontSize: "12px", fontWeight: "700", marginBottom: "16px" },
  pricesGrid: { display: "flex", flexDirection: "column", gap: "6px", marginBottom: "16px" },
  priceRow: { display: "flex", justifyContent: "space-between", fontSize: "13px", color: "#6b6155" },
  cardActions: { display: "flex", gap: "8px" },
  editBtn: { flex: 1, padding: "8px 16px", background: "rgba(59, 130, 246, 0.1)", border: "1px solid rgba(59, 130, 246, 0.3)", borderRadius: "8px", color: "#2563eb", cursor: "pointer", fontSize: "13px", fontWeight: "600" },
  deleteBtn: { padding: "8px 12px", background: "rgba(239, 68, 68, 0.1)", border: "1px solid rgba(239, 68, 68, 0.3)", borderRadius: "8px", color: "#dc2626", cursor: "pointer", fontSize: "13px", fontWeight: "600" },
  matchBtn: { width: "100%", marginTop: "8px", padding: "8px 16px", background: "rgba(201, 162, 75, 0.1)", border: "1px solid rgba(201, 162, 75, 0.3)", borderRadius: "8px", color: "#a5822f", cursor: "pointer", fontSize: "13px", fontWeight: "600" },
  matchPricingsSummary: { fontSize: "12px", color: "#a5822f", fontWeight: "600", marginBottom: "10px" },
  matchPricingRow: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 14px", background: "#f7f5f2", borderRadius: "10px", marginBottom: "10px", fontSize: "14px", color: "#1a1410" },
  matchPricingDesc: { fontSize: "12px", color: "#6b6155", marginTop: "2px" },
  editBtnSmall: { padding: "6px 10px", background: "rgba(59, 130, 246, 0.1)", border: "1px solid rgba(59, 130, 246, 0.3)", borderRadius: "8px", cursor: "pointer", fontSize: "13px" },
  deleteBtnSmall: { padding: "6px 10px", background: "rgba(239, 68, 68, 0.1)", border: "1px solid rgba(239, 68, 68, 0.3)", borderRadius: "8px", cursor: "pointer", fontSize: "13px" },
  emptyState: { gridColumn: "1 / -1", textAlign: "center", padding: "60px 20px", color: "#6b6155" },
  emptyIcon: { fontSize: "48px", marginBottom: "16px" },
  modalOverlay: { position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0, 0, 0, 0.8)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 10000, padding: "20px" },
  modal: { backgroundColor: "#ffffff", borderRadius: "20px", width: "90%", maxWidth: "540px", maxHeight: "90vh", overflowY: "auto", boxShadow: "0 20px 60px rgba(0, 0, 0, 0.25)" },
  modalHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "24px", borderBottom: "1px solid #e8e2d8" },
  modalTitle: { margin: 0, fontSize: "22px", fontWeight: "700", color: "#1a1410" },
  modalCloseBtn: { background: "rgba(0, 0, 0, 0.06)", border: "none", color: "#1a1410", width: "36px", height: "36px", borderRadius: "50%", cursor: "pointer", fontSize: "20px" },
  form: { padding: "24px" },
  formGroup: { display: "flex", flexDirection: "column", marginBottom: "20px" },
  priceFormGrid: { display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "0 16px" },
  label: { fontSize: "14px", fontWeight: "600", color: "#1a1410", marginBottom: "8px" },
  input: { padding: "12px", background: "#f7f5f2", border: "1px solid #e8e2d8", borderRadius: "10px", color: "#1a1410", fontSize: "14px" },
  modalActions: { display: "flex", gap: "12px", marginTop: "24px" },
  cancelBtn: { flex: 1, padding: "14px", background: "rgba(0, 0, 0, 0.04)", border: "1px solid #e8e2d8", borderRadius: "10px", color: "#6b6155", fontSize: "15px", fontWeight: "600", cursor: "pointer" },
  submitBtn: { flex: 2, padding: "14px", background: "linear-gradient(135deg, #e0b85c 0%, #c9a24b 100%)", border: "none", borderRadius: "10px", color: "#1a1408", fontSize: "15px", fontWeight: "700", cursor: "pointer", boxShadow: "0 4px 12px rgba(201, 162, 75, 0.35)" },
};

export default MachinesGamesManagement;
