# Stato S1 — sospeso l’11 novembre 2026

Il proprietario ha chiesto di fermarsi e riprendere domani.

- S0 è concluso: il sito è pubblicato dietro Access, il backup R2 e il ripristino sono verificati e il proprietario ha confermato la visualizzazione sul telefono. La grafica è provvisoria e sarà affrontata in S4. La copia sul drive personale resta rinviata e non bloccante.
- È iniziata l’implementazione di `pnpm recupero scopri`: legge l’indice CDX Wayback, registra URL, varianti e copie e salva un cursore di ripresa in `archivio/coda.json`; inoltre raccoglie i link delle pagine HTML già presenti nel campione.
- È stata eseguita **una sola pagina**: 293 URL individuati, 995 copie registrate, `completa: false` e cursore presente. Il risultato è parziale; non è un rapporto di copertura né un archivio completo.
- Wayback ha risposto inizialmente HTTP 503, poi la richiesta è riuscita dopo i tentativi previsti. Non è stato avviato lo scaricamento massivo.
- La nuova implementazione ha passato il controllo TypeScript e una prima prova reale, ma richiede ancora test su risposte registrate, verifica della ripresa su più pagine e gestione delle sorgenti collegate prima di considerare l’attività completata. In particolare, se la prima richiesta fallisce prima che esista `coda.json`, i link appena raccolti dal campione non vengono ancora salvati: correggere questo caso.
- Domani: rivedere le modifiche locali, aggiungere i test necessari, riprendere con `pnpm recupero scopri --max-pagine 1` e confrontare la coda prima e dopo; solo poi valutare il recupero completo e il rapporto di copertura.

La schermata fornita dal proprietario è `img.png`, già presente nell’area di staging prima di queste modifiche: conservarne lo stato senza includerla automaticamente nei commit del progetto.
