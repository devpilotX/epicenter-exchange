/* Epicenter Exchange — live crypto dashboard.
   Free CoinGecko /coins/markets endpoint (no key). Sparklines drawn as inline SVG.
   Auto-refreshes every 60s. Falls back to CoinCap on error. */
(function(){
  'use strict';
  var host=document.getElementById('crypto-dashboard');
  if(!host)return;
  var coins='bitcoin,ethereum,solana,ripple,binancecoin,cardano,dogecoin,polkadot,chainlink,avalanche-2,polygon,litecoin';
  var primary='https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids='+coins+'&order=market_cap_desc&sparkline=true&price_change_percentage=24h,7d&locale=en';

  function fmtPrice(n){return n.toLocaleString('en-US',{maximumFractionDigits:n<1?6:n<100?2:0});}
  function fmtCap(n){if(n>=1e12)return '$'+(n/1e12).toFixed(2)+'T';if(n>=1e9)return '$'+(n/1e9).toFixed(2)+'B';if(n>=1e6)return '$'+(n/1e6).toFixed(2)+'M';return '$'+n.toLocaleString('en-US');}
  function sparkSVG(points,positive){
    if(!points||points.length<2)return '';
    var w=120,h=36,pad=2;var min=Math.min.apply(null,points);var max=Math.max.apply(null,points);var range=max-min||1;
    var d=points.map(function(v,i){var x=pad+(i/(points.length-1))*(w-pad*2);var y=h-pad-((v-min)/range)*(h-pad*2);return (i===0?'M':'L')+x.toFixed(1)+' '+y.toFixed(1);}).join(' ');
    var color=positive?'#16A34A':'#DC2626';
    return '<svg viewBox="0 0 '+w+' '+h+'" width="'+w+'" height="'+h+'" aria-hidden="true"><path d="'+d+'" fill="none" stroke="'+color+'" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  }
  function render(rows){
    if(!rows||!rows.length){host.innerHTML='<p class="muted small">Live data unavailable. Try again later.</p>';return;}
    var html='<div class="crypto-grid">'+rows.map(function(c){
      var p=c.current_price;
      var ch24=c.price_change_percentage_24h||0;
      var ch7=c.price_change_percentage_7d_in_currency||0;
      var img=c.image||'';
      var spark=c.sparkline_in_7d&&c.sparkline_in_7d.price?c.sparkline_in_7d.price:[];
      return '<div class="crypto-card">'+
        '<div class="cc-head"><img src="'+img+'" alt="" width="28" height="28" loading="lazy"><div><strong>'+c.symbol.toUpperCase()+'</strong><span class="muted small">'+c.name+'</span></div></div>'+
        '<div class="cc-price">$'+fmtPrice(p)+'</div>'+
        '<div class="cc-spark">'+sparkSVG(spark,ch7>=0)+'</div>'+
        '<div class="cc-row"><span class="muted small">24h</span><span class="'+(ch24>=0?'gain':'loss')+'">'+(ch24>=0?'+':'')+ch24.toFixed(2)+'%</span></div>'+
        '<div class="cc-row"><span class="muted small">7d</span><span class="'+(ch7>=0?'gain':'loss')+'">'+(ch7>=0?'+':'')+ch7.toFixed(2)+'%</span></div>'+
        '<div class="cc-row"><span class="muted small">Mkt cap</span><span class="mono small">'+fmtCap(c.market_cap||0)+'</span></div>'+
      '</div>';
    }).join('')+'</div><p class="small muted" style="text-align:right;margin-top:12px">Data: <a href="https://www.coingecko.com" rel="noopener">CoinGecko</a> · auto-refreshes every 60s</p>';
    host.innerHTML=html;
  }
  function load(){
    host.setAttribute('aria-busy','true');
    fetch(primary).then(function(r){if(!r.ok)throw new Error('cg fail');return r.json();}).then(function(d){render(d);}).catch(function(){
      // CoinCap fallback (no sparkline, but better than nothing)
      fetch('https://api.coincap.io/v2/assets?limit=12').then(function(r){return r.json();}).then(function(d){
        var rows=(d.data||[]).map(function(c){return{symbol:c.symbol,name:c.name,image:'',current_price:parseFloat(c.priceUsd),price_change_percentage_24h:parseFloat(c.changePercent24Hr),price_change_percentage_7d_in_currency:0,market_cap:parseFloat(c.marketCapUsd),sparkline_in_7d:{price:[]}};});
        render(rows);
      }).catch(function(){host.innerHTML='<p class="muted small">Live data unavailable. Please refresh.</p>';});
    }).finally(function(){host.removeAttribute('aria-busy');});
  }
  host.innerHTML='<p class="muted small">Loading live prices…</p>';
  load();
  setInterval(load,60000);
})();
