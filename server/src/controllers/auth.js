import { prisma } from '../lib/prisma.js';
import { input } from '../lib/http.js';
import { validate } from '../lib/validate.js';
import { checkLimit } from '../lib/limits.js';
import { slug } from '../lib/misc.js';
import {
  checkPassword,
  createToken,
  hashPassword,
  isSuperAdmin,
  passwordHashOf,
  pinHashOf,
  revokeTokens,
} from '../lib/auth.js';
import { permissionsOf } from '../lib/permissions.js';
import { ACTIVITY, logActivity } from '../lib/activity.js';

/** Modules activés pour l'organisation (super_admin ou sans organisation = tout activé). */
async function modulesFor(user) {
  if (isSuperAdmin(user) || !user.organization_id) return { gaming: true, coiffure: true, stock: true };
  const org = await prisma.organization.findUnique({ where: { id: user.organization_id } });
  return {
    gaming: org?.module_gaming ?? true,
    coiffure: org?.module_coiffure ?? true,
    stock: org?.module_stock ?? true,
  };
}

async function userPayload(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    organization_id: user.organization_id,
    modules: await modulesFor(user),
    permissions: permissionsOf(user),
    has_pin: !!(await pinHashOf(user.id)),
  };
}

const findUserByEmail = (email) =>
  prisma.user.findFirst({ where: { email: { equals: String(email), mode: 'insensitive' } } });

const PIN_RULE = 'required|string|min:4|max:6';
const isValidPin = (pin) => /^\d{4,6}$/.test(String(pin));

export async function login(req, res) {
  const data = input(req);
  await validate(data, { email: 'required|email', password: 'required' });

  const user = await findUserByEmail(data.email);
  if (!user || !(await checkPassword(data.password, await passwordHashOf(user.id)))) {
    return res.status(401).json({ message: 'Email ou mot de passe incorrect' });
  }
  if (!user.is_active) {
    return res.status(403).json({ message: 'Ce compte est désactivé. Contactez votre administrateur.' });
  }

  const token = await createToken(user.id);
  await prisma.user.update({ where: { id: user.id }, data: { last_login_at: new Date() } });
  await logActivity(user, ACTIVITY.LOGIN, `${user.name} s'est connecté(e)`);
  res.json({ message: 'Connexion réussie', user: await userPayload(user), token });
}

export async function logout(req, res) {
  await prisma.personalAccessToken.delete({ where: { id: req.accessTokenId } }).catch(() => {});
  await logActivity(req.user, ACTIVITY.LOGOUT, `${req.user.name} s'est déconnecté(e)`);
  res.json({ message: 'Déconnexion réussie' });
}

export async function me(req, res) {
  res.json({ user: await userPayload(req.user) });
}

export function currentUser(req, res) {
  res.json(req.user);
}

export async function updateProfile(req, res) {
  const user = req.user;
  const data = input(req);
  await validate(data, {
    name: 'required|string|max:255',
    email: `required|email|unique:users,email,${user.id}`,
    password: 'required',
  });

  if (!(await checkPassword(data.password, await passwordHashOf(user.id)))) {
    return res.status(422).json({ message: 'Mot de passe incorrect' });
  }

  const updated = await prisma.user.update({ where: { id: user.id }, data: { name: data.name, email: data.email } });
  await logActivity(user, ACTIVITY.PROFILE_UPDATE, `${updated.name} a modifié son profil`);
  res.json({ message: 'Profil mis à jour avec succès', user: await userPayload(updated) });
}

export async function changePassword(req, res) {
  const data = input(req);
  await validate(data, {
    current_password: 'required',
    new_password: 'required|min:6',
    new_password_confirmation: 'required|same:new_password',
  });

  if (!(await checkPassword(data.current_password, await passwordHashOf(req.user.id)))) {
    return res.status(422).json({ message: 'Le mot de passe actuel est incorrect' });
  }

  await prisma.user.update({ where: { id: req.user.id }, data: { password: await hashPassword(data.new_password) } });
  // Les autres appareils connectés avec l'ancien mot de passe sont déconnectés
  const { count } = await revokeTokens(req.user.id, req.accessTokenId);
  await logActivity(req.user, ACTIVITY.PASSWORD_CHANGE, `${req.user.name} a changé son mot de passe`);
  res.json({
    message: count > 0
      ? `Mot de passe modifié avec succès. ${count} autre(s) session(s) déconnectée(s).`
      : 'Mot de passe modifié avec succès',
  });
}

