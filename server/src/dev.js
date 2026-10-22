// Serveur local (en production, Vercel utilise api/index.js).
import app from './app.js';

const port = Number(process.env.PORT ?? 3001);
app.listen(port, () => {
  console.log(`API prête sur http://localhost:${port}/api`);
});
