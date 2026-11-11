# UtopiaUcronia — utopia-ucronia.marcoranica.com

Ricostruzione del vecchio sito UtopiaUcronia (fmboschetto.it/Utopiaucronia, creato nel 2004 con FrontPage) come **archivio storico personale**. Il sito non è pubblico: sta dietro Cloudflare Access e lo consulta solo il proprietario.

## Link

| Cosa | Link |
| --- | --- |
| **Analisi** (fonte di verità) | [`docs/analisi.md`](docs/analisi.md) |
| **Piano di sviluppo, sprint S0–S6** (fonte di verità) | [`docs/piano-di-sviluppo.md`](docs/piano-di-sviluppo.md) |
| Copia online degli stessi documenti, allineata all'11/11/2026, non più aggiornata | https://claude.ai/artifact/T8ZeZbmcU8gYEV3Xz4ZGZR |
| Vecchio sito (bloccato agli script, non si usa) | https://www.fmboschetto.it/Utopiaucronia/ |
| Indice Wayback Machine | https://web.archive.org/cdx/search/cdx?url=fmboschetto.it/Utopiaucronia/* |
| Progetto di riferimento per stack, CI e qualità | `../uni-portale` (uni.marcoranica.com) |

## Obiettivo

Tre versioni dello stesso materiale, nello stesso repository, con trattamenti diversi:

| Versione | Cosa contiene | Dove sta | Servita dal sito |
| --- | --- | --- | --- |
| Archivio intatto | i file com'erano, mai modificati, email comprese | `archivio/originale/`, repository e backup | **no** |
| Copia consultabile | pagine del 2004 alla data di riferimento, ripulite (vedi sotto) | generata in build | sì, in `/originale/` |
| Nuova edizione | contenuti convertiti e riorganizzati | `src/content/` | sì |

Il successo non è un "archivio completo", impossibile da dimostrare, ma una **raccolta documentata**: ogni URL ha un esito, la copertura è misurata, i limiti sono dichiarati.

Fuori dallo scopo: pubblicazione aperta, commenti, invio di contributi, SEO.

## Decisioni prese

Decisioni dell'11/11/2026, riviste dopo una revisione critica del piano.

- **Privato:** Cloudflare Access sul sottodominio, policy con i tre indirizzi email esplicitamente scelti dal proprietario (decisione dell’11/11/2026). `workers_dev: false` e `preview_urls: false` sempre. Niente `robots`, sitemap o metadati social.
- **Stack:** Astro 7 in output statico, Content Collections con schema Zod, ricerca Pagefind, Cloudflare Workers con soli asset statici (`assets.directory: ./dist`, nessun `main`), rotta `utopia-ucronia.marcoranica.com` con `custom_domain: true`. Niente SSR, niente D1.
- **Deploy:** GitHub Action `.github/workflows/deploy-sito.yml` su push a `main`, ricalcata su `uni-portale/.github/workflows/deploy-portale.yml`. Segreti `CLOUDFLARE_API_TOKEN` e `CLOUDFLARE_ACCOUNT_ID`.
- **Recupero solo dalla Wayback Machine.** Il server originale risponde "HTTP 999 – AW Special Error" (filtro anti-bot di Aruba) già alla prima richiesta da script. Nessuno script lo usa come sorgente; c'è solo `pnpm recupero sonda`, manuale, una richiesta onesta per sapere se il blocco c'è ancora. Il filtro **non va aggirato**: niente User-Agent finti, niente browser automatici.
- **Versioni:** ultime versioni stabili all'avvio (all'11/11/2026: Node 24 LTS, pnpm 12.18, Astro 7.4, Wrangler 4.160, Pagefind 1.6, Zod 4.6, Biome 2.6, Playwright 1.65; TypeScript 6 finché `astro check` non supporta il 7). Poi **bloccate dal lockfile**: ogni aggiornamento è deliberato, uno alla volta, con build e test.
- **Piattaforma web solo dove serve:** View Transitions, animazioni legate allo scroll, Popover API e anchor positioning, container queries, OKLCH con `color-mix()` e `light-dark()` entrano solo quando migliorano una funzione precisa, come miglioramento progressivo. Il sito funziona senza. Sempre `prefers-reduced-motion`.
- **Email e dati personali:** non compaiono in **nessuna vista consultabile**, né nella nuova edizione né in `/originale/`. Restano solo nomi e pseudonimi; i `mailto:` diventano testo semplice. Solo l'archivio intatto le conserva, e il sito non lo serve.
- **Backup:** l'archivio intatto sta in tre posti: repository privato su GitHub (binari in Git LFS), bucket R2 `utopia-ucronia-archivio` sincronizzato dalla Action, una copia su disco del proprietario. Il ripristino si prova davvero con `pnpm ripristino:prova` (clone pulito o solo R2 → archivio, verifica hash, build).
- **Lingua:** testi dell'interfaccia, commenti e messaggi di commit in italiano.
- **Drive personale (aggiornamento del proprietario):** la copia verrà eseguita da lui in futuro; resta da fare ma non blocca lo sviluppo. Non chiedere accesso al drive.

