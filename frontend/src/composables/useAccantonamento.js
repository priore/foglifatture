// K1: quota da accantonare per un incasso, per anno di incasso (cache per anno).
import { reactive } from 'vue';
import { api } from '../services/api.js';

const quote = reactive({});

export async function caricaQuota(anno) {
  if (quote[anno] !== undefined) return;
  quote[anno] = null;
  try {
    quote[anno] = (await api.accantonamento(anno)).quotaPct;
  } catch {
    // quota non disponibile: l'indicazione "da accantonare" non compare
  }
}

export function daAccantonare(importo, anno) {
  const q = quote[anno];
  return q == null ? null : (Number(importo) || 0) * q / 100;
}
