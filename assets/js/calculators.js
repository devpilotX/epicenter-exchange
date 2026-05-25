(function(){
  'use strict';
  function $(s,r){return (r||document).querySelector(s);}
  function $$(s,r){return Array.prototype.slice.call((r||document).querySelectorAll(s));}
  function inr(n){if(!isFinite(n))return '—';return '₹'+Math.round(n).toLocaleString('en-IN');}

  $$('.calc-tab').forEach(function(btn){
    btn.addEventListener('click',function(){
      var target=btn.getAttribute('data-tab');
      $$('.calc-tab').forEach(function(b){b.classList.toggle('active',b===btn);});
      $$('.calc-panel').forEach(function(p){p.style.display=p.id===target?'':'none';});
    });
  });

  function bindRange(inputId,labelId,fmt){
    var input=$('#'+inputId);var label=$('#'+labelId);if(!input||!label)return;
    function update(){label.textContent=fmt(parseFloat(input.value));}
    input.addEventListener('input',update);update();
  }
  bindRange('sip-amt','sip-amt-lbl',function(v){return '₹'+v.toLocaleString('en-IN');});
  bindRange('sip-yrs','sip-yrs-lbl',function(v){return v+' yrs';});
  bindRange('sip-rate','sip-rate-lbl',function(v){return v+'%';});
  bindRange('emi-amt','emi-amt-lbl',function(v){return '₹'+v.toLocaleString('en-IN');});
  bindRange('emi-yrs','emi-yrs-lbl',function(v){return v+' yrs';});
  bindRange('emi-rate','emi-rate-lbl',function(v){return v+'%';});
  bindRange('ret-current-age','ret-current-age-lbl',function(v){return v+' yrs';});
  bindRange('ret-age','ret-age-lbl',function(v){return v+' yrs';});
  bindRange('ret-monthly','ret-monthly-lbl',function(v){return '₹'+v.toLocaleString('en-IN');});
  bindRange('ret-rate','ret-rate-lbl',function(v){return v+'%';});

  function calcSIP(){
    var amt=parseFloat($('#sip-amt').value)||0;
    var yrs=parseFloat($('#sip-yrs').value)||0;
    var rate=parseFloat($('#sip-rate').value)||0;
    var n=yrs*12;var r=(rate/100)/12;
    var fv=r===0?amt*n:amt*((Math.pow(1+r,n)-1)/r)*(1+r);
    var invested=amt*n;
    $('#sip-future').textContent=inr(fv);
    $('#sip-invested').textContent=inr(invested);
    $('#sip-gain').textContent=inr(fv-invested);
  }
  function calcEMI(){
    var p=parseFloat($('#emi-amt').value)||0;
    var rate=parseFloat($('#emi-rate').value)||0;
    var yrs=parseFloat($('#emi-yrs').value)||0;
    var n=yrs*12;var r=(rate/100)/12;
    var emi=r===0?p/n:(p*r*Math.pow(1+r,n))/(Math.pow(1+r,n)-1);
    var total=emi*n;
    $('#emi-monthly').textContent=inr(emi);
    $('#emi-total').textContent=inr(total);
    $('#emi-interest').textContent=inr(total-p);
  }
  function calcRet(){
    var current=parseFloat($('#ret-current-age').value)||0;
    var retAge=parseFloat($('#ret-age').value)||0;
    var monthly=parseFloat($('#ret-monthly').value)||0;
    var rate=parseFloat($('#ret-rate').value)||0;
    var years=Math.max(0,retAge-current);
    var n=years*12;var r=(rate/100)/12;
    var fv=r===0?monthly*n:monthly*((Math.pow(1+r,n)-1)/r)*(1+r);
    var invested=monthly*n;
    $('#ret-corpus').textContent=inr(fv);
    $('#ret-invested').textContent=inr(invested);
    $('#ret-gain').textContent=inr(fv-invested);
    $('#ret-years').textContent=years+' years';
  }
  $$('#sip-form input').forEach(function(i){i.addEventListener('input',calcSIP);});
  $$('#emi-form input').forEach(function(i){i.addEventListener('input',calcEMI);});
  $$('#ret-form input').forEach(function(i){i.addEventListener('input',calcRet);});
  if($('#sip-amt'))calcSIP();
  if($('#emi-amt'))calcEMI();
  if($('#ret-current-age'))calcRet();
})();
