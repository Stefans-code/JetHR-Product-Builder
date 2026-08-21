/* =============================================================================
 * INTERFACCIA
 * -----------------------------------------------------------------------------
 * Unico file che tocca il DOM. Non contiene nessuna regola fiscale: legge
 * valori e formule gia' pronti da Calcolo.calcola(). Se una cifra a video
 * e' sbagliata, l'errore e' in src/calcolo.js, non qui.
 * ========================================================================== */

(function () {
  'use strict';

  var C = window.Calcolo;

  /* --- formattazione -------------------------------------------------------- */

  // useGrouping esplicito: in it-IT il default "min2" non separa le migliaia
  // sotto i 10.000, e "8968 €" accanto a "26.032 €" e' incoerente.
  var fEuro = new Intl.NumberFormat('it-IT', {
    style: 'currency', currency: 'EUR', useGrouping: true,
    minimumFractionDigits: 0, maximumFractionDigits: 0
  });
  var fPerc = new Intl.NumberFormat('it-IT', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  var fIntero = new Intl.NumberFormat('it-IT', { useGrouping: true, maximumFractionDigits: 0 });

  function euro(x) { return fEuro.format(x); }
  function perc(x) { return fPerc.format(x * 100) + '%'; }

  function testo(tag, classe, contenuto) {
    var el = document.createElement(tag);
    if (classe) { el.className = classe; }
    if (contenuto !== undefined) { el.textContent = contenuto; }
    return el;
  }

  /* --- riferimenti al DOM --------------------------------------------------- */

  var elModulo    = document.getElementById('modulo');
  var elRal       = document.getElementById('ral');
  var elErrore    = document.getElementById('errore');
  var elEsito     = document.getElementById('esito');
  var elAvvisi    = document.getElementById('avvisi');
  var elNetto     = document.getElementById('netto-annuo');
  var elContorno  = document.getElementById('netto-contorno');
  var elTessere   = document.getElementById('tessere');
  var elGrafico   = document.getElementById('grafico');
  var elLegenda   = document.getElementById('legenda');
  var elDettaglio = document.getElementById('dettaglio');
  var elCosto     = document.getElementById('costo-azienda');
  var elFormule   = document.getElementById('btn-formule');
  var elTooltip   = document.getElementById('tooltip');
  var elSoglie    = document.getElementById('elenco-soglie');

  /* --- campo RAL: separatore delle migliaia mentre si digita ---------------- */

  function soloCifre(grezzo) {
    var cifre = String(grezzo).replace(/\D/g, '');
    return cifre ? parseInt(cifre, 10) : NaN;
  }

  elRal.addEventListener('input', function (e) {
    var daFine = e.target.value.length - e.target.selectionStart;
    var v = soloCifre(e.target.value);
    e.target.value = isNaN(v) ? '' : fIntero.format(v);
    var pos = Math.max(0, e.target.value.length - daFine);
    e.target.setSelectionRange(pos, pos);
  });

  /* --- barra di composizione ------------------------------------------------ */

  function costruisciBarra(titolo, voci, totale) {
    var riga = testo('div', 'riga-barra');
    riga.appendChild(testo('div', 'titolo-barra', titolo));

    var barra = testo('div', 'barra');
    voci.forEach(function (v) {
      if (v.valore <= 0) { return; }
      var seg = testo('div', 'segmento');
      seg.style.width = (v.valore / totale * 100) + '%';
      seg.style.background = 'var(--serie-' + v.slot + ')';
      seg.setAttribute('tabindex', '0');
      seg.setAttribute('role', 'img');
      seg.setAttribute('aria-label', v.nome + ': ' + euro(v.valore) +
                       ', ' + perc(v.valore / totale) + ' della RAL');

      function mostra(e) {
        elTooltip.innerHTML = v.nome + ' &middot; <b>' + euro(v.valore) + '</b> (' + perc(v.valore / totale) + ')';
        var r = seg.getBoundingClientRect();
        var x = (e && e.clientX) ? e.clientX : r.left + r.width / 2;
        elTooltip.style.left = x + 'px';
        elTooltip.style.top = r.top + 'px';
        elTooltip.classList.add('visibile');
      }
      function nascondi() { elTooltip.classList.remove('visibile'); }

      seg.addEventListener('mouseenter', mostra);
      seg.addEventListener('mousemove', mostra);
      seg.addEventListener('mouseleave', nascondi);
      seg.addEventListener('focus', mostra);
      seg.addEventListener('blur', nascondi);

      barra.appendChild(seg);
    });

    riga.appendChild(barra);
    return riga;
  }

  /* --- tabella di dettaglio ------------------------------------------------- */

  function rigaDettaglio(r) {
    var tr = document.createElement('tr');
    if (r.tipo) { tr.className = r.tipo; }

    var td1 = document.createElement('td');
    if (r.tipo === 'sub') { td1.style.paddingLeft = '18px'; }

    var voce = testo('span', 'voce', r.voce);
    if (r.tipo === 'sub') { voce.style.fontWeight = '450'; voce.style.color = 'var(--text-2)'; }
    td1.appendChild(voce);

    if (r.fonte) { td1.appendChild(testo('span', 'fonte', r.fonte)); }
    if (r.formula) { td1.appendChild(testo('span', 'formula', r.formula)); }

    var td2 = testo('td', 'num' + (r.segno === '+' ? ' aggiunge' : r.segno === '−' ? ' sottrae' : ''));
    if (r.segno) {
      td2.appendChild(testo('span', 'segno', r.segno));
    }
    td2.appendChild(document.createTextNode(euro(r.valore)));

    tr.appendChild(td1);
    tr.appendChild(td2);
    return tr;
  }

  /* --- avvisi soglia -------------------------------------------------------- */

  // Sotto questa soglia il caso modellato (tempo pieno, 365 giorni) non regge:
  // si finirebbe sotto il minimale contributivo giornaliero INPS.
  var RAL_MINIMA_PLAUSIBILE = 6000;

  function costruisciAvvisi(ral) {
    elAvvisi.innerHTML = '';

    if (ral < RAL_MINIMA_PLAUSIBILE) {
      var nota = testo('div', 'avviso');
      nota.appendChild(testo('div', 'titolo-avviso', 'RAL fuori dal caso modellato'));
      nota.appendChild(testo('p', null,
        'Il calcolo assume un contratto a tempo pieno per 365 giorni. Sotto i ' +
        euro(RAL_MINIMA_PLAUSIBILE) + ' annui si è sotto il minimale contributivo ' +
        'giornaliero INPS: il risultato resta aritmeticamente coerente, ma descrive ' +
        'un part-time o un rapporto parziale che questo prototipo non modella.'));
      elAvvisi.appendChild(nota);
    }

    var trappole = C.trappoleNetto(ral);
    if (!trappole.length) { return; }

    trappole.forEach(function (t) {
      var box = testo('div', 'avviso');
      box.appendChild(testo('div', 'titolo-avviso', 'Sei appena sopra una soglia: ' + t.causa));

      var p1 = testo('p');
      p1.innerHTML = 'Con una RAL di <b>' + euro(t.ralSoglia) + '</b> il netto annuo sarebbe ' +
                     '<b>' + euro(t.nettoSoglia) + '</b>, cio&egrave; <b>' + euro(t.perdita) +
                     '</b> in pi&ugrave; di quanto ottieni ora. Il netto torna a quel livello ' +
                     'solo da <b>' + euro(t.ralPareggio) + '</b> di RAL in su.';
      box.appendChild(p1);
      box.appendChild(testo('p', null, t.descrizione));
      elAvvisi.appendChild(box);
    });
  }

  /* --- rendering completo --------------------------------------------------- */

  function disegna(r) {
    var ral = r.input.ral;

    /* sintesi */
    elNetto.textContent = euro(r.totali.nettoAnnuo);
    elContorno.textContent = r.totali.trattenute >= 0
      ? 'su ' + euro(ral) + ' di RAL \u2014 trattenute ' + euro(r.totali.trattenute) +
        ' (' + perc(r.totali.aliquotaEffettiva) + ' della RAL)'
      : 'su ' + euro(ral) + ' di RAL \u2014 i bonus non tassati superano le trattenute di ' +
        euro(-r.totali.trattenute);

    var tessere = [
      { k: 'Netto mensile', v: euro(r.mensile.ordinario),
        n: r.mensile.numeroAggiuntive ? 'ciascuna delle 12 mensilità ordinarie' : 'netto annuo diviso 12' }
    ];
    if (r.mensile.numeroAggiuntive) {
      tessere.push({
        k: r.mensile.numeroAggiuntive === 1 ? 'Tredicesima netta' : 'Tredicesima e quattordicesima',
        v: euro(r.mensile.aggiuntiva),
        // Aliquota REALE subita dalla mensilita' aggiuntiva: quando cade a
        // cavallo di due scaglioni non coincide con quella marginale.
        n: (r.mensile.numeroAggiuntive === 1 ? 'tassata' : 'ciascuna, tassata') +
           ' al ' + perc(r.mensile.aliquotaSullaAggiuntiva) + ', senza detrazioni'
      });
    }
    tessere.push({
      k: 'Aliquota effettiva',
      v: perc(r.totali.aliquotaEffettiva),
      n: r.totali.aliquotaEffettiva < 0
        ? 'negativa: i bonus superano le trattenute'
        : 'quota di RAL che non arriva in busta'
    });
    tessere.push({ k: 'Aliquota marginale', v: perc(r.irpef.aliquotaMarginale),
                   n: 'IRPEF sull’ultimo euro guadagnato' });

    elTessere.innerHTML = '';
    tessere.forEach(function (t) {
      var d = testo('div', 'tessera');
      d.appendChild(testo('div', 'k', t.k));
      d.appendChild(testo('div', 'v', t.v));
      d.appendChild(testo('div', 'n', t.n));
      elTessere.appendChild(d);
    });

    /* grafico */
    var nettoDaRal = ral - r.contributi.totale - r.irpef.netta - r.addizionali.totale;
    var voci = [
      { slot: 1, nome: 'Netto in busta', valore: nettoDaRal },
      { slot: 2, nome: 'Contributi INPS', valore: r.contributi.totale },
      { slot: 3, nome: 'IRPEF netta', valore: r.irpef.netta },
      { slot: 4, nome: 'Addizionali locali', valore: r.addizionali.totale }
    ];

    elGrafico.innerHTML = '';
    elGrafico.appendChild(costruisciBarra('RAL', voci, ral));

    var vociLegenda = voci.slice();
    if (r.integrazioni.totale > 0) {
      var bonus = { slot: 5, nome: 'Bonus non tassati', valore: r.integrazioni.totale };
      elGrafico.appendChild(costruisciBarra('+ bonus', [bonus], ral));
      vociLegenda.push(bonus);
    }

    elLegenda.innerHTML = '';
    vociLegenda.forEach(function (v) {
      var voce = testo('div', 'voce-legenda');
      var pastiglia = testo('span', 'pastiglia');
      pastiglia.style.background = 'var(--serie-' + v.slot + ')';
      voce.appendChild(pastiglia);

      var box = testo('div', 'testo');
      box.appendChild(testo('div', 'nome', v.nome));
      box.appendChild(testo('div', 'importo', euro(v.valore)));
      box.appendChild(testo('div', 'quota', perc(v.valore / ral) + ' della RAL'));
      voce.appendChild(box);
      elLegenda.appendChild(voce);
    });

    /* dettaglio */
    var righe = [
      { voce: 'Retribuzione annua lorda', valore: ral,
        fonte: 'il punto di partenza: quanto costa il lavoratore prima dei contributi del datore' },

      { voce: 'Contributi previdenziali a carico del lavoratore', valore: r.contributi.totale, segno: '−',
        fonte: 'quota IVS trattenuta in busta — INPS circ. 6/2026', formula: r.contributi.formula },

      { voce: 'Imponibile fiscale IRPEF', valore: r.imponibileFiscale, tipo: 'saldo',
        fonte: 'i contributi obbligatori non concorrono a formare il reddito (art. 51 co. 2 lett. a TUIR)' },

      { voce: 'IRPEF lorda', valore: r.irpef.lorda.valore, tipo: 'sub',
        fonte: 'scaglioni 23% / 33% / 43% — art. 11 TUIR, L. 199/2025',
        formula: r.irpef.lorda.formula },

      { voce: 'Detrazione per lavoro dipendente', valore: r.irpef.detrazione.valore, segno: '−', tipo: 'sub',
        fonte: 'art. 13 co. 1 e 1.1 TUIR, decrescente col reddito',
        formula: r.irpef.detrazione.formula },

      { voce: 'Ulteriore detrazione — taglio del cuneo', valore: r.irpef.detrazioneCuneo.valore,
        segno: '−', tipo: 'sub',
        fonte: 'L. 207/2024 art. 1 co. 6 — spetta da 20.000 a 40.000 € di reddito',
        formula: r.irpef.detrazioneCuneo.formula },

      { voce: 'IRPEF netta', valore: r.irpef.netta, tipo: 'saldo',
        fonte: r.irpef.incapiente ? 'detrazioni superiori all’imposta: l’IRPEF si azzera, la differenza non è rimborsata' : null },

      { voce: 'Addizionale regionale', valore: r.addizionali.regionale.valore, segno: '−',
        fonte: 'Lombardia, progressiva per scaglioni — art. 72 l.r. 10/2003',
        formula: r.addizionali.regionale.formula },

      { voce: 'Addizionale comunale', valore: r.addizionali.comunale.valore, segno: '−',
        fonte: 'Milano, 0,80% con soglia di esenzione a 23.000 €',
        formula: r.addizionali.comunale.formula },

      { voce: 'Somma integrativa — taglio del cuneo', valore: r.integrazioni.cuneo.valore, segno: '+',
        fonte: 'non è imponibile: si aggiunge al netto — L. 207/2024 art. 1 co. 4',
        formula: r.integrazioni.cuneo.formula },

      { voce: 'Trattamento integrativo', valore: r.integrazioni.trattamentoIntegrativo.valore, segno: '+',
        fonte: 'ex bonus Renzi — D.L. 3/2020 conv. L. 21/2020 art. 1',
        formula: r.integrazioni.trattamentoIntegrativo.formula },

      { voce: 'Netto annuo', valore: r.totali.nettoAnnuo, tipo: 'totale' }
    ];

    elDettaglio.innerHTML = '';
    righe.forEach(function (riga) { elDettaglio.appendChild(rigaDettaglio(riga)); });

    /* costo azienda */
    elCosto.innerHTML = '';
    [
      { k: 'Costo totale stimato', v: euro(r.costoAzienda.totale), n: 'RAL + contributi datore + TFR' },
      { k: 'Contributi datore', v: euro(r.costoAzienda.contributiDatore), n: 'stima 30% della RAL' },
      { k: 'TFR accantonato', v: euro(r.costoAzienda.tfr), n: 'RAL / 13,5' },
      { k: 'Cuneo complessivo', v: perc(1 - r.totali.nettoAnnuo / r.costoAzienda.totale),
        n: 'differenza tra costo azienda e netto' }
    ].forEach(function (t) {
      var d = testo('div', 'tessera');
      d.appendChild(testo('div', 'k', t.k));
      d.appendChild(testo('div', 'v', t.v));
      d.appendChild(testo('div', 'n', t.n));
      elCosto.appendChild(d);
    });

    costruisciAvvisi(ral);

    elEsito.hidden = false;
  }

  /* --- ciclo principale ----------------------------------------------------- */

  function mensilitaScelte() {
    var scelta = document.querySelector('input[name="mensilita"]:checked');
    return scelta ? Number(scelta.value) : 13;
  }

  function calcolaEDisegna(scrolla) {
    var ral = soloCifre(elRal.value);

    if (isNaN(ral) || ral <= 0) {
      elErrore.textContent = 'Inserisci una RAL valida: un numero maggiore di zero.';
      elEsito.hidden = true;
      return;
    }
    if (ral > 5000000) {
      elErrore.textContent = 'Oltre 5.000.000 € il prototipo non ha più senso: il caso standard modellato è un altro.';
      elEsito.hidden = true;
      return;
    }
    elErrore.textContent = '';

    var mensilita = mensilitaScelte();
    disegna(C.calcola({ ral: ral, mensilita: mensilita }));

    // Stato nell'indirizzo: il risultato diventa condivisibile.
    var query = '?ral=' + ral + '&mensilita=' + mensilita;
    history.replaceState(null, '', location.pathname + query);

    if (scrolla && elEsito.scrollIntoView) {
      elEsito.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  elModulo.addEventListener('submit', function (e) {
    e.preventDefault();
    calcolaEDisegna(true);
  });

  // Cambiare le mensilita' ricalcola subito, se c'e' gia' un risultato a video.
  Array.prototype.forEach.call(document.querySelectorAll('input[name="mensilita"]'), function (radio) {
    radio.addEventListener('change', function () {
      if (!elEsito.hidden) { calcolaEDisegna(false); }
    });
  });

  elFormule.addEventListener('click', function () {
    var attivo = elFormule.getAttribute('aria-pressed') === 'true';
    elFormule.setAttribute('aria-pressed', String(!attivo));
    elFormule.textContent = attivo ? 'Mostra le formule' : 'Nascondi le formule';
    elDettaglio.classList.toggle('compatta', attivo);
  });

  /* --- soglie elencate nella sezione metodo --------------------------------- */

  C.SOGLIE.forEach(function (s) {
    var li = document.createElement('li');
    li.innerHTML = '<strong>' + fIntero.format(s.reddito) + ' € di reddito — ' +
                   s.causa + '.</strong> ' + s.descrizione;
    elSoglie.appendChild(li);
  });

  /* --- stato iniziale da URL ------------------------------------------------ */

  (function inizializza() {
    var parametri = new URLSearchParams(location.search);
    var ral = soloCifre(parametri.get('ral') || '');
    var mensilita = parametri.get('mensilita');

    if (mensilita && ['12', '13', '14'].indexOf(mensilita) !== -1) {
      document.getElementById('m' + mensilita).checked = true;
    }
    if (!isNaN(ral) && ral > 0) {
      elRal.value = fIntero.format(ral);
      calcolaEDisegna(false);
    }
    elRal.focus();
  })();

})();
