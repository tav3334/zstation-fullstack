import { Component } from 'react';

export default class AppErrorBoundary extends Component {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error, info) {
    console.error('Erreur d’affichage de l’application', error, info.componentStack);
  }

  render() {
    if (!this.state.failed) return this.props.children;

    return (
      <main className="app-recovery" aria-labelledby="recovery-title">
        <section className="app-recovery-card" role="alert">
          <h1 id="recovery-title">Un problème empêche l’affichage</h1>
          <p>Rechargez la page pour rouvrir l’application. Les données saisies dans les formulaires peuvent être perdues.</p>
          <p>Si vous étiez en train d’encaisser, vérifiez l’historique des ventes avant de recommencer le paiement.</p>
          <button type="button" onClick={() => window.location.reload()}>
            Recharger l’application
          </button>
        </section>
      </main>
    );
  }
}