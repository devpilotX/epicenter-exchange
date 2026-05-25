/* Epicenter Exchange — equity & index dashboard via CORS proxy. */
(function(){
  'use strict';
  var host=document.getElementById('equity-dashboard');if(!host)return;
  var PROXIES=[function(u){return 'https://corsproxy.io/?url='+encodeURIComponent(u);},function(u){return 'https://api.allorigins.win/raw?url='+encodeURIComponent(u);}];
  var TICKERS=[
    {t:'^spx',name:'S&P 500',region:'US',flag:'🇺🇸'},{t:'^ndx',name:'NASDAQ 100',region:'US',flag:'🇺🇸'},{t:'^dji',name:'Dow Jones',region:'US',flag:'🇺🇸'},
    {t:'^nse',name:'NIFTY 50',region:'India',flag:'🇮🇳'},{t:'^bsx',name:'BSE Sensex',region:'India',flag:'🇮🇳'},
    {t:'^ftm',name:'FTSE 100',region:'UK',flag:'🇬🇧'},{t:'^dax',name:'DAX',region:'DE',flag:'🇩🇪'},
    {t:'^n225',name:'Nikkei 225',region:'JP',flag:'🇯🇵'},{t:'^hsi',name:'Hang Seng',region:'HK',flag:'🇭🇰'},
    {t:'aapl.us',name:'Apple',region:'US',flag:'🇺🇸'},{t:'nvda.us',name:'NVIDIA',region:'US',flag:'🇺🇸'},
    {t:'reliance.in',name:'Reliance',region:'India',flag:'🇮🇳'},{t:'tcs.in',name:'TCS',region:'India',flag:'🇮🇳'}
  ];
  function fetchOne(t){
    var url='https://stooq.com/q/l/?s='+encodeURIComponent(t)+'&i=d&f=sd2t2ohlcv&h&e=csv';
    var i=0;function attempt(){if(i>=PROXIES.length)return Promise.reject(new Error('proxies'));return fetch(PROXIES[i++](url)).then(function(r){if(!r.ok)throw 0;return r.text();}).catch(attempt);}
    return attempt();
  }
  function parse(csv){
    var lines=(csv||'').trim().split(/\r?\n/);if(lines.length<2)return null;
    var headers=lines[0].split(',').map(function(s){return s.trim().toLowerCase();});var row=lines[1].split(',');
    var get=function(k){var i=headers.indexOf(k);return i>=0?row[i]:null;};
    var c=parseFloat(get('close'));var o=parseFloat(get('open'));
    if(!isFinite(c))return null;
    return {close:c,open:o,change:o>0?(c-o)/o:0};
  }
  function render(rows){
    host.innerHTML=rows.map(function(r){
      var ch=r.data?r.data.change:0;var cl=ch>=0?'gain':'loss';var arrow=ch>=0?'▲':'▼';
      return '<div class="crypto-card">'+
        '<div class="crypto-head"><span>'+r.flag+' <strong>'+r.name+'</strong></span><span class="muted small">'+r.t+'</span></div>'+
        '<div class="crypto-price">'+(r.data?r.data.close.toLocaleString(undefined,{maximumFractionDigits:2}):'—')+'</div>'+
        '<div class="'+cl+'">'+(r.data?arrow+' '+(ch*100).toFixed(2)+'%':'no data')+'</div>'+
      '</div>';
    }).join('');
  }
  function refresh(){
    Promise.all(TICKERS.map(function(t){return fetchOne(t.t).then(parse).catch(function(){return null;}).then(function(d){return Object.assign({},t,{data:d});});})).then(render);
  }
  host.innerHTML='<p class="muted small">Loading equity … (via CORS proxy)</p>';
  refresh();setInterval(refresh,5*60*1000);
})();
