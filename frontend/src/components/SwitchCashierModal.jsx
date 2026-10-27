import { useEffect, useState } from "react";
import { Delete, X } from "lucide-react";
import api from "../services/api";
import { switchSession } from "../utils/session";

// Changement rapide de caissier sur un poste partagé : choix du membre + code PIN.
function SwitchCashierModal({ currentUserId, onClose }) {
  const [cashiers, setCashiers] = useState(null);
  const [selected, setSelected] = useState(null);
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api
      .get("/team/cashiers")
      .then((res) => setCashiers((res.data.cashiers || []).filter((c) => c.id !== currentUserId)))
      .catch((e) => setError(e.response?.data?.message || e.message));
  }, [currentUserId]);

  const submit = async (code = pin) => {
    if (!selected || code.length < 4 || submitting) return;
    setSubmitting(true);
    setError("");
    try {
      const res = await api.post("/pin-login", { user_id: selected.id, pin: code });
      switchSession(res.data, { reopenPos: true });
    } catch (e) {
      setError(e.response?.status === 429 ? "Trop d'essais. Patientez une minute." : e.response?.data?.message || e.message);
      setPin("");
      setSubmitting(false);
    }
  };

  const press = (k) => {
    setError("");
    if (k === "back") setPin((p) => p.slice(0, -1));
    else if (k === "ok") submit();
    else setPin((p) => (p.length < 6 ? p + k : p));
  };

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
      else if (!selected) return;
      else if (/^\d$/.test(e.key)) press(e.key);
      else if (e.key === "Backspace") press("back");
      else if (e.key === "Enter") press("ok");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <div style={styles.overlay} onClick={onClose} role="presentation">
      <div style={styles.modal} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Changer de caissier">
        <div style={styles.header}>
          <h2 style={styles.title}>{selected ? `Code PIN de ${selected.name}` : "Qui prend la caisse ?"}</h2>
          <button onClick={onClose} style={styles.close} aria-label="Fermer">
            <X size={18} />
          </button>
        </div>

        {!selected ? (
          <div style={styles.list}>
            {!cashiers && !error && <div style={styles.muted}>Chargement…</div>}
            {cashiers?.length === 0 && (
              <div style={styles.muted}>
                Aucun autre membre n'a de code PIN. Chacun peut le définir dans « Mon Profil », ou l'admin dans « Mon Équipe ».
              </div>
            )}
            {cashiers?.map((c) => (
              <button key={c.id} onClick={() => setSelected(c)} style={styles.person}>
                <span style={styles.avatar}>{c.name.charAt(0).toUpperCase()}</span>
                <span style={styles.personName}>{c.name}</span>
                <span style={styles.personRole}>{c.role === "admin" ? "Admin" : "Agent"}</span>
              </button>
            ))}
          </div>
        ) : (
          <div style={styles.pinArea}>
            <div style={styles.dots} aria-label={`${pin.length} chiffres saisis`}>
              {Array.from({ length: Math.max(4, pin.length) }).map((_, i) => (
                <span key={i} style={{ ...styles.dot, ...(i < pin.length ? styles.dotFilled : {}) }} />
              ))}
            </div>
            <div style={styles.keypad}>
              {["1", "2", "3", "4", "5", "6", "7", "8", "9", "back", "0", "ok"].map((k) => (
                <button
                  key={k}
                  onClick={() => press(k)}
                  disabled={submitting || (k === "ok" && pin.length < 4)}
                  style={{ ...styles.key, ...(k === "ok" ? styles.keyOk : {}) }}
                  aria-label={k === "back" ? "Effacer" : k === "ok" ? "Valider" : k}
                >
                  {k === "back" ? <Delete size={20} /> : k === "ok" ? "OK" : k}
                </button>
              ))}
            </div>
            <button onClick={() => { setSelected(null); setPin(""); setError(""); }} style={styles.link}>
              ← Choisir une autre personne
            </button>
          </div>
        )}

        {error && <div style={styles.error}>{error}</div>}
      </div>
    </div>
  );
}

const styles = {
  overlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 9500, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" },
  modal: { width: "100%", maxWidth: "380px", background: "#ffffff", borderRadius: "20px", padding: "18px 20px 22px", boxShadow: "0 24px 60px rgba(0,0,0,0.3)" },
  header: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px", marginBottom: "14px" },
  title: { margin: 0, fontSize: "18px", fontWeight: 800, color: "#1a1410" },
  close: { display: "flex", alignItems: "center", justifyContent: "center", width: "34px", height: "34px", borderRadius: "50%", border: "1px solid #e8e2d8", background: "rgba(0,0,0,0.04)", cursor: "pointer", color: "#1a1410", flexShrink: 0 },
  list: { display: "flex", flexDirection: "column", gap: "8px", maxHeight: "55vh", overflowY: "auto" },
  person: { display: "flex", alignItems: "center", gap: "12px", padding: "12px", border: "1px solid #e8e2d8", borderRadius: "12px", background: "#f9f7f3", cursor: "pointer", textAlign: "left", fontFamily: "inherit" },
  avatar: { width: "38px", height: "38px", borderRadius: "50%", background: "linear-gradient(135deg, #e0b85c 0%, #c9a24b 100%)", color: "#1a1408", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, flexShrink: 0 },
  personName: { flex: 1, fontSize: "15px", fontWeight: 700, color: "#1a1410" },
  personRole: { fontSize: "12px", color: "#8a8070", fontWeight: 600 },
  pinArea: { display: "flex", flexDirection: "column", alignItems: "center", gap: "16px" },
  dots: { display: "flex", gap: "12px", padding: "6px 0" },
  dot: { width: "14px", height: "14px", borderRadius: "50%", border: "2px solid #c9a24b" },
  dotFilled: { background: "#c9a24b" },
  keypad: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "8px", width: "100%" },
  key: { padding: "16px 0", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "20px", fontWeight: 700, background: "#f7f5f2", border: "1px solid #e8e2d8", borderRadius: "12px", cursor: "pointer", color: "#1a1410" },
  keyOk: { background: "linear-gradient(135deg, #e0b85c 0%, #c9a24b 100%)", border: "none", color: "#1a1408", fontSize: "16px" },
  link: { background: "none", border: "none", color: "#6b6155", fontSize: "13px", cursor: "pointer", fontWeight: 600 },
  muted: { color: "#6b6155", fontSize: "13.5px", lineHeight: 1.5, padding: "6px 2px" },
  error: { marginTop: "12px", padding: "9px 12px", borderRadius: "9px", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.35)", color: "#b91c1c", fontSize: "13px", fontWeight: 600, textAlign: "center" },
};

export default SwitchCashierModal;