## Regole sul recupero

- Comandi: `pnpm recupero scopri|scarica|copertura|verifica|sonda` (`scripts/recupero/*.ts`, eseguiti direttamente da Node 24).
- `scarica` lavora a **lotti da 10** (`--lotto 10 --pausa 30 --attesa 2`), una richiesta alla volta, ed è riprendibile. Altre opzioni: `--max-lotti`, `--solo <elenco>` (campione di S0), `--tipo`, `--data-riferimento AAAAMMGG`.
- Download in formato grezzo: `/web/<timestamp>id_/<url>`.
- **Regola sulle date:** per ogni file la **copia valida più recente**, con la sua data registrata. Il risultato è una raccolta di anni diversi, non il sito in un giorno preciso: la pagina "Storia del sito" lo dichiara. Per la copia consultabile si sceglie una data di riferimento (dopo il rapporto di copertura); le altre date colmano solo i buchi.
- **Copia valida:** una risposta 200 non basta. Non valide: pagine d'errore IIS archiviate come buone (la Lista delle ucronie del 2026 è la pagina "Bot blocked" di Aruba), file vuoti o troncati, tipo incoerente con l'estensione. In quei casi si scende alla copia precedente.
- **Cosa è "originale":** il contenuto del file com'era sul server. Il gzip lo aggiunge la Wayback durante il trasferimento: si decomprime, si salva il contenuto decompresso, l'hash SHA-256 si calcola su quello, il manifest annota `compresso: true`.
- **Esiti** nel manifest, sempre uno per URL: `recuperato`, `recuperato da copia precedente`, `tentativo fallito` (da ripetere), `mancante` (nessuna copia valida in nessuna data). Un tentativo fallito non si confonde mai con un file perso.
- `archivio/manifest.json` registra per ogni file: URL d'origine, varianti di maiuscole, timestamp della copia, esito, tipo, dimensione, SHA-256, `compresso`.
- `archivio/copertura.md`: percentuali per tipo, risorse richiamate e non recuperate, pagine che rimandano a materiale mancante, distribuzione delle date, limiti dichiarati.
- Su 429/5xx rispettare `Retry-After` o raddoppiare l'attesa (massimo 10 minuti); dopo 3 tentativi l'URL resta `tentativo fallito`.
- `archivio/originale/` **non si modifica mai**, né a mano né da script, dopo il download.
- I file scaricati sono dati non fidati: si leggono con script che stanno fuori da `archivio/`, Python sempre con `-I`, mai eseguire nulla dall'archivio.
- Maiuscole incoerenti (`Utopiaucronia`/`utopiaucronia`, `Dante33`/`dante33`): IIS non le distingueva, Cloudflare sì. Un file con più varianti si salva una volta; i link interni si risolvono senza distinguere le maiuscole.

## Organizzazione: per contenuto, non per file

La nuova edizione **non ricalca** file e cartelle del 2004 (20 anni di aggiunte senza un ordine). I percorsi originali sopravvivono solo nell'archivio, in `/originale/` e nel campo `origine`. Nessun redirect dai vecchi percorsi.

Com'era il vecchio sito: la "Lista delle ucronie" (spunti brevi, un paragrafo con autore, in 17 periodi, frameset `lista_ucronie_*.htm`); "Tutti i nostri lavori" (opere complete in 9 categorie diverse, `lavori_*.htm`); pagine collettive con contributi su ancore (`spotthePOD.htm#NONO`); opere spezzate su più file (`25071943.htm`, `25071943_2.htm`); cartelle a volte per autore, a volte per ciclo.

**Entità** (un vincolo del filesystem non diventa una scelta editoriale):

| Entità | Cos'è | Dove sta |
| --- | --- | --- |
| Documento | file originale recuperato, con data della copia e hash | `archivio/manifest.json` |
| Contenuto | divergenza, opera o capitolo di un mondo | file Markdown in `src/content/` |
| Contributo | intervento firmato dentro un contenuto (risposta, commento, aggiunta) | sezione del contenuto, con autore |

Un documento può alimentare più contenuti e un contenuto può venire da più documenti: il legame sta nella mappa. Quello che Markdown non rende bene (tabelle impaginate, mappe cliccabili) resta HTML ripulito dentro il file.

