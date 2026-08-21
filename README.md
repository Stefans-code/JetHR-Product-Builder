# Dalla RAL al netto — calcolatore 2026

Prototipo per la task **Product Builder @ Jet HR**.

Si inserisce una retribuzione annua lorda e si ottengono il netto annuale e mensile,
insieme a **ogni singola voce trattenuta al lordo** e alla formula di legge
effettivamente applicata a quella cifra.

**Demo live:** https://stefans-code.github.io/JetHR-Product-Builder/
**Verifiche:** https://stefans-code.github.io/JetHR-Product-Builder/test.html

In locale non serve nulla: si apre `index.html` e funziona, anche offline. Le stesse
verifiche girano da riga di comando con `node test/calcolo.test.js`.

---

## Il caso modellato

Come da traccia: **impiegato del settore privato, tempo indeterminato, residente a
Milano, senza agevolazioni particolari**. Anno d'imposta **2026**.

A questo ho aggiunto: 365 giorni di lavoro nell'anno, nessun altro reddito, nessun
familiare a carico, nessun onere detraibile, aliquota contributiva FPLD ordinaria.

## Come si arriva al netto

```
RAL
 −  contributi previdenziali del lavoratore      9,19%  (+1% oltre 56.224 €, massimale 122.295 €)
 =  imponibile fiscale IRPEF
 −  IRPEF netta                                  lorda 23/33/43%, meno le detrazioni
 −  addizionale regionale                        Lombardia, progressiva 1,23% → 1,73%
 −  addizionale comunale                         Milano, 0,80% oltre 23.000 € di imponibile
 +  somma integrativa del taglio del cuneo       non tassata, si somma al netto
 +  trattamento integrativo                      ex bonus Renzi
 =  NETTO ANNUO
```

Quattro punti valgono una nota, perché sono quelli che un calcolo "a occhio" sbaglia.

**1. I due meccanismi del cuneo fiscale non sono la stessa cosa.**
Fino a 20.000 € di reddito spetta una *somma non imponibile* (7,1% / 5,3% / 4,8% a
seconda della fascia) che si aggiunge al netto senza passare dall'IRPEF. Da 20.000 a
40.000 € spetta invece una *ulteriore detrazione* d'imposta (1.000 €, decrescente
sopra i 32.000 €). Non sono mai cumulabili — c'è una verifica automatica che lo
controlla su tutta la curva.

**2. Le addizionali non si toccano con le detrazioni.**
Si calcolano sull'imponibile pieno: chi ha IRPEF netta zero paga comunque le
addizionali. Quella di Milano ha una *soglia*, non una franchigia: a 23.000 € si è
esenti, a 23.001 € si paga lo 0,80% sull'intero imponibile.

**3. Il netto mensile non è il netto annuo diviso per le mensilità.**
Le detrazioni sono rapportate ai giorni di lavoro e vengono assorbite dalle 12
mensilità ordinarie; le addizionali sono trattenute a rate sugli stessi 12 mesi. La
tredicesima subisce quindi l'IRPEF *senza* detrazioni e senza addizionali, sulla sola
fetta più alta dell'imponibile: è netta più bassa di uno stipendio ordinario. L'aliquota
che ne risulta non è necessariamente quella marginale — se la mensilità aggiuntiva cade
a cavallo di uno scaglione le due divergono, e il calcolatore mostra quella vera. Con RAL 35.000 € e 13
mensilità la differenza è di circa 400 € — il calcolatore le mostra separate.

**4. Il netto non è una funzione crescente della RAL.**
Quattro benefici sono costruiti a gradino: superata la soglia di un euro, decadono
per intero. In quei punti una RAL più alta produce un netto più basso.

| Soglia (reddito) | Cosa si perde | Perdita netta |
|---|---|---|
| 8.500 € | la somma del cuneo scende dal 7,1% al 5,3% | ≈ 146 € |
| 15.000 € | decade il trattamento integrativo di 1.200 € (compensato in gran parte dal salto della detrazione art. 13) | ≈ 123 € |
| 23.000 € | decade l'esenzione dall'addizionale comunale di Milano | ≈ 178 € |
| 35.000 € | decade la maggiorazione di 65 € sulla detrazione da lavoro dipendente | ≈ 61 € |

Le ho trovate proprio scrivendo il test di monotonicità, che inizialmente fallì. Invece
di rilassare l'asserzione le ho verificate una per una, e ora il calcolatore le segnala
in pagina: se la RAL inserita cade appena sopra una soglia, avvisa quanto si
guadagnerebbe di più con una RAL più bassa e da quale RAL il netto torna in pari.

## Semplificazioni esplicite

- **Arrotondamenti**: il calcolo lavora a precisione piena e arrotonda solo a video.
  Un cedolino reale arrotonda all'euro le singole imposte: lo scostamento atteso è di
  pochi euro l'anno.
- **Competenza vs cassa**: le addizionali sono di competenza dell'anno in corso ma
  vengono trattenute a rate nell'anno successivo. Qui sono imputate all'anno di
  competenza — è la rappresentazione corretta del *costo annuo*, non del flusso di cassa.
- **Massimale contributivo** applicato sempre: equivale ad assumere una prima
  iscrizione previdenziale dopo il 31/12/1995. Cambia qualcosa solo oltre 122.295 € di RAL.
- **Aliquota contributiva** 9,19%: regime FPLD ordinario. Agricoltura, spettacolo,
  apprendistato e aziende sotto i 15 dipendenti hanno aliquote diverse, non modellate.
