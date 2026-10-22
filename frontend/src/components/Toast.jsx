import { useEffect } from "react";

function Toast({ message, type = "info", onClose, duration = 3000 }) {
  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(onClose, duration);
      return () => clearTimeout(timer);
    }
  }, [duration, onClose]);

  const getStyles = () => {
    const baseStyle = {
      position: "fixed",
      top: "24px",
      right: "24px",
      minWidth: "320px",
      maxWidth: "500px",
      padding: "16px 20px",
      borderRadius: "12px",
      boxShadow: "0 8px 32px rgba(0, 0, 0, 0.3)",
      zIndex: 9999,
      display: "flex",
      alignItems: "center",
      gap: "12px",
      fontSize: "15px",
      fontWeight: "500",
      animation: "slideIn 0.3s ease-out",
      backdropFilter: "blur(10px)",
    };

    const types = {
      success: {
        background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
        color: "white",
        icon: "✅",
      },
      error: {
        background: "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)",
        color: "white",
        icon: "❌",
      },
      warning: {
        background: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
        color: "white",
        icon: "⚠️",
      },
      info: {
        background: "linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)",
        color: "white",
        icon: "ℹ️",
      },
    };

    return { ...baseStyle, ...types[type] };
  };

  const styles = getStyles();

  return (
    <>
      <style>
        {`
          @keyframes slideIn {
            from {
              transform: translateX(400px);
              opacity: 0;
            }
            to {
              transform: translateX(0);
              opacity: 1;
            }
          }
          @keyframes fadeIn {
            from {
              opacity: 0;
            }
            to {
              opacity: 1;
            }
          }
        `}
      </style>
      <div style={styles}>
        <span style={{ fontSize: "20px" }}>{styles.icon}</span>
        <span style={{ flex: 1 }}>{message}</span>
        <button
          onClick={onClose}
          style={{
            background: "rgba(255, 255, 255, 0.2)",
            border: "none",
            color: "white",
            width: "24px",
            height: "24px",
            borderRadius: "50%",
            cursor: "pointer",
            fontSize: "14px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transition: "all 0.2s ease",
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.background = "rgba(255, 255, 255, 0.3)";
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.background = "rgba(255, 255, 255, 0.2)";
          }}
        >
          ×
        </button>
      </div>
    </>
  );
}

export default Toast;
