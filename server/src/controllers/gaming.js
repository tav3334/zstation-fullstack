// Jeux, machines et sessions de jeu (GameController, MachineController, GameSessionController).
import { prisma } from '../lib/prisma.js';
import { input, orFail } from '../lib/http.js';
import { validate } from '../lib/validate.js';
import { orgScope, withOrg } from '../lib/org.js';
import { addMinutes, formatDateTime } from '../lib/dates.js';

const PRICING_ORDER = [
  { pricing_mode_id: 'asc' },
  { duration_minutes: { sort: 'asc', nulls: 'first' } },
  { matches_count: { sort: 'asc', nulls: 'first' } },
];

const MODE_SELECT = { select: { id: true, code: true, label: true } };

const elapsedSeconds = (start) => Math.max(0, Math.floor((Date.now() - start.getTime()) / 1000));

// ── Jeux ──

export async function games(req, res) {
  const list = await prisma.game.findMany({
    where: orgScope(req, { active: true }),
    orderBy: { id: 'asc' },
    select: {
      id: true,
      name: true,
      active: true,
      pricings: {
        select: {
          id: true,
          game_id: true,
          pricing_mode_id: true,
          duration_minutes: true,
          matches_count: true,
          price: true,
          description: true,
          pricing_mode: MODE_SELECT,
        },
        orderBy: PRICING_ORDER,
      },
    },
  });
  res.json(list);
}

export async function gamePricings(req, res) {
  const activeGames = await prisma.game.findMany({ where: orgScope(req, { active: true }), select: { id: true } });
  const pricings = await prisma.gamePricing.findMany({
    where: { game_id: { in: activeGames.map((g) => g.id) } },
    include: { pricing_mode: MODE_SELECT, game: { select: { id: true, name: true } } },
    orderBy: [{ game_id: 'asc' }, ...PRICING_ORDER],
  });
  res.json(pricings);
}

// ── Machines ──

/** Attribut calculé `active_session` du modèle Machine. */
export async function activeSessionsFor(req, machineIds) {
  if (!machineIds.length) return new Map();
  const sessions = await prisma.gameSession.findMany({
    where: orgScope(req, { machine_id: { in: machineIds }, ended_at: null }),
    orderBy: { start_time: { sort: 'desc', nulls: 'last' } },
    include: { game: true, game_pricing: { include: { pricing_mode: true } } },
  });

  const byMachine = new Map();
  for (const session of sessions) {
    if (byMachine.has(session.machine_id)) continue;
    const pricing = session.game_pricing;
    byMachine.set(session.machine_id, {
      id: session.id,
      start_time: session.start_time?.toISOString() ?? null,
      game_name: session.game?.name ?? 'N/A',
      price: session.computed_price,
      duration_minutes: pricing?.duration_minutes ?? null,
      duration_seconds: pricing?.duration_minutes ? pricing.duration_minutes * 60 : null,
      pricing_mode: pricing?.pricing_mode?.code ?? 'fixed',
      matches_count: pricing?.matches_count ?? null,
    });
  }
  return byMachine;
}

export async function machines(req, res) {
  const list = await prisma.machine.findMany({ where: orgScope(req), orderBy: { id: 'asc' } });
  const active = await activeSessionsFor(req, list.map((m) => m.id));
  res.json(list.map((m) => ({ ...m, active_session: active.get(m.id) ?? null })));
}

// ── Sessions ──

export async function sessions(req, res) {
  const list = await prisma.gameSession.findMany({
    where: orgScope(req),
    include: { machine: true, game: true, game_pricing: true },
    orderBy: { start_time: { sort: 'desc', nulls: 'last' } },
  });
  res.json(list);
}