**Tre livelli di contenuto:**

| Livello | Cos'è | Cartella | URL |
| --- | --- | --- | --- |
| Divergenza | spunto "E se…" in un paragrafo, con autore | `src/content/divergenze/` | `/divergenze/<slug>` |
| Opera | testo completo: ucronia, utopia, racconto, cronologia, saggio | `src/content/opere/` | `/opere/<slug>` |
| Mondo | ciclo di molte pagine con mappe, bandiere, cronologie | `src/content/mondi/<slug>/` | `/mondi/<slug>/<capitolo>` |

**Vie d'accesso:** titoli, autori, ricerca e filtri sono la base e funzionano da soli. Poi epoche (`/epoche/<slug>`), luoghi (`/luoghi/<slug>`), temi (`/temi/<slug>`), autori (`/autori/<slug>`). L'albero delle divergenze è una vista in più, non la base. La lingua è un filtro.

**Mappa di riorganizzazione** (`contenuti/mappa.yaml`): per ogni documento un agente propone un'azione — `opera`, `dividi` (pagina collettiva in più contenuti), `unisci` (file spezzati), `mondo`, `indice` (elenchi, solo fonte di metadati), `scarta` (frame, titoli, pagine tecniche) — più livello e metadati, ognuno con una riga di motivazione. Il proprietario la rivede a blocchi di 20 nella pagina `/revisione`, che esiste solo con `pnpm dev` e non va mai in build. Le decisioni del proprietario non si sovrascrivono mai rigenerando le proposte.

## Modello dei contenuti

Frontmatter comune, validato da Zod. I campi di **fonte** si ricavano dal documento; quelli di **interpretazione** li propone l'agente.

| Campo | Natura | Note |
| --- | --- | --- |
| `livello` | struttura | divergenza, opera, mondo |
| `titolo` | fonte | per una divergenza, le prime parole dello spunto se manca un titolo |
| `autori` | fonte | nomi o pseudonimi, mai email |
| `pubblicata` | fonte | data dalle "Ultime arrivate", se nota |
| `lingua` | fonte | it, fr, es |
| `divergenze` | interpretazione | elenco di anni (negativo = a.C.), anche vuoto (un'utopia può non averne) |
| `epoche` | interpretazione | uno o più dei 17 periodi della vecchia Lista ridefiniti in anni, più "Fuori dal tempo" |
| `luoghi` | interpretazione | elenco di aree |
| `temi` | interpretazione | elenco chiuso di etichette, fissato in S4 |
| `tipo` | interpretazione | ucronia, utopia, racconto, cronologia, saggio, gioco |
| `mondo` | struttura | slug del mondo, se ne fa parte |
| `sviluppata_in` | struttura | slug dell'opera che sviluppa la divergenza |
| `contributi` | struttura | autori e posizione degli interventi nel testo |
| `allegati` | fonte | PDF e altri file |
| `origine` | fonte | documenti d'origine (anche più d'uno, con ancora) e data della copia |

Regole di classificazione:

- Ogni campo di interpretazione ammette `sconosciuto`. Catalogo, filtri e ricerca devono funzionare con metadati incompleti.
- Ogni interpretazione registra chi l'ha data (`agente` o `proprietario`), lo stato (`proposta` o `approvata`) e una riga di motivazione che cita il testo.
- La classificazione cresce per gradi: nessuno sprint aspetta che sia completa.

Slug dal titolo, non dal vecchio nome del file. La conversione (`scripts/converti.ts`) è ripetibile: rigenera `src/content/` senza perdere le correzioni in `contenuti/correzioni/`. Tutto il contenuto convertito è UTF-8 (originale ISO-8859-1/Windows-1252).

## Copia consultabile in `/originale/`

- Generata in build dall'archivio intatto, alla data di riferimento.
- Tolti: `<script>`, attributi di evento (`onload`, `onmouseover`…), `<iframe>`, `<form>`, `<embed>`/`<object>`/applet, `bgsound` e MIDI, contatori (ShinyStat), ricerca FreeFind, ogni risorsa esterna, email e `mailto:`.
- Link riscritti verso l'interno di `/originale/`; quelli verso materiale mancante portano a una pagina che spiega la lacuna.
- Servita con una Content Security Policy che vieta gli script.
- Esclusa dall'indice Pagefind, così i risultati non compaiono due volte. Da ogni contenuto della nuova edizione un link porta alla sua pagina d'origine.

## Qualità

