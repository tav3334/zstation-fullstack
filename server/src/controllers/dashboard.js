// Statistiques du tableau de bord admin (DashboardController).
import { prisma } from '../lib/prisma.js';
import { input, round2 } from '../lib/http.js';
import { orgScope } from '../lib/org.js';
import { addDays, addMonths, dayRange, endOfDay, startOfDay, toDateString, today } from '../lib/dates.js';

const sum = (rows, fn) => rows.reduce((acc, row) => acc + Number(fn(row) ?? 0), 0);

function dateFromPeriod(period) {
  const now = new Date();
  switch (period) {
    case 'today': return today();
    case 'week': return addDays(now, -7);
    case 'month': return addMonths(now, -1);
    case 'year': return addMonths(now, -12);
    default: return null; // depuis toujours
  }
}

/** Période demandée : start_date/end_date explicites, sinon `period` (today, week, month, year, all). */
function resolveRange(data) {
  if (data.start_date != null && data.end_date != null) {
    return { from: startOfDay(data.start_date), to: endOfDay(data.end_date) };
  }
  return { from: dateFromPeriod(data.period ?? 'today'), to: null };
}

function rangeFilter({ from, to }) {
  if (!from) return undefined;
  return to ? { gte: from, lte: to } : { gte: from };
}

/** Additionne des lignes groupées par une clé, en conservant l'ordre d'apparition. */
function groupSum(rows, keyFn, valueFn) {
  const groups = new Map();
  for (const row of rows) {
    const key = keyFn(row);
    groups.set(key, round2((groups.get(key) ?? 0) + valueFn(row)));
  }
  return groups;
}

export async function stats(req, res) {
  const data = input(req);
  const period = data.period ?? 'today';
  const range = resolveRange(data);
  const dateFilter = rangeFilter(range);

  const paymentWhere = orgScope(req, dateFilter ? { payment_date: dateFilter } : {});
  const legacyWhere = orgScope(req, dateFilter ? { sale_date: dateFilter } : {});
  const saleWhere = { sale: orgScope(req, { cancelled_at: null, ...(dateFilter ? { sale_date: dateFilter } : {}) }) };
  const sessionWhere = orgScope(req, dateFilter ? { start_time: dateFilter } : {});

  const [payments, legacySales, productLines, serviceLines, sessions] = await Promise.all([
    prisma.payment.findMany({ where: paymentWhere, select: { amount: true, payment_method: true } }),
    prisma.productSale.findMany({ where: legacyWhere, include: { product: { select: { name: true, size: true, category: true } } } }),
    prisma.saleProduct.findMany({
      where: saleWhere,
      include: { sale: { select: { payment_method: true } }, stock_product: { select: { category: true } } },
    }),
    prisma.saleService.findMany({ where: saleWhere }),
    prisma.gameSession.findMany({
      where: sessionWhere,
      select: { game_id: true, computed_price: true, start_time: true, ended_at: true, game: { select: { name: true } } },
    }),
  ]);

  const lineTotal = (l) => Number(l.unit_price) * Number(l.quantity);
  const totalRevenue = round2(sum(payments, (p) => p.amount));
  const productRevenue = round2(sum(legacySales, (s) => s.total_price) + sum(productLines, lineTotal));
  const serviceRevenue = round2(sum(serviceLines, lineTotal));

  const machines = await prisma.machine.findMany({ where: orgScope(req), select: { id: true } });
  const activeSessions = await prisma.gameSession.findMany({
    where: orgScope(req, { ended_at: null }),
    select: { machine_id: true },
  });
  const busyMachines = new Set(activeSessions.map((s) => s.machine_id));

  const paymentsToday = await prisma.payment.count({ where: orgScope(req, { payment_date: dayRange(today()) }) });

  // Top jeux (par nombre de sessions)
  const games = new Map();
  for (const s of sessions) {
    const entry = games.get(s.game_id) ?? { game_id: s.game_id, game_name: s.game?.name ?? 'N/A', sessions_count: 0, total_revenue: 0 };
    entry.sessions_count += 1;
    entry.total_revenue = round2(entry.total_revenue + Number(s.computed_price ?? 0));
    games.set(s.game_id, entry);
  }
  const topGames = [...games.values()].sort((a, b) => b.sessions_count - a.sessions_count).slice(0, 5);

  // Revenus des 7 derniers jours
  const lastWeekPayments = await prisma.payment.findMany({
    where: orgScope(req, { payment_date: { gte: addDays(new Date(), -7) } }),
    select: { amount: true, payment_date: true },
  });
  const daily = groupSum(lastWeekPayments, (p) => toDateString(p.payment_date), (p) => Number(p.amount));
  const dailyRevenue = [...daily.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, total]) => ({ date, total }));

  // Durée moyenne des sessions terminées (minutes)
  const finished = sessions.filter((s) => s.ended_at && s.start_time);
  const avgDuration = finished.length ? sum(finished, (s) => (s.ended_at - s.start_time) / 60_000) / finished.length : 0;

  // Top produits (anciennes ventes gaming + lignes de tickets)
  const productStats = new Map();
  const addProduct = (name, category, quantity, revenue) => {
    const entry = productStats.get(name) ?? { product_name: name, category, total_quantity: 0, total_revenue: 0 };
    entry.total_quantity = round2(entry.total_quantity + quantity);
    entry.total_revenue = round2(entry.total_revenue + revenue);
    productStats.set(name, entry);
  };
  for (const s of legacySales) {
    const name = s.product?.size ? `${s.product.name} (${s.product.size})` : s.product?.name ?? 'N/A';
    addProduct(name, s.product?.category ?? 'N/A', s.quantity, Number(s.total_price));
  }
  for (const l of productLines) addProduct(l.product_name, l.stock_product?.category ?? 'N/A', Number(l.quantity), lineTotal(l));
  const topProducts = [...productStats.values()].sort((a, b) => b.total_quantity - a.total_quantity).slice(0, 5);

  // Top prestations
  const serviceStats = new Map();
  for (const l of serviceLines) {
    const entry = serviceStats.get(l.service_name) ?? { service_name: l.service_name, total_quantity: 0, total_revenue: 0 };
    entry.total_quantity += l.quantity;
    entry.total_revenue = round2(entry.total_revenue + lineTotal(l));
    serviceStats.set(l.service_name, entry);
  }
  const topServices = [...serviceStats.values()].sort((a, b) => b.total_quantity - a.total_quantity).slice(0, 5);

  const revenueByMethod = [...groupSum(payments, (p) => p.payment_method, (p) => Number(p.amount)).entries()]
    .map(([method, total]) => ({ method, total }));

  const productByMethod = groupSum(
    [
      ...legacySales.map((s) => ({ method: s.payment_method, total: Number(s.total_price) })),
      ...productLines.map((l) => ({ method: l.sale.payment_method, total: lineTotal(l) })),
    ],
    (r) => r.method,
    (r) => r.total,
  );

  res.json({
    period,
    stats: {
      total_revenue: totalRevenue,
      product_revenue: productRevenue,
      service_revenue: serviceRevenue,
      total_combined_revenue: round2(totalRevenue + productRevenue + serviceRevenue),
      total_sessions: sessions.length,
      total_product_sales: legacySales.length + productLines.length,
      total_service_sales: serviceLines.length,
      active_sessions: activeSessions.length,
      available_machines: machines.filter((m) => !busyMachines.has(m.id)).length,
      total_machines: machines.length,
      payments_today: paymentsToday,
      avg_session_duration: round2(avgDuration),
    },
    revenue_by_method: revenueByMethod,
    product_revenue_by_method: [...productByMethod.entries()].map(([method, total]) => ({ method, total })),
    top_games: topGames,
    top_products: topProducts,
    top_services: topServices,
    daily_revenue: dailyRevenue,
  });
}

