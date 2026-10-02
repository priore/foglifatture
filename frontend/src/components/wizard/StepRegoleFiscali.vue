<script setup>
import { ref, onMounted } from 'vue';
import { api } from '../../services/api.js';

const emit = defineEmits(['confermata']);

const anni = ref([]);
const annoSelezionato = ref(null);
const regole = ref(null);
const diff = ref([]);
const caricamento = ref(false);
const errore = ref('');
const popupConferma = ref(null); // { anno } oppure null
const spiegaInCorso = ref(false);
const popupAI = ref(null); // { titolo, testo } oppure null

onMounted(async () => {
  await caricaAnni();
});

async function caricaAnni() {
  try {
    anni.value = await api.elencoAnniRegole();
    if (anni.value.length) {
      annoSelezionato.value = anni.value[0].anno;
      await caricaRegole(annoSelezionato.value);
    }
  } catch (err) {
    errore.value = err.message;
  }
}

async function caricaRegole(anno) {
  caricamento.value = true;
  errore.value = '';
  diff.value = [];
  try {
    regole.value = await api.regoleFiscaliAnno(anno);
    diff.value = await api.differenzeRegoleFiscali(anno);
  } catch (err) {
    errore.value = err.message;
  } finally {
    caricamento.value = false;
  }
}

async function selezionaAnno(anno) {
  annoSelezionato.value = anno;
  await caricaRegole(anno);
}

async function conferma() {
  caricamento.value = true;
  errore.value = '';
  try {
    await api.confermaRegoleFiscali(annoSelezionato.value);
    await caricaAnni();
    await caricaRegole(annoSelezionato.value);
    popupConferma.value = { anno: annoSelezionato.value };
    emit('confermata');
  } catch (err) {
    errore.value = err.message;
  } finally {
    caricamento.value = false;
  }
}

function etichettaCampo(campo) {
  const mappa = {
    'forfettario.sogliaAnnua': 'Soglia annua',
    'forfettario.sogliaUscitaImmediata': 'Soglia uscita immediata',
    'forfettario.aliquotaOrdinaria': 'Aliquota ordinaria (%)',
    'forfettario.aliquotaRidotta': 'Aliquota ridotta (%)',
    'forfettario.anniAliquotaRidotta': 'Anni aliquota ridotta',
    'forfettario.coefficienteRedditivitaDefault': 'Coeff. redditività default (%)',
    'inpsGestioneSeparata.aliquota': 'Aliquota GS (%)',
    'inpsGestioneSeparata.aliquotaAltreAttivita': 'Aliquota altre attività (%)',
    'inpsGestioneSeparata.massimale': 'Massimale (€)',
    'bollo.importo': 'Importo bollo (€)',
    'bollo.sogliaBolloVirtuale': 'Soglia bollo virtuale (€)',
    'bollo.sogliaRinvio': 'Soglia rinvio trimestre (€)',
    'acconti.percentualeAcconto': 'Percentuale acconto (%)',
    'acconti.sogliaUnicaSoluzione': 'Soglia unica soluzione (€)',
    'acconti.ripartizioneSoggettoIsa.prima': 'ISA — prima rata (%)',
    'acconti.ripartizioneSoggettoIsa.seconda': 'ISA — seconda rata (%)',
    'acconti.ripartizioneNoIsa.prima': 'No-ISA — prima rata (%)',
    'acconti.ripartizioneNoIsa.seconda': 'No-ISA — seconda rata (%)',
    'rate.tassoInteresseSecondaRata': 'Tasso interesse 2ª rata (%)',
    'rate.incrementoRateSuccessive': 'Incremento rate successive (%)',
    'rate.giorniBase': 'Giorni base anno',
    'rate.mesiCommerciali': 'Giorni mese commerciale',
    'codiciTributo.impostaSostitutiva': 'Imposta sostitutiva',
    'codiciTributo.impostaSostitutivaAcconto': 'Acconto imposta',
    'codiciTributo.impostaSostitutivaSaldo': 'Saldo imposta',
    'codiciTributo.interessiRateazione': 'Interessi rateazione (Erario)',
    'codiciTributo.interessiRateazioneAcconto': 'Interessi rateazione (acconto)',
    'causaliInps.ordinaria': 'Causale ordinaria',
    'causaliInps.aliquotaRidotta': 'Causale aliquota ridotta',
    'causaliInps.rateazioneOrdinaria': 'Causale rateazione ordinaria',
    'causaliInps.rateazioneRidotta': 'Causale rateazione ridotta',
    'causaliInps.interessi': 'Causale interessi',
  };
  if (mappa[campo]) return mappa[campo];
  const ultima = campo.split('.').pop();
  return ultima.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase());
}

