import { useEffect, useRef, useState } from "react";
import api from "../services/api";

const PAYMENT_LABELS = {
  cash: "Espèces",
  card: "Carte Bancaire",
  mobile: "Mobile",
};

function TicketPrint({ sale, onClose, onNewSale, cashReceived = null, change = null, autoPrint = false }) {
  const [organization, setOrganization] = useState(null);
  const [orgLoaded, setOrgLoaded] = useState(false);
  const printedRef = useRef(false);
  const date = new Date(sale.sale_date);
  const dateStr = date.toLocaleDateString("fr-FR");
  const timeStr = date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });

  useEffect(() => {
    api.get("/organization/settings")
      .then((res) => setOrganization(res.data.organization))
      .catch(() => setOrganization(null))
      .finally(() => setOrgLoaded(true));
  }, []);

  // Impression automatique une fois l'en-tête (organisation) chargé
  useEffect(() => {
    if (!autoPrint || !orgLoaded || printedRef.current) return;
    printedRef.current = true;
    const timer = setTimeout(() => window.print(), 150);
    return () => clearTimeout(timer);
  }, [autoPrint, orgLoaded]);

  const handlePrint = () => window.print();

  const taxAmount = parseFloat(sale.tax_amount || 0);
  const hasTax = taxAmount > 0;

  return (
    <div style={styles.overlay} role="presentation">
      <div style={styles.screenPanel} className="no-print">
        <h2 style={styles.panelTitle}>✓ Vente enregistrée</h2>
        <p style={styles.panelSubtitle}>Ticket {sale.ticket_number}</p>
        <div style={styles.panelActions}>
          <button onClick={handlePrint} style={styles.printBtn}>🖨️ Imprimer le ticket</button>
          <button onClick={onNewSale} style={styles.newSaleBtn}>+ Nouvelle vente</button>
          <button onClick={onClose} style={styles.closeBtn}>Fermer</button>
        </div>
      </div>

      <div id="ticket-print-area" style={styles.ticket}>
        <div style={styles.center}>
          <div style={styles.brand}>{organization?.name || "Tonsor"}</div>
          {organization?.address && <div style={styles.subBrand}>{organization.address}</div>}
          {organization?.phone && <div style={styles.subBrand}>Tél: {organization.phone}</div>}
        </div>

        {(organization?.ice || organization?.rc || organization?.if_number || organization?.patente) && (
          <>
            <div style={styles.divider} />
            <div style={styles.legalBlock}>
              {organization?.ice && <div>ICE: {organization.ice}</div>}
              {organization?.rc && <div>RC: {organization.rc}</div>}
              {organization?.if_number && <div>IF: {organization.if_number}</div>}
              {organization?.patente && <div>Patente: {organization.patente}</div>}
            </div>
          </>
        )}

        <div style={styles.divider} />

        <div style={styles.metaRow}>
          <span>Ticket:</span>
          <span>{sale.ticket_number}</span>
        </div>
        <div style={styles.metaRow}>
          <span>Date:</span>
          <span>{dateStr} {timeStr}</span>
        </div>
        {sale.coiffeur && (
          <div style={styles.metaRow}>
            <span>Coiffeur:</span>
            <span>{sale.coiffeur.name}</span>
          </div>
        )}

        <div style={styles.divider} />

        {sale.services?.length > 0 && (
          <>
            {sale.services.map((item) => (
              <div key={`s-${item.id}`} style={styles.itemRow}>
                <div style={styles.itemLabel}>{item.quantity}x {item.service_name}</div>
                <div style={styles.itemPrice}>{(item.unit_price * item.quantity).toFixed(2)}</div>
              </div>
            ))}
          </>
        )}

        {sale.products?.length > 0 && (
          <>
            {sale.products.map((item) => (
              <div key={`p-${item.id}`} style={styles.itemRow}>
                <div style={styles.itemLabel}>{item.quantity}x {item.product_name}</div>
                <div style={styles.itemPrice}>{(item.unit_price * item.quantity).toFixed(2)}</div>
              </div>
            ))}
          </>
        )}

        <div style={styles.divider} />

        <div style={styles.metaRow}>
          <span>Sous-total:</span>
          <span>{parseFloat(sale.subtotal).toFixed(2)} DH</span>
        </div>
        {parseFloat(sale.discount) > 0 && (
          <div style={styles.metaRow}>
            <span>Remise:</span>
            <span>- {parseFloat(sale.discount).toFixed(2)} DH</span>
          </div>
        )}
        {hasTax && (
          <div style={styles.metaRow}>
            <span>TVA ({parseFloat(sale.tax_rate).toFixed(2)}%):</span>
            <span>{taxAmount.toFixed(2)} DH</span>
          </div>
        )}
        <div style={styles.totalRow}>
          <span>TOTAL {hasTax ? "TTC" : ""}:</span>
          <span>{parseFloat(sale.total).toFixed(2)} DH</span>
        </div>

        <div style={styles.divider} />

        <div style={styles.metaRow}>
          <span>Paiement:</span>
          <span>{PAYMENT_LABELS[sale.payment_method] || sale.payment_method}</span>
        </div>
        {cashReceived !== null && (
          <>
            <div style={styles.metaRow}>
              <span>Reçu:</span>
              <span>{parseFloat(cashReceived).toFixed(2)} DH</span>
            </div>
            <div style={styles.metaRow}>
              <span>Rendu:</span>
              <span>{parseFloat(change || 0).toFixed(2)} DH</span>
            </div>
          </>
        )}

        <div style={styles.divider} />

        <div style={styles.center}>
          <div>Merci de votre visite !</div>
          <div style={styles.footerSmall}>À bientôt chez {organization?.name || "Tonsor"}</div>
        </div>
      </div>

      <style>{`
        @media print {
          body * { visibility: hidden; }
          #ticket-print-area, #ticket-print-area * { visibility: visible; }
          #ticket-print-area {
            position: absolute;
            top: 0;
            left: 0;
            width: 80mm;
            margin: 0;
            padding: 4mm;
          }
          .no-print { display: none !important; }
        }
      `}</style>
    </div>
  );
}

