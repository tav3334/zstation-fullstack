import { useEffect, useState } from "react";

function PaymentModal({ session, onConfirm, onClose, zIndex = 2000 }) {
  const [amountGiven, setAmountGiven] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [formError, setFormError] = useState("");

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "Escape" && !isProcessing) {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isProcessing, onClose]);

  if (!session) {
    return null;
  }

  const sessionData = session.session || {};
  const price = parseFloat(session.price) || 0;
  const amount = parseFloat(amountGiven);
  const hasValidAmount = Number.isFinite(amount);
  const isValid = hasValidAmount && amount >= price;
  const change = hasValidAmount ? (amount - price).toFixed(2) : "0.00";
  const quickAmounts = [10, 20, 50, 100, 200];

  const handleConfirm = async () => {
    if (!isValid) {
      setFormError("Montant insuffisant.");
      return;
    }

    if (!sessionData?.id) {
      setFormError("Erreur: identifiant de session manquant.");
      return;
    }

    setFormError("");
    setIsProcessing(true);
    try {
      await onConfirm(sessionData.id, amount);
    } catch (error) {
      setFormError(error?.message || "Erreur lors du paiement.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleOverlayClick = (event) => {
    if (event.target === event.currentTarget && !isProcessing) {
      onClose();
    }
  };

  const getDurationConsumed = () => {
    if (!session.duration_used) return "N/A";
    return session.duration_used;
  };

  return (
    <div
      className="payment-modal-overlay"
      style={{ ...overlay, zIndex }}
      onClick={handleOverlayClick}
      role="presentation"
    >
      <div
        className="payment-modal-content"
        style={modal}
        role="dialog"
        aria-modal="true"
        aria-label="Paiement de session"
      >
        <h2 style={modalTitle}>Paiement</h2>

        <div style={infoBox}>
          <div style={infoRow}>
            <span style={infoLabel}>Machine:</span>
            <strong style={infoValue}>{sessionData?.machine?.name || "N/A"}</strong>
          </div>
          <div style={infoRow}>
            <span style={infoLabel}>Jeu:</span>
            <strong style={infoValue}>{sessionData?.game?.name || "N/A"}</strong>
          </div>
          <div style={infoRow}>
            <span style={infoLabel}>Duree:</span>
            <strong style={infoValue}>{getDurationConsumed()}</strong>
          </div>
        </div>

        <div style={priceBox}>
          <span style={{ fontSize: "13px", color: "#15803d" }}>Montant a payer</span>
          <div style={{ fontSize: "28px", fontWeight: "bold", color: "#16a34a" }}>
            {price.toFixed(2)} DH
          </div>
        </div>

        <div style={{ marginBottom: "12px" }}>
          <label style={labelStyle}>Montant donne par le client:</label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={amountGiven}
            onChange={(event) => {
              setAmountGiven(event.target.value);
              if (formError) setFormError("");
            }}
            placeholder="Entrez le montant"
            style={inputStyle}
            autoFocus
            aria-invalid={!!formError}
          />
        </div>

        <div style={{ marginBottom: "12px" }}>
          <label style={labelSmall}>Montants rapides:</label>
          <div className="payment-quick-grid" style={quickAmountsGrid}>
            {quickAmounts.map((quickAmount) => (
              <button
                key={quickAmount}
                onClick={() => {
                  setAmountGiven(quickAmount.toString());
                  if (formError) setFormError("");
                }}
                className="payment-quick-button"
                style={quickButton}
                type="button"
              >
                {quickAmount} DH
              </button>
            ))}
          </div>
        </div>

        {amountGiven && (
          <div
            style={{
              ...changeBox,
              backgroundColor: isValid ? "rgba(34,197,94,0.12)" : "rgba(239,68,68,0.12)",
              border: isValid ? "1px solid rgba(34,197,94,0.3)" : "1px solid rgba(239,68,68,0.3)",
            }}
          >
            <span style={{ fontSize: 13, color: "#3f3a30" }}>Monnaie a rendre:</span>
            <div
              style={{
                fontSize: 24,
                fontWeight: "bold",
                color: isValid ? "#16a34a" : "#dc2626",
              }}
            >
              {parseFloat(change) >= 0 ? change : "0.00"} DH
            </div>
            {!isValid && (
              <div style={{ fontSize: 11, color: "#dc2626", marginTop: 4 }}>
                Manque: {Math.abs(parseFloat(change)).toFixed(2)} DH
              </div>
            )}
          </div>
        )}

        {formError && (
          <div style={errorBox} role="alert">
            {formError}
          </div>
        )}

        <div style={actions}>
          <button
            onClick={onClose}
            disabled={isProcessing}
            style={{
              ...button,
              backgroundColor: "rgba(0,0,0,0.04)",
              color: "#3f3a30",
              border: "1px solid #e8e2d8",
            }}
            type="button"
          >
            Fermer
          </button>
          <button
            onClick={handleConfirm}
            disabled={!isValid || isProcessing}
            style={{
              ...button,
              background: isValid ? "linear-gradient(135deg, #e0b85c 0%, #c9a24b 100%)" : "rgba(0,0,0,0.06)",
              color: isValid ? "#1a1408" : "#8a8070",
              cursor: isValid && !isProcessing ? "pointer" : "not-allowed",
            }}
            type="button"
          >
            {isProcessing ? "Traitement..." : "Confirmer"}
          </button>
        </div>
      </div>
    </div>
  );
}

const overlay = {
  position: "fixed",
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: "rgba(0,0,0,0.8)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 2000,
  padding: "16px",
};

const modal = {
  backgroundColor: "#ffffff",
  border: "1px solid #e8e2d8",
  padding: "20px",
  borderRadius: "12px",
  width: "100%",
  maxWidth: "380px",
  boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
  maxHeight: "85vh",
  overflowY: "auto",
};

const modalTitle = {
  marginTop: 0,
  marginBottom: "16px",
  color: "#1a1410",
  fontSize: "20px",
  fontWeight: "700",
};

const infoBox = {
  backgroundColor: "#f7f5f2",
  padding: "10px",
  borderRadius: "8px",
  marginBottom: "12px",
  border: "1px solid #e8e2d8",
};

const infoRow = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "6px 0",
  fontSize: "13px",
};

