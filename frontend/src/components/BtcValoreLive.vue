<script setup>
// Valore BTC in tempo reale: prezzo di 1 BTC e valore dei BTC detenuti. `tipo` sceglie quale
// mostrare (card separate in dashboard), `tipo="entrambi"` li affianca (vista Bitcoin).
import { useBtcLive } from '../composables/useBtcLive.js';

defineProps({ tipo: { type: String, default: 'entrambi' } });
const { prezzo, satoshi, valoreDetenuti, errore, caricando } = useBtcLive();
const euro = (v) => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(v ?? 0);
</script>

<template>
  <p v-if="caricando && !prezzo" class="note-legal">Verifico prezzo di mercato…</p>
  <div v-else class="mini-stat-row">
    <div v-if="tipo !== 'detenuti'" class="mini-stat">
      <span class="mini-stat-label">1 BTC oggi</span>
      <span class="mini-stat-value">{{ prezzo ? euro(prezzo.eur) : '—' }}</span>
      <span v-if="!prezzo && errore" class="mini-stat-sub">{{ errore }}</span>
      <span
        v-if="prezzo?.variazione24h != null" class="badge-variazione"
        :class="prezzo.variazione24h >= 0 ? 'positiva' : 'negativa'"
      >{{ prezzo.variazione24h >= 0 ? '+' : '' }}{{ prezzo.variazione24h.toFixed(2) }}% 24h</span>
    </div>
    <div v-if="tipo !== 'prezzo'" class="mini-stat">
      <span class="mini-stat-label">Valore BTC detenuti</span>
      <span class="mini-stat-value">{{ valoreDetenuti != null ? euro(valoreDetenuti) : '—' }}</span>
      <span class="mini-stat-sub">{{ satoshi != null ? (satoshi / 1e8).toFixed(8) + ' BTC detenuti' : '' }}</span>
    </div>
  </div>
</template>

<style>
.badge-variazione { font-size: .72rem; font-weight: 700; border-radius: var(--radius-pill); padding: 3px 10px; }
.badge-variazione.positiva { color: var(--ok); background: var(--ok-bg); }
.badge-variazione.negativa { color: var(--warn); background: var(--warn-bg); }
</style>

<style scoped>
.mini-stat-row { display: flex; gap: 12px; flex-wrap: wrap; }
.mini-stat { flex: 1; min-width: 140px; background: var(--ground); border: 1px solid var(--line); border-radius: var(--radius-md); padding: 8px 12px; display: flex; flex-direction: column; align-items: flex-start; gap: 2px; }
.mini-stat-label { font-size: var(--font-size-2xs); color: var(--muted); text-transform: uppercase; letter-spacing: .03em; }
.mini-stat-value { font-size: var(--font-size-md); font-weight: 700; color: var(--ink); }
.mini-stat-sub { font-size: var(--font-size-xs); color: var(--muted); }
</style>
