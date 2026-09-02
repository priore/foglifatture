<script setup>
// Renderizza un template di stampa (fattura/timesheet) risolto da id, dentro un iframe
// sandboxato. Sostituisce FatturaPrintPreview/TimesheetPrintPreview: quei componenti Vue
// restavano hard-coded, questo compila layout.html/layout.css caricati dal backend.
import { ref, watch, onMounted, onBeforeUnmount } from 'vue';
import { api } from '../../services/api.js';
import { compilaTemplate, montaInIframe } from '../../composables/useTemplateRenderer.js';

const props = defineProps({
  templateId: { type: String, required: true },
  dati: { type: Object, required: true },
  adatta: { type: Boolean, default: true }, // scala il documento A4 alla larghezza disponibile invece di scrollare
});

const LARGHEZZA_A4 = 793.7; // 21cm a 96dpi
const wrapperRef = ref(null);
const iframeRef = ref(null);
const altezza = ref(1123); // ~29.7cm a 96dpi, ridimensionata dopo il render effettivo
const scala = ref(1);
let cssCorrente = '';

async function render() {
  if (!iframeRef.value) return;
  const template = await api.getTemplate(props.templateId);
  const html = compilaTemplate(template.layoutHtml, props.dati);
  cssCorrente = template.layoutCss;
  montaInIframe(iframeRef.value, html, template.layoutCss);
  // L'iframe è same-origin (srcdoc scritto da noi): leggiamo scrollHeight del suo body
  // per evitare lo scroll interno, la pagina ospite scrolla come contenuto normale.
  requestAnimationFrame(() => {
    const body = iframeRef.value?.contentDocument?.body;
    if (body) altezza.value = body.scrollHeight;
  });
}

// watch({immediate:true}) corre in fase di setup, prima che l'iframe sia montato: se
// templateId/dati non cambiano più dopo il mount (es. dati d'esempio statici in
// TemplateGrid) il primo giro no-op (guard su iframeRef nullo) non verrebbe mai ripetuto.
watch(() => [props.templateId, props.dati], render, { immediate: true, deep: true });
onMounted(render);

// Scala il documento A4 alla larghezza reale del wrapper invece di lasciarlo scrollare
// orizzontalmente: il documento resta leggibile per intero nel pannello disponibile.
function aggiornaScala() {
  if (!props.adatta || !wrapperRef.value) return;
  const largh = wrapperRef.value.getBoundingClientRect().width;
  scala.value = largh > 0 ? Math.min(1, largh / LARGHEZZA_A4) : 1;
}
const osservatore = new ResizeObserver(aggiornaScala);
onMounted(() => { if (wrapperRef.value) osservatore.observe(wrapperRef.value); });
onBeforeUnmount(() => osservatore.disconnect());
watch(altezza, aggiornaScala);

// Esportazione PDF: html2canvas cattura il body dell'iframe ma perde le regole CSS
// dichiarate nel <head> dell'iframe (documento separato) — gliele reiniettiamo inline
// nel body stesso, così sopravvivono al clone-per-getComputedStyle di html2canvas.
function contentDocument() {
  const doc = iframeRef.value?.contentDocument;
  if (doc && !doc.body.querySelector('style[data-export]')) {
    const style = doc.createElement('style');
    style.setAttribute('data-export', '');
    style.textContent = cssCorrente;
    doc.body.prepend(style);
  }
  return doc;
}

defineExpose({ contentDocument });
</script>

<template>
  <div ref="wrapperRef" :style="{ height: (altezza * scala) + 'px', width: adatta ? '100%' : LARGHEZZA_A4 + 'px', position: 'relative', overflow: 'hidden' }">
    <iframe
      ref="iframeRef"
      sandbox="allow-same-origin"
      :style="{ position: 'absolute', top: 0, left: 0, width: LARGHEZZA_A4 + 'px', height: altezza + 'px', border: 'none', transform: `scale(${scala})`, transformOrigin: 'top left' }"
    />
  </div>
</template>