function valoreFmt(v) {
  if (v === null || v === undefined) return '—';
  return typeof v === 'number' ? v.toLocaleString('it-IT') : String(v);
}

const SEZIONI = [
  { chiave: 'forfettario', titolo: 'Regime forfettario' },
  { chiave: 'inpsGestioneSeparata', titolo: 'INPS gestione separata' },
  { chiave: 'bollo', titolo: 'Imposta di bollo' },
  { chiave: 'acconti', titolo: 'Acconti' },
  { chiave: 'rate', titolo: 'Rateazione' },
  { chiave: 'codiciTributo', titolo: 'Codici tributo' },
  { chiave: 'causaliInps', titolo: 'Causali INPS' },
];

function valoriSezione(sezione) {
  if (!regole.value?.[sezione]) return [];
  const obj = regole.value[sezione];
  const risultati = [];
  for (const [k, v] of Object.entries(obj)) {
    if (k === 'fonti') continue;
    if (typeof v === 'object' && v !== null) {
      for (const [sk, sv] of Object.entries(v)) {
        if (sk === 'fonti' || typeof sv === 'object') continue;
        risultati.push({ campo: `${k}.${sk}`, valore: sv, fonte: obj.fonti?.[k] });
      }
    } else {
      risultati.push({ campo: k, valore: v, fonte: obj.fonti?.[k] });
    }
  }
  return risultati;
}

function annoInfo(anno) {
  return anni.value.find(a => a.anno === anno);
}

async function spiegaConAI() {
  spiegaInCorso.value = true;
  try {
    const r = await api.spiegaDiffRegoleFiscali(annoSelezionato.value);
    popupAI.value = { titolo: `Analisi AI — Anno ${annoSelezionato.value}`, testo: r.spiegazione };
  } catch (err) {
    popupAI.value = { titolo: 'Analisi AI', testo: err.message };
  } finally {
    spiegaInCorso.value = false;
  }
}
</script>

