// Server Express: API REST per timesheet/fatturazione + autenticazione Google OAuth
// (disattivata finché le credenziali non sono configurate) + file statici del frontend.
import 'dotenv/config';
import express from 'express';
import session from 'express-session';
import passport from 'passport';
import path from 'node:path';
import { configuraPassport, isAuthConfigurato, richiedeAutenticazione } from './lib/auth.js';
import { logger } from './lib/logger.js';
import { authRoutes } from './routes/authRoutes.js';
import { configRoutes } from './routes/configRoutes.js';
import { timesheetRoutes } from './routes/timesheetRoutes.js';
import { invoiceRoutes } from './routes/invoiceRoutes.js';
import { oauthConfigRoutes } from './routes/oauthConfigRoutes.js';
import { sdiRoutes } from './routes/sdiRoutes.js';
import { importRoutes } from './routes/importRoutes.js';
import { getConfig } from './services/configService.js';
import { avviaPollingSdi } from './services/sdiRicevuteService.js';

const PORT = process.env.PORT || 1969;
const app = express();

app.use(express.json());

// Log di ogni richiesta API: utile per capire cosa stava facendo l'utente
// quando si verifica un problema (es. prima di un invio PEC fallito).
app.use('/api', (req, res, next) => {
  logger.info(`${req.method} ${req.originalUrl}`);
  next();
});

app.use(session({
  secret: process.env.SESSION_SECRET || 'segreto-di-sviluppo',
  resave: false,
  saveUninitialized: false,
}));

configuraPassport();
app.use(passport.initialize());
app.use(passport.session());

app.use('/auth', authRoutes);
app.use('/api/config', richiedeAutenticazione, configRoutes);
app.use('/api/timesheet', richiedeAutenticazione, timesheetRoutes);
app.use('/api/invoice', richiedeAutenticazione, invoiceRoutes);
app.use('/api/oauth-config', richiedeAutenticazione, oauthConfigRoutes);
app.use('/api/sdi', richiedeAutenticazione, sdiRoutes);
app.use('/api/import', richiedeAutenticazione, importRoutes);

// Serve il frontend Vue buildato (npm run build in ../frontend genera dist/).
const frontendDist = path.join(import.meta.dirname, '..', '..', 'frontend', 'dist');
app.use(express.static(frontendDist));
app.get('/{*splat}', (req, res) => {
  res.sendFile(path.join(frontendDist, 'index.html'));
});

// Error handler globale: qualunque eccezione non gestita nelle route finisce
// nel log invece che sparire in console, con il dettaglio per poter intervenire.
app.use((err, req, res, next) => {
  logger.error(`Errore non gestito su ${req.method} ${req.originalUrl}`, { errore: err.message, stack: err.stack });
  res.status(500).json({ errore: 'Errore interno del server' });
});

app.listen(PORT, async () => {
  logger.info(`Server avviato su http://localhost:${PORT}`);
  logger.info(`Autenticazione Google: ${isAuthConfigurato() ? 'attiva' : 'disattivata (configurala in .env)'}`);

  const config = await getConfig();
  avviaPollingSdi(getConfig, config.sdi.intervalloPollingMinuti);
  logger.info(`Polling ricevute SDI avviato ogni ${config.sdi.intervalloPollingMinuti} minuti`);
});
