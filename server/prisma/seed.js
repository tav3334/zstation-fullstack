// Données de base pour une base VIDE (inutile si vous migrez les données MySQL avec migrate:mysql).
//   npm run db:seed
// Crée : modes de tarification, type de jeu, plans d'abonnement, et un super admin
// (SEED_SUPER_ADMIN_EMAIL / SEED_SUPER_ADMIN_PASSWORD).
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  if ((await prisma.pricingMode.count()) === 0) {
    await prisma.pricingMode.createMany({
      data: [
        { code: 'fixed', label: 'Prix Fixe' },
        { code: 'per_match', label: 'Par Match' },
      ],
    });
    console.log('✓ Modes de tarification');
  }

  if ((await prisma.gameType.count()) === 0) {
    await prisma.gameType.create({ data: { name: 'Standard' } });
    console.log('✓ Type de jeu');
  }

  if ((await prisma.subscriptionPlan.count()) === 0) {
    await prisma.subscriptionPlan.createMany({
      data: [
        {
          name: 'Basique',
          price: 0,
          limits: { max_machines: 5, max_users: 3, max_games: 10 },
          features: ["Jusqu'à 5 postes de coiffure", "Jusqu'à 3 agents", 'Prestations et services illimités', 'Support standard'],
        },
        {
          name: 'Pro',
          price: 0,
          limits: { max_machines: 15, max_users: 8, max_games: 30 },
          features: ["Jusqu'à 15 postes de coiffure", "Jusqu'à 8 agents", 'Prestations et services illimités', 'Support prioritaire', 'Rapports avancés'],
        },
        {
          name: 'Premium',
          price: 0,
          limits: { max_machines: 0, max_users: 0, max_games: 0 },
          features: ['Postes de coiffure illimités', 'Agents illimités', 'Prestations et services illimités', 'Support VIP 24/7', 'Rapports complets', 'Accès API'],
        },
      ],
    });
    console.log("✓ Plans d'abonnement (prix à 0 : à ajuster dans l'espace super admin)");
  }

  const email = process.env.SEED_SUPER_ADMIN_EMAIL;
  const password = process.env.SEED_SUPER_ADMIN_PASSWORD;
  if (email && password) {
    const exists = await prisma.user.findUnique({ where: { email } });
    if (!exists) {
      await prisma.user.create({
        data: { name: 'Super Admin', email, password: await bcrypt.hash(password, 12), role: 'super_admin' },
      });
      console.log(`✓ Super admin ${email}`);
    }
  } else {
    console.log('ℹ SEED_SUPER_ADMIN_EMAIL / SEED_SUPER_ADMIN_PASSWORD non définis : aucun super admin créé.');
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
