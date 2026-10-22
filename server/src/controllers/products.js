// Produits du coin gaming : snacks / boissons (ProductController).
import { prisma } from '../lib/prisma.js';
import { HttpError, abort, bool, has, input, orFail, pick } from '../lib/http.js';
import { validate } from '../lib/validate.js';
import { orgScope, withOrg } from '../lib/org.js';
import { MOVABLE, MOVEMENT, logMovement } from '../lib/stock.js';

const ORDER = [{ category: 'asc' }, { name: 'asc' }];

export async function index(req, res) {
  res.json(await prisma.product.findMany({ where: orgScope(req, { is_available: true }), orderBy: ORDER }));
}

export async function all(req, res) {
  res.json(await prisma.product.findMany({ where: orgScope(req), orderBy: ORDER }));
}

export async function sell(req, res) {
  const data = input(req);
  await validate(data, {
    product_id: 'required|exists:products,id',
    quantity: 'required|integer|min:1',
    payment_method: 'required|in:cash,card,mobile',
  });

  const quantity = Number(data.quantity);
  try {
    const result = await prisma.$transaction(async (tx) => {
      const product = orFail(
        await tx.product.findFirst({ where: orgScope(req, { id: Number(data.product_id) }) }),
        'Product',
        data.product_id,
      );
      if (!(product.stock >= quantity && product.is_available)) abort(400, 'Stock insuffisant pour ce produit');

      const sale = await tx.productSale.create({
        data: withOrg(req, {
          product_id: product.id,
          staff_id: req.user.id,
          quantity,
          unit_price: product.price,
          total_price: product.price.mul(quantity),
          payment_method: data.payment_method,
          sale_date: new Date(),
        }),
        include: { product: true },
      });

      const updated = await tx.product.update({ where: { id: product.id }, data: { stock: { decrement: quantity } } });
      await logMovement(tx, req, {
        movableType: MOVABLE.Product,
        movable: product,
        type: MOVEMENT.SALE,
        before: product.stock,
        change: -quantity,
      });

      return { sale, remaining: updated.stock };
    });

    res.status(201).json({ message: 'Vente enregistrée avec succès', sale: result.sale, remaining_stock: result.remaining });
  } catch (err) {
    if (err instanceof HttpError) throw err;
    res.status(500).json({ message: `Erreur lors de la vente: ${err.message}` });
  }
}

export async function sales(req, res) {
  const limit = Math.max(1, Number(input(req).limit ?? 50) || 50);
  const list = await prisma.productSale.findMany({
    where: orgScope(req),
    include: { product: true, staff: true },
    orderBy: { sale_date: 'desc' },
    take: limit,
  });

  res.json({
    sales: list.map((sale) => ({
      id: sale.id,
      product_name: sale.product.name,
      product_size: sale.product.size,
      quantity: sale.quantity,
      unit_price: Number(sale.unit_price),
      total_price: Number(sale.total_price),
      payment_method: sale.payment_method,
      staff_name: sale.staff?.name ?? 'N/A',
      sale_date: sale.sale_date.toISOString(),
    })),
  });
}

export async function updateStock(req, res) {
  const data = input(req);
  await validate(data, { stock: 'required|integer|min:0', reason: 'nullable|string|max:255' });

  const product = orFail(await prisma.product.findFirst({ where: orgScope(req, { id: Number(req.params.id) }) }), 'Product', req.params.id);
  const stock = Number(data.stock);
  const change = stock - product.stock;

  const updated = await prisma.product.update({ where: { id: product.id }, data: { stock } });
  if (change !== 0) {
    await logMovement(prisma, req, {
      movableType: MOVABLE.Product,
      movable: product,
      type: MOVEMENT.MANUAL_ADJUSTMENT,
      before: product.stock,
      change,
      reason: data.reason ?? null,
    });
  }

  res.json({ message: 'Stock mis à jour', product: updated });
}

export async function store(req, res) {
  const data = input(req);
  await validate(data, {
    name: 'required|string|max:255',
    category: 'required|in:snack,drink',
    price: 'required|numeric|min:0',
    size: 'nullable|string|max:50',
    stock: 'required|integer|min:0',
    image: 'nullable|string|max:10',
  });

  const product = await prisma.product.create({
    data: withOrg(req, {
      name: data.name,
      category: data.category,
      price: Number(data.price),
      size: data.size ?? null,
      stock: Number(data.stock),
      is_available: true,
      image: data.image ?? '📦',
    }),
  });

  if (product.stock > 0) {
    await logMovement(prisma, req, {
      movableType: MOVABLE.Product,
      movable: product,
      type: MOVEMENT.INITIAL_STOCK,
      before: 0,
      change: product.stock,
    });
  }

  res.status(201).json({ message: 'Produit créé avec succès', product });
}

export async function update(req, res) {
  const data = input(req);
  await validate(data, {
    name: 'sometimes|required|string|max:255',
    category: 'sometimes|required|in:snack,drink',
    price: 'sometimes|required|numeric|min:0',
    size: 'nullable|string|max:50',
    stock: 'sometimes|required|integer|min:0',
    is_available: 'sometimes|boolean',
    image: 'nullable|string|max:10',
  });

  const product = orFail(await prisma.product.findFirst({ where: orgScope(req, { id: Number(req.params.id) }) }), 'Product', req.params.id);

  const changes = pick(data, ['name', 'category', 'size', 'image']);
  if (has(data, 'price')) changes.price = Number(data.price);
  if (has(data, 'stock')) changes.stock = Number(data.stock);
  if (has(data, 'is_available')) changes.is_available = bool(data.is_available);

  const updated = await prisma.product.update({ where: { id: product.id }, data: changes });
  res.json({ message: 'Produit mis à jour avec succès', product: updated });
}

export async function destroy(req, res) {
  const id = Number(req.params.id);
  const product = orFail(await prisma.product.findFirst({ where: orgScope(req, { id }) }), 'Product', req.params.id);

  const salesCount = await prisma.productSale.count({ where: orgScope(req, { product_id: id }) });
  if (salesCount > 0) {
    const disabled = await prisma.product.update({ where: { id }, data: { is_available: false } });
    return res.json({ message: 'Produit désactivé (des ventes existent pour ce produit)', product: disabled });
  }

  await prisma.product.delete({ where: { id: product.id } });
  res.json({ message: 'Produit supprimé avec succès' });
}

export async function lowStock(req, res) {
  const threshold = 10;
  const products = await prisma.product.findMany({
    where: orgScope(req, { is_available: true, stock: { lte: threshold } }),
    orderBy: { stock: 'asc' },
  });

  res.json({
    products: products.map((p) => ({
      id: p.id,
      name: p.name,
      size: p.size,
      category: p.category,
      stock: p.stock,
      price: Number(p.price),
      image: p.image,
    })),
    count: products.length,
  });
}
