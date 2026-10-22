import { useEffect, useState } from "react";
import {
  Scissors, Calendar, Package, Users, Receipt, BarChart3,
  Check, ArrowRight, Star, Menu, X, ShieldCheck, Printer, Clock, Sun, Moon
} from "lucide-react";
import logo from "../assets/logo.svg";
import api from "../services/api";
import useTheme from "../hooks/useTheme";

const FEATURES = [
  {
    icon: Calendar,
    title: "Prestations & tarifs",
    desc: "Cataloguez vos coupes, soins et forfaits avec prix et durée. Modifiez vos tarifs en un instant.",
  },
  {
    icon: Users,
    title: "Coiffeurs & équipe",
    desc: "Suivez la performance de chaque coiffeur : tickets réalisés, chiffre d'affaires généré.",
  },
  {
    icon: Package,
    title: "Stock & produits",
    desc: "Gérez vos produits vendus en boutique et ceux consommés par vos prestations, avec alertes de stock bas.",
  },
  {
    icon: Receipt,
    title: "Tickets & encaissement",
    desc: "Encaissez en espèces, carte ou mobile. Imprimez un ticket professionnel pour chaque client.",
  },
  {
    icon: BarChart3,
    title: "Statistiques en temps réel",
    desc: "Chiffre d'affaires du jour, top prestations, top produits — toutes vos données au même endroit.",
  },
  {
    icon: ShieldCheck,
    title: "Traçabilité complète",
    desc: "Historique des ventes, annulations avec restitution de stock, mouvements de stock tracés.",
  },
];

const STEPS = [
  { n: "01", title: "Créez votre compte", desc: "Inscrivez votre salon en quelques minutes, sans engagement." },
  { n: "02", title: "Configurez vos prestations", desc: "Ajoutez vos coiffeurs, vos services et vos produits." },
  { n: "03", title: "Encaissez et suivez", desc: "Vendez, imprimez vos tickets et suivez votre activité au quotidien." },
];

