<script setup>
// Pagina informativa privacy: nessuna logica, solo testo statico (app locale, single-user).
</script>

<template>
  <div>
    <div class="page-head">
      <div><h1>Privacy e trattamento dati</h1><p>Informativa sulla gestione dei dati in questa applicazione</p></div>
    </div>

    <div class="card">
      <div class="card-head"><h2>1. Titolare del trattamento</h2></div>
      <div class="card-body">
        <p>Il titolare del trattamento è il libero professionista/consulente che utilizza l'applicazione in qualità di operatore unico (dati identificativi configurati in Impostazioni → Fornitore). L'app è ad uso strettamente personale: non esiste un servizio multi-utente, non ci sono account di terzi né un backend condiviso in cloud.</p>
      </div>
    </div>

    <div class="card">
      <div class="card-head"><h2>2. Natura dell'applicazione</h2></div>
      <div class="card-body">
        <p>Fogli &amp; Fatture è un'applicazione eseguita localmente sulla macchina dell'operatore (<code>localhost:1969</code>), utilizzata per la gestione di timesheet mensili e la fatturazione elettronica in regime forfettario verso più clienti. Non è un servizio SaaS: nessun dato viene inviato a server dell'autore del software o di terze parti, salvo i canali obbligatori per legge descritti al punto 4.</p>
      </div>
    </div>

    <div class="card">
      <div class="card-head"><h2>3. Dati trattati e finalità</h2></div>
      <div class="card-body">
        <table class="tbl-privacy">
          <thead><tr><th>Categoria dati</th><th>Esempi</th><th>Finalità</th></tr></thead>
          <tbody>
            <tr><td>Dati del fornitore (titolare)</td><td>Ragione sociale, P.IVA/CF, indirizzo, regime fiscale</td><td>Compilazione fattura elettronica FatturaPA</td></tr>
            <tr><td>Dati dei clienti</td><td>Ragione sociale, P.IVA/CF, indirizzo, codice destinatario/PEC</td><td>Emissione fatture verso ciascun cliente</td></tr>
            <tr><td>Ore lavorate (timesheet)</td><td>Date, ore giornaliere per cliente</td><td>Calcolo del compenso e generazione fattura pro-forma</td></tr>
            <tr><td>Fatture emesse</td><td>Numero, data, importo, descrizione, XML FatturaPA</td><td>Adempimento fiscale, invio a SDI, storico</td></tr>
            <tr><td>Credenziali PEC</td><td>Indirizzo, password casella PEC (SMTP/IMAP)</td><td>Invio fatture a SDI e ricezione ricevute di consegna/esito</td></tr>
            <tr><td>Ricevute SDI</td><td>Notifiche di consegna/scarto/esito (RC/NS/MC/NE/EC/DT/AT)</td><td>Verifica dell'esito di consegna delle fatture</td></tr>
            <tr><td>Credenziali Google OAuth</td><td>Client ID/secret, email autorizzata</td><td>Accesso protetto all'app (whitelist di una sola email)</td></tr>
            <tr><td>Chiave API Gemini (opzionale)</td><td>API key</td><td>Ricerca automatica del codice ATECO durante la configurazione iniziale</td></tr>
          </tbody>
        </table>
      </div>
    </div>

    <div class="card">
      <div class="card-head"><h2>4. Comunicazione a terzi</h2></div>
      <div class="card-body">
        <p>I dati non vengono ceduti, venduti o condivisi con terzi per finalità commerciali. Sono trasmessi a soggetti terzi solo quando obbligatorio per legge o necessario al funzionamento della funzionalità richiesta dall'operatore:</p>
        <ul>
          <li><strong>Sistema di Interscambio (SDI)</strong> — l'Agenzia delle Entrate, tramite PEC, per l'obbligo legale di fatturazione elettronica.</li>
          <li><strong>Gestore della casella PEC</strong> (es. Postecert o altro provider scelto dall'operatore) — per l'invio delle fatture e la ricezione delle ricevute, via SMTP/IMAP.</li>
          <li><strong>Google</strong> — solo se configurato l'accesso OAuth, per l'autenticazione all'app.</li>
          <li><strong>Google Gemini API</strong> — solo se l'operatore inserisce volontariamente una API key e utilizza la ricerca ATECO; in tal caso vengono inviati al servizio i soli dati testuali necessari alla ricerca (es. descrizione attività), non l'intero archivio clienti/fatture.</li>
        </ul>
      </div>
    </div>

    <div class="card">
      <div class="card-head"><h2>5. Conservazione e luogo dei dati</h2></div>
      <div class="card-body">
        <p>Tutti i dati sono salvati in file locali sul disco della macchina che esegue l'app (cartella <code>backend/data/</code>: config, timesheet, fatture, allegati ricevute SDI). Non esiste un database remoto né una sincronizzazione cloud gestita dall'applicazione. È disponibile una funzione opzionale di backup automatico/manuale con esportazione cifrata (Impostazioni → Backup), il cui file risultante resta comunque nella disponibilità e responsabilità dell'operatore.</p>
        <p>Le fatture elettroniche e i relativi dati fiscali devono essere conservati secondo gli obblighi di legge italiani in materia di conservazione a norma (tipicamente 10 anni); l'app fornisce supporto a questo obbligo tramite l'esportazione dei documenti ma la conservazione sostitutiva a norma, se richiesta, resta a carico di un servizio esterno scelto dall'operatore.</p>
      </div>
    </div>

    <div class="card">
      <div class="card-head"><h2>6. Sicurezza</h2></div>
      <div class="card-body">
        <p>L'accesso all'app è protetto da autenticazione Google OAuth con whitelist di una singola email autorizzata (se configurata). Le credenziali PEC e le API key sono salvate nella configurazione locale dell'app e non vengono mai trasmesse a servizi diversi da quelli strettamente necessari alla funzione che le utilizza. Essendo un'applicazione locale, la sicurezza dei dati dipende anche dalla protezione fisica/logica della macchina su cui è installata (es. cifratura disco, aggiornamenti di sistema, accesso utente).</p>
      </div>
    </div>

    <div class="card">
      <div class="card-head"><h2>7. Diritti dell'interessato</h2></div>
      <div class="card-body">
        <p>Poiché i dati dei clienti (soggetti diversi dal titolare) sono trattati per l'esecuzione di un contratto/adempimento fiscale (emissione fattura), l'interessato può in ogni momento richiedere al titolare — con i consueti mezzi di contatto già in essere con il proprio consulente/fornitore — accesso, rettifica o informazioni sui propri dati conservati in questa applicazione, ai sensi degli artt. 15-22 del Regolamento (UE) 2016/679 (GDPR). Trattandosi di dati necessari all'adempimento di obblighi fiscali, la cancellazione non è possibile prima della scadenza dei termini di conservazione previsti dalla legge.</p>
      </div>
    </div>

    <div class="card">
      <div class="card-head"><h2>8. Disclaimer</h2></div>
      <div class="card-body">
        <p>Questa informativa descrive il funzionamento del software così com'è, a scopo di trasparenza verso l'operatore e i suoi clienti. Non costituisce consulenza legale: l'operatore, in qualità di titolare del trattamento, resta l'unico responsabile della conformità al GDPR e alla normativa fiscale italiana applicabile alla propria attività, e dovrebbe far verificare la propria informativa privacy completa (es. verso i clienti) da un professionista competente in materia.</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.tbl-privacy { width: 100%; border-collapse: collapse; font-size: .88rem; }
.tbl-privacy th, .tbl-privacy td { text-align: left; padding: 8px 10px; border-bottom: 1px solid var(--line); vertical-align: top; }
.tbl-privacy th { color: var(--ink-soft); font-weight: 600; }
</style>
