// Paiements des sessions de jeu (PaymentController).
import { prisma } from '../lib/prisma.js';
import { input, numberFormat, orFail, round2 } from '../lib/http.js';
import { validate } from '../lib/validate.js';
import { orgScope, withOrg } from '../lib/org.js';
import { addDays, dayRange, formatDate, formatTime, parseDate, today } from '../lib/dates.js';

const SESSION_WITH_MACHINE_GAME = { session: { include: { machine: true, game: true } } };
const sum = (rows, fn) => rows.reduce((acc, row) => acc + Number(fn(row) ?? 0), 0);
const withDH = (value) => `${value == null ? '' : Number(value).toFixed(2)} DH`;

export async function storePayment(req, res) {
  const data = input(req);
  await validate(data, {
    session_id: 'required|exists:game_sessions,id',
    amount_given: 'required|numeric|min:0',
  });

  const sessionId = Number(data.session_id);
  const session = orFail(
    await prisma.gameSession.findFirst({
      where: orgScope(req, { id: sessionId }),
      include: { game_pricing: true, machine: true, game: true },
    }),
    'GameSession',
    sessionId,
  );

  if (!session.ended_at) return res.status(409).json({ message: 'Cannot create payment for active session' });

  const existing = await prisma.payment.findFirst({ where: orgScope(req, { session_id: session.id }) });
  if (existing) return res.status(409).json({ message: 'Payment already exists for this session' });

  const amount = Number(session.computed_price ?? 0);
  const amountGiven = Number(data.amount_given);
  const change = round2(amountGiven - amount);

  if (change < 0) {
    return res.status(422).json({
      message: 'Montant insuffisant',
      required: session.computed_price,
      given: data.amount_given,
      missing: Math.abs(change),
    });
  }

  const now = new Date();
  const payment = await prisma.payment.create({
    data: withOrg(req, {
      session_id: session.id,
      amount,
      amount_given: amountGiven,
      change_given: change,
      payment_method: 'cash',
      payment_date: now,
      staff_id: null,
      notes: data.notes ?? null,
    }),
    include: SESSION_WITH_MACHINE_GAME,
  });

  const minutes = session.start_time ? Math.max(0, Math.floor((now - session.start_time) / 60_000)) : 0;
  res.status(201).json({
    message: 'Paiement enregistré avec succès',
    payment,
    receipt: {
      session_id: session.id,
      machine: session.machine.name,
      game: session.game.name,
      duration: `${minutes} min`,
      amount: `${numberFormat(amount)} DH`,
      amount_given: `${numberFormat(amountGiven)} DH`,
      change: `${numberFormat(change)} DH`,
      date: `${formatDate(now)} ${formatTime(now)}`,
    },
  });
}

export async function todayPayments(req, res) {
  const range = dayRange(today());

  const payments = await prisma.payment.findMany({
    where: orgScope(req, { payment_date: range }),
    include: SESSION_WITH_MACHINE_GAME,
    orderBy: { payment_date: 'desc' },
  });

  const legacyProductSales = await prisma.productSale.findMany({ where: orgScope(req, { sale_date: range }) });
  const activeSaleOfDay = { sale: orgScope(req, { sale_date: range, cancelled_at: null }) };
  const productLines = await prisma.saleProduct.findMany({ where: activeSaleOfDay });
  const serviceLines = await prisma.saleService.findMany({ where: activeSaleOfDay });

  const total = sum(payments, (p) => p.amount);
  const productRevenue =
    sum(legacyProductSales, (s) => s.total_price) + sum(productLines, (l) => Number(l.unit_price) * Number(l.quantity));
  const serviceRevenue = sum(serviceLines, (l) => Number(l.unit_price) * l.quantity);

  res.json({
    date: formatDate(today()),
    total_revenue: `${numberFormat(total)} DH`,
    total_cash_received: `${numberFormat(sum(payments, (p) => p.amount_given))} DH`,
    total_change_given: `${numberFormat(sum(payments, (p) => p.change_given))} DH`,
    count: payments.length,
    product_revenue: `${numberFormat(productRevenue)} DH`,
    product_sales_count: legacyProductSales.length + productLines.length,
    service_revenue: `${numberFormat(serviceRevenue)} DH`,
    service_sales_count: serviceLines.length,
    total_combined_revenue: `${numberFormat(total + productRevenue + serviceRevenue)} DH`,
    payments: payments.map((p) => ({
      id: p.id,
      time: formatTime(p.payment_date),
      machine: p.session.machine.name,
      game: p.session.game.name,
      amount: withDH(p.amount),
      given: withDH(p.amount_given),
      change: withDH(p.change_given),
    })),
  });
}

function groupTotals(payments, keyFn) {
  const groups = {};
  for (const p of payments) {
    const key = keyFn(p);
    groups[key] ??= { count: 0, total: 0 };
    groups[key].count += 1;
    groups[key].total = round2(groups[key].total + Number(p.amount));
  }
  return groups;
}

export async function paymentStats(req, res) {
  const data = input(req);
  const start = data.start_date ?? today();
  const end = data.end_date ?? today();

  const payments = await prisma.payment.findMany({
    where: orgScope(req, { payment_date: { gte: parseDate(start), lte: parseDate(end) } }),
    include: SESSION_WITH_MACHINE_GAME,
  });

  const totalRevenue = round2(sum(payments, (p) => p.amount));
  res.json({
    period: { start, end },
    total_revenue: totalRevenue,
    total_sessions: payments.length,
    average_per_session: payments.length > 0 ? round2(totalRevenue / payments.length) : 0,
    by_machine: groupTotals(payments, (p) => p.session.machine.name),
    by_game: groupTotals(payments, (p) => p.session.game.name),
    hourly: groupTotals(payments, (p) => String(p.payment_date.getUTCHours()).padStart(2, '0')),
  });
}

export async function showPayment(req, res) {
  const id = Number(req.params.id);
  const payment = orFail(
    await prisma.payment.findFirst({ where: orgScope(req, { id }), include: SESSION_WITH_MACHINE_GAME }),
    'Payment',
    req.params.id,
  );
  res.json(payment);
}

export async function destroyPayment(req, res) {
  const id = Number(req.params.id);
  const payment = orFail(await prisma.payment.findFirst({ where: orgScope(req, { id }) }), 'Payment', req.params.id);

  if (payment.payment_date < addDays(new Date(), -1)) {
    return res.status(403).json({ message: 'Cannot delete payment older than 24h' });
  }

  await prisma.payment.delete({ where: { id: payment.id } });
  res.json({ message: 'Paiement annulé avec succès' });
}
