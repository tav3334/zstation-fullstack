function ConfirmModal({ message, onConfirm, onCancel, confirmText = "Confirmer", cancelText = "Annuler" }) {
  return (
    <>
      <style>
        {`
          @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
          }
          @keyframes scaleIn {
            from {
              opacity: 0;
              transform: scale(0.9);
            }
            to {
              opacity: 1;
              transform: scale(1);
            }
          }
        `}
      </style>
      <div style={overlay}>
        <div style={modal}>
          <div style={icon}>⚠️</div>
          <h3 style={title}>Confirmation</h3>
          <p style={messageStyle}>{message}</p>
          <div style={buttonContainer}>
            <button onClick={onConfirm} style={confirmButton}>
              ✓ {confirmText}
            </button>
            <button onClick={onCancel} style={cancelButton}>
              ✕ {cancelText}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

const overlay = {
  position: "fixed",
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: "rgba(0, 0, 0, 0.75)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 10000,
  animation: "fadeIn 0.2s ease-out",
};

const modal = {
  backgroundColor: "white",
  borderRadius: "16px",
  padding: "32px",
  maxWidth: "420px",
  width: "90%",
  boxShadow: "0 20px 60px rgba(0, 0, 0, 0.4)",
  animation: "scaleIn 0.3s ease-out",
  textAlign: "center",
};

const icon = {
  fontSize: "48px",
  marginBottom: "16px",
};

const title = {
  margin: "0 0 16px 0",
  fontSize: "22px",
  fontWeight: "700",
  color: "#1a1a1a",
};

const messageStyle = {
  margin: "0 0 24px 0",
  fontSize: "15px",
  color: "#6b7280",
  lineHeight: "1.6",
};

const buttonContainer = {
  display: "flex",
  gap: "12px",
};

const confirmButton = {
  flex: 1,
  padding: "12px 20px",
  background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
  color: "white",
  border: "none",
  borderRadius: "10px",
  cursor: "pointer",
  fontSize: "15px",
  fontWeight: "600",
  transition: "all 0.2s ease",
  boxShadow: "0 4px 12px rgba(16, 185, 129, 0.3)",
};

const cancelButton = {
  flex: 1,
  padding: "12px 20px",
  backgroundColor: "#f3f4f6",
  color: "#374151",
  border: "none",
  borderRadius: "10px",
  cursor: "pointer",
  fontSize: "15px",
  fontWeight: "600",
  transition: "all 0.2s ease",
};

export default ConfirmModal;
