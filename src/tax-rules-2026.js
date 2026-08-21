/* =============================================================================
 * PARAMETRI FISCALI E CONTRIBUTIVI — ANNO D'IMPOSTA 2026
 * -----------------------------------------------------------------------------
 * Questo file contiene SOLO dati, nessuna logica: è il punto unico in cui
 * aggiornare le aliquote quando cambia la normativa. Ogni blocco riporta la
 * fonte normativa da cui è tratto.
 *
 * Caso modellato: lavoratore dipendente del settore privato, contratto a tempo
 * indeterminato, residenza fiscale a Milano (Lombardia), nessuna agevolazione.
 * ========================================================================== */

var TAX_RULES_2026 = {

  anno: 2026,
  luogo: { comune: 'Milano', regione: 'Lombardia' },

  /* ---------------------------------------------------------------------------
   * 1. CONTRIBUTI PREVIDENZIALI A CARICO DEL LAVORATORE
   * Fonte: INPS, circolare n. 6 del 30/01/2026 (minimali e massimali 2026);
   *        L. 335/1995 art. 3-ter (aliquota aggiuntiva 1%).
   * ------------------------------------------------------------------------- */
  contributi: {
    // Aliquota IVS standard a carico del dipendente (settore privato,
    // aziende con oltre 15 dipendenti / regime FPLD ordinario).
    aliquotaLavoratore: 0.0919,

    // Aliquota aggiuntiva dell'1% sulla quota di retribuzione che eccede il
    // limite della prima fascia di retribuzione pensionabile.
    aliquotaAggiuntiva: 0.01,
    primaFasciaPensionabile: 56224.00,

    // Massimale annuo della base contributiva e pensionabile. Si applica ai
    // soli iscritti per la prima volta dopo il 31/12/1995.
    massimaleAnnuo: 122295.00,

    // Stima del carico contributivo a carico del DATORE di lavoro (INPS +
    // minori + INAIL). Varia per CCNL, settore e dimensione aziendale:
    // usato solo nella sezione "costo azienda", mai nel calcolo del netto.
    aliquotaDatoreStimata: 0.30,

    // Quota di TFR accantonata ogni anno: RAL / 13,5 (art. 2120 c.c.).
    divisoreTfr: 13.5
  },

  /* ---------------------------------------------------------------------------
   * 2. IRPEF — SCAGLIONI E ALIQUOTE
   * Fonte: art. 11 TUIR come modificato dalla Legge di Bilancio 2026
   *        (L. 199/2025): il secondo scaglione scende dal 35% al 33%.
   * ------------------------------------------------------------------------- */
  irpef: {
    scaglioni: [
      { limite: 28000, aliquota: 0.23 },
      { limite: 50000, aliquota: 0.33 },
      { limite: Infinity, aliquota: 0.43 }
    ]
  },

  /* ---------------------------------------------------------------------------
   * 3. DETRAZIONE PER REDDITI DA LAVORO DIPENDENTE
   * Fonte: art. 13 co. 1 e 1.1 TUIR (importi vigenti dal 2025, L. 207/2024).
   * Gli importi sono rapportati ai giorni di lavoro nell'anno: qui 365/365.
   * ------------------------------------------------------------------------- */
  detrazioneLavoro: {
    fasce: [
      { limite: 15000, tipo: 'fissa',      importo: 1955 },
      { limite: 28000, tipo: 'decrescente', base: 1910, quota: 1190, riferimento: 28000, ampiezza: 13000 },
      { limite: 50000, tipo: 'decrescente', base: 1910, quota: 0,    riferimento: 50000, ampiezza: 22000 },
      { limite: Infinity, tipo: 'fissa',   importo: 0 }
    ],
    // Ulteriore detrazione di 65 € per redditi complessivi tra 25.000 e 35.000 €
    // (art. 13 co. 1.1 TUIR).
    maggiorazione: { importo: 65, da: 25000, a: 35000 }
  },

  /* ---------------------------------------------------------------------------
   * 4. TAGLIO DEL CUNEO FISCALE (misura strutturale dal 2025)
   * Fonte: L. 207/2024 art. 1 co. 4-9; Agenzia delle Entrate, circ. 4/E 2025.
   * Due meccanismi alternativi, mai cumulabili:
   *   a) fino a 20.000 € di reddito -> somma NON tassata, aggiunta al netto;
   *   b) da 20.000 a 40.000 €       -> ulteriore detrazione IRPEF.
   * ------------------------------------------------------------------------- */
  cuneo: {
    sommaIntegrativa: {
      limiteReddito: 20000,
      fasce: [
        { limite: 8500,     percentuale: 0.071 },
        { limite: 15000,    percentuale: 0.053 },
        { limite: Infinity, percentuale: 0.048 }
      ]
    },
    ulterioreDetrazione: {
      importoPieno: 1000,
      da: 20000,
      pienoFinoA: 32000,
      azzeramentoA: 40000
    }
  },

  /* ---------------------------------------------------------------------------
   * 5. TRATTAMENTO INTEGRATIVO (ex "bonus Renzi")
   * Fonte: D.L. 3/2020 conv. L. 21/2020 art. 1, come modificato dal
   *        D.Lgs. 216/2023 e dalla L. 207/2024.
   * ------------------------------------------------------------------------- */
  trattamentoIntegrativo: {
    importo: 1200,
    limiteBasso: 15000,   // fino a questa soglia spetta per intero, se capiente
    limiteAlto: 28000,    // oltre questa soglia non spetta mai
    scontoCapienza: 75    // la verifica di capienza usa (detrazione art.13 - 75)
  },

  /* ---------------------------------------------------------------------------
   * 6. ADDIZIONALE REGIONALE IRPEF — LOMBARDIA
   * Fonte: art. 72 co. 1 l.r. Lombardia 10/2003; tabella MEF - Dipartimento
   *        delle Finanze, aliquote pubblicate il 28/01/2026.
   * Progressiva per scaglioni, calcolata sull'imponibile IRPEF.
   * ------------------------------------------------------------------------- */
  addizionaleRegionale: {
    regione: 'Lombardia',
    scaglioni: [
      { limite: 15000, aliquota: 0.0123 },
      { limite: 28000, aliquota: 0.0158 },
      { limite: 50000, aliquota: 0.0172 },
      { limite: Infinity, aliquota: 0.0173 }
    ]
  },

  /* ---------------------------------------------------------------------------
   * 7. ADDIZIONALE COMUNALE IRPEF — MILANO
   * Fonte: Comune di Milano, aliquota 0,80% con soglia di esenzione a 23.000 €
   *        di reddito imponibile. Attenzione: è una SOGLIA, non una franchigia
   *        (superata, l'addizionale si paga sull'intero imponibile).
   * ------------------------------------------------------------------------- */
  addizionaleComunale: {
    comune: 'Milano',
    aliquota: 0.008,
    sogliaEsenzione: 23000
  }
};

if (typeof module !== 'undefined' && module.exports) { module.exports = TAX_RULES_2026; }
