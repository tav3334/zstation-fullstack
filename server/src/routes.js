// Table de routage de l'API — même ordre et mêmes protections que l'ancien routes/api.php.
// (Les endpoints temporaires /temp/*, /debug/*, /fix/* et /create-admin-ziad-temp ne sont pas repris.)
import { Router } from 'express';
import { authenticate, requireAdmin, requireRole, requireSubscription, throttle } from './lib/auth.js';
import * as auth from './controllers/auth.js';
import * as gaming from './controllers/gaming.js';
import * as payments from './controllers/payments.js';
import * as cash from './controllers/cashRegister.js';
import * as products from './controllers/products.js';
import * as customers from './controllers/customers.js';
import * as salon from './controllers/salon.js';
import * as dashboard from './controllers/dashboard.js';
import * as admin from './controllers/admin.js';
import * as checkout from './controllers/checkout.js';
import * as sa from './controllers/superAdmin.js';

const router = Router();

// ========== AUTH (public) ==========
router.post('/login', throttle(5, 1), auth.login);
router.post('/signup', throttle(5, 1), auth.signup);

// ========== LANDING PAGE (public) ==========
router.get('/public/plans', checkout.plans);

// ========== HEALTH CHECK ==========
router.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Tonsor API is running', timestamp: new Date() });
});

// ========== ROUTES PROTÉGÉES (agent + admin) ==========
const user = Router();
user.use(authenticate);

user.get('/user', auth.currentUser);
user.post('/logout', auth.logout);
user.get('/me', auth.me);
user.post('/change-password', auth.changePassword);
user.put('/profile', auth.updateProfile);

user.get('/organization/settings', admin.organizationShow);

// Abonnement (pas de blocage ici)
user.get('/subscription/status', sa.subscriptionStatus);
user.get('/subscription/plans', checkout.plans);
user.post('/subscription/checkout', checkout.createCheckout);
user.get('/subscription/checkout/verify', checkout.verifyCheckout);
user.post('/subscription/cancel', checkout.cancelSubscription);
user.post('/subscription/resume', checkout.resumeSubscription);

// ── Routes bloquées si l'abonnement est expiré ──
const sub = [requireSubscription];

user.get('/games', sub, gaming.games);
user.get('/game-pricings', sub, gaming.gamePricings);
user.get('/machines', sub, gaming.machines);

user.get('/sessions', sub, gaming.sessions);
user.post('/sessions/start', sub, gaming.startSession);
user.post('/sessions/stop/:id', sub, gaming.stopSession);
user.post('/sessions/extend/:id', sub, gaming.extendSession);
user.get('/sessions/status/:id', sub, gaming.sessionStatus);
user.get('/sessions/check-auto-stop', sub, gaming.checkAutoStop);

user.post('/payments', sub, payments.storePayment);
user.get('/payments/today', sub, payments.todayPayments);
user.get('/payments/stats', sub, payments.paymentStats);
user.get('/payments/:id', sub, payments.showPayment);

user.get('/dashboard/stats', sub, dashboard.stats);
user.get('/dashboard/payments', sub, dashboard.payments);
user.get('/dashboard/sessions', sub, dashboard.sessions);

user.get('/cash-register/today', sub, cash.todayRegister);
user.get('/cash-register/history', sub, cash.history);

user.get('/products', sub, products.index);
user.post('/products/sell', sub, products.sell);
user.get('/products/sales', sub, products.sales);
user.get('/products/low-stock', sub, products.lowStock);

user.get('/services', sub, salon.servicesIndex);
user.get('/service-categories', sub, salon.categoriesIndex);
user.get('/coiffeurs', sub, salon.coiffeursIndex);

user.get('/customers', sub, customers.index);
user.get('/customers/all', sub, customers.all);
user.get('/customers/:id', sub, customers.show);

user.get('/stock-products', sub, salon.stockIndex);
user.get('/stock-products/low-stock', sub, salon.stockLow);

user.post('/sales', sub, salon.salesStore);
user.get('/sales', sub, salon.salesIndex);
user.get('/sales/stats', sub, salon.salesStats);
user.get('/sales/:id', sub, salon.salesShow);

// ========== ROUTES ADMIN ==========
const adm = [requireAdmin];

user.post('/register', adm, auth.register);
user.put('/organization/settings', adm, admin.organizationUpdate);

user.get('/team', adm, admin.teamIndex);
user.post('/service-categories', adm, salon.categoriesStore);
user.put('/service-categories/:id', adm, salon.categoriesUpdate);
user.delete('/service-categories/:id', adm, salon.categoriesDestroy);
user.post('/team', adm, admin.teamStore);
user.delete('/team/:id', adm, admin.teamDestroy);

user.get('/machine-management', adm, admin.machinesIndex);
user.post('/machine-management', adm, admin.machinesStore);
user.put('/machine-management/:id', adm, admin.machinesUpdate);
user.delete('/machine-management/:id', adm, admin.machinesDestroy);

