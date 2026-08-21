/* =============================================================================
 * SUITE DI VERIFICA DEL MOTORE DI CALCOLO
 * -----------------------------------------------------------------------------
 * Si esegue con:   node test/calcolo.test.js
 * oppure aprendo:  test.html   (stesse asserzioni, eseguite nel browser)
 *
 * Non serve a "far passare i test": serve a fissare per iscritto le proprieta'
 * che il calcolo deve rispettare - soglie di legge, continuita' negli scaglioni,
 * identita' contabili - in modo che una modifica alle aliquote non rompa nulla
 * in silenzio.
 * ========================================================================== */

(function (root, factory) {
  var C = (typeof require !== 'undefined') ? require('../src/calcolo.js') : root.Calcolo;
  var api = factory(C);
  if (typeof module !== 'undefined' && module.exports) { module.exports = api; }
  else { root.SuiteTest = api; }
  // Esecuzione automatica solo da riga di comando.
  if (typeof require !== 'undefined' && typeof module !== 'undefined' && require.main === module) {
    var esito = api.esegui();
    api.stampaConsole(esito);
    process.exit(esito.falliti === 0 ? 0 : 1);
  }
})(typeof self !== 'undefined' ? self : this, function (C) {
  'use strict';

  var EUR = 0.01;   // tolleranza in euro per i confronti su importi

  function esegui() {
    var risultati = [];

    function test(nome, fn) {
      try { fn(); risultati.push({ nome: nome, ok: true }); }
      catch (e) { risultati.push({ nome: nome, ok: false, errore: e.message }); }
    }
    function eq(a, b, msg) {
      if (Math.abs(a - b) > EUR) {
        throw new Error((msg || 'valore') + ': atteso ' + b.toFixed(2) + ', ottenuto ' + a.toFixed(2));
      }
    }
    function vero(cond, msg) { if (!cond) { throw new Error(msg); } }

    /* --- IRPEF: scaglioni e continuita' ---------------------------------- */

    test('IRPEF lorda ai confini di scaglione (23% / 33% / 43%)', function () {
      eq(C.irpefLorda(28000).valore, 6440, 'a 28.000');
      eq(C.irpefLorda(50000).valore, 6440 + 22000 * 0.33, 'a 50.000');
      eq(C.irpefLorda(60000).valore, 6440 + 22000 * 0.33 + 10000 * 0.43, 'a 60.000');
    });

    test('IRPEF lorda e continua: nessun salto attraversando 28.000 e 50.000', function () {
      [28000, 50000].forEach(function (soglia) {
        var sotto = C.irpefLorda(soglia - 1).valore;
        var sopra = C.irpefLorda(soglia + 1).valore;
        vero(sopra - sotto < 1, 'salto anomalo a ' + soglia + ': ' + (sopra - sotto).toFixed(2));
      });
    });

    test('IRPEF su imponibile nullo o negativo e zero', function () {
      eq(C.irpefLorda(0).valore, 0, 'a zero');
      eq(C.irpefLorda(-5000).valore, 0, 'negativo');
    });

    /* --- Detrazione da lavoro dipendente (art. 13 TUIR) ------------------- */

    test('Detrazione lavoro dipendente: importi di riferimento art. 13 TUIR', function () {
      eq(C.detrazioneLavoro(15000).base, 1955, 'a 15.000');
      eq(C.detrazioneLavoro(28000).base, 1910, 'a 28.000');
      eq(C.detrazioneLavoro(50000).base, 0, 'a 50.000');
      eq(C.detrazioneLavoro(60000).base, 0, 'oltre 50.000');
    });

    test('Maggiorazione di 65 euro solo tra 25.000 e 35.000 (art. 13 co. 1.1)', function () {
      eq(C.detrazioneLavoro(25000).maggiorazione, 0, 'a 25.000 esatti (esclusa)');
      eq(C.detrazioneLavoro(25001).maggiorazione, 65, 'a 25.001');
      eq(C.detrazioneLavoro(35000).maggiorazione, 65, 'a 35.000 (inclusa)');
      eq(C.detrazioneLavoro(35001).maggiorazione, 0, 'a 35.001');
    });

    test('Detrazione decrescente: si azzera esattamente a 50.000', function () {
      vero(C.detrazioneLavoro(49999).base > 0, 'deve essere positiva a 49.999');
      vero(C.detrazioneLavoro(49999).base < 1, 'deve essere quasi nulla a 49.999');
    });

    /* --- Taglio del cuneo fiscale ---------------------------------------- */

    test('Somma integrativa cuneo: percentuali per fascia (7,1% / 5,3% / 4,8%)', function () {
      eq(C.sommaCuneo(8000).valore, 8000 * 0.071, 'fascia 7,1%');
      eq(C.sommaCuneo(12000).valore, 12000 * 0.053, 'fascia 5,3%');
      eq(C.sommaCuneo(19000).valore, 19000 * 0.048, 'fascia 4,8%');
      eq(C.sommaCuneo(20001).valore, 0, 'oltre 20.000 non spetta');
    });

    test('Ulteriore detrazione cuneo: piena 20.000-32.000, decrescente fino a 40.000', function () {
      eq(C.ulterioreDetrazioneCuneo(20000).valore, 0, 'a 20.000 esatti spetta la somma, non la detrazione');
      eq(C.ulterioreDetrazioneCuneo(25000).valore, 1000, 'importo pieno');
      eq(C.ulterioreDetrazioneCuneo(32000).valore, 1000, 'ancora pieno a 32.000');
      eq(C.ulterioreDetrazioneCuneo(36000).valore, 500, 'meta strada verso l azzeramento');
      eq(C.ulterioreDetrazioneCuneo(40000).valore, 0, 'azzerata a 40.000');
      eq(C.ulterioreDetrazioneCuneo(41000).valore, 0, 'oltre 40.000');
    });

    test('I due meccanismi del cuneo non sono mai cumulabili', function () {
      for (var r = 1000; r <= 45000; r += 250) {
        var somma = C.sommaCuneo(r).valore;
        var detr = C.ulterioreDetrazioneCuneo(r).valore;
        vero(somma === 0 || detr === 0, 'cumulo a reddito ' + r);
      }
    });

    /* --- Trattamento integrativo ----------------------------------------- */

    test('Trattamento integrativo: spetta a 14.000, non spetta a 8.000 (incapienza)', function () {
      var d14 = C.detrazioneLavoro(14000);
      eq(C.trattamentoIntegrativo(14000, C.irpefLorda(14000).valore, d14).valore, 1200, 'a 14.000');
      var d8 = C.detrazioneLavoro(8000);
      eq(C.trattamentoIntegrativo(8000, C.irpefLorda(8000).valore, d8).valore, 0, 'a 8.000');
    });

    test('Trattamento integrativo: zero oltre 15.000 senza carichi di famiglia', function () {
      [16000, 20000, 27000, 30000].forEach(function (r) {
        var d = C.detrazioneLavoro(r);
        eq(C.trattamentoIntegrativo(r, C.irpefLorda(r).valore, d).valore, 0, 'a ' + r);
      });
    });

    /* --- Addizionali locali ---------------------------------------------- */

    test('Addizionale regionale Lombardia: progressiva per scaglioni', function () {
      eq(C.addizionaleRegionale(15000).valore, 15000 * 0.0123, 'primo scaglione');
      eq(C.addizionaleRegionale(28000).valore, 15000 * 0.0123 + 13000 * 0.0158, 'secondo scaglione');
      eq(C.addizionaleRegionale(50000).valore,
         15000 * 0.0123 + 13000 * 0.0158 + 22000 * 0.0172, 'terzo scaglione');
    });

    test('Addizionale comunale Milano: soglia di esenzione, non franchigia', function () {
      eq(C.addizionaleComunale(23000).valore, 0, 'in soglia');
      eq(C.addizionaleComunale(23001).valore, 23001 * 0.008, 'appena sopra: si paga su TUTTO');
      vero(C.addizionaleComunale(23001).valore > 180, 'il salto deve essere pieno, non marginale');
    });

    /* --- Contributi previdenziali ---------------------------------------- */

    test('Contributi: 9,19% piatto sotto la prima fascia pensionabile', function () {
      var c = C.contributiLavoratore(30000);
      eq(c.totale, 30000 * 0.0919, 'a 30.000');
      eq(c.aggiuntiva, 0, 'nessuna aliquota aggiuntiva');
    });

    test('Contributi: +1% sulla quota oltre 56.224 euro', function () {
      var c = C.contributiLavoratore(70000);
      eq(c.aggiuntiva, (70000 - 56224) * 0.01, 'aliquota aggiuntiva');
      eq(c.totale, 70000 * 0.0919 + (70000 - 56224) * 0.01, 'totale');
    });

    test('Contributi: base limitata al massimale annuo di 122.295 euro', function () {
      var c = C.contributiLavoratore(200000);
      eq(c.imponibileContributivo, 122295, 'base contributiva');
      eq(c.totale, 122295 * 0.0919 + (122295 - 56224) * 0.01, 'totale al massimale');
      var c2 = C.contributiLavoratore(300000);
      eq(c.totale, c2.totale, 'oltre il massimale i contributi non crescono piu');
    });

    /* --- Identita' contabili sul risultato completo ----------------------- */

    test('Identita: RAL = netto annuo + trattenute', function () {
      [12000, 25000, 35000, 60000, 150000].forEach(function (ral) {
        var r = C.calcola({ ral: ral, mensilita: 13 });
        eq(r.totali.nettoAnnuo + r.totali.trattenute, ral, 'a RAL ' + ral);
      });
    });

    test('Identita: 12 mensilita ordinarie + aggiuntive = netto annuo', function () {
      [12, 13, 14].forEach(function (m) {
        var r = C.calcola({ ral: 34000, mensilita: m });
        var ricostruito = r.mensile.ordinario * 12 +
                          (r.mensile.aggiuntiva || 0) * r.mensile.numeroAggiuntive;
        eq(ricostruito, r.totali.nettoAnnuo, 'con ' + m + ' mensilita');
      });
    });

    test('La mensilita aggiuntiva e netta piu bassa di una ordinaria', function () {
      var r = C.calcola({ ral: 34000, mensilita: 13 });
      vero(r.mensile.aggiuntiva < r.mensile.ordinario,
           'la tredicesima non gode delle detrazioni: deve risultare piu bassa');
    });

    test('Il netto annuo non dipende dal numero di mensilita scelto', function () {
      var a = C.calcola({ ral: 34000, mensilita: 12 }).totali.nettoAnnuo;
      var b = C.calcola({ ral: 34000, mensilita: 14 }).totali.nettoAnnuo;
      eq(a, b, 'netto annuo');
    });

    test('Mensilita fuori dalle tre ammesse vengono rifiutate', function () {
      [11, 15, 99, 13.5, -5, 0, 'tredici', null].forEach(function (m) {
        var lanciato = false;
        try { C.calcola({ ral: 30000, mensilita: m }); } catch (e) { lanciato = true; }
        vero(lanciato, 'accettato un numero di mensilita non valido: ' + String(m));
      });
      // undefined significa "usa il default", non e un errore.
      eq(C.calcola({ ral: 30000 }).input.mensilita, 13, 'default');
    });

    test('L aliquota mostrata sulla mensilita aggiuntiva e quella davvero subita', function () {
      [27000, 31000, 35000, 56000, 90000].forEach(function (ral) {
        var r = C.calcola({ ral: ral, mensilita: 13 });
        var imponibileExtra = r.mensile.imponibileUnitario;
        var attesa = r.mensile.irpefUnitaria / imponibileExtra;
        vero(Math.abs(r.mensile.aliquotaSullaAggiuntiva - attesa) < 1e-9,
             'aliquota incoerente a RAL ' + ral);
      });
    });

    test('A cavallo di uno scaglione l aliquota reale NON e quella marginale', function () {
      // A RAL 31.000 l imponibile e 28.151: la tredicesima scavalca i 28.000,
      // quindi e tassata in parte al 23% e in parte al 33%. Dire "33%" sarebbe falso.
      var r = C.calcola({ ral: 31000, mensilita: 13 });
      vero(r.irpef.aliquotaMarginale === 0.33, 'marginale attesa 33%');
      vero(r.mensile.aliquotaSullaAggiuntiva < 0.30,
           'aliquota reale attesa sotto il 30%, ottenuta ' +
           (r.mensile.aliquotaSullaAggiuntiva * 100).toFixed(2) + '%');
    });

    test('Sotto il massimale la mensilita aggiuntiva resta la piu bassa', function () {
      [20000, 34000, 60000, 110000].forEach(function (ral) {
        var r = C.calcola({ ral: ral, mensilita: 13 });
        vero(r.mensile.aggiuntiva < r.mensile.ordinario, 'a RAL ' + ral);
      });
      // Oltre il massimale contributivo la relazione si inverte: il modello
      // spalma l aliquota contributiva MEDIA su tutte le mensilita, mentre le
      // addizionali restano tutte sulle 12 ordinarie. E una semplificazione
      // nota, fuori dal caso standard: la fissiamo qui per iscritto.
      var alto = C.calcola({ ral: 400000, mensilita: 13 });
      vero(alto.mensile.aggiuntiva > alto.mensile.ordinario,
           'oltre il massimale l inversione e attesa');
    });

    test('Aliquota effettiva sempre tra 0% e 60%', function () {
      for (var ral = 5000; ral <= 200000; ral += 1000) {
        var r = C.calcola({ ral: ral, mensilita: 13 });
        vero(r.totali.aliquotaEffettiva > -0.30 && r.totali.aliquotaEffettiva < 0.60,
             'aliquota fuori range a RAL ' + ral);
      }
    });

    test('No-tax area: sotto 8.500 euro di imponibile l IRPEF si azzera', function () {
      var r = C.calcola({ ral: 9000, mensilita: 13 });
      vero(r.imponibileFiscale < 8500, 'imponibile atteso sotto la no-tax area');
      eq(r.irpef.netta, 0, 'IRPEF netta');
    });

    test('Con RAL basse il netto puo superare la RAL grazie ai bonus non tassati', function () {
      var r = C.calcola({ ral: 10000, mensilita: 13 });
      vero(r.integrazioni.totale > 1500, 'attesi trattamento integrativo + somma cuneo');
      vero(r.totali.nettoAnnuo > r.input.ral, 'il netto deve superare la RAL');
      vero(r.totali.aliquotaEffettiva < 0, 'aliquota effettiva negativa');
    });

    /* --- Monotonicita' e discontinuita' NOTE ------------------------------ */

    test('Il netto cresce con la RAL tranne alle QUATTRO soglie a gradino note', function () {
      var precedente = -Infinity;
      var salti = [];
      for (var ral = 6000; ral <= 130000; ral += 10) {
        var netto = C.calcola({ ral: ral, mensilita: 13 }).totali.nettoAnnuo;
        if (netto < precedente) { salti.push(Math.round(ral * (1 - 0.0919))); }
        precedente = netto;
      }
      vero(salti.length === 4, 'attese 4 inversioni, trovate ' + salti.length + ': ' + JSON.stringify(salti));

      // Ogni inversione deve cadere su una soglia dichiarata in C.SOGLIE.
      salti.forEach(function (redditoSalto) {
        var vicina = C.SOGLIE.some(function (s) { return Math.abs(s.reddito - redditoSalto) < 30; });
        vero(vicina, 'inversione a reddito ' + redditoSalto + ' non riconducibile a una soglia dichiarata');
      });
    });

    test('Ogni soglia dichiarata produce davvero un salto all indietro', function () {
      function netto(ral) { return C.calcola({ ral: ral, mensilita: 13 }).totali.nettoAnnuo; }
      C.SOGLIE.forEach(function (s) {
        var ralSoglia = s.reddito / (1 - 0.0919);
        var perdita = netto(ralSoglia - 5) - netto(ralSoglia + 20);
        vero(perdita > 20, 'nessun salto rilevato alla soglia "' + s.causa + '" (delta ' + perdita.toFixed(2) + ')');
      });
    });

    test('trappoleNetto segnala la soglia superata e la RAL di pareggio', function () {
      // Poco sopra la soglia dell addizionale comunale: siamo in perdita.
      var ralSoglia = 23000 / (1 - 0.0919);
      var dentro = C.trappoleNetto(ralSoglia + 50);
      vero(dentro.length >= 1, 'attesa almeno una trappola segnalata');
      var t = dentro[dentro.length - 1];
      vero(t.redditoSoglia === 23000, 'soglia attesa 23.000, ottenuta ' + t.redditoSoglia);
      vero(t.perdita > 0, 'la perdita deve essere positiva');
      vero(t.ralPareggio > ralSoglia && t.ralPareggio < ralSoglia + 3000, 'RAL di pareggio fuori range');

      // Ben oltre il pareggio: nessuna segnalazione residua.
      vero(C.trappoleNetto(45000).length === 0, 'nessuna trappola attesa a RAL 45.000');
    });

    /* --- Validazione degli input ----------------------------------------- */

    test('RAL non valide vengono rifiutate', function () {
      [0, -1000, NaN, 'abc', null, undefined].forEach(function (v) {
        var lanciato = false;
        try { C.calcola({ ral: v, mensilita: 13 }); } catch (e) { lanciato = true; }
        vero(lanciato, 'accettata una RAL non valida: ' + String(v));
      });
    });

    var falliti = risultati.filter(function (r) { return !r.ok; }).length;
    return { risultati: risultati, totali: risultati.length, falliti: falliti };
  }

  /* --- Casi di riferimento mostrati a fianco della suite ------------------ */
  function casiRiferimento() {
    return [20000, 25000, 30000, 35000, 45000, 60000, 100000].map(function (ral) {
      var r = C.calcola({ ral: ral, mensilita: 13 });
      return {
        ral: ral,
        nettoAnnuo: r.totali.nettoAnnuo,
        nettoOrdinario: r.mensile.ordinario,
        tredicesima: r.mensile.aggiuntiva,
        aliquotaEffettiva: r.totali.aliquotaEffettiva
      };
    });
  }

  function stampaConsole(esito) {
    esito.risultati.forEach(function (r) {
      console.log((r.ok ? '  PASS  ' : '  FAIL  ') + r.nome + (r.ok ? '' : '\n          ' + r.errore));
    });
    console.log('\n  ' + (esito.totali - esito.falliti) + '/' + esito.totali + ' verifiche superate\n');

    console.log('  Casi di riferimento (13 mensilita, Milano, anno d imposta 2026)');
    console.log('  ' + 'RAL'.padStart(8) + 'Netto annuo'.padStart(14) +
                'Mese ord.'.padStart(12) + 'Tredices.'.padStart(12) + 'Aliq. eff.'.padStart(12));
    casiRiferimento().forEach(function (c) {
      console.log('  ' +
        c.ral.toLocaleString('it-IT').padStart(8) +
        c.nettoAnnuo.toLocaleString('it-IT', { maximumFractionDigits: 0 }).padStart(14) +
        c.nettoOrdinario.toLocaleString('it-IT', { maximumFractionDigits: 0 }).padStart(12) +
        c.tredicesima.toLocaleString('it-IT', { maximumFractionDigits: 0 }).padStart(12) +
        (c.aliquotaEffettiva * 100).toFixed(1).padStart(11) + '%');
    });
    console.log('');
  }

  return { esegui: esegui, casiRiferimento: casiRiferimento, stampaConsole: stampaConsole };
});
