<script setup>
// Grafico lineare generico. Nessuna libreria: SVG nativo con polyline basta.
import { computed } from 'vue';

const props = defineProps({
  punti: { type: Array, required: true }, // [{ etichetta, valore, valoreTesto }]
  // true = scala sul range min/max dei punti (zoom sulla variazione, es. sparkline prezzo di mercato).
  // false (default) = scala da 0 (confronto assoluto, es. andamento cambio rate incassate).
  scalaRelativa: { type: Boolean, default: false },
  // true = stile sparkline widget (curva smooth, senza pallini/legenda/assi) invece del grafico con dati puntuali.
  sparkline: { type: Boolean, default: false },
});

const LARGHEZZA = 100;
const ALTEZZA = 40;

const massimo = computed(() => Math.max(...props.punti.map((p) => p.valore), 1));
const minimo = computed(() => props.scalaRelativa ? Math.min(...props.punti.map((p) => p.valore)) : Math.min(...props.punti.map((p) => p.valore), 0));

// Padding verticale: la curva smooth (bezier) supera leggermente i punti min/max nei
// tratti tra un punto e l'altro (overshoot) — senza margine il picco viene tagliato dal viewBox.
const PADDING_Y = 4;

const coordinate = computed(() => {
  const range = massimo.value - minimo.value || 1;
  const passo = props.punti.length > 1 ? LARGHEZZA / (props.punti.length - 1) : 0;
  const altezzaUtile = ALTEZZA - PADDING_Y * 2;
  return props.punti.map((p, i) => ({
    x: props.punti.length > 1 ? i * passo : LARGHEZZA / 2,
    y: PADDING_Y + altezzaUtile - ((p.valore - minimo.value) / range) * altezzaUtile,
  }));
});

const linea = computed(() => coordinate.value.map((c) => `${c.x},${c.y}`).join(' '));

// Path smooth (curva di Catmull-Rom convertita in bezier cubiche) per lo stile sparkline:
// stessa serie punti, nessuna dipendenza nuova, solo interpolazione tra le coordinate già calcolate.
const percorsoSmooth = computed(() => {
  const pts = coordinate.value;
  if (pts.length < 2) return '';
  let d = `M ${pts[0].x},${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${c1x},${c1y} ${c2x},${c2y} ${p2.x},${p2.y}`;
  }
  return d;
});
</script>

<template>
  <div class="line-chart" :class="{ 'line-chart-sparkline': sparkline }">
    <svg :viewBox="`0 0 ${LARGHEZZA} ${ALTEZZA}`" preserveAspectRatio="none" class="line-svg">
      <path v-if="sparkline" :d="percorsoSmooth" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linecap="round" vector-effect="non-scaling-stroke" />
      <template v-else>
        <polyline :points="linea" fill="none" stroke="var(--accent)" stroke-width="1.5" vector-effect="non-scaling-stroke" />
        <circle v-for="(c, i) in coordinate" :key="i" :cx="c.x" :cy="c.y" r="1.5" fill="var(--accent)" />
      </template>
    </svg>
    <div v-if="!sparkline" class="line-legenda">
      <span>{{ punti[0]?.etichetta }}</span>
      <span>{{ punti[punti.length - 1]?.etichetta }}</span>
    </div>
  </div>
</template>

<style scoped>
.line-chart { display: flex; flex-direction: column; gap: 4px; }
.line-svg { width: 100%; height: 80px; }
.line-chart-sparkline .line-svg { height: 48px; }
.line-legenda { display: flex; justify-content: space-between; font-size: .68rem; color: var(--muted); }
</style>
