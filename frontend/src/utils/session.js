import api from "../services/api";

const REOPEN_POS_KEY = "reopen_pos";

/** Remplace la session courante (token + utilisateur) puis recharge l'application. */
export function switchSession({ token, user }, { reopenPos = false } = {}) {
  localStorage.setItem("token", token);
  localStorage.setItem("user", JSON.stringify(user));
  api.defaults.headers.common["Authorization"] = `Bearer ${token}`;
  try {
    if (reopenPos) sessionStorage.setItem(REOPEN_POS_KEY, "1");
  } catch {
    void 0;
  }
  window.location.reload();
}

/** Vrai après un changement de caissier lancé depuis la caisse (à effacer ensuite avec clearReopenPos). */
export function shouldReopenPos() {
  try {
    return sessionStorage.getItem(REOPEN_POS_KEY) === "1";
  } catch {
    return false;
  }
}

export function clearReopenPos() {
  try {
    sessionStorage.removeItem(REOPEN_POS_KEY);
  } catch {
    void 0;
  }
}
