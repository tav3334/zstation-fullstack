// Module salon : prestations, catégories, coiffeurs, produits de stock, tickets de vente,
// mouvements de stock (ServiceController, ServiceCategoryController, CoiffeurController,
// StockProductController, SaleController, StockMovementController).
import { prisma } from '../lib/prisma.js';
import { HttpError, abort, bool, filled, has, input, orFail, pick, round2 } from '../lib/http.js';
import { validate } from '../lib/validate.js';
import { orgScope, withOrg } from '../lib/org.js';
import { slug } from '../lib/misc.js';
import { dateBetween, dayRange, toDateString, today } from '../lib/dates.js';
import { MOVABLE, MOVEMENT, logMovement } from '../lib/stock.js';

const byId = (model, name) => async (req, id = req.params.id) =>
  orFail(await prisma[model].findFirst({ where: orgScope(req, { id: Number(id) }) }), name, id);

// ═════════════════════════════ Prestations ═════════════════════════════

/** Reproduit la relation belongsToMany Service→StockProduct avec son "pivot". */
function formatService(service) {
  if (!service.service_products) return service;
  const { service_products: links, ...rest } = service;
  return {
    ...rest,
    products: links.map((link) => ({
      ...link.stock_product,
      pivot: {
        service_id: link.service_id,
        stock_product_id: link.stock_product_id,
        quantity_used: link.quantity_used,
        created_at: link.created_at,
        updated_at: link.updated_at,
      },
    })),
  };
}

const WITH_PRODUCTS = { service_products: { include: { stock_product: true }, orderBy: { id: 'asc' } } };
const SERVICE_ORDER = [{ category: 'asc' }, { name: 'asc' }];
const findService = byId('service', 'Service');

export async function servicesIndex(req, res) {
  res.json(await prisma.service.findMany({ where: orgScope(req, { is_active: true }), orderBy: SERVICE_ORDER }));
}

export async function servicesAll(req, res) {
  const services = await prisma.service.findMany({ where: orgScope(req), orderBy: SERVICE_ORDER, include: WITH_PRODUCTS });
  res.json(services.map(formatService));
}

const SERVICE_PRODUCT_RULES = {
  products: 'nullable|array',
  'products.*.stock_product_id': 'required_with:products|exists:stock_products,id',
  'products.*.quantity_used': 'required_with:products|numeric|min:0',
};

const productLinks = (products) =>
  (products ?? []).map((p) => ({ stock_product_id: Number(p.stock_product_id), quantity_used: Number(p.quantity_used) }));

export async function servicesStore(req, res) {
  const data = input(req);
  await validate(data, {
    name: 'required|string|max:255',
    category: 'required|string|max:100',
    price: 'required|numeric|min:0',
    duration: 'nullable|integer|min:0',
    ...SERVICE_PRODUCT_RULES,
  });

  const service = await prisma.service.create({
    data: withOrg(req, {
      name: data.name,
      category: data.category,
      price: Number(data.price),
      duration: data.duration != null ? Number(data.duration) : null,
      is_active: true,
      service_products: filled(data, 'products') ? { create: productLinks(data.products) } : undefined,
    }),
    include: WITH_PRODUCTS,
  });

  res.status(201).json({ message: 'Prestation créée avec succès', service: formatService(service) });
}

