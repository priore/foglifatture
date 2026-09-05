// Autenticazione Google OAuth2 per singolo utente (whitelist di una sola email).
// Se GOOGLE_CLIENT_ID/SECRET non sono configurati, il login è disattivato e ogni
// richiesta viene considerata autenticata: serve per poter aprire le Impostazioni
// la primissima volta e inserire le credenziali senza restare fuori dall'app.
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { leggiGoogleClientSecret } from '../services/envService.js';

// Il client secret vive nel Keychain (keytar), non in process.env: la verifica e la
// configurazione di passport devono quindi essere async.
export async function isAuthConfigurato() {
  const secret = await leggiGoogleClientSecret();
  return Boolean(process.env.GOOGLE_CLIENT_ID && secret);
}

export async function configuraPassport() {
  const secret = await leggiGoogleClientSecret();
  if (!process.env.GOOGLE_CLIENT_ID || !secret) return;

  passport.use(new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: secret,
      callbackURL: `/auth/google/callback`,
    },
    (accessToken, refreshToken, profile, done) => {
      const email = profile.emails?.[0]?.value;
      // Whitelist multi-email: ALLOWED_EMAIL può contenere più indirizzi separati da virgola.
      const emailAutorizzate = (process.env.ALLOWED_EMAIL || '').split(',').map((e) => e.trim()).filter(Boolean);
      if (email && emailAutorizzate.includes(email)) {
        return done(null, { email, nome: profile.displayName });
      }
      return done(null, false, { message: 'Email non autorizzata' });
    },
  ));

  passport.serializeUser((user, done) => done(null, user));
  passport.deserializeUser((user, done) => done(null, user));
}

// Middleware che protegge le route API: lascia passare tutto se l'auth non è configurata.
export async function richiedeAutenticazione(req, res, next) {
  if (!(await isAuthConfigurato())) return next();
  if (req.isAuthenticated?.()) return next();
  return res.status(401).json({ errore: 'Non autenticato' });
}
