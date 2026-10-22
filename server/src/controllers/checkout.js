// Abonnements payants via Stripe Checkout + webhook (CheckoutController).
import Stripe from 'stripe';
import { prisma } from '../lib/prisma.js';
import { input, numberFormat, orFail } from '../lib/http.js';
import { validate } from '../lib/validate.js';
import { sendWhatsApp } from '../lib/misc.js';
import { addMonths, formatDate, startOfDay } from '../lib/dates.js';

let stripeClient;
function stripe() {
  if (!process.env.STRIPE_SECRET) throw new Error('STRIPE_SECRET non configurée');
  stripeClient ??= new Stripe(process.env.STRIPE_SECRET);
  return stripeClient;
}

const frontendUrl = (req) => process.env.FRONTEND_URL || `${req.protocol}://${req.get('host')}`;

/** Selon la version de l'API Stripe, l'id d'abonnement d'une facture est à la racine ou dans parent. */
const invoiceSubscriptionId = (invoice) =>
  invoice.subscription ?? invoice.parent?.subscription_details?.subscription ?? null;

const idOf = (value) => (value && typeof value === 'object' ? value.id : value);

export async function plans(req, res) {
  const list = await prisma.subscriptionPlan.findMany({ orderBy: [{ price: 'asc' }, { id: 'asc' }] });
  res.json({ success: true, plans: list });
}

/** Retourne un Price Stripe récurrent (mensuel) correspondant au prix actuel du plan, en le créant si besoin. */
async function resolveStripePrice(plan) {
  const expectedAmount = Math.round(Number(plan.price) * 100);

  if (plan.stripe_price_id) {
    try {
      const existing = await stripe().prices.retrieve(plan.stripe_price_id);
      if (existing.active && existing.unit_amount === expectedAmount) return plan.stripe_price_id;
    } catch {
      // Price supprimé ou introuvable : on en recrée un
    }
  }

  let productId = plan.stripe_product_id;
  if (!productId) {
    const product = await stripe().products.create({
      name: `Tonsor — Plan ${plan.name}`,
      description: plan.description || undefined,
    });
    productId = product.id;
  }

  const price = await stripe().prices.create({
    product: productId,
    currency: 'mad',
    unit_amount: expectedAmount,
    recurring: { interval: 'month' },
  });

  await prisma.subscriptionPlan.update({
    where: { id: plan.id },
    data: { stripe_product_id: productId, stripe_price_id: price.id },
  });
  return price.id;
}

export async function createCheckout(req, res) {
  const data = input(req);
  await validate(data, { plan_id: 'required|exists:subscription_plans,id' });

  const user = req.user;
  const plan = orFail(await prisma.subscriptionPlan.findUnique({ where: { id: Number(data.plan_id) } }), 'SubscriptionPlan', data.plan_id);
  if (!user.organization_id) {
    return res.status(403).json({ success: false, message: 'Aucune organisation associée à votre compte.' });
  }

  const metadata = {
    plan_id: String(plan.id),
    organization_id: String(user.organization_id),
    user_id: String(user.id),
    grace_days: String(plan.grace_days),
  };
  const baseUrl = frontendUrl(req);
  const params = {
    payment_method_types: ['card'],
    mode: 'subscription',
    customer_email: user.email,
    line_items: [{ price: await resolveStripePrice(plan), quantity: 1 }],
    subscription_data: { metadata },
    metadata,
    success_url: `${baseUrl}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${baseUrl}/payment/cancel`,
  };

  // Réutilise le client Stripe existant de l'organisation
  const existing = await prisma.subscription.findFirst({
    where: { organization_id: user.organization_id, stripe_customer_id: { not: null } },
    orderBy: [{ created_at: 'desc' }, { id: 'desc' }],
  });
  if (existing?.stripe_customer_id) {
    delete params.customer_email;
    params.customer = existing.stripe_customer_id;
  }

  const session = await stripe().checkout.sessions.create(params);
  res.json({ success: true, checkout_url: session.url });
}

export async function verifyCheckout(req, res) {
  const data = input(req);
  await validate(data, { session_id: 'required|string' });

  let session;
  try {
    session = await stripe().checkout.sessions.retrieve(data.session_id);
  } catch {
    return res.status(404).json({ success: false, message: 'Session de paiement introuvable.' });
  }

  if (Number(session.metadata?.organization_id ?? 0) !== Number(req.user.organization_id)) {
    return res.status(403).json({ success: false, message: 'Cette session ne correspond pas à votre organisation.' });
  }

  const paid = session.payment_status === 'paid';
  const subscriptionId = idOf(session.subscription);
  if (paid && subscriptionId) {
    const already = await prisma.subscription.findUnique({ where: { stripe_subscription_id: subscriptionId } });
    if (!already) {
      const stripeSubscription = await stripe().subscriptions.retrieve(subscriptionId);
      await activateSubscription(stripeSubscription, idOf(session.customer));
    }
  }

  res.json({ success: true, payment_status: session.payment_status, paid });
}

