// Esportazione PDF A4 tramite html2pdf.js, condivisa da Timesheet e Fattura.
// Margini a zero perché il padding A4 è già gestito dentro i CSS di stampa dedicati.
import html2pdf from 'html2pdf.js';
import { capacita } from './useCapacita.js';

const opzioni = () => ({
  margin: 0,
  image: { type: 'jpeg', quality: 0.98 },
  // scala ridotta dove la memoria è poca (capacita.pdfScala): un canvas A4 a scala 2 può superare il limite
  html2canvas: { scale: capacita.pdfScala, useCORS: true },
  jsPDF: { unit: 'cm', format: 'a4', orientation: 'portrait' },
  pagebreak: { mode: ['css', 'avoid-all'] },
});

export async function esportaPdf(elemento, nomeFile) {
  await html2pdf().set({ ...opzioni(), filename: nomeFile }).from(elemento).save();
}

// Genera lo stesso PDF come Blob invece di scaricarlo, per poterlo inviare al backend
// (invio email al cliente con allegato reale, che il browser non può fare da solo).
export async function generaPdfBlob(elemento) {
  return html2pdf().set(opzioni()).from(elemento).outputPdf('blob');
}
