/* Epicenter Exchange — live equity & index dashboard via Yahoo Finance v8 batch quote (no key). */
(function(){
  'use strict';
  var host=document.getElementById('equity-dashboard');if(!host)return;

  var TICKERS=[
    // US indices
    {y:'^GSPC',name:'S&P 500',region:'US',flag:'🇺🇸',c:'$'},
    {y:'^NDX',name:'NASDAQ 100',region:'US',flag:'🇺🇸',c:'$'},
    {y:'^DJI',name:'Dow Jones',region:'US',flag:'🇺🇸',c:'$'},
    // India
    {y:'^NSEI',name:'NIFTY 50',region:'India',flag:'🇮🇳',c:'₹'},
    {y:'^BSESN',name:'BSE Sensex',region:'India',flag:'🇮🇳',c:'₹'},
    // Europe / UK
    {y:'^FTSE',name:'FTSE 100',region:'UK',flag:'🇬🇧',c:'£'},
    {y:'^GDAXI',name:'DAX',region:'Germany',flag:'🇩🇪',c:'€'},
    {y:'^FCHI',name:'CAC 40',region:'France',flag:'🇫🇷',c:'€'},
    // Asia
    {y:'^N225',name:'Nikkei 225',region:'Japan',flag:'🇯🇵',c:'¥'},
    {y:'^HSI',name:'Hang Seng',region:'Hong Kong',flag:'🇭🇰',c:'$'},
    // US stocks
    {y:'AAPL',name:'Apple',region:'US',flag:'🇺🇸',c:'$'},
    {y:'MSFT',name:'Microsoft',region:'US',flag:'🇺🇸',c:'$'},
    {y:'NVDA',name:'NVIDIA',region:'US',flag:'🇺🇸',c:'$'},
    {y:'GOOGL',name:'Alphabet',region:'US',flag:'🇺🇸',c:'$'},
    {y:'AMZN',name:'Amazon',region:'US',flag:'🇺🇸',c:'$'},
    // India stocks
    {y:'RELIANCE.NS',name:'Reliance',region:'India',flag:'🇮🇳',c:'₹'},
    {y:'TCS.NS',name:'TCS',region:'India',flag:'🇮🇳',c:'₹'},
    {y:'HDFCBANK.NS',name:'HDFC Bank',region:'India',flag:'🇮🇳',c:'₹'},
    {y:'INFY.NS',name:'Infosys',region:'India',flag:'🇮🇳',c:'₹'},
    // UK stocks
    {y:'HSBA.L',name:'HSBC',region:'UK',flag:'🇬🇧',c:'£'},
    {y:'BP.L',name:'BP',region:'UK',flag:'🇬🇧',c:'£'},
    {y:'AZN.L',name:'AstraZeneca',region:'UK',flag:'🇬🇧',c:'£'}
  ];

  var PROXIES=[function(u){return 'https://corsproxy.io/?url='+encodeURIComponent(u);},function(u){return 'https://api.allorigins.win/raw?url='+encodeURIComponent(u);},function(u){return 'https://api.codetabs.com/v1/proxy?quest='+encodeURIComponent(u);}];
  function fetchProxied(url){var i=0;return new Promise(function(res,rej){(function tr(){if(i>=PROXIES.length)return rej(new Error('proxies'));fetch(PROXIES[i++](url)).then(function(r){if(!r.ok)throw 0;return r.json();}).then(res).catch(tr);})();});}

  function fmt(n,c){var d=n<1?4:n<10?2:n<1000?2:0;return (c||'')+n.toLocaleString('en-US',{minimumFractionDigits:d,maximumFractionDigits:d});}

  function render(rows){
    host.innerHTML=rows.map(function(r){
      var d=r.data;
      if(!d){return '<div class="crypto-card"><div class="crypto-head"><span>'+r.flag+' <strong>'+r.name+'</strong></span><span class="muted small">'+r.y+'</span></div><div class="crypto-price">—</div><div class="muted small">no data</div></div>';}
      var ch=d.chg||0;var cl=ch>=0?'gain':'loss';var arrow=ch>=0?'▲':'▼';
      return '<div class="crypto-card"><div class="crypto-head"><span>'+r.flag+' <strong>'+r.name+'</strong></span><span class="muted small">'+r.y+'</span></div><div class="crypto-price">'+fmt(d.price,r.c)+'</div><div class="'+cl+'">'+arrow+' '+ch.toFixed(2)+'%</div><div class="muted small">'+(d.state||'')+'</div></div>';
    }).join('');
  }

  function refresh(){
    var url='https://query1.finance.yahoo.com/v7/finance/quote?symbols='+TICKERS.map(function(t){return encodeURIComponent(t.y);}).join(',');
    fetchProxied(url).then(function(j){
      var rows=(j&&j.quoteResponse&&j.quoteResponse.result)||[];
      var map={};rows.forEach(function(r){map[r.symbol]=r;});
      render(TICKERS.map(function(t){var r=map[t.y];return Object.assign({},t,{data:r&&r.regularMarketPrice!=null?{price:r.regularMarketPrice,chg:r.regularMarketChangePercent||0,state:r.marketState||''}:null});}));
    }).catch(function(){render(TICKERS.map(function(t){return Object.assign({},t,{data:null});}));});
  }
  host.innerHTML='<p class="muted small">Loading equity & indices via Yahoo Finance…</p>';
  refresh();setInterval(refresh,5*60*1000);
})();
