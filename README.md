# UtopiaUcronia

Archivio storico personale e nuova edizione del sito UtopiaUcronia. Il sito è destinato al solo proprietario, dietro Cloudflare Access.

Analisi e piano: [docs/analisi.md](docs/analisi.md), [docs/piano-di-sviluppo.md](docs/piano-di-sviluppo.md). Stato della prima prova: [docs/stato-s0.md](docs/stato-s0.md).

La [board HTML](board.html) si apre direttamente nel browser, anche senza server e senza rete. Mostra sprint, attività, verifiche e prossimi passi; ricerca e filtri non modificano il piano. Dopo aver aggiornato la documentazione, eseguire `pnpm board` per rigenerarla. Le attività vengono lette dal piano; le evidenze tecniche si riferiscono al report S0 e ai rapporti locali.

## Avvio

Node 24 LTS, pnpm 12.18.0 e Git LFS. Le versioni delle dipendenze sono bloccate dal lockfile.

```sh
git lfs install --local
pnpm install --frozen-lockfile
pnpm recupero verifica
pnpm build
pnpm preview
```

La build rigenera i Markdown dai file recuperati, valida lo schema, genera il sito statico, controlla collegamenti e contenuti attivi e confronta integralmente i testi del campione con le fonti. Per sviluppare: `pnpm dev`, dopo la prima conversione. Per gli script: `pnpm test`; per tipi e stile: `pnpm exec tsc --noEmit` e `pnpm lint`.

## Contenuti

- `archivio/originale/`: file originali immutabili, **mai serviti dal sito**; nessuna conversione dei fine riga da parte di Git. Immagini e PDF sono in LFS.
- `archivio/manifest.json`: provenienza, data, dimensione e SHA-256 di ogni documento.
- `contenuti/campione.json`: selezione iniziale, con ruolo e lingua dove verificata.
- `src/content/opere/`: Markdown generati, con metadati validati; non modificare a mano.
- `contenuti/correzioni/<slug>.json`: eventuali correzioni persistenti, elenco di oggetti `{ "da": "testo esistente", "a": "testo corretto" }`. Una correzione non applicabile blocca la build.
- `rapporti/`: lacune e confronto con le fonti, inclusi gli aspetti ancora da verificare.

In S0 i documenti sono rappresentati uno per pagina, come prova di lettura. Separazione degli spunti, unione delle opere spezzate e attribuzioni strutturate arrivano in S2. Il frameset della Lista non diventa un’opera vuota: il collegamento porta al frame di testo recuperato. I PDF sono conservati ma esclusi dall’output finché non sono verificati e preparati per la consultazione.

```sh
pnpm recupero scarica --solo contenuti/campione.json --lotto 10 --pausa 30 --attesa 2
pnpm recupero verifica
```

Il recupero usa solo Wayback, una richiesta alla volta. I file già integri non si riscaricano; un originale alterato blocca l’operazione e richiede un ripristino. I comandi di scoperta completa e copertura appartengono a S1.

## Backup sul tuo drive

```sh
pnpm backup
```

Il comando crea una cartella in `backup/`, con originali e manifest, e verifica gli hash della copia. Copia **l’intera cartella stampata dal comando** sul tuo drive. Finché rimane sul computer del progetto non è un backup indipendente. Non servono accesso al drive o credenziali per sviluppare il sito.

Per verificare la copia, indica la cartella contenente `manifest.json` e `originale/`:

```sh
pnpm ripristino:prova --da /percorso/della/copia
```

La prova clona il repository locale in una cartella temporanea, elimina l’archivio del clone, ricostruisce i file esclusivamente dalla copia indicata, verifica gli hash, reinstalla le dipendenze dal lockfile ed esegue la build completa. Non modifica il progetto né il backup. La rete serve per le dipendenze, non per recuperare di nuovo i documenti. `--offline` è disponibile solo con una cache pnpm completa. Il rapporto resta in `rapporti/ripristino-*.json`.

## Configurazione Cloudflare e GitHub

Il workflow esegue test, lint, verifica dell’archivio, build e confronto anche senza credenziali Cloudflare. Il deploy è inizialmente disabilitato.

Prima di abilitarlo:

1. Creare l’applicazione Access per l’intero dominio `utopia-ucronia.marcoranica.com`, senza restrizioni di percorso, con una sola policy Allow per l’email del proprietario e nessun bypass. Sessione proposta: 30 giorni.
2. Aggiungere al repository i segreti `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `ACCESS_EMAIL_PROPRIETARIO`. Il token deve consentire anche la lettura di applicazioni e policy Access, oltre al deploy del Worker.
3. Impostare la variabile del repository `DEPLOY_ABILITATO=true`. A ogni deploy `pnpm deploy:verifica` controlla tramite API dominio e policy; se non può provarli, fallisce prima della pubblicazione.
4. Creare il bucket **privato** `utopia-ucronia-archivio`, dare al token i permessi R2 necessari e impostare `BACKUP_R2_ABILITATO=true`. `pnpm backup --r2` carica i file verificati e il manifest per ultimo; il primo caricamento e il ripristino da R2 vanno ancora collaudati.
5. Dopo il deploy verificare il login da finestra anonima e la lettura dal telefono.

`workers_dev` e `preview_urls` sono disabilitati; non esistono un Worker applicativo, SSR o database. Per controllare la configurazione senza pubblicare: `pnpm exec wrangler deploy --dry-run`.

Le pull request non eseguono deploy né backup remoti. Non inserire mai token o file `.env` nel repository.
