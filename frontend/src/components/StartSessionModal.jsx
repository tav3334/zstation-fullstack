function StartSessionModal({
  machine,
  games,
  selectedGame,
  setSelectedGame,
  selectedPricing,
  setSelectedPricing,
  onConfirm,
  onClose,
}) {
  const selectedGameData = games.find((game) => game.id === Number(selectedGame));
  const availablePricings = selectedGameData?.pricings || [];


  return (
    <div className="session-modal-overlay" style={overlay}>
      <div className="session-modal-content" style={modal}>
        <h3 style={{ margin: "0 0 16px 0", fontSize: "20px", fontWeight: "700", color: "#1a1410", textAlign: "center" }}>
          🎮 {machine.name}
        </h3>

        {/* Ligne avec 2 colonnes */}
        <div style={{ display: "flex", gap: "12px", marginBottom: 16 }}>
          {/* Colonne 1: Sélection du jeu */}
          <div style={{ flex: 1 }}>
            <label style={{ display: "block", fontSize: "14px", fontWeight: "600", color: "#3f3a30", marginBottom: "8px" }}>
              Jeu
            </label>
            <select
              value={selectedGame}
              onChange={(e) => {
                setSelectedGame(e.target.value);
                setSelectedPricing("");
              }}
              style={{
                width: "100%",
                padding: "10px 12px",
                fontSize: "14px",
                border: "1px solid #e8e2d8",
                borderRadius: "8px",
                backgroundColor: "#ffffff",
                color: "#1a1410",
                cursor: "pointer"
              }}
            >
              <option value="" style={optionStyle}>-- Choisir --</option>
              {games.map((g) => (
                <option key={g.id} value={g.id} style={optionStyle}>
                  {g.name}
                </option>
              ))}
            </select>
          </div>

          {/* Colonne 2: Nombre de tarifs disponibles (info) */}
          <div style={{ flex: 1 }}>
            <label style={{ display: "block", fontSize: "14px", fontWeight: "600", color: "#3f3a30", marginBottom: "8px" }}>
              Modes disponibles
            </label>
            <div style={{
              padding: "10px 12px",
              fontSize: "14px",
              border: "1px solid rgba(34,197,94,0.3)",
              borderRadius: "8px",
              backgroundColor: "rgba(34,197,94,0.12)",
              textAlign: "center",
              fontWeight: "600",
              color: "#86efac"
            }}>
              {selectedGame && availablePricings.length > 0
                ? `${availablePricings.length} mode(s)`
                : "Choisir un jeu"}
            </div>
          </div>
        </div>

        {/* Section modes de tarification */}
        {selectedGame && availablePricings.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", fontSize: "13px", fontWeight: "600", color: "#3f3a30", marginBottom: "8px" }}>
              Mode de facturation
            </label>

            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              {availablePricings.map((pricing) => {
                const mode = pricing.pricing_mode?.code || 'fixed';
                const isSelected = selectedPricing === String(pricing.id);
                const isPerMatch = mode === 'per_match';

                return (
                  <div
                    key={pricing.id}
                    onClick={() => setSelectedPricing(String(pricing.id))}
                    style={{
                      padding: "10px 12px",
                      borderRadius: "8px",
                      border: isSelected ? `1.5px solid ${isPerMatch ? '#4ade80' : '#60a5fa'}` : "1px solid #e8e2d8",
                      backgroundColor: isSelected
                        ? (isPerMatch ? 'rgba(34,197,94,0.12)' : 'rgba(59,130,246,0.12)')
                        : '#f7f5f2',
                      cursor: "pointer",
                      transition: "all 0.2s ease"
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <div style={{ flex: 1 }}>
                        <div style={{
                          fontSize: "14px",
                          fontWeight: "700",
                          color: isPerMatch ? '#86efac' : '#93c5fd',
                          marginBottom: "2px"
                        }}>
                          {isPerMatch ? '⚽ Par Match' : '⏱️ Par Temps'}
                        </div>
                        <div style={{ fontSize: "12px", color: "#6b6155" }}>
                          {isPerMatch
                            ? `${pricing.matches_count} match × ${pricing.price} DH`
                            : `${pricing.duration_minutes} min = ${pricing.price} DH`
                          }
                        </div>
                        {pricing.description && (
                          <div style={{ fontSize: "12px", color: "#c9a24b", fontWeight: "600", marginTop: "4px" }}>
                            {pricing.description}
                          </div>
                        )}
                      </div>
                      {isSelected && (
                        <div style={{
                          width: "20px",
                          height: "20px",
                          borderRadius: "50%",
                          backgroundColor: isPerMatch ? '#16a34a' : '#2563eb',
                          color: "#ffffff", /* text on solid status-color badge, keep white */
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: "11px",
                          fontWeight: "700"
                        }}>
                          ✓
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {!selectedGame && (
          <div style={{
            padding: "12px",
            backgroundColor: "rgba(245,158,11,0.12)",
            borderRadius: "8px",
            border: "1px solid rgba(245,158,11,0.35)",
            textAlign: "center",
            color: "#fcd34d",
            fontSize: "13px",
            marginBottom: 16
          }}>
            ⚠️ Sélectionnez un jeu pour voir les modes
          </div>
        )}

        <div style={{ display: "flex", gap: "10px", marginTop: "16px" }}>
          <button
            onClick={onConfirm}
            disabled={!selectedGame || !selectedPricing}
            style={{
              flex: 1,
              padding: "10px 16px",
              background: !selectedGame || !selectedPricing
                ? "rgba(0,0,0,0.06)"
                : "linear-gradient(135deg, #e0b85c 0%, #c9a24b 100%)",
              color: !selectedGame || !selectedPricing ? "#8a8070" : "#1a1408",
              border: "none",
              borderRadius: "8px",
              cursor: !selectedGame || !selectedPricing ? "not-allowed" : "pointer",
              fontSize: "14px",
              fontWeight: "700",
              transition: "all 0.2s ease",
              boxShadow: !selectedGame || !selectedPricing ? "none" : "0 4px 12px rgba(201, 162, 75, 0.3)"
            }}
          >
            <span>✓</span> Confirmer
          </button>
          <button
            onClick={onClose}
            style={{
              flex: 1,
              padding: "10px 16px",
              backgroundColor: "rgba(0,0,0,0.04)",
              color: "#3f3a30",
              border: "1px solid #e8e2d8",
              borderRadius: "8px",
              cursor: "pointer",
              fontSize: "14px",
              fontWeight: "600",
              transition: "all 0.2s ease"
            }}
          >
            <span>✕</span> Annuler
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
  width: "100%",
  height: "100%",
  background: "rgba(0,0,0,0.75)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 1000,
};

const modal = {
  background: "#ffffff",
  border: "1px solid #e8e2d8",
  padding: "20px",
  width: "480px",
  maxWidth: "90%",
  maxHeight: "85vh",
  overflowY: "auto",
  borderRadius: "12px",
  boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
  color: "#1a1410",
};

const optionStyle = {
  backgroundColor: "#ffffff",
  color: "#1a1410",
};

export default StartSessionModal;
