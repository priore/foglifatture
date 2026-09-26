<script setup>
// Grafico lineare generico. Nessuna libreria: SVG nativo con polyline basta.
import { computed } from 'vue';

const props = defineProps({
  punti: { type: Array, required: true }, // [{ etichetta, valore, valoreTesto }]
});

const LARGHEZZA = 100;
const ALTEZZA = 40;

const massimo = computed(() => Math.max(...props.punti.map((p) => p.valore), 1));
const minimo = computed(() => Math.min(...props.punti.map((p) => p.valore), 0));

const coordinate = computed(() => {
  const range = massimo.value - minimo.value || 1;
  const passo = props.punti.length > 1 ? LARGHEZZA / (props.punti.length - 1) : 0;
  return props.punti.map((p, i) => ({
    x: props.punti.length > 1 ? i * passo : LARGHEZZA / 2,
    y: ALTEZZA - ((p.valore - minimo.value) / range) * ALTEZZA,
  }));
});

const linea = computed(() => coordinate.value.map((c) => `${c.x},${c.y}`).join(' '));
</script>

<template>
  <div class="line-chart">
    <svg :viewBox="`0 0 ${LARGHEZZA} ${ALTEZZA}`" preserveAspectRatio="none" class="line-svg">
      <polyline :points="linea" fill="none" stroke="var(--accent)" stroke-width="1.5" vector-effect="non-scaling-stroke" />
      <circle v-for="(c, i) in coordinate" :key="i" :cx="c.x" :cy="c.y" r="1.5" fill="var(--accent)" />
    </svg>
    <div class="line-legenda">
      <span>{{ punti[0]?.etichetta }}</span>
      <span>{{ punti[punti.length - 1]?.etichetta }}</span>
    </div>
  </div>
</template>

<style scoped>
.line-chart { display: flex; flex-direction: column; gap: 4px; }
.line-svg { width: 100%; height: 80px; }
.line-legenda { display: flex; justify-content: space-between; font-size: .68rem; color: var(--muted); }
</style>
