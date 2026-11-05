// Cosa è disponibile su questo dispositivo. Le estensioni possono sovrascrivere i valori dopo aver letto le capacità dall'host;
// sul desktop Node restano questi valori predefiniti.
import { reactive } from 'vue';

export const capacita = reactive({ piattaforma: 'desktop', aiCli: true, mcp: true, cartellaLibera: true, sceltaCartella: false, loginGoogle: true, backupAutomatico: true, cartellaMultipla: true, pdfScala: 2, notificheDesktop: true, llmInRete: false, versione: '', nomeApp: 'Fogli & Fatture' });
