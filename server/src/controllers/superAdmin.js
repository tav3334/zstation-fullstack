// Espace super admin (contrôleurs SuperAdmin/* + routes /super-admin/stats et /pricing-modes).
import { prisma } from '../lib/prisma.js';
import { bool, filled, has, input, orFail, pick } from '../lib/http.js';
import { validate, validateOrFail } from '../lib/validate.js';
import { checkLimit } from '../lib/limits.js';
import { hashPassword, isSuperAdmin } from '../lib/auth.js';
import { subscriptionState } from '../lib/subscription.js';
import { addDays, dateBetween, parseDate } from '../lib/dates.js';
import { uniqueOrganizationCode } from './auth.js';
import { FIXED_DURATIONS, FIXED_PRICE_RULES, createGameWithPricings, deleteGameCascade, upsertFixedPricing } from './admin.js';

const tryOr500 = async (res, message, fn) => {
  try {
    return await fn();
  } catch (err) {
    if (err.status) throw err;
    res.status(500).json({ success: false, message, error: err.message });
  }
};

// ═════════════════════════════ Organisations ═════════════════════════════

const ORG_COUNTS = { _count: { select: { users: true, machines: true, customers: true, games: true } } };

function withCounts(org) {
  const { _count: counts, ...rest } = org;
  return {
    ...rest,
    users_count: counts.users,
    machines_count: counts.machines,
    customers_count: counts.customers,
    games_count: counts.games,
  };
}

const findOrg = async (id) => orFail(await prisma.organization.findUnique({ where: { id: Number(id) } }), 'Organization', id);

export async function organizationsIndex(req, res) {
  const orgs = await prisma.organization.findMany({ include: ORG_COUNTS, orderBy: { name: 'asc' } });
  res.json({ success: true, organizations: orgs.map(withCounts) });
}

export async function organizationsStore(req, res) {
  const data = input(req);
  await validate(data, {
    name: 'required|string|max:255',
    code: 'nullable|string|max:50|unique:organizations,code',
    is_active: 'boolean',
  });

  const organization = await prisma.organization.create({
    data: {
      name: data.name,
      code: data.code || (await uniqueOrganizationCode(data.name)),
      ...(has(data, 'is_active') ? { is_active: bool(data.is_active) } : {}),
    },
  });
  res.status(201).json({ success: true, message: 'Organisation créée avec succès', organization });
}

export async function organizationsShow(req, res) {
  const org = orFail(
    await prisma.organization.findUnique({
      where: { id: Number(req.params.id) },
      include: {
        ...ORG_COUNTS,
        users: { select: { id: true, name: true, email: true, role: true, organization_id: true } },
      },
    }),
    'Organization',
    req.params.id,
  );
  res.json({ success: true, organization: withCounts(org) });
}

export async function organizationsUpdate(req, res) {
  const org = await findOrg(req.params.id);
  const data = input(req);
  await validate(data, {
    name: 'sometimes|required|string|max:255',
    code: `sometimes|required|string|max:50|unique:organizations,code,${org.id}`,
    is_active: 'boolean',
    module_gaming: 'boolean',
    module_coiffure: 'boolean',
    module_stock: 'boolean',
  });

  const changes = pick(data, ['name', 'code']);
  for (const flag of ['is_active', 'module_gaming', 'module_coiffure', 'module_stock']) {
    if (has(data, flag)) changes[flag] = bool(data[flag]);
  }
  const organization = await prisma.organization.update({ where: { id: org.id }, data: changes });
  res.json({ success: true, message: 'Organisation mise à jour avec succès', organization });
}

export async function organizationsDestroy(req, res) {
  const org = await findOrg(req.params.id);
  if (org.code === 'DEFAULT') {
    return res.status(400).json({ success: false, message: "Impossible de supprimer l'organisation par défaut" });
  }
  if ((await prisma.user.count({ where: { organization_id: org.id } })) > 0) {
    return res.status(400).json({
      success: false,
      message: "Impossible de supprimer une organisation avec des utilisateurs. Veuillez d'abord réassigner ou supprimer les utilisateurs.",
    });
  }
  await prisma.organization.delete({ where: { id: org.id } });
  res.json({ success: true, message: 'Organisation supprimée avec succès' });
}

