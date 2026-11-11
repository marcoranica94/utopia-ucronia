# Stato S0 — 11 novembre 2026

S0 è avviato. La parte locale è implementata; lo sprint **non è chiuso** finché non riescono deploy privato, backup R2, verifica nel browser e demo da telefono.

## Risultati locali

- 11 file recuperati dalla sola Wayback: 7 HTML (un frameset tecnico), 3 immagini e 1 PDF. URL, date e hash nel manifest.
- 6 pagine di lettura generate da Markdown con metadati. La lingua francese è indicata nella selezione; le attribuzioni e la riorganizzazione editoriale restano da verificare in S2.
- Il rilancio del recupero salta tutti gli 11 file integri senza richieste di rete; Git LFS verifica correttamente i 4 binari.
- 8 test passano: gzip senza intestazione, errori archiviati come 200, file troncati, percorsi, Retry-After, corruzione, codifica, pulizia e form FrontPage non chiusi.
- Build, controllo TypeScript e Biome passano. Nell’HTML generato non compaiono email o elementi attivi; 147 collegamenti e risorse sono verificati.
- Confronto integrale dei 6 testi riuscito: oltre 450.000 caratteri, normalizzando spazi e rimozioni dichiarate; nessuna perdita di testo, accenti, ancore o tabelle rilevata. Le immagini escluse dal campione sono conteggiate nel rapporto; i relativi link portano alla spiegazione delle lacune.
- Configurazione Wrangler accettata dal deploy simulato; nessuna pubblicazione eseguita.
- Esportazione locale di backup creata e verificata, pronta da copiare sul drive del proprietario. Non equivale ancora alla terza copia indipendente.
- Ripristino effettivo riuscito in un clone pulito: archivio del clone eliminato, 11 file ricostruiti esclusivamente dal backup, hash verificati, dipendenze reinstallate e build completa superata. La prima prova offline ha rilevato metadati pnpm non presenti in cache: la modalità offline è ora opzionale; la prova riuscita consente la rete solo per le dipendenze.

## Cosa ha insegnato il campione

1. La Lista è un frameset: si recupera anche il documento richiamato dal frame, evitando una pagina di lettura vuota.
2. Un form FrontPage non chiuso ingloba la home. Si eliminano i controlli e il contenitore, conservando il testo.
3. La punteggiatura automatica di Markdown modifica le fonti. È disabilitata; enfasi annidate e numerazioni manuali sono preservate.
4. I fine riga degli originali fanno parte degli hash: Git non deve normalizzarli.
5. Le ancore originali duplicate sono consolidate; i collegamenti continuano a puntare alla prima occorrenza.
6. Il PDF recuperato rimane solo nell’archivio: servire direttamente il binario non dimostrerebbe la rimozione dei dati personali e dei contenuti attivi.

## Verifiche ancora necessarie

- Autenticazione Cloudflare, applicazione Access, relativi segreti GitHub e primo deploy protetto. Nell’ambiente locale Wrangler non è autenticato.
- Creazione e sincronizzazione effettiva del bucket R2 e prova di ripristino da quella sorgente. S0 implementa la prova da cartella di backup; il download da R2 non è ancora implementato.
- Copia effettiva sul drive del proprietario.
- Confronto visivo, mobile e desktop, con controllo di immagini, note e attribuzioni. Il confronto automatico non approva le decisioni editoriali.
- Verifica del login anonimo e demo di lettura da telefono.

Lo strumento browser ha rifiutato l’avvio perché richiede un’approvazione non disponibile in questa sessione. L’anteprima ha risposto HTTP 200, ma non è stata ispezionata visivamente.

I rapporti automatici si trovano in `rapporti/conversione.json` e `rapporti/confronto-campione.json`. La revisione umana non viene sovrascritta da quei rapporti generati: va registrata nella documentazione e, da S2, nella mappa editoriale persistente.
