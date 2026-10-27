// Miroir de server/src/lib/permissions.js : l'interface masque ce que le serveur refuserait.
// Le serveur reste seul juge ; ceci évite seulement d'afficher des boutons inutilisables.

const DEFAULT_AGENT_PERMISSIONS = {
  sell_on_credit: true,
  cancel_sales: false,
  access_stock: false,
  withdraw_cash: false,
  view_all_sales: false,
  max_discount_percent: 100,
};

export const PERMISSION_LABELS = {
  sell_on_credit: "Vente à crédit",
  cancel_sales: "Annulation de tickets",
  access_stock: "Gestion du stock",
  withdraw_cash: "Retrait de caisse",
  view_all_sales: "Voir toutes les ventes",
};

export const isManager = (user) => user?.role === "admin" || user?.role === "super_admin";

export function permissionsOf(user) {
  if (isManager(user)) {
    return { ...Object.fromEntries(Object.keys(PERMISSION_LABELS).map((k) => [k, true])), max_discount_percent: 100 };
  }
  return { ...DEFAULT_AGENT_PERMISSIONS, ...(user?.permissions || {}) };
}

export const can = (user, permission) => permissionsOf(user)[permission] === true;