export async function startSession(req, res) {
  const data = input(req);
  await validate(data, {
    machine_id: 'required|exists:machines,id',
    game_id: 'required|exists:games,id',
    game_pricing_id: 'required|exists:game_pricings,id',
  });

  const machineId = Number(data.machine_id);
  const machine = orFail(
    await prisma.machine.findFirst({ where: orgScope(req, { id: machineId }) }),
    'Machine',
    machineId,
  );

  const busy = await prisma.gameSession.findFirst({ where: orgScope(req, { machine_id: machine.id, ended_at: null }) });
  if (busy) return res.status(409).json({ message: 'Machine already in session' });

  const pricingId = Number(data.game_pricing_id);
  const gamePricing = orFail(
    await prisma.gamePricing.findUnique({ where: { id: pricingId }, include: { pricing_mode: true } }),
    'GamePricing',
    pricingId,
  );

  // start_time est toujours "maintenant" côté serveur
  const startTime = new Date();
  const session = await prisma.gameSession.create({
    data: withOrg(req, {
      machine_id: machine.id,
      game_id: Number(data.game_id),
      pricing_reference_id: pricingId,
      pricing_mode_id: gamePricing.pricing_mode_id,
      customer_id: null,
      start_time: startTime,
      status: 'active',
    }),
    include: { game: true, game_pricing: { include: { pricing_mode: true } } },
  });

  await prisma.machine.update({ where: { id: machine.id }, data: { status: 'in_session' } });

  const response = {
    message: 'Session started',
    session,
    start_time: startTime.toISOString(),
    pricing_mode: gamePricing.pricing_mode.code,
  };
  if (gamePricing.duration_minutes !== null) {
    response.will_auto_stop_at = addMinutes(startTime, gamePricing.duration_minutes).toISOString();
  }
  res.status(201).json(response);
}

export async function stopSession(req, res) {
  const id = Number(req.params.id);
  const session = orFail(
    await prisma.gameSession.findFirst({
      where: orgScope(req, { id }),
      include: { game_pricing: { include: { pricing_mode: true } }, machine: true, game: true },
    }),
    'GameSession',
    req.params.id,
  );

  if (session.ended_at) return res.status(409).json({ message: 'Session already stopped' });

  const data = input(req);
  const pricing = session.game_pricing;
  const pricingMode = pricing.pricing_mode.code;
  if (pricingMode === 'per_match') {
    await validate(data, { matches_played: 'required|integer|min:1' });
  }

  const now = new Date();
  const durationMinutes = Math.floor(elapsedSeconds(session.start_time ?? now) / 60);

  const update = { ended_at: now, status: 'completed' };
  if (pricingMode === 'per_match') {
    update.matches_played = Number(data.matches_played);
    update.computed_price = pricing.price.mul(update.matches_played);
  } else {
    update.computed_price = pricing.price;
  }

  const updated = await prisma.gameSession.update({
    where: { id: session.id },
    data: update,
    include: { machine: true, game: true, game_pricing: { include: { pricing_mode: true } } },
  });

  // Libérer la machine
  await prisma.machine.update({ where: { id: session.machine_id }, data: { status: 'available' } });
  updated.machine.status = 'available';

  const price = updated.computed_price.toFixed(2);
  const unitPrice = pricing.price.toFixed(2);
  const response = {
    message: 'Session stopped successfully',
    session: updated,
    price,
    duration_used: `${durationMinutes} min`,
    payment_ready: true,
  };
  if (pricingMode === 'per_match') {
    response.matches_played = updated.matches_played;
    response.price_per_match = `${unitPrice} DH`;
    response.calculation = `${updated.matches_played} match(s) × ${unitPrice} DH = ${price} DH`;
  } else {
    response.duration_paid = `${pricing.duration_minutes} min`;
    response.forfait = `${pricing.duration_minutes} min = ${unitPrice} DH`;
  }
  res.json(response);
}

