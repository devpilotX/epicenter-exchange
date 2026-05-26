/* Epicenter Exchange - live ticker via our backend (no CORS issues).
   Indices + major stocks via Yahoo (server-side proxy), crypto via CoinGecko.
   v5 - backed by api.epicenterexchange.com. */
(function(){
  'use strict';
  var trackEl = document.getElementById('ticker-track');
  var heroEl  = document.getElementById('hero-quotes');
  if(!trackEl && !heroEl) return;

  var API = 'https://api.epicenterexchange.com';

  var EQUITY = [
    {y:'^GSPC',  s:'S&P 500', c:'$'},
    {y:'^NDX',   s:'NDX',     c:'$'},
    {y:'^DJI',   s:'DOW',     c:'$'},
    {y:'^NSEI',  s:'NIFTY',   c:'\u20B9'},
    {y:'^BSESN', s:'SENSEX',  c:'\u20B9'},
    {y:'^FTSE',  s:'FTSE',    c:'\u00A3'},
    {y:'^GDAXI', s:'DAX',     c:'\u20AC'},
    {y:'^N225',  s:'NIKKEI',  c:'\u00A5'},
    {y:'^HSI',   s:'HSI',     c:'$'},
    {y:'AAPL',   s:'AAPL',    c:'$'},
    {y:'MSFT',   s:'MSFT',    c:'$'},
    {y:'NVDA',   s:'NVDA',    c:'$'},
    {y:'RELIANCE.NS', s:'RELI', c:'\u20B9'},
    {y:'TCS.NS',      s:'TCS',  c:'\u20B9'},
    {y:'HDFCBANK.NS', s:'HDFC', c:'\u20B9'}
  ];
  var CRYPTO_IDS = ['bitcoin','ethereum','solana','ripple','binancecoin',
                    'cardano','dogecoin','polkadot','chainlink','avalanche-2'];
  var CRYPTO_SYM = {bitcoin:'BTC',ethereum:'ETH',solana:'SOL',ripple:'XRP',
                    binancecoin:'BNB',cardano:'ADA',dogecoin:'DOGE',
                    polkadot:'DOT',chainlink:'LINK','avalanche-2':'AVAX'};

  function fmt(n,c){
    var d = n<1?4:n<10?2:n<1000?2:0;
    return (c||'') + n.toLocaleString('en-US',{minimumFractionDigits:d, maximumFractionDigits:d});
  }

  function fetchEquity(){
    var url = API + '/quote?symbols=' + encodeURIComponent(EQUITY.map(function(e){return e.y;}).join(','));
    return fetch(url).then(function(r){if(!r.ok)throw 0;return r.json();}).then(function(j){
      var q = (j && j.quotes) || {};
      return EQUITY.map(function(e){
        var d = q[e.y];
        if(!d || d.price==null) return null;
        return {s:e.s, p:d.price, c:e.c, chg:d.change_pct||0};
      }).filter(Boolean);
    }).catch(function(){return [];});
  }

  function fetchCrypto(){
    var url = API + '/crypto/spot?ids=' + CRYPTO_IDS.join(',');
    return fetch(url).then(function(r){if(!r.ok)throw 0;return r.json();}).then(function(j){
      var p = (j && j.prices) || {};
      return CRYPTO_IDS.map(function(id){
        if(!p[id]) return null;
        return {s:CRYPTO_SYM[id], p:p[id].usd, c:'$', chg:p[id].usd_24h_change||0};
      }).filter(Boolean);
    }).catch(function(){return [];});
  }

  function renderTrack(list){
    if(!trackEl || !list.length) return;
    var html = list.map(function(it){
      var cls = it.chg>=0?'pos':'neg';
      var sign = it.chg>=0?'+':'';
      return '<span class="item"><span class="sym">'+it.s+'</span> '+fmt(it.p,it.c)+
             ' <span class="'+cls+'">'+sign+it.chg.toFixed(2)+'%</span></span>';
    }).join('');
    trackEl.innerHTML = html + html;
  }
  function renderHero(list){
    if(!heroEl || !list.length) return;
    heroEl.innerHTML = list.slice(0,5).map(function(it){
      var cls = it.chg>=0?'pos':'neg';
      var sign = it.chg>=0?'+':'';
      return '<div class="row"><strong>'+it.s+'</strong><span>'+fmt(it.p,it.c)+
             '</span><span class="'+cls+'">'+sign+it.chg.toFixed(2)+'%</span></div>';
    }).join('');
  }

  if(trackEl) trackEl.innerHTML='<span class="item">Loading live prices...</span>';
  if(heroEl)  heroEl.innerHTML='<div class="row"><strong>--</strong><span>Loading...</span><span></span></div>';

  function refresh(){
    Promise.all([fetchEquity(), fetchCrypto()]).then(function(arr){
      var equity = arr[0], crypto = arr[1], combined = [], max = Math.max(equity.length, crypto.length);
      for(var i=0;i<max;i++){
        if(equity[i]) combined.push(equity[i]);
        if(crypto[i]) combined.push(crypto[i]);
      }
      renderTrack(combined);
      renderHero(combined);
    });
  }
  refresh();
  setInterval(refresh, 60*1000);
})();
