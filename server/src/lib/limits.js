import { prisma } from './prisma.js';
import { latestSubscription } from './subscription.js';

const LABELS = { max_machines: 'machines', max_games: 'jeux', max_users: 'utilisateurs' };

/** Vérifie une limite du plan d'abonnement (0 = illimité). Reprise du trait ChecksSubscriptionLimits. */
export async function checkLimit(organizationId, limitKey) {
  if (!organizationId) return { allowed: true };
  const sub = await latestSubscription(Number(organizationId), { plan: true });
  if (!sub || !sub.plan) return { allowed: true };

  const limits = sub.plan.limits ?? {};
  const max = limits[limitKey] ?? 0;
  if (max === 0) return { allowed: true };

  const orgId = Number(organizationId);
  let current = 0;
  if (limitKey === 'max_machines') current = await prisma.machine.count({ where: { organization_id: orgId } });
  else if (limitKey === 'max_games') current = await prisma.game.count({ where: { organization_id: orgId } });
  else if (limitKey === 'max_users') {
    current = await prisma.user.count({ where: { organization_id: orgId, role: { in: ['admin', 'agent'] } } });
  }

  if (current >= max) {
    const label = LABELS[limitKey] ?? limitKey;
    return {
      allowed: false,
      message: `Limite atteinte : votre plan "${sub.plan.name}" autorise ${max} ${label} maximum (actuel : ${current}). Veuillez upgrader votre abonnement.`,
    };
  }
  return { allowed: true };
}