export async function servicesUpdate(req, res) {
  const data = input(req);
  await validate(data, {
    name: 'sometimes|required|string|max:255',
    category: 'sometimes|required|string|max:100',
    price: 'sometimes|required|numeric|min:0',
    duration: 'nullable|integer|min:0',
    is_active: 'sometimes|boolean',
    ...SERVICE_PRODUCT_RULES,
  });

  const service = await findService(req);
  const changes = pick(data, ['name', 'category']);
  if (has(data, 'price')) changes.price = Number(data.price);
  if (has(data, 'duration')) changes.duration = data.duration != null ? Number(data.duration) : null;
  if (has(data, 'is_active')) changes.is_active = bool(data.is_active);

  const updated = await prisma.$transaction(async (tx) => {
    await tx.service.update({ where: { id: service.id }, data: changes });
    if (has(data, 'products')) {
      await tx.serviceProduct.deleteMany({ where: { service_id: service.id } });
      const links = productLinks(data.products).map((l) => ({ ...l, service_id: service.id }));
      if (links.length) await tx.serviceProduct.createMany({ data: links });
    }
    return tx.service.findUnique({ where: { id: service.id }, include: WITH_PRODUCTS });
  });

  res.json({ message: 'Prestation mise à jour avec succès', service: formatService(updated) });
}

export async function servicesDestroy(req, res) {
  const service = await findService(req);
  const usedInSales = await prisma.saleService.findFirst({ where: { service_id: service.id } });
  if (usedInSales) {
    const disabled = await prisma.service.update({ where: { id: service.id }, data: { is_active: false } });
    return res.json({ message: 'Prestation désactivée (des ventes existent pour cette prestation)', service: disabled });
  }

  await prisma.service.delete({ where: { id: service.id } }); // service_products supprimés en cascade
  res.json({ message: 'Prestation supprimée avec succès' });
}

// ═════════════════════════════ Catégories de prestations ═════════════════════════════

const findCategory = byId('serviceCategory', 'ServiceCategory');

export async function categoriesIndex(req, res) {
  res.json(await prisma.serviceCategory.findMany({ where: orgScope(req), orderBy: [{ sort_order: 'asc' }, { label: 'asc' }] }));
}

export async function categoriesStore(req, res) {
  const data = input(req);
  await validate(data, { label: 'required|string|max:100' });

  const orgId = req.user.organization_id;
  const base = slug(data.label, '_');
  let candidate = base;
  let counter = 1;
  while (await prisma.serviceCategory.findFirst({ where: { organization_id: orgId, slug: candidate } })) {
    candidate = `${base}_${counter}`;
    counter++;
  }

  const max = await prisma.serviceCategory.aggregate({ where: orgScope(req), _max: { sort_order: true } });
  const category = await prisma.serviceCategory.create({
    data: { organization_id: orgId, slug: candidate, label: data.label, sort_order: (max._max.sort_order ?? 0) + 1 },
  });

  res.status(201).json({ message: 'Catégorie créée avec succès', category });
}

export async function categoriesUpdate(req, res) {
  const category = await findCategory(req);
  const data = input(req);
  await validate(data, { label: 'sometimes|required|string|max:100', sort_order: 'sometimes|integer|min:0' });

  const changes = pick(data, ['label']);
  if (has(data, 'sort_order')) changes.sort_order = Number(data.sort_order);
  const updated = await prisma.serviceCategory.update({ where: { id: category.id }, data: changes });
  res.json({ message: 'Catégorie modifiée avec succès', category: updated });
}

export async function categoriesDestroy(req, res) {
  const category = await findCategory(req);
  const inUse = await prisma.service.findFirst({ where: orgScope(req, { category: category.slug }) });
  if (inUse) {
    return res.status(409).json({ message: 'Impossible de supprimer : des prestations utilisent encore cette catégorie.' });
  }
  await prisma.serviceCategory.delete({ where: { id: category.id } });
  res.json({ message: 'Catégorie supprimée avec succès' });
}

// ═════════════════════════════ Coiffeurs ═════════════════════════════

const findCoiffeur = byId('coiffeur', 'Coiffeur');

export async function coiffeursIndex(req, res) {
  res.json(await prisma.coiffeur.findMany({ where: orgScope(req, { is_active: true }), orderBy: { name: 'asc' } }));
}

export async function coiffeursAll(req, res) {
  res.json(await prisma.coiffeur.findMany({ where: orgScope(req), orderBy: { name: 'asc' } }));
}

