import { prisma } from './prisma.js';
import { addDays, diffInDays, today } from './dates.js';

/** Dernier abonnement créé pour une organisation (équivalent de ->latest()->first()). */
export function latestSubscription(organizationId, include) {
  return prisma.subscription.findFirst({
    where: { organization_id: organizationId },
    orderBy: [{ created_at: 'desc' }, { id: 'desc' }],
    include,
  });
}

/** Attributs calculés du modèle Subscription (days_remaining, is_expired, ...). */
export function subscriptionState(sub) {
  const now = today();
  const endsAt = sub.ends_at;

  const days_remaining = endsAt ? diffInDays(now, endsAt) : null;
  const is_expired = endsAt ? now > endsAt : false;

  let in_grace_period = false;
  let grace_days_remaining = 0;
  if (is_expired) {
    const graceEnd = addDays(endsAt, sub.grace_days);
    in_grace_period = now <= graceEnd;
    if (in_grace_period) grace_days_remaining = Math.max(0, diffInDays(now, graceEnd));
  }

  const is_blocked = !sub.is_active || (is_expired && !in_grace_period);
  return { days_remaining, is_expired, in_grace_period, grace_days_remaining, is_blocked };
}
