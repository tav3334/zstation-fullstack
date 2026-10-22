// Copie toutes les données de l'ancienne base MySQL (Laravel) vers PostgreSQL (Supabase).
//
//   1. npm run db:deploy          (crée les tables dans Supabase)
//   2. MYSQL_URL=mysql://user:pass@host:3306/zstation npm run migrate:mysql
//      Ajouter "-- --force" pour vider d'abord les tables Postgres (sinon refus si elles contiennent des données).
//
// Les ids sont conservés, les séquences sont recalées, les tokens de connexion sont copiés
// (les utilisateurs restent connectés). Les lignes orphelines (clé étrangère vers une ligne
// inexistante) sont corrigées : FK mise à NULL si possible, sinon ligne ignorée — avec un avertissement.
import mysql from 'mysql2/promise';
import { Prisma, PrismaClient } from '@prisma/client';

const ORDER = [
  'Organization', 'User', 'PersonalAccessToken', 'GameType', 'PricingMode', 'Machine', 'Game', 'GamePricing',
  'Customer', 'GameSession', 'Payment', 'Product', 'ProductSale', 'CashRegister', 'SubscriptionPlan',
  'Subscription', 'SubscriptionInvoice', 'Coiffeur', 'Service', 'ServiceCategory', 'StockProduct',
  'ServiceProduct', 'Sale', 'SaleProduct', 'SaleService', 'StockMovement', 'CustomerCreditMovement',
];

const force = process.argv.includes('--force');
const mysqlUrl = process.env.MYSQL_URL;
if (!mysqlUrl) {
  console.error('MYSQL_URL manquante (ex: mysql://root:@127.0.0.1:3306/zstation)');
  process.exit(1);
}

const prisma = new PrismaClient();
const models = new Map(Prisma.dmmf.datamodel.models.map((m) => [m.name, m]));
const delegate = (name) => prisma[name[0].toLowerCase() + name.slice(1)];
const tableOf = (name) => models.get(name).dbName ?? name;

/** Les dates MySQL sont lues telles que Laravel les a écrites (en UTC). */
function toDate(value) {
  if (value === null || value === undefined) return null;
  const s = String(value);
  if (s.startsWith('0000-00-00')) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return new Date(`${s}T00:00:00Z`);
  return new Date(`${s.replace(' ', 'T')}Z`);
}

function convert(field, value) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  switch (field.type) {
    case 'Int': return Number(value);
    case 'Boolean': return Boolean(Number(value));
    case 'Decimal': return String(value);
    case 'DateTime': return toDate(value);
    case 'Json': return typeof value === 'string' ? JSON.parse(value) : value;
    default: return Buffer.isBuffer(value) ? value.toString('utf8') : String(value);
  }
}

async function main() {
  const conn = await mysql.createConnection({ uri: mysqlUrl, dateStrings: true, supportBigNumbers: true, bigNumberStrings: false });
  const [tables] = await conn.query('SHOW TABLES');
  const mysqlTables = new Set(tables.map((row) => Object.values(row)[0]));

  // Vérifie que la base cible est vide (ou la vide avec --force)
  const counts = await Promise.all(ORDER.map((name) => delegate(name).count()));
  if (counts.some((c) => c > 0)) {
    if (!force) {
      console.error('La base Postgres contient déjà des données. Relancez avec --force pour la vider avant import.');
      process.exit(1);
    }
    const list = ORDER.map((n) => `"${tableOf(n)}"`).join(', ');
    await prisma.$executeRawUnsafe(`TRUNCATE ${list} RESTART IDENTITY CASCADE`);
    console.log('Base Postgres vidée (--force).');
  }

  const ids = new Map(); // modèle → Set des ids importés (pour détecter les orphelins)

  for (const name of ORDER) {
    const model = models.get(name);
    const table = tableOf(name);
    if (!mysqlTables.has(table)) {
      console.warn(`⚠ Table MySQL "${table}" absente : ignorée`);
      ids.set(name, new Set());
      continue;
    }

    const [rows] = await conn.query(`SELECT * FROM \`${table}\` ORDER BY id`);
    const scalars = model.fields.filter((f) => f.kind === 'scalar');
    const relations = model.fields.filter((f) => f.kind === 'object' && f.relationFromFields?.length);

    const data = [];
    for (const row of rows) {
      const record = {};
      for (const field of scalars) {
        const value = convert(field, row[field.dbName ?? field.name]);
        if (value !== undefined) record[field.name] = value;
      }

      let keep = true;
      for (const rel of relations) {
        const fk = rel.relationFromFields[0];
        const target = ids.get(rel.type);
        if (record[fk] == null || !target || target.has(record[fk])) continue;
        const fkField = scalars.find((f) => f.name === fk);
        if (fkField && !fkField.isRequired) {
          console.warn(`⚠ ${table}#${record.id} : ${fk}=${record[fk]} introuvable → mis à NULL`);
          record[fk] = null;
        } else {
          console.warn(`⚠ ${table}#${record.id} : ${fk}=${record[fk]} introuvable → ligne ignorée`);
          keep = false;
        }
      }
      if (keep) data.push(record);
    }

    for (let i = 0; i < data.length; i += 500) {
      await delegate(name).createMany({ data: data.slice(i, i + 500) });
    }
    ids.set(name, new Set(data.map((r) => r.id)));

    // Recale la séquence auto-incrément sur le plus grand id importé
    await prisma.$executeRawUnsafe(
      `SELECT setval(pg_get_serial_sequence('"${table}"', 'id'), COALESCE((SELECT MAX(id) FROM "${table}"), 0) + 1, false)`,
    );
    console.log(`✓ ${table.padEnd(28)} ${String(data.length).padStart(6)} ligne(s)`);
  }

  await conn.end();
  console.log('\nMigration terminée.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
