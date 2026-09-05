<script setup>
// Donut generico a spicchi proporzionali. Nessuna libreria: pochi <path> SVG bastano.
import { computed } from 'vue';

const props = defineProps({
  fette: { type: Array, required: true }, // [{ valore, colore, etichetta }]
  centroValore: { type: String, default: '' }, // testo grande al centro (es. "5.6%")
  centroLabel: { type: String, default: '' }, // sottotitolo piccolo sotto il valore
});

const RAGGIO = 70;
const CENTRO = 100;

function arco(raggio, startAngle, endAngle) {
  const rad = (deg) => (deg - 90) * (Math.PI / 180);
  const x1 = CENTRO + raggio * Math.cos(rad(startAngle));
  const y1 = CENTRO + raggio * Math.sin(rad(startAngle));
  const x2 = CENTRO + raggio * Math.cos(rad(endAngle));
  const y2 = CENTRO + raggio * Math.sin(rad(endAngle));
  const largeArc = endAngle - startAngle > 180 ? 1 : 0;
  return `M ${x1} ${y1} A ${raggio} ${raggio} 0 ${largeArc} 1 ${x2} ${y2}`;
}

const spicchi = computed(() => {
  const totale = props.fette.reduce((t, f) => t + f.valore, 0) || 1;
  let angolo = 0;
  return props.fette.map((f) => {
    const gradi = (f.valore / totale) * 360;
    const path = arco(RAGGIO, angolo, angolo + Math.max(gradi - 1.5, 0));
    angolo += gradi;
    return { ...f, path, percentuale: Math.round((f.valore / totale) * 100) };
  });
});
</script>

<template>
  <div class="donut-wrap">
    <svg viewBox="0 0 200 200" class="donut-svg">
      <circle :cx="CENTRO" :cy="CENTRO" :r="RAGGIO" fill="none" stroke="var(--line)" stroke-width="22" />
      <path v-for="f in spicchi" :key="f.etichetta" :d="f.path" fill="none" :stroke="f.colore" stroke-width="22" stroke-linecap="round" />

      <text v-if="centroValore" x="100" y="96" text-anchor="middle" class="donut-pct">{{ centroValore }}</text>
      <text v-if="centroLabel" x="100" y="114" text-anchor="middle" class="donut-sub">{{ centroLabel }}</text>
    </svg>

    <ul class="donut-legend">
      <li v-for="f in spicchi" :key="f.etichetta">
        <span class="dot" :style="{ background: f.colore }"></span>
        <span>
          {{ f.etichetta }} — <strong>{{ f.percentuale }}%</strong>
          <template v-if="f.valoreTesto"><br><small class="donut-legend-valore">{{ f.valoreTesto }}</small></template>
        </span>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.donut-wrap { display: flex; align-items: center; gap: 24px; flex-wrap: wrap; }
.donut-svg { width: 220px; height: 220px; flex-shrink: 0; }
.donut-pct { font-family: 'IBM Plex Mono', monospace; font-size: var(--font-size-xl); font-weight: 600; fill: var(--ink); }
.donut-sub { font-size: var(--font-size-2xs); fill: var(--muted); text-transform: uppercase; letter-spacing: .06em; }
.donut-legend { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: var(--gap-md); }
.donut-legend li { font-size: .88rem; color: var(--ink-soft); display: flex; align-items: flex-start; gap: var(--gap-sm); }
.dot { width: 10px; height: 10px; border-radius: var(--radius-circle); display: inline-block; flex-shrink: 0; margin-top: 5px; }
.donut-legend-valore { color: var(--muted); font-size: .78rem; }
</style>
