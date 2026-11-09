// Iniziale per il filtro alfabetico delle liste lunghe: lettera maiuscola senza accento,
// «#» per cifre e simboli. Condivisa da ListaPopup e dall'elenco clienti.
export const iniziale = (testo) => {
  const c = String(testo || '').trim().normalize('NFD').replace(/[̀-ͯ]/g, '').charAt(0).toUpperCase();
  return /[A-Z]/.test(c) ? c : '#';
};

// Iniziali presenti in un elenco di testi, ordinate: ogni tocco produce almeno un risultato.
export const inizialiDi = (testi) => [...new Set(testi.map(iniziale))].sort();
