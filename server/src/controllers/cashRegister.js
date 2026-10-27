// Fond de caisse journalier (CashRegisterController).
import { prisma } from '../lib/prisma.js';
import { abort, input, round2 } from '../lib/http.js';
import { validate } from '../lib/validate.js';
import { orgScope } from '../lib/org.js';
import { isSuperAdmin } from '../lib/auth.js';
import { dayRange, formatDate, formatTime, toDateString, today } from '../lib/dates.js';

const sum = (rows, fn) => rows.reduce((acc, row) => acc + Number(fn(row) ?? 0), 0);

const currentBalance = (r) =>
  round2(Number(r.opening_balance) + Number(r.total_cash_in) - Number(r.total_change_out) - Number(r.withdrawn_amount));

function findTodayRegister(req) {
  return prisma.cashRegister.findFirst({ where: orgScope(req, { date: today() }), orderBy: { id: 'asc' } });
}

/** Recalcule les entrées/sorties de caisse du jour à partir des paiements et ventes en espèces. */
async function syncWithPayments(req, register) {
  const range = dayRange(register.date);

  const payments = await prisma.payment.findMany({
    where: orgScope(req, { created_at: range }),
    select: { amount_given: true, change_given: true },
  });
  const legacyProductsCash = await prisma.productSale.aggregate({
    where: orgScope(req, { sale_date: range, payment_method: 'cash' }),
    _sum: { total_price: true },
  });
  // Part réellement encaissée en espèces (paiements mixtes inclus, ventes à crédit exclues)
  const salesCash = await prisma.sale.aggregate({
    where: orgScope(req, { sale_date: range, cancelled_at: null }),
    _sum: { paid_cash: true },
  });

  const totalCashIn =
    sum(payments, (p) => p.amount_given) +
    Number(legacyProductsCash._sum.total_price ?? 0) +
    Number(salesCash._sum.paid_cash ?? 0);

  return prisma.cashRegister.update({
    where: { id: register.id },
    data: { total_cash_in: round2(totalCashIn), total_change_out: round2(sum(payments, (p) => p.change_given)) },
  });
}

/** Répartition des encaissements nets du jour par moyen de paiement. */
async function paymentBreakdown(req, date) {
  const range = dayRange(date);
  const breakdown = { cash: 0, card: 0, mobile: 0 };

  const payments = await prisma.payment.findMany({ where: orgScope(req, { created_at: range }) });
  const sales = await prisma.sale.findMany({ where: orgScope(req, { sale_date: range, cancelled_at: null }) });
  const legacy = await prisma.productSale.findMany({ where: orgScope(req, { sale_date: range }) });

  const add = (method, amount) => {
    if (method in breakdown) breakdown[method] = round2(breakdown[method] + amount);
  };
  for (const p of payments) add(p.payment_method, Number(p.amount_given ?? 0) - Number(p.change_given));
  for (const s of sales) {
    add('cash', Number(s.paid_cash));
    add('card', Number(s.paid_card));
    add('mobile', Number(s.paid_mobile));
  }
  for (const l of legacy) add(l.payment_method, Number(l.total_price));

  breakdown.total = round2(breakdown.cash + breakdown.card + breakdown.mobile);
  return breakdown;
}

async function formatRegister(req, registerId) {
  const r = await prisma.cashRegister.findUnique({
    where: { id: registerId },
    include: { opened_by_user: { select: { name: true } }, closed_by_user: { select: { name: true } } },
  });

  const balance = currentBalance(r);
  const closingBalance = r.closing_balance !== null ? Number(r.closing_balance) : null;
  const dateStr = toDateString(r.date);

  return {
    id: r.id,
    date: dateStr,
    date_formatted: formatDate(r.date),
    opening_balance: Number(r.opening_balance),
    total_cash_in: Number(r.total_cash_in),
    total_change_out: Number(r.total_change_out),
    withdrawn_amount: Number(r.withdrawn_amount),
    current_balance: balance,
    net_profit: round2(Number(r.total_cash_in) - Number(r.total_change_out)),
    closing_balance: closingBalance,
    is_open: r.opened_at !== null && r.closed_at === null,
    opened_at: r.opened_at ? formatTime(r.opened_at) : null,
    closed_at: r.closed_at ? formatTime(r.closed_at) : null,
    opened_by_name: r.opened_by_user?.name ?? null,
    closed_by_name: r.closed_by_user?.name ?? null,
    notes: r.notes,
    payment_breakdown: await paymentBreakdown(req, dateStr),
    difference: closingBalance !== null ? round2(closingBalance - balance) : null,
  };
}

