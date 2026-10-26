# Archivio su cloud

Fogli & Fatture può tenere l'archivio dei dati in una cartella sincronizzata da **Dropbox**, **OneDrive** o **Google Drive**, per averlo anche sugli altri tuoi computer.
Non servono login né chiavi nell'app: usa il client del servizio già installato sul computer, che è collegato al tuo account.

## Cosa serve

- Il client desktop del servizio installato e collegato al tuo account: Dropbox, OneDrive (personale) o Google Drive.
- Solo account personali: OneDrive e Google Workspace aziendali non sono supportati.
- Il client deve tenere la cartella dell'archivio sempre disponibile offline. Con Google Drive scegli «Mirroring» o «Disponibile offline», non solo lo streaming: altrimenti i file possono non essere leggibili.

## Come si imposta

1. Apri **Impostazioni** → **Percorso dati**, sezione **Archivio su cloud**. Compare solo se sul computer c'è almeno un client installato.
2. **Servizio cloud**: scegli dal popup il servizio in cui tenere l'archivio.
3. **Cartella del servizio**: l'app propone la cartella trovata del client. Se l'hai spostata dalla posizione predefinita, premi **Cambia…** e scegli quella giusta nella finestra di sistema.
4. **Sottocartella**: è sempre `FogliFatture` e non si modifica.
5. Premi **Salva**, come negli altri passi.

Cosa succede al salvataggio:
- **Sottocartella vuota o assente:** viene creata e i dati attuali vi vengono spostati.
- **Sottocartella con un archivio:** creato da un altro tuo computer, viene aperto e i dati attuali non vengono toccati.
- **Sottocartella con file estranei:** l'app rifiuta di usarla. Svuotala o scegli un'altra cartella del servizio.

Prima di applicare, l'app mostra un avviso e chiede conferma.

## Usarlo su più computer

- Su ogni computer installa il client dello stesso servizio, accedi allo stesso account e ripeti i passi sopra: la sottocartella `FogliFatture` contiene già l'archivio, quindi viene aperto.
- **Usa l'archivio da un computer alla volta** e lascia finire la sincronizzazione del client prima di emettere una fattura. L'app non può sapere se la sincronizzazione è terminata né se due computer vedono lo stesso contenuto.
- Due computer che emettono fatture senza aver sincronizzato possono assegnare lo stesso numero. L'app controlla la sequenza dei numeri e blocca l'emissione se trova duplicati, ma non può impedirli. Lo SDI scarta la seconda fattura con lo stesso numero.
- Se il client crea copie in conflitto di un file (per esempio «… copia in conflitto …»), l'app le segnala e blocca l'emissione finché non le risolvi.

## Cambiare o lasciare la cartella del cloud

- Per usare un'altra cartella del servizio premi **Cambia…** e salva: si applicano di nuovo le regole di sopra.
- Per tornare a una cartella fuori dal cloud usa il campo di testo del passo Percorso dati con **Sposta dati qui** o **Apri archivio esistente**.
- I file nella cartella `FogliFatture` del servizio non vengono mai cancellati dall'app.
