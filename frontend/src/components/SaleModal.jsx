import { useEffect, useMemo, useState } from "react";
import api from "../services/api";
import TicketPrint from "./TicketPrint";

function SaleModal({ onClose, onSale, modules }) {
  const mods = modules || { gaming: true, coiffure: true, stock: true };
  const [services, setServices] = useState([]);
  const [products, setProducts] = useState([]);
  const [coiffeurs, setCoiffeurs] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [categoryLabels, setCategoryLabels] = useState({});
  const [serviceCart, setServiceCart] = useState({}); // { serviceId: quantity }
  const [productCart, setProductCart] = useState({}); // { stockProductId: quantity }
  const [coiffeurId, setCoiffeurId] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [payOnCredit, setPayOnCredit] = useState(false);
  const [discount, setDiscount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [loading, setLoading] = useState(false);
  const [dataLoading, setDataLoading] = useState(true);
  const [error, setError] = useState("");
  const [completedSale, setCompletedSale] = useState(null);
  const [activeCategory, setActiveCategory] = useState("all");

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "Escape" && !loading) onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [loading, onClose]);

  const loadData = async () => {
    setDataLoading(true);
    try {
      const [servicesRes, productsRes, coiffeursRes, categoriesRes, customersRes] = await Promise.all([
        api.get("/services"),
        api.get("/stock-products"),
        api.get("/coiffeurs"),
        api.get("/service-categories").catch(() => ({ data: [] })),
        api.get("/customers/all").catch(() => ({ data: [] })),
      ]);
      setServices(mods.coiffure ? servicesRes.data : []);
      setProducts(
        productsRes.data.filter((p) => {
          if (p.source === "gaming") return mods.gaming;
          return mods.stock;
        })
      );
      setCoiffeurs(coiffeursRes.data);
      setCategoryLabels(
        Object.fromEntries((categoriesRes.data || []).map((c) => [c.slug, c.label]))
      );
      setCustomers(customersRes.data || []);
    } catch (e) {
      setError("Erreur chargement données: " + (e.response?.data?.message || e.message));
    } finally {
      setDataLoading(false);
    }
  };

  const addService = (id) => {
    setServiceCart((prev) => ({ ...prev, [id]: (prev[id] || 0) + 1 }));
  };
  const removeService = (id) => {
    setServiceCart((prev) => {
      const next = { ...prev };
      if (next[id] > 1) next[id]--;
      else delete next[id];
      return next;
    });
  };

  const addProduct = (id) => {
    setProductCart((prev) => ({ ...prev, [id]: (prev[id] || 0) + 1 }));
  };
  const removeProduct = (id) => {
    setProductCart((prev) => {
      const next = { ...prev };
      if (next[id] > 1) next[id]--;
      else delete next[id];
      return next;
    });
  };

  const servicesByCategory = useMemo(() => {
    const groups = {};
    services.forEach((s) => {
      if (!groups[s.category]) groups[s.category] = [];
      groups[s.category].push(s);
    });
    return groups;
  }, [services]);

  const categoryTabs = useMemo(() => {
    const tabs = Object.keys(servicesByCategory).map((cat) => ({
      id: cat,
      label: categoryLabels[cat] || cat,
    }));
    if (products.length > 0) tabs.push({ id: "products", label: "Produits" });
    return tabs;
  }, [servicesByCategory, products, categoryLabels]);

  const cartLines = useMemo(() => {
    const lines = [];
    Object.entries(serviceCart).forEach(([id, qty]) => {
      const service = services.find((s) => s.id === parseInt(id));
      if (service) lines.push({ key: `s-${id}`, name: service.name, qty, unitPrice: parseFloat(service.price), kind: "service", id });
    });
    Object.entries(productCart).forEach(([id, qty]) => {
      const product = products.find((p) => p.id === parseInt(id));
      if (product) lines.push({ key: `p-${id}`, name: product.size ? `${product.name} (${product.size})` : product.name, qty, unitPrice: parseFloat(product.sale_price || 0), kind: "product", id });
    });
    return lines;
  }, [serviceCart, productCart, services, products]);

  const subtotal = useMemo(
    () => cartLines.reduce((sum, line) => sum + line.unitPrice * line.qty, 0),
    [cartLines]
  );

  const discountValue = parseFloat(discount) || 0;
  const total = Math.max(0, subtotal - discountValue);
  const itemCount = cartLines.length;

  const selectedCustomer = useMemo(
    () => customers.find((c) => c.id === parseInt(customerId)) || null,
    [customers, customerId]
  );
  const availableCredit = selectedCustomer
    ? Math.max(0, parseFloat(selectedCustomer.credit_limit) - parseFloat(selectedCustomer.credit_balance))
    : 0;
  const canPayOnCredit = !!selectedCustomer && parseFloat(selectedCustomer.credit_limit) > 0;
  const creditExceeded = payOnCredit && total > availableCredit;

  const handleSell = async () => {
    if (itemCount === 0) {
      setError("Le panier est vide.");
      return;
    }
    if (payOnCredit && !customerId) {
      setError("Sélectionnez un client pour une vente à crédit.");
      return;
    }
    if (creditExceeded) {
      setError(`Crédit insuffisant pour ce client. Disponible : ${availableCredit.toFixed(2)} DH.`);
      return;
    }

    setError("");
    setLoading(true);

    try {
      const payload = {
        coiffeur_id: coiffeurId ? parseInt(coiffeurId) : null,
        customer_id: customerId ? parseInt(customerId) : null,
        paid_on_credit: payOnCredit,
        discount: discountValue,
        payment_method: paymentMethod,
        services: Object.entries(serviceCart).map(([id, quantity]) => ({
          service_id: parseInt(id),
          quantity,
        })),
        products: Object.entries(productCart).map(([id, quantity]) => ({
          stock_product_id: parseInt(id),
          quantity,
        })),
      };

      const res = await api.post("/sales", payload);
      setCompletedSale(res.data.sale);
      onSale("Vente enregistrée: " + total.toFixed(2) + " DH", "success");
    } catch (e) {
      const msg = "Erreur: " + (e.response?.data?.message || e.message);
      setError(msg);
      onSale(msg, "error");
    } finally {
      setLoading(false);
    }
  };

  if (completedSale) {
    return (
      <TicketPrint
        sale={completedSale}
        onClose={onClose}
        onNewSale={() => {
          setCompletedSale(null);
          setServiceCart({});
          setProductCart({});
          setCoiffeurId("");
          setCustomerId("");
          setPayOnCredit(false);
          setDiscount("");
        }}
      />
    );
  }

  const showCategory = (catId) => activeCategory === "all" || activeCategory === catId;

  return (
    <div style={styles.overlay} onClick={() => !loading && onClose()} role="presentation">
      <div style={styles.modal} onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true" aria-label="Nouvelle vente">
        <div style={styles.header}>
          <div style={styles.headerTitleGroup}>
            <span style={styles.headerIcon}>✂️</span>
            <h2 style={styles.title}>Nouvelle Vente</h2>
          </div>
          <button onClick={onClose} style={styles.closeBtn} aria-label="Fermer">✕</button>
        </div>

        <div style={styles.body} className="sale-modal-body">
          {/* ===== Catalogue (left) ===== */}
          <div style={styles.catalogPane} className="sale-modal-catalog">
            {categoryTabs.length > 1 && (
              <div style={styles.tabsRow}>
                <button
                  onClick={() => setActiveCategory("all")}
                  style={{ ...styles.tab, ...(activeCategory === "all" ? styles.tabActive : {}) }}
                >
                  Tout
                </button>
                {categoryTabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveCategory(tab.id)}
                    style={{ ...styles.tab, ...(activeCategory === tab.id ? styles.tabActive : {}) }}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            )}

            <div style={styles.catalogScroll}>
              {dataLoading ? (
                <div style={styles.dataLoading}>
                  <span style={styles.spinnerSmall} />
                  Chargement du catalogue...
                </div>
              ) : (
                <>
                  {Object.entries(servicesByCategory).map(([category, items]) =>
                    showCategory(category) ? (
                      <div key={category} style={styles.category}>
                        <h3 style={styles.categoryTitle}>{categoryLabels[category] || category}</h3>
                        <div style={styles.itemGrid}>
                          {items.map((service) => (
                            <SelectableCard
                              key={service.id}
                              label={service.name}
                              price={service.price}
                              quantity={serviceCart[service.id] || 0}
                              onAdd={() => addService(service.id)}
                              onRemove={() => removeService(service.id)}
                            />
                          ))}
                        </div>
                      </div>
                    ) : null
                  )}

                  {products.length > 0 && showCategory("products") && (
                    <div style={styles.category}>
                      <h3 style={styles.categoryTitle}>🛍️ Produits à vendre</h3>
                      <div style={styles.itemGrid}>
                        {products.map((product) => (
                          <SelectableCard
                            key={product.id}
                            label={product.size ? `${product.name} (${product.size})` : product.name}
                            price={product.sale_price}
                            quantity={productCart[product.id] || 0}
                            disabled={product.quantity <= 0}
                            onAdd={() => addProduct(product.id)}
                            onRemove={() => removeProduct(product.id)}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {!dataLoading && services.length === 0 && products.length === 0 && (
                    <div style={styles.emptyCatalog}>Aucune prestation ou produit disponible.</div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* ===== Cart & checkout (right) ===== */}
          <div style={styles.cartPane} className="sale-modal-cart">
            <div style={styles.cartHeader}>
              <span>Panier</span>
              {itemCount > 0 && <span style={styles.cartCount}>{itemCount}</span>}
            </div>

            <div style={styles.cartList}>
              {cartLines.length === 0 ? (
                <div style={styles.cartEmpty}>
                  <span style={styles.cartEmptyIcon}>🧾</span>
                  Aucun article sélectionné
                </div>
              ) : (
                cartLines.map((line) => (
                  <div key={line.key} style={styles.cartLine}>
                    <div style={styles.cartLineInfo}>
                      <div style={styles.cartLineName}>{line.name}</div>
                      <div style={styles.cartLineMeta}>
                        {line.qty} × {line.unitPrice.toFixed(2)} DH
                      </div>
                    </div>
                    <div style={styles.cartLineRight}>
                      <span style={styles.cartLineTotal}>{(line.unitPrice * line.qty).toFixed(2)} DH</span>
                      <div style={styles.cartLineQty}>
                        <button
                          onClick={() => (line.kind === "service" ? removeService(line.id) : removeProduct(line.id))}
                          style={styles.cartQtyBtn}
                          aria-label="Retirer"
                        >
                          −
                        </button>
                        <button
                          onClick={() => (line.kind === "service" ? addService(line.id) : addProduct(line.id))}
                          style={styles.cartQtyBtn}
                          aria-label="Ajouter"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div style={styles.checkoutForm}>
              <div style={styles.formGroup}>
                <label style={styles.label}>Coiffeur</label>
                <select value={coiffeurId} onChange={(e) => setCoiffeurId(e.target.value)} style={styles.input}>
                  <option value="">— Aucun —</option>
                  {coiffeurs.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>Client</label>
                <select
                  value={customerId}
                  onChange={(e) => { setCustomerId(e.target.value); setPayOnCredit(false); }}
                  style={styles.input}
                >
                  <option value="">— Aucun —</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}{c.phone ? ` (${c.phone})` : ""}</option>
                  ))}
                </select>
              </div>

              {canPayOnCredit && (
                <label style={styles.creditCheckLabel}>
                  <input
                    type="checkbox"
                    checked={payOnCredit}
                    onChange={(e) => setPayOnCredit(e.target.checked)}
                  />
                  Vendre à crédit (ardoise) — disponible : {availableCredit.toFixed(2)} DH
                </label>
              )}

              <div style={styles.formRow2}>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Remise (DH)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={discount}
                    onChange={(e) => setDiscount(e.target.value)}
                    style={styles.input}
                    placeholder="0"
                  />
                </div>

                <div style={styles.formGroup}>
                  <label style={styles.label}>Paiement</label>
                  <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} style={styles.input}>
                    <option value="cash">Espèces</option>
                    <option value="card">Carte Bancaire</option>
                    <option value="mobile">Mobile</option>
                  </select>
                </div>
              </div>

              <div style={styles.totalsRow}>
                <div style={styles.totalsLine}>
                  <span>Sous-total</span>
                  <span>{subtotal.toFixed(2)} DH</span>
                </div>
                {discountValue > 0 && (
                  <div style={styles.totalsLine}>
                    <span>Remise</span>
                    <span>− {discountValue.toFixed(2)} DH</span>
                  </div>
                )}
                <div style={styles.totalsLineBig}>
                  <span>Total</span>
                  <span>{total.toFixed(2)} DH</span>
                </div>
              </div>

              {error && <div style={styles.errorBox}>{error}</div>}

              <div style={styles.actions}>
                <button onClick={onClose} style={styles.cancelBtn} disabled={loading}>Annuler</button>
                <button
                  onClick={handleSell}
                  disabled={loading || itemCount === 0 || creditExceeded}
                  style={{ ...styles.confirmBtn, opacity: loading || itemCount === 0 || creditExceeded ? 0.5 : 1 }}
                >
                  {loading ? (
                    <span style={styles.spinnerBtn} />
                  ) : payOnCredit ? (
                    `Mettre à crédit (${total.toFixed(2)} DH)`
                  ) : (
                    `Encaisser (${total.toFixed(2)} DH)`
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SelectableCard({ label, price, quantity, disabled, onAdd, onRemove }) {
  const selected = quantity > 0;
  return (
    <div style={{ ...styles.itemCard, ...(selected ? styles.itemCardSelected : {}) }}>
      <div style={styles.itemName}>{label}</div>
      <div style={styles.itemPrice}>{parseFloat(price || 0).toFixed(2)} DH</div>
      {quantity === 0 ? (
        <button onClick={onAdd} style={styles.addBtn} disabled={disabled}>
          {disabled ? "Indisponible" : "+ Ajouter"}
        </button>
      ) : (
        <div style={styles.quantityControls}>
          <button onClick={onRemove} style={styles.qtyBtn} aria-label="Retirer">−</button>
          <span style={styles.qtyDisplay}>{quantity}</span>
          <button onClick={onAdd} style={styles.qtyBtn} disabled={disabled} aria-label="Ajouter">+</button>
        </div>
      )}
    </div>
  );
}

const GOLD_GRADIENT = "linear-gradient(135deg, #e0b85c 0%, #c9a24b 100%)";

const styles = {
  overlay: { position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0, 0, 0, 0.82)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 10000, padding: "20px", backdropFilter: "blur(2px)" },
  modal: { backgroundColor: "#ffffff", borderRadius: "22px", width: "95%", maxWidth: "1100px", height: "88vh", maxHeight: "760px", display: "flex", flexDirection: "column", boxShadow: "0 30px 80px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(201,162,75,0.15)", overflow: "hidden", border: "1px solid #e8e2d8" },

  header: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "20px 26px", borderBottom: "1px solid #e8e2d8", flexShrink: 0 },
  headerTitleGroup: { display: "flex", alignItems: "center", gap: "10px" },
  headerIcon: { fontSize: "20px" },
  title: { margin: 0, fontSize: "19px", fontWeight: "700", color: "#1a1410", letterSpacing: "0.2px" },
  closeBtn: { background: "rgba(0, 0, 0, 0.04)", border: "1px solid #e8e2d8", color: "#1a1410", width: "34px", height: "34px", borderRadius: "50%", cursor: "pointer", fontSize: "15px", display: "flex", alignItems: "center", justifyContent: "center", transition: "background 0.15s" },

  body: { flex: 1, display: "flex", minHeight: 0 },

  /* ---- catalog (left) ---- */
  catalogPane: { flex: "1 1 62%", display: "flex", flexDirection: "column", minWidth: 0, borderRight: "1px solid #e8e2d8" },
  tabsRow: { display: "flex", gap: "8px", padding: "16px 22px 0", flexWrap: "wrap", flexShrink: 0 },
  tab: { padding: "7px 14px", borderRadius: "20px", background: "#f7f5f2", border: "1px solid #e8e2d8", color: "#6b6155", fontSize: "12.5px", fontWeight: "600", cursor: "pointer", transition: "all 0.15s", whiteSpace: "nowrap" },
  tabActive: { background: "rgba(201,162,75,0.15)", borderColor: "rgba(201,162,75,0.4)", color: "#a5822f" },

  catalogScroll: { flex: 1, overflowY: "auto", padding: "18px 22px 22px" },
  dataLoading: { display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "12px", padding: "80px 20px", color: "#6b6155", fontSize: "13.5px" },
  spinnerSmall: { width: "28px", height: "28px", border: "3px solid rgba(0,0,0,0.08)", borderTopColor: "#c9a24b", borderRadius: "50%", animation: "saleModalSpin 0.8s linear infinite" },
  emptyCatalog: { textAlign: "center", padding: "60px 20px", color: "#6b6155", fontSize: "14px" },

  category: { marginBottom: "22px" },
  categoryTitle: { margin: "0 0 12px 0", fontSize: "13px", fontWeight: "700", color: "#a5822f", textTransform: "uppercase", letterSpacing: "0.6px" },
  itemGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(148px, 1fr))", gap: "10px" },
  itemCard: { background: "#f9f7f3", borderRadius: "12px", padding: "12px", textAlign: "center", border: "1px solid #e8e2d8", transition: "border-color 0.15s, background 0.15s" },
  itemCardSelected: { borderColor: "rgba(201,162,75,0.5)", background: "rgba(201,162,75,0.08)" },
  itemName: { fontSize: "12.5px", fontWeight: "600", color: "#1a1410", marginBottom: "6px", minHeight: "30px", lineHeight: "1.3" },
  itemPrice: { fontSize: "15px", fontWeight: "700", color: "#a5822f", marginBottom: "9px" },
  addBtn: { width: "100%", padding: "7px", background: GOLD_GRADIENT, color: "#1a1408", border: "none", borderRadius: "8px", cursor: "pointer", fontSize: "12px", fontWeight: "700" },
  quantityControls: { display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" },
  qtyBtn: { width: "26px", height: "26px", background: "rgba(0, 0, 0, 0.06)", color: "#1a1410", border: "1px solid #d9d2c4", borderRadius: "7px", cursor: "pointer", fontSize: "14px", fontWeight: "600", lineHeight: 1 },
  qtyDisplay: { fontSize: "14px", fontWeight: "700", color: "#1a1410", minWidth: "22px", textAlign: "center" },

  /* ---- cart (right) ---- */
  cartPane: { flex: "1 1 38%", maxWidth: "380px", display: "flex", flexDirection: "column", background: "#f7f5f2", minHeight: 0 },
  cartHeader: { display: "flex", alignItems: "center", gap: "8px", padding: "18px 22px 12px", fontSize: "13px", fontWeight: "700", color: "#6b6155", textTransform: "uppercase", letterSpacing: "0.6px", flexShrink: 0 },
  cartCount: { background: "rgba(201,162,75,0.2)", color: "#a5822f", fontSize: "11.5px", fontWeight: "700", padding: "1px 8px", borderRadius: "10px" },

  cartList: { flex: 1, overflowY: "auto", padding: "0 22px", minHeight: "60px" },
  cartEmpty: { display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "8px", padding: "40px 10px", color: "#8a8070", fontSize: "13px", textAlign: "center" },
  cartEmptyIcon: { fontSize: "28px", opacity: 0.6 },

  cartLine: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "10px", padding: "11px 0", borderBottom: "1px solid #e8e2d8" },
  cartLineInfo: { flex: 1, minWidth: 0 },
  cartLineName: { fontSize: "13px", fontWeight: "600", color: "#1a1410", marginBottom: "2px" },
  cartLineMeta: { fontSize: "11.5px", color: "#8a8070" },
  cartLineRight: { display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "6px" },
  cartLineTotal: { fontSize: "13px", fontWeight: "700", color: "#a5822f" },
  cartLineQty: { display: "flex", gap: "4px" },
  cartQtyBtn: { width: "20px", height: "20px", background: "rgba(0,0,0,0.05)", border: "1px solid #d9d2c4", borderRadius: "5px", color: "#3f3a30", fontSize: "12px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 1, padding: 0 },

  checkoutForm: { flexShrink: 0, padding: "16px 22px 22px", borderTop: "1px solid #e8e2d8" },
  formGroup: { display: "flex", flexDirection: "column", marginBottom: "12px" },
  formRow2: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" },
  label: { fontSize: "11.5px", fontWeight: "600", color: "#6b6155", marginBottom: "5px" },
  creditCheckLabel: { display: "flex", alignItems: "center", gap: "8px", fontSize: "12px", fontWeight: "600", color: "#b45309", marginBottom: "12px", cursor: "pointer" },
  input: { padding: "9px 11px", background: "#ffffff", border: "1px solid #d9d2c4", borderRadius: "8px", color: "#1a1410", fontSize: "13px", fontFamily: "inherit" },

  totalsRow: { borderTop: "1px dashed #d9d2c4", paddingTop: "10px", marginTop: "4px", marginBottom: "12px" },
  totalsLine: { display: "flex", justifyContent: "space-between", fontSize: "13px", color: "#6b6155", padding: "2px 0" },
  totalsLineBig: { display: "flex", justifyContent: "space-between", fontSize: "19px", fontWeight: "700", color: "#1a1410", paddingTop: "6px" },
  errorBox: { marginBottom: "12px", padding: "9px 12px", border: "1px solid rgba(239,68,68,0.35)", borderRadius: "9px", background: "rgba(239,68,68,0.1)", color: "#b91c1c", fontSize: "12.5px", fontWeight: "600" },
  actions: { display: "flex", gap: "10px" },
  cancelBtn: { flex: 1, padding: "12px", background: "rgba(0, 0, 0, 0.04)", border: "1px solid #e8e2d8", borderRadius: "10px", color: "#3f3a30", fontSize: "13.5px", fontWeight: "600", cursor: "pointer" },
  confirmBtn: { flex: 2, padding: "12px", background: GOLD_GRADIENT, border: "none", borderRadius: "10px", color: "#1a1408", fontSize: "13.5px", fontWeight: "700", cursor: "pointer", boxShadow: "0 4px 14px rgba(201, 162, 75, 0.3)", display: "flex", alignItems: "center", justifyContent: "center" },
  spinnerBtn: { width: "16px", height: "16px", border: "2.5px solid rgba(26,20,8,0.3)", borderTopColor: "#1a1408", borderRadius: "50%", animation: "saleModalSpin 0.7s linear infinite" },
};

if (typeof document !== "undefined" && !document.getElementById("sale-modal-keyframes")) {
  const styleTag = document.createElement("style");
  styleTag.id = "sale-modal-keyframes";
  styleTag.textContent = `
    @keyframes saleModalSpin { to { transform: rotate(360deg); } }
    @media (max-width: 780px) {
      .sale-modal-body { flex-direction: column; }
      .sale-modal-catalog { border-right: none !important; border-bottom: 1px solid #e8e2d8; flex: 1 1 auto !important; }
      .sale-modal-cart { max-width: none !important; flex: 0 0 auto !important; }
    }
  `;
  document.head.appendChild(styleTag);
}

export default SaleModal;
