// Permissions des agents (les admins et super_admins ont tous les droits).
// Stockées en JSON sur l'utilisateur ; les clés absentes prennent la valeur par défaut.

export const PERMISSION_LABELS = {
  sell_on_credit: 'Vente à crédit',
  cancel_sales: 'Annulation de tickets',
  access_stock: 'Gestion du stock',
  withdraw_cash: 'Retrait de caisse',
  view_all_sales: 'Voir toutes les ventes',
};

// Valeurs par défaut = comportement d'avant l'introduction des permissions,
// sauf view_all_sales : un agent ne voit plus que ses propres ventes.
export const DEFAULT_AGENT_PERMISSIONS = {
  sell_on_credit: true,
  cancel_sales: false,
  access_stock: false,
  withdraw_cash: false,
  view_all_sales: false,
  max_discount_percent: 100,
};

const isManager = (user) => user?.role === 'admin' || user?.role === 'super_admin';

/** Permissions effectives d'un utilisateur. */
export function permissionsOf(user) {
  if (isManager(user)) {
    return { ...Object.fromEntries(Object.keys(PERMISSION_LABELS).map((k) => [k, true])), max_discount_percent: 100 };
  }
  const stored = user?.permissions && typeof user.permissions === 'object' ? user.permissions : {};
  return { ...DEFAULT_AGENT_PERMISSIONS, ...sanitizePermissions(stored) };
}

export const can = (user, permission) => permissionsOf(user)[permission] === true;

/** Ne garde que les clés connues, avec le bon type. */
export function sanitizePermissions(raw) {
  const clean = {};
  if (!raw || typeof raw !== 'object') return clean;
  for (const key of Object.keys(PERMISSION_LABELS)) {
    if (key in raw) clean[key] = raw[key] === true || raw[key] === 1 || raw[key] === '1' || raw[key] === 'true';
  }
  if (raw.max_discount_percent != null && raw.max_discount_percent !== '') {
    const pct = Number(raw.max_discount_percent);
    if (Number.isFinite(pct)) clean.max_discount_percent = Math.min(100, Math.max(0, pct));
  }
  return clean;
}

/** Middleware : admin, ou agent disposant de la permission. */
export const requirePermission = (permission) => (req, res, next) => {
  if (can(req.user, permission)) return next();
  res.status(403).json({ message: `Accès refusé : permission « ${PERMISSION_LABELS[permission]} » requise.` });
};