const styles = {
  overlay: { position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.85)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", zIndex: 10000, padding: "20px", gap: "20px", overflowY: "auto" },
  screenPanel: { textAlign: "center" },
  panelTitle: { color: "#ffffff", fontSize: "22px", margin: "0 0 6px" },
  panelSubtitle: { color: "#d4cfc4", fontSize: "14px", margin: "0 0 16px" },
  panelActions: { display: "flex", gap: "10px", justifyContent: "center", flexWrap: "wrap" },
  printBtn: { padding: "12px 20px", background: "linear-gradient(135deg, #e0b85c 0%, #c9a24b 100%)", color: "#1a1408", border: "none", borderRadius: "10px", fontWeight: "700", cursor: "pointer", fontSize: "14px" },
  newSaleBtn: { padding: "12px 20px", background: "rgba(255,255,255,0.12)", color: "#ffffff", border: "1px solid rgba(255,255,255,0.25)", borderRadius: "10px", fontWeight: "600", cursor: "pointer", fontSize: "14px" },
  closeBtn: { padding: "12px 20px", background: "transparent", color: "#d4cfc4", border: "1px solid rgba(255,255,255,0.3)", borderRadius: "10px", fontWeight: "600", cursor: "pointer", fontSize: "14px" },
  ticket: { width: "80mm", maxWidth: "320px", background: "#ffffff", color: "#000000", padding: "16px", fontFamily: "'Courier New', monospace", fontSize: "12px", lineHeight: 1.5, boxShadow: "0 4px 20px rgba(0,0,0,0.4)" },
  center: { textAlign: "center" },
  brand: { fontWeight: "700", fontSize: "15px", letterSpacing: "1px" },
  subBrand: { fontSize: "11px", marginTop: "2px" },
  divider: { borderTop: "1px dashed #000", margin: "8px 0" },
  legalBlock: { fontSize: "10px", textAlign: "center", lineHeight: 1.4 },
  metaRow: { display: "flex", justifyContent: "space-between" },
  itemRow: { display: "flex", justifyContent: "space-between", gap: "8px", marginBottom: "2px" },
  itemLabel: { flex: 1 },
  itemPrice: { whiteSpace: "nowrap" },
  totalRow: { display: "flex", justifyContent: "space-between", fontWeight: "700", fontSize: "14px", marginTop: "4px" },
  footerSmall: { fontSize: "10px", marginTop: "4px" },
};

export default TicketPrint;
