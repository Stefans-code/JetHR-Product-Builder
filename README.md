# Calcolatore RAL → Netto

Prototipo per la task tecnica **Product Builder @ Jet HR**.

Un calcolatore che, partendo da una Retribuzione Annua Lorda (RAL), stima il netto annuale e mensile percepito da un dipendente, mostrando in dettaglio ogni voce trattenuta al lordo (contributi INPS, IRPEF, detrazioni, addizionali).

**Demo live:** https://<tuo-username>.github.io/<nome-repo>/
*(il link esatto lo trovi dopo aver attivato GitHub Pages — vedi istruzioni sotto)*

## Cosa fa

L'utente inserisce una RAL, clicca "Calcola" e vede:
- Netto annuo e netto mensile
- Il dettaglio di ogni trattenuta: contributi INPS, IRPEF lorda, detrazione lavoro dipendente, IRPEF netta, addizionale regionale, addizionale comunale

## Assunzioni e semplificazioni

Il profilo simulato è: dipendente privato, **contratto a tempo indeterminato**, **residente a Milano**, **nessuna agevolazione fiscale particolare**, come da indicazioni della task. Oltre a queste, ho fatto le seguenti scelte per tenere il prototipo semplice:

- **12 mensilità**, nessun arretrato/conguaglio da annualità precedenti.
- **Nessun familiare a carico**, nessuna spesa detraibile al 19%, nessun bonus/agevolazione aggiuntiva (es. impatriati, ZES).
- **Contributi INPS** calcolati al 9,19% flat sull'intera RAL. Non applico il massimale contributivo né l'aliquota aggiuntiva dell'1% oltre € 56.224 (rilevante solo per RAL molto alte, categoria rara per un ruolo junior/mid — dettaglio che approfondirei volentieri in interview).
- **Trattamento integrativo** ("bonus Renzi") e soglia di incapienza sotto € 8.500 non simulati esplicitamente: con le formule usate il netto converge comunque a IRPEF = 0 sotto quella soglia, ma il bonus aggiuntivo per i redditi più bassi non è calcolato.
- **Addizionale comunale di Milano**: aliquota unica 0,8% con esenzione piena sotto € 23.000 di imponibile (valore più recente reperito al momento della ricerca; il Comune non aveva ancora pubblicato una nuova delibera per il 2026 al momento in cui ho costruito il prototipo).
- **TFR non incluso**: è retribuzione differita, non fa parte dello stipendio netto percepito mensilmente/annualmente.

## Fonti usate

- Scaglioni IRPEF 2026 e detrazione lavoro dipendente (art. 13 TUIR) — Legge di Bilancio 2026 (L. 199/2025)
- Addizionale regionale Lombardia a scaglioni — Regione Lombardia, art. 72 l.r. 10/2003
- Addizionale comunale Milano — delibera comunale più recente disponibile
- Aliquota contributiva INPS lavoratore dipendente (9,19%) — L. 335/1995

## Come funziona tecnicamente

Un unico file HTML (`index.html`) con CSS e JavaScript inline, nessuna dipendenza esterna a parte i font da Google Fonts. Tutta la logica di calcolo è in poche funzioni pure in JavaScript (`irpefLorda`, `detrazioneLavoroDipendente`, `addizionaleRegionaleLombardia`, `addizionaleComunaleMilano`, `calcola`), leggibili e modificabili senza build step: si apre e basta, anche offline (a parte i font).

## Come eseguirlo in locale

Basta aprire `index.html` in un browser. Nessuna installazione richiesta.