export async function organizationsAssignUser(req, res) {
  const org = await findOrg(req.params.id);
  const data = input(req);
  await validate(data, { user_id: 'required|exists:users,id' });

  const user = orFail(await prisma.user.findUnique({ where: { id: Number(data.user_id) } }), 'User', data.user_id);
  if (isSuperAdmin(user)) {
    return res.status(400).json({ success: false, message: "Impossible d'assigner un Super Admin à une organisation" });
  }
  if (user.organization_id !== org.id) {
    const limit = await checkLimit(org.id, 'max_users');
    if (!limit.allowed) return res.status(403).json({ success: false, message: limit.message });
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { organization_id: org.id },
    include: { organization: true },
  });
  res.json({ success: true, message: "Utilisateur assigné à l'organisation avec succès", user: updated });
}

export async function organizationsRemoveUser(req, res) {
  const org = await findOrg(req.params.id);
  const data = input(req);
  await validate(data, { user_id: 'required|exists:users,id' });

  const user = orFail(
    await prisma.user.findFirst({ where: { id: Number(data.user_id), organization_id: org.id } }),
    'User',
    data.user_id,
  );
  await prisma.user.update({ where: { id: user.id }, data: { organization_id: null } });
  res.json({ success: true, message: "Utilisateur retiré de l'organisation avec succès" });
}

export async function organizationsUsers(req, res) {
  const org = await findOrg(req.params.id);
  const users = await prisma.user.findMany({
    where: { organization_id: org.id },
    select: { id: true, name: true, email: true, role: true, created_at: true },
    orderBy: { name: 'asc' },
  });
  res.json({ success: true, users });
}

export async function organizationsStats(req, res) {
  const org = await findOrg(req.params.id);
  const where = { organization_id: org.id };
  const [users, machines, customers, games, activeSessions, totalSessions, products] = await Promise.all([
    prisma.user.count({ where }),
    prisma.machine.count({ where }),
    prisma.customer.count({ where }),
    prisma.game.count({ where }),
    prisma.gameSession.count({ where: { ...where, ended_at: null } }),
    prisma.gameSession.count({ where }),
    prisma.product.count({ where }),
  ]);
  res.json({
    success: true,
    stats: {
      users_count: users,
      machines_count: machines,
      customers_count: customers,
      games_count: games,
      active_sessions: activeSessions,
      total_sessions: totalSessions,
      products_count: products,
    },
  });
}

// ═════════════════════════════ Utilisateurs ═════════════════════════════

export async function usersIndex(req, res) {
  await tryOr500(res, 'Erreur lors de la récupération des utilisateurs', async () => {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        organization_id: true,
        created_at: true,
        updated_at: true,
        organization: { select: { id: true, name: true } },
      },
      orderBy: [{ created_at: 'desc' }, { id: 'desc' }],
    });
    res.json({ success: true, users });
  });
}

export async function usersStore(req, res) {
  const data = input(req);
  await validateOrFail(data, {
    name: 'required|string|max:255',
    email: 'required|string|email|max:255|unique:users',
    password: 'required|string|min:8|confirmed',
    role: 'required|in:agent,admin,super_admin',
  });

  await tryOr500(res, "Erreur lors de la création de l'utilisateur", async () => {
    const user = await prisma.user.create({
      data: { name: data.name, email: data.email, password: await hashPassword(data.password), role: data.role },
    });
    res.status(201).json({ success: true, message: 'Utilisateur créé avec succès', user });
  });
}

export async function usersShow(req, res) {
  const user = await prisma.user.findUnique({ where: { id: Number(req.params.id) || 0 } });
  if (!user) return res.status(404).json({ success: false, message: 'Utilisateur non trouvé' });
  res.json({ success: true, user });
}

