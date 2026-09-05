# Security Policy

## Versioni supportate

| Versione | Supportata |
| --- | --- |
| `main` / ultima release | ✅ |
| Versioni precedenti | ❌ |

Nessun impegno a rilasciare fix retroattivi su versioni precedenti a quella corrente.

## Come segnalare una vulnerabilità

**Non aprire una issue pubblica** per una vulnerabilità di sicurezza.

Canale preferito: [GitHub Security Advisories](https://github.com/priore/foglifatture/security/advisories/new) (privato finché non risolto).

In alternativa, contattare direttamente l'autore via email (vedi profilo GitHub [@priore](https://github.com/priore)).

Includere, se possibile: passi per riprodurre, versione/commit interessato, impatto stimato.

## Tempistiche

Risposta indicativa entro 7-14 giorni. Progetto mantenuto da una sola persona: nessun SLA vincolante, ma le segnalazioni vengono prese sul serio e prioritizzate rispetto ad altro lavoro.

## Cosa non è coperto dal modello di sicurezza

Questo progetto è pensato per esecuzione **locale, single-user**:

- Non è progettato per essere esposto direttamente su internet pubblico senza reverse proxy e autenticazione aggiuntiva a cura di chi lo installa.
- Le credenziali (`.env`, API key, OAuth secret) sono responsabilità di chi le configura: non vengono mai distribuite né incluse nel repository.
- Nessuna garanzia di sicurezza se la porta del backend (default `1969`) viene esposta direttamente su rete pubblica senza protezioni aggiuntive.

## Dipendenze di terze parti

Vulnerabilità in una libreria di cui il progetto dipende vanno segnalate a monte, al repository della libreria stessa (o verificate con `npm audit`), non qui.

## Nessuna garanzia

Il software è distribuito così com'è, senza garanzie esplicite o implicite — vedi [LICENSE](LICENSE).
