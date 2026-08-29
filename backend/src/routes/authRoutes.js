import { Router } from 'express';
import passport from 'passport';
import { isAuthConfigurato } from '../lib/auth.js';

export const authRoutes = Router();

authRoutes.get('/stato', (req, res) => {
  res.json({
    autenticazioneAttiva: isAuthConfigurato(),
    autenticato: isAuthConfigurato() ? Boolean(req.isAuthenticated?.()) : true,
    utente: req.user ?? null,
  });
});

authRoutes.get('/google', (req, res, next) => {
  if (!isAuthConfigurato()) return res.redirect('/');
  passport.authenticate('google', { scope: ['profile', 'email'] })(req, res, next);
});

authRoutes.get('/google/callback', (req, res, next) => {
  if (!isAuthConfigurato()) return res.redirect('/');
  passport.authenticate('google', {
    successRedirect: '/',
    failureRedirect: '/?errore=email-non-autorizzata',
  })(req, res, next);
});

authRoutes.post('/logout', (req, res) => {
  req.logout?.(() => res.json({ ok: true }));
});
