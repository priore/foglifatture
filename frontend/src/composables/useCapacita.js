// Cosa è disponibile su questo dispositivo. Le estensioni possono sovrascrivere i valori dopo aver letto le capacità dall'host;
// sul desktop Node restano questi valori predefiniti.
import { reactive } from 'vue';

export const capacita = reactive({ aiCli: true, mcp: true, cartellaLibera: true });
