/* Epicenter Exchange — extra tools: currency converter, tax estimator (India), step-up SIP.
   All client-side. Currency rates from exchangerate.host (free, no key, with frankfurter.app fallback). */
(function(){
  'use strict';
  function $(s){return document.querySelector(s);}

  /* ---------- Step-up SIP ---------- */
  if($('#sup-amt')){
    function ssip(){
      var amt=parseFloat($('#sup-amt').value)||0;
      var yrs=parseFloat($('#sup-yrs').value)||0;
      var rate=parseFloat($('#sup-rate').value)||0;
      var step=parseFloat($('#sup-step').value)||0;
      var r=(rate/100)/12;var fv=0;var inv=0;var cur=amt;
      for(var y=0;y<yrs;y++){
        for(var m=0;m<12;m++){fv=(fv+cur)*(1+r);inv+=cur;}
        cur=cur*(1+step/100);
      }
      function inr(n){return '₹'+Math.round(n).toLocaleString('en-IN');}
      $('#sup-future').textContent=inr(fv);$('#sup-invested').textContent=inr(inv);$('#sup-gain').textContent=inr(fv-inv);
    }
    ['sup-amt','sup-yrs','sup-rate','sup-step'].forEach(function(id){
      var el=document.getElementById(id);if(!el)return;
      var lbl=document.getElementById(id+'-lbl');
      function up(){var v=parseFloat(el.value);if(!lbl)return;if(id==='sup-amt')lbl.textContent='₹'+v.toLocaleString('en-IN');else if(id==='sup-yrs')lbl.textContent=v+' yrs';else lbl.textContent=v+'%';}
      el.addEventListener('input',function(){up();ssip();});up();
    });
    ssip();
  }

  /* ---------- India tax estimator (capital gains, FY 25-26 rules) ---------- */
  if($('#tax-form')){
    function inr(n){return '₹'+Math.round(n).toLocaleString('en-IN');}
    function compute(){
      var asset=$('#tax-asset').value;
      var gain=parseFloat($('#tax-gain').value)||0;
      var holding=parseInt($('#tax-holding').value,10)||0;
      var rate=0,longTerm=false,exempt=0,note='';
      if(asset==='listed_eq'){longTerm=holding>=12;if(longTerm){exempt=125000;rate=0.125;note='LTCG 12.5% above ₹1.25 L exemption (FY 25-26).';}else{rate=0.20;note='STCG 20% on listed equity / equity MF.';}}
      else if(asset==='debt_mf'){rate=0; note='Debt MF bought after 1 Apr 2023: taxed at your slab rate (set below).';var slab=parseFloat($('#tax-slab').value)||0;rate=slab/100;longTerm=false;}
      else if(asset==='crypto'){rate=0.30;note='Flat 30% on crypto/VDA. No loss offset, no indexation. Plus 1% TDS on transfer.';}
      else if(asset==='us_stocks'){longTerm=holding>=24;if(longTerm){rate=0.20;note='LTCG 20% with indexation on foreign equity (held >24 months).';}else{var slab2=parseFloat($('#tax-slab').value)||0;rate=slab2/100;note='STCG on foreign equity: taxed at your slab rate.';}}
      else if(asset==='gold'){longTerm=holding>=24;if(longTerm){rate=0.125;exempt=0;note='LTCG 12.5% (no indexation, post-23 Jul 2024 rules).';}else{var slab3=parseFloat($('#tax-slab').value)||0;rate=slab3/100;note='STCG on gold: at slab rate.';}}
      var taxable=Math.max(gain-exempt,0);
      var tax=taxable*rate;
      var cess=tax*0.04;
      var total=tax+cess;
      $('#tax-out').innerHTML=
        '<div class="calc-result"><h3>Estimated tax</h3><p class="big">'+inr(total)+'</p>'+
        '<p class="sub">'+(longTerm?'Long-term':'Short-term')+' · '+(rate*100).toFixed(1)+'% + 4% cess</p><hr>'+
        '<h3>Taxable gain</h3><p class="big" style="font-size:1.4rem">'+inr(taxable)+'</p>'+
        (exempt>0?'<p class="sub">After ₹'+exempt.toLocaleString('en-IN')+' exemption</p>':'')+
        '<p class="sub" style="margin-top:14px">'+note+'</p></div>';
    }
    $$('#tax-form').forEach?null:null;
    Array.prototype.slice.call(document.querySelectorAll('#tax-form input, #tax-form select')).forEach(function(el){el.addEventListener('input',compute);el.addEventListener('change',compute);});
    // Show slab row only when relevant
    function syncSlab(){var a=$('#tax-asset').value;var row=$('#tax-slab-row');if(!row)return;row.style.display=(a==='debt_mf'||(a==='us_stocks')||(a==='gold'))?'':'none';}
    $('#tax-asset').addEventListener('change',syncSlab);syncSlab();
    compute();
  }

  /* ---------- Currency converter ---------- */
  if($('#fx-form')){
    var rates=null;
    function load(base){
      return fetch('https://api.exchangerate.host/latest?base='+base).then(function(r){return r.json();}).then(function(d){if(d&&d.rates)return d.rates;throw new Error('no rates');})
        .catch(function(){return fetch('https://api.frankfurter.app/latest?from='+base).then(function(r){return r.json();}).then(function(d){return d.rates||{};});});
    }
    function refresh(){
      var from=$('#fx-from').value;
      load(from).then(function(r){rates=r;rates[from]=1;compute();$('#fx-stamp').textContent='Live rates fetched just now';});
    }
    function compute(){
      if(!rates)return;
      var amt=parseFloat($('#fx-amt').value)||0;
      var to=$('#fx-to').value;var rate=rates[to]||0;
      var out=amt*rate;
      $('#fx-out').textContent=out.toLocaleString('en-US',{maximumFractionDigits:4})+' '+to;
      $('#fx-rate').textContent='1 '+$('#fx-from').value+' = '+(rate||0).toFixed(4)+' '+to;
    }
    ['fx-from','fx-to','fx-amt'].forEach(function(id){var el=document.getElementById(id);if(!el)return;el.addEventListener('input',function(){if(id==='fx-from')refresh();else compute();});el.addEventListener('change',function(){if(id==='fx-from')refresh();else compute();});});
    refresh();
  }
})();