export async function usersUpdate(req, res) {
  const user = await prisma.user.findUnique({ where: { id: Number(req.params.id) || 0 } });
  if (!user) {
    return res.status(500).json({ success: false, message: "Erreur lors de la modification de l'utilisateur", error: 'Utilisateur non trouvé' });
  }

  const data = input(req);
  if (user.id === req.user.id && data.role !== 'super_admin') {
    return res.status(403).json({ success: false, message: 'Vous ne pouvez pas modifier votre propre rôle' });
  }

  await validateOrFail(data, {
    name: 'sometimes|required|string|max:255',
    email: `sometimes|required|string|email|max:255|unique:users,email,${user.id}`,
    password: 'sometimes|nullable|string|min:8|confirmed',
    role: 'sometimes|required|in:agent,admin,super_admin',
  });

  await tryOr500(res, "Erreur lors de la modification de l'utilisateur", async () => {
    const changes = pick(data, ['name', 'email', 'role']);
    if (filled(data, 'password')) changes.password = await hashPassword(data.password);
    const updated = await prisma.user.update({ where: { id: user.id }, data: changes });
    res.json({ success: true, message: 'Utilisateur modifié avec succès', user: updated });
  });
}

export async function usersDestroy(req, res) {
  const user = await prisma.user.findUnique({ where: { id: Number(req.params.id) || 0 } });
  if (!user) {
    return res.status(500).json({ success: false, message: "Erreur lors de la suppression de l'utilisateur", error: 'Utilisateur non trouvé' });
  }
  if (user.id === req.user.id) {
    return res.status(403).json({ success: false, message: 'Vous ne pouvez pas supprimer votre propre compte' });
  }
  await prisma.user.delete({ where: { id: user.id } });
  res.json({ success: true, message: 'Utilisateur supprimé avec succès' });
}

// ═════════════════════════════ Machines ═════════════════════════════

const MACHINE_STATUSES = 'available,in_session,maintenance';

function formatMachine(m, extra = {}) {
  return {
    id: m.id,
    machine_number: m.id,
    type: m.name ?? 'Standard',
    status: m.status,
    organization_id: m.organization_id,
    organization_name: m.organization?.name ?? 'Non assignée',
    ...extra,
  };
}

export async function machinesIndex(req, res) {
  await tryOr500(res, 'Erreur lors de la récupération des machines', async () => {
    const machines = await prisma.machine.findMany({
      include: { organization: true },
      orderBy: [{ organization_id: { sort: 'asc', nulls: 'first' } }, { id: 'asc' }],
    });
    res.json({
      success: true,
      machines: machines.map((m) => formatMachine(m, { created_at: m.created_at, updated_at: m.updated_at })),
    });
  });
}

export async function machinesStore(req, res) {
  const data = input(req);
  await validateOrFail(data, {
    machine_number: 'nullable|integer',
    type: 'nullable|string|max:255',
    status: `required|in:${MACHINE_STATUSES}`,
    organization_id: 'required|exists:organizations,id',
  });

  await tryOr500(res, 'Erreur lors de la création de la machine', async () => {
    const limit = await checkLimit(data.organization_id, 'max_machines');
    if (!limit.allowed) return res.status(403).json({ success: false, message: limit.message });

    const machine = await prisma.machine.create({
      data: { name: data.type ?? 'Standard', status: data.status ?? 'available', organization_id: Number(data.organization_id) },
      include: { organization: true },
    });
    res.status(201).json({
      success: true,
      message: 'Machine créée avec succès',
      machine: formatMachine(machine, { created_at: machine.created_at }),
    });
  });
}

export async function machinesShow(req, res) {
  const machine = await prisma.machine.findUnique({ where: { id: Number(req.params.id) || 0 }, include: { organization: true } });
  if (!machine) return res.status(404).json({ success: false, message: 'Machine non trouvée' });
  res.json({ success: true, machine: formatMachine(machine, { created_at: machine.created_at }) });
}

