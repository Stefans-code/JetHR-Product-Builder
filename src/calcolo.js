/* =============================================================================
 * MOTORE DI CALCOLO RAL -> NETTO
 * -----------------------------------------------------------------------------
 * Funzioni pure: nessun accesso al DOM, nessuno stato globale. Ogni funzione
 * restituisce sia il valore sia la formula effettivamente applicata (con i
 * numeri sostituiti), cosi' l'interfaccia puo' mostrare il calcolo passo passo.
 *
 * Convenzione: si lavora sempre a precisione piena e si arrotonda solo in fase
 * di visualizzazione. Un cedolino reale arrotonda all'euro le singole imposte:
 * gli scostamenti sono nell'ordine di pochi euro l'anno.
 * ========================================================================== */

(function (root, factory) {
  var rules = (typeof require !== 'undefined') ? require('./tax-rules-2026.js') : root.TAX_RULES_2026;
  var api = factory(rules);
  if (typeof module !== 'undefined' && module.exports) { module.exports = api; }
  else { root.Calcolo = api; }
})(typeof self !== 'undefined' ? self : this, function (R) {
  'use strict';

  // Le uniche mensilita' previste dai CCNL italiani. L'API e' pubblica:
  // un valore fuori da questa lista va rifiutato, non interpretato.
  var MENSILITA_AMMESSE = [12, 13, 14];

  var MENO = '−';   // segno meno tipografico
  var PER  = '×';   // segno di moltiplicazione
  var LE   = '≤';   // minore o uguale
  var FREC = '→';   // freccia

  /* --- formattazione usata SOLO dentro le stringhe-formula -----------------
   * I formattatori sono costruiti una volta sola e riusati: istanziare un
   * Intl.NumberFormat a ogni chiamata costa circa 20 microsecondi, e con le
   * migliaia di valutazioni che fa trappoleNetto() diventa mezzo secondo di
   * interfaccia bloccata.
   * ---------------------------------------------------------------------- */
  var FORMATTATORI = {};
  function n(x, dec) {
    var d = (dec === undefined) ? 2 : dec;
    if (!FORMATTATORI[d]) {
      FORMATTATORI[d] = new Intl.NumberFormat('it-IT', {
        useGrouping: true, minimumFractionDigits: d, maximumFractionDigits: d
      });
    }
    return FORMATTATORI[d].format(x);
  }

  var FORMATTATORE_PERC = new Intl.NumberFormat('it-IT', { maximumFractionDigits: 2 });
  function p(x) { return FORMATTATORE_PERC.format(x * 100) + '%'; }

  /* =========================================================================
   * 1. CONTRIBUTI PREVIDENZIALI A CARICO DEL LAVORATORE
   * ====================================================================== */
  function contributiLavoratore(ral) {
    var c = R.contributi;
    var imponibileContributivo = Math.min(ral, c.massimaleAnnuo);
    var base = imponibileContributivo * c.aliquotaLavoratore;
    var eccedenza = Math.max(0, imponibileContributivo - c.primaFasciaPensionabile);
    var aggiuntiva = eccedenza * c.aliquotaAggiuntiva;

    var passaggi = [p(c.aliquotaLavoratore) + ' ' + PER + ' ' + n(imponibileContributivo) + ' = ' + n(base)];
    if (imponibileContributivo < ral) {
      passaggi.unshift('base contributiva limitata al massimale di ' + n(c.massimaleAnnuo));
    }
    if (aggiuntiva > 0) {
      passaggi.push('+ 1% ' + PER + ' (' + n(imponibileContributivo) + ' ' + MENO + ' ' +
                    n(c.primaFasciaPensionabile) + ') = ' + n(aggiuntiva));
    }

    return {
      totale: base + aggiuntiva,
      base: base,
      aggiuntiva: aggiuntiva,
      imponibileContributivo: imponibileContributivo,
      aliquotaEffettiva: ral > 0 ? (base + aggiuntiva) / ral : 0,
      formula: passaggi.join('\n')
    };
  }

  /* =========================================================================
   * 2. IRPEF LORDA - scaglioni progressivi
   * ====================================================================== */
  function irpefLorda(imponibile) {
    var residuo = Math.max(0, imponibile);
    var precedente = 0;
    var totale = 0;
    var pezzi = [];

    for (var i = 0; i < R.irpef.scaglioni.length && residuo > 0; i++) {
      var s = R.irpef.scaglioni[i];
      var ampiezza = Math.min(residuo, s.limite - precedente);
      totale += ampiezza * s.aliquota;
      pezzi.push(p(s.aliquota) + ' ' + PER + ' ' + n(ampiezza));
      residuo -= ampiezza;
      precedente = s.limite;
    }

    return {
      valore: totale,
      formula: pezzi.length ? pezzi.join(' + ') + ' = ' + n(totale) : n(0)
    };
  }

  function aliquotaMarginale(imponibile) {
    for (var i = 0; i < R.irpef.scaglioni.length; i++) {
      if (imponibile <= R.irpef.scaglioni[i].limite) { return R.irpef.scaglioni[i].aliquota; }
    }
    return R.irpef.scaglioni[R.irpef.scaglioni.length - 1].aliquota;
  }

  /* =========================================================================
   * 3. DETRAZIONE PER LAVORO DIPENDENTE (art. 13 TUIR)
   * `base` = detrazione art. 13 co. 1, SENZA la maggiorazione di 65 euro:
   * serve separata perche' la verifica di capienza del trattamento
   * integrativo si fa proprio su quella.
   * ====================================================================== */
  function detrazioneLavoro(reddito) {
    var d = R.detrazioneLavoro;
    var base = 0;
    var formula = '';

    for (var i = 0; i < d.fasce.length; i++) {
      var f = d.fasce[i];
      if (reddito <= f.limite) {
        if (f.tipo === 'fissa') {
          base = f.importo;
          formula = 'importo fisso ' + n(base);
        } else {
          var frazione = (f.riferimento - reddito) / f.ampiezza;
          if (f.quota) {
            base = f.base + f.quota * frazione;
            formula = n(f.base) + ' + ' + n(f.quota) + ' ' + PER + ' (' + n(f.riferimento, 0) + ' ' +
                      MENO + ' ' + n(reddito) + ') / ' + n(f.ampiezza, 0) + ' = ' + n(base);
          } else {
            base = f.base * frazione;
            formula = n(f.base) + ' ' + PER + ' (' + n(f.riferimento, 0) + ' ' + MENO + ' ' +
                      n(reddito) + ') / ' + n(f.ampiezza, 0) + ' = ' + n(base);
          }
        }
        break;
      }
    }

    base = Math.max(0, base);
    var m = d.maggiorazione;
    var maggiorazione = (reddito > m.da && reddito <= m.a) ? m.importo : 0;
    if (maggiorazione > 0) {
      formula += '\n+ ' + n(maggiorazione) + ' (art. 13 co. 1.1: reddito tra ' +
                 n(m.da, 0) + ' e ' + n(m.a, 0) + ')';
    }

    return { valore: base + maggiorazione, base: base, maggiorazione: maggiorazione, formula: formula };
  }

  /* =========================================================================
   * 4a. TAGLIO DEL CUNEO - somma integrativa non tassata (redditi <= 20.000)
   * ====================================================================== */
  function sommaCuneo(reddito) {
    var s = R.cuneo.sommaIntegrativa;
    if (reddito <= 0 || reddito > s.limiteReddito) {
      return { valore: 0, percentuale: 0,
               formula: 'non spettante: reddito oltre ' + n(s.limiteReddito, 0) };
    }
    var perc = s.fasce[s.fasce.length - 1].percentuale;
    for (var i = 0; i < s.fasce.length; i++) {
      if (reddito <= s.fasce[i].limite) { perc = s.fasce[i].percentuale; break; }
    }
    var valore = reddito * perc;
    return {
      valore: valore,
      percentuale: perc,
      formula: p(perc) + ' ' + PER + ' ' + n(reddito) + ' = ' + n(valore) + ' (somma non imponibile)'
    };
  }

  /* =========================================================================
   * 4b. TAGLIO DEL CUNEO - ulteriore detrazione IRPEF (20.000 - 40.000)
   * ====================================================================== */
  function ulterioreDetrazioneCuneo(reddito) {
    var u = R.cuneo.ulterioreDetrazione;
    if (reddito <= u.da || reddito > u.azzeramentoA) {
      return { valore: 0,
               formula: 'non spettante: reddito fuori dalla fascia ' + n(u.da, 0) + '-' + n(u.azzeramentoA, 0) };
    }
    if (reddito <= u.pienoFinoA) {
      return { valore: u.importoPieno, formula: 'importo pieno ' + n(u.importoPieno) };
    }
    var valore = u.importoPieno * (u.azzeramentoA - reddito) / (u.azzeramentoA - u.pienoFinoA);
    return {
      valore: valore,
      formula: n(u.importoPieno) + ' ' + PER + ' (' + n(u.azzeramentoA, 0) + ' ' + MENO + ' ' +
               n(reddito) + ') / ' + n(u.azzeramentoA - u.pienoFinoA, 0) + ' = ' + n(valore)
    };
  }

  /* =========================================================================
   * 5. TRATTAMENTO INTEGRATIVO
   * Nel caso standard modellato (nessun familiare a carico, nessun onere
   * detraibile) la fascia 15.000-28.000 restituisce sempre 0: le detrazioni
   * non superano mai l'imposta lorda. La formula resta implementata per
   * intero perche' e' li' che entrerebbero i carichi di famiglia.
   * ====================================================================== */
  function trattamentoIntegrativo(reddito, imposta, detrazione) {
    var t = R.trattamentoIntegrativo;

    if (reddito <= t.limiteBasso) {
      var soglia = detrazione.base - t.scontoCapienza;
      var spetta = imposta > soglia;
      return {
        valore: spetta ? t.importo : 0,
        formula: 'capienza: IRPEF lorda ' + n(imposta) + (spetta ? ' > ' : ' ' + LE + ' ') +
                 '(detrazione ' + n(detrazione.base) + ' ' + MENO + ' ' + n(t.scontoCapienza, 0) + ') = ' +
                 n(soglia) + '  ' + FREC + '  ' + (spetta ? 'spetta ' + n(t.importo) : 'incapiente, non spetta')
      };
    }

    if (reddito <= t.limiteAlto) {
      // Somma delle detrazioni rilevanti (artt. 12 e 13 TUIR + oneri): nel caso
      // standard coincide con la sola detrazione da lavoro dipendente.
      var differenza = detrazione.valore - imposta;
      var valore = Math.max(0, Math.min(t.importo, differenza));
      return {
        valore: valore,
        formula: 'min(' + n(t.importo, 0) + '; detrazioni ' + n(detrazione.valore) + ' ' + MENO +
                 ' IRPEF lorda ' + n(imposta) + ') = ' + n(valore)
      };
    }

    return { valore: 0, formula: 'non spettante: reddito oltre ' + n(t.limiteAlto, 0) };
  }

  /* =========================================================================
   * 6. ADDIZIONALE REGIONALE (progressiva per scaglioni)
   * ====================================================================== */
  function addizionaleRegionale(imponibile) {
    var residuo = Math.max(0, imponibile);
    var precedente = 0;
    var totale = 0;
    var pezzi = [];

    for (var i = 0; i < R.addizionaleRegionale.scaglioni.length && residuo > 0; i++) {
      var s = R.addizionaleRegionale.scaglioni[i];
      var ampiezza = Math.min(residuo, s.limite - precedente);
      totale += ampiezza * s.aliquota;
      pezzi.push(p(s.aliquota) + ' ' + PER + ' ' + n(ampiezza));
      residuo -= ampiezza;
      precedente = s.limite;
    }

    return { valore: totale, formula: pezzi.length ? pezzi.join(' + ') + ' = ' + n(totale) : n(0) };
  }

  /* =========================================================================
   * 7. ADDIZIONALE COMUNALE (soglia di esenzione, non franchigia)
   * ====================================================================== */
  function addizionaleComunale(imponibile) {
    var a = R.addizionaleComunale;
    if (imponibile <= a.sogliaEsenzione) {
      return { valore: 0,
               formula: 'imponibile ' + n(imponibile) + ' ' + LE + ' soglia di esenzione ' +
                        n(a.sogliaEsenzione, 0) + '  ' + FREC + '  esente' };
    }
    var valore = imponibile * a.aliquota;
    return { valore: valore, formula: p(a.aliquota) + ' ' + PER + ' ' + n(imponibile) + ' = ' + n(valore) };
  }

  /* =========================================================================
   * 8. RIPARTIZIONE MENSILE
   * Il netto mensile NON e' il netto annuo diviso per le mensilita': la
   * tredicesima (e la quattordicesima) subiscono IRPEF all'aliquota marginale
   * SENZA detrazioni - che sono rapportate ai giorni di lavoro e quindi
   * assorbite dalle 12 mensilita' ordinarie - e senza addizionali, che vengono
   * trattenute a rate sui mesi ordinari. Risultato: una mensilita' aggiuntiva
   * e' netta piu' bassa di uno stipendio ordinario.
   * ====================================================================== */
  function ripartizioneMensile(ral, mensilita, imponibileFiscale, nettoAnnuo, aliquotaContributiva) {
    var extra = mensilita - 12;
    if (extra <= 0) {
      return {
        ordinario: nettoAnnuo / 12,
        aggiuntiva: null,
        numeroAggiuntive: 0,
        formula: 'netto annuo ' + n(nettoAnnuo) + ' / 12 = ' + n(nettoAnnuo / 12)
      };
    }

    var lordoUnitario = ral / mensilita;
    var contributiUnitari = lordoUnitario * aliquotaContributiva;
    var imponibileUnitario = lordoUnitario - contributiUnitari;
    var imponibileExtra = imponibileUnitario * extra;

    // IRPEF sulla "fetta piu' alta" dell'imponibile annuo: esatta anche quando
    // la mensilita' aggiuntiva e' a cavallo di due scaglioni.
    var irpefExtra = irpefLorda(imponibileFiscale).valore -
                     irpefLorda(imponibileFiscale - imponibileExtra).valore;

    var nettoExtraTotale = imponibileExtra - irpefExtra;
    var nettoOrdinario = (nettoAnnuo - nettoExtraTotale) / 12;

    // Aliquota REALE subita dalla mensilita' aggiuntiva. Non coincide con
    // l'aliquota marginale quando la mensilita' e' a cavallo di due
    // scaglioni: dire "tassata al 33%" sarebbe falso, li' e' il 23,7%.
    var aliquotaSullaAggiuntiva = imponibileExtra > 0 ? irpefExtra / imponibileExtra : 0;

    return {
      ordinario: nettoOrdinario,
      aggiuntiva: nettoExtraTotale / extra,
      numeroAggiuntive: extra,
      lordoUnitario: lordoUnitario,
      contributiUnitari: contributiUnitari,
      irpefUnitaria: irpefExtra / extra,
      imponibileUnitario: imponibileUnitario,
      aliquotaSullaAggiuntiva: aliquotaSullaAggiuntiva,
      formula: 'lordo ' + n(lordoUnitario) + ' ' + MENO + ' contributi ' + n(contributiUnitari) +
               ' ' + MENO + ' IRPEF ' + n(irpefExtra / extra) + ' (' + p(aliquotaSullaAggiuntiva) +
               ' sull’imponibile) = ' + n(nettoExtraTotale / extra) +
               '\n(detrazioni e addizionali sono assorbite dalle 12 mensilità ordinarie)'
    };
  }

  /* =========================================================================
   * 9. COSTO AZIENDA - stima indicativa, NON entra nel calcolo del netto
   * ====================================================================== */
  function costoAzienda(ral) {
    var c = R.contributi;
    var contributiDatore = ral * c.aliquotaDatoreStimata;
    var tfr = ral / c.divisoreTfr;
    return {
      contributiDatore: contributiDatore,
      tfr: tfr,
      totale: ral + contributiDatore + tfr
    };
  }

  /* =========================================================================
   * ORCHESTRATORE
   * ====================================================================== */
  function calcola(input) {
    var ral = Number(input.ral);
    // Solo l'assenza del campo attiva il default: un null esplicito e' un errore.
    var mensilita = (input.mensilita === undefined) ? 13 : Number(input.mensilita);

    if (!isFinite(ral) || ral <= 0) { throw new RangeError('RAL non valida'); }
    if (MENSILITA_AMMESSE.indexOf(mensilita) === -1) {
      throw new RangeError('Mensilita non ammesse: ' + input.mensilita +
                           ' (ammesse: ' + MENSILITA_AMMESSE.join(', ') + ')');
    }

    // (1) contributi -> (2) imponibile fiscale
    var contributi = contributiLavoratore(ral);
    var imponibileFiscale = ral - contributi.totale;

    // Nel caso modellato reddito complessivo = reddito di lavoro dipendente =
    // imponibile fiscale: i contributi obbligatori non concorrono a formare il
    // reddito (art. 51 co. 2 lett. a TUIR) e non c'e' altra fonte di reddito.
    var reddito = imponibileFiscale;

    // (3) IRPEF
    var lorda = irpefLorda(imponibileFiscale);
    var detrazione = detrazioneLavoro(reddito);
    var detrCuneo = ulterioreDetrazioneCuneo(reddito);
    var irpefNetta = Math.max(0, lorda.valore - detrazione.valore - detrCuneo.valore);

    // (4) addizionali locali: si calcolano sull'imponibile, senza detrazioni
    var addReg = addizionaleRegionale(imponibileFiscale);
    var addCom = addizionaleComunale(imponibileFiscale);

    // (5) somme che si AGGIUNGONO al netto invece di ridurre l'imposta
    var cuneo = sommaCuneo(reddito);
    var ti = trattamentoIntegrativo(reddito, lorda.valore, detrazione);

    var nettoAnnuo = imponibileFiscale - irpefNetta - addReg.valore - addCom.valore +
                     cuneo.valore + ti.valore;
    var trattenute = ral - nettoAnnuo;

    var mensile = ripartizioneMensile(ral, mensilita, imponibileFiscale, nettoAnnuo,
                                      contributi.aliquotaEffettiva);

    return {
      input: { ral: ral, mensilita: mensilita },
      contributi: contributi,
      imponibileFiscale: imponibileFiscale,
      reddito: reddito,
      irpef: {
        lorda: lorda,
        detrazione: detrazione,
        detrazioneCuneo: detrCuneo,
        netta: irpefNetta,
        aliquotaMarginale: aliquotaMarginale(imponibileFiscale),
        incapiente: (lorda.valore - detrazione.valore - detrCuneo.valore) < 0
      },
      addizionali: {
        regionale: addReg,
        comunale: addCom,
        totale: addReg.valore + addCom.valore
      },
      integrazioni: {
        cuneo: cuneo,
        trattamentoIntegrativo: ti,
        totale: cuneo.valore + ti.valore
      },
      totali: {
        nettoAnnuo: nettoAnnuo,
        trattenute: trattenute,
        aliquotaEffettiva: trattenute / ral,
        pressioneFiscale: (irpefNetta + addReg.valore + addCom.valore) / ral
      },
      mensile: mensile,
      costoAzienda: costoAzienda(ral)
    };
  }

  /* =========================================================================
   * 10. SOGLIE A GRADINO ("trappole del netto")
   * -------------------------------------------------------------------------
   * Il netto NON e' una funzione monotona della RAL. Quattro soglie di legge
   * sono a gradino e non a scaglione: superarle di un euro fa perdere l'intero
   * beneficio. Sono tutte verificate dalla suite di test.
   * ====================================================================== */
  var SOGLIE = [
    { reddito: 8500,  causa: 'Percentuale del taglio del cuneo',
      descrizione: 'Oltre 8.500 euro di reddito la somma integrativa scende dal 7,1% al 5,3%.' },
    { reddito: 15000, causa: 'Trattamento integrativo',
      descrizione: 'Oltre 15.000 euro di reddito il trattamento integrativo di 1.200 euro decade (compensato solo in parte dal salto della detrazione art. 13).' },
    { reddito: 23000, causa: 'Esenzione addizionale comunale di Milano',
      descrizione: 'La soglia di 23.000 euro non è una franchigia: superata di un euro, lo 0,80% si paga sull’intero imponibile.' },
    { reddito: 35000, causa: 'Maggiorazione di 65 euro (art. 13 co. 1.1 TUIR)',
      descrizione: 'Oltre 35.000 euro di reddito la maggiorazione di 65 euro sulla detrazione da lavoro dipendente non spetta più.' }
  ];

  function nettoDi(ral) { return calcola({ ral: ral, mensilita: 12 }).totali.nettoAnnuo; }

  /**
   * Data una RAL, restituisce le soglie gia' superate che la penalizzano:
   * quelle per cui esiste una RAL PIU' BASSA con un netto PIU' ALTO.
   */
  function trappoleNetto(ral) {
    var esito = [];
    var nettoAttuale = nettoDi(ral);

    for (var i = 0; i < SOGLIE.length; i++) {
      var s = SOGLIE[i];
      // RAL che porta esattamente al reddito-soglia (invertendo i contributi).
      var ralSoglia = s.reddito / (1 - R.contributi.aliquotaLavoratore);
      if (ral <= ralSoglia) { continue; }

      var nettoSoglia = nettoDi(ralSoglia);
      if (nettoAttuale >= nettoSoglia) { continue; }   // gia' recuperata

      // RAL a cui il netto torna al livello pre-soglia.
      var pareggio = ralSoglia;
      for (var k = 1; k <= 3000; k++) {
        if (nettoDi(ralSoglia + k) >= nettoSoglia) { pareggio = ralSoglia + k; break; }
      }

      esito.push({
        causa: s.causa,
        descrizione: s.descrizione,
        redditoSoglia: s.reddito,
        ralSoglia: ralSoglia,
        nettoSoglia: nettoSoglia,
        perdita: nettoSoglia - nettoAttuale,
        ralPareggio: pareggio
      });
    }
    return esito;
  }

  return {
    calcola: calcola,
    trappoleNetto: trappoleNetto,
    SOGLIE: SOGLIE,
    MENSILITA_AMMESSE: MENSILITA_AMMESSE,
    contributiLavoratore: contributiLavoratore,
    irpefLorda: irpefLorda,
    aliquotaMarginale: aliquotaMarginale,
    detrazioneLavoro: detrazioneLavoro,
    sommaCuneo: sommaCuneo,
    ulterioreDetrazioneCuneo: ulterioreDetrazioneCuneo,
    trattamentoIntegrativo: trattamentoIntegrativo,
    addizionaleRegionale: addizionaleRegionale,
    addizionaleComunale: addizionaleComunale,
    ripartizioneMensile: ripartizioneMensile,
    costoAzienda: costoAzienda,
    regole: R
  };
});
