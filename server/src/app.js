import express from 'express';
import cors from 'cors';
import { Prisma } from './lib/prisma.js';
import { HttpError, normalizeInput, serialize } from './lib/http.js';
import { webhook } from './controllers/checkout.js';
import routes from './routes.js';

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', true);

app.use(cors());

// Toutes les réponses JSON passent par serialize() : Decimal → "12.00", Date → ISO.
app.use((req, res, next) => {
  const json = res.json.bind(res);
  res.json = (body) => json(serialize(body));
  next();
});

// Le webhook Stripe a besoin du corps brut pour vérifier la signature : avant express.json().
app.post('/api/stripe/webhook', express.raw({ type: '*/*' }), webhook);

app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
  if (req.body && typeof req.body === 'object') {
    // Équivalent de la surcharge de méthode Laravel : POST + _method=PUT/PATCH/DELETE
    const override = typeof req.body._method === 'string' ? req.body._method.toUpperCase() : null;
    if (req.method === 'POST' && ['PUT', 'PATCH', 'DELETE'].includes(override)) req.method = override;
    delete req.body._method;
    req.body = normalizeInput(req.body);
  }
  next();
});

app.use('/api', routes);

app.use('/api', (req, res) => {
  res.status(404).json({ message: `The route ${req.path.replace(/^\//, 'api/')} could not be found.` });
});

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err instanceof HttpError) return res.status(err.status).json(err.body);
  if (err?.type === 'entity.parse.failed') return res.status(400).json({ message: 'JSON invalide.' });

  // Contrainte d'unicité violée → 422 (plutôt qu'une 500 opaque)
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
    return res.status(422).json({ message: 'Cette valeur est déjà utilisée.' });
  }

  console.error(err);
  res.status(500).json({ message: 'Server Error' });
});

export default app;
