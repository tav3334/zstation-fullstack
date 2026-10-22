import { useState, useEffect } from "react";
import { User, Lock, Eye, EyeOff, Save, X, Gamepad2, Wallet, Edit2 } from "lucide-react";
import api from "../services/api";
import useSanitize from "../hooks/useSanitize";
import CashRegister from "./CashRegister";

function UserProfile({ user, onClose, showToast, onUserUpdated }) {
  const { sanitize } = useSanitize();
  const [activeSessions, setActiveSessions] = useState(0);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("profile"); // "profile" or "cash"

  // Édition nom/email
  const [editingInfo, setEditingInfo] = useState(false);
  const [editName, setEditName] = useState(user.name);
  const [editEmail, setEditEmail] = useState(user.email);
  const [editPassword, setEditPassword] = useState("");
  const [showEditPassword, setShowEditPassword] = useState(false);
  const [editError, setEditError] = useState("");
  const [editLoading, setEditLoading] = useState(false);

  const isAdmin = user.role === 'admin';
  const isSuperAdmin = user.role === 'super_admin';
  const ROLE_LABELS = { admin: 'Administrateur', agent: 'Agent', super_admin: 'Super Administrateur' };

  // Load active sessions count for agent
  useEffect(() => {
    const loadActiveSessions = async () => {
      try {
        const res = await api.get("/machines");
        const activeCount = res.data.filter(m => m.status === 'in_session').length;
        setActiveSessions(activeCount);
      } catch {
        // Silent fail - not critical
        return;
      }
    };

    if (user.role === 'agent') {
      loadActiveSessions();
      // Refresh every 10 seconds
      const interval = setInterval(loadActiveSessions, 10000);
      return () => clearInterval(interval);
    }
  }, [user.role]);

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setError("");

    // Validation
    if (!currentPassword || !newPassword || !confirmPassword) {
      setError("Tous les champs sont obligatoires");
      return;
    }

    if (newPassword.length < 6) {
      setError("Le nouveau mot de passe doit contenir au moins 6 caractères");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Les mots de passe ne correspondent pas");
      return;
    }

    setLoading(true);

    try {
      await api.post("/change-password", {
        current_password: currentPassword,
        new_password: newPassword,
        new_password_confirmation: confirmPassword
      });

      showToast("Mot de passe modifié avec succès", "success");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setTimeout(() => onClose(), 1500);
    } catch (err) {
      const errorMessage = err.response?.data?.message || err.response?.data?.error || "Erreur lors du changement de mot de passe";
      setError(errorMessage);
      showToast(errorMessage, "error");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setEditError("");

    if (!editName.trim() || !editEmail.trim() || !editPassword) {
      setEditError("Tous les champs sont obligatoires");
      return;
    }

    setEditLoading(true);

    try {
      const res = await api.put("/profile", {
        name: editName.trim(),
        email: editEmail.trim(),
        password: editPassword,
      });

      const updatedUser = res.data.user;
      const storedUser = JSON.parse(localStorage.getItem("user") || "{}");
      localStorage.setItem("user", JSON.stringify({ ...storedUser, ...updatedUser }));

      showToast("Profil mis à jour avec succès", "success");
      setEditPassword("");
      setEditingInfo(false);
      onUserUpdated?.(updatedUser);
    } catch (err) {
      const errorMessage = err.response?.data?.message || err.response?.data?.errors?.email?.[0] || "Erreur lors de la mise à jour du profil";
      setEditError(errorMessage);
      showToast(errorMessage, "error");
    } finally {
      setEditLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content profile-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-header-content">
            <User size={24} className="modal-icon" />
            <h2>Mon Profil</h2>
          </div>
          <button className="close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {/* Tabs */}
        {!isSuperAdmin && (
          <div className="profile-tabs">
            <button
              className={`tab-btn ${activeTab === 'profile' ? 'active' : ''}`}
              onClick={() => setActiveTab('profile')}
            >
              <User size={16} />
              Profil
            </button>
            <button
              className={`tab-btn ${activeTab === 'cash' ? 'active' : ''}`}
              onClick={() => setActiveTab('cash')}
            >
              <Wallet size={16} />
              Caisse
            </button>
          </div>
        )}

        {activeTab === 'profile' ? (
          <>
            {!editingInfo ? (
              <div className="profile-info">
                <div className="info-row">
                  <span className="info-label">Nom:</span>
                  <span className="info-value">{sanitize(user.name)}</span>
                </div>
                <div className="info-row">
                  <span className="info-label">Email:</span>
                  <span className="info-value">{sanitize(user.email)}</span>
                </div>
                <div className="info-row">
                  <span className="info-label">Role:</span>
                  <span className={`role-badge ${sanitize(user.role)}`}>
                    {ROLE_LABELS[user.role] || user.role}
                  </span>
                </div>
                {user.role === 'agent' && (
                  <div className="info-row">
                    <span className="info-label">
                      <Gamepad2 size={16} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '4px' }} />
                      Sessions actives:
                    </span>
                    <span className="info-value" style={{ fontSize: '18px', fontWeight: '700', color: '#f59e0b' }}>
                      {activeSessions}
                    </span>
                  </div>
                )}
                <button
                  type="button"
                  className="edit-info-btn"
                  onClick={() => {
                    setEditName(user.name);
                    setEditEmail(user.email);
                    setEditPassword("");
                    setEditError("");
                    setEditingInfo(true);
                  }}
                >
                  <Edit2 size={14} />
                  Modifier nom / email
                </button>
              </div>
            ) : (
              <form onSubmit={handleUpdateProfile} className="edit-info-form">
                {editError && <div className="error-message">{editError}</div>}

                <div className="form-group">
                  <label htmlFor="edit-name">Nom</label>
                  <input
                    id="edit-name"
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="edit-email">Email</label>
                  <input
                    id="edit-email"
                    type="email"
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="edit-password">Mot de passe (pour confirmer)</label>
                  <div className="password-input-wrapper">
                    <input
                      id="edit-password"
                      type={showEditPassword ? "text" : "password"}
                      value={editPassword}
                      onChange={(e) => setEditPassword(e.target.value)}
                      placeholder="Votre mot de passe actuel"
                      required
                    />
                    <button
                      type="button"
                      className="toggle-password"
                      onClick={() => setShowEditPassword(!showEditPassword)}
                    >
                      {showEditPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                <div className="form-actions">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setEditingInfo(false)}
                    disabled={editLoading}
                  >
                    Annuler
                  </button>
                  <button type="submit" className="btn btn-primary" disabled={editLoading}>
                    <Save size={18} />
                    {editLoading ? "Enregistrement..." : "Enregistrer"}
                  </button>
                </div>
              </form>
            )}

            <div className="divider"></div>

            <form onSubmit={handleChangePassword} className="password-form">
          <h3>
            <Lock size={20} />
            Changer le mot de passe
          </h3>

          {error && <div className="error-message">{error}</div>}

          <div className="form-group">
            <label htmlFor="current-password">Mot de passe actuel</label>
            <div className="password-input-wrapper">
              <input
                id="current-password"
                type={showCurrentPassword ? "text" : "password"}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Entrez votre mot de passe actuel"
                required
              />
              <button
                type="button"
                className="toggle-password"
                onClick={() => setShowCurrentPassword(!showCurrentPassword)}
              >
                {showCurrentPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="new-password">Nouveau mot de passe</label>
            <div className="password-input-wrapper">
              <input
                id="new-password"
                type={showNewPassword ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Au moins 6 caractères"
                required
              />
              <button
                type="button"
                className="toggle-password"
                onClick={() => setShowNewPassword(!showNewPassword)}
              >
                {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="confirm-password">Confirmer le nouveau mot de passe</label>
            <div className="password-input-wrapper">
              <input
                id="confirm-password"
                type={showConfirmPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Retapez le nouveau mot de passe"
                required
              />
              <button
                type="button"
                className="toggle-password"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              >
                {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <div className="form-actions">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              disabled={loading}
            >
              Annuler
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading}
            >
              <Save size={18} />
              {loading ? "Enregistrement..." : "Enregistrer"}
            </button>
          </div>
        </form>
          </>
        ) : (
          <div className="cash-register-section">
            <CashRegister
              isAdmin={isAdmin}
              accentColor={isAdmin ? "#f59e0b" : "#10b981"}
            />
          </div>
        )}

        <style>{`
          .modal-overlay {
            position: fixed;
            inset: 0;
            background: rgba(0, 0, 0, 0.6);
            backdrop-filter: blur(4px);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 1000;
            padding: 20px;
          }

          .profile-modal {
            background: #ffffff;
            border: 1px solid #e8e2d8;
            border-radius: 16px;
            width: 100%;
            max-width: 500px;
            max-height: 90vh;
            overflow-y: auto;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.25);
          }

          .modal-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 20px 24px;
            border-bottom: 1px solid #e8e2d8;
          }

          .modal-header-content {
            display: flex;
            align-items: center;
            gap: 12px;
          }

          .modal-header h2 {
            margin: 0;
            font-size: 20px;
            font-weight: 700;
            color: #1a1410;
          }

          .modal-icon {
            color: #e0b85c;
          }

          .close-btn {
            background: rgba(0,0,0,0.04);
            border: 1px solid #e8e2d8;
            cursor: pointer;
            padding: 8px;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 8px;
            color: #6b6155;
            transition: all 0.2s;
          }

          .close-btn:hover {
            background: rgba(0,0,0,0.07);
            color: #1a1410;
          }

          .profile-tabs {
            display: flex;
            border-bottom: 1px solid #e8e2d8;
          }

          .tab-btn {
            flex: 1;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            padding: 14px;
            background: none;
            border: none;
            cursor: pointer;
            font-size: 14px;
            font-weight: 600;
            color: #6b6155;
            transition: all 0.2s;
            border-bottom: 2px solid transparent;
          }

          .tab-btn:hover {
            color: #1a1410;
            background: rgba(0,0,0,0.03);
          }

          .tab-btn.active {
            color: #e0b85c;
            border-bottom-color: #e0b85c;
          }

          .cash-register-section {
            padding: 20px;
          }

          .profile-info {
            padding: 24px;
            display: flex;
            flex-direction: column;
            gap: 16px;
          }

          .info-row {
            display: flex;
            align-items: center;
            justify-content: space-between;
          }

          .info-label {
            font-weight: 600;
            color: #6b6155;
            font-size: 14px;
          }

          .info-value {
            font-weight: 500;
            color: #1a1410;
            font-size: 14px;
          }

          .role-badge {
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: 700;
            text-transform: uppercase;
          }

          .role-badge.admin {
            background: linear-gradient(135deg, #e0b85c 0%, #c9a24b 100%);
            color: #1a1408;
          }

          .role-badge.agent {
            background: rgba(0,0,0,0.05);
            border: 1px solid #d9d2c4;
            color: #3f3a30;
          }

          .role-badge.super_admin {
            background: linear-gradient(135deg, #1a1410 0%, #3f3a30 100%);
            color: #e0b85c;
            border: 1px solid #e0b85c;
          }

          .divider {
            height: 1px;
            background: #e8e2d8;
            margin: 0 24px;
          }

          .edit-info-btn {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            align-self: flex-start;
            background: rgba(201,162,75,0.1);
            border: 1px solid rgba(201,162,75,0.3);
            color: #a5822f;
            padding: 7px 14px;
            border-radius: 8px;
            font-size: 13px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s;
          }

          .edit-info-btn:hover {
            background: rgba(201,162,75,0.18);
          }

          .edit-info-form {
            padding: 24px;
          }

          .password-form {
            padding: 24px;
          }

          .password-form h3 {
            margin: 0 0 20px 0;
            font-size: 16px;
            font-weight: 700;
            color: #1a1410;
            display: flex;
            align-items: center;
            gap: 8px;
          }

          .form-group {
            margin-bottom: 16px;
          }

          .form-group label {
            display: block;
            margin-bottom: 6px;
            font-size: 13px;
            font-weight: 600;
            color: #6b6155;
          }

          .password-input-wrapper {
            position: relative;
          }

          .password-input-wrapper input {
            width: 100%;
            padding: 10px 40px 10px 12px;
            border: 1px solid #d9d2c4;
            border-radius: 8px;
            font-size: 14px;
            background: #f7f5f2;
            color: #1a1410;
            transition: all 0.2s;
          }

          .password-input-wrapper input:focus {
            outline: none;
            border-color: rgba(201,162,75,0.5);
            box-shadow: 0 0 0 3px rgba(201,162,75,0.12);
          }

          .toggle-password {
            position: absolute;
            right: 10px;
            top: 50%;
            transform: translateY(-50%);
            background: none;
            border: none;
            cursor: pointer;
            padding: 4px;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #6b6155;
            transition: color 0.2s;
          }

          .toggle-password:hover {
            color: #1a1410;
          }

          .error-message {
            padding: 10px 12px;
            background: rgba(239, 68, 68, 0.1);
            border: 1px solid rgba(239, 68, 68, 0.3);
            border-radius: 8px;
            color: #b91c1c;
            font-size: 13px;
            font-weight: 500;
            margin-bottom: 16px;
          }

          .form-actions {
            display: flex;
            gap: 12px;
            margin-top: 24px;
          }

          .btn {
            flex: 1;
            padding: 10px 16px;
            border: none;
            border-radius: 8px;
            font-size: 14px;
            font-weight: 600;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            transition: all 0.2s;
          }

          .btn:disabled {
            opacity: 0.5;
            cursor: not-allowed;
          }

          .btn-secondary {
            background: rgba(0,0,0,0.04);
            border: 1px solid #e8e2d8;
            color: #3f3a30;
          }

          .btn-secondary:hover:not(:disabled) {
            background: rgba(0,0,0,0.07);
          }

          .btn-primary {
            background: linear-gradient(135deg, #e0b85c 0%, #c9a24b 100%);
            color: #1a1408;
          }

          .btn-primary:hover:not(:disabled) {
            transform: translateY(-1px);
            box-shadow: 0 4px 14px rgba(201, 162, 75, 0.35);
          }

          /* Responsive */
          @media (max-width: 640px) {
            .profile-modal {
              max-width: 100%;
              margin: 0;
              border-radius: 0;
              max-height: 100vh;
            }

            .modal-header,
            .profile-info,
            .password-form {
              padding: 16px;
            }

            .form-actions {
              flex-direction: column;
            }

            .btn {
              width: 100%;
            }
          }
        `}</style>
      </div>
    </div>
  );
}

export default UserProfile;
