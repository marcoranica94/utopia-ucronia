# Stato S0 — 11 novembre 2026

S0 è avviato. La parte locale è implementata; lo sprint **non è chiuso** finché non riescono deploy privato, backup R2, verifica nel browser e demo da telefono.

## Risultati locali

- 11 file recuperati dalla sola Wayback: 7 HTML (un frameset tecnico), 3 immagini e 1 PDF. URL, date e hash nel manifest.
- 6 pagine di lettura generate da Markdown con metadati. La lingua francese è indicata nella selezione; le attribuzioni e la riorganizzazione editoriale restano da verificare in S2.
- Il rilancio del recupero salta tutti gli 11 file integri senza richieste di rete; Git LFS verifica correttamente i 4 binari.
- 12 test passano: gli 8 iniziali, un caso sui collegamenti vuoti lasciati da immagini mancanti e tre casi sul download da R2 (copia integra, file corrotto, percorso non sicuro).
- Build, controllo TypeScript e Biome passano. Nell’HTML generato non compaiono email o elementi attivi; 145 collegamenti e risorse sono verificati dopo la rimozione di due collegamenti vuoti individuati dal collaudo axe.
- Confronto integrale dei 6 testi riuscito: oltre 450.000 caratteri, normalizzando spazi e rimozioni dichiarate; nessuna perdita di testo, accenti, ancore o tabelle rilevata. Le immagini escluse dal campione sono conteggiate nel rapporto; i relativi link portano alla spiegazione delle lacune.
- Configurazione Wrangler accettata dal deploy simulato; nessuna pubblicazione eseguita.
- Esportazione locale di backup creata e verificata, pronta da copiare sul drive del proprietario. Non equivale ancora alla terza copia indipendente.
- Ripristino effettivo riuscito in un clone pulito: archivio del clone eliminato, 11 file ricostruiti esclusivamente dal backup, hash verificati, dipendenze reinstallate e build completa superata. La prima prova offline ha rilevato metadati pnpm non presenti in cache: la modalità offline è ora opzionale; la prova riuscita consente la rete solo per le dipendenze.
- Il ripristino supporta ora anche `--r2`: scarica manifest e oggetti in una cartella temporanea nuova e verifica gli hash prima della ricostruzione. Il percorso è verificato senza rete mediante oggetti simulati; la prova contro il bucket reale richiede ancora l’account.
- Browser: 10 pagine (9 del sito e la board), temi chiaro/scuro, larghezze 320, 390, 768 e 1440 px, testo al 200% a 390 px. Nessun debordamento, immagine non caricata o violazione axe WCAG 2 A/AA e 2.1 AA rilevata. Verificate anche ricerca, filtri, dettaglio scheda e chiusura con Esc della board. Report: `rapporti/browser-s0.json`.
- La board è ora Kanban, con schede per attività, assegnatari e dipendenze. La copia sul drive è rinviata a cura del proprietario e non blocca lo sviluppo.
- La verifica Access precedente al deploy controlla tutte le pagine di applicazioni e policy, rifiuta eccezioni pubbliche e applicazioni separate su percorsi del dominio. Cinque test dedicati coprono policy, paginazione e configurazioni insicure; il controllo sull’account reale resta da eseguire.

## Cosa ha insegnato il campione

1. La Lista è un frameset: si recupera anche il documento richiamato dal frame, evitando una pagina di lettura vuota.
2. Un form FrontPage non chiuso ingloba la home. Si eliminano i controlli e il contenitore, conservando il testo.
3. La punteggiatura automatica di Markdown modifica le fonti. È disabilitata; enfasi annidate e numerazioni manuali sono preservate.
4. I fine riga degli originali fanno parte degli hash: Git non deve normalizzarli.
5. Le ancore originali duplicate sono consolidate; i collegamenti continuano a puntare alla prima occorrenza.
6. Il PDF recuperato rimane solo nell’archivio: servire direttamente il binario non dimostrerebbe la rimozione dei dati personali e dei contenuti attivi.

## Verifiche ancora necessarie

- Autenticazione Cloudflare, applicazione Access, relativi segreti GitHub e primo deploy protetto. Nell’ambiente locale Wrangler non è autenticato.
- Creazione e sincronizzazione effettiva del bucket R2 e prova del ripristino dal bucket reale; il codice è disponibile, l’account non è autenticato in questa sessione.
- Copia effettiva sul drive: rinviata dal proprietario a sua cura, non bloccante per proseguire lo sviluppo; non è marcata come completata.
- Revisione delle attribuzioni e della riorganizzazione in S2: i nomi nel testo sono conservati, i metadati editoriali non sono automaticamente approvati dal collaudo.
- Verifica del login anonimo e demo di lettura da telefono.

Il precedente blocco dello strumento browser è stato superato dopo il cambio dei permessi della sessione. La verifica visiva nel browser è stata eseguita su screenshot desktop e mobile emulato. Non equivale a una demo su telefono fisico, né alla verifica di Access sul dominio pubblico.

I rapporti automatici si trovano in `rapporti/conversione.json` e `rapporti/confronto-campione.json`. La revisione umana non viene sovrascritta da quei rapporti generati: va registrata nella documentazione e, da S2, nella mappa editoriale persistente.