export async function machinesUpdate(req, res) {
  const machine = await prisma.machine.findUnique({ where: { id: Number(req.params.id) || 0 } });
  if (!machine) {
    return res.status(500).json({ success: false, message: 'Erreur lors de la modification de la machine', error: 'Machine non trouvée' });
  }

  const data = input(req);
  await validateOrFail(data, {
    type: 'sometimes|nullable|string|max:255',
    status: `sometimes|required|in:${MACHINE_STATUSES}`,
    organization_id: 'sometimes|required|exists:organizations,id',
  });

  const changes = {};
  if (has(data, 'type')) changes.name = data.type ?? 'Standard';
  if (has(data, 'status')) changes.status = data.status;
  if (has(data, 'organization_id')) changes.organization_id = Number(data.organization_id);

  const updated = await prisma.machine.update({ where: { id: machine.id }, data: changes, include: { organization: true } });
  res.json({
    success: true,
    message: 'Machine modifiée avec succès',
    machine: formatMachine(updated, { updated_at: updated.updated_at }),
  });
}

export async function machinesDestroy(req, res) {
  const machine = await prisma.machine.findUnique({ where: { id: Number(req.params.id) || 0 } });
  if (!machine) {
    return res.status(500).json({ success: false, message: 'Erreur lors de la suppression de la machine', error: 'Machine non trouvée' });
  }
  const active = await prisma.gameSession.findFirst({ where: { machine_id: machine.id, ended_at: null } });
  if (active) {
    return res.status(403).json({ success: false, message: 'Impossible de supprimer une machine avec une session active' });
  }
  await prisma.machine.delete({ where: { id: machine.id } });
  res.json({ success: true, message: 'Machine supprimée avec succès' });
}

// ═════════════════════════════ Jeux et tarifs ═════════════════════════════

export async function gamesIndex(req, res) {
  await tryOr500(res, 'Erreur lors de la récupération des jeux', async () => {
    const games = await prisma.game.findMany({
      include: { pricings: { include: { pricing_mode: true }, orderBy: { id: 'asc' } }, organization: true },
      orderBy: [{ organization_id: { sort: 'asc', nulls: 'first' } }, { created_at: 'desc' }, { id: 'desc' }],
    });
    res.json({
      success: true,
      games: games.map((game) => ({
        id: game.id,
        name: game.name,
        active: game.active,
        organization_id: game.organization_id,
        organization_name: game.organization?.name ?? 'Non assigné',
        pricings: game.pricings.map((p) => ({
          id: p.id,
          pricing_mode: {
            id: p.pricing_mode?.id ?? null,
            code: p.pricing_mode?.code ?? 'fixed',
            label: p.pricing_mode?.label ?? 'Prix Fixe',
          },
          duration_minutes: p.duration_minutes,
          matches_count: p.matches_count,
          price: p.price,
          description: p.description,
        })),
        created_at: game.created_at,
        updated_at: game.updated_at,
      })),
    });
  });
}

export async function gamesStore(req, res) {
  const data = input(req);
  await validateOrFail(data, {
    name: 'required|string|max:255',
    ...FIXED_PRICE_RULES('required|'),
    organization_id: 'required|exists:organizations,id',
  });

  await tryOr500(res, 'Erreur lors de la création du jeu', async () => {
    const limit = await checkLimit(data.organization_id, 'max_games');
    if (!limit.allowed) return res.status(403).json({ success: false, message: limit.message });

    const game = await createGameWithPricings(data, Number(data.organization_id));
    res.status(201).json({
      success: true,
      message: 'Jeu créé avec succès',
      game: {
        id: game.id,
        name: game.name,
        organization_id: game.organization_id,
        organization_name: game.organization?.name ?? 'Non assigné',
        ...pick(data, Object.keys(FIXED_DURATIONS)),
        created_at: game.created_at,
      },
    });
  });
}

export async function gamesShow(req, res) {
  const game = await prisma.game.findUnique({
    where: { id: Number(req.params.id) || 0 },
    include: { pricings: true, organization: true },
  });
  if (!game) return res.status(404).json({ success: false, message: 'Jeu non trouvé' });

  const priceFor = (minutes) => game.pricings.find((p) => p.duration_minutes === minutes)?.price ?? 0;
  res.json({
    success: true,
    game: {
      id: game.id,
      name: game.name,
      organization_id: game.organization_id,
      organization_name: game.organization?.name ?? 'Non assigné',
      price_6min: priceFor(6),
      price_30min: priceFor(30),
      price_1h: priceFor(60),
      price_2h: priceFor(120),
      price_3h: priceFor(180),
    },
  });
}

