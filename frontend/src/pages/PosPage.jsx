import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Clock, Delete, Maximize, Minimize, Minus, Plus, Search, ShoppingCart, Trash2, X } from "lucide-react";
import api from "../services/api";
import TicketPrint from "../components/TicketPrint";
import Toast from "../components/Toast";

// Écran de caisse plein écran (POS) : catalogue à gauche, panier + encaissement à droite.
// Raccourcis : F2 recherche, F9 encaisser, Échap vider la recherche.
// Lecteur de codes-barres : il « tape » le code puis Entrée, dans la recherche ou n'importe où sur la page.

const QUICK_BILLS = [20, 50, 100, 200];
const AUTO_PRINT_KEY = "pos_auto_print";
const SCAN_MAX_GAP_MS = 60; // un lecteur tape bien plus vite qu'un humain
const PAYMENT_METHODS = [
  { id: "cash", label: "Espèces" },
  { id: "card", label: "Carte" },
  { id: "mobile", label: "Mobile" },
  { id: "mixed", label: "Mixte" },
];

const round2 = (n) => Math.round(n * 100) / 100;
const fmt = (n) => `${round2(n).toFixed(2)} DH`;
const normalize = (s) => (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

function readAutoPrint() {
  try {
    return localStorage.getItem(AUTO_PRINT_KEY) === "1";
  } catch {
    return false;
  }
}

function PosPage({ user, onBack }) {
  const modules = user?.modules || { gaming: true, coiffure: true, stock: true };

  const [services, setServices] = useState([]);
  const [products, setProducts] = useState([]);
  const [coiffeurs, setCoiffeurs] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [categoryLabels, setCategoryLabels] = useState({});
  const [organization, setOrganization] = useState(null);
  const [register, setRegister] = useState(null);
  const [dataLoading, setDataLoading] = useState(true);

  const [cart, setCart] = useState({}); // { "s-12" | "p-7": quantité }
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");
  const [coiffeurId, setCoiffeurId] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [payOnCredit, setPayOnCredit] = useState(false);
  const [discount, setDiscount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [received, setReceived] = useState("");
  const [cardPart, setCardPart] = useState(""); // paiement mixte
  const [mobilePart, setMobilePart] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [completed, setCompleted] = useState(null); // { sale, received, change }
  const [autoPrint, setAutoPrint] = useState(readAutoPrint);
  const [toast, setToast] = useState(null);
  const [now, setNow] = useState(() => new Date());
  const [isFullscreen, setIsFullscreen] = useState(() => !!document.fullscreenElement);

  const searchRef = useRef(null);
  const checkoutRef = useRef(null);
  const scanRef = useRef(null);
  const scanBuffer = useRef({ code: "", last: 0 });

  const showToast = useCallback((message, type = "info") => setToast({ message, type }), []);
  const closeToast = useCallback(() => setToast(null), []);

  const loadCatalog = useCallback(
    () =>
      Promise.all([
        api.get("/services"),
        api.get("/stock-products"),
        api.get("/coiffeurs"),
        api.get("/service-categories").catch(() => ({ data: [] })),
        api.get("/customers/all").catch(() => ({ data: [] })),
        api.get("/organization/settings").catch(() => ({ data: {} })),
        api.get("/cash-register/today").catch(() => ({ data: {} })),
      ])
        .then(([servicesRes, productsRes, coiffeursRes, categoriesRes, customersRes, orgRes, registerRes]) => {
          setServices(modules.coiffure ? servicesRes.data : []);
          setProducts(productsRes.data.filter((p) => (p.source === "gaming" ? modules.gaming : modules.stock)));
          setCoiffeurs(coiffeursRes.data);
          setCategoryLabels(Object.fromEntries((categoriesRes.data || []).map((c) => [c.slug, c.label])));
          setCustomers(customersRes.data || []);
          setOrganization(orgRes.data.organization || null);
          setRegister(registerRes.data.register || null);
        })
        .catch((e) => setError("Erreur chargement données: " + (e.response?.data?.message || e.message)))
        .finally(() => setDataLoading(false)),
    [modules.coiffure, modules.gaming, modules.stock]
  );

  useEffect(() => {
    loadCatalog();
  }, [loadCatalog]);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    const onFs = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFs);
    return () => {
      clearInterval(timer);
      document.removeEventListener("fullscreenchange", onFs);
    };
  }, []);

  // ===== Catalogue =====
  const catalog = useMemo(() => {
    const items = services.map((s) => ({
      key: `s-${s.id}`,
      kind: "service",
      id: s.id,
      name: s.name,
      price: parseFloat(s.price) || 0,
      category: s.category,
      stock: null,
    }));
    products.forEach((p) => {
      items.push({
        key: `p-${p.id}`,
        kind: "product",
        id: p.id,
        name: p.size ? `${p.name} (${p.size})` : p.name,
        price: parseFloat(p.sale_price) || 0,
        category: "products",
        stock: parseFloat(p.quantity) || 0,
        barcode: p.barcode || null,
      });
    });
    return items;
  }, [services, products]);

  const itemsByKey = useMemo(() => Object.fromEntries(catalog.map((i) => [i.key, i])), [catalog]);

  const categoryTabs = useMemo(() => {
    const seen = [];
    services.forEach((s) => {
      if (!seen.includes(s.category)) seen.push(s.category);
    });
    const tabs = seen.map((cat) => ({ id: cat, label: categoryLabels[cat] || cat }));
    if (products.length > 0) tabs.push({ id: "products", label: "Produits" });
    return tabs;
  }, [services, products, categoryLabels]);

  const visibleItems = useMemo(() => {
    const q = normalize(search.trim());
    return catalog.filter((item) => {
      if (q) return normalize(item.name).includes(q);
      return activeCategory === "all" || item.category === activeCategory;
    });
  }, [catalog, search, activeCategory]);

  // ===== Panier =====
  const canAdd = (item, current) => item.stock === null || current + 1 <= item.stock;

  const addItem = (item) => {
    setError("");
    setCart((prev) => {
      const current = prev[item.key] || 0;
      if (!canAdd(item, current)) return prev;
      return { ...prev, [item.key]: current + 1 };
    });
  };

  const decItem = (key) => {
    setCart((prev) => {
      const next = { ...prev };
      if (next[key] > 1) next[key]--;
      else delete next[key];
      return next;
    });
  };

  const removeItem = (key) => {
    setCart((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const cartLines = useMemo(
    () =>
      Object.entries(cart)
        .map(([key, qty]) => (itemsByKey[key] ? { ...itemsByKey[key], qty } : null))
        .filter(Boolean),
    [cart, itemsByKey]
  );

  const itemCount = cartLines.reduce((n, l) => n + l.qty, 0);
  const subtotal = round2(cartLines.reduce((sum, l) => sum + l.price * l.qty, 0));
  const discountValue = Math.max(0, parseFloat(discount) || 0);
  const afterDiscount = Math.max(0, round2(subtotal - discountValue));
  const tvaEnabled = !!organization?.tva_enabled;
  const taxRate = tvaEnabled ? parseFloat(organization.tva_rate) || 0 : 0;
  const taxAmount = tvaEnabled ? round2((afterDiscount * taxRate) / 100) : 0;
  const total = round2(afterDiscount + taxAmount);

  const selectedCustomer = customers.find((c) => c.id === parseInt(customerId)) || null;
  const availableCredit = selectedCustomer
    ? Math.max(0, parseFloat(selectedCustomer.credit_limit) - parseFloat(selectedCustomer.credit_balance))
    : 0;
  const canPayOnCredit = !!selectedCustomer && parseFloat(selectedCustomer.credit_limit) > 0;
  const creditExceeded = payOnCredit && total > availableCredit;

  // Paiement mixte : carte et mobile saisis, le reste est dû en espèces
  const isMixed = paymentMethod === "mixed" && !payOnCredit;
  const cardValue = isMixed ? Math.max(0, parseFloat(cardPart) || 0) : 0;
  const mobileValue = isMixed ? Math.max(0, parseFloat(mobilePart) || 0) : 0;
  const mixedOver = isMixed && round2(cardValue + mobileValue) > total;
  const cashDue = payOnCredit
    ? 0
    : paymentMethod === "cash"
      ? total
      : isMixed
        ? Math.max(0, round2(total - cardValue - mobileValue))
        : 0;

  const isCash = !payOnCredit && (paymentMethod === "cash" || (isMixed && cashDue > 0));
  const receivedValue = parseFloat(received);
  const hasReceived = received !== "" && !Number.isNaN(receivedValue);
  const change = isCash && hasReceived ? round2(receivedValue - cashDue) : 0;
  const insufficientCash = isCash && hasReceived && receivedValue < cashDue;
  const registerClosed = !!register && !register.is_open;
  const checkoutDisabled =
    submitting || itemCount === 0 || creditExceeded || insufficientCash || mixedOver || registerClosed;

  const resetSale = () => {
    setCart({});
    setCoiffeurId("");
    setCustomerId("");
    setPayOnCredit(false);
    setDiscount("");
    setPaymentMethod("cash");
    setReceived("");
    setCardPart("");
    setMobilePart("");
    setSearch("");
    setError("");
  };

  // ===== Pavé numérique =====
  const pressKey = (k) => {
    setReceived((prev) => {
      if (k === "back") return prev.slice(0, -1);
      if (k === ".") return prev.includes(".") ? prev : (prev || "0") + ".";
      const [, decimals] = prev.split(".");
      if (decimals !== undefined && decimals.length >= 2) return prev;
      return prev === "0" ? k : prev + k;
    });
  };

  // ===== Encaissement =====
  const handleCheckout = async () => {
    if (checkoutDisabled) {
      if (registerClosed) setError("La caisse du jour est clôturée : aucune vente n'est possible.");
      else if (itemCount === 0) setError("Le panier est vide.");
      else if (mixedOver) setError("Les montants carte + mobile dépassent le total.");
      else if (insufficientCash) setError("Montant reçu insuffisant.");
      else if (creditExceeded) setError(`Crédit insuffisant pour ce client. Disponible : ${fmt(availableCredit)}.`);
      return;
    }
    if (payOnCredit && !customerId) {
      setError("Sélectionnez un client pour une vente à crédit.");
      return;
    }

    setError("");
    setSubmitting(true);
    try {
      const payload = {
        coiffeur_id: coiffeurId ? parseInt(coiffeurId) : null,
        customer_id: customerId ? parseInt(customerId) : null,
        paid_on_credit: payOnCredit,
        discount: discountValue,
        payment_method: paymentMethod,
        payments: isMixed
          ? [
              { method: "cash", amount: cashDue },
              { method: "card", amount: cardValue },
              { method: "mobile", amount: mobileValue },
            ].filter((p) => p.amount > 0)
          : null,
        services: cartLines.filter((l) => l.kind === "service").map((l) => ({ service_id: l.id, quantity: l.qty })),
        products: cartLines.filter((l) => l.kind === "product").map((l) => ({ stock_product_id: l.id, quantity: l.qty })),
      };
      const res = await api.post("/sales", payload);
      const sale = res.data.sale;
      // La part espèces enregistrée par le serveur fait foi pour le rendu de monnaie.
      const cashPart = parseFloat(sale.paid_cash) || 0;
      const cashGiven = cashPart > 0 ? (hasReceived ? receivedValue : cashPart) : null;
      setCompleted({
        sale,
        received: cashGiven,
        change: cashGiven !== null ? round2(cashGiven - cashPart) : null,
      });
      showToast("Vente enregistrée : " + fmt(parseFloat(sale.total) || 0), "success");
    } catch (e) {
      setError("Erreur: " + (e.response?.data?.message || e.message));
    } finally {
      setSubmitting(false);
    }
  };

  // ===== Codes-barres =====
  const findByBarcode = (code) => {
    const wanted = code.trim();
    return wanted ? catalog.find((i) => i.barcode && i.barcode === wanted) || null : null;
  };

  const handleScan = (code) => {
    const item = findByBarcode(code);
    if (!item) {
      setError(`Code-barres inconnu : ${code}`);
      return;
    }
    if (!canAdd(item, cart[item.key] || 0)) {
      setError(`Stock insuffisant pour ${item.name}.`);
      return;
    }
    addItem(item);
  };

  useEffect(() => {
    checkoutRef.current = handleCheckout;
    scanRef.current = handleScan;
  });

  // ===== Raccourcis clavier + lecteur hors champ de saisie =====
  useEffect(() => {
    const isEditable = (el) => el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable);
    const onKeyDown = (event) => {
      if (completed) return;
      if (!isEditable(event.target) && !event.ctrlKey && !event.altKey && !event.metaKey) {
        const buf = scanBuffer.current;
        const t = Date.now();
        if (event.key === "Enter" && buf.code.length >= 3 && t - buf.last < SCAN_MAX_GAP_MS * 3) {
          event.preventDefault();
          scanRef.current?.(buf.code);
          buf.code = "";
          return;
        }
        if (event.key.length === 1) {
          buf.code = t - buf.last > SCAN_MAX_GAP_MS ? event.key : buf.code + event.key;
          buf.last = t;
        }
      }
      if (event.key === "F2") {
        event.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
      } else if (event.key === "F9") {
        event.preventDefault();
        checkoutRef.current?.();
      } else if (event.key === "Escape" && document.activeElement === searchRef.current) {
        setSearch("");
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [completed]);

  const onSearchKeyDown = (event) => {
    if (event.key !== "Enter") return;
    if (findByBarcode(search)) {
      handleScan(search);
      setSearch("");
      return;
    }
    const available = visibleItems.filter((i) => canAdd(i, cart[i.key] || 0));
    if (available.length === 1) {
      addItem(available[0]);
      setSearch("");
    } else if (visibleItems.length === 0 && /^\d{6,}$/.test(search.trim())) {
      // Ressemble à un code-barres scanné mais n'existe pas
      setError(`Code-barres inconnu : ${search.trim()}`);
      setSearch("");
    }
  };

  const toggleAutoPrint = () => {
    setAutoPrint((prev) => {
      try {
        localStorage.setItem(AUTO_PRINT_KEY, prev ? "0" : "1");
      } catch {
        void 0;
      }
      return !prev;
    });
  };

  const toggleFullscreen = () => {
    if (document.fullscreenElement) document.exitFullscreen?.();
    else document.documentElement.requestFullscreen?.().catch(() => {});
  };

  const finishSale = () => {
    setCompleted(null);
    resetSale();
    loadCatalog(); // stock mis à jour
    setTimeout(() => searchRef.current?.focus(), 0);
  };

  // ===== Rendu =====
  return (
    <div style={styles.page} className="pos-page">
      {toast && <Toast message={toast.message} type={toast.type} onClose={closeToast} />}

      {completed && (
        <TicketPrint
          sale={completed.sale}
          cashReceived={completed.received}
          change={completed.change}
          autoPrint={autoPrint}
          onClose={finishSale}
          onNewSale={finishSale}
        />
      )}

      {/* ===== Barre du haut ===== */}
      <header style={styles.topBar}>
        <button onClick={onBack} style={styles.backBtn}>
          <ArrowLeft size={18} /> <span className="pos-hide-sm">Retour</span>
        </button>
        <h1 style={styles.title}>Caisse</h1>
        <div style={styles.topRight}>
          <label style={styles.autoPrint} className="pos-hide-sm">
            <input type="checkbox" checked={autoPrint} onChange={toggleAutoPrint} />
            Impression auto
          </label>
          <span style={styles.clock} className="pos-hide-sm">
            <Clock size={15} /> {now.toLocaleTimeString("fr-FR")}
          </span>
          {register && (
            <span
              style={{ ...styles.registerChip, ...(registerClosed ? styles.registerClosed : styles.registerOpen) }}
              title={registerClosed ? "Caisse clôturée" : `Fond de caisse : ${fmt(register.opening_balance)}`}
            >
              {registerClosed ? "Caisse clôturée" : "Caisse ouverte"}
            </span>
          )}
          <span style={styles.userName} className="pos-hide-sm">{user?.name}</span>
          <button onClick={toggleFullscreen} style={styles.iconBtn} aria-label="Plein écran" title="Plein écran">
            {isFullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
          </button>
        </div>
      </header>

      {registerClosed && (
        <div style={styles.closedBanner}>
          La caisse du jour a été clôturée{register.closed_by_name ? ` par ${register.closed_by_name}` : ""}
          {register.closed_at ? ` à ${register.closed_at}` : ""}. Les ventes sont bloquées jusqu'à demain.
        </div>
      )}

      <div style={styles.body} className="pos-body">
        {/* ===== Catalogue ===== */}
        <section style={styles.catalogPane} className="pos-catalog">
          <div style={styles.searchRow}>
            <div style={styles.searchBox}>
              <Search size={18} color="#8a8070" />
              <input
                ref={searchRef}
                autoFocus
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={onSearchKeyDown}
                placeholder="Rechercher un article (F2)…"
                style={styles.searchInput}
              />
              {search && (
                <button onClick={() => setSearch("")} style={styles.clearSearch} aria-label="Effacer">
                  <X size={16} />
                </button>
              )}
            </div>
          </div>

          {categoryTabs.length > 1 && !search && (
            <div style={styles.tabsRow}>
              {[{ id: "all", label: "Tout" }, ...categoryTabs].map((tab) => (
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

          <div style={styles.grid}>
            {dataLoading ? (
              <div style={styles.emptyCatalog}>Chargement du catalogue…</div>
            ) : visibleItems.length === 0 ? (
              <div style={styles.emptyCatalog}>
                {search ? `Aucun article ne correspond à « ${search} ».` : "Aucune prestation ou produit disponible."}
              </div>
            ) : (
              visibleItems.map((item) => {
                const qty = cart[item.key] || 0;
                const outOfStock = item.stock !== null && item.stock <= 0;
                const disabled = !canAdd(item, qty);
                return (
                  <button
                    key={item.key}
                    onClick={() => addItem(item)}
                    disabled={disabled}
                    style={{
                      ...styles.tile,
                      ...(qty > 0 ? styles.tileSelected : {}),
                      ...(disabled ? styles.tileDisabled : {}),
                    }}
                  >
                    {qty > 0 && <span style={styles.tileBadge}>{qty}</span>}
                    <span style={styles.tileName}>{item.name}</span>
                    <span style={styles.tilePrice}>{fmt(item.price)}</span>
                    {item.stock !== null && (
                      <span style={{ ...styles.tileStock, color: outOfStock ? "#b91c1c" : "#8a8070" }}>
                        {outOfStock ? "Rupture" : `Stock : ${item.stock}`}
                      </span>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </section>

        {/* ===== Panier & encaissement ===== */}
        <section style={styles.cartPane} className="pos-cart">
          <div style={styles.cartHeader}>
            <ShoppingCart size={16} /> Panier
            {itemCount > 0 && <span style={styles.cartCount}>{itemCount}</span>}
            {itemCount > 0 && (
              <button onClick={resetSale} style={styles.clearCart}>
                Vider
              </button>
            )}
          </div>

          <div style={styles.cartList}>
            {cartLines.length === 0 ? (
              <div style={styles.cartEmpty}>Touchez un article pour l'ajouter</div>
            ) : (
              cartLines.map((line) => (
                <div key={line.key} style={styles.cartLine}>
                  <div style={styles.cartLineInfo}>
                    <div style={styles.cartLineName}>{line.name}</div>
                    <div style={styles.cartLineMeta}>{fmt(line.price)} / u</div>
                  </div>
                  <div style={styles.qtyGroup}>
                    <button onClick={() => decItem(line.key)} style={styles.qtyBtn} aria-label="Retirer un">
                      <Minus size={14} />
                    </button>
                    <span style={styles.qtyValue}>{line.qty}</span>
                    <button
                      onClick={() => addItem(line)}
                      disabled={!canAdd(line, line.qty)}
                      style={styles.qtyBtn}
                      aria-label="Ajouter un"
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                  <span style={styles.cartLineTotal}>{fmt(line.price * line.qty)}</span>
                  <button onClick={() => removeItem(line.key)} style={styles.removeBtn} aria-label="Supprimer la ligne">
                    <Trash2 size={15} />
                  </button>
                </div>
              ))
            )}
          </div>

          <div style={styles.checkout}>
            <div style={styles.row2}>
              {modules.coiffure && coiffeurs.length > 0 && (
                <select value={coiffeurId} onChange={(e) => setCoiffeurId(e.target.value)} style={styles.input}>
                  <option value="">Coiffeur : aucun</option>
                  {coiffeurs.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              )}
              <select
                value={customerId}
                onChange={(e) => {
                  setCustomerId(e.target.value);
                  setPayOnCredit(false);
                }}
                style={styles.input}
              >
                <option value="">Client : aucun</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}{c.phone ? ` (${c.phone})` : ""}</option>
                ))}
              </select>
            </div>

            {canPayOnCredit && (
              <label style={styles.creditLabel}>
                <input type="checkbox" checked={payOnCredit} onChange={(e) => setPayOnCredit(e.target.checked)} />
                Vendre à crédit — disponible : {fmt(availableCredit)}
              </label>
            )}

            <div style={styles.totals}>
              <div style={styles.totalsLine}>
                <span>Sous-total</span>
                <span>{fmt(subtotal)}</span>
              </div>
              <div style={styles.totalsLine}>
                <span>Remise (DH)</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={discount}
                  onChange={(e) => setDiscount(e.target.value)}
                  placeholder="0"
                  style={styles.discountInput}
                />
              </div>
              {tvaEnabled && (
                <div style={styles.totalsLine}>
                  <span>TVA ({taxRate}%)</span>
                  <span>{fmt(taxAmount)}</span>
                </div>
              )}
              <div style={styles.totalBig}>
                <span>Total{tvaEnabled ? " TTC" : ""}</span>
                <span>{fmt(total)}</span>
              </div>
            </div>

            {!payOnCredit && (
              <div style={styles.methods}>
                {PAYMENT_METHODS.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => setPaymentMethod(m.id)}
                    style={{ ...styles.method, ...(paymentMethod === m.id ? styles.methodActive : {}) }}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            )}

            {isMixed && (
              <div style={styles.mixedBlock}>
                <label style={styles.mixedField}>
                  <span style={styles.smallLabel}>Carte</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={cardPart}
                    onChange={(e) => setCardPart(e.target.value)}
                    placeholder="0"
                    style={styles.mixedInput}
                  />
                </label>
                <label style={styles.mixedField}>
                  <span style={styles.smallLabel}>Mobile</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={mobilePart}
                    onChange={(e) => setMobilePart(e.target.value)}
                    placeholder="0"
                    style={styles.mixedInput}
                  />
                </label>
                <div style={styles.mixedField}>
                  <span style={styles.smallLabel}>Espèces</span>
                  <span style={{ ...styles.mixedCash, color: mixedOver ? "#b91c1c" : INK }}>
                    {mixedOver ? "Trop" : fmt(cashDue)}
                  </span>
                </div>
              </div>
            )}

            {isCash && (
              <div style={styles.cashBlock}>
                <div style={styles.receivedRow}>
                  <div>
                    <div style={styles.smallLabel}>Reçu</div>
                    <div style={styles.receivedValue}>{received === "" ? "—" : `${received} DH`}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={styles.smallLabel}>À rendre</div>
                    <div style={{ ...styles.changeValue, color: insufficientCash ? "#b91c1c" : "#15803d" }}>
                      {hasReceived ? (insufficientCash ? `manque ${fmt(-change)}` : fmt(change)) : "—"}
                    </div>
                  </div>
                </div>
                <div style={styles.quickRow}>
                  <button onClick={() => setReceived(cashDue.toFixed(2))} style={styles.quickBtn} disabled={cashDue === 0}>
                    Exact
                  </button>
                  {QUICK_BILLS.map((b) => (
                    <button key={b} onClick={() => setReceived(String(b))} style={styles.quickBtn}>
                      {b}
                    </button>
                  ))}
                </div>
                <div style={styles.keypad}>
                  {["7", "8", "9", "4", "5", "6", "1", "2", "3", ".", "0", "back"].map((k) => (
                    <button key={k} onClick={() => pressKey(k)} style={styles.key} aria-label={k === "back" ? "Effacer" : k}>
                      {k === "back" ? <Delete size={18} /> : k}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {error && <div style={styles.errorBox}>{error}</div>}

            <button
              onClick={handleCheckout}
              disabled={checkoutDisabled}
              style={{ ...styles.payBtn, opacity: checkoutDisabled ? 0.5 : 1 }}
            >
              {submitting
                ? "Enregistrement…"
                : `${payOnCredit ? "Mettre à crédit" : "Encaisser"} ${fmt(total)}  (F9)`}
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}

const GOLD = "#c9a24b";
const GOLD_DARK = "#a5822f";
const GOLD_GRADIENT = "linear-gradient(135deg, #e0b85c 0%, #c9a24b 100%)";
const BORDER = "#e8e2d8";
const INK = "#1a1410";
const MUTED = "#6b6155";

const styles = {
  page: { position: "fixed", inset: 0, display: "flex", flexDirection: "column", background: "#f7f5f2", color: INK, zIndex: 50 },

  topBar: { display: "flex", alignItems: "center", gap: "12px", padding: "10px 16px", background: "#ffffff", borderBottom: `1px solid ${BORDER}`, flexShrink: 0 },
  backBtn: { display: "flex", alignItems: "center", gap: "6px", padding: "8px 12px", background: "rgba(0,0,0,0.04)", border: `1px solid ${BORDER}`, borderRadius: "10px", color: INK, fontSize: "14px", fontWeight: 600, cursor: "pointer" },
  title: { margin: 0, fontSize: "19px", fontWeight: 800, flex: 1 },
  topRight: { display: "flex", alignItems: "center", gap: "14px", fontSize: "13px", color: MUTED },
  autoPrint: { display: "flex", alignItems: "center", gap: "6px", cursor: "pointer", fontWeight: 600 },
  clock: { display: "flex", alignItems: "center", gap: "6px", fontVariantNumeric: "tabular-nums" },
  userName: { fontWeight: 700, color: INK },
  iconBtn: { display: "flex", alignItems: "center", justifyContent: "center", width: "36px", height: "36px", background: "rgba(0,0,0,0.04)", border: `1px solid ${BORDER}`, borderRadius: "10px", color: INK, cursor: "pointer" },

  body: { flex: 1, display: "flex", minHeight: 0 },

  catalogPane: { flex: 1, display: "flex", flexDirection: "column", minWidth: 0 },
  searchRow: { padding: "14px 16px 0" },
  searchBox: { display: "flex", alignItems: "center", gap: "10px", padding: "0 12px", background: "#ffffff", border: `1px solid #d9d2c4`, borderRadius: "12px" },
  searchInput: { flex: 1, padding: "12px 0", border: "none", outline: "none", background: "transparent", fontSize: "15px", color: INK, fontFamily: "inherit", minWidth: 0 },
  clearSearch: { display: "flex", background: "none", border: "none", color: MUTED, cursor: "pointer", padding: "4px" },
  tabsRow: { display: "flex", gap: "8px", padding: "12px 16px 0", overflowX: "auto", flexShrink: 0 },
  tab: { padding: "9px 16px", borderRadius: "20px", background: "#ffffff", border: `1px solid ${BORDER}`, color: MUTED, fontSize: "13.5px", fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" },
  tabActive: { background: "rgba(201,162,75,0.15)", borderColor: "rgba(201,162,75,0.5)", color: GOLD_DARK },

  grid: { flex: 1, overflowY: "auto", padding: "14px 16px 16px", display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gridAutoRows: "min-content", gap: "10px", alignContent: "start" },
  emptyCatalog: { gridColumn: "1 / -1", textAlign: "center", padding: "60px 20px", color: MUTED, fontSize: "14px" },
  tile: { position: "relative", display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "6px", minHeight: "96px", padding: "14px", background: "#ffffff", border: `1px solid ${BORDER}`, borderRadius: "14px", cursor: "pointer", textAlign: "left", fontFamily: "inherit", color: INK, transition: "border-color 0.15s, transform 0.08s" },
  tileSelected: { borderColor: GOLD, boxShadow: "0 0 0 1px rgba(201,162,75,0.4)" },
  tileDisabled: { opacity: 0.45, cursor: "not-allowed" },
  tileBadge: { position: "absolute", top: "8px", right: "8px", minWidth: "24px", height: "24px", padding: "0 7px", borderRadius: "12px", background: GOLD, color: "#1a1408", fontSize: "12.5px", fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" },
  tileName: { fontSize: "14px", fontWeight: 600, lineHeight: 1.3, paddingRight: "26px" },
  tilePrice: { marginTop: "auto", fontSize: "16px", fontWeight: 800, color: GOLD_DARK },
  tileStock: { fontSize: "11.5px", fontWeight: 600 },

  cartPane: { width: "400px", flexShrink: 0, display: "flex", flexDirection: "column", background: "#ffffff", borderLeft: `1px solid ${BORDER}`, minHeight: 0 },
  cartHeader: { display: "flex", alignItems: "center", gap: "8px", padding: "14px 18px 10px", fontSize: "13px", fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: "0.5px" },
  cartCount: { background: "rgba(201,162,75,0.2)", color: GOLD_DARK, fontSize: "12px", padding: "1px 8px", borderRadius: "10px" },
  clearCart: { marginLeft: "auto", background: "none", border: "none", color: "#b91c1c", fontSize: "12.5px", fontWeight: 700, cursor: "pointer", textTransform: "none", letterSpacing: 0 },
  cartList: { flex: 1, overflowY: "auto", padding: "0 18px", minHeight: "80px" },
  cartEmpty: { padding: "40px 10px", textAlign: "center", color: "#8a8070", fontSize: "13.5px" },
  cartLine: { display: "flex", alignItems: "center", gap: "10px", padding: "10px 0", borderBottom: `1px solid ${BORDER}` },
  cartLineInfo: { flex: 1, minWidth: 0 },
  cartLineName: { fontSize: "13.5px", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  cartLineMeta: { fontSize: "11.5px", color: "#8a8070" },
  qtyGroup: { display: "flex", alignItems: "center", gap: "6px" },
  qtyBtn: { width: "30px", height: "30px", display: "flex", alignItems: "center", justifyContent: "center", background: "#f7f5f2", border: `1px solid #d9d2c4`, borderRadius: "8px", color: INK, cursor: "pointer", padding: 0 },
  qtyValue: { minWidth: "22px", textAlign: "center", fontWeight: 700, fontSize: "14px" },
  cartLineTotal: { minWidth: "78px", textAlign: "right", fontSize: "13.5px", fontWeight: 700, color: GOLD_DARK },
  removeBtn: { display: "flex", background: "none", border: "none", color: "#b0a698", cursor: "pointer", padding: "4px" },

  checkout: { flexShrink: 0, padding: "12px 18px 16px", borderTop: `1px solid ${BORDER}`, overflowY: "auto", maxHeight: "70vh" },
  row2: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "8px", marginBottom: "10px" },
  input: { padding: "9px 10px", background: "#ffffff", border: `1px solid #d9d2c4`, borderRadius: "8px", color: INK, fontSize: "13px", fontFamily: "inherit", minWidth: 0 },
  creditLabel: { display: "flex", alignItems: "center", gap: "8px", fontSize: "12.5px", fontWeight: 600, color: "#b45309", marginBottom: "10px", cursor: "pointer" },
  totals: { marginBottom: "10px" },
  totalsLine: { display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "13px", color: MUTED, padding: "2px 0" },
  discountInput: { width: "90px", padding: "5px 8px", border: `1px solid #d9d2c4`, borderRadius: "6px", fontSize: "13px", textAlign: "right", fontFamily: "inherit", color: INK, background: "#ffffff" },
  totalBig: { display: "flex", justifyContent: "space-between", fontSize: "24px", fontWeight: 800, paddingTop: "6px", marginTop: "4px", borderTop: `1px dashed #d9d2c4` },
  methods: { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "6px", marginBottom: "10px" },
  mixedBlock: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px", marginBottom: "10px" },
  mixedField: { display: "flex", flexDirection: "column", gap: "4px", minWidth: 0 },
  mixedInput: { padding: "8px", border: `1px solid #d9d2c4`, borderRadius: "8px", fontSize: "14px", fontFamily: "inherit", color: INK, background: "#ffffff", minWidth: 0 },
  mixedCash: { padding: "8px 0", fontSize: "15px", fontWeight: 800, fontVariantNumeric: "tabular-nums" },
  registerChip: { padding: "4px 10px", borderRadius: "20px", fontSize: "12px", fontWeight: 700, whiteSpace: "nowrap" },
  registerOpen: { background: "rgba(21,128,61,0.1)", color: "#15803d" },
  registerClosed: { background: "rgba(185,28,28,0.1)", color: "#b91c1c" },
  closedBanner: { padding: "10px 16px", background: "rgba(185,28,28,0.1)", borderBottom: "1px solid rgba(185,28,28,0.3)", color: "#b91c1c", fontSize: "13.5px", fontWeight: 600, flexShrink: 0 },
  method: { padding: "10px", background: "#f7f5f2", border: `1px solid ${BORDER}`, borderRadius: "10px", fontSize: "13.5px", fontWeight: 700, color: MUTED, cursor: "pointer" },
  methodActive: { background: "rgba(201,162,75,0.15)", borderColor: GOLD, color: GOLD_DARK },
  cashBlock: { marginBottom: "10px" },
  receivedRow: { display: "flex", justifyContent: "space-between", marginBottom: "8px" },
  smallLabel: { fontSize: "11.5px", fontWeight: 600, color: MUTED, textTransform: "uppercase", letterSpacing: "0.4px" },
  receivedValue: { fontSize: "18px", fontWeight: 800, fontVariantNumeric: "tabular-nums" },
  changeValue: { fontSize: "18px", fontWeight: 800, fontVariantNumeric: "tabular-nums" },
  quickRow: { display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "6px", marginBottom: "6px" },
  quickBtn: { padding: "9px 0", background: "rgba(21,128,61,0.08)", border: "1px solid rgba(21,128,61,0.25)", borderRadius: "8px", color: "#15803d", fontWeight: 700, fontSize: "13px", cursor: "pointer" },
  keypad: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "6px" },
  key: { padding: "11px 0", display: "flex", alignItems: "center", justifyContent: "center", background: "#f7f5f2", border: `1px solid ${BORDER}`, borderRadius: "8px", fontSize: "17px", fontWeight: 700, color: INK, cursor: "pointer" },
  errorBox: { marginBottom: "10px", padding: "9px 12px", border: "1px solid rgba(239,68,68,0.35)", borderRadius: "9px", background: "rgba(239,68,68,0.1)", color: "#b91c1c", fontSize: "12.5px", fontWeight: 600 },
  payBtn: { width: "100%", padding: "16px", background: GOLD_GRADIENT, border: "none", borderRadius: "12px", color: "#1a1408", fontSize: "17px", fontWeight: 800, cursor: "pointer", boxShadow: "0 4px 14px rgba(201,162,75,0.35)" },
};

if (typeof document !== "undefined" && !document.getElementById("pos-page-styles")) {
  const styleTag = document.createElement("style");
  styleTag.id = "pos-page-styles";
  styleTag.textContent = `
    .pos-page button:not(:disabled):active { transform: scale(0.97); }
    @media (max-width: 860px) {
      .pos-body { flex-direction: column; overflow-y: auto; }
      .pos-catalog { flex: 0 0 auto !important; }
      .pos-catalog > div:last-child { max-height: 45vh; }
      .pos-cart { width: auto !important; border-left: none !important; border-top: 1px solid ${BORDER}; }
      .pos-cart > div:last-child { max-height: none !important; }
      .pos-hide-sm { display: none !important; }
    }
  `;
  document.head.appendChild(styleTag);
}

export default PosPage;
