import { AlertTriangle } from "lucide-react";

function ConfirmDialog({ message, confirmLabel = "Confirmer", cancelLabel = "Annuler", danger = true, onConfirm, onCancel }) {
  return (
    <div style={styles.overlay} onClick={onCancel}>
      <div style={styles.dialog} onClick={(e) => e.stopPropagation()}>
        <div style={{ ...styles.iconBox, background: danger ? "rgba(239,68,68,0.1)" : "rgba(201,162,75,0.1)" }}>
          <AlertTriangle size={26} color={danger ? "#dc2626" : "#c9a24b"} />
        </div>
        <p style={styles.message}>{message}</p>
        <div style={styles.actions}>
          <button style={styles.cancelBtn} onClick={onCancel}>{cancelLabel}</button>
          <button
            style={{ ...styles.confirmBtn, background: danger ? "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)" : "linear-gradient(135deg, #e0b85c 0%, #c9a24b 100%)" }}
            onClick={onConfirm}
            autoFocus
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

const styles = {
  overlay: {
    position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)",
    display: "flex", alignItems: "center", justifyContent: "center", zIndex: 10500, padding: "20px",
  },
  dialog: {
    background: "#ffffff", borderRadius: "16px", padding: "28px", width: "100%", maxWidth: "380px",
    boxShadow: "0 20px 60px rgba(0,0,0,0.3)", textAlign: "center",
  },
  iconBox: {
    width: "56px", height: "56px", borderRadius: "50%", display: "flex", alignItems: "center",
    justifyContent: "center", margin: "0 auto 18px",
  },
  message: { fontSize: "15px", color: "#1a1410", lineHeight: 1.6, margin: "0 0 24px", fontWeight: "500" },
  actions: { display: "flex", gap: "12px" },
  cancelBtn: {
    flex: 1, padding: "12px", background: "rgba(0,0,0,0.04)", border: "1px solid #e8e2d8",
    borderRadius: "10px", color: "#6b6155", fontSize: "14px", fontWeight: "600", cursor: "pointer",
  },
  confirmBtn: {
    flex: 1, padding: "12px", border: "none", borderRadius: "10px", color: "#fff",
    fontSize: "14px", fontWeight: "700", cursor: "pointer",
  },
};

export default ConfirmDialog;