export async function gamesUpdate(req, res) {
  const game = await prisma.game.findUnique({ where: { id: Number(req.params.id) || 0 } });
  if (!game) {
    return res.status(500).json({ success: false, message: 'Erreur lors de la modification du jeu', error: 'Jeu non trouvé' });
  }

  const data = input(req);
  await validateOrFail(data, { name: 'sometimes|required|string|max:255', ...FIXED_PRICE_RULES('sometimes|required|') });

  await tryOr500(res, 'Erreur lors de la modification du jeu', async () => {
    const updated = await prisma.$transaction(async (tx) => {
      const g = has(data, 'name') ? await tx.game.update({ where: { id: game.id }, data: { name: data.name } }) : game;
      for (const [field, minutes] of Object.entries(FIXED_DURATIONS)) {
        if (has(data, field)) await upsertFixedPricing(tx, game.id, minutes, data[field]);
      }
      return g;
    });
    res.json({
      success: true,
      message: 'Jeu modifié avec succès',
      game: { id: updated.id, name: updated.name, updated_at: updated.updated_at },
    });
  });
}

export async function gamesDestroy(req, res) {
  const game = await prisma.game.findUnique({ where: { id: Number(req.params.id) || 0 } });
  if (!game) {
    return res.status(500).json({ success: false, message: 'Erreur lors de la suppression du jeu', error: 'Jeu non trouvé' });
  }
  await tryOr500(res, 'Erreur lors de la suppression du jeu', async () => {
    await deleteGameCascade(game.id);
    res.json({ success: true, message: 'Jeu supprimé avec succès (avec toutes les sessions et tarifs associés)' });
  });
}

export async function pricingsStore(req, res) {
  const data = input(req);
  await validateOrFail(data, {
    pricing_mode_id: 'required|integer|exists:pricing_modes,id',
    price: 'required|numeric|min:0',
    duration_minutes: 'nullable|integer|min:1',
    matches_count: 'nullable|integer|min:1',
    description: 'nullable|string|max:255',
  });
  if (!data.duration_minutes && !data.matches_count) {
    return res.status(422).json({
      success: false,
      message: 'Veuillez spécifier soit la durée en minutes, soit le nombre de matchs',
    });
  }

  await tryOr500(res, "Erreur lors de l'ajout du tarif", async () => {
    const game = orFail(await prisma.game.findUnique({ where: { id: Number(req.params.id) || 0 } }), 'Game', req.params.id);
    const pricing = await prisma.gamePricing.create({
      data: {
        game_id: game.id,
        pricing_mode_id: Number(data.pricing_mode_id),
        duration_minutes: data.duration_minutes != null ? Number(data.duration_minutes) : null,
        matches_count: data.matches_count != null ? Number(data.matches_count) : null,
        price: Number(data.price),
        description: data.description ?? null,
      },
    });
    res.status(201).json({ success: true, message: 'Tarif ajouté avec succès', pricing });
  });
}

async function findGamePricing(res, gameId, pricingId, errorMessage) {
  const pricing = await prisma.gamePricing.findFirst({ where: { id: Number(pricingId) || 0, game_id: Number(gameId) || 0 } });
  if (!pricing) res.status(500).json({ success: false, message: errorMessage, error: 'Tarif non trouvé' });
  return pricing;
}

export async function pricingsUpdate(req, res) {
  const data = input(req);
  await validateOrFail(data, {
    price: 'required|numeric|min:0',
    duration_minutes: 'nullable|integer|min:1',
    matches_count: 'nullable|integer|min:1',
    description: 'nullable|string|max:255',
  });

  const message = 'Erreur lors de la modification du tarif';
  const pricing = await findGamePricing(res, req.params.gameId, req.params.pricingId, message);
  if (!pricing) return;

  const updated = await prisma.gamePricing.update({
    where: { id: pricing.id },
    data: {
      price: Number(data.price),
      duration_minutes: data.duration_minutes != null ? Number(data.duration_minutes) : null,
      matches_count: data.matches_count != null ? Number(data.matches_count) : null,
      description: data.description ?? null,
    },
  });
  res.json({ success: true, message: 'Tarif modifié avec succès', pricing: updated });
}