<template>
  <div>
    <div v-if="errore" class="notifica notifica-warn">{{ errore }}</div>

    <div v-if="!anni.length && !caricamento" class="empty-state">
      Nessun pacchetto di regole fiscali disponibile.
    </div>

    <div v-else class="layout">
      <!-- Sidebar anni -->
      <nav class="sidebar-anni">
        <button
          v-for="a in anni"
          :key="a.anno"
          class="anno-btn"
          :class="{ attivo: annoSelezionato === a.anno }"
          @click="selezionaAnno(a.anno)"
        >
          <span class="dot-anno" :class="a.confermato ? 'ok' : 'warn'"></span>
          {{ a.anno }}
        </button>
      </nav>

      <!-- Colonna destra: pannello stato + griglia card sezioni -->
      <div v-if="caricamento" class="empty-state">Caricamento…</div>
      <div v-else-if="regole" class="colonna-destra">
        <!-- Pannello stato anno -->
        <div class="pannello">
          <div class="pannello-header">
            <h2 class="pannello-titolo">Anno {{ annoSelezionato }}</h2>
            <span v-if="annoInfo(annoSelezionato)?.confermato" class="badge badge-ok">✓ confermato</span>
            <span v-else class="badge badge-warn">⚠ da confermare</span>
          </div>

          <!-- Diff inline -->
          <div v-if="diff.length" class="diff-area">
            <p class="diff-titolo">Aggiornamento disponibile</p>
            <table class="diff-table">
              <thead>
                <tr>
                  <th>Campo</th>
                  <th>Attuale</th>
                  <th>Nuovo {{ annoSelezionato }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="d in diff" :key="d.campo">
                  <td>{{ etichettaCampo(d.campo) }}</td>
                  <td><span class="val-old">{{ valoreFmt(d.vecchio) }}</span></td>
                  <td><span class="val-new">{{ valoreFmt(d.nuovo) }}</span></td>
                </tr>
              </tbody>
            </table>
            <div class="diff-actions">
              <button class="btn btn-primary" :disabled="caricamento" @click="conferma">Conferma regole {{ annoSelezionato }}</button>
              <button class="btn btn-ghost" :disabled="spiegaInCorso" @click="spiegaConAI">{{ spiegaInCorso ? 'Analisi…' : 'Spiega con AI' }}</button>
            </div>
          </div>
          <div v-else-if="!annoInfo(annoSelezionato)?.confermato" class="diff-area">
            <p class="diff-titolo">Pacchetto {{ annoSelezionato }} non ancora confermato</p>
            <div class="diff-actions">
              <button class="btn btn-primary" :disabled="caricamento" @click="conferma">Conferma regole {{ annoSelezionato }}</button>
            </div>
          </div>
          <div v-else class="stato-ok">✓ Regole {{ annoSelezionato }} attive e aggiornate</div>
        </div>

        <!-- Griglia card sezioni -->
        <div class="sezioni-griglia">
          <div v-for="sez in SEZIONI" :key="sez.chiave" class="card-sezione">
            <div class="sezione-header">{{ sez.titolo }}</div>
            <div class="valori-lista">
              <div v-for="v in valoriSezione(sez.chiave)" :key="v.campo" class="valore-item">
                <div class="valore-label">{{ etichettaCampo(`${sez.chiave}.${v.campo}`) }}</div>
                <div class="valore-val">{{ valoreFmt(v.valore) }}</div>
                <a v-if="v.fonte?.url" class="valore-fonte" :href="v.fonte.url" target="_blank" rel="noopener noreferrer" :title="v.fonte.citazione">{{ v.fonte.riferimento }}</a>
                <span v-else-if="v.fonte" class="valore-fonte" :title="v.fonte.citazione">{{ v.fonte.riferimento }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Popup spiegazione AI -->
  <Teleport to="body">
    <div v-if="popupAI" class="ai-overlay" @click.self="popupAI = false">
      <div class="ai-popup" role="dialog" aria-modal="true">
        <div class="ai-popup-header">
          <span class="ai-popup-titolo">{{ popupAI.titolo }}</span>
          <button class="btn-chiudi" @click="popupAI = false" aria-label="Chiudi">✕</button>
        </div>
        <div class="ai-popup-body">
          <p class="ai-popup-testo">{{ popupAI.testo }}</p>
        </div>
        <div class="ai-popup-footer">
          <button class="btn btn-ghost" @click="popupAI = false">Chiudi</button>
        </div>
      </div>
    </div>
  </Teleport>

  <!-- Popup conferma regole -->
  <Teleport to="body">
    <div v-if="popupConferma" class="ai-overlay" @click.self="popupConferma = null">
      <div class="ai-popup" role="dialog" aria-modal="true">
        <div class="ai-popup-header">
          <span class="ai-popup-titolo">✓ Regole {{ popupConferma.anno }} confermate</span>
          <button class="btn-chiudi" @click="popupConferma = null" aria-label="Chiudi">✕</button>
        </div>
        <div class="ai-popup-body">
          <p class="ai-popup-testo">Le regole fiscali per l'anno {{ popupConferma.anno }} sono state confermate e sono ora attive.</p>
        </div>
        <div class="ai-popup-footer">
          <button class="btn btn-primary" @click="popupConferma = null">OK</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.layout {
  display: grid;
  grid-template-columns: 160px 1fr;
  gap: 20px;
  align-items: start;
}
@media (max-width: 600px) { .layout { grid-template-columns: 1fr; } }

/* --- Sidebar anni --- */
.sidebar-anni { display: flex; flex-direction: column; gap: 4px; }
.anno-btn {
  display: flex; align-items: center; gap: 8px;
  padding: 9px 12px; border-radius: var(--radius-sm);
  border: 1px solid transparent; background: transparent;
  color: var(--ink); font-size: var(--font-size-sm); font-weight: 500;
  cursor: pointer; text-align: left; transition: background 0.12s;
}
.anno-btn:hover { background: var(--line); }
.anno-btn.attivo {
  background: color-mix(in srgb, var(--accent) 12%, transparent);
  border-color: var(--accent);
  color: var(--accent);
}
.dot-anno { width: 7px; height: 7px; border-radius: var(--radius-circle); flex-shrink: 0; }
.dot-anno.ok { background: var(--ok); }
.dot-anno.warn { background: var(--warn); }

.colonna-destra { display: flex; flex-direction: column; gap: 16px; min-width: 0; }

/* --- Pannello --- */
.pannello {
  background: var(--card);
  border: 1px solid var(--line);
  border-radius: var(--radius-lg);
  overflow: hidden;
}
.pannello-header {
  padding: 14px 20px; border-bottom: 1px solid var(--line);
  display: flex; align-items: center; gap: 12px; flex-wrap: wrap;
}
.pannello-titolo { font-size: var(--font-size-lg); font-weight: 700; margin: 0; color: var(--ink); }
.badge {
  display: inline-flex; align-items: center;
  font-size: var(--font-size-xs); font-weight: 600;
  padding: 3px 9px; border-radius: var(--radius-pill);
}
.badge-ok { background: var(--ok-bg); color: var(--ok); }
.badge-warn { background: var(--warn-bg); color: var(--warn); }

/* --- Diff inline --- */
.diff-area {
  padding: 14px 20px;
  background: var(--warn-bg);
  border-bottom: 1px solid var(--line);
}
.diff-titolo {
  font-size: var(--font-size-xs); font-weight: 700; text-transform: uppercase;
  letter-spacing: 0.06em; color: var(--warn); margin: 0 0 10px;
}
.diff-table { width: 100%; border-collapse: collapse; font-size: var(--font-size-sm); }
.diff-table th {
  text-align: left; padding: 4px 8px;
  color: var(--muted); font-weight: 600;
  border-bottom: 1px solid var(--line);
}
.diff-table td { padding: 5px 8px; color: var(--ink); }
.diff-table tr:not(:last-child) td { border-bottom: 1px solid var(--line); }
.val-old {
  color: var(--warn); background: color-mix(in srgb, var(--warn) 12%, transparent);
  padding: 1px 5px; border-radius: 3px;
  text-decoration: line-through; font-size: var(--font-size-xs);
}
.val-new {
  color: var(--ok); background: var(--ok-bg);
  padding: 1px 5px; border-radius: 3px;
  font-weight: 700; font-size: var(--font-size-xs);
}
.diff-actions { margin-top: 12px; display: flex; gap: 8px; }
.btn { padding: 7px 14px; border-radius: var(--radius-sm); border: none; font-size: var(--font-size-sm); font-weight: 600; cursor: pointer; }
.btn-primary { background: var(--accent); color: #fff; }
.btn-ghost { background: transparent; border: 1px solid var(--line); color: var(--ink); }
.btn:disabled { opacity: 0.5; cursor: not-allowed; }

/* --- Stato ok --- */
.stato-ok {
  padding: 14px 20px;
  color: var(--ok); font-size: var(--font-size-sm); font-weight: 600;
  border-bottom: 1px solid var(--line);
}

/* --- Sezioni: una card per riga --- */
.sezioni-griglia {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.card-sezione {
  background: var(--card);
  border: 1px solid var(--line);
  border-radius: var(--radius-lg);
  overflow: hidden;
}
.sezione-header {
  padding: 10px 14px;
  font-size: var(--font-size-xs); font-weight: 700;
  text-transform: uppercase; letter-spacing: 0.05em;
  color: var(--muted);
  border-bottom: 1px solid var(--line);
}
.valori-lista {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
}
.valore-item {
  padding: 8px 14px;
  border-bottom: 1px solid var(--line);
  border-right: 1px solid var(--line);
}
.valore-item:last-child { border-bottom: none; }
.valore-label { font-size: var(--font-size-xs); color: var(--muted); margin-bottom: 2px; }
.valore-val { font-size: var(--font-size-md); font-weight: 600; color: var(--ink); font-variant-numeric: tabular-nums; }
.valore-fonte {
  font-size: var(--font-size-2xs); color: var(--muted);
  border-bottom: 1px dotted currentColor;
  text-decoration: none; cursor: pointer;
}
a.valore-fonte:hover { color: var(--accent); border-bottom-color: var(--accent); }

/* --- Popup AI --- */
.ai-overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,0.45);
  display: flex; align-items: center; justify-content: center;
  padding: 20px; z-index: 1100;
}
.ai-popup {
  background: var(--card);
  border: 1px solid var(--line);
  border-radius: var(--radius-lg);
  width: 100%; max-width: 480px;
  max-height: 80vh;
  display: flex; flex-direction: column;
  box-shadow: var(--shadow);
}
.ai-popup-header {
  padding: 14px 16px 12px;
  border-bottom: 1px solid var(--line);
  display: flex; align-items: center; justify-content: space-between; gap: 10px;
  flex-shrink: 0;
}
.ai-popup-titolo { font-size: var(--font-size-sm); font-weight: 700; color: var(--ink); }
.btn-chiudi { background: none; border: none; font-size: 0.9em; cursor: pointer; color: var(--muted); padding: 2px 4px; line-height: 1; }
.btn-chiudi:hover { color: var(--ink); }
.ai-popup-body { padding: 14px 16px; overflow-y: auto; flex: 1; }
.ai-popup-testo { font-size: var(--font-size-sm); color: var(--ink); margin: 0; white-space: pre-line; line-height: 1.7; }
.ai-popup-footer { padding: 10px 16px; border-top: 1px solid var(--line); display: flex; justify-content: flex-end; flex-shrink: 0; }

/* --- Notifiche --- */
.notifica { padding: 10px 14px; border-radius: var(--radius-md); margin-bottom: 12px; font-size: var(--font-size-sm); }
.notifica-ok { background: var(--ok-bg); color: var(--ok); }
.notifica-warn { background: var(--warn-bg); color: var(--warn); }

.empty-state { color: var(--muted); padding: 20px; font-size: var(--font-size-sm); }
</style>