/** Définit (ou supprime avec pin = null) le code PIN caissier de l'utilisateur connecté. */
export async function setPin(req, res) {
  const data = input(req);
  await validate(data, { password: 'required', pin: 'nullable|string|min:4|max:6' });

  if (!(await checkPassword(data.password, await passwordHashOf(req.user.id)))) {
    return res.status(422).json({ message: 'Mot de passe incorrect' });
  }
  if (data.pin != null && !isValidPin(data.pin)) {
    return res.status(422).json({ message: 'Le code PIN doit contenir 4 à 6 chiffres.' });
  }

  const pinHash = data.pin != null ? await hashPassword(data.pin) : null;
  await prisma.user.update({ where: { id: req.user.id }, data: { pin_hash: pinHash } });
  await logActivity(req.user, ACTIVITY.PIN_CHANGE, `${req.user.name} a ${pinHash ? 'défini' : 'supprimé'} son code PIN`);
  res.json({ message: pinHash ? 'Code PIN enregistré' : 'Code PIN supprimé', user: await userPayload(req.user) });
}

/** Membres actifs de l'organisation ayant un code PIN (pour le changement rapide de caissier). */
export async function cashiers(req, res) {
  const users = await prisma.user.findMany({
    where: { organization_id: req.user.organization_id, is_active: true, role: { in: ['admin', 'agent'] }, pin_hash: { not: null } },
    select: { id: true, name: true, role: true },
    orderBy: { name: 'asc' },
  });
  res.json({ cashiers: users });
}

/**
 * Changement de caissier sur un poste partagé : vérifie le PIN du membre choisi
 * (même organisation), déconnecte la session courante et ouvre la sienne.
 */
export async function pinLogin(req, res) {
  const data = input(req);
  await validate(data, { user_id: 'required|integer', pin: PIN_RULE });

  const target = await prisma.user.findFirst({
    where: { id: Number(data.user_id), organization_id: req.user.organization_id, role: { in: ['admin', 'agent'] } },
  });
  const pinHash = target ? await pinHashOf(target.id) : null;
  if (!target || !target.is_active || !pinHash || !(await checkPassword(data.pin, pinHash))) {
    return res.status(422).json({ message: 'Code PIN incorrect' });
  }

  const token = await createToken(target.id);
  await prisma.personalAccessToken.delete({ where: { id: req.accessTokenId } }).catch(() => {});
  await prisma.user.update({ where: { id: target.id }, data: { last_login_at: new Date() } });
  await logActivity(target, ACTIVITY.PIN_SWITCH, `Changement de caissier : ${req.user.name} → ${target.name}`);
  res.json({ message: `Bonjour ${target.name}`, user: await userPayload(target), token });
}

/** Génère un code d'organisation unique à partir d'un nom ("Mon Salon" → "MON_SALON", "MON_SALON_1", ...). */
export async function uniqueOrganizationCode(name) {
  const base = slug(name, '_').toUpperCase();
  let code = base;
  let counter = 1;
  while (await prisma.organization.findUnique({ where: { code } })) {
    code = `${base}_${counter}`;
    counter++;
  }
  return code;
}

/** Inscription libre-service : crée l'organisation + le compte admin. */
export async function signup(req, res) {
  const data = input(req);
  await validate(data, {
    salon_name: 'required|string|max:255',
    name: 'required|string|max:255',
    email: 'required|email|unique:users',
    password: 'required|min:6',
  });

  const code = await uniqueOrganizationCode(data.salon_name);
  const password = await hashPassword(data.password);

  const user = await prisma.$transaction(async (tx) => {
    const organization = await tx.organization.create({
      data: { name: data.salon_name, code, is_active: true },
    });
    return tx.user.create({
      data: { name: data.name, email: data.email, password, role: 'admin', organization_id: organization.id },
    });
  });

  const token = await createToken(user.id);
  res.status(201).json({ message: 'Compte créé avec succès', user: await userPayload(user), token });
}

/** Création d'un utilisateur par un admin (dans sa propre organisation). */
export async function register(req, res) {
  const data = input(req);
  await validate(data, {
    name: 'required|string|max:255',
    email: 'required|email|unique:users',
    password: 'required|min:6',
    role: 'required|in:admin,agent',
  });

  const creator = req.user;
  if (creator && !isSuperAdmin(creator) && creator.organization_id) {
    const limit = await checkLimit(creator.organization_id, 'max_users');
    if (!limit.allowed) return res.status(403).json({ message: limit.message });
  }

  const user = await prisma.user.create({
    data: {
      name: data.name,
      email: data.email,
      password: await hashPassword(data.password),
      role: data.role,
      organization_id: creator && !isSuperAdmin(creator) ? creator.organization_id : null,
    },
  });

  res.status(201).json({ message: 'Utilisateur créé avec succès', user });
}
