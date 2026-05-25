/* Epicenter Exchange — contact form handler.
   Posts to https://api.epicenterexchange.com/contact. Falls back to mailto on failure. */
(function(){
  'use strict';
  var API='https://api.epicenterexchange.com';
  var FALLBACK='dipanshu@paisareality.com';
  function bind(form){
    if(!form||form.__eeBound)return;form.__eeBound=true;
    var msg=document.getElementById('ee-contact-msg');
    form.addEventListener('submit',function(e){
      e.preventDefault();
      var data={
        name:form.elements['name'].value.trim(),
        email:form.elements['email'].value.trim(),
        topic:form.elements['topic'].value,
        message:form.elements['message'].value.trim()
      };
      if(!data.name||!data.email||!data.topic||!data.message){setMsg(msg,'Please fill all fields.','#EF4444');return;}
      if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(data.email)){setMsg(msg,'Please enter a valid email.','#EF4444');return;}
      var btn=form.querySelector('button[type=submit]');var orig=btn.textContent;btn.disabled=true;btn.textContent='Sending…';
      fetch(API+'/contact',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)})
        .then(function(r){if(!r.ok)throw new Error(r.status);return r.json();})
        .then(function(d){setMsg(msg,'✓ Message received. Ticket ID: '+(d.ticket_id||'—')+'. Confirmation email sent.','#10B981');form.reset();})
        .catch(function(){
          var sub=encodeURIComponent('Contact form: '+data.topic);
          var body=encodeURIComponent('Name: '+data.name+'\nEmail: '+data.email+'\nTopic: '+data.topic+'\n\nMessage:\n'+data.message);
          window.location.href='mailto:'+FALLBACK+'?subject='+sub+'&body='+body;
          setMsg(msg,'Backend offline — your email client should open instead.','#F59E0B');
        })
        .then(function(){btn.disabled=false;btn.textContent=orig;});
    });
  }
  function setMsg(el,t,c){if(!el)return;el.textContent=t;el.style.color=c||'';}
  document.addEventListener('DOMContentLoaded',function(){bind(document.getElementById('ee-contact'));});
})();
