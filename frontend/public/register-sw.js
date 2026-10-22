// Enregistrement du Service Worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => {
        console.log('✅ Service Worker enregistré avec succès:', registration.scope);

        // Vérifier les mises à jour
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          console.log('🔄 Nouvelle version du Service Worker trouvée');

          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              console.log('🎉 Nouvelle version disponible! Rechargez la page pour l\'activer.');
              // Optionnel: Afficher une notification à l'utilisateur
              if (confirm('Une nouvelle version est disponible. Recharger maintenant?')) {
                newWorker.postMessage({ type: 'SKIP_WAITING' });
                window.location.reload();
              }
            }
          });
        });
      })
      .catch((error) => {
        console.error('❌ Échec de l\'enregistrement du Service Worker:', error);
      });
  });

  // Recharger la page lorsque le nouveau Service Worker prend le contrôle
  let refreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!refreshing) {
      refreshing = true;
      window.location.reload();
    }
  });
}

// Gestion de l'installation PWA
window.addEventListener('beforeinstallprompt', (e) => {
  console.log('💡 PWA peut être installée');
  e.preventDefault();

  // Afficher un bouton d'installation personnalisé (optionnel)
  // showInstallButton();
});

window.addEventListener('appinstalled', () => {
  console.log('🎉 PWA installée avec succès!');
});
