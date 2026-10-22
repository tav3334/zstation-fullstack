// Gestion par l'admin de son organisation : équipe, infos fiscales, machines, jeux et tarifs
// (TeamController, OrganizationSettingsController, MachineManagementController, GameManagementController).
import { prisma } from '../lib/prisma.js';
import { bool, has, input, orFail, pick } from '../lib/http.js';
import { validate, validateOrFail } from '../lib/validate.js';
import { checkLimit } from '../lib/limits.js';
import { hashPassword } from '../lib/auth.js';

// ═════════════════════════════ Équipe ═════════════════════════════

const TEAM_SELECT = { id: true, name: true, email: true, role: true, created_at: true };

export async function teamIndex(req, res) {
  const orgId = req.user.organization_id;
  const team = await prisma.user.findMany({
    where: { organization_id: orgId, role: { in: ['admin', 'agent'] } },
    orderBy: { name: 'asc' },
    select: TEAM_SELECT,
  });
  const limit = await checkLimit(orgId, 'max_users');
  res.json({ team, count: team.length, limit_message: limit.allowed ? null : limit.message });
}

export async function teamStore(req, res) {
  const data = input(req);
  await validate(data, {
    name: 'required|string|max:255',
    email: 'required|email|unique:users',
    password: 'required|min:6',
    role: 'required|in:admin,agent',
  });

  const orgId = req.user.organization_id;
  const limit = await checkLimit(orgId, 'max_users');
  if (!limit.allowed) return res.status(403).json({ message: limit.message });

  const user = await prisma.user.create({
    data: { name: data.name, email: data.email, password: await hashPassword(data.password), role: data.role, organization_id: orgId },
    select: TEAM_SELECT,
  });
  res.status(201).json({ message: "Membre de l'équipe créé avec succès", user });
}

export async function teamDestroy(req, res) {
  const id = Number(req.params.id);
  if (id === req.user.id) {
    return res.status(403).json({ message: 'Vous ne pouvez pas supprimer votre propre compte.' });
  }
  const user = orFail(
    await prisma.user.findFirst({
      where: { id, organization_id: req.user.organization_id, role: { in: ['admin', 'agent'] } },
    }),
    'User',
    req.params.id,
  );
  await prisma.user.delete({ where: { id: user.id } });
  res.json({ message: "Membre de l'équipe supprimé avec succès" });
}

// ═════════════════════════════ Infos fiscales / légales ═════════════════════════════

async function currentOrganization(req, res) {
  const org = req.user.organization_id
    ? await prisma.organization.findUnique({ where: { id: req.user.organization_id } })
    : null;
  if (!org) res.status(404).json({ message: 'Aucune organisation associée à votre compte.' });
  return org;
}

export async function organizationShow(req, res) {
  const organization = await currentOrganization(req, res);
  if (organization) res.json({ organization });
}

export async function organizationUpdate(req, res) {
  const organization = await currentOrganization(req, res);
  if (!organization) return;

  const data = input(req);
  await validate(data, {
    name: 'sometimes|string|max:255',
    address: 'nullable|string|max:255',
    phone: 'nullable|string|max:20',
    email: 'nullable|email|max:255',
    ice: 'nullable|string|max:20',
    rc: 'nullable|string|max:30',
    if_number: 'nullable|string|max:30',
    patente: 'nullable|string|max:30',
    tva_enabled: 'boolean',
    tva_rate: 'nullable|numeric|min:0|max:100',
  });

  const changes = pick(data, ['name', 'address', 'phone', 'email', 'ice', 'rc', 'if_number', 'patente']);
  if (has(data, 'tva_enabled')) changes.tva_enabled = bool(data.tva_enabled);
  if (data.tva_rate != null) changes.tva_rate = Number(data.tva_rate);

  const updated = await prisma.organization.update({ where: { id: organization.id }, data: changes });
  res.json({ message: 'Informations mises à jour avec succès', organization: updated });
}

// ═════════════════════════════ Machines ═════════════════════════════

const MACHINE_STATUSES = 'available,in_session,maintenance';

function findOwnMachine(req) {
  return prisma.machine
    .findFirst({ where: { id: Number(req.params.id), organization_id: req.user.organization_id } })
    .then((m) => orFail(m, 'Machine', req.params.id));
}

export async function machinesIndex(req, res) {
  const machines = await prisma.machine.findMany({
    where: { organization_id: req.user.organization_id },
    orderBy: { id: 'asc' },
  });
  res.json({
    success: true,
    machines: machines.map((m) => ({ id: m.id, type: m.name ?? 'Standard', status: m.status, created_at: m.created_at })),
  });
}