export async function payments(req, res) {
  const data = input(req);
  const limit = Math.max(1, Number(data.limit ?? 20) || 20);
  const dateFilter = rangeFilter(resolveRange(data));

  const list = await prisma.payment.findMany({
    where: orgScope(req, dateFilter ? { payment_date: dateFilter } : {}),
    include: {
      session: { select: { game: { select: { id: true, name: true } }, machine: { select: { id: true, name: true } } } },
      staff: { select: { id: true, name: true } },
    },
    orderBy: { payment_date: 'desc' },
    take: limit,
  });

  res.json({
    payments: list.map((p) => ({
      id: p.id,
      amount: Number(p.amount),
      amount_given: Number(p.amount_given ?? 0),
      change_given: Number(p.change_given),
      payment_method: p.payment_method,
      payment_date: p.payment_date.toISOString(),
      game_name: p.session?.game?.name ?? 'N/A',
      machine_name: p.session?.machine?.name ?? 'N/A',
      staff_name: p.staff?.name ?? 'N/A',
      notes: p.notes,
    })),
  });
}

export async function sessions(req, res) {
  const data = input(req);
  const limit = Math.max(1, Number(data.limit ?? 20) || 20);
  const status = data.status ?? 'all';
  const dateFilter = rangeFilter(resolveRange(data));

  const where = orgScope(req, dateFilter ? { start_time: dateFilter } : {});
  if (status === 'active') where.ended_at = null;
  else if (status === 'completed') where.ended_at = { not: null };

  const list = await prisma.gameSession.findMany({
    where,
    include: {
      game: { select: { id: true, name: true } },
      machine: { select: { id: true, name: true } },
      customer: { select: { id: true, name: true, phone: true } },
    },
    orderBy: { start_time: { sort: 'desc', nulls: 'last' } },
    take: limit,
  });

  res.json({
    sessions: list.map((s) => ({
      id: s.id,
      game_name: s.game?.name ?? 'N/A',
      machine_name: s.machine?.name ?? 'N/A',
      customer_name: s.customer?.name ?? 'N/A',
      customer_phone: s.customer?.phone ?? null,
      start_time: s.start_time?.toISOString() ?? null,
      ended_at: s.ended_at?.toISOString() ?? null,
      duration_minutes: s.ended_at && s.start_time ? round2((s.ended_at - s.start_time) / 60_000) : null,
      computed_price: Number(s.computed_price ?? 0),
      status: s.status,
      is_active: s.ended_at === null,
    })),
  });
}
