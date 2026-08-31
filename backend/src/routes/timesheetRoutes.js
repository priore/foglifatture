import { Router } from 'express';
import { getTimesheet, saveTimesheet, calcolaRiepilogo, listMesiDisponibili } from '../services/timesheetService.js';
import { esportaTimesheetVms } from '../services/vmsTimesheetExporter.js';

export const timesheetRoutes = Router();

timesheetRoutes.get('/', async (req, res) => {
  res.json(await listMesiDisponibili());
});

timesheetRoutes.get('/:anno/:mese/:clienteId', async (req, res) => {
  const { anno, mese, clienteId } = req.params;
  const timesheet = await getTimesheet(Number(anno), Number(mese), clienteId);
  res.json({ ...timesheet, riepilogo: calcolaRiepilogo(timesheet) });
});

timesheetRoutes.put('/:anno/:mese/:clienteId', async (req, res) => {
  const { anno, mese, clienteId } = req.params;
  const timesheet = await saveTimesheet(Number(anno), Number(mese), clienteId, req.body.giorni);
  res.json({ ...timesheet, riepilogo: calcolaRiepilogo(timesheet) });
});

timesheetRoutes.get('/:anno/:mese/:clienteId/export-vms', async (req, res) => {
  const { anno, mese, clienteId } = req.params;
  const timesheet = await getTimesheet(Number(anno), Number(mese), clienteId);
  const csv = esportaTimesheetVms(Number(anno), Number(mese), timesheet.giorni);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="timesheet-${anno}-${String(mese).padStart(2, '0')}.csv"`);
  res.send(csv);
});
