/**
 * Interface strings. The site interface is bilingual: Italian at the root,
 * English under /en/. The stories themselves always stay in their original
 * language (Italian, French, Spanish) and are never translated.
 */
export const languages = ["it", "en"] as const;
export type Lang = (typeof languages)[number];

const it = {
  "source.originalHeading": "Intestazione originale",
  "review.fullSource": "Leggi la fonte integrale",
  "review.sourceReferences": "Rimandi presenti nella fonte",
  "review.sourceNote":
    "Testo della fonte recuperata per la revisione. La struttura grafica originale non è riprodotta; approvazioni e selezioni di pubblicazione restano separate.",
  "library.nav": "Leggi",
  "library.title": "Opere da leggere",
  "library.intro":
    "Apri un’opera e leggi il testo, con immagini, note e contributi. Qui trovi le opere già disponibili nella nuova edizione.",
  "library.choose": "Scegli un’opera",
  "library.scope":
    "Gli spunti brevi e le anteprime storiche restano nella raccolta della home. Per le opere ancora da pubblicare, consulta l’indice storico.",
  "library.historical": "Indice storico di tutte le opere",
  "authors.title": "Autori e contributori",
  "authors.nav": "Autori",
  "authors.intro":
    "Ritrova una firma e segui le sue opere, gli spunti e gli interventi nelle storie collettive.",
  "authors.scope":
    "Sono elencate le firme presenti nei testi già pubblicati. I nomi e gli pseudonimi conservano le forme riportate nelle fonti; eventuali varianti restano separate.",
  "authors.authorIntro":
    "Opere, spunti e contributi attribuiti a questa firma nei testi già disponibili.",
  "authors.letters": "Vai a una lettera",
  "authors.oneText": "1 testo",
  "authors.texts": "{n} testi",
  "authors.back": "Tutti gli autori e contributori",
  "authors.works": "Opere",
  "authors.prompts": "Spunti",
  "authors.contributions": "Contributi nelle opere collettive",
  "authors.signed": "Vai agli interventi firmati:",
  "authors.contribution": "Intervento {n}",
  "authors.contributionIn": "Intervento {n} in {title}",
  "authors.by": "di",
  "authors.otherVoices": "Altre firme in questo testo ({n})",

  "search.nav": "Cerca",
  "review.stateLabel": "Stato della revisione",
  "review.actionLabel": "Tipo di proposta",
  "search.title": "Cerca nei testi",
  "search.intro":
    "Cerca una frase, un nome o un luogo nelle opere già pubblicate. La ricerca include tutte le lingue originali.",
  "search.label": "Parole da cercare",
  "search.hint": "Scrivi per cercare. Usa le virgolette per una frase esatta.",
  "search.loading": "Ricerca in corso…",
  "search.empty":
    "Nessun risultato. Prova meno parole o cambia il filtro della lingua.",
  "search.error":
    "Ricerca non disponibile. Riprova con il pulsante oppure consulta il catalogo.",
  "search.retry": "Riprova",
  "search.count": "{count} opere",
  "search.one": "1 opera",
  "search.more": "Mostra altri risultati",
  "search.allLanguages": "Tutte le lingue dei testi",
  "search.language": "Lingua del testo",
  "search.nojs":
    "Attiva JavaScript per cercare nel testo oppure consulta il catalogo e gli indici per periodo.",
  "search.source": "Apri la fonte",
  "search.scope":
    "Ricerca nelle {count} edizioni di lettura e nei {prompts} spunti della Lista, che si aprono alla loro riga nell'indice per periodo.",
  "facet.eras.title": "Epoche",
  "facet.places.title": "Luoghi",
  "facet.themes.title": "Temi",
  "facet.eras.intro":
    "Le opere per epoca del punto di divergenza. Le epoche sono le sezioni della vecchia Lista delle ucronie, ridefinite come intervalli di anni, più «Fuori dal tempo».",
  "facet.places.intro":
    "Le opere per area geografica in cui si svolgono o che cambiano.",
  "facet.themes.intro": "Le opere per argomento ricorrente.",
  "facet.proposalNote":
    "Le assegnazioni sono proposte automatiche, ciascuna motivata da una frase o da termini del testo: vanno ancora rivedute. Un'opera può comparire in più voci.",
  "facet.approved": "Assegnazioni approvate",
  "facet.proposed": "Proposte da rivedere",
  "facet.count": "{n} testi",
  "facet.one": "1 testo",
  "facet.none": "Nessun testo assegnato per ora.",
  "facet.back": "Tutte le voci",
  "facet.explore": "Esplora per epoca, luogo e tema",
  "facet.workLabel": "Classificazione proposta",
  "worlds.title": "Mondi e cicli",
  "worlds.intro":
    "Storie alternative raccontate in molti capitoli e serie di opere che il sito originale raccoglieva sotto un titolo comune. I capitoli restano opere a sé: qui sono messi in fila nell'ordine della fonte.",
  "worlds.note":
    "Mondi e cicli sono proposte automatiche, ricavate dal sommario o dal titolo comune delle pagine originali: vanno ancora riveduti.",
  "worlds.form.world": "Mondo",
  "worlds.form.cycle": "Ciclo",
  "worlds.group.world": "Mondi",
  "worlds.group.cycle": "Cicli",
  "worlds.formIntro.world":
    "Una sola storia alternativa, nei capitoli elencati dal suo sommario originale.",
  "worlds.formIntro.cycle":
    "Opere separate che il sito originale collegava tra loro sotto questo titolo.",
  "worlds.count.world": "{n} capitoli",
  "worlds.count.cycle": "{n} opere",
  "worlds.back": "Tutti i mondi e i cicli",
  "worlds.chapters.world": "Capitoli",
  "worlds.chapters.cycle": "Opere del ciclo",
  "worlds.state.proposed": "Proposta da rivedere",
  "worlds.state.approved": "Approvato",
  "worlds.state.deferred": "Rinviato",
  "worlds.evidence": "Nella fonte",
  "worlds.partOf.world": "Capitolo {n} di {total} del mondo",
  "worlds.partOf.cycle": "Opera {n} di {total} del ciclo",
  "worlds.previous": "Precedente",
  "worlds.next": "Successivo",
  "worlds.nav": "Navigazione nel mondo",
  "worlds.navEnd": "Navigazione nel mondo, fine del testo",
  "search.kind": "Cerca in",
  "search.kind.all": "Opere e spunti",
  "search.kind.work": "Solo opere",
  "search.kind.prompt": "Solo spunti della Lista",
  "search.promptIn": "Spunto · {period}",
  "search.promptPages": "spunti in {count} pagine dei periodi",
  "browse.searchPrompts": "Cerca negli spunti",
  "source.title": "Fonte e provenienza",
  "source.open": "Apri fonte e provenienza",
  "source.pdf":
    "Testo ricavato dal file originale {file}: il file non è servito dal sito.",
  "source.intro":
    "Testo della fonte recuperata, mostrato senza codice attivo e senza indirizzi email.",
  "source.original": "Indirizzo della fonte",
  "source.captured": "Data della copia",
  "source.origin": "Recuperato dal server originale",
  "source.hash": "Impronta SHA-256",
  "source.format": "Formato",
  "source.editions": "Edizioni che usano questa fonte",
  "source.text": "Testo della fonte",
  "source.resources": "Rimandi non disponibili in lettura",
  "source.notes": "Note, collegamenti e allegati",
  "source.resourcesHint":
    "I rimandi aprono una scheda che distingue i file recuperati, quelli mancanti e i riferimenti esterni. Nessun file originale viene eseguito.",
  "source.recovered":
    "File recuperato; pubblicazione in lettura ancora da completare.",
  "source.missing": "File non recuperato o non presente nell’inventario.",
  "review.title": "Revisione della mappa",
  "review.loading": "Caricamento delle proposte…",
  "review.intro":
    "Solo sviluppo locale. Valuta una proposta alla volta: approvare l’organizzazione non approva automaticamente le classificazioni e non pubblica nuovi testi.",
  "review.next": "Blocco successivo",
  "review.previous": "Blocco precedente",
  "review.reason": "Motivo della decisione",
  "review.approve": "Approva questa proposta",
  "review.defer": "Rimanda questa proposta",
  "review.saved": "Decisione salvata su disco.",
  "review.conflict":
    "La mappa o le decisioni sono cambiate. Ricarica prima di salvare.",
  "review.error":
    "Salvataggio non riuscito. Riprova; la decisione non è stata confermata.",
  "review.source": "Estratto originale",
  "review.proposal": "Proposta e motivazione",
  "review.metadata": "Metadati proposti (non approvati)",
  "review.pending": "Da revisionare",
  "review.all": "Tutte le proposte",
  "review.approved": "Approvate",
  "review.deferred": "Rimandate",
  "review.reload": "Ricarica",
  "review.empty": "Nessuna proposta in questo filtro.",
  "review.batch": "Proposte {start}–{end} di {total} · blocchi di 20",
  "review.local":
    "Le decisioni richiedono un motivo e restano nel progetto anche dopo una rigenerazione della mappa.",

  "browse.pageOf": "Pagina {page} di {pages}",
  "browse.rowsPerPage": "Voci per pagina",
  "browse.goToPage": "Vai alla pagina",
  "browse.apply": "Applica",
  "browse.go": "Vai",
  "browse.onThisPage": "Titoli in questa pagina",
  "browse.titleAuthor": "Titolo e autore",
  "browse.promptColumn": "Spunto",
  "browse.linksColumn": "Sviluppi e disponibilità",
  "browse.closePrompt": "Richiudi lo spunto",

  "browse.otherReferences": "Altri riferimenti citati",
  "site.nav.prompts": "Spunti",
  "site.nav.completeWorks": "Indice opere",
  "browse.indexes": "Indici della raccolta",
  "browse.prompts.short": "Spunti per periodo",
  "browse.works.short": "Opere per periodo",
  "browse.prompts.title": "Lista delle ucronie",
  "browse.works.title": "Tutti i nostri lavori",
  "browse.prompts.intro":
    "Gli spunti del sito originale, dalla preistoria al futuro. Ogni idea conserva il suo testo, gli autori indicati e i rimandi agli sviluppi e alle discussioni.",
  "browse.works.intro":
    "Le opere segnalate nel catalogo originale, ordinate per epoca. Fantastorie, utopie e racconti hanno anche le loro sezioni, oltre i confini della cronologia.",
  "browse.prompts.count": "{n} voci nelle {groups} sezioni del menu originale.",
  "browse.works.count":
    "{n} voci nelle {groups} categorie del catalogo originale.",
  "browse.linkedCount": "{n} spunti rimandano a opere o discussioni.",
  "browse.prompts.choose": "Da quale periodo vuoi partire?",
  "browse.works.choose": "Epoche e altre storie",
  "browse.prompts.entries": "{n} spunti",
  "browse.works.entries": "{n} voci",
  "browse.historical": "Altre liste conservate",
  "browse.historicalShort": "Lista storica",
  "browse.historicalNote":
    "È conservata anche una precedente lista dell’età moderna, dalla copia del 2013. Può contenere varianti di spunti presenti nelle sezioni più recenti.",
  "browse.availability": "Dall’idea alla lettura",
  "browse.availabilityNote":
    "“Leggibile qui” apre il testo nella nuova edizione. “In archivio” indica un file recuperato che attende la preparazione per la lettura. Le fonti mancanti e i riferimenti esterni hanno una scheda distinta.",
  "browse.noLinkNote":
    "L’assenza di un rimando significa che la fonte non ne indica uno: non dimostra che lo spunto non sia mai stato sviluppato.",
  "browse.toWorks": "Esplora le opere complete per periodo",
  "browse.toPrompts": "Esplora gli spunti per periodo",
  "browse.periodNavigation": "Cambia periodo o categoria",
  "browse.prompts.back": "← Tutti i periodi della Lista",
  "browse.works.back": "← Tutte le categorie delle opere",
  "browse.prompts.periodIntro":
    "Spunti nell’ordine della lista originale. Apri il testo completo o segui i rimandi agli sviluppi.",
  "browse.works.periodIntro":
    "Opere nell’ordine del catalogo originale. Ogni voce indica dove puoi leggerla e quali materiali sono conservati.",
  "browse.range": "Voci {start}–{end} di {total}",
  "browse.pagination": "Pagine dell’elenco",
  "browse.page": "Pagina {n}",
  "browse.previous": "← Precedente",
  "browse.next": "Successiva →",
  "browse.by": "di {names}",
  "browse.readPrompt": "Leggi lo spunto completo",
  "browse.filterTitle": "Filtra tutto il periodo",
  "browse.search": "Cerca nel titolo e nel testo",
  "browse.author": "Autore",
  "browse.allAuthors": "Tutti gli autori",
  "browse.filterAvailability": "Disponibilità",
  "browse.allAvailability": "Tutte le disponibilità",
  "browse.development": "Sviluppo dello spunto",
  "browse.allDevelopment": "Tutti gli spunti",
  "browse.documented": "Sviluppo documentato",
  "browse.related": "Altri rimandi, senza sviluppo documentato",
  "browse.unlinked": "Senza rimandi a sviluppi",
  "browse.filterHint":
    "Sviluppo documentato: testo disponibile collegato come opera nel catalogo o indicato dalla fonte come svolgimento. I soli schemi, commenti e discussioni sono esclusi. L’assenza di un rimando non prova che lo spunto non sia stato sviluppato.",
  "browse.reset": "Azzera filtri",
  "browse.loading": "Caricamento dei risultati dell’intero periodo…",
  "browse.filterError":
    "Impossibile caricare i filtri. Riprova oppure azzera i filtri.",
  "browse.noResults": "Nessun risultato. Cambia o azzera i filtri.",
  "browse.popup": "Leggi in popup",
  "browse.close": "Chiudi",

  "browse.readEdition": "Apri lo spunto nella nuova edizione",
  "browse.developments": "Sviluppi e discussioni nella fonte",
  "browse.noDevelopment": "Nessuno sviluppo collegato nella fonte.",
  "browse.readWork": "Leggi l’opera",
  "browse.viewRecord": "Apri la scheda",
  "browse.status.ready": "Leggibile qui",
  "browse.status.recovered": "In archivio",
  "browse.status.missing": "Fonte non recuperata",
  "browse.status.external": "Riferimento esterno",
  "browse.record.ready": "Il testo è già disponibile nella nuova edizione.",
  "browse.record.recovered":
    "Questa opera è citata nella fonte e il file del collegamento è conservato nell’archivio. La sua versione di lettura non è ancora disponibile qui.",
  "browse.record.missing":
    "La fonte cita questa opera, ma il file del collegamento non è stato recuperato. Questo non significa che l’opera non sia stata scritta.",
  "browse.record.external":
    "La fonte rimanda a un sito esterno. Il collegamento è conservato come riferimento; il testo non fa parte della copia di lettura disponibile qui.",
  "browse.fragmentMissingShort": "Sezione citata non ritrovata",
  "browse.fragmentMissing":
    "Il file è conservato, ma la specifica sezione indicata dal collegamento non è stata ritrovata nella copia recuperata.",
  "browse.openOriginal": "Apri sul sito originale",
  "browse.openExternal": "Visita il riferimento esterno",
  "browse.inCategories": "Nel catalogo",
  "browse.relatedPrompts": "Spunti collegati",
  "browse.source": "Riferimento nella fonte",
  "browse.capture": "Copia conservata del {date}",
  "browse.format": "Formato della fonte: {format}",
  "browse.sourceGrouping": "Raggruppamento e ordine dalla pagina originale:",
  "browse.homeIntro": "Cerchi tutte le idee o le opere per epoca?",

  "source.image": "Immagine dal documento originale",
  "source.pdfImage": "Illustrazione dal PDF, pagina {n}",
  "atlas.type.divergence": "Spunti",
  "shape.divergence": "Spunto di divergenza",
  "lang.en": "Inglese",
  "lang.unknown": "Lingua da verificare",
  "work.language.en": "Testo in inglese.",
  "work.language.unknown": "Lingua da verificare.",
  "gaps.reason.archive-missing":
    "Il file non è stato recuperato: la lacuna è registrata nell’archivio.",
  "gaps.reason.edition-pending":
    "Il documento è stato recuperato, ma non è ancora incluso in questa edizione.",
  "gaps.reason.attachment-pending":
    "L’allegato è conservato nell’archivio e attende la preparazione per la lettura.",
  "gaps.reason.external-excluded":
    "È una risorsa esterna, esclusa dalla copia di lettura.",
  "gaps.reason.unsupported-format":
    "Questo formato rimane conservato nell’archivio, ma non viene pubblicato dal sito.",
  "gaps.reason.unsupported-query":
    "Il collegamento contiene una richiesta dinamica che la copia statica non esegue.",
  "gaps.reason.archive-unlisted":
    "Non è disponibile un documento corrispondente nell’inventario recuperato.",
  "gaps.reason.anchor-missing":
    "La destinazione interna indicata dalla fonte non è disponibile nella conversione.",
  "gaps.resource": "Risorsa",
  "gaps.referrer": "Pagina che la cita",

  "atlas.signature": "UtopiaUcronia, dal 2004",
  "atlas.heading": "La storia ha\naltre strade.",
  "atlas.description":
    "Mappe, racconti e cronologie per esplorare ciò che sarebbe potuto accadere. Un archivio di mondi possibili, una storia alla volta.",
  "atlas.explore": "Entra nella raccolta",
  "atlas.originalSince": "Testi originali. Altri mondi.",
  "atlas.tree": "Segui le diramazioni",
  "atlas.mapAlt":
    "Mappa alternativa dell’Europa e del Mediterraneo, dal gioco Spot the POD",
  "atlas.mapPrompt": "Riconosci questo mondo?",
  "atlas.startHere": "Una mappa, molte storie",
  "atlas.collection": "Scegli la tua prossima storia",
  "atlas.collectionIntro":
    "Una divergenza, un racconto, un mondo da attraversare.",
  "atlas.view": "Vista della raccolta",
  "atlas.covers": "Copertine",
  "atlas.list": "Elenco",
  "atlas.searchPlaceholder": "Cerca un titolo, un autore o uno spunto…",
  "atlas.format": "Formato del testo",
  "atlas.type.all": "Tutti",
  "atlas.type.chronology": "Cronologie",
  "atlas.type.narrative": "Racconti",
  "atlas.type.discussion": "Proposte e discussioni",
  "atlas.type.collection": "Raccolte",
  "atlas.type.archive": "Dall’archivio",
  "atlas.type.work": "Opera",
  "atlas.collective": "Più voci, una storia",
  "atlas.fromArchive": "Dall’archivio originale",
  "atlas.variants": "{n} varianti",
  "atlas.read": "Leggi",
  "atlas.noResults": "Qui la storia prende un’altra strada.",
  "atlas.reset": "Mostra tutta la raccolta",

  "site.version": "Versione",
  "site.skip": "Vai al contenuto",
  "site.home": "UtopiaUcronia, pagina iniziale",
  "site.navLabel": "Navigazione principale",
  "site.nav.works": "Ucronie",
  "site.nav.tree": "Albero",
  "site.nav.preview": "Anteprima",
  "site.footer": "Archivio in lavorazione. Testi e attribuzioni in revisione.",
  "site.languageLabel": "Lingua dell’interfaccia",
  "theme.toggle": "Tema",
  "theme.auto": "Auto",
  "theme.light": "Chiaro",
  "theme.dark": "Scuro",
  "home.title": "Le storie possibili",
  "home.kicker": "Un archivio di storie possibili",
  "home.heading": "Storie di altri mondi",
  "home.lede":
    "UtopiaUcronia raccoglie racconti, mappe e idee di storia alternativa. Questa è la prima selezione convertita dall’archivio recuperato.",
  "home.featureTitle": "Ogni storia apre un ramo",
  "home.featureText":
    "Tre punti di partenza, molte strade possibili. L’albero guida alle prime ucronie campione.",
  "home.featureLink": "Esplora l’albero delle ucronie",
  "home.catalogTitle": "Le ucronie",
  "home.count.one": "testo disponibile",
  "home.count.many": "testi disponibili",
  "home.filters": "Filtra i documenti",
  "home.search": "Titolo o autore",
  "home.searchPlaceholder": "Es. 25 luglio",
  "home.language": "Lingua",
  "home.allLanguages": "Tutte le lingue",
  "lang.it": "Italiano",
  "lang.fr": "Francese",
  "lang.es": "Spagnolo",
  "home.gaps": "Contiene collegamenti o immagini da verificare",
  "home.recovered": "Testo recuperato",
  "home.empty":
    "Nessun documento corrisponde ai filtri. Prova un altro titolo o una lingua diversa.",
  "home.none": "I primi testi appariranno qui dopo la conversione.",
  "home.note":
    "La raccolta è in revisione: titoli, attribuzioni e collegamenti saranno controllati durante la conversione editoriale.",
  "tree.title": "Albero delle epoche",
  "tree.heading": "L’albero delle epoche",
  "tree.lede":
    "Il tronco è la storia reale, dalla preistoria al futuro. Da ogni epoca partono le opere ambientate lì: segui un ramo per leggerle.",
  "tree.yearNote":
    "L’anno accanto al titolo è il primo citato all’inizio del testo e ordina i rami; non è per forza il punto in cui la storia diverge.",
  "tree.jump": "Vai a un’epoca",
  "tree.trunk": "Epoche in ordine cronologico",
  "tree.more": "Mostra altre {n} opere",
  "tree.showAll": "Mostra l’elenco",
  "tree.outsideNote":
    "Utopie, mondi immaginari e testi che non si collocano in un’epoca storica.",
  "tree.unplaced": "Opere senza epoca",
  "tree.unplacedNote":
    "{n} opere non hanno ancora un’epoca: nel testo non c’è un anno utile e il catalogo originale non le collocava. Le altre {placed} sono sul tronco.",
  "tree.caveat":
    "Una stessa opera compare in più epoche se le attraversa. Le brevi proposte della Lista delle ucronie restano ordinate per periodo nel loro indice:",
  "tree.listaLink": "apri la Lista delle ucronie",
  "whatif.title": "E se…?",
  "whatif.heading": "E se…?",
  "whatif.lede":
    "Una storia a caso tra le {n} opere da leggere. Se non ti convince, pescane un’altra.",
  "whatif.read": "Leggi l’opera",
  "whatif.again": "Un’altra storia",
  "whatif.note": "Preferisci scegliere tu?",
  "whatif.tree": "Sfoglia l’albero delle epoche",
  "history.title": "Storia del sito",
  "history.heading": "Storia del sito",
  "history.lede":
    "UtopiaUcronia è nato il 10 novembre 2004, costruito con FrontPage, ed è cresciuto per più di vent’anni grazie a chi ci scriveva. Questa è la sua prima pagina e il racconto di come l’abbiamo ritrovato.",
  "history.reconstruction":
    "La prima pagina del sito ricostruita da noi con le immagini originali: logo, anfora, città del futuro e lo sfondo con la rosa dei venti. Non è la pagina originale e non esegue il suo codice. I collegamenti portano alle pagine corrispondenti di questo sito; i siti esterni e l’indirizzo email sono riportati solo come testo.",
  "history.thenTitle": "Com’era",
  "history.then1":
    "La pagina era viva, nello stile dei primi anni Duemila: la scritta «UtopiaUcronia, dove tutto è possibile!» inseguiva il mouse lettera per lettera, una riga scorreva tredici messaggi di benvenuto e in sottofondo suonava in MIDI «L’isola che non c’è» di Edoardo Bennato. La città del futuro si specchiava in un lago animato da un’applet Java.",
  "history.then2":
    "Completavano la pagina la ricerca FreeFind e il contatore ShinyStat. Oggi niente di tutto questo viene eseguito: script, musica, applet e servizi esterni sono stati tolti, e restano le parole e le immagini.",
  "history.notices": "I tredici messaggi che scorrevano",
  "history.recoveryTitle": "Come l’abbiamo recuperato",
  "history.found": "Indirizzi trovati",
  "history.recovered": "File recuperati",
  "history.missing": "File persi",
  "history.recovery1":
    "Il server originale blocca le richieste automatiche con un filtro anti-bot, che non abbiamo aggirato. Il recupero è partito dalle copie conservate dalla Wayback Machine di Internet Archive; nel novembre 2026, con il permesso del proprietario, i file mancanti sono stati scaricati direttamente dal server, uno alla volta.",
  "history.recovery2":
    "Gli indirizzi trovati sono {total}: ne abbiamo recuperati {recovered}, di cui {earlier} da una copia precedente perché l’ultima era danneggiata. {missing} file non esistono più in nessuna copia.",
  "history.gapsLink": "Vedi cosa manca",
  "history.recovery3":
    "Per ogni file abbiamo preso la copia valida più recente, quindi la raccolta mescola anni diversi: non è il sito com’era in un giorno preciso. I file originali sono conservati intatti e non vengono mai modificati.",
  "history.yearsCaption":
    "Anno delle copie della Wayback Machine ({wayback} file). Altri {origin} file vengono direttamente dal server originale, novembre 2026.",
  "history.nowTitle": "Cosa c’è oggi",
  "history.now1":
    "Questa nuova edizione riordina il materiale per contenuto invece che per cartelle: {works} opere da leggere con indice, autori e ricerca, e tutte le proposte brevi della Lista delle ucronie nei loro periodi.",
  "site.history": "Storia del sito",
  "site.footerNav": "Altre pagine",
  "gaps.title": "Materiale non disponibile",
  "gaps.kicker": "Archivio in lavorazione",
  "gaps.heading": "Questo materiale non è ancora disponibile",
  "gaps.text1":
    "Il collegamento può indicare una pagina non ancora convertita, una risorsa esterna esclusa o un file senza una copia valida.",
  "gaps.text2":
    "La lacuna è registrata nel rapporto di conversione; il collegamento originale resta nel file d’archivio.",
  "back.works": "← Torna alle ucronie",
  "work.kicker": "Documento recuperato",
  "work.review": "Testo in revisione editoriale.",
  "work.reviewGaps": "Alcuni collegamenti o immagini richiedono un controllo:",
  "work.reviewGapsLink": "vedi le lacune note",
  "work.provenance": "Provenienza",
  "work.captured": "Cattura del {date}",
  "work.fromOrigin": "File recuperato dal sito originale",
  "work.kept": "Il file originale resta conservato nell’archivio.",
  "work.by": "di {names}",
  "work.withOne": ", con interventi di un altro autore",
  "work.withMany": ", con interventi di altri {n} autori",
  "work.source": "Fonte: {url}",
  "work.sourceCaptured": "Fonte: {url}, cattura del {date}.",
  "work.automatic":
    "Struttura riconosciuta automaticamente dalla pagina originale: sezioni, date e tipi di intervento possono contenere errori.",
  "work.language.fr": "Testo in francese.",
  "work.language.es": "Testo in spagnolo.",
  "work.language.it": "",
  "shape.chronology": "Cronologia",
  "shape.discussion": "Proposta e discussione",
  "shape.narrative": "Racconto",
  "shape.collection": "Raccolta",
  "count.stories.one": "racconto",
  "count.stories.many": "racconti",
  "count.dates.one": "data",
  "count.dates.many": "date",
  "count.contributions.one": "intervento",
  "count.contributions.many": "interventi",
  "count.variants.one": "variante",
  "count.variants.many": "varianti",
  "reader.branches": "I rami della storia",
  "reader.redLabel": "Parole della redazione.",
  "reader.redNote":
    "Le parti evidenziate così erano in rosso nel sito originale: di solito sono la redazione che presenta la proposta e il punto da cui la storia diverge, a volte date o nomi messi in risalto.",
  "reader.branchNote":
    "Ogni ramo è un racconto o una variante. Apri gli eventi per seguirne le date, nell’ordine del testo.",
  "reader.events": "Mostra gli eventi ({n})",
  "reader.close": "Chiudi indice",
  "reader.quick": "Anni e contributori, navigazione rapida",
  "reader.contents": "Indice",
  "reader.dates": "Date nel testo",
  "reader.dateNote":
    "Eventi nell’ordine del racconto. Ogni data apre il passaggio corrispondente; gli interventi degli altri autori sono elencati separatamente.",
  "reader.main": "Il testo",
  "reader.top": "Torna su",
  "reader.tools": "Navigazione del testo",
  "reader.open": "Indice e rami della storia",
  "rail.toggle": "Indice del testo",
  "rail.label": "Struttura del testo",
  "rail.century": "{n} secolo",
  "rail.centuryBc": "{n} secolo a.C.",
  "outline.start": "Inizio",
  "outline.pod": "Punto di divergenza",
  "outline.chronology": "Cronologia",
  "outline.discussion": "Discussione",
  "outline.anonymous": "Anonimo",
  "outline.untitled": "Senza titolo",
  "part.main.discussion": "La proposta",
  "part.main.chronology": "L’ucronia",
  "part.main.narrative": "Il racconto",
  "part.main.collection": "Presentazione",
  "rail.ourHistory": "La nostra storia",
  "rail.uchronia": "Ucronia",
  "rail.sections": "Sezioni",
  "rail.voices": "Voci della discussione",
  "kind.comment": "Commento",
  "kind.addition": "Aggiunta",
  "kind.variant": "Variante",
  "kind.reply": "Risposta",
  "rail.kind.comment": "commento",
  "rail.kind.addition": "aggiunta",
  "rail.kind.variant": "variante",
  "rail.kind.reply": "risposta",
  replyTo: "in risposta a",
  earlier: "un intervento precedente",
  "discussion.note.one":
    "{n} intervento, nell’ordine in cui è apparso sul sito.",
  "discussion.note.many":
    "{n} interventi, nell’ordine in cui sono apparsi sul sito.",
  "notFound.title": "Pagina non trovata",
  "notFound.heading": "Questa pagina non è nell’archivio",
  "notFound.text":
    "Controlla l’indirizzo oppure torna alle ucronie disponibili.",
};