export async function coiffeursStore(req, res) {
  const data = input(req);
  await validate(data, { name: 'required|string|max:255', phone: 'nullable|string|max:30' });

  const coiffeur = await prisma.coiffeur.create({
    data: withOrg(req, { name: data.name, phone: data.phone ?? null, is_active: true }),
  });
  res.status(201).json({ message: 'Coiffeur créé avec succès', coiffeur });
}

export async function coiffeursUpdate(req, res) {
  const data = input(req);
  await validate(data, {
    name: 'sometimes|required|string|max:255',
    phone: 'nullable|string|max:30',
    is_active: 'sometimes|boolean',
  });

  const coiffeur = await findCoiffeur(req);
  const changes = pick(data, ['name', 'phone']);
  if (has(data, 'is_active')) changes.is_active = bool(data.is_active);
  const updated = await prisma.coiffeur.update({ where: { id: coiffeur.id }, data: changes });
  res.json({ message: 'Coiffeur mis à jour avec succès', coiffeur: updated });
}

export async function coiffeursDestroy(req, res) {
  const coiffeur = await findCoiffeur(req);
  const usedInSales = await prisma.sale.findFirst({ where: orgScope(req, { coiffeur_id: coiffeur.id }) });
  if (usedInSales) {
    const disabled = await prisma.coiffeur.update({ where: { id: coiffeur.id }, data: { is_active: false } });
    return res.json({ message: 'Coiffeur désactivé (des ventes existent pour ce coiffeur)', coiffeur: disabled });
  }
  await prisma.coiffeur.delete({ where: { id: coiffeur.id } });
  res.json({ message: 'Coiffeur supprimé avec succès' });
}

// ═════════════════════════════ Produits de stock ═════════════════════════════

const findStockProduct = byId('stockProduct', 'StockProduct');

export async function stockIndex(req, res) {
  res.json(await prisma.stockProduct.findMany({ where: orgScope(req, { is_sellable: true }), orderBy: { name: 'asc' } }));
}

export async function stockAll(req, res) {
  res.json(await prisma.stockProduct.findMany({ where: orgScope(req), orderBy: [{ category: 'asc' }, { name: 'asc' }] }));
}

export async function stockLow(req, res) {
  const products = await prisma.stockProduct.findMany({
    where: orgScope(req, { quantity: { lte: prisma.stockProduct.fields.alert_threshold } }),
    orderBy: { quantity: 'asc' },
  });
  res.json({ products, count: products.length });
}

const STOCK_RULES = {
  image: 'nullable|string|max:10',
  category: 'nullable|string|max:100',
  source: 'nullable|in:salon,gaming',
  unit: 'nullable|string|max:50',
  size: 'nullable|string|max:50',
  alert_threshold: 'nullable|numeric|min:0',
  is_sellable: 'boolean',
  sale_price: 'nullable|numeric|min:0',
  barcode: 'nullable|string|max:64',
};

/** Code-barres normalisé (vide → null) ; refuse un doublon dans l'organisation. */
async function checkBarcode(req, value, exceptId = null) {
  const barcode = value != null && String(value).trim() !== '' ? String(value).trim() : null;
  if (barcode) {
    const taken = await prisma.stockProduct.findFirst({
      where: orgScope(req, { barcode, ...(exceptId ? { NOT: { id: exceptId } } : {}) }),
    });
    if (taken) abort(422, `Ce code-barres est déjà utilisé par « ${taken.name} ».`);
  }
  return barcode;
}

