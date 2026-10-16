// Entry point MCP via stdio: lanciato dal client AI (Claude Desktop/Code) come processo figlio.
// Non avvia Express né polling: legge JSON-RPC (una richiesta per riga) da stdin e risponde su stdout.
import readline from 'node:readline';
import { applicaPercorsoDatiAllAvvio } from './services/configService.js';
import { gestisciRichiesta } from './services/mcpService.js';

// stdout è riservato al protocollo: il logger scrive con console.log, lo dirottiamo su stderr.
console.log = console.error;

await applicaPercorsoDatiAllAvvio();

const scrivi = (obj) => process.stdout.write(`${JSON.stringify(obj)}\n`);

for await (const riga of readline.createInterface({ input: process.stdin })) {
  if (!riga.trim()) continue;
  let msg;
  try {
    msg = JSON.parse(riga);
  } catch {
    scrivi({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'JSON non valido' } });
    continue;
  }
  const risposta = await gestisciRichiesta(msg);
  if (risposta) scrivi(risposta);
}