- **Ripartizione dei contributi sulle mensilità**: il modello spalma l'aliquota
  contributiva media su tutte le mensilità. Nella realtà, superato il massimale, i
  contributi si fermano a metà anno. La differenza è invisibile sotto i 122.295 € di
  RAL; sopra, la tredicesima risulta più alta di un mese ordinario invece che più
  bassa. È fuori dal caso standard, ed è fissato in un test perché resti esplicito.
- **Riduzione di 440 € delle detrazioni oltre 200.000 €** (L. 199/2025): riguarda gli
  oneri detraibili al 19%, che nel caso standard sono zero. Implementarla non
  cambierebbe nessun risultato di questo prototipo.
- **Fuori perimetro**: TFR (retribuzione differita, non entra nel netto in busta),
  welfare aziendale, buoni pasto, premi di risultato detassati, straordinari,
  part-time, contratti a termine, assegno unico, conguagli e arretrati.
- Il **costo azienda** è una sezione separata e dichiaratamente indicativa (30% di
  contributi datore + TFR): varia per CCNL, settore, dimensione e tariffa INAIL, e non
  entra in nessun modo nel calcolo del netto.

## Fonti

| Istituto | Fonte |
|---|---|
| Aliquote e scaglioni IRPEF 2026 (23% / **33%** / 43%) | art. 11 TUIR, come modificato dalla Legge di Bilancio 2026 (L. 199/2025) |
| Detrazione per lavoro dipendente | art. 13 co. 1 e 1.1 TUIR, importi vigenti dal 2025 (L. 207/2024) |
| Taglio del cuneo fiscale | L. 207/2024 art. 1 co. 4-9; Agenzia delle Entrate, circ. 4/E 2025 |
| Trattamento integrativo | D.L. 3/2020 conv. L. 21/2020 art. 1, mod. D.Lgs. 216/2023 e L. 207/2024 |
| Contributi, massimale 122.295 €, prima fascia 56.224 € | INPS, circolare n. 6 del 30/01/2026; L. 335/1995 art. 3-ter |
| Addizionale regionale Lombardia | art. 72 co. 1 l.r. 10/2003; tabella MEF – Dipartimento delle Finanze, pubblicata il 28/01/2026 |
| Addizionale comunale Milano | aliquota 0,80%, soglia di esenzione 23.000 € di imponibile |

La novità 2026 rilevante è la discesa del secondo scaglione IRPEF dal 35% al 33%.

## Struttura

```
index.html                 pagina del calcolatore
test.html                  le stesse verifiche, eseguite nel browser
assets/app.css             foglio di stile unico
src/tax-rules-2026.js      SOLO dati: aliquote, scaglioni, soglie, con la fonte a fianco
src/calcolo.js             funzioni pure, una per istituto giuridico
src/ui.js                  l'unico file che tocca il DOM
test/calcolo.test.js       31 verifiche automatiche
```

La separazione è voluta:

- `tax-rules-2026.js` è il **punto unico** da aggiornare quando cambia la normativa.
  Portare il prototipo al 2027 significa toccare quel file e nient'altro.
- Ogni funzione di `calcolo.js` restituisce il valore **e la formula applicata**, con i
  numeri già sostituiti. È quella stringa che si legge premendo «Mostra le formule»:
  non è un testo scritto a mano che potrebbe divergere dal codice, è il calcolo che si
  racconta da sé.
- `ui.js` non contiene nessuna regola fiscale. Se una cifra a video è sbagliata,
  l'errore è in `calcolo.js`.

## Verifiche

```bash
node test/calcolo.test.js
```

31 asserzioni, tutte verdi. Non servono a "far passare i test": fissano per iscritto le
proprietà che il calcolo deve rispettare, così che una modifica alle aliquote non possa
rompere nulla in silenzio. Coprono gli importi di legge ai confini di scaglione, la
continuità dell'IRPEF, la non cumulabilità dei due meccanismi del cuneo, la capienza
del trattamento integrativo, il massimale contributivo, le identità contabili
(`RAL = netto + trattenute`; `12 × mensilità ordinaria + aggiuntive = netto annuo`) e
le quattro discontinuità note — verificando che siano **esattamente quattro** e che
ognuna cada su una soglia dichiarata. Verificano anche che l'aliquota mostrata sulla
tredicesima sia quella davvero subita e non quella marginale: quando la mensilità
aggiuntiva cade a cavallo di uno scaglione le due divergono (a RAL 31.000 la marginale
è 33% ma la tredicesima è tassata al 23,4%).

La suite stampa anche una tabella di casi di riferimento, utile per il confronto a
occhio con un cedolino reale.

## Cosa approfondirei con più tempo

- **Comune e regione come input**, con la tabella MEF completa: è la prima cosa che
  serve a un prodotto reale, e l'architettura è già pronta per riceverla.
- **Familiari a carico e oneri detraibili**: sono il ramo del trattamento integrativo
  che oggi restituisce sempre zero, ed è già implementato per intero in attesa dei dati.
- **Simulazione del cedolino mese per mese** invece della media annua, con conguaglio
  di dicembre: è ciò che rende il numero riconoscibile da chi guarda la propria busta paga.
- **Confronto tra scenari** (RAL a confronto, o RAL vs. costo azienda a parità di
  budget): è la domanda che si fa davvero chi deve decidere un'offerta.

---

Stima a scopo dimostrativo. Non sostituisce un cedolino elaborato da un consulente del lavoro.