const en: Record<keyof typeof it, string> = {
  "source.originalHeading": "Original heading",
  "review.fullSource": "Read the full source",
  "review.sourceReferences": "References present in the source",
  "review.sourceNote":
    "Recovered source text for review. The original visual layout is not reproduced; approval and publication selection remain separate.",
  "library.nav": "Read",
  "library.title": "Works to read",
  "library.intro":
    "Open a work to read its text, with images, notes and contributions. These works are already available in the new edition.",
  "library.choose": "Choose a work",
  "library.scope":
    "Short prompts and historical previews remain in the home collection. See the historical index for works awaiting publication.",
  "library.historical": "Historical index of all works",
  "authors.title": "Authors and contributors",
  "authors.nav": "Authors",
  "authors.intro":
    "Find a signature and follow their works, prompts and contributions to collective stories.",
  "authors.scope":
    "These signatures appear in the published reading texts. Names and pseudonyms retain their source spellings; possible variants remain separate.",
  "authors.authorIntro":
    "Works, prompts and contributions credited to this signature in the available reading texts.",
  "authors.letters": "Jump to a letter",
  "authors.oneText": "1 text",
  "authors.texts": "{n} texts",
  "authors.back": "All authors and contributors",
  "authors.works": "Works",
  "authors.prompts": "Prompts",
  "authors.contributions": "Contributions to collective works",
  "authors.signed": "Go to signed contributions:",
  "authors.contribution": "Contribution {n}",
  "authors.contributionIn": "Contribution {n} in {title}",
  "authors.by": "by",
  "authors.otherVoices": "Other signatures in this text ({n})",

  "search.nav": "Search",
  "review.stateLabel": "Review state",
  "review.actionLabel": "Proposal type",
  "search.title": "Search the texts",
  "search.intro":
    "Find a sentence, a name or a place in the published reading edition, across all original languages.",
  "search.label": "Search words",
  "search.hint": "Type to search. Use quotation marks for an exact phrase.",
  "search.loading": "Searching…",
  "search.empty": "No results. Try fewer words or change the language filter.",
  "search.error":
    "Search unavailable. Retry using the button or browse the catalogue.",
  "search.retry": "Retry",
  "search.count": "{count} works",
  "search.one": "1 work",
  "search.more": "Show more results",
  "search.allLanguages": "All text languages",
  "search.language": "Text language",
  "search.nojs":
    "Enable JavaScript to search full text, or browse the catalogue and period indexes.",
  "search.source": "Open source",
  "search.scope":
    "Search the {count} reading editions and the {prompts} prompts of the Lista, which open at their row in the period index.",
  "facet.eras.title": "Eras",
  "facet.places.title": "Places",
  "facet.themes.title": "Themes",
  "facet.eras.intro":
    "Works by the era of their point of divergence. The eras are the sections of the old Lista delle ucronie, redefined as year ranges, plus “Outside time”.",
  "facet.places.intro":
    "Works by the geographic area where they take place or which they change.",
  "facet.themes.intro": "Works by recurring subject.",
  "facet.proposalNote":
    "Assignments are automatic proposals, each backed by a sentence or terms from the text, and still need review. A work can appear under several entries.",
  "facet.approved": "Approved assignments",
  "facet.proposed": "Proposals awaiting review",
  "facet.count": "{n} texts",
  "facet.one": "1 text",
  "facet.none": "No text assigned yet.",
  "facet.back": "All entries",
  "facet.explore": "Explore by era, place and theme",
  "facet.workLabel": "Proposed classification",
  "worlds.title": "Worlds and cycles",
  "worlds.intro":
    "Alternative histories told across many chapters, and series of works the original site gathered under a shared title. Chapters remain works of their own: here they are lined up in the source's order.",
  "worlds.note":
    "Worlds and cycles are automatic proposals, derived from the contents page or the shared heading of the original pages, and still need review.",
  "worlds.form.world": "World",
  "worlds.form.cycle": "Cycle",
  "worlds.group.world": "Worlds",
  "worlds.group.cycle": "Cycles",
  "worlds.formIntro.world":
    "One alternative history, in the chapters listed by its original contents page.",
  "worlds.formIntro.cycle":
    "Separate works the original site linked to one another under this title.",
  "worlds.count.world": "{n} chapters",
  "worlds.count.cycle": "{n} works",
  "worlds.back": "All worlds and cycles",
  "worlds.chapters.world": "Chapters",
  "worlds.chapters.cycle": "Works in the cycle",
  "worlds.state.proposed": "Proposal awaiting review",
  "worlds.state.approved": "Approved",
  "worlds.state.deferred": "Deferred",
  "worlds.evidence": "In the source",
  "worlds.partOf.world": "Chapter {n} of {total} in the world",
  "worlds.partOf.cycle": "Work {n} of {total} in the cycle",
  "worlds.previous": "Previous",
  "worlds.next": "Next",
  "worlds.nav": "World navigation",
  "worlds.navEnd": "World navigation, end of text",
  "search.kind": "Search in",
  "search.kind.all": "Works and prompts",
  "search.kind.work": "Works only",
  "search.kind.prompt": "Lista prompts only",
  "search.promptIn": "Prompt · {period}",
  "search.promptPages": "prompts on {count} period pages",
  "browse.searchPrompts": "Search the prompts",
  "source.title": "Source and provenance",
  "source.open": "Open source and provenance",
  "source.pdf":
    "Text taken from the original file {file}; the file itself is not served.",
  "source.intro":
    "Recovered source text, shown without active code or email addresses.",
  "source.original": "Source address",
  "source.captured": "Capture date",
  "source.origin": "Recovered from the original server",
  "source.hash": "SHA-256 fingerprint",
  "source.format": "Format",
  "source.editions": "Editions using this source",
  "source.text": "Source text",
  "source.resources": "References unavailable in the reading edition",
  "source.notes": "Notes, links and attachments",
  "source.resourcesHint":
    "References open records distinguishing recovered files, missing files and external references. Original files are never executed.",
  "source.recovered": "File recovered; reading publication remains pending.",
  "source.missing": "File not recovered or absent from the inventory.",
  "review.title": "Map review",
  "review.loading": "Loading proposals…",
  "review.intro":
    "Local development only. Review one proposal at a time: approving its organization does not approve classifications or publish new texts.",
  "review.next": "Next batch",
  "review.previous": "Previous batch",
  "review.reason": "Reason for the decision",
  "review.approve": "Approve this proposal",
  "review.defer": "Defer this proposal",
  "review.saved": "Decision saved to disk.",
  "review.conflict": "The map or decisions changed. Reload before saving.",
  "review.error": "Could not save. Retry; the decision was not confirmed.",
  "review.source": "Source excerpt",
  "review.proposal": "Proposal and reasoning",
  "review.metadata": "Proposed metadata (not approved)",
  "review.pending": "Awaiting review",
  "review.all": "All proposals",
  "review.approved": "Approved",
  "review.deferred": "Deferred",
  "review.reload": "Reload",
  "review.empty": "No proposals match this filter.",
  "review.batch": "Proposals {start}–{end} of {total} · batches of 20",
  "review.local":
    "Decisions require a reason and remain in the project after map regeneration.",

  "browse.pageOf": "Page {page} of {pages}",
  "browse.rowsPerPage": "Entries per page",
  "browse.goToPage": "Go to page",
  "browse.apply": "Apply",
  "browse.go": "Go",
  "browse.onThisPage": "Titles on this page",
  "browse.titleAuthor": "Title and author",
  "browse.promptColumn": "Prompt",
  "browse.linksColumn": "Developments and availability",
  "browse.closePrompt": "Collapse the prompt",

  "browse.otherReferences": "Other cited references",
  "site.nav.prompts": "Prompts",
  "site.nav.completeWorks": "Works index",
  "browse.indexes": "Collection indexes",
  "browse.prompts.short": "Prompts by period",
  "browse.works.short": "Works by period",
  "browse.prompts.title": "The list of alternate histories",
  "browse.works.title": "All our works",
  "browse.prompts.intro":
    "The original site’s prompts, from prehistory to the future. Each idea retains its text, credited authors and references to developments and discussions.",
  "browse.works.intro":
    "Works listed in the original catalog, arranged by period. Imaginary histories, utopias and stories also have their own sections beyond chronology.",
  "browse.prompts.count":
    "{n} entries in the original menu’s {groups} sections.",
  "browse.works.count":
    "{n} entries in the original catalog’s {groups} categories.",
  "browse.linkedCount": "{n} prompts refer to works or discussions.",
  "browse.prompts.choose": "Where in history will you start?",
  "browse.works.choose": "Periods and other stories",
  "browse.prompts.entries": "{n} prompts",
  "browse.works.entries": "{n} entries",
  "browse.historical": "Other preserved lists",
  "browse.historicalShort": "Historical list",
  "browse.historicalNote":
    "An earlier list of early modern prompts is also preserved in a 2013 capture. It may contain variants of prompts in the more recent sections.",
  "browse.availability": "From idea to reading",
  "browse.availabilityNote":
    "“Read here” opens a text in the new edition. “In the archive” means a recovered file awaits preparation for reading. Missing sources and external references have separate records.",
  "browse.noLinkNote":
    "No reference means the source does not provide one; it does not prove the prompt was never developed.",
  "browse.toWorks": "Explore complete works by period",
  "browse.toPrompts": "Explore prompts by period",
  "browse.periodNavigation": "Change period or category",
  "browse.prompts.back": "← All periods in the list",
  "browse.works.back": "← All work categories",
  "browse.prompts.periodIntro":
    "Prompts in their original order. Open the complete text or follow references to developments.",
  "browse.works.periodIntro":
    "Works in their original catalog order. Each entry shows where you can read it and which materials are preserved.",
  "browse.range": "Entries {start}–{end} of {total}",
  "browse.pagination": "List pages",
  "browse.page": "Page {n}",
  "browse.previous": "← Previous",
  "browse.next": "Next →",
  "browse.by": "by {names}",
  "browse.readPrompt": "Read the complete prompt",
  "browse.filterTitle": "Filter the whole period",
  "browse.search": "Search titles and text",
  "browse.author": "Author",
  "browse.allAuthors": "All authors",
  "browse.filterAvailability": "Availability",
  "browse.allAvailability": "All availability",
  "browse.development": "Prompt development",
  "browse.allDevelopment": "All prompts",
  "browse.documented": "Documented development",
  "browse.related": "Other links, no documented development",
  "browse.unlinked": "No development links",
  "browse.filterHint":
    "Documented development: an available text listed as a work in the catalogue or described by the source as a development. Links labelled as outlines, comments or discussions are excluded. A missing link does not prove a prompt was never developed.",
  "browse.reset": "Reset filters",
  "browse.loading": "Loading results for the whole period…",
  "browse.filterError":
    "Could not load filters. Try again or reset the filters.",
  "browse.noResults": "No results. Change or reset the filters.",
  "browse.popup": "Read in popup",
  "browse.close": "Close",

  "browse.readEdition": "Open this prompt in the new edition",
  "browse.developments":
    "Developments and discussions referenced by the source",
  "browse.noDevelopment": "No development linked in the source.",
  "browse.readWork": "Read the work",
  "browse.viewRecord": "Open the record",
  "browse.status.ready": "Read here",
  "browse.status.recovered": "In the archive",
  "browse.status.missing": "Source not recovered",
  "browse.status.external": "External reference",
  "browse.record.ready": "This text is already available in the new edition.",
  "browse.record.recovered":
    "This work is cited by the source, and the linked file is preserved in the archive. Its reading edition is not yet available here.",
  "browse.record.missing":
    "The source cites this work, but the linked file was not recovered. This does not mean the work was never written.",
  "browse.record.external":
    "The source refers to an external website. The link is retained as a reference; the text is not part of the reading edition available here.",
  "browse.fragmentMissingShort": "Referenced section not found",
  "browse.fragmentMissing":
    "The file is preserved, but the specific section referenced by the link was not found in the recovered copy.",
  "browse.openOriginal": "Open on the original site",
  "browse.openExternal": "Visit the external reference",
  "browse.inCategories": "In the catalog",
  "browse.relatedPrompts": "Related prompts",
  "browse.source": "Source reference",
  "browse.capture": "Preserved capture dated {date}",
  "browse.format": "Source format: {format}",
  "browse.sourceGrouping": "Grouping and order from the original page:",
  "browse.homeIntro": "Looking for all the ideas or works by period?",

  "source.image": "Image from the original document",
  "source.pdfImage": "PDF illustration, page {n}",
  "atlas.type.divergence": "Divergences",
  "shape.divergence": "Divergence prompt",
  "lang.en": "English",
  "lang.unknown": "Language unverified",
  "work.language.en": "Text in English.",
  "work.language.unknown": "Language not yet verified.",
  "gaps.reason.archive-missing":
    "The file was not recovered; this gap is recorded in the archive.",
  "gaps.reason.edition-pending":
    "The document was recovered but is not yet included in this edition.",
  "gaps.reason.attachment-pending":
    "The attachment is preserved in the archive and awaits preparation for reading.",
  "gaps.reason.external-excluded":
    "This external resource is excluded from the reading copy.",
  "gaps.reason.unsupported-format":
    "This format is preserved in the archive but is not published by the site.",
  "gaps.reason.unsupported-query":
    "The link contains a dynamic request that the static copy does not execute.",
  "gaps.reason.archive-unlisted":
    "No matching document is available in the recovered inventory.",
  "gaps.reason.anchor-missing":
    "The internal destination specified by the source is unavailable in the conversion.",
  "gaps.resource": "Resource",
  "gaps.referrer": "Referring source",

  "atlas.signature": "UtopiaUcronia, since 2004",
  "atlas.heading": "History has\nother paths.",
  "atlas.description":
    "Maps, stories and chronologies exploring what might have happened. An archive of possible worlds, one story at a time.",
  "atlas.explore": "Explore the collection",
  "atlas.originalSince": "Original stories. Other worlds.",
  "atlas.tree": "Follow the branches",
  "atlas.mapAlt":
    "An alternative map of Europe and the Mediterranean, from Spot the POD",
  "atlas.mapPrompt": "Do you recognise this world?",
  "atlas.startHere": "One map, many stories",
  "atlas.collection": "Choose your next story",
  "atlas.collectionIntro": "A divergence, a story, a world to explore.",
  "atlas.view": "Collection view",
  "atlas.covers": "Covers",
  "atlas.list": "List",
  "atlas.searchPlaceholder": "Find a title, an author or an idea…",
  "atlas.format": "Text format",
  "atlas.type.all": "All",
  "atlas.type.chronology": "Chronologies",
  "atlas.type.narrative": "Stories",
  "atlas.type.discussion": "Proposals and discussions",
  "atlas.type.collection": "Collections",
  "atlas.type.archive": "From the archive",
  "atlas.type.work": "Work",
  "atlas.collective": "Many voices, one story",
  "atlas.fromArchive": "From the original archive",
  "atlas.variants": "{n} variants",
  "atlas.read": "Read",
  "atlas.noResults": "No stories found here yet.",
  "atlas.reset": "Show the whole collection",

  "site.version": "Version",
  "site.skip": "Skip to content",
  "site.home": "UtopiaUcronia, home page",
  "site.navLabel": "Main navigation",
  "site.nav.works": "Uchronias",
  "site.nav.tree": "Tree",
  "site.nav.preview": "Preview",
  "site.footer": "Archive in progress. Texts and attributions under review.",
  "site.languageLabel": "Interface language",
  "theme.toggle": "Theme",
  "theme.auto": "Auto",
  "theme.light": "Light",
  "theme.dark": "Dark",
  "home.title": "Possible histories",
  "home.kicker": "An archive of possible histories",
  "home.heading": "Stories from other worlds",
  "home.lede":
    "UtopiaUcronia collects stories, maps and ideas of alternate history. This is the first selection converted from the recovered archive.",
  "home.featureTitle": "Every story opens a branch",
  "home.featureText":
    "Three starting points, many possible paths. The tree leads to the first sample uchronias.",
  "home.featureLink": "Explore the uchronia tree",
  "home.catalogTitle": "The collection",
  "home.count.one": "text available",
  "home.count.many": "texts available",
  "home.filters": "Filter the documents",
  "home.search": "Title or author",
  "home.searchPlaceholder": "E.g. 25 luglio",
  "home.language": "Language",
  "home.allLanguages": "All languages",
  "lang.it": "Italian",
  "lang.fr": "French",
  "lang.es": "Spanish",
  "home.gaps": "Contains links or images to check",
  "home.recovered": "Recovered text",
  "home.empty":
    "No document matches the filters. Try another title or a different language.",
  "home.none": "The first texts will appear here after conversion.",
  "home.note":
    "The collection is under review: titles, attributions and links will be checked during editorial conversion.",
  "tree.title": "Tree of eras",
  "tree.heading": "The tree of eras",
  "tree.lede":
    "The trunk is real history, from prehistory to the future. From each era branch the works set there: follow a branch to read them.",
  "tree.yearNote":
    "The year beside a title is the first one cited at the start of the text and orders the branches; it is not necessarily where the story diverges.",
  "tree.jump": "Go to an era",
  "tree.trunk": "Eras in chronological order",
  "tree.more": "Show {n} more works",
  "tree.showAll": "Show the list",
  "tree.outsideNote":
    "Utopias, imaginary worlds and texts that belong to no historical era.",
  "tree.unplaced": "Works without an era",
  "tree.unplacedNote":
    "{n} works have no era yet: the text cites no usable year and the original catalog did not place them. The other {placed} are on the trunk.",
  "tree.caveat":
    "A work appears in several eras if it spans them. The short prompts of the Lista delle ucronie stay ordered by period in their own index:",
  "tree.listaLink": "open the Lista delle ucronie",
  "whatif.title": "What if…?",
  "whatif.heading": "What if…?",
  "whatif.lede":
    "A random story from the {n} works you can read. If it doesn’t grab you, draw another.",
  "whatif.read": "Read the work",
  "whatif.again": "Another story",
  "whatif.note": "Rather choose yourself?",
  "whatif.tree": "Browse the tree of eras",
  "history.title": "Site history",
  "history.heading": "Site history",
  "history.lede":
    "UtopiaUcronia was born on 10 November 2004, built with FrontPage, and grew for more than twenty years thanks to the people who wrote for it. This is its first page and the story of how we found it again.",
  "history.reconstruction":
    "The site’s first page rebuilt by us with the original images: logo, amphora, city of the future and the compass-rose background. It is not the original page and runs none of its code. Links lead to the matching pages of this site; external sites and the email address appear as text only.",
  "history.thenTitle": "What it was like",
  "history.then1":
    "The page was alive, in the style of the early 2000s: the words “UtopiaUcronia, dove tutto è possibile!” chased the mouse letter by letter, a line scrolled thirteen welcome messages and Edoardo Bennato’s “L’isola che non c’è” played in MIDI in the background. The city of the future was reflected in a lake animated by a Java applet.",
  "history.then2":
    "FreeFind search and a ShinyStat counter completed the page. None of this runs today: scripts, music, applets and external services are gone, and the words and images remain.",
  "history.notices": "The thirteen scrolling messages",
  "history.recoveryTitle": "How we recovered it",
  "history.found": "Addresses found",
  "history.recovered": "Files recovered",
  "history.missing": "Missing files",
  "history.recovery1":
    "The original server blocks automated requests with an anti-bot filter, which we did not get around. Recovery started from the copies kept by the Internet Archive’s Wayback Machine; in November 2026, with the owner’s permission, the missing files were downloaded directly from the server, one at a time.",
  "history.recovery2":
    "We found {total} addresses and recovered {recovered}, {earlier} of them from an earlier copy because the latest was damaged. {missing} files no longer exist in any copy.",
  "history.gapsLink": "See what is missing",
  "history.recovery3":
    "Each file comes from its most recent valid copy, so the collection mixes different years: it is not the site as it was on one particular day. The original files are kept untouched and never modified.",
  "history.yearsCaption":
    "Year of the Wayback Machine copies ({wayback} files). Another {origin} files come directly from the original server, November 2026.",
  "history.nowTitle": "What is here today",
  "history.now1":
    "This new edition orders the material by content rather than by folder: {works} works to read with indexes, authors and search, and every short prompt of the Lista delle ucronie in its period.",
  "site.history": "Site history",
  "site.footerNav": "More pages",
  "gaps.title": "Material not available",
  "gaps.kicker": "Archive in progress",
  "gaps.heading": "This material is not available yet",
  "gaps.text1":
    "The link may point to a page not converted yet, an excluded external resource or a file without a valid copy.",
  "gaps.text2":
    "The gap is recorded in the conversion report; the original link stays in the archive file.",
  "back.works": "← Back to the uchronias",
  "work.kicker": "Recovered document",
  "work.review": "Text under editorial review.",
  "work.reviewGaps": "Some links or images need checking:",
  "work.reviewGapsLink": "see the known gaps",
  "work.provenance": "Provenance",
  "work.captured": "Captured on {date}",
  "work.fromOrigin": "File recovered from the original site",
  "work.kept": "The original file is kept in the archive.",
  "work.by": "by {names}",
  "work.withOne": ", with contributions by one other author",
  "work.withMany": ", with contributions by {n} other authors",
  "work.source": "Source: {url}",
  "work.sourceCaptured": "Source: {url}, captured on {date}.",
  "work.automatic":
    "Structure recognised automatically from the original page: sections, dates and contribution types may contain errors.",
  "work.language.fr": "Text in French.",
  "work.language.es": "Text in Spanish.",
  "work.language.it": "Text in Italian.",
  "shape.chronology": "Chronology",
  "shape.discussion": "Proposal and discussion",
  "shape.narrative": "Story",
  "shape.collection": "Collection",
  "count.stories.one": "story",
  "count.stories.many": "stories",
  "count.dates.one": "date",
  "count.dates.many": "dates",
  "count.contributions.one": "contribution",
  "count.contributions.many": "contributions",
  "count.variants.one": "variant",
  "count.variants.many": "variants",
  "reader.branches": "Branches of the story",
  "reader.redLabel": "The editors’ words.",
  "reader.redNote":
    "Passages marked like this were red on the original site: usually the editors presenting the proposal and the point where history diverges, sometimes dates or names set in relief.",
  "reader.branchNote":
    "Each branch is a narrative or a variant. Open its events to follow the dates in the order of the text.",
  "reader.events": "Show events ({n})",
  "reader.close": "Close contents",
  "reader.quick": "Years and contributors, quick navigation",
  "reader.contents": "Contents",
  "reader.dates": "Dates in the text",
  "reader.dateNote":
    "Events in narrative order. Each date opens the matching passage; other authors’ contributions are listed separately.",
  "reader.main": "The text",
  "reader.top": "Back to top",
  "reader.tools": "Reading navigation",
  "reader.open": "Contents and story branches",
  "rail.toggle": "Contents",
  "rail.label": "Structure of the text",
  "rail.century": "{n} century",
  "rail.centuryBc": "{n} century BC",
  "outline.start": "Beginning",
  "outline.pod": "Point of divergence",
  "outline.chronology": "Chronology",
  "outline.discussion": "Discussion",
  "outline.anonymous": "Anonymous",
  "outline.untitled": "Untitled",
  "part.main.discussion": "The proposal",
  "part.main.chronology": "The uchronia",
  "part.main.narrative": "The story",
  "part.main.collection": "Introduction",
  "rail.ourHistory": "Our history",
  "rail.uchronia": "Uchronia",
  "rail.sections": "Sections",
  "rail.voices": "Voices in the discussion",
  "kind.comment": "Comment",
  "kind.addition": "Addition",
  "kind.variant": "Variant",
  "kind.reply": "Reply",
  "rail.kind.comment": "comment",
  "rail.kind.addition": "addition",
  "rail.kind.variant": "variant",
  "rail.kind.reply": "reply",
  replyTo: "in reply to",
  earlier: "an earlier contribution",
  "discussion.note.one":
    "{n} contribution, in the order it appeared on the site.",
  "discussion.note.many":
    "{n} contributions, in the order they appeared on the site.",
  "notFound.title": "Page not found",
  "notFound.heading": "This page is not in the archive",
  "notFound.text": "Check the address or go back to the available uchronias.",
};