export async function machinesStore(req, res) {
  const data = input(req);
  await validateOrFail(data, { type: 'nullable|string|max:255', status: `nullable|in:${MACHINE_STATUSES}` });

  const orgId = req.user.organization_id;
  const limit = await checkLimit(orgId, 'max_machines');
  if (!limit.allowed) return res.status(403).json({ success: false, message: limit.message });

  const machine = await prisma.machine.create({
    data: { name: data.type ?? 'Standard', status: data.status ?? 'available', organization_id: orgId },
  });
  res.status(201).json({
    success: true,
    message: 'Machine créée avec succès',
    machine: { id: machine.id, type: machine.name, status: machine.status },
  });
}

export async function machinesUpdate(req, res) {
  const machine = await findOwnMachine(req);
  const data = input(req);
  await validateOrFail(data, { type: 'sometimes|nullable|string|max:255', status: `sometimes|required|in:${MACHINE_STATUSES}` });

  const changes = {};
  if (has(data, 'type')) changes.name = data.type ?? 'Standard';
  if (has(data, 'status')) changes.status = data.status;
  const updated = await prisma.machine.update({ where: { id: machine.id }, data: changes });

  res.json({
    success: true,
    message: 'Machine modifiée avec succès',
    machine: { id: updated.id, type: updated.name, status: updated.status },
  });
}

export async function machinesDestroy(req, res) {
  const machine = await findOwnMachine(req);
  const active = await prisma.gameSession.findFirst({ where: { machine_id: machine.id, ended_at: null } });
  if (active) {
    return res.status(403).json({ success: false, message: 'Impossible de supprimer une machine avec une session active' });
  }
  await prisma.machine.delete({ where: { id: machine.id } });
  res.json({ success: true, message: 'Machine supprimée avec succès' });
}

// ═════════════════════════════ Jeux et tarifs ═════════════════════════════

/** Tarifs forfaitaires standards : champ du formulaire → durée en minutes. */
export const FIXED_DURATIONS = { price_6min: 6, price_30min: 30, price_1h: 60, price_2h: 120, price_3h: 180 };

export const FIXED_PRICE_RULES = (prefix) =>
  Object.fromEntries(Object.keys(FIXED_DURATIONS).map((k) => [k, `${prefix}numeric|min:0`]));

export async function fixedPricingModeId(tx = prisma) {
  const mode = (await tx.pricingMode.findFirst({ where: { code: 'fixed' } })) ?? (await tx.pricingMode.findFirst());
  return mode?.id ?? 1;
}

export async function defaultGameTypeId(tx = prisma) {
  const type = (await tx.gameType.findFirst({ orderBy: { id: 'asc' } })) ?? (await tx.gameType.create({ data: { name: 'Standard' } }));
  return type.id;
}

/** updateOrCreate du tarif forfaitaire (game_id, duration_minutes). */
export async function upsertFixedPricing(tx, gameId, minutes, price) {
  const pricingModeId = (await tx.pricingMode.findFirst({ where: { code: 'fixed' } }))?.id ?? 1;
  const existing = await tx.gamePricing.findFirst({ where: { game_id: gameId, duration_minutes: minutes } });
  if (existing) {
    await tx.gamePricing.update({ where: { id: existing.id }, data: { price: Number(price), pricing_mode_id: pricingModeId } });
  } else {
    await tx.gamePricing.create({
      data: { game_id: gameId, duration_minutes: minutes, price: Number(price), pricing_mode_id: pricingModeId },
    });
  }
}

/** Crée un jeu avec ses 5 tarifs forfaitaires (utilisé par l'admin et le super admin). */
export function createGameWithPricings(data, organizationId) {
  return prisma.$transaction(async (tx) => {
    const pricingModeId = await fixedPricingModeId(tx);
    return tx.game.create({
      data: {
        name: data.name,
        active: true,
        game_type_id: await defaultGameTypeId(tx),
        organization_id: organizationId,
        pricings: {
          create: Object.entries(FIXED_DURATIONS).map(([field, minutes]) => ({
            pricing_mode_id: pricingModeId,
            duration_minutes: minutes,
            price: Number(data[field]),
          })),
        },
      },
      include: { organization: true },
    });
  });
}

function findOwnGame(req, id = req.params.id) {
  return prisma.game
    .findFirst({ where: { id: Number(id), organization_id: req.user.organization_id } })
    .then((g) => orFail(g, 'Game', id));
}

export async function gamesIndex(req, res) {
  const games = await prisma.game.findMany({
    where: { organization_id: req.user.organization_id },
    include: { pricings: { include: { pricing_mode: true }, orderBy: { id: 'asc' } } },
    orderBy: [{ created_at: 'desc' }, { id: 'desc' }],
  });

  res.json({
    success: true,
    games: games.map((game) => {
      const priceFor = (minutes) => game.pricings.find((p) => p.duration_minutes === minutes)?.price ?? 0;
      return {
        id: game.id,
        name: game.name,
        active: game.active,
        price_6min: priceFor(6),
        price_30min: priceFor(30),
        price_1h: priceFor(60),
        price_2h: priceFor(120),
        price_3h: priceFor(180),
        match_pricings: game.pricings
          .filter((p) => p.matches_count !== null)
          .map((p) => ({ id: p.id, matches_count: p.matches_count, price: p.price, description: p.description })),
        created_at: game.created_at,
      };
    }),
  });
}