async function activeStripeSubscription(req, res, notFoundMessage) {
  if (!req.user.organization_id) {
    res.status(403).json({ success: false, message: 'Aucune organisation associée à votre compte.' });
    return null;
  }
  const sub = await prisma.subscription.findFirst({
    where: { organization_id: req.user.organization_id, is_active: true },
    orderBy: [{ created_at: 'desc' }, { id: 'desc' }],
  });
  if (!sub || !sub.stripe_subscription_id) {
    res.status(404).json({ success: false, message: notFoundMessage });
    return null;
  }
  return sub;
}

export async function cancelSubscription(req, res) {
  const sub = await activeStripeSubscription(req, res, 'Aucun abonnement actif à annuler.');
  if (!sub) return;
  if (sub.cancel_at_period_end) {
    return res.status(400).json({ success: false, message: "Cet abonnement est déjà en cours d'annulation." });
  }

  try {
    await stripe().subscriptions.update(sub.stripe_subscription_id, { cancel_at_period_end: true });
  } catch (err) {
    return res.status(500).json({ success: false, message: `Erreur lors de l'annulation: ${err.message}` });
  }

  await prisma.subscription.update({ where: { id: sub.id }, data: { cancel_at_period_end: true } });
  res.json({
    success: true,
    message: `Abonnement annulé. Vous conservez l'accès jusqu'au ${sub.ends_at ? formatDate(sub.ends_at) : ''}.`,
  });
}

export async function resumeSubscription(req, res) {
  const sub = await activeStripeSubscription(req, res, 'Aucun abonnement actif à reprendre.');
  if (!sub) return;
  if (!sub.cancel_at_period_end) {
    return res.status(400).json({ success: false, message: "Cet abonnement n'est pas en cours d'annulation." });
  }

  try {
    await stripe().subscriptions.update(sub.stripe_subscription_id, { cancel_at_period_end: false });
  } catch (err) {
    return res.status(500).json({ success: false, message: `Erreur lors de la reprise: ${err.message}` });
  }

  await prisma.subscription.update({ where: { id: sub.id }, data: { cancel_at_period_end: false } });
  res.json({ success: true, message: 'Abonnement repris. Le renouvellement automatique est réactivé.' });
}

/** Webhook Stripe (corps brut nécessaire pour vérifier la signature). */
export async function webhook(req, res) {
  let event;
  try {
    event = stripe().webhooks.constructEvent(req.body, req.get('stripe-signature'), process.env.STRIPE_WEBHOOK_SECRET);
  } catch {
    return res.status(400).json({ error: 'Signature invalide' });
  }

  const object = event.data.object;
  switch (event.type) {
    case 'checkout.session.completed':
      if (object.mode === 'subscription' && object.subscription) {
        const stripeSubscription = await stripe().subscriptions.retrieve(idOf(object.subscription));
        await activateSubscription(stripeSubscription, idOf(object.customer));
      }
      break;

    case 'invoice.paid': {
      const subscriptionId = invoiceSubscriptionId(object);
      if (subscriptionId) {
        const stripeSubscription = await stripe().subscriptions.retrieve(idOf(subscriptionId));
        await syncSubscriptionPeriod(stripeSubscription, object);
      }
      break;
    }

    case 'customer.subscription.updated':
      await prisma.subscription.updateMany({
        where: { stripe_subscription_id: object.id },
        data: {
          cancel_at_period_end: Boolean(object.cancel_at_period_end),
          is_active: ['active', 'trialing'].includes(object.status),
        },
      });
      break;

    case 'customer.subscription.deleted':
      await prisma.subscription.updateMany({ where: { stripe_subscription_id: object.id }, data: { is_active: false } });
      break;

    case 'invoice.payment_failed':
      if (invoiceSubscriptionId(object)) await notifyPaymentFailed(object);
      break;

    default:
      break;
  }

  res.json({ received: true });
}

/** Fin de période courante (à la racine ou sur l'item selon la version de l'API Stripe). */
function currentPeriodEnd(stripeSubscription) {
  const ts = stripeSubscription.current_period_end ?? stripeSubscription.items?.data?.[0]?.current_period_end;
  return ts ? new Date(ts * 1000) : addMonths(new Date(), 1);
}

