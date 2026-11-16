// Caricato da `npm test` (--import) in ogni processo di test: il Keychain OS non esiste in CI (Linux senza
// secret service) e in locale non va toccato, quindi keytar diventa un archivio in memoria con la stessa semantica.
import keytar from 'keytar';

const segreti = new Map();
const chiave = (servizio, account) => `${servizio}\u0000${account}`;
keytar.getPassword = async (servizio, account) => segreti.get(chiave(servizio, account)) ?? null;
keytar.setPassword = async (servizio, account, valore) => { segreti.set(chiave(servizio, account), valore); };
keytar.deletePassword = async (servizio, account) => segreti.delete(chiave(servizio, account));