export type Key = keyof typeof it;
const dictionaries: Record<Lang, Record<Key, string>> = { it, en };

/** Returns the translator for a language; {name} placeholders are filled. */
export function useTranslations(lang: Lang) {
  return (key: Key, values: Record<string, string | number> = {}) =>
    dictionaries[lang][key].replace(/\{(\w+)\}/g, (_m, name) =>
      String(values[name] ?? `{${name}}`),
    );
}
export function isKey(key: string): key is Key {
  return key in it;
}

/** Path of the same page in a language: Italian at the root, English under /en/. */
export function localePath(lang: Lang, path: string): string {
  const bare = path.replace(/^\/en(?=\/|$)/, "") || "/";
  return lang === "it" ? bare : `/en${bare === "/" ? "/" : bare}`;
}
export function pageLang(pathname: string): Lang {
  return /^\/en(\/|$)/.test(pathname) ? "en" : "it";
}

const roman = (n: number) => {
  const map: [number, string][] = [
    [1000, "M"],
    [900, "CM"],
    [500, "D"],
    [400, "CD"],
    [100, "C"],
    [90, "XC"],
    [50, "L"],
    [40, "XL"],
    [10, "X"],
    [9, "IX"],
    [5, "V"],
    [4, "IV"],
    [1, "I"],
  ];
  let out = "";
  for (const [v, s] of map)
    while (n >= v) {
      out += s;
      n -= v;
    }
  return out;
};
const ordinal = (n: number) => {
  const s =
    n % 100 >= 11 && n % 100 <= 13
      ? "th"
      : (["th", "st", "nd", "rd"][n % 10] ?? "th");
  return `${n}${s}`;
};
/** "XII secolo" in Italian, "12th century" in English; negative years are BC. */
export function centuryLabel(lang: Lang, year: number): string {
  const t = useTranslations(lang);
  const n = Math.ceil(Math.abs(year) / 100);
  const name = lang === "it" ? roman(n) : ordinal(n);
  return t(year > 0 ? "rail.century" : "rail.centuryBc", { n: name });
}

/**
 * Fills the interface placeholders that the converter leaves in a work's
 * HTML (<span data-t="kind.variant"></span>) and keeps internal links in
 * the reader's language.
 */
export function localizeHtml(html: string, lang: Lang): string {
  const t = useTranslations(lang);
  return html
    .replace(/alt="@source.image"/g, `alt="${t("source.image")}"`)
    .replace(
      /alt="@pdf.image.(\d+)"/g,
      (_whole, page: string) => `alt="${t("source.pdfImage", { n: page })}"`,
    )
    .replace(
      /<span data-t="([\w.]+)"(?: data-n="(\d+)")?><\/span>/g,
      (whole, key: string, n?: string) => {
        const k =
          n !== undefined ? `${key}.${n === "1" ? "one" : "many"}` : key;
        return isKey(k) ? `<span>${t(k, { n: n ?? "" })}</span>` : whole;
      },
    )
    .replace(
      /href="\/(works|divergences|worlds|gaps)\//g,
      (whole, section: string) =>
        lang === "en" ? `href="/en/${section}/` : whole,
    );
}
