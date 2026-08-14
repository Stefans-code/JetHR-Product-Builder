const RATES = {
  inps: 0.0919,
  comunaleMilano: 0.008,
  comunaleSogliaEsenzione: 23000,
};

function irpefLorda(rc){
  if (rc <= 28000) return rc * 0.23;
  if (rc <= 50000) return 28000*0.23 + (rc-28000)*0.33;
  return 28000*0.23 + 22000*0.33 + (rc-50000)*0.43;
}

function detrazioneLavoroDipendente(rc){
  let d;
  if (rc <= 15000) d = 1955;
  else if (rc <= 28000) d = 1910 + 1190 * (28000 - rc) / 13000;
  else if (rc <= 50000) d = 1910 * (50000 - rc) / 22000;
  else d = 0;
  if (rc >= 25000 && rc <= 35000) d += 65; // ulteriore detrazione L. Bilancio 2026
  return Math.max(0, d);
}

function addizionaleRegionaleLombardia(rc){
  if (rc <= 15000) return rc * 0.0123;
  if (rc <= 28000) return 15000*0.0123 + (rc-15000)*0.0158;
  if (rc <= 50000) return 15000*0.0123 + 13000*0.0158 + (rc-28000)*0.0172;
  return 15000*0.0123 + 13000*0.0158 + 22000*0.0172 + (rc-50000)*0.0173;
}

function addizionaleComunaleMilano(rc){
  return rc > RATES.comunaleSogliaEsenzione ? rc * RATES.comunaleMilano : 0;
}

function calcola(ral){
  const inps = ral * RATES.inps;
  const imponibileFiscale = Math.max(0, ral - inps);

  const lorda = irpefLorda(imponibileFiscale);
  const detrazione = detrazioneLavoroDipendente(imponibileFiscale);
  const irpefNetta = Math.max(0, lorda - detrazione);

  const addRegionale = addizionaleRegionaleLombardia(imponibileFiscale);
  const addComunale = addizionaleComunaleMilano(imponibileFiscale);

  const totaleTrattenute = inps + irpefNetta + addRegionale + addComunale;
  const nettoAnnuo = ral - totaleTrattenute;
  const nettoMensile = nettoAnnuo / 12;

  return {
    ral, inps, imponibileFiscale, lorda, detrazione, irpefNetta,
    addRegionale, addComunale, totaleTrattenute, nettoAnnuo, nettoMensile
  };
}

function euro(n){
  return n.toLocaleString('it-IT', {style:'currency', currency:'EUR', maximumFractionDigits:0});
}

function render(r){
  const out = document.getElementById('output');
  out.innerHTML = `
    <div class="result-hero">
      <div class="stat">
        <div class="k">Netto annuo</div>
        <div class="v">${euro(r.nettoAnnuo)}</div>
      </div>
      <div class="stat">
        <div class="k">Netto mensile <span style="font-weight:400">(12 mensilità)</span></div>
        <div class="v mensile">${euro(r.nettoMensile)}</div>
      </div>
    </div>

    <div class="breakdown">
      <h2>Voci trattenute al lordo</h2>

      <div class="line">
        <div class="label">RAL — retribuzione lorda annua</div>
        <div class="amt">${euro(r.ral)}</div>
      </div>

      <div class="line deduzione">
        <div class="label">Contributi INPS a carico lavoratore <span class="rate-tag">9,19%</span>
          <small>Quota IVS trattenuta in busta, versata alla previdenza</small>
        </div>
        <div class="amt">− ${euro(r.inps)}</div>
      </div>

      <div class="line">
        <div class="label">Imponibile fiscale <small>RAL − contributi INPS</small></div>
        <div class="amt">${euro(r.imponibileFiscale)}</div>
      </div>

      <div class="line deduzione">
        <div class="label">IRPEF lorda <small>Scaglioni 23% / 33% / 43% — art. 11 TUIR</small></div>
        <div class="amt">− ${euro(r.lorda)}</div>
      </div>

      <div class="line">
        <div class="label">Detrazione lavoro dipendente <small>art. 13 TUIR, decrescente col reddito</small></div>
        <div class="amt">+ ${euro(r.detrazione)}</div>
      </div>

      <div class="line deduzione">
        <div class="label">IRPEF netta <small>IRPEF lorda − detrazione (min. 0)</small></div>
        <div class="amt">− ${euro(r.irpefNetta)}</div>
      </div>

      <div class="line deduzione">
        <div class="label">Addizionale regionale <small>Lombardia, a scaglioni 1,23%–1,73%</small></div>
        <div class="amt">− ${euro(r.addRegionale)}</div>
      </div>

      <div class="line deduzione">
        <div class="label">Addizionale comunale <small>Milano, 0,8% oltre € 23.000 di imponibile</small></div>
        <div class="amt">− ${euro(r.addComunale)}</div>
      </div>

      <div class="line totale">
        <div class="label">Totale trattenute</div>
        <div class="amt">${euro(r.totaleTrattenute)}</div>
      </div>
    </div>

    <div class="assumptions">
      <h3>Semplificazioni applicate</h3>
      <ul>
        <li>Dipendente privato a tempo indeterminato, 12 mensilità, nessun arretrato o conguaglio.</li>
        <li>Nessun familiare a carico, nessuna spesa detraibile, nessun bonus/agevolazione (es. ZES, impatriati).</li>
        <li>Contributi INPS calcolati al 9,19% sull'intera RAL, senza applicare il massimale contributivo né l'aliquota aggiuntiva dell'1% oltre € 56.224 (categoria rara per un ruolo junior/mid).</li>
        <li>Non è simulato il trattamento integrativo ("bonus Renzi") per i redditi più bassi, né la soglia di incapienza sotto € 8.500.</li>
        <li>Addizionale comunale di Milano trattata come aliquota unica 0,8% con esenzione piena sotto € 23.000, per assenza di delibera 2026 aggiornata (valore 2025 riportato come fallback).</li>
        <li>TFR non incluso: è una voce di retribuzione differita, non parte dello stipendio netto mensile/annuale percepito.</li>
      </ul>
    </div>
  `;
}

// Estrae solo le cifre da quanto digitato: "25.000", "25000", "25 000" -> 25000.
// Evita l'ambiguità del punto come separatore decimale di type="number".
function parseRal(raw){
  const digits = raw.replace(/[^\d]/g, '');
  return digits ? parseInt(digits, 10) : NaN;
}

function formatRalInput(raw){
  const n = parseRal(raw);
  return isNaN(n) ? '' : n.toLocaleString('it-IT');
}

const ralInput = document.getElementById('ral');

// Formatta con separatore delle migliaia mentre l'utente digita.
ralInput.addEventListener('input', (e) => {
  const cursorFromEnd = e.target.value.length - e.target.selectionStart;
  e.target.value = formatRalInput(e.target.value);
  const newPos = e.target.value.length - cursorFromEnd;
  e.target.setSelectionRange(newPos, newPos);
});

document.getElementById('calcola').addEventListener('click', () => {
  const val = parseRal(ralInput.value);
  if (!val || val <= 0){
    document.getElementById('output').innerHTML = '<div class="placeholder">Inserisci una RAL valida (numero maggiore di zero).</div>';
    return;
  }
  render(calcola(val));
});

ralInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') document.getElementById('calcola').click();
});
