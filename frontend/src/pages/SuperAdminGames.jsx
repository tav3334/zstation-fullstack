import { useCallback, useEffect, useState } from 'react';
import { Gamepad2, Plus, Edit2, Trash2, Clock, Trophy, ArrowLeft, Save, X, AlertTriangle } from 'lucide-react';
import api from '../services/api';
import Toast from '../components/Toast';

function SuperAdminGames({ onBack }) {
  const [games, setGames] = useState([]);
  const [pricingModes, setPricingModes] = useState([]);
  const [organizations, setOrganizations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);
  const [showGameModal, setShowGameModal] = useState(false);
  const [editingGame, setEditingGame] = useState(null);
  const [expandedGameId, setExpandedGameId] = useState(null);

  // Delete confirmation state
  const [deleteConfirm, setDeleteConfirm] = useState(null); // { type: 'game' | 'pricing', gameId, pricingId?, gameName? }

  // Form states
  const [gameName, setGameName] = useState('');
  const [gameOrganizationId, setGameOrganizationId] = useState('');

  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  const loadGames = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.get('/super-admin/games');
      setGames(response.data.games);
    } catch {
      showToast('Erreur lors du chargement des jeux', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  const loadPricingModes = useCallback(async () => {
    try {
      const response = await api.get('/super-admin/pricing-modes');
      setPricingModes(response.data.pricing_modes);
    } catch (error) {
      console.error('Error loading pricing modes:', error);
    }
  }, []);

  const loadOrganizations = useCallback(async () => {
    try {
      const response = await api.get('/super-admin/organizations');
      setOrganizations(response.data.organizations || []);
    } catch (error) {
      console.error('Error loading organizations:', error);
    }
  }, []);

  useEffect(() => {
    loadGames();
    loadPricingModes();
    loadOrganizations();
  }, [loadGames, loadOrganizations, loadPricingModes]);

  const handleCreateGame = async () => {
    if (!gameName.trim()) {
      showToast('Le nom du jeu est requis', 'error');
      return;
    }
    if (!gameOrganizationId) {
      showToast('L\'organisation est requise', 'error');
      return;
    }

    try {
      await api.post('/super-admin/games', {
        name: gameName,
        organization_id: gameOrganizationId,
        price_6min: 6,
        price_30min: 10,
        price_1h: 20,
        price_2h: 35,
        price_3h: 50
      });
      showToast('Jeu créé avec succès');
      setShowGameModal(false);
      setGameName('');
      setGameOrganizationId('');
      loadGames();
    } catch (error) {
      console.error('Create game error:', error);
      const errorMsg = error.response?.data?.message || error.message || 'Erreur lors de la création du jeu';
      showToast(errorMsg, 'error');
    }
  };

  const handleUpdateGame = async () => {
    try {
      await api.put(`/super-admin/games/${editingGame.id}`, {
        name: gameName
      });
      showToast('Jeu modifié avec succès');
      setShowGameModal(false);
      setEditingGame(null);
      setGameName('');
      loadGames();
    } catch {
      showToast('Erreur lors de la modification du jeu', 'error');
    }
  };

  const handleDeleteGame = async (gameId) => {
    try {
      await api.delete(`/super-admin/games/${gameId}`);
      showToast('Jeu supprimé avec succès');
      setDeleteConfirm(null);
      loadGames();
    } catch (error) {
      console.error('Delete game error:', error);
      const errorMsg = error.response?.data?.message || error.message || 'Erreur lors de la suppression du jeu';
      showToast(errorMsg, 'error');
      setDeleteConfirm(null);
    }
  };

  const confirmDeleteGame = (game) => {
    setDeleteConfirm({ type: 'game', gameId: game.id, name: game.name });
  };

  const confirmDeletePricing = (gameId, pricingId, pricingLabel) => {
    setDeleteConfirm({ type: 'pricing', gameId, pricingId, name: pricingLabel });
  };

  const handleUpdatePricing = async (gameId, pricingId, data) => {
    try {
      await api.put(`/super-admin/games/${gameId}/pricings/${pricingId}`, {
        price: data.price,
        duration_minutes: data.isPerMatch ? null : data.value,
        matches_count: data.isPerMatch ? data.value : null,
        description: data.description || null
      });
      showToast('Tarif modifié avec succès');
      loadGames();
    } catch (error) {
      console.error('Update pricing error:', error);
      const errorMsg = error.response?.data?.message || error.message || 'Erreur lors de la modification du tarif';
      showToast(errorMsg, 'error');
    }
  };

  const handleDeletePricing = async (gameId, pricingId) => {
    try {
      await api.delete(`/super-admin/games/${gameId}/pricings/${pricingId}`);
      showToast('Tarif supprimé');
      setDeleteConfirm(null);
      loadGames();
    } catch (error) {
      console.error('Delete pricing error:', error);
      const errorMsg = error.response?.data?.message || error.message || 'Erreur lors de la suppression';
      showToast(errorMsg, 'error');
      setDeleteConfirm(null);
    }
  };

  const handleAddPricing = async (gameId, mode, value, price, description) => {
    const pricingMode = pricingModes.find(pm => pm.code === mode);
    if (!pricingMode || !value || !price) {
      showToast('Veuillez remplir tous les champs', 'error');
      return;
    }

    try {
      await api.post(`/super-admin/games/${gameId}/pricings`, {
        pricing_mode_id: pricingMode.id,
        duration_minutes: mode === 'fixed' ? parseInt(value) : null,
        matches_count: mode === 'per_match' ? parseInt(value) : null,
        price: parseFloat(price),
        description: description || null
      });
      showToast('Tarif ajouté avec succès');
      loadGames();
    } catch (error) {
      console.error('Add pricing error:', error);
      const errorMsg = error.response?.data?.message || error.message || 'Erreur lors de l\'ajout du tarif';
      showToast(errorMsg, 'error');
    }
  };

  const openGameModal = (game = null) => {
    if (game) {
      setEditingGame(game);
      setGameName(game.name);
      setGameOrganizationId(game.organization_id || '');
    } else {
      setEditingGame(null);
      setGameName('');
      setGameOrganizationId('');
    }
    setShowGameModal(true);
  };

  return (
    <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
      {toast && <Toast message={toast.message} type={toast.type} />}

      {/* Header */}
      <div style={{ background: 'white', borderRadius: '16px', padding: '24px', marginBottom: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <button
              onClick={onBack}
              style={{
                padding: '10px',
                background: '#f3f4f6',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center'
              }}
            >
              <ArrowLeft size={20} />
            </button>
            <div>
              <h1 style={{ fontSize: '24px', fontWeight: '700', margin: 0 }}>
                Gestion des Jeux
              </h1>
              <p style={{ fontSize: '14px', color: '#6b7280', margin: '4px 0 0 0' }}>
                Gérez les jeux et leurs tarifs (par temps ou par match)
              </p>
            </div>
          </div>
          <button
            onClick={() => openGameModal()}
            style={{
              padding: '12px 24px',
              background: 'linear-gradient(135deg, #c9a24b 0%, #8a6a26 100%)',
              color: 'white',
              border: 'none',
              borderRadius: '10px',
              cursor: 'pointer',
              fontSize: '15px',
              fontWeight: '600',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: '0 4px 12px rgba(201, 162, 75, 0.3)'
            }}
          >
            <Plus size={20} />
            Nouveau Jeu
          </button>
        </div>
      </div>

      {/* Games List */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px', background: 'white', borderRadius: '16px' }}>
          <div style={{ fontSize: '16px', color: '#6b7280' }}>Chargement...</div>
        </div>
      ) : games.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px', background: 'white', borderRadius: '16px' }}>
          <Gamepad2 size={48} color="#d1d5db" style={{ margin: '0 auto 16px' }} />
          <div style={{ fontSize: '16px', color: '#6b7280' }}>Aucun jeu trouvé</div>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '16px' }}>
          {games.map(game => (
            <GameCard
              key={game.id}
              game={game}
              expanded={expandedGameId === game.id}
              onToggle={() => setExpandedGameId(expandedGameId === game.id ? null : game.id)}
              onEdit={() => openGameModal(game)}
              onDelete={() => confirmDeleteGame(game)}
              onUpdatePricing={handleUpdatePricing}
              onDeletePricing={(gameId, pricingId, label) => confirmDeletePricing(gameId, pricingId, label)}
              onAddPricing={handleAddPricing}
            />
          ))}
        </div>
      )}

      {/* Game Modal */}
      {showGameModal && (
        <div style={modalOverlay} onClick={() => setShowGameModal(false)}>
          <div style={modalContent} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 20px 0', fontSize: '20px', fontWeight: '700' }}>
              {editingGame ? 'Modifier le jeu' : 'Nouveau jeu'}
            </h3>

            {!editingGame && (
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>
                  Organisation *
                </label>
                <select
                  value={gameOrganizationId}
                  onChange={(e) => setGameOrganizationId(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px',
                    fontSize: '15px',
                    border: '2px solid #e5e7eb',
                    borderRadius: '8px',
                    background: 'white'
                  }}
                >
                  <option value="">-- Sélectionner une organisation --</option>
                  {organizations.map(org => (
                    <option key={org.id} value={org.id}>{org.name}</option>
                  ))}
                </select>
              </div>
            )}

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>
                Nom du jeu *
              </label>
              <input
                type="text"
                value={gameName}
                onChange={(e) => setGameName(e.target.value)}
                placeholder="Ex: FIFA 24"
                style={{
                  width: '100%',
                  padding: '12px',
                  fontSize: '15px',
                  border: '2px solid #e5e7eb',
                  borderRadius: '8px'
                }}
                autoFocus
              />
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={editingGame ? handleUpdateGame : handleCreateGame}
                style={{
                  flex: 1,
                  padding: '12px',
                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '15px',
                  fontWeight: '600'
                }}
              >
                {editingGame ? 'Modifier' : 'Créer'}
              </button>
              <button
                onClick={() => setShowGameModal(false)}
                style={{
                  flex: 1,
                  padding: '12px',
                  background: '#f3f4f6',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '15px',
                  fontWeight: '600'
                }}
              >
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div style={modalOverlay} onClick={() => setDeleteConfirm(null)}>
          <div style={deleteModalContent} onClick={(e) => e.stopPropagation()}>
            <div style={deleteIconContainer}>
              <AlertTriangle size={48} color="#ef4444" />
            </div>
            <h3 style={deleteTitle}>Confirmer la suppression</h3>
            <p style={deleteText}>
              {deleteConfirm.type === 'game'
                ? `Êtes-vous sûr de vouloir supprimer le jeu "${deleteConfirm.name}" et tous ses tarifs associés ?`
                : `Êtes-vous sûr de vouloir supprimer le tarif "${deleteConfirm.name}" ?`
              }
            </p>
            <p style={deleteWarning}>Cette action est irréversible.</p>
            <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
              <button
                onClick={() => setDeleteConfirm(null)}
                style={cancelBtn}
              >
                <X size={18} />
                Annuler
              </button>
              <button
                onClick={() => {
                  if (deleteConfirm.type === 'game') {
                    handleDeleteGame(deleteConfirm.gameId);
                  } else {
                    handleDeletePricing(deleteConfirm.gameId, deleteConfirm.pricingId);
                  }
                }}
                style={deleteBtn}
              >
                <Trash2 size={18} />
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ========== GAME CARD COMPONENT ==========
function GameCard({ game, expanded, onToggle, onEdit, onDelete, onUpdatePricing, onDeletePricing, onAddPricing }) {
  const [newPricingMode, setNewPricingMode] = useState('fixed');
  const [newPricingValue, setNewPricingValue] = useState('');
  const [newPricingPrice, setNewPricingPrice] = useState('');
  const [newPricingDescription, setNewPricingDescription] = useState('');
  const [editingPricingId, setEditingPricingId] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [editPrice, setEditPrice] = useState('');
  const [editDescription, setEditDescription] = useState('');

  const timePricings = game.pricings.filter(p => p.pricing_mode.code === 'fixed').sort((a, b) => a.duration_minutes - b.duration_minutes);
  const matchPricings = game.pricings.filter(p => p.pricing_mode.code === 'per_match').sort((a, b) => a.matches_count - b.matches_count);

  const handleAddNewPricing = () => {
    if (!newPricingValue || !newPricingPrice) return;
    onAddPricing(game.id, newPricingMode, newPricingValue, newPricingPrice, newPricingDescription);
    setNewPricingValue('');
    setNewPricingPrice('');
    setNewPricingDescription('');
  };

  const startEdit = (pricing) => {
    setEditingPricingId(pricing.id);
    const isPerMatch = pricing.pricing_mode.code === 'per_match';
    setEditValue(isPerMatch ? pricing.matches_count : pricing.duration_minutes);
    setEditPrice(pricing.price);
    setEditDescription(pricing.description || '');
  };

  const saveEdit = (pricing) => {
    if (editPrice && editPrice !== '' && editValue && editValue !== '') {
      const isPerMatch = pricing.pricing_mode.code === 'per_match';
      onUpdatePricing(game.id, pricing.id, {
        value: parseInt(editValue),
        price: parseFloat(editPrice),
        description: editDescription,
        isPerMatch
      });
    }
    setEditingPricingId(null);
    setEditValue('');
    setEditPrice('');
    setEditDescription('');
  };

  return (
    <div style={{
      background: 'white',
      borderRadius: '12px',
      overflow: 'hidden',
      boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
      transition: 'all 0.2s'
    }}>
      {/* Header */}
      <div
        onClick={onToggle}
        style={{
          padding: '20px 24px',
          background: expanded ? '#f9fafb' : 'white',
          cursor: 'pointer',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: expanded ? '1px solid #e5e7eb' : 'none'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Gamepad2 size={24} color="#c9a24b" />
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: '700', margin: 0 }}>{game.name}</h3>
              <span style={{
                padding: '3px 8px',
                borderRadius: '4px',
                fontSize: '11px',
                fontWeight: '600',
                background: 'rgba(201, 162, 75, 0.15)',
                color: '#c9a24b'
              }}>
                {game.organization_name || 'Non assigné'}
              </span>
            </div>
            <p style={{ fontSize: '13px', color: '#6b7280', margin: '2px 0 0 0' }}>
              {game.pricings.length} tarif(s) • {timePricings.length} par temps • {matchPricings.length} par match
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px' }} onClick={(e) => e.stopPropagation()}>
          <button
            onClick={onEdit}
            style={{
              padding: '8px 12px',
              background: '#f3f4f6',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            <Edit2 size={16} style={{ verticalAlign: 'middle' }} />
          </button>
          <button
            onClick={onDelete}
            style={{
              padding: '8px 12px',
              background: '#fee2e2',
              color: '#dc2626',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            <Trash2 size={16} style={{ verticalAlign: 'middle' }} />
          </button>
        </div>
      </div>

      {/* Expanded Content */}
      {expanded && (
        <div style={{ padding: '24px' }}>
          {/* Time-based Pricings */}
          <div style={{ marginBottom: '24px' }}>
            <h4 style={{ fontSize: '15px', fontWeight: '600', color: '#1e40af', margin: '0 0 12px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Clock size={18} />
              Tarifs par Temps
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '12px' }}>
              {timePricings.map(pricing => {
                const label = `${pricing.duration_minutes} min - ${pricing.price} DH`;
                return (
                  <PricingItem
                    key={pricing.id}
                    pricing={pricing}
                    isEditing={editingPricingId === pricing.id}
                    editValue={editValue}
                    editPrice={editPrice}
                    editDescription={editDescription}
                    onEditValueChange={setEditValue}
                    onEditPriceChange={setEditPrice}
                    onEditDescriptionChange={setEditDescription}
                    onStartEdit={() => startEdit(pricing)}
                    onSaveEdit={() => saveEdit(pricing)}
                    onCancelEdit={() => setEditingPricingId(null)}
                    onDelete={() => onDeletePricing(game.id, pricing.id, label)}
                    color="#3b82f6"
                  />
                );
              })}
            </div>
          </div>

          {/* Match-based Pricings */}
          <div style={{ marginBottom: '24px' }}>
            <h4 style={{ fontSize: '15px', fontWeight: '600', color: '#059669', margin: '0 0 12px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Trophy size={18} />
              Tarifs par Match
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '12px' }}>
              {matchPricings.map(pricing => {
                const label = `${pricing.matches_count} match${pricing.matches_count > 1 ? 's' : ''} - ${pricing.price} DH`;
                return (
                  <PricingItem
                    key={pricing.id}
                    pricing={pricing}
                    isEditing={editingPricingId === pricing.id}
                    editValue={editValue}
                    editPrice={editPrice}
                    editDescription={editDescription}
                    onEditValueChange={setEditValue}
                    onEditPriceChange={setEditPrice}
                    onEditDescriptionChange={setEditDescription}
                    onStartEdit={() => startEdit(pricing)}
                    onSaveEdit={() => saveEdit(pricing)}
                    onCancelEdit={() => setEditingPricingId(null)}
                    onDelete={() => onDeletePricing(game.id, pricing.id, label)}
                    color="#10b981"
                  />
                );
              })}
            </div>
          </div>

          {/* Add New Pricing */}
          <div style={{
            padding: '16px',
            background: '#f9fafb',
            borderRadius: '8px',
            border: '2px dashed #e5e7eb'
          }}>
            <h4 style={{ fontSize: '14px', fontWeight: '600', margin: '0 0 12px 0' }}>Ajouter un tarif</h4>
            <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr 1fr 1fr auto', gap: '8px', alignItems: 'end' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: '600', color: '#6b7280', display: 'block', marginBottom: '4px' }}>Mode</label>
                <select
                  value={newPricingMode}
                  onChange={(e) => setNewPricingMode(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px',
                    fontSize: '14px',
                    border: '1px solid #e5e7eb',
                    borderRadius: '6px'
                  }}
                >
                  <option value="fixed">Temps</option>
                  <option value="per_match">Match</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: '12px', fontWeight: '600', color: '#6b7280', display: 'block', marginBottom: '4px' }}>
                  {newPricingMode === 'fixed' ? 'Minutes' : 'Matchs'}
                </label>
                <input
                  type="number"
                  value={newPricingValue}
                  onChange={(e) => setNewPricingValue(e.target.value)}
                  placeholder={newPricingMode === 'fixed' ? 'ex: 30' : 'ex: 1'}
                  style={{
                    width: '100%',
                    padding: '8px',
                    fontSize: '14px',
                    border: '1px solid #e5e7eb',
                    borderRadius: '6px'
                  }}
                />
              </div>
              <div>
                <label style={{ fontSize: '12px', fontWeight: '600', color: '#6b7280', display: 'block', marginBottom: '4px' }}>Prix (DH)</label>
                <input
                  type="number"
                  step="0.01"
                  value={newPricingPrice}
                  onChange={(e) => setNewPricingPrice(e.target.value)}
                  placeholder="ex: 10"
                  style={{
                    width: '100%',
                    padding: '8px',
                    fontSize: '14px',
                    border: '1px solid #e5e7eb',
                    borderRadius: '6px'
                  }}
                />
              </div>
              <div>
                <label style={{ fontSize: '12px', fontWeight: '600', color: '#6b7280', display: 'block', marginBottom: '4px' }}>Description (optionnel)</label>
                <input
                  type="text"
                  value={newPricingDescription}
                  onChange={(e) => setNewPricingDescription(e.target.value)}
                  placeholder="ex: Idéal pour une partie rapide"
                  style={{
                    width: '100%',
                    padding: '8px',
                    fontSize: '14px',
                    border: '1px solid #e5e7eb',
                    borderRadius: '6px'
                  }}
                />
              </div>
              <button
                onClick={handleAddNewPricing}
                style={{
                  padding: '8px 16px',
                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '600',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                <Plus size={16} />
                Ajouter
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ========== PRICING ITEM COMPONENT ==========
function PricingItem({ pricing, isEditing, editValue, editPrice, editDescription, onEditValueChange, onEditPriceChange, onEditDescriptionChange, onStartEdit, onSaveEdit, onCancelEdit, onDelete, color }) {
  const isPerMatch = pricing.pricing_mode.code === 'per_match';
  const label = isPerMatch ? `${pricing.matches_count} match` : `${pricing.duration_minutes} min`;

  return (
    <div style={{
      padding: '12px',
      borderRadius: '8px',
      border: `2px solid ${color}20`,
      background: `${color}10`
    }}>
      {isEditing ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div>
            <label style={{ fontSize: '11px', fontWeight: '600', color: '#6b7280', display: 'block', marginBottom: '4px' }}>
              {isPerMatch ? 'Matchs' : 'Minutes'}
            </label>
            <input
              type="number"
              min="1"
              value={editValue}
              onChange={(e) => onEditValueChange(e.target.value)}
              style={{
                width: '100%',
                padding: '6px 8px',
                fontSize: '14px',
                border: '1px solid #e5e7eb',
                borderRadius: '4px',
                boxSizing: 'border-box'
              }}
            />
          </div>
          <div>
            <label style={{ fontSize: '11px', fontWeight: '600', color: '#6b7280', display: 'block', marginBottom: '4px' }}>
              Prix (DH)
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={editPrice}
              onChange={(e) => onEditPriceChange(e.target.value)}
              style={{
                width: '100%',
                padding: '6px 8px',
                fontSize: '14px',
                border: '1px solid #e5e7eb',
                borderRadius: '4px',
                boxSizing: 'border-box'
              }}
              autoFocus
            />
          </div>
          <div>
            <label style={{ fontSize: '11px', fontWeight: '600', color: '#6b7280', display: 'block', marginBottom: '4px' }}>
              Description
            </label>
            <input
              type="text"
              value={editDescription}
              onChange={(e) => onEditDescriptionChange(e.target.value)}
              placeholder="ex: Idéal pour une partie rapide"
              style={{
                width: '100%',
                padding: '6px 8px',
                fontSize: '13px',
                border: '1px solid #e5e7eb',
                borderRadius: '4px',
                boxSizing: 'border-box'
              }}
            />
          </div>
          <div style={{ display: 'flex', gap: '4px' }}>
            <button
              onClick={onSaveEdit}
              style={{
                flex: 1,
                padding: '6px',
                background: '#10b981',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: '600',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '4px'
              }}
            >
              <Save size={14} /> Sauver
            </button>
            <button
              onClick={onCancelEdit}
              style={{
                flex: 1,
                padding: '6px',
                background: '#f3f4f6',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: '600',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '4px'
              }}
            >
              <X size={14} /> Annuler
            </button>
          </div>
        </div>
      ) : (
        <>
          <div style={{ fontSize: '13px', fontWeight: '600', color: '#6b7280', marginBottom: '4px' }}>
            {label}
          </div>
          <div style={{ fontSize: '18px', fontWeight: '700', color, marginBottom: '4px' }}>
            {pricing.price} DH
          </div>
          {pricing.description && (
            <div style={{ fontSize: '11px', color: '#6b7280', fontStyle: 'italic', marginBottom: '8px', lineHeight: '1.4' }}>
              {pricing.description}
            </div>
          )}
          {!pricing.description && <div style={{ marginBottom: '8px' }} />}
          <div style={{ display: 'flex', gap: '4px' }}>
            <button
              onClick={onStartEdit}
              style={{
                flex: 1,
                padding: '4px 8px',
                background: 'white',
                border: '1px solid #e5e7eb',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '12px'
              }}
            >
              Modifier
            </button>
            <button
              onClick={onDelete}
              style={{
                padding: '4px 8px',
                background: '#fee2e2',
                color: '#dc2626',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '12px'
              }}
            >
              <Trash2 size={12} />
            </button>
          </div>
        </>
      )}
    </div>
  );
}

const modalOverlay = {
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  background: 'rgba(0,0,0,0.7)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 1000
};

const modalContent = {
  background: 'white',
  borderRadius: '16px',
  padding: '28px',
  width: '450px',
  maxWidth: '90%',
  boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
};

const deleteModalContent = {
  background: 'white',
  borderRadius: '20px',
  padding: '32px',
  width: '420px',
  maxWidth: '90%',
  boxShadow: '0 25px 80px rgba(0,0,0,0.4)',
  textAlign: 'center'
};

const deleteIconContainer = {
  width: '80px',
  height: '80px',
  borderRadius: '50%',
  background: 'linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  margin: '0 auto 20px auto',
  border: '3px solid #fecaca'
};

const deleteTitle = {
  margin: '0 0 12px 0',
  fontSize: '22px',
  fontWeight: '700',
  color: '#1f2937'
};

const deleteText = {
  margin: '0 0 8px 0',
  fontSize: '15px',
  color: '#4b5563',
  lineHeight: '1.5'
};

const deleteWarning = {
  margin: '0',
  fontSize: '13px',
  color: '#ef4444',
  fontWeight: '600'
};

const cancelBtn = {
  flex: 1,
  padding: '14px 20px',
  background: '#f3f4f6',
  border: 'none',
  borderRadius: '10px',
  cursor: 'pointer',
  fontSize: '15px',
  fontWeight: '600',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '8px',
  color: '#4b5563',
  transition: 'all 0.2s'
};

const deleteBtn = {
  flex: 1,
  padding: '14px 20px',
  background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
  color: 'white',
  border: 'none',
  borderRadius: '10px',
  cursor: 'pointer',
  fontSize: '15px',
  fontWeight: '600',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '8px',
  transition: 'all 0.2s'
};

export default SuperAdminGames;
