/* Epicenter Exchange calculators v3 - SIP, Step-up SIP, EMI, Retirement, India tax (FY25-26), FX converter. */
(function(){
  'use strict';
  function $(s,r){return (r||document).querySelector(s);}
  function $$(s,r){return Array.prototype.slice.call((r||document).querySelectorAll(s));}
  function inr(n){if(!isFinite(n))return '--';return '\u20B9'+Math.round(n).toLocaleString('en-IN');}
  function inrShort(n){if(!isFinite(n))return '--';if(Math.abs(n)>=10000000)return '\u20B9'+(n/10000000).toFixed(2)+' Cr';if(Math.abs(n)>=100000)return '\u20B9'+(n/100000).toFixed(2)+' L';return inr(n);}
  var API = 'https://api.epicenterexchange.com';

  // Tabs
  $$('.calc-tab').forEach(function(btn){
    btn.addEventListener('click', function(){
      var t = btn.getAttribute('data-tab');
      $$('.calc-tab').forEach(function(b){b.classList.toggle('active', b===btn);});
      $$('.calc-panel').forEach(function(p){p.style.display = (p.id===t) ? '' : 'none';});
      if(t==='panel-fx') ensureFX();
      if(t==='panel-tax') calcTax();
    });
  });

  // Range binding helper
  function bindRange(id, lblId, fmt){
    var inp=$('#'+id), lbl=$('#'+lblId);
    if(!inp||!lbl) return;
    function up(){lbl.textContent = fmt(parseFloat(inp.value));}
    inp.addEventListener('input', up); up();
  }
  bindRange('sip-amt','sip-amt-lbl', function(v){return '\u20B9'+v.toLocaleString('en-IN');});
  bindRange('sip-yrs','sip-yrs-lbl', function(v){return v+' yrs';});
  bindRange('sip-rate','sip-rate-lbl', function(v){return v+'%';});
  bindRange('sup-amt','sup-amt-lbl', function(v){return '\u20B9'+v.toLocaleString('en-IN');});
  bindRange('sup-yrs','sup-yrs-lbl', function(v){return v+' yrs';});
  bindRange('sup-rate','sup-rate-lbl', function(v){return v+'%';});
  bindRange('sup-step','sup-step-lbl', function(v){return v+'%';});
  bindRange('emi-amt','emi-amt-lbl', function(v){return '\u20B9'+v.toLocaleString('en-IN');});
  bindRange('emi-yrs','emi-yrs-lbl', function(v){return v+' yrs';});
  bindRange('emi-rate','emi-rate-lbl', function(v){return v+'%';});
  bindRange('ret-current-age','ret-current-age-lbl', function(v){return v+' yrs';});
  bindRange('ret-age','ret-age-lbl', function(v){return v+' yrs';});
  bindRange('ret-monthly','ret-monthly-lbl', function(v){return '\u20B9'+v.toLocaleString('en-IN');});
  bindRange('ret-rate','ret-rate-lbl', function(v){return v+'%';});

  // SIP
  function calcSIP(){
    var amt = parseFloat($('#sip-amt').value)||0;
    var yrs = parseFloat($('#sip-yrs').value)||0;
    var rate = parseFloat($('#sip-rate').value)||0;
    var n = yrs*12, r = (rate/100)/12;
    var fv = r===0 ? amt*n : amt*((Math.pow(1+r,n)-1)/r)*(1+r);
    var inv = amt*n;
    $('#sip-future').textContent = inrShort(fv);
    $('#sip-invested').textContent = inr(inv);
    $('#sip-gain').textContent = inr(fv-inv);
  }

  // Step-up SIP
  function calcSup(){
    var start = parseFloat($('#sup-amt').value)||0;
    var yrs = parseFloat($('#sup-yrs').value)||0;
    var rate = parseFloat($('#sup-rate').value)||0;
    var step = parseFloat($('#sup-step').value)||0;
    var rm = (rate/100)/12, sg = step/100;
    var fv = 0, inv = 0, monthly = start;
    var totalMonths = yrs*12;
    for(var y=0; y<yrs; y++){
      for(var m=0; m<12; m++){
        inv += monthly;
        var monthsRemaining = totalMonths - (y*12 + m);
        fv += monthly * (rm===0 ? 1 : Math.pow(1+rm, monthsRemaining));
      }
      monthly *= (1+sg);
    }
    $('#sup-future').textContent = inrShort(fv);
    $('#sup-invested').textContent = inr(inv);
    $('#sup-gain').textContent = inr(fv-inv);
  }

  // EMI
  function calcEMI(){
    var p = parseFloat($('#emi-amt').value)||0;
    var rate = parseFloat($('#emi-rate').value)||0;
    var yrs = parseFloat($('#emi-yrs').value)||0;
    var n = yrs*12, r = (rate/100)/12;
    var emi = r===0 ? p/n : (p*r*Math.pow(1+r,n))/(Math.pow(1+r,n)-1);
    var total = emi*n;
    $('#emi-monthly').textContent = inr(emi);
    $('#emi-total').textContent = inrShort(total);
    $('#emi-interest').textContent = inrShort(total-p);
  }

  // Retirement
  function calcRet(){
    var cur = parseFloat($('#ret-current-age').value)||0;
    var retA = parseFloat($('#ret-age').value)||0;
    var monthly = parseFloat($('#ret-monthly').value)||0;
    var rate = parseFloat($('#ret-rate').value)||0;
    var years = Math.max(0, retA-cur);
    var n = years*12, r = (rate/100)/12;
    var fv = r===0 ? monthly*n : monthly*((Math.pow(1+r,n)-1)/r)*(1+r);
    var inv = monthly*n;
    $('#ret-corpus').textContent = inrShort(fv);
    $('#ret-invested').textContent = inr(inv);
    $('#ret-gain').textContent = inr(fv-inv);
    $('#ret-years').textContent = years+' years';
  }

  // India tax (FY25-26, post-July 23 2024 budget)
  function taxNeedsSlab(asset, months){
    if(asset==='debt_mf') return true;
    if(asset==='us_stocks' && months<=24) return true;
    if(asset==='gold' && months<=24) return true;
    return false;
  }
  function updateTaxSlabVisibility(){
    var asset = $('#tax-asset').value;
    var months = parseFloat($('#tax-holding').value)||0;
    $('#tax-slab-row').style.display = taxNeedsSlab(asset, months) ? '' : 'none';
  }
  function calcTax(){
    var asset = $('#tax-asset').value;
    var gain = parseFloat($('#tax-gain').value)||0;
    var months = parseFloat($('#tax-holding').value)||0;
    var slab = parseFloat($('#tax-slab').value)||0;
    updateTaxSlabVisibility();
    var tax = 0, regime = '', note = '';
    if(asset==='listed_eq'){
      if(months<=12){ tax = gain*0.20; regime = 'STCG (\u226412 mo): 20%'; }
      else {
        var exempt = Math.min(gain, 125000);
        var taxable = Math.max(0, gain-125000);
        tax = taxable*0.125;
        regime = 'LTCG (>12 mo): 12.5% on gains above \u20B91.25 lakh';
        note = inr(exempt)+' tax-free per year';
      }
    } else if(asset==='debt_mf'){
      tax = gain*slab/100;
      regime = 'Slab rate ('+slab+'%) - no LTCG benefit since Apr 2023';
    } else if(asset==='crypto'){
      tax = gain*0.312;
      regime = 'Section 115BBH: 30% + 4% cess = 31.2%';
      note = 'No exemptions, no loss set-off';
    } else if(asset==='us_stocks'){
      if(months<=24){ tax = gain*slab/100; regime = 'STCG (\u226424 mo): slab rate ('+slab+'%)'; }
      else { tax = gain*0.125; regime = 'LTCG (>24 mo): 12.5% (post-July 2024)'; }
    } else if(asset==='gold'){
      if(months<=24){ tax = gain*slab/100; regime = 'STCG (\u226424 mo): slab rate ('+slab+'%)'; }
      else { tax = gain*0.125; regime = 'LTCG (>24 mo): 12.5% (post-July 2024)'; }
    }
    var effRate = gain>0 ? (tax/gain*100).toFixed(2) : '0.00';
    $('#tax-out').innerHTML =
      '<p class="big">'+inr(tax)+'</p>'+
      '<p class="sub">'+regime+'</p>'+
      (note ? '<p class="sub" style="color:#10B981">'+note+'</p>' : '')+
      '<p class="sub small">Effective rate: '+effRate+'%</p>'+
      '<p class="sub small">Net of tax: '+inr(gain-tax)+'</p>';
  }

  // FX converter (via backend /forex)
  var fxRates = null, fxBase = null, fxTime = '';
  function ensureFX(){
    var from = $('#fx-from') ? $('#fx-from').value : 'INR';
    if(fxBase===from && fxRates) { calcFX(); return; }
    fetch(API+'/forex?base='+encodeURIComponent(from))
      .then(function(r){if(!r.ok)throw 0;return r.json();})
      .then(function(j){
        fxRates = j.rates; fxBase = j.base; fxTime = j.time||'';
        if($('#fx-stamp')) $('#fx-stamp').textContent = fxTime ? ('Last updated: '+fxTime) : '';
        calcFX();
      })
      .catch(function(){
        $('#fx-out').textContent = '--';
        $('#fx-rate').textContent = 'Could not fetch live rates. Try again later.';
      });
  }
  function calcFX(){
    var amt = parseFloat($('#fx-amt').value)||0;
    var from = $('#fx-from').value;
    var to = $('#fx-to').value;
    if(!fxRates || fxBase!==from){ ensureFX(); return; }
    var rate = fxRates[to];
    if(rate==null){ $('#fx-out').textContent='--'; $('#fx-rate').textContent='No rate for '+to; return; }
    var conv = amt*rate;
    $('#fx-out').textContent = conv.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})+' '+to;
    $('#fx-rate').textContent = '1 '+from+' = '+rate.toFixed(4)+' '+to;
  }

  // Wire input listeners
  $$('#sip-form input').forEach(function(i){i.addEventListener('input', calcSIP);});
  $$('#sup-form input').forEach(function(i){i.addEventListener('input', calcSup);});
  $$('#emi-form input').forEach(function(i){i.addEventListener('input', calcEMI);});
  $$('#ret-form input').forEach(function(i){i.addEventListener('input', calcRet);});
  ['tax-asset','tax-gain','tax-holding','tax-slab'].forEach(function(id){
    var el = $('#'+id);
    if(el) el.addEventListener('input', calcTax);
    if(el && el.tagName==='SELECT') el.addEventListener('change', calcTax);
  });
  ['fx-amt','fx-from','fx-to'].forEach(function(id){
    var el = $('#'+id);
    if(el){
      el.addEventListener('input', function(){ if(id==='fx-from'){fxBase=null;fxRates=null;ensureFX();} else calcFX(); });
      if(el.tagName==='SELECT') el.addEventListener('change', function(){ if(id==='fx-from'){fxBase=null;fxRates=null;ensureFX();} else calcFX(); });
    }
  });

  // Initial render
  if($('#sip-amt')) calcSIP();
  if($('#sup-amt')) calcSup();
  if($('#emi-amt')) calcEMI();
  if($('#ret-current-age')) calcRet();
  if($('#tax-asset')) { updateTaxSlabVisibility(); calcTax(); }
  // FX loads only when its tab is opened (saves an API call)
})();