export async function pricingsDestroy(req, res) {
  const message = 'Erreur lors de la suppression du tarif';
  const pricing = await findGamePricing(res, req.params.gameId, req.params.pricingId, message);
  if (!pricing) return;

  await tryOr500(res, message, async () => {
    await prisma.$transaction([
      prisma.gameSession.deleteMany({ where: { pricing_reference_id: pricing.id } }),
      prisma.gamePricing.delete({ where: { id: pricing.id } }),
    ]);
    res.json({ success: true, message: 'Tarif supprimé avec succès' });
  });
}

export async function pricingModes(req, res) {
  res.json({ success: true, pricing_modes: await prisma.pricingMode.findMany({ orderBy: { id: 'asc' } }) });
}

// ═════════════════════════════ Plans d'abonnement ═════════════════════════════

const PLAN_COUNT = { _count: { select: { subscriptions: true } } };

function withSubscriptionsCount(plan) {
  const { _count: counts, ...rest } = plan;
  return { ...rest, subscriptions_count: counts.subscriptions };
}

const PLAN_RULES = (prefix) => ({
  name: `${prefix}required|string|max:100`,
  description: 'nullable|string|max:500',
  price: `${prefix}required|numeric|min:0`,
  grace_days: 'integer|min:0|max:90',
  limits: 'nullable|array',
  features: 'nullable|array',
});

function planFields(data) {
  const fields = pick(data, ['name', 'description', 'limits', 'features']);
  if (has(data, 'price')) fields.price = Number(data.price);
  if (has(data, 'grace_days') && data.grace_days !== null) fields.grace_days = Number(data.grace_days);
  return fields;
}

export async function plansIndex(req, res) {
  const plans = await prisma.subscriptionPlan.findMany({ include: PLAN_COUNT, orderBy: [{ price: 'asc' }, { id: 'asc' }] });
  res.json({ success: true, plans: plans.map(withSubscriptionsCount) });
}

export async function plansStore(req, res) {
  const data = input(req);
  await validate(data, PLAN_RULES(''));
  const plan = await prisma.subscriptionPlan.create({ data: planFields(data) });
  res.status(201).json({ success: true, plan });
}

export async function plansShow(req, res) {
  const plan = orFail(
    await prisma.subscriptionPlan.findUnique({ where: { id: Number(req.params.id) || 0 }, include: PLAN_COUNT }),
    'SubscriptionPlan',
    req.params.id,
  );
  res.json({ success: true, plan: withSubscriptionsCount(plan) });
}

export async function plansUpdate(req, res) {
  const plan = orFail(await prisma.subscriptionPlan.findUnique({ where: { id: Number(req.params.id) || 0 } }), 'SubscriptionPlan', req.params.id);
  const data = input(req);
  await validate(data, PLAN_RULES('sometimes|'));
  const updated = await prisma.subscriptionPlan.update({ where: { id: plan.id }, data: planFields(data) });
  res.json({ success: true, plan: updated });
}

export async function plansDestroy(req, res) {
  const plan = orFail(
    await prisma.subscriptionPlan.findUnique({ where: { id: Number(req.params.id) || 0 }, include: PLAN_COUNT }),
    'SubscriptionPlan',
    req.params.id,
  );
  const count = plan._count.subscriptions;
  if (count > 0) {
    return res.status(422).json({
      success: false,
      message: `Ce plan est utilisé par ${count} abonnement(s). Supprimez-les d'abord.`,
    });
  }
  await prisma.subscriptionPlan.delete({ where: { id: plan.id } });
  res.json({ success: true, message: 'Plan supprimé' });
}

// ═════════════════════════════ Abonnements ═════════════════════════════

function formatSubscription(sub) {
  const state = subscriptionState(sub);
  return {
    id: sub.id,
    organization_id: sub.organization_id,
    plan_id: sub.subscription_plan_id,
    organization: sub.organization,
    plan: sub.plan,
    starts_at: sub.starts_at,
    ends_at: sub.ends_at,
    grace_days: sub.grace_days,
    is_active: sub.is_active,
    notes: sub.notes,
    is_expired: state.is_expired,
    in_grace_period: state.in_grace_period,
    days_remaining: state.days_remaining,
    is_blocked: state.is_blocked,
    created_at: sub.created_at,
  };
}

