# Tonsor — Fullstack (React + Express/Prisma + Supabase)

Frontend React (Vite) et API Express/Prisma dans un seul repo, déployés ensemble et gratuitement sur **Vercel**, avec la base de données **PostgreSQL sur Supabase**.

Cette API remplace l'ancien backend Laravel (`larbackend`). Les routes, les réponses JSON et les messages sont les mêmes, donc le frontend fonctionne sans modification.

```
frontend/   React + Vite (copie de larfrontend ; l'API est appelée sur /api)
server/     API Express
  prisma/   schema.prisma, migrations SQL, seed
  scripts/  migrate-from-mysql.js (import des données de l'ancienne base)
  src/      app.js, routes.js, controllers/, lib/
api/        index.js : point d'entrée de la fonction serverless Vercel
```

## 1. Créer la base Supabase

1. Sur [supabase.com](https://supabase.com), créez un projet gratuit. Choisissez une région proche de la région Vercel, par exemple **eu-west-3 (Paris)** avec Vercel `cdg1`.
2. Allez dans **Project Settings → Database → Connection string** et copiez :
   - **Transaction pooler** (port `6543`) → `DATABASE_URL`, en ajoutant `?pgbouncer=true&connection_limit=1` à la fin ;
   - **Session pooler** (port `5432`) → `DIRECT_URL`.
3. Copiez `.env.example` en `.env` et remplissez ces deux URLs.

## 2. Créer les tables puis importer les données

```bash
npm install
npm run db:deploy        # crée les tables et active le RLS (verrouille l'API REST Supabase)
```

**Pour récupérer les données de l'ancien MySQL** (production ou local) :

```bash
# dans .env : MYSQL_URL="mysql://user:motdepasse@hote:3306/base"
npm run migrate:mysql
```

Le script conserve les ids, les mots de passe et les tokens de connexion : les utilisateurs déjà connectés le restent. Si la base Postgres contient déjà des données, il refuse de continuer. Ajoutez `-- --force` pour la vider avant l'import.

**Pour partir d'une base vide** : renseignez `SEED_SUPER_ADMIN_EMAIL` et `SEED_SUPER_ADMIN_PASSWORD`, puis lancez `npm run db:seed`.

## 3. Développer en local

```bash
npm run dev     # API sur :3001 + frontend sur :5173 (Vite redirige /api vers l'API)
```

## 4. Déployer sur Vercel

1. Poussez ce repo sur GitHub, puis importez-le dans Vercel (*Add New → Project*). Le fichier `vercel.json` contient déjà toute la configuration.
2. Dans **Settings → Environment Variables**, ajoutez :
   `DATABASE_URL`, `DIRECT_URL`, `STRIPE_SECRET`, `STRIPE_WEBHOOK_SECRET`. Optionnels : `FRONTEND_URL` et `GREEN_API_*`.
3. Lancez le déploiement. Le frontend est servi sur `/` et l'API sur `/api/*`, sur le même domaine.
4. Dans Stripe, pointez le webhook vers `https://<votre-domaine>/api/stripe/webhook` avec les événements
   `checkout.session.completed`, `invoice.paid`, `invoice.payment_failed`, `customer.subscription.updated` et `customer.subscription.deleted`. Mettez ensuite à jour `STRIPE_WEBHOOK_SECRET`.

Pour toute modification future du schéma : modifiez `server/prisma/schema.prisma`, lancez `npm run db:migrate` en local, commitez la migration générée, puis exécutez `npm run db:deploy` sur Supabase.

## Bon à savoir

- **Supabase gratuit** met le projet en pause après 7 jours sans activité. Il suffit de le réactiver depuis le dashboard.
- **Vercel gratuit (Hobby)** : les fonctions sont limitées à 30 s par requête, ce qui suffit largement pour cette API.
- L'arrêt automatique des sessions de jeu en fin de forfait est géré par le frontend (`MachineCard`), comme avant. `/sessions/check-auto-stop` se contente d'un rapport.
- Les routes temporaires de l'ancien backend (`/temp/*`, `/debug/*`, `/fix/*`, `/create-admin-ziad-temp`) n'ont pas été reprises.
