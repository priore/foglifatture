import { Router } from 'express';
import passport from 'passport';
import { isAuthConfigurato } from '../lib/auth.js';

export const authRoutes = Router();

authRoutes.get('/stato', async (req, res) => {
  const attiva = await isAuthConfigurato();
  res.json({
    autenticazioneAttiva: attiva,
    autenticato: attiva ? Boolean(req.isAuthenticated?.()) : true,
    utente: req.user ?? null,
  });
});

authRoutes.get('/google', async (req, res, next) => {
  if (!(await isAuthConfigurato())) return res.redirect('/');
  passport.authenticate('google', { scope: ['profile', 'email'] })(req, res, next);
});

authRoutes.get('/google/callback', async (req, res, next) => {
  if (!(await isAuthConfigurato())) return res.redirect('/');
  passport.authenticate('google', {
    successRedirect: '/',
    failureRedirect: '/?errore=email-non-autorizzata',
  })(req, res, next);
});

authRoutes.post('/logout', (req, res) => {
  req.logout?.(() => res.json({ ok: true }));
});