const SUB_INCLUDE = { organization: true, plan: true };

const findSubscription = async (id) =>
  orFail(await prisma.subscription.findUnique({ where: { id: Number(id) || 0 } }), 'Subscription', id);

export async function subscriptionsIndex(req, res) {
  const subs = await prisma.subscription.findMany({ include: SUB_INCLUDE, orderBy: [{ created_at: 'desc' }, { id: 'desc' }] });
  res.json({ success: true, subscriptions: subs.map(formatSubscription) });
}

export async function subscriptionsStore(req, res) {
  const data = input(req);
  await validate(data, {
    organization_id: 'required|exists:organizations,id',
    plan_id: 'required|exists:subscription_plans,id',
    starts_at: 'required|date',
    ends_at: 'nullable|date|after_or_equal:starts_at',
    grace_days: 'integer|min:0|max:90',
    is_active: 'boolean',
    notes: 'nullable|string|max:1000',
  });

  const sub = await prisma.subscription.create({
    data: {
      organization_id: Number(data.organization_id),
      subscription_plan_id: Number(data.plan_id),
      starts_at: parseDate(data.starts_at),
      ends_at: data.ends_at ? parseDate(data.ends_at) : null,
      grace_days: data.grace_days != null ? Number(data.grace_days) : 7,
      is_active: has(data, 'is_active') && data.is_active !== null ? bool(data.is_active) : true,
      notes: data.notes ?? null,
    },
    include: SUB_INCLUDE,
  });
  res.status(201).json({ success: true, subscription: formatSubscription(sub) });
}

export async function subscriptionsShow(req, res) {
  const sub = orFail(
    await prisma.subscription.findUnique({ where: { id: Number(req.params.id) || 0 }, include: SUB_INCLUDE }),
    'Subscription',
    req.params.id,
  );
  res.json({ success: true, subscription: formatSubscription(sub) });
}

export async function subscriptionsUpdate(req, res) {
  const sub = await findSubscription(req.params.id);
  const data = input(req);
  await validate(data, {
    plan_id: 'sometimes|exists:subscription_plans,id',
    starts_at: 'sometimes|date',
    ends_at: 'nullable|date',
    grace_days: 'integer|min:0|max:90',
    is_active: 'boolean',
    notes: 'nullable|string|max:1000',
  });

  const changes = {};
  if (has(data, 'plan_id')) changes.subscription_plan_id = Number(data.plan_id);
  if (has(data, 'starts_at')) changes.starts_at = parseDate(data.starts_at);
  if (has(data, 'ends_at')) changes.ends_at = data.ends_at ? parseDate(data.ends_at) : null;
  if (has(data, 'grace_days') && data.grace_days !== null) changes.grace_days = Number(data.grace_days);
  if (has(data, 'is_active')) changes.is_active = bool(data.is_active);
  if (has(data, 'notes')) changes.notes = data.notes;

  const updated = await prisma.subscription.update({ where: { id: sub.id }, data: changes, include: SUB_INCLUDE });
  res.json({ success: true, subscription: formatSubscription(updated) });
}

export async function subscriptionsToggle(req, res) {
  const sub = await findSubscription(req.params.id);
  const updated = await prisma.subscription.update({
    where: { id: sub.id },
    data: { is_active: !sub.is_active },
    include: SUB_INCLUDE,
  });
  res.json({ success: true, subscription: formatSubscription(updated) });
}

