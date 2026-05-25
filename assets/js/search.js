/* Epicenter Exchange — client-side article search.
   Loads /search-index.json (tiny, static) and filters by token match.
   No backend, no analytics, instant. */
(function(){
  'use strict';
  var box=document.getElementById('search-box');
  var out=document.getElementById('search-results');
  if(!box||!out)return;
  var index=null;
  function load(){if(index)return Promise.resolve(index);return fetch('/search-index.json').then(function(r){return r.json();}).then(function(d){index=d.items||[];return index;});}
  function tokenize(s){return s.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);}
  function score(item,tokens){
    var hay=(item.title+' '+item.tag+' '+item.summary+' '+(item.keywords||'')).toLowerCase();
    var s=0;
    tokens.forEach(function(t){
      if(!t)return;
      if(item.title.toLowerCase().indexOf(t)>=0)s+=4;
      if(hay.indexOf(t)>=0)s+=1;
    });
    return s;
  }
  function render(items,q){
    if(!q){out.innerHTML='';return;}
    if(!items.length){out.innerHTML='<p class="muted small" style="margin-top:12px">No articles match “'+q+'” yet. Try another keyword.</p>';return;}
    out.innerHTML='<ul class="search-list">'+items.map(function(i){return '<li><a href="'+i.url+'"><strong>'+i.title+'</strong><span class="muted small">'+i.tag+' · '+i.read+'</span><p class="small">'+i.summary+'</p></a></li>';}).join('')+'</ul>';
  }
  var t=null;
  box.addEventListener('input',function(){
    clearTimeout(t);
    var q=box.value.trim();
    t=setTimeout(function(){
      if(!q){render([],'');return;}
      load().then(function(items){
        var tokens=tokenize(q);
        var ranked=items.map(function(it){return{it:it,s:score(it,tokens)};}).filter(function(r){return r.s>0;}).sort(function(a,b){return b.s-a.s;}).slice(0,8).map(function(r){return r.it;});
        render(ranked,q);
      });
    },120);
  });
})();