export async function gamesStore(req, res) {
  const data = input(req);
  await validateOrFail(data, { name: 'required|string|max:255', ...FIXED_PRICE_RULES('required|') });

  const orgId = req.user.organization_id;
  const limit = await checkLimit(orgId, 'max_games');
  if (!limit.allowed) return res.status(403).json({ success: false, message: limit.message });

  try {
    const game = await createGameWithPricings(data, orgId);
    res.status(201).json({
      success: true,
      message: 'Jeu créé avec succès',
      game: { id: game.id, name: game.name, ...pick(data, Object.keys(FIXED_DURATIONS)) },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erreur lors de la création du jeu', error: err.message });
  }
}

export async function gamesUpdate(req, res) {
  const game = await findOwnGame(req);
  const data = input(req);
  await validateOrFail(data, { name: 'sometimes|required|string|max:255', ...FIXED_PRICE_RULES('sometimes|required|') });

  try {
    const updated = await prisma.$transaction(async (tx) => {
      const g = has(data, 'name') ? await tx.game.update({ where: { id: game.id }, data: { name: data.name } }) : game;
      for (const [field, minutes] of Object.entries(FIXED_DURATIONS)) {
        if (has(data, field)) await upsertFixedPricing(tx, game.id, minutes, data[field]);
      }
      return g;
    });
    res.json({ success: true, message: 'Jeu modifié avec succès', game: { id: updated.id, name: updated.name } });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erreur lors de la modification du jeu', error: err.message });
  }
}

/** Supprime un jeu, ses sessions et ses tarifs. */
export function deleteGameCascade(gameId) {
  return prisma.$transaction([
    prisma.gameSession.deleteMany({ where: { game_id: gameId } }),
    prisma.gamePricing.deleteMany({ where: { game_id: gameId } }),
    prisma.game.delete({ where: { id: gameId } }),
  ]);
}

export async function gamesDestroy(req, res) {
  const game = await findOwnGame(req);
  try {
    await deleteGameCascade(game.id);
    res.json({ success: true, message: 'Jeu supprimé avec succès' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erreur lors de la suppression du jeu', error: err.message });
  }
}

const MATCH_PRICING_RULES = {
  matches_count: 'required|integer|min:1',
  price: 'required|numeric|min:0',
  description: 'nullable|string|max:255',
};

export async function matchPricingStore(req, res) {
  const game = await findOwnGame(req, req.params.gameId);
  const data = input(req);
  await validateOrFail(data, MATCH_PRICING_RULES);

  const mode = await prisma.pricingMode.findFirst({ where: { code: 'per_match' } });
  const pricing = await prisma.gamePricing.create({
    data: {
      game_id: game.id,
      pricing_mode_id: mode?.id ?? 1,
      matches_count: Number(data.matches_count),
      price: Number(data.price),
      description: data.description ?? null,
    },
  });
  res.status(201).json({ success: true, message: 'Tarif par match ajouté avec succès', pricing });
}

function findMatchPricing(gameId, pricingId) {
  return prisma.gamePricing
    .findFirst({ where: { id: Number(pricingId), game_id: Number(gameId), matches_count: { not: null } } })
    .then((p) => orFail(p, 'GamePricing', pricingId));
}

export async function matchPricingUpdate(req, res) {
  await findOwnGame(req, req.params.gameId);
  const data = input(req);
  await validateOrFail(data, MATCH_PRICING_RULES);

  const pricing = await findMatchPricing(req.params.gameId, req.params.pricingId);
  const updated = await prisma.gamePricing.update({
    where: { id: pricing.id },
    data: { matches_count: Number(data.matches_count), price: Number(data.price), description: data.description ?? null },
  });
  res.json({ success: true, message: 'Tarif par match modifié avec succès', pricing: updated });
}

export async function matchPricingDestroy(req, res) {
  await findOwnGame(req, req.params.gameId);
  const pricing = await findMatchPricing(req.params.gameId, req.params.pricingId);
  try {
    await prisma.$transaction([
      prisma.gameSession.deleteMany({ where: { pricing_reference_id: pricing.id } }),
      prisma.gamePricing.delete({ where: { id: pricing.id } }),
    ]);
    res.json({ success: true, message: 'Tarif par match supprimé avec succès' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erreur lors de la suppression du tarif', error: err.message });
  }
}
