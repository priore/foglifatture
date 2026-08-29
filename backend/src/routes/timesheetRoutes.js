import { Router } from 'express';
import { getTimesheet, saveTimesheet, calcolaRiepilogo, listMesiDisponibili } from '../services/timesheetService.js';

export const timesheetRoutes = Router();

timesheetRoutes.get('/', async (req, res) => {
  res.json(await listMesiDisponibili());
});

timesheetRoutes.get('/:anno/:mese', async (req, res) => {
  const { anno, mese } = req.params;
  const timesheet = await getTimesheet(Number(anno), Number(mese));
  res.json({ ...timesheet, riepilogo: calcolaRiepilogo(timesheet) });
});

timesheetRoutes.put('/:anno/:mese', async (req, res) => {
  const { anno, mese } = req.params;
  const timesheet = await saveTimesheet(Number(anno), Number(mese), req.body.giorni);
  res.json({ ...timesheet, riepilogo: calcolaRiepilogo(timesheet) });
});
