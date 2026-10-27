-- Caisse (POS) : code-barres produit + répartition des encaissements par moyen de paiement (paiement mixte).

-- AlterTable
ALTER TABLE "stock_products" ADD COLUMN     "barcode" TEXT;

-- AlterTable
ALTER TABLE "sales" ADD COLUMN     "paid_card" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "paid_cash" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "paid_mobile" DECIMAL(10,2) NOT NULL DEFAULT 0;

-- CreateIndex
CREATE UNIQUE INDEX "stock_products_organization_id_barcode_key" ON "stock_products"("organization_id", "barcode");

-- Reprise des ventes existantes : tout le total sur le moyen de paiement unique.
-- Les ventes à crédit n'ont rien encaissé (paid_* restent à 0).
UPDATE "sales" SET "paid_cash"   = "total" WHERE "paid_on_credit" = false AND "payment_method" = 'cash';
UPDATE "sales" SET "paid_card"   = "total" WHERE "paid_on_credit" = false AND "payment_method" = 'card';
UPDATE "sales" SET "paid_mobile" = "total" WHERE "paid_on_credit" = false AND "payment_method" = 'mobile';
