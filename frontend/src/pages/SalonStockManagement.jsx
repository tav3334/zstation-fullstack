import { useCallback, useEffect, useState } from "react";
import api from "../services/api";
import Toast from "../components/Toast";
import useConfirm from "../hooks/useConfirm";

function SalonStockManagement({ onBack }) {
  const [products, setProducts] = useState([]);
  const [lowStockProducts, setLowStockProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [toast, setToast] = useState(null);
  const { confirm, ConfirmModal } = useConfirm();

  const emptyForm = {
    name: "",
    image: "",
    category: "",
    source: "salon",
    unit: "flacon",
    size: "",
    quantity: "",
    alert_threshold: "3",
    is_sellable: false,
    sale_price: "",
  };
  const [formData, setFormData] = useState(emptyForm);

  const showToast = useCallback((message, type = "info", duration = 3000) => {
    setToast({ message, type, duration });
  }, []);

  const loadProducts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/stock-products/all");
      setProducts(res.data);
    } catch (e) {
      showToast("Erreur chargement stock: " + (e.response?.data?.message || e.message), "error");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  const loadLowStock = useCallback(async () => {
    try {
      const res = await api.get("/stock-products/low-stock");
      setLowStockProducts(res.data.products);
    } catch {
      setLowStockProducts([]);
    }
  }, []);

  useEffect(() => {
    loadProducts();
    loadLowStock();
  }, [loadProducts, loadLowStock]);

  const openAddModal = () => {
    setEditingProduct(null);
    setFormData(emptyForm);
    setShowModal(true);
  };

  const openEditModal = (product) => {
    setEditingProduct(product);
    setFormData({
      name: product.name,
      image: product.image || "",
      category: product.category || "",
      source: product.source || "salon",
      unit: product.unit,
      size: product.size || "",
      quantity: product.quantity,
      alert_threshold: product.alert_threshold,
      is_sellable: product.is_sellable,
      sale_price: product.sale_price || "",
    });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingProduct) {
        await api.put(`/stock-products/${editingProduct.id}`, formData);
        showToast("Produit modifié avec succès", "success");
      } else {
        await api.post("/stock-products", formData);
        showToast("Produit créé avec succès", "success");
      }
      setShowModal(false);
      loadProducts();
      loadLowStock();
    } catch (e) {
      showToast("Erreur: " + (e.response?.data?.message || e.message), "error");
    }
  };

  const handleDelete = async (id) => {
    if (!(await confirm("Êtes-vous sûr de vouloir supprimer ce produit ?"))) return;
    try {
      const res = await api.delete(`/stock-products/${id}`);
      showToast(res.data.message, "success");
      loadProducts();
      loadLowStock();
    } catch (e) {
      showToast("Erreur: " + (e.response?.data?.message || e.message), "error");
    }
  };

  const handleQuantityUpdate = async (id, newQuantity) => {
    try {
      await api.put(`/stock-products/${id}/quantity`, { quantity: Math.max(0, newQuantity) });
      loadProducts();
      loadLowStock();
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
          <h1 style={styles.title}>Stock Produits</h1>
        </div>
        <button onClick={openAddModal} style={styles.addBtn}>+ Ajouter un produit</button>
      </div>

      {lowStockProducts.length > 0 && (
        <div style={styles.alertBox}>
          <div style={styles.alertIcon}>⚠️</div>
          <div>
            <div style={styles.alertTitle}>Stock Faible!</div>
            <div style={styles.alertText}>{lowStockProducts.length} produit(s) sous le seuil d'alerte</div>
          </div>
        </div>
      )}

      <div style={styles.tableCard}>
        <div style={{ overflowX: "auto" }}>
          <table style={styles.table}>
            <thead>
              <tr style={styles.tableHeaderRow}>
                <th style={styles.tableHeader}>Produit</th>
                <th style={styles.tableHeader}>Source</th>
                <th style={styles.tableHeader}>Catégorie</th>
                <th style={styles.tableHeader}>Contenance</th>
                <th style={styles.tableHeader}>Quantité en stock</th>
                <th style={styles.tableHeader}>Vente boutique</th>
                <th style={styles.tableHeader}>Prix vente</th>
                <th style={styles.tableHeader}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {products.map((product) => (
                <tr key={product.id} style={styles.tableRow}>
                  <td style={styles.tableCell}>
                    {product.image && <span style={{ marginRight: "6px" }}>{product.image}</span>}
                    {product.name}
                  </td>
                  <td style={styles.tableCell}>
                    <span style={{
                      ...styles.sourceBadge,
                      background: product.source === "gaming" ? "rgba(59,130,246,0.1)" : "rgba(201,162,75,0.14)",
                      color: product.source === "gaming" ? "#2563eb" : "#a5822f",
                    }}>
                      {product.source === "gaming" ? "🎮 Gaming" : "✂️ Salon"}
                    </span>
                  </td>
                  <td style={styles.tableCell}>{product.category || "-"}</td>
                  <td style={styles.tableCell}>{product.size || "-"}</td>
                  <td style={styles.tableCell}>
                    <div style={styles.stockControl}>
                      <button onClick={() => handleQuantityUpdate(product.id, parseFloat(product.quantity) - 1)} style={styles.stockBtn}>-</button>
                      <span style={{
                        ...styles.stockValue,
                        color: parseFloat(product.quantity) <= parseFloat(product.alert_threshold) ? "#dc2626" : "#059669",
                      }}>
                        {product.quantity} {product.unit}{parseFloat(product.quantity) !== 1 ? "s" : ""}
                      </span>
                      <button onClick={() => handleQuantityUpdate(product.id, parseFloat(product.quantity) + 1)} style={styles.stockBtn}>+</button>
                    </div>
                  </td>
                  <td style={styles.tableCell}>{product.is_sellable ? "✓ Oui" : "Non"}</td>
                  <td style={styles.tableCell}>{product.sale_price ? `${parseFloat(product.sale_price).toFixed(2)} DH` : "-"}</td>
                  <td style={styles.tableCell}>
                    <div style={styles.actions}>
                      <button onClick={() => openEditModal(product)} style={styles.editBtn}>✏️ Modifier</button>
                      <button onClick={() => handleDelete(product.id)} style={styles.deleteBtn}>🗑️</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {products.length === 0 && (
          <div style={styles.emptyState}>
            <div style={styles.emptyIcon}>📦</div>
            <div>Aucun produit enregistré</div>
          </div>
        )}
      </div>

      {showModal && (
        <div style={styles.modalOverlay}>
          <div style={styles.modal}>
            <div style={styles.modalHeader}>
              <h2 style={styles.modalTitle}>{editingProduct ? "Modifier le produit" : "Ajouter un produit"}</h2>
              <button onClick={() => setShowModal(false)} style={styles.modalCloseBtn}>✕</button>
            </div>
            <form onSubmit={handleSubmit} style={styles.form}>
              <div style={styles.formRow}>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Nom du produit</label>
                  <input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} style={styles.input} required />
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Icône (emoji, optionnel)</label>
                  <input type="text" value={formData.image} onChange={(e) => setFormData({ ...formData, image: e.target.value })} style={styles.input} placeholder="🍿, ☕, 🥤..." maxLength={4} />
                </div>
              </div>

              <div style={styles.formRow}>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Catégorie</label>
                  <input type="text" value={formData.category} onChange={(e) => setFormData({ ...formData, category: e.target.value })} style={styles.input} placeholder="shampoing, snack, boisson..." />
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Source</label>
                  <select value={formData.source} onChange={(e) => setFormData({ ...formData, source: e.target.value })} style={styles.input}>
                    <option value="salon">✂️ Salon</option>
                    <option value="gaming">🎮 Gaming</option>
                  </select>
                </div>
              </div>

              <div style={styles.formRow}>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Contenance (par unité)</label>
                  <input type="text" value={formData.size} onChange={(e) => setFormData({ ...formData, size: e.target.value })} style={styles.input} placeholder="500ml, 1L, 250g..." />
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Type d'unité</label>
                  <select value={formData.unit} onChange={(e) => setFormData({ ...formData, unit: e.target.value })} style={styles.input}>
                    <option value="flacon">Flacon</option>
                    <option value="tube">Tube</option>
                    <option value="boîte">Boîte</option>
                    <option value="unité">Unité</option>
                    <option value="pack">Pack</option>
                  </select>
                </div>
              </div>

              <div style={styles.formRow}>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Quantité en stock</label>
                  <input type="number" step="1" value={formData.quantity} onChange={(e) => setFormData({ ...formData, quantity: e.target.value })} style={styles.input} required />
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Seuil d'alerte</label>
                  <input type="number" step="1" value={formData.alert_threshold} onChange={(e) => setFormData({ ...formData, alert_threshold: e.target.value })} style={styles.input} />
                </div>
              </div>

              <div style={styles.formGroup}>
                <label style={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    checked={formData.is_sellable}
                    onChange={(e) => setFormData({ ...formData, is_sellable: e.target.checked })}
                  />
                  Vendu en boutique
                </label>
              </div>

              {formData.is_sellable && (
                <div style={styles.formGroup}>
                  <label style={styles.label}>Prix de vente (DH)</label>
                  <input type="number" step="0.01" value={formData.sale_price} onChange={(e) => setFormData({ ...formData, sale_price: e.target.value })} style={styles.input} required={formData.is_sellable} />
                </div>
              )}

              <div style={styles.modalActions}>
                <button type="button" onClick={() => setShowModal(false)} style={styles.cancelBtn}>Annuler</button>
                <button type="submit" style={styles.submitBtn}>{editingProduct ? "Modifier" : "Ajouter"}</button>
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
  alertBox: { background: "linear-gradient(135deg, rgba(251, 146, 60, 0.12) 0%, rgba(249, 115, 22, 0.12) 100%)", border: "1px solid rgba(251, 146, 60, 0.35)", borderRadius: "12px", padding: "20px", display: "flex", gap: "16px", marginBottom: "24px" },
  alertIcon: { fontSize: "32px" },
  alertTitle: { fontSize: "18px", fontWeight: "700", color: "#c2650a", marginBottom: "4px" },
  alertText: { fontSize: "14px", color: "#1a1410" },
  tableCard: { background: "#ffffff", borderRadius: "16px", border: "1px solid #e8e2d8", overflow: "hidden" },
  table: { width: "100%", borderCollapse: "collapse" },
  tableHeaderRow: { background: "#f3f0ea" },
  tableHeader: { padding: "16px", textAlign: "left", color: "#6b6155", fontSize: "13px", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.5px" },
  tableRow: { borderBottom: "1px solid #e8e2d8" },
  tableCell: { padding: "16px", color: "#1a1410", fontSize: "14px" },
  sourceBadge: { display: "inline-flex", alignItems: "center", padding: "4px 10px", borderRadius: "12px", fontSize: "12px", fontWeight: "600" },
  stockControl: { display: "flex", alignItems: "center", gap: "8px" },
  stockBtn: { width: "28px", height: "28px", background: "rgba(0, 0, 0, 0.06)", border: "1px solid #d9d2c4", borderRadius: "6px", color: "#1a1410", cursor: "pointer", fontSize: "16px", fontWeight: "600" },
  stockValue: { fontSize: "14px", fontWeight: "700", minWidth: "70px", textAlign: "center" },
  actions: { display: "flex", gap: "8px" },
  editBtn: { padding: "8px 16px", background: "rgba(59, 130, 246, 0.1)", border: "1px solid rgba(59, 130, 246, 0.3)", borderRadius: "8px", color: "#2563eb", cursor: "pointer", fontSize: "13px", fontWeight: "600" },
  deleteBtn: { padding: "8px 12px", background: "rgba(239, 68, 68, 0.1)", border: "1px solid rgba(239, 68, 68, 0.3)", borderRadius: "8px", color: "#dc2626", cursor: "pointer", fontSize: "13px", fontWeight: "600" },
  emptyState: { textAlign: "center", padding: "60px 20px", color: "#6b6155" },
  emptyIcon: { fontSize: "48px", marginBottom: "16px" },
  modalOverlay: { position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0, 0, 0, 0.8)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 10000, padding: "20px" },
  modal: { backgroundColor: "#ffffff", borderRadius: "20px", width: "90%", maxWidth: "600px", maxHeight: "90vh", overflow: "auto", boxShadow: "0 20px 60px rgba(0, 0, 0, 0.25)" },
  modalHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "24px", borderBottom: "1px solid #e8e2d8" },
  modalTitle: { margin: 0, fontSize: "24px", fontWeight: "700", color: "#1a1410" },
  modalCloseBtn: { background: "rgba(0, 0, 0, 0.06)", border: "none", color: "#1a1410", width: "36px", height: "36px", borderRadius: "50%", cursor: "pointer", fontSize: "20px" },
  form: { padding: "24px" },
  formRow: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "20px" },
  formGroup: { display: "flex", flexDirection: "column" },
  label: { fontSize: "14px", fontWeight: "600", color: "#1a1410", marginBottom: "8px" },
  checkboxLabel: { display: "flex", alignItems: "center", gap: "8px", fontSize: "14px", fontWeight: "600", color: "#1a1410", marginTop: "24px" },
  input: { padding: "12px", background: "#f7f5f2", border: "1px solid #e8e2d8", borderRadius: "10px", color: "#1a1410", fontSize: "14px" },
  modalActions: { display: "flex", gap: "12px", marginTop: "24px" },
  cancelBtn: { flex: 1, padding: "14px", background: "rgba(0, 0, 0, 0.04)", border: "1px solid #e8e2d8", borderRadius: "10px", color: "#6b6155", fontSize: "15px", fontWeight: "600", cursor: "pointer" },
  submitBtn: { flex: 2, padding: "14px", background: "linear-gradient(135deg, #e0b85c 0%, #c9a24b 100%)", border: "none", borderRadius: "10px", color: "#1a1408", fontSize: "15px", fontWeight: "700", cursor: "pointer", boxShadow: "0 4px 12px rgba(201, 162, 75, 0.35)" },
};

export default SalonStockManagement;
