// Point d'entrée Vercel : une seule fonction serverless sert toute l'API Express.
// Le code de l'API vit dans /server (les fichiers de /api deviennent chacun une fonction).
import app from '../server/src/app.js';

export default app;