export async function todayRegister(req, res) {
  const user = req.user;
  if (!isSuperAdmin(user) && !user.organization_id) {
    return res.status(400).json({ error: 'Utilisateur non assigné à une organisation', register: null });
  }

  let register = await findTodayRegister(req);
  if (!register) {
    // Le fond d'ouverture reprend le solde de la dernière caisse
    const previous = await prisma.cashRegister.findFirst({
      where: orgScope(req, { date: { lt: today() } }),
      orderBy: [{ date: 'desc' }, { id: 'desc' }],
    });
    const openingBalance = previous ? (previous.closing_balance !== null ? Number(previous.closing_balance) : currentBalance(previous)) : 0;

    register = await prisma.cashRegister.create({
      data: {
        date: today(),
        opening_balance: openingBalance,
        total_cash_in: 0,
        total_change_out: 0,
        opened_by: user.id,
        opened_at: new Date(),
        organization_id: user.organization_id,
      },
    });
  }

  await syncWithPayments(req, register);
  res.json({ register: await formatRegister(req, register.id) });
}

export async function setOpeningBalance(req, res) {
  const data = input(req);
  await validate(data, { amount: 'required|numeric|min:0' });

  let register = await findTodayRegister(req);
  if (register && register.closed_at !== null) {
    return res.status(400).json({ message: "Cette caisse est déjà clôturée pour aujourd'hui." });
  }

  if (!register) {
    register = await prisma.cashRegister.create({
      data: {
        date: today(),
        opening_balance: Number(data.amount),
        opened_by: req.user.id,
        opened_at: new Date(),
        organization_id: req.user.organization_id,
      },
    });
  } else {
    register = await prisma.cashRegister.update({ where: { id: register.id }, data: { opening_balance: Number(data.amount) } });
  }

  await syncWithPayments(req, register);
  res.json({ message: 'Fond de caisse mis à jour', register: await formatRegister(req, register.id) });
}

export async function withdraw(req, res) {
  const data = input(req);
  await validate(data, { amount: 'required|numeric|min:0', notes: 'nullable|string|max:500' });

  let register = await findTodayRegister(req);
  if (!register) abort(400, 'Caisse non ouverte');
  if (register.closed_at !== null) abort(400, "Cette caisse est déjà clôturée pour aujourd'hui.");

  register = await syncWithPayments(req, register);
  const available = currentBalance(register);
  const amount = Number(data.amount);
  if (amount > available) {
    return res.status(400).json({ message: 'Montant insuffisant dans la caisse', available });
  }

  const update = { withdrawn_amount: round2(Number(register.withdrawn_amount) + amount) };
  if (data.notes) {
    update.notes = `${register.notes ? `${register.notes}\n` : ''}${formatTime(new Date())} - Retrait: ${data.amount} DH (${data.notes})`;
  }
  await prisma.cashRegister.update({ where: { id: register.id }, data: update });

  res.json({ message: `Retrait de ${data.amount} DH effectué`, register: await formatRegister(req, register.id) });
}

export async function closeRegister(req, res) {
  const data = input(req);
  await validate(data, { closing_balance: 'required|numeric|min:0', notes: 'nullable|string|max:500' });

  let register = await findTodayRegister(req);
  if (!register) abort(400, 'Caisse non ouverte');
  if (register.closed_at !== null) {
    return res.status(400).json({
      message: "Cette caisse est déjà clôturée pour aujourd'hui.",
      register: await formatRegister(req, register.id),
    });
  }

  register = await syncWithPayments(req, register);
  const update = { closing_balance: Number(data.closing_balance), closed_by: req.user.id, closed_at: new Date() };
  if (data.notes) update.notes = `${register.notes ? `${register.notes}\n` : ''}Fermeture: ${data.notes}`;
  register = await prisma.cashRegister.update({ where: { id: register.id }, data: update });

  const expected = currentBalance(register);
  res.json({
    message: 'Caisse fermée',
    register: await formatRegister(req, register.id),
    expected_balance: expected,
    actual_balance: data.closing_balance,
    difference: round2(Number(data.closing_balance) - expected),
  });
}

export async function history(req, res) {
  const limit = Math.max(1, Number(input(req).limit ?? 30) || 30);
  const registers = await prisma.cashRegister.findMany({
    where: orgScope(req),
    orderBy: [{ date: 'desc' }, { id: 'desc' }],
    take: limit,
    select: { id: true },
  });

  const formatted = [];
  for (const r of registers) formatted.push(await formatRegister(req, r.id));
  res.json({ registers: formatted });
}
