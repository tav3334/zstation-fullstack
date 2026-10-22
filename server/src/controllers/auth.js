import { prisma } from '../lib/prisma.js';
import { input } from '../lib/http.js';
import { validate } from '../lib/validate.js';
import { checkLimit } from '../lib/limits.js';
import { slug } from '../lib/misc.js';
import { checkPassword, createToken, hashPassword, isSuperAdmin, passwordHashOf } from '../lib/auth.js';

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
  };
}

const findUserByEmail = (email) =>
  prisma.user.findFirst({ where: { email: { equals: String(email), mode: 'insensitive' } } });

export async function login(req, res) {
  const data = input(req);
  await validate(data, { email: 'required|email', password: 'required' });

  const user = await findUserByEmail(data.email);
  if (!user || !(await checkPassword(data.password, await passwordHashOf(user.id)))) {
    return res.status(401).json({ message: 'Email ou mot de passe incorrect' });
  }

  const token = await createToken(user.id);
  res.json({ message: 'Connexion réussie', user: await userPayload(user), token });
}

export async function logout(req, res) {
  await prisma.personalAccessToken.delete({ where: { id: req.accessTokenId } }).catch(() => {});
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
    return res.status(401).json({ message: 'Mot de passe incorrect' });
  }

  const updated = await prisma.user.update({ where: { id: user.id }, data: { name: data.name, email: data.email } });
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
    return res.status(401).json({ message: 'Le mot de passe actuel est incorrect' });
  }

  await prisma.user.update({ where: { id: req.user.id }, data: { password: await hashPassword(data.new_password) } });
  res.json({ message: 'Mot de passe modifié avec succès' });
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