export async function extendSession(req, res) {
  const data = input(req);
  await validate(data, { game_pricing_id: 'required|exists:game_pricings,id' });

  const id = Number(req.params.id);
  const session = orFail(
    await prisma.gameSession.findFirst({ where: orgScope(req, { id }), include: { game_pricing: true } }),
    'GameSession',
    req.params.id,
  );
  if (session.ended_at) return res.status(409).json({ message: 'Cannot extend completed session' });

  const pricingId = Number(data.game_pricing_id);
  const newPricing = orFail(await prisma.gamePricing.findUnique({ where: { id: pricingId } }), 'GamePricing', pricingId);

  const now = new Date();
  const [extendedSession, oldSession] = await prisma.$transaction([
    // Nouvelle session liée à la même machine
    prisma.gameSession.create({
      data: withOrg(req, {
        machine_id: session.machine_id,
        game_id: session.game_id,
        pricing_reference_id: newPricing.id,
        pricing_mode_id: newPricing.pricing_mode_id,
        customer_id: session.customer_id,
        start_time: now,
        status: 'active',
      }),
      include: { game: true, game_pricing: true },
    }),
    // L'ancienne session est clôturée au prix de son forfait
    prisma.gameSession.update({
      where: { id: session.id },
      data: { ended_at: now, computed_price: session.game_pricing.price, status: 'completed' },
    }),
  ]);

  res.json({
    message: 'Session extended successfully',
    old_session: oldSession,
    new_session: extendedSession,
    total_paid: Number(oldSession.computed_price) + Number(newPricing.price),
    will_auto_stop_at: addMinutes(now, newPricing.duration_minutes ?? 0).toISOString(),
  });
}

/**
 * Rapport des sessions actives. L'arrêt automatique est volontairement laissé au frontend
 * (MachineCard appelle /sessions/stop puis ouvre le paiement) : l'ancien backend ne stoppait
 * jamais côté serveur (Carbon 3 renvoyait un temps écoulé négatif), et le faire ici ferait
 * échouer le flux de paiement déclenché par le frontend (409 "already stopped").
 */
export async function checkAutoStop(req, res) {
  const active = await prisma.gameSession.findMany({
    where: orgScope(req, { ended_at: null, status: 'active' }),
    include: { game_pricing: { include: { pricing_mode: true } }, machine: true },
  });

  const debug = active.map((session) => {
    const pricingMode = session.game_pricing.pricing_mode.code;
    if (pricingMode === 'fixed' && session.game_pricing.duration_minutes !== null) {
      const durationSeconds = session.game_pricing.duration_minutes * 60;
      const elapsed = session.start_time ? elapsedSeconds(session.start_time) : 0;
      return {
        session_id: session.id,
        machine: session.machine.name,
        pricing_mode: pricingMode,
        start_time: session.start_time ? formatDateTime(session.start_time) : null,
        elapsed_seconds: elapsed,
        duration_seconds: durationSeconds,
        should_stop: elapsed >= durationSeconds,
      };
    }
    return {
      session_id: session.id,
      machine: session.machine.name,
      pricing_mode: pricingMode,
      note: 'Manual stop required (per-match pricing)',
    };
  });

  res.json({
    status: 'checked',
    total_active_sessions: active.length,
    stopped_count: 0,
    stopped_sessions: [],
    debug,
  });
}

export async function sessionStatus(req, res) {
  const id = Number(req.params.id);
  const session = orFail(
    await prisma.gameSession.findFirst({
      where: orgScope(req, { id }),
      include: { game_pricing: { include: { pricing_mode: true } }, machine: true },
    }),
    'GameSession',
    req.params.id,
  );

  if (session.ended_at) return res.json({ status: 'completed', message: 'Session terminée' });

  const pricing = session.game_pricing;
  const pricingMode = pricing.pricing_mode.code;
  const elapsed = session.start_time ? elapsedSeconds(session.start_time) : 0;

  const response = {
    status: 'active',
    pricing_mode: pricingMode,
    elapsed_seconds: elapsed,
    elapsed_minutes: Math.floor(elapsed / 60),
    machine: session.machine.name,
  };

  if (pricingMode === 'fixed' && pricing.duration_minutes !== null) {
    const remaining = Math.max(0, pricing.duration_minutes * 60 - elapsed);
    response.remaining_seconds = remaining;
    response.remaining_minutes = Math.floor(remaining / 60);
    response.will_auto_stop = remaining <= 0;
    response.forfait = `${pricing.duration_minutes} min = ${pricing.price.toFixed(2)} DH`;
  }

  if (pricingMode === 'per_match') {
    response.price_per_match = `${pricing.price.toFixed(2)} DH`;
    response.matches_count = pricing.matches_count;
    response.message = 'Saisir le nombre de matchs joués à la fin';
  }

  res.json(response);
}