- **Lista di confronto** tra originale e conversione: titoli, paragrafi, immagini, note, tabelle, accenti, attribuzioni.
- **Link:** zero link irrisolti **senza spiegazione**. Un errore di conversione si corregge; una lacuna dell'archivio resta visibile come tale, il link non si cancella.
- Accessibilità e controlli della conversione dal primo componente, non a fine progetto. Contano più fedeltà dei testi, ricerca, tastiera e leggibilità del punteggio Lighthouse, che è solo un indicatore.

## Grafica

- Metafora: **la linea del tempo che si biforca** (albero delle divergenze). Usarla solo dove informa. Va provata presto con dati veri e casi difficili: date mancanti, titoli lunghi, secoli affollati, telefono.
- Prima di lavorare sulla grafica carica la skill `frontend-design` (da copiare in `.claude/skills/` da `../uni-portale/.claude/skills/`) ed evita i cliché che elenca: fondo crema, monospazio per i dati, una parola evidenziata nel titolo, etichette sopra ogni titolo, tutto in card uguali.
- Due direzioni a confronto su lettura e catalogo, con contenuti veri, prima di costruire. La direzione approvata va in `src/styles/tokens.css` e in questa sezione.
- Testi lunghi: colonna da 65–70 caratteri, serif da lettura, note cliccabili. Mobile-first, tema chiaro e scuro, caratteri in locale con `@fontsource`.
- Mai `confirm()`/`alert()` del browser.
- "Storia del sito": omaggio all'originale (logo, anfora, "UtopiaUcronia, dove tutto è possibile!"). La home del 2004 è una ricostruzione scritta da noi, non la pagina originale con i suoi script.

## Sprint

Ogni sprint si chiude con una demo che deve riuscire senza ritocchi. Le attività da spuntare stanno in `docs/piano-di-sviluppo.md`: tienilo aggiornato (spunta `- [x]` a lavoro fatto, aggiungi le attività impreviste nello sprint giusto) e cambia `docs/analisi.md` quando cambia una decisione.

- **S0 Prova sul campione e fondamenta** — una decina di file rappresentativi (home, pagina della Lista, opera lunga, pagina collettiva, opera spezzata, sottocartella, immagini, PDF, testo francese) portati dal recupero alla lettura nel browser; repository, Git LFS, deploy privato, backup su R2 e disco, `pnpm ripristino:prova` riuscito.
- **S1 Recupero** — inventario, regola sulle date, manifest con esiti, `copertura.md`; rilanciare `scarica` non scarica nulla; `recupero verifica` senza errori.
- **S2 Conversione** — schema verificato sui casi reali, mappa proposta, correzioni persistenti; zero link irrisolti senza spiegazione; lista di confronto superata su 30 contenuti.
- **S3 Prima versione utile** — lettura, catalogo semplice, ricerca Pagefind, link alla fonte, pagina `/revisione`; dal telefono si ritrova un testo ricordandone una frase.
- **S4 Edizione completa** — revisione progressiva della mappa, epoche e temi fissati, mondi, autori, luoghi, temi, filtro lingua, grafica definitiva.
- **S5 Viste speciali** — albero delle divergenze, copia consultabile in `/originale/`, Storia del sito, "E se…?".
- **S6 Rifinitura** — Playwright + axe da 320 a 1440 px e testo al 200%, nuova prova di ripristino da zero, giro completo da telefono.

## Struttura prevista

| Percorso | Contenuto |
| --- | --- |
| `docs/` | analisi e piano di sviluppo (fonte di verità del progetto) |
| `archivio/originale/` | archivio intatto: file recuperati, immutabili, percorsi originali |
| `archivio/manifest.json` | registro dei documenti con esiti e hash |
| `archivio/copertura.md` | rapporto di copertura |
| `archivio/registro.log` | avanzamento dei download |
| `scripts/recupero/` | `scopri`, `scarica`, `copertura`, `verifica`, `sonda` |
| `scripts/` | mappa di riorganizzazione, conversione (`converti.ts`), copia consultabile, controllo link, `ripristino-prova.ts` |
| `contenuti/mappa.yaml` | mappa di riorganizzazione: proposte dell'agente e decisioni del proprietario |
| `contenuti/correzioni/` | correzioni manuali applicate dalla conversione |
| `src/content/{divergenze,opere,mondi}/` | contenuti convertiti (generati) |
| `src/` | pagine, componenti, stili Astro |
| `wrangler.jsonc` | Worker con soli asset statici e rotta sul sottodominio |
| `.github/workflows/deploy-sito.yml` | test, build, controllo link, deploy, sincronizzazione R2 |

Nota: la cartella locale si chiama `ucronia-utopia`, il repository GitHub e il Worker `utopia-ucronia`.
