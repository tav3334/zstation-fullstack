// Clients et ardoise / crédit (CustomerController).
import { prisma } from '../lib/prisma.js';
import { bool, has, input, orFail, round2 } from '../lib/http.js';
import { validate } from '../lib/validate.js';
import { orgScope, withOrg } from '../lib/org.js';

const contains = (value) => ({ contains: String(value), mode: 'insensitive' });

function findCustomer(req) {
  const id = Number(req.params.id);
  return prisma.customer.findFirst({ where: orgScope(req, { id }) }).then((c) => orFail(c, 'Customer', req.params.id));
}

function customerFields(data) {
  const fields = {};
  for (const key of ['name', 'phone', 'email', 'notes']) if (has(data, key)) fields[key] = data[key];
  // credit_limit est NOT NULL en base : un null envoyé garde la valeur actuelle / par défaut
  if (has(data, 'credit_limit') && data.credit_limit !== null) fields.credit_limit = Number(data.credit_limit);
  if (has(data, 'is_active')) fields.is_active = bool(data.is_active);
  return fields;
}

export async function index(req, res) {
  const data = input(req);
  const where = orgScope(req);
  if (data.search) {
    where.OR = [{ name: contains(data.search) }, { phone: contains(data.search) }, { email: contains(data.search) }];
  }
  if (bool(data.with_debt_only)) where.credit_balance = { gt: 0 };

  res.json({ customers: await prisma.customer.findMany({ where, orderBy: { name: 'asc' } }) });
}

export async function all(req, res) {
  const customers = await prisma.customer.findMany({
    where: orgScope(req, { is_active: true }),
    orderBy: { name: 'asc' },
    select: { id: true, name: true, phone: true, credit_balance: true, credit_limit: true },
  });
  res.json(customers);
}

export async function store(req, res) {
  const data = input(req);
  await validate(data, {
    name: 'required|string|max:255',
    phone: 'nullable|string|max:20',
    email: 'nullable|email|max:255',
    credit_limit: 'nullable|numeric|min:0',
    notes: 'nullable|string|max:1000',
  });

  const fields = customerFields(data);
  delete fields.is_active;
  const customer = await prisma.customer.create({ data: withOrg(req, fields) });
  res.status(201).json({ message: 'Client créé', customer });
}

export async function show(req, res) {
  const customer = await findCustomer(req);
  const full = await prisma.customer.findUnique({
    where: { id: customer.id },
    include: {
      sales: { orderBy: { sale_date: 'desc' }, take: 50 },
      credit_movements: { orderBy: [{ created_at: 'desc' }, { id: 'desc' }], take: 50 },
    },
  });
  res.json({ customer: full });
}

export async function update(req, res) {
  const customer = await findCustomer(req);
  const data = input(req);
  await validate(data, {
    name: 'sometimes|string|max:255',
    phone: 'nullable|string|max:20',
    email: 'nullable|email|max:255',
    credit_limit: 'nullable|numeric|min:0',
    notes: 'nullable|string|max:1000',
    is_active: 'boolean',
  });

  const updated = await prisma.customer.update({ where: { id: customer.id }, data: customerFields(data) });
  res.json({ message: 'Client mis à jour', customer: updated });
}

export async function destroy(req, res) {
  const customer = await findCustomer(req);
  if (Number(customer.credit_balance) > 0) {
    return res.status(400).json({ message: 'Impossible de supprimer un client avec un solde débiteur en cours.' });
  }
  await prisma.customer.delete({ where: { id: customer.id } });
  res.json({ message: 'Client supprimé' });
}

/** Enregistre un remboursement sur l'ardoise du client. */
export async function recordPayment(req, res) {
  const data = input(req);
  await validate(data, { amount: 'required|numeric|min:0.01', notes: 'nullable|string|max:255' });

  const customer = await findCustomer(req);
  const amount = Number(data.amount);
  if (amount > Number(customer.credit_balance)) {
    return res.status(400).json({
      message: 'Le montant dépasse le solde dû par le client.',
      credit_balance: Number(customer.credit_balance),
    });
  }

  const fresh = await prisma.$transaction(async (tx) => {
    const balance = round2(Number(customer.credit_balance) - amount);
    const updated = await tx.customer.update({ where: { id: customer.id }, data: { credit_balance: balance } });
    await tx.customerCreditMovement.create({
      data: {
        organization_id: customer.organization_id ?? req.user.organization_id,
        customer_id: customer.id,
        recorded_by: req.user.id,
        type: 'payment',
        amount,
        balance_after: balance,
        notes: data.notes ?? null,
      },
    });
    return updated;
  });

  res.json({ message: 'Paiement enregistré', customer: fresh });
}
