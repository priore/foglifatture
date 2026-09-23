Viewed master.md:1-45
Viewed WORKSPACE_MANIFEST.md:1-88
Viewed PROJECT_CONTEXT.md:1-53

Monetizzare un'applicazione locale (local-first) con codice sorgente pubblico su GitHub è un modello ampiamente validato nel software moderno (es. Obsidian, Aseprite, Bitwarden, Ghostfolio). Nel contesto specifico di questa app (timesheet + fatturazione elettronica PEC/SDI per regime forfettario), il target reale (freelance, consulenti, professionisti) raramente compila codice da sorgente.

---

### 1. Modello Binari Precompilati e Notarizzati (Modello "Aseprite / Blender")
* **Concetto:** Il codice sorgente su GitHub è pubblico (licenza AGPLv3 o Source-Available), ma i pacchetti eseguibili installabili "one-click", firmati e notarizzati (macOS `.dmg` con certificato Apple Developer, Windows `.exe`/`.msi`) sono a pagamento.
* **Canale:** Vendita su Mac App Store, Microsoft Store o piattaforme come LemonSqueezy / Gumroad (es. 29€–49€ una tantum o abbonamento annuale per aggiornamenti).
* **Perché funziona:** Il freelance non-tecnico non clona repository, non installa Node.js e non configura script di avvio; paga per l'installazione automatica, l'integrazione nativa e gli aggiornamenti automatici.

---

### 2. Modello Open-Core (Community Edition vs Pro Edition)
* **Community Edition (GitHub):**
  * Gestione timesheet base per clienti.
  * Generazione anteprima PDF e generazione XML FatturaPA.
* **Pro Edition (Codice proprietario o attivazione con License Key):**
  * Invio automatico via PEC e polling/ricezione SDI automatica in background con notifiche native.
  * Parser automatico delle ricevute di scarto/consegna SDI (NS, RC, MC).
  * Dashboard forfettario avanzata (proiezione limiti 85k€, calcolo imposta sostitutiva e rivalsa INPS).
  * Funzionalità AI (classificazione note spese, suggerimenti ATECO con Gemini).

---

### 3. Modello Servizi a Valore Aggiunto (Hybrid Cloud / Add-ons)
L'app rimane locale e gratuita, ma si monetizzano i servizi esterni opzionali:
* **Conservazione Sostitutiva a Norma:** Integrazione con un provider accreditato per la conservazione legale decennale delle fatture XML.
* **E2EE Cloud Sync & Backup:** Sincronizzazione cifrata end-to-end multi-dispositivo per non dipendere da backup manuali.
* **Portale Clienti:** Condivisione di un link protetto per l'approvazione automatica del timesheet da parte del committente prima dell'emissione fattura.

---

### 4. B2B / White-Label per Studi Commercialisti
* Vendita di licenze "Studio" a commercialisti che forniscono l'applicazione brandizzata ai propri clienti forfettari, con esportazione diretta dei flussi XML/XLSX compatibile con i loro gestionali (es. Teamsystem, Zucchetti, Datev).

---

### È sconveniente pubblicare i sorgenti su GitHub?

| Aspetto | Analisi nel caso di questa app |
|---|---|
| **Fiducia & Privacy** | **Vantaggio critico:** Gestendo credenziali PEC, dati anagrafici e fatturato, la trasparenza del codice locale crea fiducia rispetto ai gestionali cloud SaaS. |
| **Rischio Fork / Concorrenza** | **Basso se protetto da licenza:** Usando licenze come **AGPLv3** (chi redistribuisce deve aprire le modifiche) o licenze **Source-Available / Fair-Code** (es. BSL 1.1 o PolyForm Noncommercial), si impedisce a terzi di trasformare il progetto in un SaaS commerciale chiuso. |
| **Aggiornamenti Normativi** | **Vantaggio:** La community può segnalare o implementare rapidamente modifiche ai tracciati XML FatturaPA dell'Agenzia delle Entrate. |

---

### Strategia Consigliata di Partenza
1. **Licenza:** AGPLv3 o BSL 1.1 su GitHub.
2. **Distribuzione:** Vendi l'eseguibile desktop confezionato con auto-updater a prezzo fisso (lifetime + aggiornamenti inclusi per l'anno fiscale di riferimento).
3. **Upsell:** Funzionalità PEC/SDI automatizzate riservate alla versione commerciale o attivabili con chiave di licenza.