export async function stockStore(req, res) {
  const data = input(req);
  await validate(data, { name: 'required|string|max:255', quantity: 'required|numeric|min:0', ...STOCK_RULES });
  const barcode = await checkBarcode(req, data.barcode);

  const product = await prisma.stockProduct.create({
    data: withOrg(req, {
      name: data.name,
      image: data.image ?? null,
      category: data.category ?? null,
      source: data.source ?? 'salon',
      unit: data.unit ?? 'unité',
      size: data.size ?? null,
      quantity: Number(data.quantity),
      alert_threshold: data.alert_threshold != null ? Number(data.alert_threshold) : 5,
      is_sellable: bool(data.is_sellable),
      sale_price: data.sale_price != null ? Number(data.sale_price) : null,
      barcode,
    }),
  });

  if (Number(product.quantity) > 0) {
    await logMovement(prisma, req, {
      movableType: MOVABLE.StockProduct,
      movable: product,
      type: MOVEMENT.INITIAL_STOCK,
      before: 0,
      change: Number(product.quantity),
    });
  }

  res.status(201).json({ message: 'Produit créé avec succès', product });
}

export async function stockUpdate(req, res) {
  const data = input(req);
  await validate(data, { name: 'sometimes|required|string|max:255', quantity: 'sometimes|required|numeric|min:0', ...STOCK_RULES });

  const product = await findStockProduct(req);
  const changes = pick(data, ['name', 'image', 'category', 'size']);
  // source / unit / alert_threshold sont NOT NULL en base : un null envoyé conserve la valeur actuelle
  if (data.source != null) changes.source = data.source;
  if (data.unit != null) changes.unit = data.unit;
  if (data.alert_threshold != null) changes.alert_threshold = Number(data.alert_threshold);
  if (has(data, 'quantity')) changes.quantity = Number(data.quantity);
  if (has(data, 'is_sellable')) changes.is_sellable = bool(data.is_sellable);
  if (has(data, 'sale_price')) changes.sale_price = data.sale_price != null ? Number(data.sale_price) : null;
  if (has(data, 'barcode')) changes.barcode = await checkBarcode(req, data.barcode, product.id);

  const updated = await prisma.stockProduct.update({ where: { id: product.id }, data: changes });
  res.json({ message: 'Produit mis à jour avec succès', product: updated });
}

export async function stockUpdateQuantity(req, res) {
  const data = input(req);
  await validate(data, { quantity: 'required|numeric|min:0', reason: 'nullable|string|max:255' });

  const product = await findStockProduct(req);
  const before = Number(product.quantity);
  const change = round2(Number(data.quantity) - before);

  const updated = await prisma.stockProduct.update({ where: { id: product.id }, data: { quantity: Number(data.quantity) } });
  if (change !== 0) {
    await logMovement(prisma, req, {
      movableType: MOVABLE.StockProduct,
      movable: product,
      type: MOVEMENT.MANUAL_ADJUSTMENT,
      before,
      change,
      reason: data.reason ?? null,
    });
  }

  res.json({ message: 'Stock mis à jour', product: updated });
}

export async function stockDestroy(req, res) {
  const product = await findStockProduct(req);
  const usedInSales = await prisma.saleProduct.findFirst({ where: { stock_product_id: product.id } });
  const usedInServices = await prisma.serviceProduct.findFirst({ where: { stock_product_id: product.id } });

  if (usedInSales || usedInServices) {
    const disabled = await prisma.stockProduct.update({ where: { id: product.id }, data: { is_sellable: false } });
    return res.json({ message: 'Produit désactivé de la vente (des ventes ou prestations y sont liées)', product: disabled });
  }

  await prisma.stockProduct.delete({ where: { id: product.id } });
  res.json({ message: 'Produit supprimé avec succès' });
}

// ═════════════════════════════ Tickets de vente ═════════════════════════════

const SALE_INCLUDE = { services: true, products: true, coiffeur: true, staff: true };

/** Prochain numéro de ticket de l'organisation (TCK-000123). */
async function generateTicketNumber(tx, req) {
  const max = await tx.sale.aggregate({ where: orgScope(req), _max: { id: true } });
  let lastId = max._max.id ?? 0;
  let candidate;
  do {
    lastId++;
    candidate = `TCK-${String(lastId).padStart(6, '0')}`;
  } while (await tx.sale.findFirst({ where: orgScope(req, { ticket_number: candidate }) }));
  return candidate;
}

