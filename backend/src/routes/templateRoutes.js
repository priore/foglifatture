// Catalogo template di stampa (fattura/timesheet).
import { Router } from 'express';
import { listTemplates, getTemplate } from '../services/templateService.js';

export const templateRoutes = Router();

templateRoutes.get('/', async (req, res) => {
  res.json(await listTemplates(req.query.tipo));
});

templateRoutes.get('/:id', async (req, res) => {
  const template = await getTemplate(req.params.id);
  if (!template) return res.status(404).json({ errore: 'Template non trovato' });
  res.json(template);
});
