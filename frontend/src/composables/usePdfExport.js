// Esportazione PDF A4 tramite html2pdf.js, condivisa da Timesheet e Fattura.
// Margini a zero perché il padding A4 è già gestito dentro i CSS di stampa dedicati.
import html2pdf from 'html2pdf.js';

const OPZIONI = {
  margin: 0,
  image: { type: 'jpeg', quality: 0.98 },
  html2canvas: { scale: 2, useCORS: true },
  jsPDF: { unit: 'cm', format: 'a4', orientation: 'portrait' },
  pagebreak: { mode: ['css', 'avoid-all'] },
};

export async function esportaPdf(elemento, nomeFile) {
  await html2pdf().set({ ...OPZIONI, filename: nomeFile }).from(elemento).save();
}

// Genera lo stesso PDF come Blob invece di scaricarlo, per poterlo inviare al backend
// (invio email al cliente con allegato reale, che il browser non può fare da solo).
export async function generaPdfBlob(elemento) {
  return html2pdf().set(OPZIONI).from(elemento).outputPdf('blob');
}