export async function salesStore(req, res) {
  const data = input(req);
  await validate(data, {
    coiffeur_id: 'nullable|exists:coiffeurs,id',
    customer_id: 'nullable|exists:customers,id',
    discount: 'nullable|numeric|min:0',
    payment_method: 'required|in:cash,card,mobile,mixed',
    payments: 'nullable|array',
    'payments.*.method': 'required|in:cash,card,mobile',
    'payments.*.amount': 'required|numeric|min:0',
    paid_on_credit: 'boolean',
    services: 'required_without:products|array',
    'services.*.service_id': 'required|exists:services,id',
    'services.*.quantity': 'nullable|integer|min:1',
    products: 'required_without:services|array',
    'products.*.stock_product_id': 'required|exists:stock_products,id',
    'products.*.quantity': 'required|numeric|min:0.01',
  });

  const paidOnCredit = bool(data.paid_on_credit);
  let customer = null;
  if (paidOnCredit) {
    if (!data.customer_id) {
      return res.status(422).json({ message: 'Un client doit être sélectionné pour une vente à crédit.' });
    }
    customer = orFail(
      await prisma.customer.findFirst({ where: orgScope(req, { id: Number(data.customer_id) }) }),
      'Customer',
      data.customer_id,
    );
  }

  const services = Array.isArray(data.services) ? data.services : [];
  const products = Array.isArray(data.products) ? data.products : [];
  if (!services.length && !products.length) {
    return res.status(422).json({ message: 'La vente doit contenir au moins une prestation ou un produit' });
  }
  if (!paidOnCredit && data.payment_method === 'mixed' && !(Array.isArray(data.payments) && data.payments.length)) {
    return res.status(422).json({ message: 'Le détail des paiements est requis pour un paiement mixte.' });
  }

  // Pas de vente sur une caisse déjà clôturée pour la journée
  const register = await prisma.cashRegister.findFirst({ where: orgScope(req, { date: today() }), orderBy: { id: 'asc' } });
  if (register?.closed_at) {
    return res.status(400).json({ message: "La caisse du jour est clôturée : aucune vente n'est possible." });
  }

  try {
    const sale = await prisma.$transaction(async (tx) => {
      // 1. Résolution des lignes + besoins en stock (prestations → produits consommés)
      const stockNeeds = new Map(); // stock_product_id → quantité totale
      const addNeed = (id, qty) => stockNeeds.set(id, round2((stockNeeds.get(id) ?? 0) + qty));

      const resolvedServices = [];
      for (const item of services) {
        const service = orFail(
          await tx.service.findFirst({
            where: orgScope(req, { id: Number(item.service_id) }),
            include: { service_products: true },
          }),
          'Service',
          item.service_id,
        );
        const quantity = item.quantity != null ? Number(item.quantity) : 1;
        resolvedServices.push({ service, quantity });
        for (const link of service.service_products) addNeed(link.stock_product_id, Number(link.quantity_used) * quantity);
      }

      const resolvedProducts = [];
      for (const item of products) {
        const product = orFail(
          await tx.stockProduct.findFirst({ where: orgScope(req, { id: Number(item.stock_product_id) }) }),
          'StockProduct',
          item.stock_product_id,
        );
        const quantity = Number(item.quantity);
        resolvedProducts.push({ product, quantity });
        addNeed(product.id, quantity);
      }

      // 2. Vérification du stock disponible
      const stockProducts = new Map();
      for (const [id, needed] of stockNeeds) {
        const sp = orFail(await tx.stockProduct.findFirst({ where: orgScope(req, { id }) }), 'StockProduct', id);
        if (Number(sp.quantity) < needed) abort(400, `Stock insuffisant pour le produit : ${sp.name}`);
        stockProducts.set(id, sp);
      }

      // 3. Totaux (remise puis TVA si activée)
      let subtotal = 0;
      for (const { service, quantity } of resolvedServices) subtotal += Number(service.price) * quantity;
      for (const { product, quantity } of resolvedProducts) subtotal += Number(product.sale_price ?? 0) * quantity;
      subtotal = round2(subtotal);

      const discount = Number(data.discount ?? 0);
      const afterDiscount = Math.max(0, round2(subtotal - discount));
      const organization = req.user.organization_id
        ? await tx.organization.findUnique({ where: { id: req.user.organization_id } })
        : null;
      const tvaEnabled = organization?.tva_enabled ?? false;
      const taxRate = tvaEnabled ? Number(organization.tva_rate) : 0;
      const taxAmount = tvaEnabled ? round2((afterDiscount * taxRate) / 100) : 0;
      const total = round2(afterDiscount + taxAmount);

      if (paidOnCredit) {
        const available = round2(Number(customer.credit_limit) - Number(customer.credit_balance));
        if (total > available) abort(400, `Crédit insuffisant pour ce client. Disponible : ${available} DH.`);
      }

      // Répartition de l'encaissement (rien n'est encaissé pour une vente à crédit)
      const paid = { cash: 0, card: 0, mobile: 0 };
      if (!paidOnCredit) {
        if (data.payment_method === 'mixed') {
          for (const p of data.payments) paid[p.method] = round2(paid[p.method] + Number(p.amount));
          const paidTotal = round2(paid.cash + paid.card + paid.mobile);
          if (paidTotal !== total) {
            abort(422, `La somme des paiements (${paidTotal} DH) ne correspond pas au total (${total} DH).`);
          }
        } else {
          paid[data.payment_method] = total;
        }
      }

      // 4. Création du ticket et de ses lignes
      const created = await tx.sale.create({
        data: withOrg(req, {
          ticket_number: await generateTicketNumber(tx, req),
          coiffeur_id: data.coiffeur_id != null ? Number(data.coiffeur_id) : null,
          customer_id: data.customer_id != null ? Number(data.customer_id) : null,
          staff_id: req.user.id,
          subtotal,
          discount,
          tax_rate: taxRate,
          tax_amount: taxAmount,
          total,
          payment_method: data.payment_method,
          paid_cash: paid.cash,
          paid_card: paid.card,
          paid_mobile: paid.mobile,
          paid_on_credit: paidOnCredit,
          sale_date: new Date(),
          services: {
            create: resolvedServices.map(({ service, quantity }) => ({
              service_id: service.id,
              service_name: service.name,
              unit_price: service.price,
              quantity,
            })),
          },
          products: {
            create: resolvedProducts.map(({ product, quantity }) => ({
              stock_product_id: product.id,
              product_name: product.name,
              unit_price: product.sale_price ?? 0,
              quantity,
            })),
          },
        }),
      });

      // 5. Ardoise client si vente à crédit
      if (paidOnCredit) {
        const balance = round2(Number(customer.credit_balance) + total);
        await tx.customer.update({ where: { id: customer.id }, data: { credit_balance: balance } });
        await tx.customerCreditMovement.create({
          data: {
            organization_id: organization?.id ?? customer.organization_id,
            customer_id: customer.id,
            sale_id: created.id,
            recorded_by: req.user.id,
            type: 'charge',
            amount: total,
            balance_after: balance,
            notes: `Vente à crédit — ticket ${created.ticket_number}`,
          },
        });
      }

      // 6. Décrément du stock + historique
      for (const [id, needed] of stockNeeds) {
        const sp = stockProducts.get(id);
        await tx.stockProduct.update({ where: { id }, data: { quantity: { decrement: needed } } });
        await logMovement(tx, req, {
          movableType: MOVABLE.StockProduct,
          movable: sp,
          type: MOVEMENT.SALE,
          before: Number(sp.quantity),
          change: -needed,
          saleId: created.id,
        });
      }

      return tx.sale.findUnique({ where: { id: created.id }, include: SALE_INCLUDE });
    });

    res.status(201).json({ message: 'Vente enregistrée avec succès', sale });
  } catch (err) {
    if (err instanceof HttpError) throw err;
    res.status(500).json({ message: `Erreur lors de la vente: ${err.message}` });
  }
}

