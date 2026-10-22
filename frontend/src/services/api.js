import axios from "axios";

const api = axios.create({
  // Front et API sont servis sur le même domaine (Vercel en prod, proxy Vite en dev)
  baseURL: import.meta.env.VITE_API_URL || "/api",
  withCredentials: false
});



// Intercepteur pour ajouter le token automatiquement
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Intercepteur pour gérer les erreurs 401 (non authentifié)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Ne rediriger que si on a un token (session expirée)
      // Ne pas rediriger lors d'une tentative de login échouée
      const token = localStorage.getItem("token");
      if (token) {
        // Token expiré ou invalide - déconnexion
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        window.location.href = "/";
      }
      // Si pas de token, c'est juste un login échoué - laisser passer l'erreur
    }
    return Promise.reject(error);
  }
);

export default api;