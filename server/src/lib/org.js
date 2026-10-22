// Équivalent du trait BelongsToOrganization (global scope + remplissage automatique).

const isSuperAdmin = (user) => user?.role === 'super_admin';

/**
 * Filtre à fusionner dans un `where` Prisma : limite les résultats à l'organisation
 * de l'utilisateur connecté (aucun filtre pour un super_admin).
 */
export function orgScope(req, where = {}) {
  const user = req.user;
  if (user && !isSuperAdmin(user)) return { ...where, organization_id: user.organization_id };
  return where;
}

/** Ajoute organization_id à la création si l'utilisateur n'est pas super_admin et qu'il manque. */
export function withOrg(req, data) {
  const user = req.user;
  if (user && !isSuperAdmin(user) && (data.organization_id === undefined || data.organization_id === null)) {
    return { ...data, organization_id: user.organization_id };
  }
  return data;
}