function saleFilters(req, data) {
  const where = orgScope(req);
  if (filled(data, 'coiffeur_id')) where.coiffeur_id = Number(data.coiffeur_id);
  if (filled(data, 'payment_method')) where.payment_method = data.payment_method;
  return where;
}

export async function salesIndex(req, res) {
  const data = input(req);
  const where = saleFilters(req, data);
  if (filled(data, 'date_from') || filled(data, 'date_to')) {
    where.sale_date = dateBetween(data.date_from ?? null, data.date_to ?? null);
  }
  if (filled(data, 'ticket_number')) where.ticket_number = { contains: String(data.ticket_number), mode: 'insensitive' };
  if (data.status === 'cancelled') where.cancelled_at = { not: null };
  else if (data.status === 'active') where.cancelled_at = null;

  const limit = Math.min(Number.parseInt(data.limit ?? 50, 10) || 50, 200);
  const page = Math.max(Number.parseInt(data.page ?? 1, 10) || 1, 1);

  const [total, sales] = await Promise.all([
    prisma.sale.count({ where }),
    prisma.sale.findMany({
      where,
      include: SALE_INCLUDE,
      orderBy: [{ sale_date: 'desc' }, { id: 'desc' }],
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);

  res.json({ sales, total, page, limit, last_page: Math.max(1, Math.ceil(total / limit)) });
}

export async function salesShow(req, res) {
  const sale = await prisma.sale.findFirst({ where: orgScope(req, { id: Number(req.params.id) }), include: SALE_INCLUDE });
  res.json(orFail(sale, 'Sale', req.params.id));
}

/** Annule un ticket et restitue le stock consommé. */
export async function salesCancel(req, res) {
  const data = input(req);
  await validate(data, { reason: 'nullable|string|max:255' });

  const sale = orFail(
    await prisma.sale.findFirst({ where: orgScope(req, { id: Number(req.params.id) }), include: { services: true, products: true } }),
    'Sale',
    req.params.id,
  );
  if (sale.cancelled_at) return res.status(400).json({ message: 'Ce ticket est déjà annulé' });

  const reason = data.reason ?? null;
  try {
    const fresh = await prisma.$transaction(async (tx) => {
      // Produits consommés par les prestations
      for (const line of sale.services) {
        if (!line.service_id) continue;
        const service = await tx.service.findFirst({
          where: orgScope(req, { id: line.service_id }),
          include: { service_products: { include: { stock_product: true } } },
        });
        if (!service) continue;
        for (const link of service.service_products) {
          const restored = round2(Number(link.quantity_used) * line.quantity);
          const current = await tx.stockProduct.findUnique({ where: { id: link.stock_product_id } });
          await tx.stockProduct.update({ where: { id: current.id }, data: { quantity: { increment: restored } } });
          await logMovement(tx, req, {
            movableType: MOVABLE.StockProduct,
            movable: current,
            type: MOVEMENT.SALE_CANCEL,
            before: Number(current.quantity),
            change: restored,
            saleId: sale.id,
            reason,
          });
        }
      }

      // Produits vendus directement
      for (const line of sale.products) {
        if (!line.stock_product_id) continue;
        const current = await tx.stockProduct.findFirst({ where: orgScope(req, { id: line.stock_product_id }) });
        if (!current) continue;
        await tx.stockProduct.update({ where: { id: current.id }, data: { quantity: { increment: line.quantity } } });
        await logMovement(tx, req, {
          movableType: MOVABLE.StockProduct,
          movable: current,
          type: MOVEMENT.SALE_CANCEL,
          before: Number(current.quantity),
          change: Number(line.quantity),
          saleId: sale.id,
          reason,
        });
      }

      await tx.sale.update({
        where: { id: sale.id },
        data: { cancelled_at: new Date(), cancelled_by: req.user.id, cancel_reason: reason },
      });

      return tx.sale.findUnique({ where: { id: sale.id }, include: { ...SALE_INCLUDE, cancelled_by_user: true } });
    });

    // La relation Eloquent "cancelledBy" était sérialisée sous la clé cancelled_by
    const { cancelled_by_user: cancelledBy, ...rest } = fresh;
    res.json({ message: 'Ticket annulé et stock restitué avec succès', sale: { ...rest, cancelled_by: cancelledBy } });
  } catch (err) {
    if (err instanceof HttpError) throw err;
    res.status(500).json({ message: `Erreur lors de l'annulation: ${err.message}` });
  }
}

export async function salesStats(req, res) {
  const data = input(req);
  const where = { ...saleFilters(req, data), cancelled_at: null };
  if (filled(data, 'date_from') || filled(data, 'date_to')) {
    where.sale_date = dateBetween(data.date_from ?? null, data.date_to ?? null);
  } else {
    where.sale_date = dayRange(data.date ?? toDateString(new Date()));
  }

  const sales = await prisma.sale.findMany({ where, select: { total: true, discount: true, payment_method: true } });
  const totalRevenue = round2(sales.reduce((acc, s) => acc + Number(s.total), 0));
  const byMethod = {};
  for (const s of sales) byMethod[s.payment_method] = round2((byMethod[s.payment_method] ?? 0) + Number(s.total));

  res.json({
    date: data.date ?? toDateString(new Date()),
    total_sales: sales.length,
    total_revenue: totalRevenue,
    average_sale: sales.length > 0 ? round2(totalRevenue / sales.length) : 0,
    total_discount: round2(sales.reduce((acc, s) => acc + Number(s.discount), 0)),
    by_payment_method: byMethod,
  });
}

// ═════════════════════════════ Mouvements de stock ═════════════════════════════

export async function stockMovements(req, res) {
  const data = input(req);
  const where = orgScope(req);

  if (filled(data, 'movable_type')) {
    const map = { salon: MOVABLE.StockProduct, gaming: MOVABLE.Product };
    where.movable_type = map[data.movable_type] ?? data.movable_type;
  }
  if (filled(data, 'type')) where.type = data.type;
  if (filled(data, 'date_from') || filled(data, 'date_to')) {
    where.created_at = dateBetween(data.date_from ?? null, data.date_to ?? null);
  }
  if (filled(data, 'product_name')) where.product_name = { contains: String(data.product_name), mode: 'insensitive' };

  const limit = Math.min(Number.parseInt(data.limit ?? 100, 10) || 100, 500);
  const page = Math.max(Number.parseInt(data.page ?? 1, 10) || 1, 1);

  const [total, movements] = await Promise.all([
    prisma.stockMovement.count({ where }),
    prisma.stockMovement.findMany({
      where,
      include: { sale: { select: { id: true, ticket_number: true } }, user: { select: { id: true, name: true } } },
      orderBy: [{ created_at: 'desc' }, { id: 'desc' }],
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);

  res.json({
    movements: movements.map((m) => ({
      id: m.id,
      product_name: m.product_name,
      source: m.movable_type === MOVABLE.Product ? 'gaming' : 'salon',
      type: m.type,
      quantity_before: Number(m.quantity_before),
      quantity_change: Number(m.quantity_change),
      quantity_after: Number(m.quantity_after),
      ticket_number: m.sale?.ticket_number ?? null,
      user_name: m.user?.name ?? null,
      reason: m.reason,
      created_at: m.created_at?.toISOString() ?? null,
    })),
    total,
    page,
    limit,
  });
}