/** Statut de l'abonnement de l'organisation de l'utilisateur connecté (non bloquant). */
export async function subscriptionStatus(req, res) {
  const user = req.user;
  if (!user.organization_id) {
    return res.json({
      subscription: null,
      is_active: true,
      is_expired: false,
      in_grace_period: false,
      grace_days_remaining: 0,
      days_remaining: null,
      is_blocked: false,
    });
  }

  const sub = await prisma.subscription.findFirst({
    where: { organization_id: user.organization_id },
    include: { plan: true },
    orderBy: [{ created_at: 'desc' }, { id: 'desc' }],
  });
  if (!sub) {
    return res.json({
      subscription: null,
      is_active: false,
      is_expired: false,
      in_grace_period: false,
      grace_days_remaining: 0,
      days_remaining: null,
      is_blocked: true,
    });
  }

  const state = subscriptionState(sub);
  res.json({
    subscription: {
      id: sub.id,
      plan: sub.plan,
      starts_at: sub.starts_at,
      ends_at: sub.ends_at,
      grace_days: sub.grace_days,
      is_active: sub.is_active,
      cancel_at_period_end: sub.cancel_at_period_end,
      is_recurring: Boolean(sub.stripe_subscription_id),
    },
    is_active: sub.is_active,
    ...state,
  });
}

// ═════════════════════════════ Factures ═════════════════════════════

export async function invoicesIndex(req, res) {
  const data = input(req);
  const where = {};
  if (filled(data, 'organization_id')) where.organization_id = Number(data.organization_id);
  if (filled(data, 'date_from') || filled(data, 'date_to')) {
    where.paid_at = dateBetween(data.date_from ?? null, data.date_to ?? null);
  }

  const limit = Math.min(Number.parseInt(data.limit ?? 25, 10) || 25, 100);
  const page = Math.max(Number.parseInt(data.page ?? 1, 10) || 1, 1);

  const [total, invoices, revenue] = await Promise.all([
    prisma.subscriptionInvoice.count({ where }),
    prisma.subscriptionInvoice.findMany({
      where,
      include: { organization: { select: { id: true, name: true } } },
      orderBy: [{ paid_at: { sort: 'desc', nulls: 'last' } }, { id: 'desc' }],
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.subscriptionInvoice.aggregate({ where: { ...where, status: 'paid' }, _sum: { amount: true } }),
  ]);

  res.json({
    success: true,
    invoices,
    total,
    page,
    limit,
    last_page: Math.max(1, Math.ceil(total / limit)),
    total_revenue: Number(revenue._sum.amount ?? 0),
  });
}

// ═════════════════════════════ Statistiques globales ═════════════════════════════

const countBy = (rows, key) =>
  rows.reduce((acc, row) => {
    const k = typeof key === 'function' ? key(row) : row[key];
    acc[k] = (acc[k] ?? 0) + 1;
    return acc;
  }, {});

export async function stats(req, res) {
  const [users, machines, games, totalPricings, totalGameTypes, products] = await Promise.all([
    prisma.user.findMany({ select: { role: true, created_at: true } }),
    prisma.machine.findMany({ select: { status: true } }),
    prisma.game.findMany({ select: { active: true, type: { select: { name: true } }, _count: { select: { pricings: true } } } }),
    prisma.gamePricing.count(),
    prisma.gameType.count(),
    prisma.product.findMany({ select: { is_available: true, stock: true, category: true } }),
  ]);

  const weekAgo = addDays(new Date(), -7);
  const withPricings = games.filter((g) => g._count.pricings > 0).length;

  res.json({
    success: true,
    stats: {
      users: {
        total: users.length,
        by_role: countBy(users, 'role'),
        recent_7_days: users.filter((u) => u.created_at && u.created_at >= weekAgo).length,
      },
      machines: { total: machines.length, by_status: countBy(machines, 'status') },
      games: {
        total: games.length,
        active: games.filter((g) => g.active).length,
        inactive: games.filter((g) => !g.active).length,
        by_type: countBy(games, (g) => g.type?.name ?? 'Non catégorisé'),
      },
      pricings: {
        total: totalPricings,
        games_with_pricings: withPricings,
        games_without_pricings: games.length - withPricings,
      },
      game_types: { total: totalGameTypes },
      products: {
        total: products.length,
        available: products.filter((p) => p.is_available).length,
        out_of_stock: products.filter((p) => p.stock <= 0).length,
        low_stock: products.filter((p) => p.stock > 0 && p.stock <= 5).length,
        by_category: countBy(products, 'category'),
      },
    },
  });
}

