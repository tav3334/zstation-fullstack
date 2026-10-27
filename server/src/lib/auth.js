import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { prisma } from './prisma.js';
import { latestSubscription, subscriptionState } from './subscription.js';

const USER_TYPE = 'App\\Models\\User';
const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');

export const isSuperAdmin = (user) => user?.role === 'super_admin';

// Laravel hashe en bcrypt "$2y$" (identique à "$2b$") avec un coût de 12.
export const hashPassword = (plain) => bcrypt.hash(String(plain), 12);

export async function checkPassword(plain, hash) {
  if (!hash || plain == null) return false;
  return bcrypt.compare(String(plain), hash.replace(/^\$2y\$/, '$2b$'));
}

/** Récupère le hash du mot de passe (omis par défaut dans toutes les requêtes). */
export async function passwordHashOf(userId) {
  const row = await prisma.user.findUnique({ where: { id: userId }, select: { password: true } });
  return row?.password ?? null;
}

/**
 * Crée un token d'API au format Laravel Sanctum : "<id>|<secret>",
 * seul le SHA-256 du secret est stocké en base.
 */
export async function createToken(userId, name = 'auth-token') {
  const secret = crypto.randomBytes(30).toString('base64url').slice(0, 40);
  const row = await prisma.personalAccessToken.create({
    data: { tokenable_type: USER_TYPE, tokenable_id: userId, name, token: sha256(secret), abilities: '["*"]' },
  });
  return `${row.id}|${secret}`;
}

/** Déconnecte toutes les sessions d'un utilisateur, sauf éventuellement le token `exceptTokenId`. */
export function revokeTokens(userId, exceptTokenId = null) {
  return prisma.personalAccessToken.deleteMany({
    where: {
      tokenable_type: USER_TYPE,
      tokenable_id: userId,
      ...(exceptTokenId ? { NOT: { id: exceptTokenId } } : {}),
    },
  });
}

/** Hash du code PIN caissier (omis par défaut dans toutes les requêtes). */
export async function pinHashOf(userId) {
  const row = await prisma.user.findUnique({ where: { id: userId }, select: { pin_hash: true } });
  return row?.pin_hash ?? null;
}

async function findToken(bearer) {
  if (bearer.includes('|')) {
    const [id, secret] = bearer.split('|', 2);
    if (!/^\d+$/.test(id)) return null;
    const row = await prisma.personalAccessToken.findUnique({ where: { id: Number(id) } });
    if (!row) return null;
    const expected = Buffer.from(row.token);
    const given = Buffer.from(sha256(secret));
    return expected.length === given.length && crypto.timingSafeEqual(expected, given) ? row : null;
  }
  return prisma.personalAccessToken.findUnique({ where: { token: sha256(bearer) } });
}

/** Middleware auth:sanctum — 401 "Unauthenticated." si le token est absent ou invalide. */
export async function authenticate(req, res, next) {
  const header = req.get('authorization') ?? '';
  const bearer = header.startsWith('Bearer ') ? header.slice(7).trim() : null;
  if (!bearer) return res.status(401).json({ message: 'Unauthenticated.' });

  const token = await findToken(bearer);
  if (!token || token.tokenable_type !== USER_TYPE || (token.expires_at && token.expires_at < new Date())) {
    return res.status(401).json({ message: 'Unauthenticated.' });
  }

  const user = await prisma.user.findUnique({ where: { id: token.tokenable_id } });
  if (!user) return res.status(401).json({ message: 'Unauthenticated.' });
  if (!user.is_active) {
    await prisma.personalAccessToken.delete({ where: { id: token.id } }).catch(() => {});
    return res.status(401).json({ message: 'Ce compte est désactivé.' });
  }

  req.user = user;
  req.accessTokenId = token.id;
  next();
}

/** Middleware 'admin' : admin ou super_admin. */
export function requireAdmin(req, res, next) {
  if (!req.user || !['admin', 'super_admin'].includes(req.user.role)) {
    return res.status(403).json({ message: 'Accès refusé. Admin uniquement.' });
  }
  next();
}

/** Middleware 'role:xxx'. */
export const requireRole = (role) => (req, res, next) => {
  if (!req.user) return res.status(401).json({ success: false, message: 'Non authentifié' });
  if (req.user.role !== role) {
    return res.status(403).json({ success: false, message: `Accès non autorisé. Vous devez être ${role}.` });
  }
  next();
};

/** Middleware 'subscription' : bloque si l'abonnement de l'organisation est expiré/suspendu. */
export async function requireSubscription(req, res, next) {
  const user = req.user;
  if (!user || user.role === 'super_admin' || !user.organization_id) return next();

  const sub = await latestSubscription(user.organization_id);
  if (!sub) {
    return res.status(403).json({
      success: false,
      blocked: true,
      message: 'Aucun abonnement actif pour votre organisation. Veuillez choisir un plan.',
    });
  }
  if (subscriptionState(sub).is_blocked) {
    return res.status(403).json({
      success: false,
      blocked: true,
      message: 'Abonnement expiré ou suspendu. Contactez votre administrateur.',
    });
  }
  next();
}

// ── Limitation simple du nombre de tentatives (throttle:5,1) ──
// En mémoire, donc par instance : suffisant pour freiner le brute-force sur /login.
const attempts = new Map();

export const throttle = (maxAttempts, minutes) => (req, res, next) => {
  const key = `${req.path}|${req.ip}`;
  const now = Date.now();
  const windowMs = minutes * 60_000;
  const entry = attempts.get(key);
  if (!entry || entry.resetAt <= now) {
    attempts.set(key, { count: 1, resetAt: now + windowMs });
  } else if (entry.count >= maxAttempts) {
    res.set('Retry-After', String(Math.ceil((entry.resetAt - now) / 1000)));
    return res.status(429).json({ message: 'Too Many Attempts.' });
  } else {
    entry.count += 1;
  }
  if (attempts.size > 10_000) {
    for (const [k, v] of attempts) if (v.resetAt <= now) attempts.delete(k);
  }
  next();
};
