import { useCallback, useEffect, useState } from 'react';
import {
  ArrowLeft, Plus, Edit2, Trash2, X, RefreshCw, Search,
  Crown, Calendar, CheckCircle, AlertCircle, Clock, Building2,
  DollarSign, Shield, Zap, Star, Package, ChevronDown, ChevronUp,
  ToggleLeft, ToggleRight, AlertTriangle
} from 'lucide-react';
import api from '../services/api';
import Toast from '../components/Toast';

const GRACE_DAYS_DEFAULT = 7;

function SuperAdminSubscriptions({ onBack }) {
  const [activeTab, setActiveTab] = useState('subscriptions'); // subscriptions | plans
  const [plans, setPlans] = useState([]);
  const [subscriptions, setSubscriptions] = useState([]);
  const [organizations, setOrganizations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [toast, setToast] = useState(null);

  // Modals
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [showSubModal, setShowSubModal] = useState(false);
  const [showDeletePlanModal, setShowDeletePlanModal] = useState(false);
  const [editingPlan, setEditingPlan] = useState(null);
  const [editingSub, setEditingSub] = useState(null);
  const [deletingPlan, setDeletingPlan] = useState(null);

  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [plansRes, subsRes, orgsRes] = await Promise.all([
        api.get('/super-admin/subscription-plans'),
        api.get('/super-admin/subscriptions'),
        api.get('/super-admin/organizations'),
      ]);
      setPlans(plansRes.data.plans || plansRes.data || []);
      setSubscriptions(subsRes.data.subscriptions || subsRes.data || []);
      setOrganizations(orgsRes.data.organizations || []);
    } catch {
      showToast('Erreur lors du chargement des données', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleDeletePlan = async () => {
    if (!deletingPlan) return;
    try {
      await api.delete(`/super-admin/subscription-plans/${deletingPlan.id}`);
      showToast('Plan supprimé');
      loadData();
    } catch (err) {
      showToast(err.response?.data?.message || 'Erreur lors de la suppression', 'error');
    } finally {
      setShowDeletePlanModal(false);
      setDeletingPlan(null);
    }
  };

  const handleToggleSub = async (sub) => {
    try {
      await api.post(`/super-admin/subscriptions/${sub.id}/toggle`);
      showToast(sub.is_active ? 'Abonnement suspendu' : 'Abonnement réactivé');
      loadData();
    } catch (err) {
      showToast(err.response?.data?.message || 'Erreur', 'error');
    }
  };

  const getSubStatus = (sub) => {
    if (!sub.is_active) return { label: 'Suspendu', color: '#ef4444', bg: 'rgba(239,68,68,0.15)', icon: AlertCircle };
    if (!sub.ends_at) return { label: 'Actif', color: '#10b981', bg: 'rgba(16,185,129,0.15)', icon: CheckCircle };
    const now = new Date();
    const end = new Date(sub.ends_at);
    const diffDays = Math.ceil((end - now) / (1000 * 60 * 60 * 24));
    if (diffDays < 0) {
      const graceDays = sub.grace_days ?? GRACE_DAYS_DEFAULT;
      const graceLeft = graceDays + diffDays;
      if (graceLeft > 0) return { label: `Grâce: ${graceLeft}j`, color: '#f59e0b', bg: 'rgba(245,158,11,0.15)', icon: AlertTriangle };
      return { label: 'Expiré', color: '#ef4444', bg: 'rgba(239,68,68,0.15)', icon: AlertCircle };
    }
    if (diffDays <= 7) return { label: `Expire dans ${diffDays}j`, color: '#f59e0b', bg: 'rgba(245,158,11,0.15)', icon: Clock };
    return { label: 'Actif', color: '#10b981', bg: 'rgba(16,185,129,0.15)', icon: CheckCircle };
  };

  const filteredSubs = subscriptions.filter(s =>
    s.organization?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.plan?.name?.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const filteredPlans = plans.filter(p =>
    p.name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const stats = {
    totalSubs: subscriptions.length,
    activeSubs: subscriptions.filter(s => {
      const st = getSubStatus(s);
      return st.label === 'Actif' || st.label.startsWith('Expire');
    }).length,
    expiredSubs: subscriptions.filter(s => getSubStatus(s).label === 'Expiré').length,
    graceSubs: subscriptions.filter(s => getSubStatus(s).label.startsWith('Grâce')).length,
  };

  return (
    <div style={s.container}>
      {/* Header */}
      <div style={s.header}>
        <div style={s.headerLeft}>
          <button style={s.backBtn} onClick={onBack}><ArrowLeft size={20} /></button>
          <div>
            <h1 style={s.title}>Gestion des Abonnements</h1>
            <p style={s.subtitle}>Gérez les plans et abonnements des organisations</p>
          </div>
        </div>
        <div style={s.headerRight}>
          {activeTab === 'plans' ? (
            <button style={s.addBtn} onClick={() => { setEditingPlan(null); setShowPlanModal(true); }}>
              <Plus size={18} /> Nouveau Plan
            </button>
          ) : (
            <button style={s.addBtn} onClick={() => { setEditingSub(null); setShowSubModal(true); }}>
              <Plus size={18} /> Nouvel Abonnement
            </button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div style={s.statsRow}>
        <StatCard icon={Crown} label="Total" value={stats.totalSubs} color="#c9a24b" />
        <StatCard icon={CheckCircle} label="Actifs" value={stats.activeSubs} color="#10b981" />
        <StatCard icon={AlertTriangle} label="En grâce" value={stats.graceSubs} color="#f59e0b" />
        <StatCard icon={AlertCircle} label="Expirés" value={stats.expiredSubs} color="#ef4444" />
      </div>

      {/* Tabs */}
      <div style={s.tabs}>
        <button
          style={{ ...s.tab, ...(activeTab === 'subscriptions' ? s.tabActive : {}) }}
          onClick={() => setActiveTab('subscriptions')}
        >
          <Crown size={16} /> Abonnements
        </button>
        <button
          style={{ ...s.tab, ...(activeTab === 'plans' ? s.tabActive : {}) }}
          onClick={() => setActiveTab('plans')}
        >
          <Package size={16} /> Plans
        </button>
      </div>

      {/* Toolbar */}
      <div style={s.toolbar}>
        <div style={s.searchWrap}>
          <Search size={16} style={s.searchIcon} />
          <input
            type="text"
            placeholder={activeTab === 'subscriptions' ? 'Rechercher organisation ou plan...' : 'Rechercher un plan...'}
            style={s.searchInput}
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>
        <button style={s.refreshBtn} onClick={loadData} disabled={loading}>
          <RefreshCw size={16} style={loading ? { animation: 'spin 1s linear infinite' } : {}} />
        </button>
      </div>

      {/* Content */}
      {loading ? (
        <div style={s.loading}>
          <RefreshCw size={32} style={{ color: '#c9a24b', animation: 'spin 1s linear infinite' }} />
          <p>Chargement...</p>
        </div>
      ) : activeTab === 'subscriptions' ? (
        <SubscriptionsList
          subscriptions={filteredSubs}
          getSubStatus={getSubStatus}
          onEdit={sub => { setEditingSub(sub); setShowSubModal(true); }}
          onToggle={handleToggleSub}
          onNew={() => { setEditingSub(null); setShowSubModal(true); }}
        />
      ) : (
        <PlansList
          plans={filteredPlans}
          onEdit={plan => { setEditingPlan(plan); setShowPlanModal(true); }}
          onDelete={plan => { setDeletingPlan(plan); setShowDeletePlanModal(true); }}
          onNew={() => { setEditingPlan(null); setShowPlanModal(true); }}
        />
      )}

      {/* Modals */}
      {showPlanModal && (
        <PlanModal
          plan={editingPlan}
          onClose={() => setShowPlanModal(false)}
          onSuccess={() => { setShowPlanModal(false); loadData(); showToast(editingPlan ? 'Plan modifié' : 'Plan créé'); }}
        />
      )}

      {showSubModal && (
        <SubscriptionModal
          subscription={editingSub}
          plans={plans}
          organizations={organizations}
          onClose={() => setShowSubModal(false)}
          onSuccess={() => { setShowSubModal(false); loadData(); showToast(editingSub ? 'Abonnement modifié' : 'Abonnement créé'); }}
        />
      )}

      {showDeletePlanModal && (
        <DeleteConfirm
          title="Supprimer le plan"
          message={`Êtes-vous sûr de vouloir supprimer le plan "${deletingPlan?.name}" ?`}
          onConfirm={handleDeletePlan}
          onCancel={() => { setShowDeletePlanModal(false); setDeletingPlan(null); }}
        />
      )}

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}

// ─── Subscriptions List ───────────────────────────────────────────────────────
function SubscriptionsList({ subscriptions, getSubStatus, onEdit, onToggle, onNew }) {
  if (subscriptions.length === 0) {
    return (
      <div style={s.empty}>
        <Crown size={56} color="#6b6155" />
        <h3 style={s.emptyTitle}>Aucun abonnement</h3>
        <p style={s.emptyText}>Créez un abonnement pour commencer</p>
        <button style={s.emptyBtn} onClick={onNew}><Plus size={16} /> Créer un abonnement</button>
      </div>
    );
  }

  return (
    <div style={s.subList}>
      {subscriptions.map(sub => {
        const status = getSubStatus(sub);
        const StatusIcon = status.icon;
        return (
          <div key={sub.id} style={s.subCard}>
            <div style={s.subCardLeft}>
              <div style={{ ...s.subOrgIcon, background: `${status.color}20` }}>
                <Building2 size={22} color={status.color} />
              </div>
              <div style={s.subCardInfo}>
                <div style={s.subCardName}>{sub.organization?.name || '—'}</div>
                <div style={s.subCardPlan}>
                  <Crown size={13} color="#c9a24b" />
                  {sub.plan?.name || 'Plan inconnu'}
                  {sub.plan?.price != null && (
                    <span style={s.planPrice}>{sub.plan.price} DH/mois</span>
                  )}
                </div>
                <div style={s.subCardDates}>
                  <Calendar size={12} color="#6b6155" />
                  {sub.starts_at
                    ? new Date(sub.starts_at).toLocaleDateString('fr-FR')
                    : '—'}
                  {sub.ends_at && (
                    <> → {new Date(sub.ends_at).toLocaleDateString('fr-FR')}</>
                  )}
                </div>
              </div>
            </div>

            <div style={s.subCardRight}>
              <span style={{ ...s.statusBadge, background: status.bg, color: status.color }}>
                <StatusIcon size={12} />
                {status.label}
              </span>
              {sub.grace_days != null && (
                <span style={s.graceBadge}>
                  <Clock size={11} /> {sub.grace_days}j de grâce
                </span>
              )}
              <div style={s.subActions}>
                <button
                  style={{ ...s.actionBtn, color: sub.is_active ? '#f59e0b' : '#10b981' }}
                  onClick={() => onToggle(sub)}
                  title={sub.is_active ? 'Suspendre' : 'Réactiver'}
                >
                  {sub.is_active ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
                </button>
                <button style={{ ...s.actionBtn, color: '#3b82f6' }} onClick={() => onEdit(sub)} title="Modifier">
                  <Edit2 size={16} />
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Plans List ───────────────────────────────────────────────────────────────
function PlansList({ plans, onEdit, onDelete, onNew }) {
  if (plans.length === 0) {
    return (
      <div style={s.empty}>
        <Package size={56} color="#6b6155" />
        <h3 style={s.emptyTitle}>Aucun plan</h3>
        <p style={s.emptyText}>Créez votre premier plan d'abonnement</p>
        <button style={s.emptyBtn} onClick={onNew}><Plus size={16} /> Créer un plan</button>
      </div>
    );
  }

  return (
    <div style={s.planGrid}>
      {plans.map(plan => (
        <PlanCard key={plan.id} plan={plan} onEdit={onEdit} onDelete={onDelete} />
      ))}
    </div>
  );
}

function PlanCard({ plan, onEdit, onDelete }) {
  const features = (() => {
    if (!plan.features) return [];
    if (Array.isArray(plan.features)) return plan.features;
    try { return JSON.parse(plan.features); } catch { return []; }
  })();

  const limits = (() => {
    if (!plan.limits) return {};
    if (typeof plan.limits === 'object') return plan.limits;
    try { return JSON.parse(plan.limits); } catch { return {}; }
  })();

  return (
    <div style={s.planCard}>
      <div style={s.planCardHeader}>
        <div style={s.planIcon}><Crown size={20} /></div>
        <div style={s.planCardInfo}>
          <h3 style={s.planName}>{plan.name}</h3>
          {plan.description && <p style={s.planDesc}>{plan.description}</p>}
        </div>
      </div>

      <div style={s.planPriceRow}>
        <span style={s.planPriceBig}>{plan.price ?? '—'}</span>
        <span style={s.planPriceSuffix}>DH / mois</span>
      </div>

      {Object.keys(limits).length > 0 && (
        <div style={s.planLimits}>
          {limits.max_machines != null && (
            <LimitItem icon={Shield} label="Machines" value={limits.max_machines === 0 ? '∞' : limits.max_machines} />
          )}
          {limits.max_users != null && (
            <LimitItem icon={Star} label="Utilisateurs" value={limits.max_users === 0 ? '∞' : limits.max_users} />
          )}
          {limits.max_games != null && (
            <LimitItem icon={Zap} label="Jeux" value={limits.max_games === 0 ? '∞' : limits.max_games} />
          )}
        </div>
      )}

      {features.length > 0 && (
        <ul style={s.featureList}>
          {features.map((f, i) => (
            <li key={i} style={s.featureItem}>
              <CheckCircle size={13} color="#10b981" />
              {f}
            </li>
          ))}
        </ul>
      )}

      <div style={s.planActions}>
        <button style={{ ...s.planBtn, background: '#3b82f620', color: '#3b82f6' }} onClick={() => onEdit(plan)}>
          <Edit2 size={14} /> Modifier
        </button>
        <button style={{ ...s.planBtn, background: '#ef444420', color: '#ef4444' }} onClick={() => onDelete(plan)}>
          <Trash2 size={14} /> Supprimer
        </button>
      </div>
    </div>
  );
}

function LimitItem({ icon: Icon, label, value }) {
  return (
    <div style={s.limitItem}>
      <Icon size={13} color="#c9a24b" />
      <span style={s.limitLabel}>{label}</span>
      <span style={s.limitValue}>{value}</span>
    </div>
  );
}

// ─── Plan Modal ───────────────────────────────────────────────────────────────
function PlanModal({ plan, onClose, onSuccess }) {
  const [form, setForm] = useState({
    name: plan?.name || '',
    description: plan?.description || '',
    price: plan?.price ?? '',
    grace_days: plan?.grace_days ?? GRACE_DAYS_DEFAULT,
    limits: plan?.limits
      ? (typeof plan.limits === 'string' ? plan.limits : JSON.stringify(plan.limits, null, 2))
      : '{\n  "max_machines": 0,\n  "max_users": 0,\n  "max_games": 0\n}',
    features: plan?.features
      ? (Array.isArray(plan.features) ? plan.features.join('\n') : plan.features)
      : '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showLimitsHelp, setShowLimitsHelp] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    let limitsObj;
    try {
      limitsObj = JSON.parse(form.limits);
    } catch {
      setError('Le champ "Limites" doit être un JSON valide');
      return;
    }
    const featuresArr = form.features
      .split('\n')
      .map(f => f.trim())
      .filter(Boolean);

    try {
      setLoading(true);
      const payload = {
        name: form.name,
        description: form.description,
        price: parseFloat(form.price) || 0,
        grace_days: parseInt(form.grace_days) || GRACE_DAYS_DEFAULT,
        limits: limitsObj,
        features: featuresArr,
      };
      if (plan) {
        await api.post(`/super-admin/subscription-plans/${plan.id}`, { ...payload, _method: 'PUT' });
      } else {
        await api.post('/super-admin/subscription-plans', payload);
      }
      onSuccess();
    } catch (err) {
      setError(err.response?.data?.message || 'Erreur lors de la sauvegarde');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={s.overlay} onClick={onClose}>
      <div style={{ ...s.modal, maxWidth: '560px' }} onClick={e => e.stopPropagation()}>
        <div style={s.modalHeader}>
          <div style={s.modalIcon}><Package size={20} color="#c9a24b" /></div>
          <h3 style={s.modalTitle}>{plan ? 'Modifier le Plan' : 'Nouveau Plan'}</h3>
          <button style={s.closeBtn} onClick={onClose}><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} style={s.form}>
          <div style={s.formRow}>
            <Field label="Nom du plan *">
              <input style={s.input} value={form.name} required
                onChange={e => setForm({ ...form, name: e.target.value })}
                placeholder="Ex: Pro, Premium..." />
            </Field>
            <Field label="Prix (DH/mois)">
              <input style={s.input} type="number" min="0" value={form.price}
                onChange={e => setForm({ ...form, price: e.target.value })}
                placeholder="0" />
            </Field>
          </div>
          <Field label="Description">
            <input style={s.input} value={form.description}
              onChange={e => setForm({ ...form, description: e.target.value })}
              placeholder="Description courte du plan" />
          </Field>
          <Field label="Jours de grâce après expiration">
            <input style={s.input} type="number" min="0" max="90" value={form.grace_days}
              onChange={e => setForm({ ...form, grace_days: e.target.value })} />
          </Field>
          <Field
            label={
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                Limites (JSON)
                <button type="button" style={s.helpBtn} onClick={() => setShowLimitsHelp(!showLimitsHelp)}>
                  {showLimitsHelp ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </button>
              </span>
            }
          >
            {showLimitsHelp && (
              <div style={s.helpBox}>
                Utilisez 0 pour illimité. Exemple:<br />
                <code>{'{ "max_machines": 10, "max_users": 5, "max_games": 0 }'}</code>
              </div>
            )}
            <textarea style={{ ...s.input, height: '90px', fontFamily: 'monospace', fontSize: '13px' }}
              value={form.limits}
              onChange={e => setForm({ ...form, limits: e.target.value })} />
          </Field>
          <Field label="Fonctionnalités (une par ligne)">
            <textarea style={{ ...s.input, height: '80px' }}
              value={form.features}
              placeholder="Ex: Accès illimité&#10;Support prioritaire&#10;Rapports avancés"
              onChange={e => setForm({ ...form, features: e.target.value })} />
          </Field>
          {error && <div style={s.errorBox}>{error}</div>}
          <div style={s.modalActions}>
            <button type="button" style={s.cancelBtn} onClick={onClose}>Annuler</button>
            <button type="submit" style={s.submitBtn} disabled={loading}>
              {loading ? 'Enregistrement...' : plan ? 'Modifier' : 'Créer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Subscription Modal ───────────────────────────────────────────────────────
function SubscriptionModal({ subscription, plans, organizations, onClose, onSuccess }) {
  const [form, setForm] = useState({
    organization_id: subscription?.organization_id || '',
    plan_id: subscription?.plan_id || '',
    starts_at: subscription?.starts_at ? subscription.starts_at.split('T')[0] : new Date().toISOString().split('T')[0],
    ends_at: subscription?.ends_at ? subscription.ends_at.split('T')[0] : '',
    grace_days: subscription?.grace_days ?? GRACE_DAYS_DEFAULT,
    is_active: subscription?.is_active ?? true,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const selectedPlan = plans.find(p => p.id == form.plan_id);

  useEffect(() => {
    if (selectedPlan?.grace_days != null && !subscription) {
      setForm(f => ({ ...f, grace_days: selectedPlan.grace_days }));
    }
  }, [form.plan_id, selectedPlan, subscription]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      setLoading(true);
      if (subscription) {
        await api.post(`/super-admin/subscriptions/${subscription.id}`, { ...form, _method: 'PUT' });
      } else {
        await api.post('/super-admin/subscriptions', form);
      }
      onSuccess();
    } catch (err) {
      setError(err.response?.data?.message || 'Erreur lors de la sauvegarde');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={s.overlay} onClick={onClose}>
      <div style={{ ...s.modal, maxWidth: '520px' }} onClick={e => e.stopPropagation()}>
        <div style={s.modalHeader}>
          <div style={s.modalIcon}><Crown size={20} color="#c9a24b" /></div>
          <h3 style={s.modalTitle}>{subscription ? 'Modifier Abonnement' : 'Nouvel Abonnement'}</h3>
          <button style={s.closeBtn} onClick={onClose}><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} style={s.form}>
          <Field label="Organisation *">
            <select style={s.input} value={form.organization_id} required
              onChange={e => setForm({ ...form, organization_id: e.target.value })}
              disabled={!!subscription}>
              <option value="">Sélectionner une organisation</option>
              {organizations.map(org => (
                <option key={org.id} value={org.id}>{org.name}</option>
              ))}
            </select>
          </Field>
          <Field label="Plan *">
            <select style={s.input} value={form.plan_id} required
              onChange={e => setForm({ ...form, plan_id: e.target.value })}>
              <option value="">Sélectionner un plan</option>
              {plans.map(p => (
                <option key={p.id} value={p.id}>{p.name} — {p.price} DH/mois</option>
              ))}
            </select>
          </Field>
          {selectedPlan && (
            <div style={s.planPreview}>
              <Crown size={14} color="#c9a24b" />
              <span style={s.planPreviewName}>{selectedPlan.name}</span>
              <span style={s.planPreviewPrice}>{selectedPlan.price} DH/mois</span>
              {selectedPlan.description && <span style={s.planPreviewDesc}>{selectedPlan.description}</span>}
            </div>
          )}
          <div style={s.formRow}>
            <Field label="Date de début">
              <input style={s.input} type="date" value={form.starts_at}
                onChange={e => setForm({ ...form, starts_at: e.target.value })} />
            </Field>
            <Field label="Date de fin (optionnel)">
              <input style={s.input} type="date" value={form.ends_at}
                onChange={e => setForm({ ...form, ends_at: e.target.value })} />
            </Field>
          </div>
          <Field label="Jours de grâce">
            <input style={s.input} type="number" min="0" max="90" value={form.grace_days}
              onChange={e => setForm({ ...form, grace_days: e.target.value })} />
          </Field>
          <label style={s.toggleRow}>
            <div>
              <div style={s.toggleTitle}>Abonnement actif</div>
              <div style={s.toggleSub}>Désactivez pour suspendre l'accès immédiatement</div>
            </div>
            <div
              style={{ ...s.toggle, background: form.is_active ? '#c9a24b' : '#e8e2d8' }}
              onClick={() => setForm({ ...form, is_active: !form.is_active })}
            >
              <div style={{ ...s.toggleKnob, transform: form.is_active ? 'translateX(20px)' : 'none' }} />
            </div>
          </label>
          {error && <div style={s.errorBox}>{error}</div>}
          <div style={s.modalActions}>
            <button type="button" style={s.cancelBtn} onClick={onClose}>Annuler</button>
            <button type="submit" style={s.submitBtn} disabled={loading}>
              {loading ? 'Enregistrement...' : subscription ? 'Modifier' : 'Créer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Delete Confirm ───────────────────────────────────────────────────────────
function DeleteConfirm({ title, message, onConfirm, onCancel }) {
  return (
    <div style={s.overlay} onClick={onCancel}>
      <div style={{ ...s.modal, maxWidth: '420px', padding: '32px 24px' }} onClick={e => e.stopPropagation()}>
        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
          <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'rgba(239,68,68,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <AlertCircle size={32} color="#ef4444" />
          </div>
          <h3 style={{ margin: '0 0 8px', color: '#1a1410', fontSize: '20px', fontWeight: 700 }}>{title}</h3>
          <p style={{ margin: 0, color: '#6b6155', fontSize: '14px', lineHeight: 1.6 }}>{message}</p>
        </div>
        <div style={s.modalActions}>
          <button style={s.cancelBtn} onClick={onCancel}>Annuler</button>
          <button style={{ ...s.submitBtn, background: '#ef4444' }} onClick={onConfirm}>Supprimer</button>
        </div>
      </div>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function StatCard({ icon: Icon, label, value, color }) {
  return (
    <div style={s.statCard}>
      <div style={{ ...s.statIcon, background: `${color}20` }}><Icon size={20} color={color} /></div>
      <div>
        <div style={{ fontSize: '26px', fontWeight: 800, color: '#1a1410', lineHeight: 1 }}>{value}</div>
        <div style={{ fontSize: '13px', color: '#6b6155', marginTop: '4px' }}>{label}</div>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div style={s.field}>
      <label style={s.fieldLabel}>{label}</label>
      {children}
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = {
  container: { minHeight: '100vh', background: '#f7f5f2', padding: '24px' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' },
  headerLeft: { display: 'flex', alignItems: 'center', gap: '16px' },
  headerRight: { display: 'flex', gap: '12px' },
  backBtn: { padding: '12px', background: '#ffffff', border: '1px solid #e8e2d8', borderRadius: '12px', color: '#1a1410', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  title: { margin: 0, fontSize: '28px', fontWeight: 800, color: '#1a1410', letterSpacing: '-0.5px' },
  subtitle: { margin: '4px 0 0', fontSize: '14px', color: '#6b6155' },
  addBtn: { display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 24px', background: 'linear-gradient(135deg,#c9a24b,#a5822f)', color: '#fff', border: 'none', borderRadius: '12px', cursor: 'pointer', fontWeight: 600, fontSize: '14px', boxShadow: '0 4px 12px rgba(201, 162, 75,0.3)' },
  statsRow: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: '16px', marginBottom: '24px' },
  statCard: { display: 'flex', alignItems: 'center', gap: '14px', padding: '18px 20px', background: '#ffffff', borderRadius: '16px', border: '1px solid #e8e2d8' },
  statIcon: { width: '46px', height: '46px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  tabs: { display: 'flex', gap: '4px', marginBottom: '20px', background: '#ffffff', border: '1px solid #e8e2d8', borderRadius: '14px', padding: '4px', width: 'fit-content' },
  tab: { display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', background: 'transparent', border: 'none', borderRadius: '10px', color: '#6b6155', cursor: 'pointer', fontSize: '14px', fontWeight: 600, transition: 'all 0.2s' },
  tabActive: { background: '#e8e2d8', color: '#1a1410' },
  toolbar: { display: 'flex', gap: '12px', marginBottom: '20px', alignItems: 'center' },
  searchWrap: { position: 'relative', flex: 1, maxWidth: '400px' },
  searchIcon: { position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#6b6155' },
  searchInput: { width: '100%', padding: '12px 14px 12px 44px', border: '1px solid #e8e2d8', borderRadius: '12px', fontSize: '14px', background: '#ffffff', color: '#1a1410', outline: 'none' },
  refreshBtn: { padding: '12px', background: '#ffffff', border: '1px solid #e8e2d8', borderRadius: '12px', color: '#1a1410', cursor: 'pointer' },
  loading: { textAlign: 'center', padding: '80px', color: '#6b6155', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' },

  subList: { display: 'flex', flexDirection: 'column', gap: '12px' },
  subCard: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', padding: '16px 20px', background: '#ffffff', borderRadius: '16px', border: '1px solid #e8e2d8', flexWrap: 'wrap' },
  subCardLeft: { display: 'flex', alignItems: 'center', gap: '14px' },
  subOrgIcon: { width: '48px', height: '48px', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  subCardInfo: { display: 'flex', flexDirection: 'column', gap: '4px' },
  subCardName: { fontSize: '16px', fontWeight: 700, color: '#1a1410' },
  subCardPlan: { display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#6b6155' },
  planPrice: { background: '#c9a24b20', color: '#c9a24b', padding: '2px 8px', borderRadius: '8px', fontSize: '12px', fontWeight: 600 },
  subCardDates: { display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', color: '#6b6155' },
  subCardRight: { display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' },
  statusBadge: { display: 'flex', alignItems: 'center', gap: '5px', padding: '5px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 600 },
  graceBadge: { display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 10px', background: '#f59e0b20', color: '#f59e0b', borderRadius: '12px', fontSize: '11px', fontWeight: 600 },
  subActions: { display: 'flex', gap: '6px' },
  actionBtn: { padding: '8px', background: '#e8e2d8', border: 'none', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' },

  planGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))', gap: '20px' },
  planCard: { background: '#ffffff', borderRadius: '20px', padding: '24px', border: '1px solid #e8e2d8', display: 'flex', flexDirection: 'column', gap: '16px' },
  planCardHeader: { display: 'flex', alignItems: 'center', gap: '14px' },
  planIcon: { width: '48px', height: '48px', borderRadius: '14px', background: 'linear-gradient(135deg,#c9a24b,#a5822f)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', flexShrink: 0 },
  planCardInfo: { flex: 1 },
  planName: { margin: 0, fontSize: '18px', fontWeight: 700, color: '#1a1410' },
  planDesc: { margin: '4px 0 0', fontSize: '13px', color: '#6b6155' },
  planPriceRow: { display: 'flex', alignItems: 'baseline', gap: '6px' },
  planPriceBig: { fontSize: '32px', fontWeight: 800, color: '#c9a24b' },
  planPriceSuffix: { fontSize: '14px', color: '#6b6155' },
  planLimits: { display: 'flex', flexDirection: 'column', gap: '8px', padding: '12px', background: '#f7f5f2', borderRadius: '12px' },
  limitItem: { display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#6b6155' },
  limitLabel: { flex: 1 },
  limitValue: { fontWeight: 700, color: '#1a1410' },
  featureList: { margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '6px' },
  featureItem: { display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#6b6155' },
  planActions: { display: 'flex', gap: '10px', marginTop: 'auto' },
  planBtn: { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '10px', borderRadius: '10px', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '13px' },

  empty: { textAlign: 'center', padding: '80px 40px', background: '#ffffff', borderRadius: '20px', border: '1px dashed #e8e2d8', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px' },
  emptyTitle: { margin: 0, fontSize: '20px', fontWeight: 700, color: '#1a1410' },
  emptyText: { margin: 0, fontSize: '14px', color: '#6b6155' },
  emptyBtn: { display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 24px', background: '#c9a24b', color: '#fff', border: 'none', borderRadius: '12px', cursor: 'pointer', fontWeight: 600 },

  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' },
  modal: { background: '#ffffff', borderRadius: '20px', width: '100%', maxHeight: '90vh', overflow: 'auto', border: '1px solid #e8e2d8' },
  modalHeader: { display: 'flex', alignItems: 'center', gap: '12px', padding: '20px 24px', borderBottom: '1px solid #e8e2d8' },
  modalIcon: { width: '40px', height: '40px', borderRadius: '12px', background: '#c9a24b20', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  modalTitle: { margin: 0, flex: 1, fontSize: '18px', fontWeight: 700, color: '#1a1410' },
  closeBtn: { background: '#e8e2d8', border: 'none', color: '#6b6155', cursor: 'pointer', padding: '8px', borderRadius: '8px' },
  form: { padding: '24px', display: 'flex', flexDirection: 'column', gap: '18px' },
  formRow: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' },
  field: { display: 'flex', flexDirection: 'column', gap: '7px' },
  fieldLabel: { fontSize: '13px', fontWeight: 600, color: '#6b6155' },
  input: { padding: '11px 14px', border: '1px solid #e8e2d8', borderRadius: '10px', fontSize: '14px', background: '#f7f5f2', color: '#1a1410', outline: 'none', width: '100%', boxSizing: 'border-box', resize: 'vertical' },
  helpBtn: { background: 'transparent', border: 'none', color: '#6b6155', cursor: 'pointer', padding: '2px', display: 'inline-flex', alignItems: 'center' },
  helpBox: { padding: '10px 14px', background: '#f7f5f2', border: '1px solid #e8e2d8', borderRadius: '8px', fontSize: '12px', color: '#6b6155', lineHeight: 1.6 },
  planPreview: { display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', background: '#c9a24b10', border: '1px solid #c9a24b30', borderRadius: '10px', flexWrap: 'wrap' },
  planPreviewName: { fontWeight: 700, color: '#c9a24b', fontSize: '14px' },
  planPreviewPrice: { fontSize: '13px', color: '#6b6155' },
  planPreviewDesc: { fontSize: '12px', color: '#6b6155', flex: '1 1 100%' },
  toggleRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', background: '#f7f5f2', borderRadius: '12px', cursor: 'pointer' },
  toggleTitle: { fontSize: '14px', fontWeight: 600, color: '#1a1410' },
  toggleSub: { fontSize: '12px', color: '#6b6155', marginTop: '2px' },
  toggle: { width: '48px', height: '28px', borderRadius: '14px', padding: '4px', transition: 'background 0.2s', cursor: 'pointer', flexShrink: 0 },
  toggleKnob: { width: '20px', height: '20px', borderRadius: '10px', background: '#fff', transition: 'transform 0.2s' },
  errorBox: { padding: '12px 16px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '10px', color: '#b91c1c', fontSize: '13px' },
  modalActions: { display: 'flex', gap: '12px' },
  cancelBtn: { flex: 1, padding: '13px', background: '#e8e2d8', color: '#1a1410', border: 'none', borderRadius: '12px', cursor: 'pointer', fontWeight: 600, fontSize: '14px' },
  submitBtn: { flex: 1, padding: '13px', background: 'linear-gradient(135deg,#c9a24b,#a5822f)', color: '#fff', border: 'none', borderRadius: '12px', cursor: 'pointer', fontWeight: 600, fontSize: '14px' },
};

export default SuperAdminSubscriptions;
