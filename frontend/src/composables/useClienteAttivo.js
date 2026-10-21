import { ref, computed } from 'vue';

// Stato condiviso (singleton di modulo) del cliente selezionato e della modalità di
// gestione dei clienti: la sidebar lo usa per mostrare/nascondere la voce Timesheet.
export const clienteAttivoId = ref(localStorage.getItem('clienteAttivoId'));
const clienti = ref([]);

export function aggiornaGestioniClienti(lista) {
  clienti.value = (lista || []).filter((c) => c.attivo).map((c) => ({ id: c.id, gestione: c.gestione }));
}

// Nascosto se il cliente selezionato è "solo fatture" oppure se nessun cliente attivo usa il timesheet.
export const soloFatture = computed(() =>
  clienti.value.length > 0 && (
    !clienti.value.some((c) => c.gestione !== 'fatture')
    || clienti.value.find((c) => c.id === clienteAttivoId.value)?.gestione === 'fatture'
  ));
