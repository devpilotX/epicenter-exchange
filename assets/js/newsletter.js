/* Epicenter Exchange — newsletter signup. Posts to own FastAPI backend. */
(function(){
  'use strict';
  var API='https://api.epicenterexchange.com';
  var FALLBACK='dipanshu@paisareality.com';
  function bind(form){
    if(!form||form.__eeBound)return;form.__eeBound=true;
    var msg=document.getElementById('ee-newsletter-msg')||form.parentElement.querySelector('.newsletter-msg');
    form.addEventListener('submit',function(e){
      e.preventDefault();
      var email=form.querySelector('input[name=email]').value.trim();
      var nameEl=form.querySelector('input[name=name]');var name=nameEl?nameEl.value:'';
      var source=form.dataset.source||location.pathname;
      if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)){set(msg,'Please enter a valid email.','#EF4444');return;}
      var btn=form.querySelector('button');var orig=btn.textContent;btn.disabled=true;btn.textContent='Subscribing…';
      fetch(API+'/newsletter/subscribe',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:email,name:name,source:source})})
        .then(function(r){if(!r.ok)throw new Error(r.status);return r.json();})
        .then(function(){set(msg,'✓ Subscribed! Check your inbox for our welcome email + the latest essay.','#10B981');form.reset();})
        .catch(function(){
          var sub=encodeURIComponent('Newsletter subscription');
          var body=encodeURIComponent('Please add me to the newsletter.\nName: '+(name||'(not provided)')+'\nEmail: '+email+'\nSource: '+source);
          window.location.href='mailto:'+FALLBACK+'?subject='+sub+'&body='+body;
          set(msg,'Backend not yet deployed — mail client opened. Or write to '+FALLBACK,'#F59E0B');
        })
        .then(function(){btn.disabled=false;btn.textContent=orig;});
    });
  }
  function set(el,t,c){if(!el)return;el.textContent=t;el.style.color=c||'';}
  document.addEventListener('DOMContentLoaded',function(){document.querySelectorAll('#ee-newsletter, form.newsletter-form').forEach(bind);});
})();
