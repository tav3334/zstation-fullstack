import { withOrg } from './org.js';

// Valeurs de movable_type conservées telles quelles pour rester compatibles avec les données migrées.
export const MOVABLE = {
  StockProduct: 'App\\Models\\StockProduct',
  Product: 'App\\Models\\Product',
};

export const MOVEMENT = {
  SALE: 'sale',
  SALE_CANCEL: 'sale_cancel',
  MANUAL_ADJUSTMENT: 'manual_adjustment',
  INITIAL_STOCK: 'initial_stock',
};

/** StockMovement::log() — `db` peut être le client Prisma ou une transaction. */
export function logMovement(db, req, { movableType, movable, type, before, change, saleId = null, reason = null, productName = null }) {
  return db.stockMovement.create({
    data: withOrg(req, {
      movable_type: movableType,
      movable_id: movable.id,
      product_name: productName ?? movable.name,
      type,
      quantity_before: before,
      quantity_change: change,
      quantity_after: Number(before) + Number(change),
      sale_id: saleId,
      user_id: req.user?.id ?? null,
      reason,
    }),
  });
}
