import { useCallback, useEffect, useState } from "react";
import api from "../services/api";
import Toast from "../components/Toast";
import useConfirm from "../hooks/useConfirm";

function CustomersManagement({ onBack }) {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [debtOnly, setDebtOnly] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [showDetail, setShowDetail] = useState(false);
  const [detailCustomer, setDetailCustomer] = useState(null);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [processing, setProcessing] = useState(false);
  const [toast, setToast] = useState(null);
  const { confirm, ConfirmModal } = useConfirm();

  const emptyForm = { name: "", phone: "", email: "", credit_limit: "0", notes: "" };
  const [formData, setFormData] = useState(emptyForm);

  const showToast = useCallback((message, type = "info", duration = 3000) => {
    setToast({ message, type, duration });
  }, []);

  const loadCustomers = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (search.trim()) params.search = search.trim();
      if (debtOnly) params.with_debt_only = 1;
      const res = await api.get("/customers", { params });
      setCustomers(res.data.customers || []);
    } catch (e) {
      showToast("Erreur chargement clients: " + (e.response?.data?.message || e.message), "error");
    } finally {
      setLoading(false);
    }
  }, [search, debtOnly, showToast]);

  useEffect(() => {
    const timeout = setTimeout(loadCustomers, 300);
    return () => clearTimeout(timeout);
  }, [loadCustomers]);

  const openAddModal = () => {
    setEditingCustomer(null);
    setFormData(emptyForm);
    setShowModal(true);
  };

  const openEditModal = (customer) => {
    setEditingCustomer(customer);
    setFormData({
      name: customer.name,
      phone: customer.phone || "",
      email: customer.email || "",
      credit_limit: String(customer.credit_limit ?? 0),
      notes: customer.notes || "",
    });
    setShowModal(true);
  };

  const openDetail = async (customer) => {
    try {
      const res = await api.get(`/customers/${customer.id}`);
      setDetailCustomer(res.data.customer);
      setPaymentAmount("");
      setShowDetail(true);
    } catch (e) {
      showToast("Erreur chargement fiche client: " + (e.response?.data?.message || e.message), "error");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = { ...formData, credit_limit: parseFloat(formData.credit_limit) || 0 };
      if (editingCustomer) {
        await api.put(`/customers/${editingCustomer.id}`, payload);
        showToast("Client modifié avec succès", "success");
      } else {
        await api.post("/customers", payload);
        showToast("Client créé avec succès", "success");
      }
      setShowModal(false);
      loadCustomers();
    } catch (e) {
      showToast("Erreur: " + (e.response?.data?.message || e.message), "error");
    }
  };

  const handleDelete = async (customer) => {
    const ok = await confirm(`Supprimer le client "${customer.name}" ?`, {
      confirmLabel: "Supprimer",
      cancelLabel: "Annuler",
    });
    if (!ok) return;
    try {
      await api.delete(`/customers/${customer.id}`);
      showToast("Client supprimé", "success");
      loadCustomers();
    } catch (e) {
      showToast(e.response?.data?.message || "Erreur lors de la suppression", "error");
    }
  };

  const handleRecordPayment = async () => {
    if (!paymentAmount || parseFloat(paymentAmount) <= 0) return;
    setProcessing(true);
    try {
      const res = await api.post(`/customers/${detailCustomer.id}/payment`, {
        amount: parseFloat(paymentAmount),
      });
      showToast("Paiement enregistré", "success");
      setPaymentAmount("");
      const refreshed = await api.get(`/customers/${detailCustomer.id}`);
      setDetailCustomer(refreshed.data.customer);
      loadCustomers();
    } catch (e) {
      showToast(e.response?.data?.message || "Erreur lors de l'enregistrement", "error");
    } finally {
      setProcessing(false);
    }
  };

  if (loading && customers.length === 0) {
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
          <h1 style={styles.title}>Clients</h1>
        </div>
        <button onClick={openAddModal} style={styles.addBtn}>+ Ajouter un client</button>
      </div>

      <div style={styles.filtersRow}>
        <input
          type="text"
          placeholder="Rechercher (nom, téléphone, email)..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={styles.searchInput}
        />
        <label style={styles.checkboxLabel}>
          <input type="checkbox" checked={debtOnly} onChange={(e) => setDebtOnly(e.target.checked)} />
          Avec ardoise seulement
        </label>
      </div>

      <div style={styles.tableCard}>
        <div style={{ overflowX: "auto" }}>
          <table style={styles.table}>
            <thead>
              <tr style={styles.tableHeaderRow}>
                <th style={styles.tableHeader}>Nom</th>
                <th style={styles.tableHeader}>Téléphone</th>
                <th style={styles.tableHeader}>Email</th>
                <th style={styles.tableHeader}>Solde ardoise</th>
                <th style={styles.tableHeader}>Plafond</th>
                <th style={styles.tableHeader}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {customers.length === 0 ? (
                <tr>
                  <td colSpan={6} style={styles.emptyCell}>Aucun client trouvé</td>
                </tr>
              ) : customers.map((customer) => (
                <tr key={customer.id} style={styles.tableRow}>
                  <td style={styles.tableCell}>
                    <button onClick={() => openDetail(customer)} style={styles.customerLink}>
                      {customer.name}
                    </button>
                  </td>
                  <td style={styles.tableCell}>{customer.phone || "-"}</td>
                  <td style={styles.tableCell}>{customer.email || "-"}</td>
                  <td style={styles.tableCell}>
                    <span style={{
                      ...styles.balanceBadge,
                      color: parseFloat(customer.credit_balance) > 0 ? "#dc2626" : "#10b981",
                      background: parseFloat(customer.credit_balance) > 0 ? "#fee2e2" : "#dcfce7",
                    }}>
                      {parseFloat(customer.credit_balance).toFixed(2)} DH
                    </span>
                  </td>
                  <td style={styles.tableCell}>{parseFloat(customer.credit_limit).toFixed(2)} DH</td>
                  <td style={styles.tableCell}>
                    <button onClick={() => openEditModal(customer)} style={styles.editBtn}>Modifier</button>
                    <button onClick={() => handleDelete(customer)} style={styles.deleteBtn}>Supprimer</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div style={styles.modalOverlay}>
          <div style={styles.modal}>
            <div style={styles.modalHeader}>
              <h3 style={styles.modalTitle}>{editingCustomer ? "Modifier le client" : "Nouveau client"}</h3>
              <button onClick={() => setShowModal(false)} style={styles.closeBtn}>✕</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div style={styles.modalBody}>
                <label style={styles.inputLabel}>Nom *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  style={styles.input}
                  required
                  autoFocus
                />
                <label style={styles.inputLabel}>Téléphone</label>
                <input
                  type="text"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  style={styles.input}
                />
                <label style={styles.inputLabel}>Email</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  style={styles.input}
                />
                <label style={styles.inputLabel}>Plafond de crédit autorisé (DH)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.credit_limit}
                  onChange={(e) => setFormData({ ...formData, credit_limit: e.target.value })}
                  style={styles.input}
                />
                <p style={styles.hint}>0 = le client ne peut pas acheter à crédit (ardoise désactivée).</p>
                <label style={styles.inputLabel}>Note</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  style={{ ...styles.input, minHeight: "70px", resize: "vertical" }}
                />
              </div>
              <div style={styles.modalFooter}>
                <button type="button" onClick={() => setShowModal(false)} style={styles.cancelBtn}>Annuler</button>
                <button type="submit" style={styles.confirmBtn}>{editingCustomer ? "Enregistrer" : "Créer"}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Customer Detail Modal */}
      {showDetail && detailCustomer && (
        <div style={styles.modalOverlay}>
          <div style={{ ...styles.modal, maxWidth: "560px" }}>
            <div style={styles.modalHeader}>
              <h3 style={styles.modalTitle}>{detailCustomer.name}</h3>
              <button onClick={() => setShowDetail(false)} style={styles.closeBtn}>✕</button>
            </div>
            <div style={{ ...styles.modalBody, maxHeight: "60vh", overflowY: "auto" }}>
              <div style={styles.detailInfoRow}>
                <span>Téléphone:</span>
                <span>{detailCustomer.phone || "-"}</span>
              </div>
              <div style={styles.detailInfoRow}>
                <span>Email:</span>
                <span>{detailCustomer.email || "-"}</span>
              </div>

              <div style={styles.creditBox}>
                <div>
                  <div style={styles.creditLabel}>Solde ardoise</div>
                  <div style={{
                    ...styles.creditValue,
                    color: parseFloat(detailCustomer.credit_balance) > 0 ? "#dc2626" : "#10b981",
                  }}>
                    {parseFloat(detailCustomer.credit_balance).toFixed(2)} DH
                  </div>
                </div>
                <div>
                  <div style={styles.creditLabel}>Plafond</div>
                  <div style={styles.creditValue}>{parseFloat(detailCustomer.credit_limit).toFixed(2)} DH</div>
                </div>
              </div>

              {parseFloat(detailCustomer.credit_balance) > 0 && (
                <div style={styles.paymentRow}>
                  <input
                    type="number"
                    min="0.01"
                    max={detailCustomer.credit_balance}
                    step="0.01"
                    placeholder="Montant reçu (DH)"
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    style={{ ...styles.input, marginBottom: 0, flex: 1 }}
                  />
                  <button
                    onClick={handleRecordPayment}
                    disabled={processing || !paymentAmount}
                    style={styles.paymentBtn}
                  >
                    {processing ? "..." : "Encaisser"}
                  </button>
                </div>
              )}

              <div style={styles.sectionTitle}>Historique des achats</div>
              {(!detailCustomer.sales || detailCustomer.sales.length === 0) ? (
                <p style={styles.emptyHint}>Aucun achat enregistré</p>
              ) : (
                <div style={styles.historyList}>
                  {detailCustomer.sales.map((sale) => (
                    <div key={sale.id} style={styles.historyRow}>
                      <span>{sale.ticket_number} — {new Date(sale.sale_date).toLocaleDateString("fr-FR")}</span>
                      <span style={{ fontWeight: 600 }}>
                        {parseFloat(sale.total).toFixed(2)} DH {sale.paid_on_credit && <em style={styles.creditTag}>ardoise</em>}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              <div style={styles.sectionTitle}>Mouvements de crédit</div>
              {(!detailCustomer.credit_movements || detailCustomer.credit_movements.length === 0) ? (
                <p style={styles.emptyHint}>Aucun mouvement</p>
              ) : (
                <div style={styles.historyList}>
                  {detailCustomer.credit_movements.map((m) => (
                    <div key={m.id} style={styles.historyRow}>
                      <span>{new Date(m.created_at).toLocaleDateString("fr-FR")} — {m.type === "charge" ? "Achat à crédit" : m.type === "payment" ? "Paiement reçu" : "Ajustement"}</span>
                      <span style={{ fontWeight: 600, color: m.type === "payment" ? "#10b981" : "#dc2626" }}>
                        {m.type === "payment" ? "-" : "+"}{parseFloat(m.amount).toFixed(2)} DH
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div style={styles.modalFooter}>
              <button onClick={() => setShowDetail(false)} style={styles.cancelBtn}>Fermer</button>
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
  header: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "24px" },
  backBtn: { background: "rgba(0, 0, 0, 0.04)", border: "1px solid #e8e2d8", color: "#6b6155", padding: "10px 20px", borderRadius: "8px", cursor: "pointer", fontSize: "14px", marginBottom: "16px" },
  title: { margin: 0, fontSize: "32px", fontWeight: "700", color: "#1a1410" },
  addBtn: { background: "linear-gradient(135deg, #e0b85c 0%, #c9a24b 100%)", border: "none", color: "#1a1408", padding: "12px 24px", borderRadius: "12px", cursor: "pointer", fontSize: "15px", fontWeight: "700", boxShadow: "0 4px 12px rgba(201, 162, 75, 0.35)" },
  filtersRow: { display: "flex", gap: "16px", alignItems: "center", marginBottom: "20px", flexWrap: "wrap" },
  searchInput: { flex: 1, minWidth: "260px", padding: "10px 14px", borderRadius: "10px", border: "1px solid #e8e2d8", fontSize: "14px", background: "#ffffff" },
  checkboxLabel: { display: "flex", alignItems: "center", gap: "8px", fontSize: "14px", color: "#3f3a30", cursor: "pointer" },
  tableCard: { background: "#ffffff", borderRadius: "16px", border: "1px solid #e8e2d8", overflow: "hidden" },
  table: { width: "100%", borderCollapse: "collapse" },
  tableHeaderRow: { background: "#f7f5f2" },
  tableHeader: { textAlign: "left", padding: "14px 16px", fontSize: "12px", fontWeight: "700", color: "#6b6155", textTransform: "uppercase", letterSpacing: "0.4px" },
  tableRow: { borderTop: "1px solid #f0ece3" },
  tableCell: { padding: "14px 16px", fontSize: "14px", color: "#1a1410" },
  emptyCell: { padding: "40px", textAlign: "center", color: "#9a9184", fontSize: "14px" },
  customerLink: { background: "none", border: "none", color: "#c9a24b", fontWeight: "700", fontSize: "14px", cursor: "pointer", padding: 0, textDecoration: "underline" },
  balanceBadge: { padding: "4px 10px", borderRadius: "8px", fontWeight: "700", fontSize: "13px" },
  editBtn: { background: "rgba(0,0,0,0.04)", border: "1px solid #e8e2d8", color: "#3f3a30", padding: "6px 12px", borderRadius: "8px", cursor: "pointer", fontSize: "12px", fontWeight: "600", marginRight: "8px" },
  deleteBtn: { background: "rgba(220,38,38,0.08)", border: "1px solid rgba(220,38,38,0.25)", color: "#dc2626", padding: "6px 12px", borderRadius: "8px", cursor: "pointer", fontSize: "12px", fontWeight: "600" },
  modalOverlay: { position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: "20px" },
  modal: { background: "#ffffff", borderRadius: "16px", width: "100%", maxWidth: "440px", border: "1px solid #e8e2d8" },
  modalHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 20px", borderBottom: "1px solid #e8e2d8" },
  modalTitle: { margin: 0, fontSize: "16px", fontWeight: "700", color: "#1a1410" },
  closeBtn: { background: "none", border: "none", color: "#6b6155", cursor: "pointer", fontSize: "18px", padding: "4px" },
  modalBody: { padding: "20px" },
  modalFooter: { display: "flex", gap: "12px", padding: "16px 20px", borderTop: "1px solid #e8e2d8" },
  inputLabel: { display: "block", fontSize: "13px", fontWeight: "600", color: "#6b6155", marginBottom: "8px" },
  input: { width: "100%", padding: "12px", background: "#f7f5f2", border: "1px solid #e8e2d8", borderRadius: "8px", color: "#1a1410", fontSize: "14px", marginBottom: "16px", boxSizing: "border-box" },
  hint: { fontSize: "12px", color: "#9a9184", margin: "-10px 0 16px" },
  cancelBtn: { flex: 1, padding: "12px", background: "#e8e2d8", color: "#3f3a30", border: "none", borderRadius: "8px", cursor: "pointer", fontSize: "14px", fontWeight: "600" },
  confirmBtn: { flex: 1, padding: "12px", background: "linear-gradient(135deg, #e0b85c 0%, #c9a24b 100%)", color: "#1a1408", border: "none", borderRadius: "8px", cursor: "pointer", fontSize: "14px", fontWeight: "700" },
  detailInfoRow: { display: "flex", justifyContent: "space-between", fontSize: "13px", color: "#6b6155", marginBottom: "6px" },
  creditBox: { display: "flex", justifyContent: "space-around", background: "#f7f5f2", borderRadius: "12px", padding: "16px", margin: "16px 0" },
  creditLabel: { fontSize: "12px", color: "#6b6155", marginBottom: "4px", textAlign: "center" },
  creditValue: { fontSize: "20px", fontWeight: "800", color: "#1a1410", textAlign: "center" },
  paymentRow: { display: "flex", gap: "10px", marginBottom: "20px" },
  paymentBtn: { padding: "0 20px", background: "#10b981", color: "#fff", border: "none", borderRadius: "8px", cursor: "pointer", fontSize: "14px", fontWeight: "700" },
  sectionTitle: { fontSize: "13px", fontWeight: "700", color: "#3f3a30", textTransform: "uppercase", letterSpacing: "0.4px", margin: "20px 0 10px", paddingBottom: "6px", borderBottom: "1px solid #e8e2d8" },
  emptyHint: { fontSize: "13px", color: "#9a9184", margin: 0 },
  historyList: { display: "flex", flexDirection: "column", gap: "8px" },
  historyRow: { display: "flex", justifyContent: "space-between", fontSize: "13px", color: "#3f3a30", padding: "8px 10px", background: "#f7f5f2", borderRadius: "8px" },
  creditTag: { fontSize: "10px", color: "#dc2626", fontStyle: "normal", marginLeft: "6px", background: "#fee2e2", padding: "2px 6px", borderRadius: "6px" },
};

export default CustomersManagement;
