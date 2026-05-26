/* Epicenter Exchange - live equity & index dashboard via our backend. v3. */
(function(){
  'use strict';
  var host = document.getElementById('equity-dashboard');
  if(!host) return;
  var API = 'https://api.epicenterexchange.com';

  var TICKERS = [
    {y:'^GSPC', name:'S&P 500',    region:'US',     flag:'\uD83C\uDDFA\uD83C\uDDF8', c:'$'},
    {y:'^NDX',  name:'NASDAQ 100', region:'US',     flag:'\uD83C\uDDFA\uD83C\uDDF8', c:'$'},
    {y:'^DJI',  name:'Dow Jones',  region:'US',     flag:'\uD83C\uDDFA\uD83C\uDDF8', c:'$'},
    {y:'^NSEI', name:'NIFTY 50',   region:'India',  flag:'\uD83C\uDDEE\uD83C\uDDF3', c:'\u20B9'},
    {y:'^BSESN',name:'BSE Sensex', region:'India',  flag:'\uD83C\uDDEE\uD83C\uDDF3', c:'\u20B9'},
    {y:'^FTSE', name:'FTSE 100',   region:'UK',     flag:'\uD83C\uDDEC\uD83C\uDDE7', c:'\u00A3'},
    {y:'^GDAXI',name:'DAX',        region:'Germany',flag:'\uD83C\uDDE9\uD83C\uDDEA', c:'\u20AC'},
    {y:'^FCHI', name:'CAC 40',     region:'France', flag:'\uD83C\uDDEB\uD83C\uDDF7', c:'\u20AC'},
    {y:'^N225', name:'Nikkei 225', region:'Japan',  flag:'\uD83C\uDDEF\uD83C\uDDF5', c:'\u00A5'},
    {y:'^HSI',  name:'Hang Seng',  region:'HK',     flag:'\uD83C\uDDED\uD83C\uDDF0', c:'$'},
    {y:'AAPL',  name:'Apple',      region:'US',     flag:'\uD83C\uDDFA\uD83C\uDDF8', c:'$'},
    {y:'MSFT',  name:'Microsoft',  region:'US',     flag:'\uD83C\uDDFA\uD83C\uDDF8', c:'$'},
    {y:'NVDA',  name:'NVIDIA',     region:'US',     flag:'\uD83C\uDDFA\uD83C\uDDF8', c:'$'},
    {y:'GOOGL', name:'Alphabet',   region:'US',     flag:'\uD83C\uDDFA\uD83C\uDDF8', c:'$'},
    {y:'AMZN',  name:'Amazon',     region:'US',     flag:'\uD83C\uDDFA\uD83C\uDDF8', c:'$'},
    {y:'RELIANCE.NS', name:'Reliance', region:'India', flag:'\uD83C\uDDEE\uD83C\uDDF3', c:'\u20B9'},
    {y:'TCS.NS',      name:'TCS',      region:'India', flag:'\uD83C\uDDEE\uD83C\uDDF3', c:'\u20B9'},
    {y:'HDFCBANK.NS', name:'HDFC Bank',region:'India', flag:'\uD83C\uDDEE\uD83C\uDDF3', c:'\u20B9'},
    {y:'INFY.NS',     name:'Infosys',  region:'India', flag:'\uD83C\uDDEE\uD83C\uDDF3', c:'\u20B9'},
    {y:'HSBA.L', name:'HSBC',         region:'UK',    flag:'\uD83C\uDDEC\uD83C\uDDE7', c:'\u00A3'},
    {y:'BP.L',   name:'BP',           region:'UK',    flag:'\uD83C\uDDEC\uD83C\uDDE7', c:'\u00A3'},
    {y:'AZN.L',  name:'AstraZeneca',  region:'UK',    flag:'\uD83C\uDDEC\uD83C\uDDE7', c:'\u00A3'}
  ];

  function fmt(n,c){
    var d = n<1?4:n<10?2:n<1000?2:0;
    return (c||'') + n.toLocaleString('en-US',{minimumFractionDigits:d, maximumFractionDigits:d});
  }

  function render(rows){
    host.innerHTML = rows.map(function(r){
      var d = r.data;
      if(!d){
        return '<div class="crypto-card"><div class="crypto-head"><span>'+r.flag+' <strong>'+r.name+
               '</strong></span><span class="muted small">'+r.y+'</span></div>'+
               '<div class="crypto-price">--</div><div class="muted small">no data</div></div>';
      }
      var ch = d.chg || 0;
      var cl = ch>=0?'gain':'loss';
      var arrow = ch>=0?'\u25B2':'\u25BC';
      return '<div class="crypto-card"><div class="crypto-head"><span>'+r.flag+' <strong>'+r.name+
             '</strong></span><span class="muted small">'+r.y+'</span></div>'+
             '<div class="crypto-price">'+fmt(d.price,r.c)+'</div>'+
             '<div class="'+cl+'">'+arrow+' '+ch.toFixed(2)+'%</div>'+
             '<div class="muted small">'+(d.state||'')+'</div></div>';
    }).join('');
  }

  function refresh(){
    var url = API + '/quote?symbols=' + encodeURIComponent(TICKERS.map(function(t){return t.y;}).join(','));
    fetch(url).then(function(r){if(!r.ok)throw 0;return r.json();}).then(function(j){
      var q = (j && j.quotes) || {};
      render(TICKERS.map(function(t){
        var d = q[t.y];
        return Object.assign({}, t, {data: d&&d.price!=null?{price:d.price,chg:d.change_pct||0,state:d.market_state||''}:null});
      }));
    }).catch(function(){
      render(TICKERS.map(function(t){return Object.assign({}, t, {data:null});}));
    });
  }
  host.innerHTML = '<p class="muted small">Loading live prices...</p>';
  refresh();
  setInterval(refresh, 5*60*1000);
})();
