/* Epicenter Exchange — mixed marquee: crypto + indices + major stocks. Yahoo Finance v8 (CORS proxy) + CoinGecko. */
(function(){
  'use strict';
  var trackEl=document.getElementById('ticker-track');
  var heroEl=document.getElementById('hero-quotes');
  if(!trackEl&&!heroEl)return;

  // Indices + major stocks (Yahoo symbols)
  var EQUITY=[
    {y:'^GSPC',s:'S&P 500',c:'$'},{y:'^NDX',s:'NDX',c:'$'},{y:'^DJI',s:'DOW',c:'$'},
    {y:'^NSEI',s:'NIFTY',c:'₹'},{y:'^BSESN',s:'SENSEX',c:'₹'},
    {y:'^FTSE',s:'FTSE',c:'£'},{y:'^GDAXI',s:'DAX',c:'€'},{y:'^N225',s:'NIKKEI',c:'¥'},{y:'^HSI',s:'HSI',c:'$'},
    {y:'AAPL',s:'AAPL',c:'$'},{y:'MSFT',s:'MSFT',c:'$'},{y:'NVDA',s:'NVDA',c:'$'},
    {y:'RELIANCE.NS',s:'RELI',c:'₹'},{y:'TCS.NS',s:'TCS',c:'₹'},{y:'HDFCBANK.NS',s:'HDFC',c:'₹'}
  ];
  // Crypto
  var CRYPTO_IDS=['bitcoin','ethereum','solana','ripple','binancecoin','cardano','dogecoin','polkadot','chainlink','avalanche-2'];
  var CRYPTO_SYM={'bitcoin':'BTC','ethereum':'ETH','solana':'SOL','ripple':'XRP','binancecoin':'BNB','cardano':'ADA','dogecoin':'DOGE','polkadot':'DOT','chainlink':'LINK','avalanche-2':'AVAX'};

  var PROXIES=[function(u){return 'https://corsproxy.io/?url='+encodeURIComponent(u);},function(u){return 'https://api.allorigins.win/raw?url='+encodeURIComponent(u);}];

  function fmt(n,c){var d=n<1?4:n<10?2:n<1000?2:0;return (c||'')+n.toLocaleString('en-US',{minimumFractionDigits:d,maximumFractionDigits:d});}

  function fetchProxied(url){var i=0;return new Promise(function(res,rej){(function tr(){if(i>=PROXIES.length)return rej(0);fetch(PROXIES[i++](url)).then(function(r){if(!r.ok)throw 0;return r.json();}).then(res).catch(tr);})();});}

  function fetchEquity(){
    var url='https://query1.finance.yahoo.com/v8/finance/chart/'+encodeURIComponent(EQUITY.map(function(e){return e.y;}).join(','))+'?range=2d&interval=1d';
    // Yahoo multi-symbol via batch quote
    var batch='https://query1.finance.yahoo.com/v7/finance/quote?symbols='+EQUITY.map(function(e){return encodeURIComponent(e.y);}).join(',');
    return fetchProxied(batch).then(function(j){
      var rows=(j&&j.quoteResponse&&j.quoteResponse.result)||[];
      var map={};rows.forEach(function(r){map[r.symbol]=r;});
      return EQUITY.map(function(e){var r=map[e.y];if(!r||r.regularMarketPrice==null)return null;var p=r.regularMarketPrice;var ch=r.regularMarketChangePercent||0;return {s:e.s,p:p,c:e.c,chg:ch};}).filter(Boolean);
    }).catch(function(){return [];});
  }

  function fetchCrypto(){
    var url='https://api.coingecko.com/api/v3/simple/price?ids='+CRYPTO_IDS.join(',')+'&vs_currencies=usd&include_24hr_change=true';
    return fetch(url).then(function(r){return r.json();}).then(function(d){
      return CRYPTO_IDS.map(function(id){if(!d[id])return null;return {s:CRYPTO_SYM[id],p:d[id].usd,c:'$',chg:d[id].usd_24h_change||0};}).filter(Boolean);
    }).catch(function(){return [];});
  }

  function renderTrack(list){
    if(!trackEl||!list.length)return;
    var html=list.map(function(it){var cls=it.chg>=0?'pos':'neg';var sign=it.chg>=0?'+':'';return '<span class="item"><span class="sym">'+it.s+'</span> '+fmt(it.p,it.c)+' <span class="'+cls+'">'+sign+it.chg.toFixed(2)+'%</span></span>';}).join('');
    trackEl.innerHTML=html+html;
  }
  function renderHero(list){if(!heroEl||!list.length)return;heroEl.innerHTML=list.slice(0,5).map(function(it){var cls=it.chg>=0?'pos':'neg';var sign=it.chg>=0?'+':'';return '<div class="row"><strong>'+it.s+'</strong><span>'+fmt(it.p,it.c)+'</span><span class="'+cls+'">'+sign+it.chg.toFixed(2)+'%</span></div>';}).join('');}

  if(trackEl){trackEl.innerHTML='<span class="item">Loading live prices…</span>';}
  if(heroEl){heroEl.innerHTML='<div class="row"><strong>—</strong><span>Loading…</span><span></span></div>';}

  function refresh(){
    Promise.all([fetchEquity(),fetchCrypto()]).then(function(arr){
      // Interleave for variety
      var equity=arr[0],crypto=arr[1],combined=[],max=Math.max(equity.length,crypto.length);
      for(var i=0;i<max;i++){if(equity[i])combined.push(equity[i]);if(crypto[i])combined.push(crypto[i]);}
      renderTrack(combined);renderHero(combined);
    });
  }
  refresh();setInterval(refresh,60*1000);
})();