async function activateSubscription(stripeSubscription, stripeCustomerId) {
  const meta = stripeSubscription.metadata ?? {};
  const orgId = Number(meta.organization_id);
  const planId = Number(meta.plan_id);
  const grace = Number(meta.grace_days ?? 7);

  const plan = await prisma.subscriptionPlan.findUnique({ where: { id: planId } });
  let amount = Number(plan?.price ?? 0);
  const latestInvoice = stripeSubscription.latest_invoice;
  if (latestInvoice) {
    const invoice = typeof latestInvoice === 'object' ? latestInvoice : await stripe().invoices.retrieve(latestInvoice);
    amount = invoice.amount_paid / 100;
  }

  await prisma.$transaction(async (tx) => {
    // Une seule souscription active par organisation
    await tx.subscription.updateMany({ where: { organization_id: orgId }, data: { is_active: false } });
    const subscription = await tx.subscription.create({
      data: {
        organization_id: orgId,
        subscription_plan_id: planId,
        starts_at: startOfDay(),
        ends_at: startOfDay(currentPeriodEnd(stripeSubscription)),
        grace_days: grace,
        is_active: true,
        notes: 'Abonnement Stripe récurrent',
        stripe_customer_id: stripeCustomerId ?? null,
        stripe_subscription_id: stripeSubscription.id,
        cancel_at_period_end: false,
      },
    });
    await tx.subscriptionInvoice.create({
      data: {
        organization_id: orgId,
        subscription_id: subscription.id,
        subscription_plan_id: planId,
        plan_name: plan?.name ?? 'Plan supprimé',
        amount,
        currency: String(stripeSubscription.currency ?? 'mad').toUpperCase(),
        stripe_session_id: stripeSubscription.id,
        status: 'paid',
        paid_at: new Date(),
      },
    });
  });

  await notifyPaymentReceived(orgId, planId, amount, stripeSubscription.id);
}

async function syncSubscriptionPeriod(stripeSubscription, invoice) {
  const subscription = await prisma.subscription.findUnique({
    where: { stripe_subscription_id: stripeSubscription.id },
    include: { plan: true },
  });
  if (!subscription) return;

  await prisma.subscription.update({
    where: { id: subscription.id },
    data: { ends_at: startOfDay(currentPeriodEnd(stripeSubscription)), is_active: true },
  });

  // La première facture est déjà enregistrée par activateSubscription
  const already = await prisma.subscriptionInvoice.findUnique({ where: { stripe_session_id: invoice.id } });
  if (already || invoice.billing_reason === 'subscription_create') return;

  const amount = invoice.amount_paid / 100;
  await prisma.subscriptionInvoice.create({
    data: {
      organization_id: subscription.organization_id,
      subscription_id: subscription.id,
      subscription_plan_id: subscription.subscription_plan_id,
      plan_name: subscription.plan?.name ?? 'Plan supprimé',
      amount,
      currency: String(invoice.currency ?? 'mad').toUpperCase(),
      stripe_session_id: invoice.id,
      status: 'paid',
      paid_at: new Date(),
    },
  });

  await notifyPaymentReceived(subscription.organization_id, subscription.subscription_plan_id, amount, stripeSubscription.id);
}

async function notifyPaymentReceived(orgId, planId, amount, stripeSubscriptionId) {
  const org = await prisma.organization.findUnique({ where: { id: orgId } });
  const plan = await prisma.subscriptionPlan.findUnique({ where: { id: planId } });
  await sendWhatsApp(
    "💈 *Tonsor — Paiement d'abonnement reçu*\n\n" +
      `Organisation : *${org?.name ?? 'N/A'}*\n` +
      `Plan : ${plan?.name ?? 'N/A'}\n` +
      `Montant : ${numberFormat(amount)} DH\n` +
      `Abonnement Stripe : ${stripeSubscriptionId}\n\n` +
      'Vérifiez le compte client si nécessaire.',
  );
}

async function notifyPaymentFailed(invoice) {
  const subscriptionId = idOf(invoiceSubscriptionId(invoice));
  const subscription = await prisma.subscription.findUnique({ where: { stripe_subscription_id: subscriptionId } });
  const org = subscription ? await prisma.organization.findUnique({ where: { id: subscription.organization_id } }) : null;
  await sendWhatsApp(
    "⚠️ *Tonsor — Échec de paiement d'abonnement*\n\n" +
      `Organisation : *${org?.name ?? 'N/A'}*\n` +
      `Abonnement Stripe : ${subscriptionId}\n\n` +
      "Le renouvellement automatique a échoué. La période de grâce habituelle s'applique.",
  );
}
