// Journal d'activité de l'équipe. Un échec d'écriture ne doit jamais faire échouer l'action journalisée.
import { prisma } from './prisma.js';

export const ACTIVITY = {
  LOGIN: 'login',
  PIN_SWITCH: 'pin_switch',
  LOGOUT: 'logout',
  PROFILE_UPDATE: 'profile_update',
  PASSWORD_CHANGE: 'password_change',
  PIN_CHANGE: 'pin_change',
  SALE_DISCOUNT: 'sale_discount',
  SALE_CANCEL: 'sale_cancel',
  REGISTER_OPENING: 'register_opening',
  REGISTER_WITHDRAW: 'register_withdraw',
  REGISTER_CLOSE: 'register_close',
  TEAM_CREATE: 'team_create',
  TEAM_UPDATE: 'team_update',
  TEAM_DEACTIVATE: 'team_deactivate',
  TEAM_ACTIVATE: 'team_activate',
  TEAM_PASSWORD_RESET: 'team_password_reset',
  TEAM_DELETE: 'team_delete',
};

/** Enregistre une action de `user` (au moins { id, organization_id }). */
export async function logActivity(user, action, description) {
  if (!user?.organization_id) return;
  try {
    await prisma.activityLog.create({
      data: { organization_id: user.organization_id, user_id: user.id ?? null, action, description },
    });
  } catch (err) {
    console.error('Journal d\'activité :', err.message);
  }
}
