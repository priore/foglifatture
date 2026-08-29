// Autenticazione Google OAuth2 per singolo utente (whitelist di una sola email).
// Se GOOGLE_CLIENT_ID/SECRET non sono configurati, il login è disattivato e ogni
// richiesta viene considerata autenticata: serve per poter aprire le Impostazioni
// la primissima volta e inserire le credenziali senza restare fuori dall'app.
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';

export function isAuthConfigurato() {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

export function configuraPassport() {
  if (!isAuthConfigurato()) return;

  passport.use(new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: `/auth/google/callback`,
    },
    (accessToken, refreshToken, profile, done) => {
      const email = profile.emails?.[0]?.value;
      const emailAutorizzata = process.env.ALLOWED_EMAIL;
      if (emailAutorizzata && email === emailAutorizzata) {
        return done(null, { email, nome: profile.displayName });
      }
      return done(null, false, { message: 'Email non autorizzata' });
    },
  ));

  passport.serializeUser((user, done) => done(null, user));
  passport.deserializeUser((user, done) => done(null, user));
}

// Middleware che protegge le route API: lascia passare tutto se l'auth non è configurata.
export function richiedeAutenticazione(req, res, next) {
  if (!isAuthConfigurato()) return next();
  if (req.isAuthenticated?.()) return next();
  return res.status(401).json({ errore: 'Non autenticato' });
}