const infoLabel = {
  color: "#6b6155",
  fontWeight: "500",
};

const infoValue = {
  color: "#1a1410",
  fontSize: "13px",
};

const priceBox = {
  textAlign: "center",
  backgroundColor: "rgba(34,197,94,0.1)",
  padding: "12px",
  borderRadius: "8px",
  marginBottom: "12px",
  border: "1.5px solid rgba(34,197,94,0.35)",
};

const labelStyle = {
  display: "block",
  marginBottom: "8px",
  fontWeight: "600",
  fontSize: "13px",
  color: "#3f3a30",
};

const labelSmall = {
  display: "block",
  marginBottom: "8px",
  fontSize: "12px",
  color: "#6b6155",
  fontWeight: "500",
};

const inputStyle = {
  width: "100%",
  padding: "10px",
  fontSize: "18px",
  textAlign: "center",
  border: "1.5px solid rgba(34,197,94,0.4)",
  borderRadius: "8px",
  backgroundColor: "#f7f5f2",
  color: "#1a1410",
  fontWeight: "bold",
  boxSizing: "border-box",
};

const quickAmountsGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(80px, 1fr))",
  gap: "8px",
};

const quickButton = {
  padding: "8px 12px",
  backgroundColor: "#f7f5f2",
  color: "#1a1410",
  border: "1px solid #e8e2d8",
  borderRadius: "8px",
  cursor: "pointer",
  fontSize: "12px",
  fontWeight: "600",
  transition: "all 0.2s ease",
  whiteSpace: "nowrap",
};

const changeBox = {
  textAlign: "center",
  padding: "10px",
  borderRadius: "8px",
  marginTop: "10px",
};

const errorBox = {
  marginTop: "12px",
  padding: "10px 12px",
  borderRadius: "8px",
  border: "1px solid rgba(239,68,68,0.35)",
  backgroundColor: "rgba(239,68,68,0.1)",
  color: "#b91c1c",
  fontSize: "13px",
  fontWeight: "600",
};

const actions = {
  display: "flex",
  gap: 10,
  marginTop: 16,
};

const button = {
  width: "100%",
  padding: "10px 16px",
  color: "#1a1410",
  border: "none",
  borderRadius: "8px",
  cursor: "pointer",
  fontSize: "14px",
  fontWeight: "600",
  transition: "all 0.2s ease",
};

export default PaymentModal;
