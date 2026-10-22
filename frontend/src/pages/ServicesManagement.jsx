import { useCallback, useEffect, useState } from "react";
import api from "../services/api";
import Toast from "../components/Toast";
import useConfirm from "../hooks/useConfirm";

function ServicesManagement({ onBack }) {
  const [services, setServices] = useState([]);
  const [stockProducts, setStockProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingService, setEditingService] = useState(null);
  const [showCategoriesModal, setShowCategoriesModal] = useState(false);
  const [newCategoryLabel, setNewCategoryLabel] = useState("");
  const [toast, setToast] = useState(null);
  const { confirm, ConfirmModal } = useConfirm();

  const emptyForm = {
    name: "",
    category: "",
    price: "",
    duration: "",
    products: [],
  };
  const [formData, setFormData] = useState(emptyForm);

  const showToast = useCallback((message, type = "info", duration = 3000) => {
    setToast({ message, type, duration });
  }, []);

  const loadServices = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/services/all");
      setServices(res.data);
    } catch (e) {
      showToast("Erreur chargement prestations: " + (e.response?.data?.message || e.message), "error");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  const loadStockProducts = useCallback(async () => {
    try {
      const res = await api.get("/stock-products/all");
      setStockProducts(res.data);
    } catch {
      setStockProducts([]);
    }
  }, []);

  const loadCategories = useCallback(async () => {
    try {
      const res = await api.get("/service-categories");
      setCategories(res.data);
    } catch {
      setCategories([]);
    }
  }, []);

  useEffect(() => {
    loadServices();
    loadStockProducts();
    loadCategories();
  }, [loadServices, loadStockProducts, loadCategories]);

  const openAddModal = () => {
    setEditingService(null);
    setFormData({ ...emptyForm, category: categories[0]?.slug || "" });
    setShowModal(true);
  };

  const handleAddCategory = async (e) => {
    e.preventDefault();
    if (!newCategoryLabel.trim()) return;
    try {
      await api.post("/service-categories", { label: newCategoryLabel.trim() });
      showToast("Catégorie créée avec succès", "success");
      setNewCategoryLabel("");
      loadCategories();
    } catch (e) {
      showToast(e.response?.data?.message || "Erreur", "error");
    }
  };

  const handleDeleteCategory = async (cat) => {
    if (!(await confirm(`Supprimer la catégorie "${cat.label}" ?`))) return;
    try {
      await api.delete(`/service-categories/${cat.id}`);
      showToast("Catégorie supprimée avec succès", "success");
      loadCategories();
    } catch (e) {
      showToast(e.response?.data?.message || "Erreur", "error");
    }
  };

  const openEditModal = (service) => {
    setEditingService(service);
    setFormData({
      name: service.name,
      category: service.category,
      price: service.price,
      duration: service.duration || "",
      products: (service.products || []).map((p) => ({
        stock_product_id: p.id,
        quantity_used: p.pivot.quantity_used,
      })),
    });
    setShowModal(true);
  };

  const addProductRow = () => {
    setFormData((prev) => ({
      ...prev,
      products: [...prev.products, { stock_product_id: "", quantity_used: "" }],
    }));
  };

  const updateProductRow = (index, field, value) => {
    setFormData((prev) => {
      const products = [...prev.products];
      products[index] = { ...products[index], [field]: value };
      return { ...prev, products };
    });
  };

  const removeProductRow = (index) => {
    setFormData((prev) => ({
      ...prev,
      products: prev.products.filter((_, i) => i !== index),
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const payload = {
      ...formData,
      products: formData.products
        .filter((p) => p.stock_product_id && p.quantity_used !== "")
        .map((p) => ({
          stock_product_id: parseInt(p.stock_product_id),
          quantity_used: parseFloat(p.quantity_used),
        })),
    };

    try {
      if (editingService) {
        await api.put(`/services/${editingService.id}`, payload);
        showToast("Prestation modifiée avec succès", "success");
      } else {
        await api.post("/services", payload);
        showToast("Prestation créée avec succès", "success");
      }
      setShowModal(false);
      loadServices();
    } catch (e) {
      showToast("Erreur: " + (e.response?.data?.message || e.message), "error");
    }
  };

  const handleDelete = async (id) => {
    if (!(await confirm("Êtes-vous sûr de vouloir supprimer cette prestation ?"))) return;

    try {
      const res = await api.delete(`/services/${id}`);
      showToast(res.data.message, "success");
      loadServices();
    } catch (e) {
      showToast("Erreur: " + (e.response?.data?.message || e.message), "error");
    }
  };

  const toggleActive = async (service) => {
    try {
      await api.put(`/services/${service.id}`, { is_active: !service.is_active });
      showToast(service.is_active ? "Prestation désactivée" : "Prestation activée", "success");
      loadServices();
    } catch (e) {
      showToast("Erreur: " + (e.response?.data?.message || e.message), "error");
    }
  };

  const categoryLabel = (value) => categories.find((c) => c.slug === value)?.label || value;

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
          <h1 style={styles.title}>Gestion des Prestations</h1>
        </div>
        <div style={{ display: "flex", gap: "10px" }}>
          <button onClick={() => setShowCategoriesModal(true)} style={styles.categoriesBtn}>🏷️ Catégories</button>
          <button onClick={openAddModal} style={styles.addBtn}>+ Ajouter une prestation</button>
        </div>
      </div>

      <div style={styles.tableCard}>
        <div style={{ overflowX: "auto" }}>
          <table style={styles.table}>
            <thead>
              <tr style={styles.tableHeaderRow}>
                <th style={styles.tableHeader}>Prestation</th>
                <th style={styles.tableHeader}>Catégorie</th>
                <th style={styles.tableHeader}>Prix</th>
                <th style={styles.tableHeader}>Durée</th>
                <th style={styles.tableHeader}>Produits consommés</th>
                <th style={styles.tableHeader}>Statut</th>
                <th style={styles.tableHeader}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {services.map((service) => (
                <tr key={service.id} style={styles.tableRow}>
                  <td style={styles.tableCell}>{service.name}</td>
                  <td style={styles.tableCell}>
                    <span style={styles.categoryBadge}>{categoryLabel(service.category)}</span>
                  </td>
                  <td style={styles.tableCell}>{parseFloat(service.price).toFixed(2)} DH</td>
                  <td style={styles.tableCell}>{service.duration ? `${service.duration} min` : "-"}</td>
                  <td style={styles.tableCell}>
                    {service.products?.length > 0
                      ? service.products.map((p) => `${p.name} (${p.pivot.quantity_used}${p.unit})`).join(", ")
                      : "-"}
                  </td>
                  <td style={styles.tableCell}>
                    <button
                      onClick={() => toggleActive(service)}
                      style={{
                        ...styles.statusBtn,
                        background: service.is_active ? "#dcfce7" : "#fee2e2",
                        color: service.is_active ? "#166534" : "#991b1b",
                      }}
                    >
                      {service.is_active ? "✓ Actif" : "✕ Inactif"}
                    </button>
                  </td>
                  <td style={styles.tableCell}>
                    <div style={styles.actions}>
                      <button onClick={() => openEditModal(service)} style={styles.editBtn}>✏️ Modifier</button>
                      <button onClick={() => handleDelete(service.id)} style={styles.deleteBtn}>🗑️ Supprimer</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {services.length === 0 && (
          <div style={styles.emptyState}>
            <div style={styles.emptyIcon}>✂️</div>
            <div>Aucune prestation enregistrée</div>
          </div>
        )}
      </div>

      {showModal && (
        <div style={styles.modalOverlay}>
          <div style={styles.modal}>
            <div style={styles.modalHeader}>
              <h2 style={styles.modalTitle}>
                {editingService ? "Modifier la prestation" : "Ajouter une prestation"}
              </h2>
              <button onClick={() => setShowModal(false)} style={styles.modalCloseBtn}>✕</button>
            </div>

            <form onSubmit={handleSubmit} style={styles.form}>
              <div style={styles.formRow}>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Nom de la prestation</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    style={styles.input}
                    required
                  />
                </div>

                <div style={styles.formGroup}>
                  <label style={styles.label}>Catégorie</label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    style={styles.input}
                    required
                  >
                    <option value="" disabled>— Choisir —</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.slug}>{c.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={styles.formRow}>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Prix (DH)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                    style={styles.input}
                    required
                  />
                </div>

                <div style={styles.formGroup}>
                  <label style={styles.label}>Durée (minutes, optionnel)</label>
                  <input
                    type="number"
                    value={formData.duration}
                    onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
                    style={styles.input}
                  />
                </div>
              </div>

              <div style={styles.formGroup}>
                <div style={styles.productsHeader}>
                  <label style={styles.label}>Produits consommés</label>
                  <button type="button" onClick={addProductRow} style={styles.addRowBtn}>+ Ajouter un produit</button>
                </div>
                {formData.products.map((row, index) => (
                  <div key={index} style={styles.productRow}>
                    <select
                      value={row.stock_product_id}
                      onChange={(e) => updateProductRow(index, "stock_product_id", e.target.value)}
                      style={{ ...styles.input, flex: 2 }}
                      required
                    >
                      <option value="">— Produit —</option>
                      {stockProducts.map((p) => (
                        <option key={p.id} value={p.id}>{p.name} ({p.unit})</option>
                      ))}
                    </select>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="Quantité"
                      value={row.quantity_used}
                      onChange={(e) => updateProductRow(index, "quantity_used", e.target.value)}
                      style={{ ...styles.input, flex: 1 }}
                      required
                    />
                    <button type="button" onClick={() => removeProductRow(index)} style={styles.removeRowBtn}>✕</button>
                  </div>
                ))}
              </div>

              <div style={styles.modalActions}>
                <button type="button" onClick={() => setShowModal(false)} style={styles.cancelBtn}>Annuler</button>
                <button type="submit" style={styles.submitBtn}>
                  {editingService ? "Modifier" : "Ajouter"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showCategoriesModal && (
        <div style={styles.modalOverlay}>
          <div style={styles.modal}>
            <div style={styles.modalHeader}>
              <h2 style={styles.modalTitle}>Gérer les catégories</h2>
              <button onClick={() => setShowCategoriesModal(false)} style={styles.modalCloseBtn}>✕</button>
            </div>
            <div style={styles.form}>
              {categories.map((cat) => (
                <div key={cat.id} style={styles.categoryRow}>
                  <span>{cat.label}</span>
                  <button onClick={() => handleDeleteCategory(cat)} style={styles.removeRowBtn}>🗑️</button>
                </div>
              ))}
              {categories.length === 0 && (
                <p style={{ color: "#6b6155", fontSize: "14px" }}>Aucune catégorie pour l'instant.</p>
              )}

              <form onSubmit={handleAddCategory} style={{ display: "flex", gap: "10px", marginTop: "20px" }}>
                <input
                  type="text"
                  value={newCategoryLabel}
                  onChange={(e) => setNewCategoryLabel(e.target.value)}
                  placeholder="Nom de la nouvelle catégorie"
                  style={{ ...styles.input, flex: 1 }}
                />
                <button type="submit" style={styles.addRowBtn}>+ Ajouter</button>
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
  header: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "30px" },
  backBtn: { background: "rgba(0, 0, 0, 0.04)", border: "1px solid #e8e2d8", color: "#6b6155", padding: "10px 20px", borderRadius: "8px", cursor: "pointer", fontSize: "14px", marginBottom: "16px" },
  title: { margin: 0, fontSize: "32px", fontWeight: "700", color: "#1a1410" },
  addBtn: { background: "linear-gradient(135deg, #e0b85c 0%, #c9a24b 100%)", border: "none", color: "#1a1408", padding: "12px 24px", borderRadius: "12px", cursor: "pointer", fontSize: "15px", fontWeight: "700", boxShadow: "0 4px 12px rgba(201, 162, 75, 0.35)" },
  categoriesBtn: { background: "rgba(0, 0, 0, 0.04)", border: "1px solid #e8e2d8", color: "#3f3a30", padding: "12px 20px", borderRadius: "12px", cursor: "pointer", fontSize: "14px", fontWeight: "600" },
  categoryRow: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", background: "#f7f5f2", borderRadius: "10px", marginBottom: "8px", fontSize: "14px", color: "#1a1410" },
  tableCard: { background: "#ffffff", borderRadius: "16px", border: "1px solid #e8e2d8", overflow: "hidden" },
  table: { width: "100%", borderCollapse: "collapse" },
  tableHeaderRow: { background: "#f3f0ea" },
  tableHeader: { padding: "16px", textAlign: "left", color: "#6b6155", fontSize: "13px", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.5px" },
  tableRow: { borderBottom: "1px solid #e8e2d8" },
  tableCell: { padding: "16px", color: "#1a1410", fontSize: "14px" },
  categoryBadge: { padding: "4px 12px", borderRadius: "6px", fontSize: "12px", fontWeight: "600", background: "rgba(201, 162, 75, 0.15)", color: "#a5822f" },
  statusBtn: { padding: "6px 12px", border: "none", borderRadius: "6px", fontSize: "13px", fontWeight: "600", cursor: "pointer" },
  actions: { display: "flex", gap: "8px" },
  editBtn: { padding: "8px 16px", background: "rgba(59, 130, 246, 0.1)", border: "1px solid rgba(59, 130, 246, 0.3)", borderRadius: "8px", color: "#2563eb", cursor: "pointer", fontSize: "13px", fontWeight: "600" },
  deleteBtn: { padding: "8px 16px", background: "rgba(239, 68, 68, 0.1)", border: "1px solid rgba(239, 68, 68, 0.3)", borderRadius: "8px", color: "#dc2626", cursor: "pointer", fontSize: "13px", fontWeight: "600" },
  emptyState: { textAlign: "center", padding: "60px 20px", color: "#6b6155" },
  emptyIcon: { fontSize: "48px", marginBottom: "16px" },
  modalOverlay: { position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0, 0, 0, 0.8)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 10000, padding: "20px" },
  modal: { backgroundColor: "#ffffff", borderRadius: "20px", width: "90%", maxWidth: "640px", maxHeight: "90vh", overflow: "auto", boxShadow: "0 20px 60px rgba(0, 0, 0, 0.25)" },
  modalHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "24px", borderBottom: "1px solid #e8e2d8" },
  modalTitle: { margin: 0, fontSize: "24px", fontWeight: "700", color: "#1a1410" },
  modalCloseBtn: { background: "rgba(0, 0, 0, 0.06)", border: "none", color: "#1a1410", width: "36px", height: "36px", borderRadius: "50%", cursor: "pointer", fontSize: "20px" },
  form: { padding: "24px" },
  formRow: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "20px" },
  formGroup: { display: "flex", flexDirection: "column", marginBottom: "20px" },
  label: { fontSize: "14px", fontWeight: "600", color: "#1a1410", marginBottom: "8px" },
  input: { padding: "12px", background: "#f7f5f2", border: "1px solid #e8e2d8", borderRadius: "10px", color: "#1a1410", fontSize: "14px" },
  productsHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" },
  addRowBtn: { background: "rgba(201, 162, 75, 0.15)", border: "1px solid rgba(201, 162, 75, 0.3)", color: "#a5822f", padding: "6px 12px", borderRadius: "8px", cursor: "pointer", fontSize: "13px", fontWeight: "600" },
  productRow: { display: "flex", gap: "8px", marginBottom: "8px", alignItems: "center" },
  removeRowBtn: { background: "rgba(239, 68, 68, 0.1)", border: "1px solid rgba(239, 68, 68, 0.3)", color: "#dc2626", width: "36px", height: "36px", borderRadius: "8px", cursor: "pointer" },
  modalActions: { display: "flex", gap: "12px", marginTop: "24px" },
  cancelBtn: { flex: 1, padding: "14px", background: "rgba(0, 0, 0, 0.04)", border: "1px solid #e8e2d8", borderRadius: "10px", color: "#6b6155", fontSize: "15px", fontWeight: "600", cursor: "pointer" },
  submitBtn: { flex: 2, padding: "14px", background: "linear-gradient(135deg, #e0b85c 0%, #c9a24b 100%)", border: "none", borderRadius: "10px", color: "#1a1408", fontSize: "15px", fontWeight: "700", cursor: "pointer", boxShadow: "0 4px 12px rgba(201, 162, 75, 0.35)" },
};

export default ServicesManagement;
