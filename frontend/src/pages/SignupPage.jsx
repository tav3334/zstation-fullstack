import { useState } from "react";
import { Sun, Moon } from "lucide-react";
import api from "../services/api";
import logo from "../assets/logo.svg";
import useTheme from "../hooks/useTheme";

function SignupPage({ onSignup, onBack, onGoToLogin, planName }) {
  const [salonName, setSalonName] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { theme, toggleTheme, isDark } = useTheme();

  const handleSubmit = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setError("");
    setLoading(true);
    try {
      const res = await api.post("/signup", { salon_name: salonName, name, email, password });
      localStorage.setItem("token", res.data.token);
      localStorage.setItem("user", JSON.stringify(res.data.user));
      api.defaults.headers.common["Authorization"] = `Bearer ${res.data.token}`;
      onSignup(res.data.user);
    } catch (err) {
      const errorMessage =
        err.response?.data?.message ||
        err.response?.data?.errors?.email?.[0] ||
        "Une erreur est survenue. Veuillez réessayer.";
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="lp-root" data-theme={theme}>
      <div className="lp-bg-grid" />
      <div className="lp-bg-glow lp-bg-glow-1" />
      <div className="lp-bg-glow lp-bg-glow-2" />
      <div className="lp-bg-glow lp-bg-glow-3" />
      <div className="lp-bg-vignette" />

      <button type="button" className="lp-theme-toggle" onClick={toggleTheme} aria-label="Changer de thème" title={isDark ? "Passer en mode clair" : "Passer en mode sombre"}>
        {isDark ? <Sun size={17} /> : <Moon size={17} />}
      </button>

      <div className="lp-ambient-tags">
        <span className="lp-ambient-tag lp-ambient-tag-gold">COUPE</span>
        <span className="lp-ambient-tag lp-ambient-tag-gold">BARBE</span>
        <span className="lp-ambient-tag lp-ambient-tag-gold">SOINS</span>
        <span className="lp-ambient-tag lp-ambient-tag-gold">COLORATION</span>
      </div>

      <div className="lp-card">
        {onBack && (
          <button type="button" className="lp-back-btn" onClick={onBack}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>
            </svg>
            Retour
          </button>
        )}
        <div className="lp-card-header">
          <div className="lp-logo-wrap">
            <img src={logo} alt="Logo" className="lp-logo-img" />
          </div>
          <p className="lp-kingdom">TONSOR</p>
          <div className="lp-sep" />
          <h1 className="lp-title">
            Créez votre compte<br />
            <span className="lp-title-accent">
              {planName ? `Plan ${planName} sélectionné` : "Essai gratuit"}
            </span>
          </h1>
          <p className="lp-connect-hint">Inscrivez votre salon en quelques minutes</p>
        </div>

        <div className="lp-section-label">INSCRIPTION</div>

        <form onSubmit={handleSubmit} className="lp-form" noValidate>
          <div className="lp-field">
            <label htmlFor="su-salon">Nom du salon</label>
            <div className="lp-input-wrap">
              <input
                id="su-salon"
                type="text"
                value={salonName}
                onChange={(e) => setSalonName(e.target.value)}
                placeholder="Ex: Salon Chic Coiffure"
                required
              />
              <span className="lp-input-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M6 9l6-6 6 6"/><path d="M6 9v11a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V9"/>
                </svg>
              </span>
            </div>
          </div>

          <div className="lp-field">
            <label htmlFor="su-name">Votre nom</label>
            <div className="lp-input-wrap">
              <input
                id="su-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Karim Benali"
                required
              />
              <span className="lp-input-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
                </svg>
              </span>
            </div>
          </div>

          <div className="lp-field">
            <label htmlFor="su-email">Email</label>
            <div className="lp-input-wrap">
              <input
                id="su-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="votre@email.com"
                autoComplete="email"
                required
              />
              <span className="lp-input-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 6-10 7L2 6"/>
                </svg>
              </span>
            </div>
          </div>

          <div className="lp-field">
            <label htmlFor="su-password">Mot de passe</label>
            <div className="lp-input-wrap">
              <span className="lp-input-icon lp-icon-left">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
              </span>
              <input
                id="su-password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="6 caractères minimum"
                autoComplete="new-password"
                required
                minLength={6}
                className="lp-has-left-icon"
              />
              <button
                type="button"
                className="lp-eye-btn"
                onClick={() => setShowPassword((v) => !v)}
                tabIndex={-1}
                aria-label={showPassword ? "Masquer" : "Afficher"}
              >
                {showPassword ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/>
                  </svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
                  </svg>
                )}
              </button>
            </div>
          </div>

          {error && (
            <div className="lp-error" role="alert">
              {error}
            </div>
          )}

          <button className="lp-btn" type="submit" disabled={loading}>
            {loading ? (
              <span className="lp-spinner" />
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
              </svg>
            )}
            {loading ? "Création du compte..." : "Créer mon compte"}
          </button>
        </form>

        {onGoToLogin && (
          <div className="lp-footer" style={{ cursor: "pointer" }} onClick={onGoToLogin}>
            Déjà un compte ? <span style={{ color: "#e0b85c", fontWeight: 600 }}>Se connecter</span>
          </div>
        )}
        <div className="lp-copyright">© {new Date().getFullYear()} Tonsor — Système de Gestion</div>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');

        .lp-root{
          --lp-bg:#0a0806;
          --lp-text:#fff;
          --lp-text-soft:rgba(255,255,255,0.55);
          --lp-text-faint:rgba(255,255,255,0.4);
          --lp-text-fainter:rgba(255,255,255,0.3);
          --lp-border:rgba(255,255,255,0.1);
          --lp-border-soft:rgba(255,255,255,0.07);
          --lp-input-bg:rgba(255,255,255,0.04);
          --lp-input-bg-focus:rgba(255,255,255,0.06);
          --lp-card-bg:rgba(18,15,11,0.72);
          --lp-logo-bg:#0c0a08;

          position:relative;
          min-height:100vh;width:100%;
          display:flex;align-items:center;justify-content:center;
          background:var(--lp-bg);
          font-family:'Inter',system-ui,-apple-system,sans-serif;
          overflow:hidden;
          padding:32px 20px;
          transition:background .3s;
        }

        .lp-root[data-theme="light"]{
          --lp-bg:#f7f5f2;
          --lp-text:#1a1410;
          --lp-text-soft:rgba(26,20,16,0.6);
          --lp-text-faint:rgba(26,20,16,0.5);
          --lp-text-fainter:rgba(26,20,16,0.4);
          --lp-border:rgba(26,20,16,0.12);
          --lp-border-soft:rgba(26,20,16,0.1);
          --lp-input-bg:#ffffff;
          --lp-input-bg-focus:#ffffff;
          --lp-card-bg:rgba(255,255,255,0.85);
          --lp-logo-bg:#ffffff;
        }

        .lp-theme-toggle{
          position:absolute;top:24px;right:24px;z-index:2;
          display:flex;align-items:center;justify-content:center;
          width:38px;height:38px;border-radius:50%;
          background:var(--lp-card-bg);
          border:1px solid var(--lp-border);
          color:var(--lp-text);
          cursor:pointer;transition:all .2s;
        }
        .lp-theme-toggle:hover{border-color:rgba(201,162,75,0.5);color:#e0b85c}

        /* ===== Immersive background ===== */
        .lp-bg-grid{
          position:absolute;inset:0;
          background-image:
            linear-gradient(rgba(201,162,75,0.05) 1px,transparent 1px),
            linear-gradient(90deg,rgba(201,162,75,0.05) 1px,transparent 1px);
          background-size:44px 44px;
          -webkit-mask-image:radial-gradient(ellipse 70% 60% at 50% 40%,#000 40%,transparent 90%);
          mask-image:radial-gradient(ellipse 70% 60% at 50% 40%,#000 40%,transparent 90%);
        }
        .lp-bg-glow{position:absolute;border-radius:50%;pointer-events:none}
        .lp-bg-glow-1{
          width:560px;height:560px;
          background:radial-gradient(circle,rgba(201,162,75,0.16),transparent 70%);
          top:-160px;left:-120px;
          animation:lpDrift1 16s ease-in-out infinite;
        }
        .lp-bg-glow-2{
          width:460px;height:460px;
          background:radial-gradient(circle,rgba(59,130,246,0.09),transparent 70%);
          bottom:-140px;right:-100px;
          animation:lpDrift2 20s ease-in-out infinite;
        }
        .lp-bg-glow-3{
          width:380px;height:380px;
          background:radial-gradient(circle,rgba(224,184,92,0.1),transparent 70%);
          top:50%;left:50%;
          transform:translate(-50%,-50%);
          animation:lpPulseSoft 8s ease-in-out infinite;
        }
        .lp-bg-vignette{
          position:absolute;inset:0;
          background:radial-gradient(ellipse 80% 80% at 50% 50%,transparent 40%,rgba(0,0,0,0.55) 100%);
          pointer-events:none;
        }
        @keyframes lpDrift1{
          0%,100%{transform:translate(0,0)}
          50%{transform:translate(40px,30px)}
        }
        @keyframes lpDrift2{
          0%,100%{transform:translate(0,0)}
          50%{transform:translate(-30px,-40px)}
        }
        @keyframes lpPulseSoft{
          0%,100%{opacity:0.5}
          50%{opacity:1}
        }

        /* ===== Ambient tags ===== */
        .lp-ambient-tags{
          position:absolute;top:28px;left:50%;transform:translateX(-50%);
          display:flex;align-items:center;gap:10px;flex-wrap:wrap;
          justify-content:center;
          z-index:1;
          padding:0 20px;
        }
        .lp-ambient-tag{
          padding:5px 14px;border-radius:20px;
          background:var(--lp-input-bg);
          border:1px solid var(--lp-border);
          color:var(--lp-text-soft);
          font-size:11px;font-weight:700;letter-spacing:1.5px;
        }
        .lp-ambient-tag-gold{
          background:rgba(201,162,75,0.08);
          border-color:rgba(201,162,75,0.3);
          color:#e0b85c;
        }
        .lp-ambient-dot{
          width:4px;height:4px;border-radius:50%;
          background:rgba(255,255,255,0.25);
        }

        /* ===== Card ===== */
        .lp-card{
          position:relative;z-index:1;
          width:100%;max-width:440px;
          background:var(--lp-card-bg);
          border:1px solid rgba(201,162,75,0.18);
          border-radius:24px;
          padding:44px 40px 32px;
          box-shadow:
            0 30px 80px rgba(0,0,0,0.55),
            0 0 0 1px rgba(255,255,255,0.02) inset,
            0 1px 0 rgba(255,255,255,0.04) inset;
          backdrop-filter:blur(20px);
          -webkit-backdrop-filter:blur(20px);
          animation:lpCardIn 0.6s cubic-bezier(0.16,1,0.3,1);
        }
        @keyframes lpCardIn{
          from{opacity:0;transform:translateY(16px) scale(0.98)}
          to{opacity:1;transform:translateY(0) scale(1)}
        }

        .lp-back-btn{
          display:inline-flex;align-items:center;gap:6px;
          background:none;border:none;cursor:pointer;
          color:var(--lp-text-faint);font-size:12.5px;font-weight:600;
          font-family:inherit;padding:0;margin-bottom:18px;
          transition:color .2s;
        }
        .lp-back-btn:hover{color:#e0b85c}

        .lp-card-header{
          display:flex;flex-direction:column;align-items:center;text-align:center;
          margin-bottom:28px;gap:10px;
        }
        .lp-logo-wrap{
          width:76px;height:76px;
          border-radius:18px;
          background:var(--lp-logo-bg);
          display:flex;align-items:center;justify-content:center;
          border:1px solid rgba(201,162,75,0.3);
          box-shadow:0 4px 24px rgba(201,162,75,0.15),0 0 0 1px rgba(255,255,255,0.03) inset;
          margin-bottom:6px;
        }
        .lp-logo-img{width:56px;height:56px;object-fit:contain}
        .lp-kingdom{
          font-size:11px;font-weight:700;letter-spacing:4px;
          color:rgba(224,184,92,0.7);text-transform:uppercase;
          margin:0;
        }
        .lp-sep{
          width:40px;height:2px;
          background:linear-gradient(90deg,transparent,rgba(201,162,75,0.7),transparent);
          border-radius:2px;
        }
        .lp-title{
          color:var(--lp-text);
          font-size:19px;font-weight:800;line-height:1.4;
          margin:2px 0 0;
        }
        .lp-title-accent{
          color:#e0b85c;
          font-size:15px;font-weight:600;
          display:block;margin-top:2px;
        }
        .lp-connect-hint{
          color:var(--lp-text-faint);
          font-size:13px;margin:6px 0 0;
        }

        .lp-section-label{
          font-size:10.5px;font-weight:700;letter-spacing:2.5px;
          color:var(--lp-text-fainter);
          text-align:center;
          margin-bottom:20px;
          position:relative;
        }
        .lp-section-label::before,.lp-section-label::after{
          content:'';position:absolute;top:50%;width:60px;height:1px;
          background:var(--lp-border-soft);
        }
        .lp-section-label::before{right:calc(50% + 70px)}
        .lp-section-label::after{left:calc(50% + 70px)}

        .lp-form{display:flex;flex-direction:column;gap:18px}
        .lp-field{display:flex;flex-direction:column;gap:7px}
        .lp-field label{
          font-size:12.5px;font-weight:600;color:var(--lp-text-soft);
        }
        .lp-input-wrap{position:relative;display:flex;align-items:center}
        .lp-input-wrap input{
          width:100%;
          background:var(--lp-input-bg);
          border:1px solid var(--lp-border);
          border-radius:12px;
          padding:13px 42px 13px 16px;
          color:var(--lp-text);font-size:14px;
          font-family:inherit;
          transition:border-color .2s,background .2s;
        }
        .lp-input-wrap input.lp-has-left-icon{padding:13px 42px 13px 42px}
        .lp-input-wrap input::placeholder{color:var(--lp-text-fainter)}
        .lp-input-wrap input:focus{
          outline:none;
          border-color:rgba(201,162,75,0.5);
          background:var(--lp-input-bg-focus);
          box-shadow:0 0 0 3px rgba(201,162,75,0.1);
        }
        .lp-input-icon{
          position:absolute;right:14px;
          color:var(--lp-text-fainter);
          display:flex;align-items:center;pointer-events:none;
        }
        .lp-icon-left{left:14px;right:auto}
        .lp-eye-btn{
          position:absolute;right:12px;
          background:none;border:none;cursor:pointer;
          color:var(--lp-text-faint);
          display:flex;align-items:center;padding:4px;
          transition:color .2s;
        }
        .lp-eye-btn:hover{color:var(--lp-text)}

        .lp-error{
          background:rgba(239,68,68,0.1);
          border:1px solid rgba(239,68,68,0.3);
          color:#fca5a5;
          font-size:13px;font-weight:500;
          padding:10px 14px;border-radius:10px;
          animation:lpShake 0.4s;
        }
        @keyframes lpShake{
          0%,100%{transform:translateX(0)}
          20%,60%{transform:translateX(-5px)}
          40%,80%{transform:translateX(5px)}
        }

        .lp-btn{
          display:flex;align-items:center;justify-content:center;gap:9px;
          width:100%;padding:15px;margin-top:4px;
          background:linear-gradient(135deg,#e0b85c 0%,#c9a24b 100%);
          color:#1a1408;
          border:none;border-radius:12px;
          font-size:15px;font-weight:700;
          font-family:inherit;
          cursor:pointer;
          box-shadow:0 8px 24px rgba(201,162,75,0.3);
          transition:transform .15s,box-shadow .15s;
        }
        .lp-btn:hover:not(:disabled){
          transform:translateY(-1px);
          box-shadow:0 10px 28px rgba(201,162,75,0.4);
        }
        .lp-btn:active:not(:disabled){transform:translateY(0)}
        .lp-btn:disabled{opacity:0.7;cursor:not-allowed}
        .lp-spinner{
          width:16px;height:16px;
          border:2.5px solid rgba(26,20,8,0.3);
          border-top-color:#1a1408;
          border-radius:50%;
          animation:lpSpin 0.7s linear infinite;
        }
        @keyframes lpSpin{to{transform:rotate(360deg)}}

        .lp-footer{
          display:flex;align-items:center;justify-content:center;gap:7px;
          margin-top:24px;padding-top:18px;
          border-top:1px solid var(--lp-border-soft);
          color:var(--lp-text-faint);
          font-size:12px;
        }
        .lp-footer-icon{display:flex;align-items:center}
        .lp-copyright{
          text-align:center;color:var(--lp-text-fainter);font-size:11.5px;margin-top:6px;
        }

        /* ===== Responsive ===== */
        @media(max-width:520px){
          .lp-card{padding:36px 24px 28px;border-radius:20px}
          .lp-ambient-tags{display:none}
        }
      `}</style>
    </div>
  );
}

export default SignupPage;