user.get('/game-management', adm, admin.gamesIndex);
user.post('/game-management', adm, admin.gamesStore);
user.put('/game-management/:id', adm, admin.gamesUpdate);
user.delete('/game-management/:id', adm, admin.gamesDestroy);
user.post('/game-management/:gameId/match-pricings', adm, admin.matchPricingStore);
user.put('/game-management/:gameId/match-pricings/:pricingId', adm, admin.matchPricingUpdate);
user.delete('/game-management/:gameId/match-pricings/:pricingId', adm, admin.matchPricingDestroy);

user.delete('/payments/:id', adm, payments.destroyPayment);

user.post('/customers', adm, customers.store);
user.put('/customers/:id', adm, customers.update);
user.delete('/customers/:id', adm, customers.destroy);
user.post('/customers/:id/payment', adm, customers.recordPayment);

user.get('/products/all', adm, products.all);
user.post('/products', adm, products.store);
user.put('/products/:id', adm, products.update);
user.put('/products/:id/stock', adm, products.updateStock);
user.delete('/products/:id', adm, products.destroy);

user.post('/cash-register/opening-balance', adm, cash.setOpeningBalance);
user.post('/cash-register/withdraw', adm, cash.withdraw);
user.post('/cash-register/close', adm, cash.closeRegister);

user.post('/sales/:id/cancel', adm, salon.salesCancel);
user.get('/stock-movements', adm, salon.stockMovements);

user.get('/services/all', adm, salon.servicesAll);
user.post('/services', adm, salon.servicesStore);
user.put('/services/:id', adm, salon.servicesUpdate);
user.delete('/services/:id', adm, salon.servicesDestroy);

user.get('/coiffeurs/all', adm, salon.coiffeursAll);
user.post('/coiffeurs', adm, salon.coiffeursStore);
user.put('/coiffeurs/:id', adm, salon.coiffeursUpdate);
user.delete('/coiffeurs/:id', adm, salon.coiffeursDestroy);

user.get('/stock-products/all', adm, salon.stockAll);
user.post('/stock-products', adm, salon.stockStore);
user.put('/stock-products/:id', adm, salon.stockUpdate);
user.put('/stock-products/:id/quantity', adm, salon.stockUpdateQuantity);
user.delete('/stock-products/:id', adm, salon.stockDestroy);

// ========== SUPER ADMIN ==========
const superAdmin = Router();
superAdmin.use(requireRole('super_admin'));

superAdmin.get('/organizations', sa.organizationsIndex);
superAdmin.post('/organizations', sa.organizationsStore);
superAdmin.get('/organizations/:id', sa.organizationsShow);
superAdmin.put('/organizations/:id', sa.organizationsUpdate);
superAdmin.delete('/organizations/:id', sa.organizationsDestroy);
superAdmin.post('/organizations/:id/assign-user', sa.organizationsAssignUser);
superAdmin.post('/organizations/:id/remove-user', sa.organizationsRemoveUser);
superAdmin.get('/organizations/:id/users', sa.organizationsUsers);
superAdmin.get('/organizations/:id/stats', sa.organizationsStats);

superAdmin.get('/users', sa.usersIndex);
superAdmin.post('/users', sa.usersStore);
superAdmin.get('/users/:id', sa.usersShow);
superAdmin.put('/users/:id', sa.usersUpdate);
superAdmin.delete('/users/:id', sa.usersDestroy);

superAdmin.get('/machines', sa.machinesIndex);
superAdmin.post('/machines', sa.machinesStore);
superAdmin.get('/machines/:id', sa.machinesShow);
superAdmin.put('/machines/:id', sa.machinesUpdate);
superAdmin.delete('/machines/:id', sa.machinesDestroy);

superAdmin.get('/games', sa.gamesIndex);
superAdmin.post('/games', sa.gamesStore);
superAdmin.get('/games/:id', sa.gamesShow);
superAdmin.put('/games/:id', sa.gamesUpdate);
superAdmin.delete('/games/:id', sa.gamesDestroy);
superAdmin.post('/games/:id/pricings', sa.pricingsStore);
superAdmin.put('/games/:gameId/pricings/:pricingId', sa.pricingsUpdate);
superAdmin.delete('/games/:gameId/pricings/:pricingId', sa.pricingsDestroy);

superAdmin.get('/subscription-plans', sa.plansIndex);
superAdmin.post('/subscription-plans', sa.plansStore);
superAdmin.get('/subscription-plans/:id', sa.plansShow);
superAdmin.put('/subscription-plans/:id', sa.plansUpdate);
superAdmin.post('/subscription-plans/:id', sa.plansUpdate); // compat _method PUT
superAdmin.delete('/subscription-plans/:id', sa.plansDestroy);

superAdmin.get('/subscriptions', sa.subscriptionsIndex);
superAdmin.post('/subscriptions', sa.subscriptionsStore);
superAdmin.get('/subscriptions/:id', sa.subscriptionsShow);
superAdmin.put('/subscriptions/:id', sa.subscriptionsUpdate);
superAdmin.post('/subscriptions/:id', sa.subscriptionsUpdate); // compat _method PUT
superAdmin.post('/subscriptions/:id/toggle', sa.subscriptionsToggle);
superAdmin.get('/invoices', sa.invoicesIndex);

superAdmin.get('/pricing-modes', sa.pricingModes);
superAdmin.get('/stats', sa.stats);

user.use('/super-admin', superAdmin);
router.use(user);

export default router;
