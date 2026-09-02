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
import { backupRoutes } from './routes/backupRoutes.js';
import { reminderRoutes } from './routes/reminderRoutes.js';
import { forfettarioRoutes } from './routes/forfettarioRoutes.js';
import { mailRoutes } from './routes/mailRoutes.js';
import { sistemaRoutes } from './routes/sistemaRoutes.js';
import { updateRoutes } from './routes/updateRoutes.js';
import { templateRoutes } from './routes/templateRoutes.js';
import { getConfig, applicaPercorsoDatiAllAvvio } from './services/configService.js';
import { avviaPollingSdi } from './services/sdiRicevuteService.js';
import { avviaBackupAutomatico } from './services/backupService.js';
import { avviaPromemoria } from './services/reminderService.js';
import { avviaPromemoriaScartoSdi } from './services/sdiScartoReminderService.js';

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

await configuraPassport();
app.use(passport.initialize());
app.use(passport.session());

app.use('/auth', authRoutes);
app.use('/api/config', richiedeAutenticazione, configRoutes);
app.use('/api/timesheet', richiedeAutenticazione, timesheetRoutes);
app.use('/api/invoice', richiedeAutenticazione, invoiceRoutes);
app.use('/api/oauth-config', richiedeAutenticazione, oauthConfigRoutes);
app.use('/api/sdi', richiedeAutenticazione, sdiRoutes);
app.use('/api/import', richiedeAutenticazione, importRoutes);
app.use('/api/backup', richiedeAutenticazione, backupRoutes);
app.use('/api/reminder', richiedeAutenticazione, reminderRoutes);
app.use('/api/forfettario', richiedeAutenticazione, forfettarioRoutes);
app.use('/api/mail', richiedeAutenticazione, mailRoutes);
app.use('/api/sistema', richiedeAutenticazione, sistemaRoutes);
app.use('/api/update', richiedeAutenticazione, updateRoutes);
app.use('/api/templates', richiedeAutenticazione, templateRoutes);

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
  logger.info(`Autenticazione Google: ${await isAuthConfigurato() ? 'attiva' : 'disattivata (configurala in Impostazioni)'}`);

  await applicaPercorsoDatiAllAvvio();
  const config = await getConfig();
  avviaPollingSdi(getConfig, config.sdi.intervalloPollingMinuti);
  logger.info(`Polling ricevute SDI avviato ogni ${config.sdi.intervalloPollingMinuti} minuti`);

  if (config.backup.abilitato) {
    avviaBackupAutomatico(getConfig, config.backup.intervalloOreMinuti);
    logger.info(`Backup automatico avviato ogni ${config.backup.intervalloOreMinuti} minuti`);
  }

  if (config.reminder.abilitato) {
    avviaPromemoria(getConfig);
    logger.info('Promemoria timesheet fine mese attivo');
  }

  avviaPromemoriaScartoSdi(getConfig);
  logger.info('Promemoria fatture scartate da SDI attivo');
});
