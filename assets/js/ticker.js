(function(){
  'use strict';
  var trackEl=document.getElementById('ticker-track');
  var heroEl=document.getElementById('hero-quotes');
  if(!trackEl&&!heroEl)return;

  var symbols={bitcoin:'BTC',ethereum:'ETH',solana:'SOL',ripple:'XRP',binancecoin:'BNB',cardano:'ADA',dogecoin:'DOGE',polkadot:'DOT',chainlink:'LINK',avalanche2:'AVAX'};
  var ids=Object.keys(symbols);
  var url='https://api.coingecko.com/api/v3/simple/price?ids='+ids.join(',')+'&vs_currencies=usd&include_24hr_change=true';

  function fmt(n){return n.toLocaleString('en-US',{maximumFractionDigits:n<1?4:2});}

  function renderTrack(list){
    if(!trackEl)return;
    var html=list.map(function(it){
      var cls=it.chg>=0?'pos':'neg';var sign=it.chg>=0?'+':'';
      return '<span class="item"><span class="sym">'+it.s+'</span> $'+fmt(it.p)+' <span class="'+cls+'">'+sign+it.chg.toFixed(2)+'%</span></span>';
    }).join('');
    trackEl.innerHTML=html+html;
  }
  function renderHero(list){
    if(!heroEl)return;
    heroEl.innerHTML=list.slice(0,5).map(function(it){
      var cls=it.chg>=0?'pos':'neg';var sign=it.chg>=0?'+':'';
      return '<div class="row"><strong>'+it.s+'</strong><span>$'+fmt(it.p)+'</span><span class="'+cls+'">'+sign+it.chg.toFixed(2)+'%</span></div>';
    }).join('');
  }
  // placeholder while loading
  if(trackEl){
    trackEl.innerHTML=ids.map(function(id){return '<span class="item"><span class="sym">'+symbols[id]+'</span> $—</span>';}).join('').repeat(2);
  }
  if(heroEl){
    heroEl.innerHTML='<div class="row"><strong>—</strong><span>Loading…</span><span></span></div>';
  }

  fetch(url).then(function(r){return r.json();}).then(function(d){
    var list=ids.map(function(id){if(!d[id])return null;return{s:symbols[id],p:d[id].usd,chg:d[id].usd_24h_change||0};}).filter(Boolean);
    if(list.length){renderTrack(list);renderHero(list);}
  }).catch(function(){
    if(heroEl){heroEl.innerHTML='<div class="row"><strong>—</strong><span>Live data unavailable</span><span></span></div>';}
  });
})();
