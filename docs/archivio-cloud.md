# Archivio su cloud

Fogli & Fatture può tenere l'archivio dei dati su **Dropbox**, **OneDrive** o **Google Drive**, per averlo anche sugli altri tuoi computer: lo stesso archivio si apre ovunque.

- **Dropbox e OneDrive:** l'app usa il client del servizio già installato sul computer, collegato al tuo account.
- **Google Drive:** nessun client da installare, accedi con il tuo account Google. La voce compare solo nelle versioni che includono l'accesso a Google.

## Cosa serve

- Per Dropbox e OneDrive (personale): il client desktop installato e collegato al tuo account.
- Per Google Drive: solo un account Google personale.
- Solo account personali: OneDrive e Google Workspace aziendali non sono supportati.
- Il client di Dropbox o OneDrive deve tenere la cartella dell'archivio sempre disponibile offline: altrimenti i file possono non essere leggibili.

## Come si imposta (Dropbox e OneDrive)

1. Apri **Impostazioni** → **Percorso dati**, sezione **Archivio su cloud**. Compare solo se sul computer c'è almeno un client installato.
2. **Servizio cloud**: scegli dal popup il servizio in cui tenere l'archivio.
3. **Cartella del servizio**: l'app propone la cartella trovata del client. Se l'hai spostata dalla posizione predefinita, premi **Cambia…** e scegli quella giusta nella finestra di sistema.
4. **Sottocartella**: è sempre `FogliFatture` dentro la cartella delle app del client (`Apps`, o `Applicazioni` se il client è in italiano) e non si modifica.
5. Premi **Salva**, come negli altri passi.

Cosa succede al salvataggio:
- **Sottocartella vuota o assente:** viene creata e i dati attuali vi vengono spostati.
- **Sottocartella con un archivio:** creato da un altro tuo computer, viene aperto e i dati attuali non vengono toccati.
- **Sottocartella con file estranei:** l'app rifiuta di usarla. Svuotala o scegli un'altra cartella del servizio.

Prima di applicare, l'app mostra un avviso e chiede conferma.

## Google Drive

1. Apri **Impostazioni** → **Percorso dati**, sezione **Archivio su cloud**, e scegli **Google Drive (accesso con account)** nel menu **Servizio cloud**.
2. Premi **Collega Google Drive** e accedi dal browser.
3. L'app crea la cartella `FogliFatture` nel tuo Drive e vi sincronizza l'archivio: se ne trova già uno (per esempio creato su un altro computer) ti chiede di aprirlo.
4. Il passo mostra lo stato, **Sincronizza ora**, gli eventuali file in conflitto e **Scollega**. Scollegando i dati restano sul computer e su Google Drive non si cancella nulla.

Senza connessione le modifiche restano in coda e l'emissione delle fatture è bloccata finché non si sincronizza.

## Chi ha già l'archivio nella vecchia cartella

Se l'archivio sta in `FogliFatture` dentro la cartella di Dropbox, OneDrive o Google Drive, nel passo compare un avviso con il pulsante **Passa al nuovo archivio**.

- L'aggiornamento dell'app non sposta nulla: si cambia solo quando confermi.
- **Dropbox e OneDrive:** i dati vengono spostati in `FogliFatture` dentro la cartella delle app del client (`Apps`, o `Applicazioni` se il client è in italiano). Se lì c'è già un archivio, puoi aprire quello: i dati attuali non vengono toccati e i due archivi non si fondono mai.
- **Google Drive:** dopo il login i dati vengono caricati su Google Drive. La vecchia cartella `FogliFatture` resta nel tuo Drive e non serve più: finché c'è, il client di Google può mostrare due cartelle con lo stesso nome, quindi rinominala o eliminala.
- Un errore a metà non cambia i dati in uso e puoi riprovare.

## Usarlo su più computer

- Su ogni computer accedi allo stesso account (per Dropbox e OneDrive installa anche il client) e ripeti i passi sopra: la sottocartella contiene già l'archivio, quindi viene aperto.
- **Usa l'archivio da un computer alla volta** e lascia finire la sincronizzazione del client prima di emettere una fattura. L'app non può sapere se la sincronizzazione è terminata né se due computer vedono lo stesso contenuto.
- Due computer che emettono fatture senza aver sincronizzato possono assegnare lo stesso numero. L'app controlla la sequenza dei numeri e blocca l'emissione se trova duplicati, ma non può impedirli. Lo SDI scarta la seconda fattura con lo stesso numero.
- Se il client crea copie in conflitto di un file (per esempio «… copia in conflitto …»), l'app le segnala e blocca l'emissione finché non le risolvi.

## Cambiare o lasciare la cartella del cloud

- Per usare un'altra cartella del servizio premi **Cambia…** e salva: si applicano di nuovo le regole di sopra.
- Per tornare a una cartella fuori dal cloud usa il campo di testo del passo Percorso dati con **Sposta dati qui** o **Apri archivio esistente**.
- I file nella cartella dell'archivio sul servizio non vengono mai cancellati dall'app.