function LandingPage({ onLoginClick, onSelectPlan }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [plans, setPlans] = useState([]);
  const { theme, toggleTheme, isDark } = useTheme();

  useEffect(() => {
    api.get("/public/plans")
      .then((res) => setPlans(res.data.plans || []))
      .catch(() => {});
  }, []);

  return (
    <div className="lnd-root" data-theme={theme}>
      {/* Immersive background (matches Login) */}
      <div className="lnd-bg-grid" />
      <div className="lnd-bg-glow lnd-bg-glow-1" />
      <div className="lnd-bg-glow lnd-bg-glow-2" />

      {/* Header */}
      <header className="lnd-header">
        <div className="lnd-header-inner">
          <div className="lnd-brand">
            <img src={logo} alt="Tonsor" className="lnd-brand-logo" />
            <span className="lnd-brand-name">TONSOR</span>
          </div>

          <nav className="lnd-nav lnd-nav-desktop">
            <a href="#fonctionnalites">Fonctionnalités</a>
            <a href="#comment-ca-marche">Comment ça marche</a>
            <a href="#tarifs">Tarifs</a>
          </nav>

          <div className="lnd-header-actions">
            <button className="lnd-theme-toggle" onClick={toggleTheme} aria-label="Changer de thème" title={isDark ? "Passer en mode clair" : "Passer en mode sombre"}>
              {isDark ? <Sun size={17} /> : <Moon size={17} />}
            </button>
            <button className="lnd-btn-ghost lnd-nav-desktop" onClick={onLoginClick}>Se connecter</button>
            <button className="lnd-btn-gold" onClick={() => onSelectPlan(null)}>
              Essayer gratuitement <ArrowRight size={15} />
            </button>
            <button className="lnd-burger" onClick={() => setMenuOpen((v) => !v)} aria-label="Menu">
              {menuOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>

        {menuOpen && (
          <div className="lnd-mobile-menu">
            <a href="#fonctionnalites" onClick={() => setMenuOpen(false)}>Fonctionnalités</a>
            <a href="#comment-ca-marche" onClick={() => setMenuOpen(false)}>Comment ça marche</a>
            <a href="#tarifs" onClick={() => setMenuOpen(false)}>Tarifs</a>
            <button className="lnd-btn-ghost" onClick={onLoginClick}>Se connecter</button>
          </div>
        )}
      </header>

      {/* Hero */}
      <section className="lnd-hero">
        <div className="lnd-hero-badge">
          <Star size={13} /> Fait pour les salons de coiffure au Maroc
        </div>
        <h1 className="lnd-hero-title">
          La gestion de votre salon,<br />
          <span className="lnd-hero-accent">simplifiée.</span>
        </h1>
        <p className="lnd-hero-sub">
          Prestations, coiffeurs, stock, ventes et tickets — tout ce qu'il faut pour piloter
          votre salon de coiffure au quotidien, dans une seule application.
        </p>
        <div className="lnd-hero-actions">
          <button className="lnd-btn-gold lnd-btn-lg" onClick={() => onSelectPlan(null)}>
            Essayer gratuitement <ArrowRight size={17} />
          </button>
          <button className="lnd-btn-outline lnd-btn-lg" onClick={onLoginClick}>
            Se connecter
          </button>
        </div>
        <div className="lnd-hero-trust">
          <span><Check size={14} /> Sans engagement</span>
          <span><Check size={14} /> Prix en DH</span>
          <span><Check size={14} /> Support en français</span>
        </div>

        {/* Hero visual mock */}
        <div className="lnd-hero-visual">
          <div className="lnd-mock-card">
            <div className="lnd-mock-row lnd-mock-header">
              <Scissors size={16} />
              <span>Ticket TCK-000042</span>
            </div>
            <div className="lnd-mock-line"><span>Coupe + Barbe</span><b>40 DH</b></div>
            <div className="lnd-mock-line"><span>Shampoing</span><b>60 DH</b></div>
            <div className="lnd-mock-total"><span>Total</span><b>100 DH</b></div>
            <div className="lnd-mock-footer"><Printer size={13} /> Ticket imprimé avec succès</div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="lnd-section" id="fonctionnalites">
        <div className="lnd-section-head">
          <span className="lnd-eyebrow">Fonctionnalités</span>
          <h2>Tout ce dont votre salon a besoin</h2>
          <p>Une seule application pour gérer l'ensemble de votre activité, du premier client à la clôture de caisse.</p>
        </div>
        <div className="lnd-features-grid">
          {FEATURES.map((f) => (
            <div className="lnd-feature-card" key={f.title}>
              <div className="lnd-feature-icon"><f.icon size={22} /></div>
              <h3>{f.title}</h3>
              <p>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="lnd-section lnd-section-alt" id="comment-ca-marche">
        <div className="lnd-section-head">
          <span className="lnd-eyebrow">Comment ça marche</span>
          <h2>Opérationnel en quelques minutes</h2>
        </div>
        <div className="lnd-steps">
          {STEPS.map((s) => (
            <div className="lnd-step" key={s.n}>
              <div className="lnd-step-num">{s.n}</div>
              <h3>{s.title}</h3>
              <p>{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section className="lnd-section" id="tarifs">
        <div className="lnd-section-head">
          <span className="lnd-eyebrow">Tarifs</span>
          <h2>Un plan pour chaque salon</h2>
          <p>Changez de plan à tout moment. Paiement sécurisé, sans engagement.</p>
        </div>
        {plans.length > 0 && (
          <div className="lnd-pricing-grid">
            {plans.map((plan) => {
              const isPro = plan.name === "Pro";
              return (
                <div className={`lnd-price-card ${isPro ? "lnd-price-card-pop" : ""}`} key={plan.id}>
                  {isPro && <div className="lnd-price-badge">Populaire</div>}
                  <div className="lnd-price-name">{plan.name}</div>
                  <div className="lnd-price-desc">{plan.description}</div>
                  <div className="lnd-price-amount">
                    {Number(plan.price).toLocaleString("fr-MA")}<span> DH/mois</span>
                  </div>
                  {(plan.features || []).slice(0, 4).map((feat, i) => (
                    <div className="lnd-price-feat" key={i}><Check size={14} /> {feat}</div>
                  ))}
                  <button className={isPro ? "lnd-btn-gold" : "lnd-btn-outline"} onClick={() => onSelectPlan(plan.name)} style={{ width: "100%", justifyContent: "center", marginTop: 16 }}>
                    Choisir ce plan
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* CTA */}
      <section className="lnd-cta">
        <Clock size={28} className="lnd-cta-icon" />
        <h2>Prêt à gagner du temps au quotidien ?</h2>
        <p>Rejoignez les salons qui gèrent déjà leur activité avec Tonsor.</p>
        <button className="lnd-btn-gold lnd-btn-lg" onClick={() => onSelectPlan(null)}>
          Essayer gratuitement <ArrowRight size={17} />
        </button>
      </section>

      {/* Footer */}
      <footer className="lnd-footer">
        <div className="lnd-brand">
          <img src={logo} alt="Tonsor" className="lnd-brand-logo" style={{ width: 22, height: 22 }} />
          <span className="lnd-brand-name">TONSOR</span>
        </div>
        <p>© {new Date().getFullYear()} Tonsor — Système de gestion pour salons de coiffure.</p>
      </footer>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');

        .lnd-root{
          --lnd-bg:#0a0806;
          --lnd-text:#fff;
          --lnd-text-soft:rgba(255,255,255,0.6);
          --lnd-text-softer:rgba(255,255,255,0.55);
          --lnd-text-faint:rgba(255,255,255,0.45);
          --lnd-border:rgba(255,255,255,0.07);
          --lnd-border-soft:rgba(255,255,255,0.08);
          --lnd-border-strong:rgba(255,255,255,0.1);
          --lnd-header-bg:rgba(10,8,6,0.75);
          --lnd-card-bg:rgba(255,255,255,0.03);
          --lnd-card-bg-strong:rgba(255,255,255,0.05);
          --lnd-mock-bg:rgba(18,15,11,0.75);
          --lnd-section-alt-bg:rgba(255,255,255,0.015);

          position:relative;
          min-height:100vh;width:100%;
          background:var(--lnd-bg);
          color:var(--lnd-text);
          font-family:'Inter',system-ui,-apple-system,sans-serif;
          overflow-x:hidden;
          transition:background .3s,color .3s;
        }

        .lnd-root[data-theme="light"]{
          --lnd-bg:#f7f5f2;
          --lnd-text:#1a1410;
          --lnd-text-soft:rgba(26,20,16,0.65);
          --lnd-text-softer:rgba(26,20,16,0.6);
          --lnd-text-faint:rgba(26,20,16,0.5);
          --lnd-border:rgba(26,20,16,0.1);
          --lnd-border-soft:rgba(26,20,16,0.1);
          --lnd-border-strong:rgba(26,20,16,0.12);
          --lnd-header-bg:rgba(247,245,242,0.85);
          --lnd-card-bg:#ffffff;
          --lnd-card-bg-strong:#ffffff;
          --lnd-mock-bg:#ffffff;
          --lnd-section-alt-bg:rgba(0,0,0,0.02);
        }

        .lnd-theme-toggle{
          display:flex;align-items:center;justify-content:center;
          width:36px;height:36px;border-radius:50%;
          background:var(--lnd-card-bg);
          border:1px solid var(--lnd-border-strong);
          color:var(--lnd-text);
          cursor:pointer;transition:all .2s;
        }
        .lnd-theme-toggle:hover{border-color:rgba(201,162,75,0.5);color:#e0b85c}

        .lnd-bg-grid{
          position:absolute;top:0;left:0;right:0;height:900px;
          background-image:
            linear-gradient(rgba(201,162,75,0.05) 1px,transparent 1px),
            linear-gradient(90deg,rgba(201,162,75,0.05) 1px,transparent 1px);
          background-size:44px 44px;
          -webkit-mask-image:radial-gradient(ellipse 70% 60% at 50% 0%,#000 40%,transparent 90%);
          mask-image:radial-gradient(ellipse 70% 60% at 50% 0%,#000 40%,transparent 90%);
          pointer-events:none;
        }
        .lnd-bg-glow{position:absolute;border-radius:50%;pointer-events:none}
        .lnd-bg-glow-1{
          width:560px;height:560px;
          background:radial-gradient(circle,rgba(201,162,75,0.16),transparent 70%);
          top:-160px;left:-120px;
        }
        .lnd-bg-glow-2{
          width:460px;height:460px;
          background:radial-gradient(circle,rgba(59,130,246,0.09),transparent 70%);
          top:200px;right:-140px;
        }

        /* Header */
        .lnd-header{
          position:sticky;top:0;z-index:20;
          background:var(--lnd-header-bg);
          backdrop-filter:blur(14px);
          -webkit-backdrop-filter:blur(14px);
          border-bottom:1px solid var(--lnd-border);
        }
        .lnd-header-inner{
          max-width:1180px;margin:0 auto;
          display:flex;align-items:center;justify-content:space-between;
          padding:14px 24px;
        }
        .lnd-brand{display:flex;align-items:center;gap:10px}
        .lnd-brand-logo{width:30px;height:30px;object-fit:contain}
        .lnd-brand-name{font-weight:800;letter-spacing:2px;font-size:15px}
        .lnd-nav{display:flex;align-items:center;gap:28px}
        .lnd-nav a{
          color:var(--lnd-text-soft);text-decoration:none;font-size:14px;font-weight:500;
          transition:color .2s;
        }
        .lnd-nav a:hover{color:#e0b85c}
        .lnd-header-actions{display:flex;align-items:center;gap:12px}
        .lnd-burger{display:none;background:none;border:none;color:var(--lnd-text);cursor:pointer}
        .lnd-mobile-menu{
          display:flex;flex-direction:column;gap:4px;
          padding:8px 24px 18px;
          border-top:1px solid var(--lnd-border);
        }
        .lnd-mobile-menu a{
          color:var(--lnd-text-soft);text-decoration:none;padding:10px 0;font-size:15px;
          border-bottom:1px solid var(--lnd-border);
        }
        .lnd-mobile-menu button{margin-top:10px}

        /* Buttons */
        .lnd-btn-gold, .lnd-btn-outline, .lnd-btn-ghost{
          display:inline-flex;align-items:center;gap:8px;
          font-family:inherit;font-weight:700;font-size:13.5px;
          padding:10px 18px;border-radius:11px;cursor:pointer;
          transition:transform .15s,box-shadow .15s,background .2s,border-color .2s;
          white-space:nowrap;
        }
        .lnd-btn-gold{
          background:linear-gradient(135deg,#e0b85c 0%,#c9a24b 100%);
          color:#1a1408;border:none;
          box-shadow:0 8px 24px rgba(201,162,75,0.25);
        }
        .lnd-btn-gold:hover{transform:translateY(-1px);box-shadow:0 10px 28px rgba(201,162,75,0.35)}
        .lnd-btn-outline{
          background:transparent;color:var(--lnd-text);
          border:1px solid var(--lnd-border-strong);
        }
        .lnd-btn-outline:hover{border-color:rgba(224,184,92,0.5);color:#e0b85c}
        .lnd-btn-ghost{
          background:none;border:none;color:var(--lnd-text-soft);
        }
        .lnd-btn-ghost:hover{color:var(--lnd-text)}
        .lnd-btn-lg{padding:14px 26px;font-size:15px;border-radius:13px}

        /* Hero */
        .lnd-hero{
          position:relative;z-index:1;
          max-width:800px;margin:0 auto;
          padding:90px 24px 50px;
          text-align:center;
          display:flex;flex-direction:column;align-items:center;
        }
        .lnd-hero-badge{
          display:inline-flex;align-items:center;gap:6px;
          background:rgba(201,162,75,0.1);border:1px solid rgba(201,162,75,0.3);
          color:#e0b85c;font-size:12.5px;font-weight:600;
          padding:6px 16px;border-radius:20px;margin-bottom:22px;
        }
        .lnd-hero-title{
          font-size:46px;font-weight:900;line-height:1.15;letter-spacing:-1px;
          margin:0 0 18px;color:var(--lnd-text);
        }
        .lnd-hero-accent{color:#e0b85c}
        .lnd-hero-sub{
          color:var(--lnd-text-soft);font-size:17px;line-height:1.7;
          max-width:600px;margin:0 0 32px;
        }
        .lnd-hero-actions{display:flex;gap:14px;flex-wrap:wrap;justify-content:center;margin-bottom:24px}
        .lnd-hero-trust{
          display:flex;gap:22px;flex-wrap:wrap;justify-content:center;
          color:var(--lnd-text-faint);font-size:13px;
        }
        .lnd-hero-trust span{display:flex;align-items:center;gap:6px;color:#34d399}

        .lnd-hero-visual{margin-top:56px;width:100%;display:flex;justify-content:center}
        .lnd-mock-card{
          width:100%;max-width:340px;
          background:var(--lnd-mock-bg);
          border:1px solid rgba(201,162,75,0.2);
          border-radius:18px;padding:22px;
          box-shadow:0 30px 70px rgba(0,0,0,0.5);
          backdrop-filter:blur(16px);
          text-align:left;
        }
        .lnd-mock-header{
          display:flex;align-items:center;gap:8px;color:#e0b85c;
          font-weight:700;font-size:14px;margin-bottom:14px;
          padding-bottom:14px;border-bottom:1px dashed var(--lnd-border-strong);
        }
        .lnd-mock-line{
          display:flex;justify-content:space-between;
          font-size:13.5px;color:var(--lnd-text-soft);margin-bottom:8px;
        }
        .lnd-mock-line b{color:var(--lnd-text);font-weight:600}
        .lnd-mock-total{
          display:flex;justify-content:space-between;
          font-size:15px;font-weight:800;color:var(--lnd-text);
          margin-top:12px;padding-top:12px;border-top:1px solid var(--lnd-border-strong);
        }
        .lnd-mock-total b{color:#e0b85c}
        .lnd-mock-footer{
          display:flex;align-items:center;gap:6px;
          margin-top:14px;color:rgba(52,211,153,0.9);font-size:12px;font-weight:600;
        }

        /* Sections */
        .lnd-section{
          position:relative;z-index:1;
          max-width:1100px;margin:0 auto;
          padding:80px 24px;
        }
        .lnd-section-alt{background:var(--lnd-section-alt-bg)}
        .lnd-section-head{text-align:center;max-width:600px;margin:0 auto 48px}
        .lnd-eyebrow{
          display:inline-block;color:#e0b85c;font-size:12.5px;font-weight:700;
          letter-spacing:2px;text-transform:uppercase;margin-bottom:12px;
        }
        .lnd-section-head h2{font-size:32px;font-weight:800;margin:0 0 12px;letter-spacing:-0.5px;color:var(--lnd-text)}
        .lnd-section-head p{color:var(--lnd-text-softer);font-size:15.5px;line-height:1.6;margin:0}

        /* Feature cards */
        .lnd-features-grid{
          display:grid;grid-template-columns:repeat(3,1fr);gap:20px;
        }
        .lnd-feature-card{
          background:var(--lnd-card-bg);
          border:1px solid var(--lnd-border-soft);
          border-radius:16px;padding:26px;
          transition:transform .2s,border-color .2s;
        }
        .lnd-feature-card:hover{transform:translateY(-3px);border-color:rgba(201,162,75,0.3)}
        .lnd-feature-icon{
          width:44px;height:44px;border-radius:12px;
          background:rgba(201,162,75,0.1);border:1px solid rgba(201,162,75,0.25);
          display:flex;align-items:center;justify-content:center;
          color:#e0b85c;margin-bottom:16px;
        }
        .lnd-feature-card h3{font-size:16.5px;font-weight:700;margin:0 0 8px;color:var(--lnd-text)}
        .lnd-feature-card p{color:var(--lnd-text-softer);font-size:13.5px;line-height:1.6;margin:0}

        /* Steps */
        .lnd-steps{display:grid;grid-template-columns:repeat(3,1fr);gap:32px}
        .lnd-step{text-align:center;padding:0 12px}
        .lnd-step-num{
          font-size:38px;font-weight:900;color:rgba(201,162,75,0.25);
          margin-bottom:10px;
        }
        .lnd-step h3{font-size:16.5px;font-weight:700;margin:0 0 8px;color:var(--lnd-text)}
        .lnd-step p{color:var(--lnd-text-softer);font-size:13.5px;line-height:1.6;margin:0}

        /* Pricing */
        .lnd-pricing-grid{
          display:grid;grid-template-columns:repeat(3,1fr);gap:20px;
        }
        .lnd-price-card{
          position:relative;
          background:var(--lnd-card-bg);
          border:1px solid var(--lnd-border-strong);
          border-radius:18px;padding:28px 24px;
        }
        .lnd-price-card-pop{
          border-color:rgba(201,162,75,0.45);
          background:rgba(201,162,75,0.06);
          transform:scale(1.03);
        }
        .lnd-price-badge{
          position:absolute;top:-11px;left:50%;transform:translateX(-50%);
          background:#e0b85c;color:#1a1408;font-size:11px;font-weight:700;
          padding:3px 14px;border-radius:20px;
        }
        .lnd-price-name{font-size:17px;font-weight:800;color:#e0b85c}
        .lnd-price-desc{color:var(--lnd-text-faint);font-size:12.5px;margin:4px 0 16px}
        .lnd-price-amount{font-size:30px;font-weight:900;margin-bottom:18px}
        .lnd-price-amount span{font-size:13px;font-weight:500;color:var(--lnd-text-faint)}
        .lnd-price-feat{
          display:flex;align-items:center;gap:8px;
          font-size:13px;color:var(--lnd-text-soft);margin-bottom:9px;
        }
        .lnd-price-feat svg{color:#34d399;flex-shrink:0}

        /* CTA */
        .lnd-cta{
          position:relative;z-index:1;
          text-align:center;padding:90px 24px;
          max-width:560px;margin:0 auto;
        }
        .lnd-cta-icon{color:#e0b85c;margin-bottom:18px}
        .lnd-cta h2{font-size:30px;font-weight:800;margin:0 0 12px;color:var(--lnd-text)}
        .lnd-cta p{color:var(--lnd-text-softer);font-size:15px;margin:0 0 28px}

        /* Footer */
        .lnd-footer{
          position:relative;z-index:1;
          border-top:1px solid var(--lnd-border);
          padding:32px 24px;
          display:flex;flex-direction:column;align-items:center;gap:12px;
          color:var(--lnd-text-faint);font-size:12.5px;
        }

        /* Responsive */
        @media(max-width:860px){
          .lnd-features-grid{grid-template-columns:repeat(2,1fr)}
          .lnd-steps{grid-template-columns:1fr}
          .lnd-pricing-grid{grid-template-columns:1fr}
          .lnd-price-card-pop{transform:none}
        }
        @media(max-width:640px){
          .lnd-nav-desktop{display:none}
          .lnd-burger{display:block}
          .lnd-hero-title{font-size:32px}
          .lnd-hero-sub{font-size:15px}
          .lnd-features-grid{grid-template-columns:1fr}
          .lnd-section{padding:56px 20px}
          .lnd-section-head h2{font-size:26px}
        }
      `}</style>
    </div>
  );
}

export default LandingPage;
