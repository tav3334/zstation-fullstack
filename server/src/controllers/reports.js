// Rapports admin sur l'équipe : performance par employé / coiffeur et journal d'activité.
import { prisma } from '../lib/prisma.js';
import { filled, input, round2 } from '../lib/http.js';
import { orgScope } from '../lib/org.js';
import { dateBetween, toDateString } from '../lib/dates.js';

/** Période demandée, par défaut le mois en cours. */
function periodOf(data) {
  const now = new Date();
  const from = data.date_from ?? toDateString(new Date(now.getFullYear(), now.getMonth(), 1));
  const to = data.date_to ?? toDateString(now);
  return { from, to, range: dateBetween(from, to) };
}

const emptyStats = () => ({ tickets: 0, revenue: 0, discount: 0, cancelled: 0, cancelled_amount: 0, gaming_revenue: 0, gaming_sessions: 0 });

function addSale(stats, sale) {
  if (sale.cancelled_at) {
    stats.cancelled += 1;
    stats.cancelled_amount = round2(stats.cancelled_amount + Number(sale.total));
    return;
  }
  stats.tickets += 1;
  stats.revenue = round2(stats.revenue + Number(sale.total));
  stats.discount = round2(stats.discount + Number(sale.discount));
}

const finish = (stats) => ({
  ...stats,
  average: stats.tickets ? round2(stats.revenue / stats.tickets) : 0,
  total_revenue: round2(stats.revenue + stats.gaming_revenue),
});

export async function staffPerformance(req, res) {
  const data = input(req);
  const { from, to, range } = periodOf(data);
  const orgId = req.user.organization_id;

  const [users, coiffeurs, sales, payments] = await Promise.all([
    prisma.user.findMany({
      where: { organization_id: orgId, role: { in: ['admin', 'agent'] } },
      select: { id: true, name: true, role: true, is_active: true },
      orderBy: { name: 'asc' },
    }),
    prisma.coiffeur.findMany({ where: orgScope(req), select: { id: true, name: true }, orderBy: { name: 'asc' } }),
    prisma.sale.findMany({
      where: orgScope(req, { sale_date: range }),
      select: { staff_id: true, coiffeur_id: true, total: true, discount: true, cancelled_at: true },
    }),
    prisma.payment.findMany({ where: orgScope(req, { payment_date: range }), select: { staff_id: true, amount: true } }),
  ]);

  const byStaff = new Map(users.map((u) => [u.id, emptyStats()]));
  const byCoiffeur = new Map(coiffeurs.map((c) => [c.id, emptyStats()]));

  for (const sale of sales) {
    if (sale.staff_id && byStaff.has(sale.staff_id)) addSale(byStaff.get(sale.staff_id), sale);
    if (sale.coiffeur_id && byCoiffeur.has(sale.coiffeur_id)) addSale(byCoiffeur.get(sale.coiffeur_id), sale);
  }
  for (const p of payments) {
    const stats = p.staff_id ? byStaff.get(p.staff_id) : null;
    if (!stats) continue;
    stats.gaming_sessions += 1;
    stats.gaming_revenue = round2(stats.gaming_revenue + Number(p.amount));
  }

  res.json({
    date_from: from,
    date_to: to,
    staff: users
      .map((u) => ({ ...u, ...finish(byStaff.get(u.id)) }))
      .sort((a, b) => b.total_revenue - a.total_revenue),
    coiffeurs: coiffeurs
      .map((c) => ({ ...c, ...finish(byCoiffeur.get(c.id)) }))
      .sort((a, b) => b.revenue - a.revenue),
  });
}

export async function activityLogs(req, res) {
  const data = input(req);
  const where = { organization_id: req.user.organization_id };
  if (filled(data, 'user_id')) where.user_id = Number(data.user_id);
  if (filled(data, 'action')) where.action = String(data.action);
  if (filled(data, 'date_from') || filled(data, 'date_to')) {
    where.created_at = dateBetween(data.date_from ?? null, data.date_to ?? null);
  }

  const limit = Math.min(Number.parseInt(data.limit ?? 50, 10) || 50, 200);
  const page = Math.max(Number.parseInt(data.page ?? 1, 10) || 1, 1);

  const [total, logs] = await Promise.all([
    prisma.activityLog.count({ where }),
    prisma.activityLog.findMany({
      where,
      include: { user: { select: { id: true, name: true } } },
      orderBy: [{ created_at: 'desc' }, { id: 'desc' }],
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);

  res.json({ logs, total, page, last_page: Math.max(1, Math.ceil(total / limit)) });
}
