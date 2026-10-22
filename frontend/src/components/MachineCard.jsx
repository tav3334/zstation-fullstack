import { useEffect, useState } from "react";
import { Gamepad2, Check, Clock, Timer, Play, Square, Plus } from "lucide-react";

function MachineCard({ machine, onStart, onStop, onExtend, games }) {
  const [elapsed, setElapsed] = useState(0);
  const [showExtendModal, setShowExtendModal] = useState(false);
  const [selectedExtendPricing, setSelectedExtendPricing] = useState("");
  const [autoStopTriggered, setAutoStopTriggered] = useState(false);

  useEffect(() => {
    if (machine.status !== "in_session" || !machine.active_session) {
      queueMicrotask(() => {
        setElapsed(0);
        setAutoStopTriggered(false);
      });
      return;
    }

    const startTime = new Date(machine.active_session.start_time).getTime();
    const pricingMode = machine.active_session.pricing_mode || 'fixed';
    const durationMinutes = machine.active_session.duration_minutes;
    const sessionId = machine.active_session.id;

    // Calculate initial elapsed time immediately
    const initialElapsed = Math.floor((Date.now() - startTime) / 1000);
    queueMicrotask(() => setElapsed(initialElapsed));

    const interval = setInterval(() => {
      const now = Date.now();
      const elapsedSeconds = Math.floor((now - startTime) / 1000);
      setElapsed(elapsedSeconds);

      // AUTO-STOP seulement pour le mode "fixed" (par temps)
      if (pricingMode === 'fixed' && durationMinutes) {
        const totalSeconds = durationMinutes * 60;
        const remainingSeconds = totalSeconds - elapsedSeconds;

        // AUTO-STOP quand le temps est écoulé
        if (remainingSeconds <= 0 && !autoStopTriggered) {
          setAutoStopTriggered(true);

          setTimeout(() => {
            onStop(sessionId);
          }, 5000);
        }
      }
      // Pour le mode "per_match", pas d'auto-stop
    }, 1000);

    return () => clearInterval(interval);
  }, [machine.status, machine.active_session, machine.active_session?.id, machine.active_session?.start_time, machine.active_session?.duration_minutes, machine.active_session?.pricing_mode, autoStopTriggered, onStop]);

  const formatTime = (sec) => {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;

    if (h > 0) {
      return `${h}:${m < 10 ? "0" : ""}${m}:${s < 10 ? "0" : ""}${s}`;
    }
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  };

  const getRemainingTime = () => {
    if (!machine.active_session) return 0;
    const pricingMode = machine.active_session.pricing_mode || 'fixed';

    // Pour le mode par match, pas de temps restant
    if (pricingMode === 'per_match') return null;

    const durationMinutes = machine.active_session.duration_minutes || 6;
    const totalSeconds = durationMinutes * 60;
    return Math.max(0, totalSeconds - elapsed);
  };

  const pricingMode = machine.active_session?.pricing_mode || 'fixed';
  const remainingSeconds = getRemainingTime();
  const isExpired = remainingSeconds === 0 && machine.status === "in_session" && pricingMode === 'fixed';
  const isInSession = machine.status === "in_session";
  const isPerMatchMode = pricingMode === 'per_match';

  const handleExtend = () => {
    if (!selectedExtendPricing) {
      alert("Sélectionnez une durée");
      return;
    }
    onExtend(machine.active_session.id, selectedExtendPricing);
    setShowExtendModal(false);
    setSelectedExtendPricing("");
  };

  return (
    <div className="machine-card" style={{
      ...styles.card,
      borderColor: isInSession ? "rgba(245, 158, 11, 0.4)" : "#e8e2d8",
    }}>
      {/* Status Bar */}
      <div style={{
        ...styles.statusBar,
        background: isInSession
          ? "linear-gradient(90deg, #f59e0b 0%, #fbbf24 100%)"
          : "linear-gradient(90deg, #e0b85c 0%, #c9a24b 100%)"
      }} />

      {/* Header */}
      <div style={styles.header}>
        <h3 style={styles.machineName}>{machine.name}</h3>
        <div style={{
          ...styles.statusBadge,
          background: isInSession
            ? "linear-gradient(135deg, #f59e0b 0%, #f97316 100%)"
            : "linear-gradient(135deg, #16a34a 0%, #15803d 100%)"
        }}>
          {isInSession ? <Gamepad2 size={14} /> : <Check size={14} />}
          {isInSession ? "EN SESSION" : "DISPONIBLE"}
        </div>
      </div>

      {isInSession && machine.active_session && (
        <>
          {isPerMatchMode ? (
            <div style={styles.matchPanel}>
              <div style={styles.matchGameName}>
                <Gamepad2 size={22} />
                {machine.active_session.game_name || "N/A"}
              </div>
              <div style={styles.matchModeLabel}>⚽ MODE PAR MATCH</div>
              <div style={styles.matchPrice}>
                Prix: {machine.active_session.price} DH / match
              </div>
              <div style={styles.matchHint}>
                Arrêtez la session pour indiquer le nombre de matchs joués
              </div>
            </div>
          ) : (
            <>
              {/* MODE PAR TEMPS - Chronomètre */}
              <div style={styles.timerPanel}>
                <div style={{
                  ...styles.timerValue,
                  color: isExpired ? "#dc2626" : "#e0b85c",
                }}>
                  {formatTime(elapsed)}
                </div>
                <div style={{
                  ...styles.timerLabel,
                  color: isExpired ? "#dc2626" : "#6b6155",
                }}>
                  {isExpired ? (
                    <><Clock size={15} style={styles.inlineIcon} /> TEMPS ÉCOULÉ !</>
                  ) : (
                    <><Timer size={15} style={styles.inlineIcon} /> Reste: {formatTime(remainingSeconds)}</>
                  )}
                </div>
              </div>

              {/* Game Info - Mode par temps */}
              <div style={styles.gameInfoRow}>
                <Gamepad2 size={22} color="#c9a24b" />
                <div style={{ flex: 1 }}>
                  <div style={styles.gameInfoName}>{machine.active_session.game_name || "N/A"}</div>
                  <div style={styles.gameInfoMeta}>
                    {machine.active_session.duration_minutes} minutes · {machine.active_session.price} DH
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Action Buttons */}
          <div style={{ display: "flex", gap: "8px" }}>
            <button
              onClick={() => onStop(machine.active_session.id)}
              style={{
                ...styles.stopBtn,
                flex: isPerMatchMode ? "none" : 1,
                width: isPerMatchMode ? "100%" : "auto",
              }}
            >
              <Square size={15} />
              Arrêter
            </button>

            {!isPerMatchMode && (
              <button onClick={() => setShowExtendModal(true)} style={styles.extendBtn}>
                <Plus size={15} />
                Prolonger
              </button>
            )}
          </div>
        </>
      )}

      {!isInSession && (
        <button onClick={() => onStart(machine)} style={styles.startBtn}>
          <Play size={17} />
          Démarrer une session
        </button>
      )}

      {/* Modal Prolongation */}
      {showExtendModal && (
        <div className="modal-overlay" style={styles.modalOverlay}>
          <div className="modal-content" style={styles.modalContent}>
            <h3 style={styles.modalTitle}>Prolonger la session</h3>
            <p style={styles.modalSubtitle}>
              {machine.name} · {machine.active_session?.game_name || "N/A"}
            </p>

            <label style={styles.modalLabel}>Choisir la durée</label>
            <select
              value={selectedExtendPricing}
              onChange={(e) => setSelectedExtendPricing(e.target.value)}
              style={styles.modalSelect}
            >
              <option value="">-- Choisir la durée --</option>
              {machine.active_session && games.length > 0 && (() => {
                const currentGame = games.find(g => g.name === machine.active_session.game_name);
                if (currentGame && currentGame.pricings) {
                  return currentGame.pricings.map((pricing) => (
                    <option key={pricing.id} value={pricing.id}>
                      {pricing.duration_minutes} min - {pricing.price} DH
                    </option>
                  ));
                }
                return <option disabled>Aucun tarif disponible</option>;
              })()}
            </select>

            <div style={{ display: "flex", gap: "10px", marginTop: "22px" }}>
              <button onClick={handleExtend} style={styles.modalConfirmBtn}>Confirmer</button>
              <button
                onClick={() => {
                  setShowExtendModal(false);
                  setSelectedExtendPricing("");
                }}
                style={styles.modalCancelBtn}
              >
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  card: {
    background: "#ffffff",
    borderRadius: "16px",
    padding: "22px",
    boxShadow: "0 4px 16px rgba(0, 0, 0, 0.08)",
    transition: "border-color 0.25s ease, transform 0.2s ease",
    position: "relative",
    overflow: "hidden",
    border: "1.5px solid",
  },
  statusBar: { position: "absolute", top: 0, left: 0, right: 0, height: "3px" },
  header: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" },
  machineName: { margin: 0, fontSize: "18px", fontWeight: "700", color: "#1a1410" },
  statusBadge: { display: "inline-flex", alignItems: "center", gap: "6px", padding: "5px 11px", borderRadius: "20px", fontSize: "11.5px", fontWeight: "700", color: "#1a1410", letterSpacing: "0.3px" },

  matchPanel: { background: "linear-gradient(135deg, rgba(22,163,74,0.14) 0%, rgba(21,128,61,0.06) 100%)", border: "1px solid rgba(34,197,94,0.25)", borderRadius: "12px", padding: "22px", marginBottom: "16px", textAlign: "center", color: "#1a1410" },
  matchGameName: { fontSize: "16px", fontWeight: "700", marginBottom: "10px", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" },
  matchModeLabel: { fontSize: "26px", fontWeight: "700", marginBottom: "8px" },
  matchPrice: { fontSize: "14px", opacity: 0.85 },
  matchHint: { fontSize: "12.5px", marginTop: "8px", opacity: 0.6, fontStyle: "italic" },

  timerPanel: { background: "rgba(0,0,0,0.03)", border: "1px solid #e8e2d8", borderRadius: "12px", padding: "18px", marginBottom: "14px", textAlign: "center" },
  timerValue: { fontSize: "42px", fontWeight: "700", lineHeight: "1", marginBottom: "6px", fontFamily: "'Courier New', monospace" },
  timerLabel: { fontSize: "13px", fontWeight: "600" },
  inlineIcon: { display: "inline", verticalAlign: "middle", marginRight: "4px" },

  gameInfoRow: { display: "flex", alignItems: "center", gap: "10px", padding: "12px", background: "rgba(0,0,0,0.03)", border: "1px solid #e8e2d8", borderRadius: "10px", marginBottom: "16px" },
  gameInfoName: { fontSize: "13.5px", fontWeight: "600", color: "#1a1410" },
  gameInfoMeta: { fontSize: "11.5px", color: "#6b6155", marginTop: "2px" },

  startBtn: { width: "100%", padding: "13px 20px", background: "linear-gradient(135deg, #e0b85c 0%, #c9a24b 100%)", color: "#1a1408", border: "none", borderRadius: "10px", cursor: "pointer", fontSize: "14.5px", fontWeight: "700", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", boxShadow: "0 4px 14px rgba(201, 162, 75, 0.3)", transition: "transform 0.15s, box-shadow 0.15s" },
  stopBtn: { padding: "11px 16px", background: "rgba(239,68,68,0.1)", color: "#b91c1c", border: "1px solid rgba(239,68,68,0.3)", borderRadius: "10px", cursor: "pointer", fontSize: "13.5px", fontWeight: "700", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" },
  extendBtn: { flex: 1, padding: "11px 16px", background: "rgba(245,158,11,0.1)", color: "#b45309", border: "1px solid rgba(245,158,11,0.3)", borderRadius: "10px", cursor: "pointer", fontSize: "13.5px", fontWeight: "700", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" },

  modalOverlay: { position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0, 0, 0, 0.75)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: "20px" },
  modalContent: { backgroundColor: "#ffffff", border: "1px solid #e8e2d8", borderRadius: "16px", padding: "28px", width: "400px", maxWidth: "100%", boxShadow: "0 20px 60px rgba(0, 0, 0, 0.25)" },
  modalTitle: { margin: "0 0 6px 0", fontSize: "21px", fontWeight: "700", color: "#1a1410" },
  modalSubtitle: { color: "#6b6155", fontSize: "13.5px", marginBottom: "18px" },
  modalLabel: { display: "block", fontSize: "13px", fontWeight: "600", color: "#3f3a30", marginBottom: "8px" },
  modalSelect: { width: "100%", padding: "11px 13px", fontSize: "14px", border: "1px solid #e8e2d8", borderRadius: "10px", backgroundColor: "#ffffff", color: "#1a1410", cursor: "pointer" },
  modalConfirmBtn: { flex: 1, padding: "11px 18px", background: "linear-gradient(135deg, #e0b85c 0%, #c9a24b 100%)", color: "#1a1408", border: "none", borderRadius: "10px", cursor: "pointer", fontSize: "14px", fontWeight: "700" },
  modalCancelBtn: { flex: 1, padding: "11px 18px", backgroundColor: "rgba(0,0,0,0.04)", color: "#3f3a30", border: "1px solid #e8e2d8", borderRadius: "10px", cursor: "pointer", fontSize: "14px", fontWeight: "600" },
};

// Add responsive styles for MachineCard
const machineCardStyles = document.createElement("style");
machineCardStyles.textContent = `
  .machine-card:hover {
    transform: translateY(-2px);
  }
  .machine-card button:hover {
    filter: brightness(1.08);
  }

  @media (max-width: 768px) {
    .machine-card {
      padding: 18px !important;
    }
    .machine-card h3 {
      font-size: 16px !important;
    }
    .machine-card button {
      font-size: 13px !important;
      padding: 11px 14px !important;
    }
    .modal-content {
      padding: 22px !important;
      margin: 20px !important;
    }
    .modal-content h3 {
      font-size: 19px !important;
    }
  }

  @media (max-width: 480px) {
    .machine-card {
      padding: 15px !important;
    }
    .modal-content {
      padding: 18px !important;
    }
  }
`;

// Only append once
if (!document.getElementById('machine-card-responsive-styles')) {
  machineCardStyles.id = 'machine-card-responsive-styles';
  document.head.appendChild(machineCardStyles);
}

export default MachineCard;
