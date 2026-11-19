import { useEffect, useState } from 'react';
import { WifiOff } from 'lucide-react';

export default function ConnectionStatus() {
  const [offline, setOffline] = useState(() => !navigator.onLine);

  useEffect(() => {
    const update = () => setOffline(!navigator.onLine);
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    update();
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);

  return (
    <div className="app-connection-status" role="status" aria-live="polite" aria-atomic="true">
      {offline && (
        <div className="app-offline-banner">
          <WifiOff size={20} aria-hidden="true" />
          <span>Vous êtes hors connexion. Les paiements et les modifications nécessitent une connexion internet.</span>
        </div>
      )}
    </div>
  );
}