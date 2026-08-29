// Esportazione PDF A4 tramite html2pdf.js, condivisa da Timesheet e Fattura.
// Margini a zero perché il padding A4 è già gestito dentro i CSS di stampa dedicati.
import html2pdf from 'html2pdf.js';

export async function esportaPdf(elemento, nomeFile) {
  await html2pdf()
    .set({
      margin: 0,
      filename: nomeFile,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: 'cm', format: 'a4', orientation: 'portrait' },
      pagebreak: { mode: ['css', 'avoid-all'] },
    })
    .from(elemento)
    .save();
}
