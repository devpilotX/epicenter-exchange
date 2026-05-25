/* Epicenter Exchange — in-browser backtester.
   Fetches free historical daily OHLC from CoinGecko (crypto) or Stooq (equities).
   Runs SMA crossover, RSI mean-reversion, or MACD locally. Plots equity curve as SVG.
   No backend required — 100% client-side. */
(function(){
  'use strict';
  var host=document.getElementById('backtest-app');
  if(!host)return;

  /* ---------- Data sources ---------- */
  function fetchCrypto(id,days){
    var url='https://api.coingecko.com/api/v3/coins/'+id+'/market_chart?vs_currency=usd&days='+days+'&interval=daily';
    return fetch(url).then(function(r){if(!r.ok)throw new Error('coingecko');return r.json();}).then(function(d){
      return (d.prices||[]).map(function(p){return{t:p[0],c:p[1]};});
    });
  }
  function fetchEquity(ticker){
    // Stooq returns CSV: Date,Open,High,Low,Close,Volume
    var url='https://stooq.com/q/d/l/?s='+encodeURIComponent(ticker.toLowerCase())+'&i=d';
    return fetch(url).then(function(r){if(!r.ok)throw new Error('stooq');return r.text();}).then(function(csv){
      var lines=csv.trim().split(/\r?\n/);
      var out=[];
      for(var i=1;i<lines.length;i++){
        var p=lines[i].split(',');if(p.length<5)continue;
        var t=new Date(p[0]).getTime();var c=parseFloat(p[4]);
        if(isFinite(t)&&isFinite(c))out.push({t:t,c:c});
      }
      return out;
    });
  }

  /* ---------- Indicators ---------- */
  function sma(arr,n){var out=new Array(arr.length).fill(null);var sum=0;for(var i=0;i<arr.length;i++){sum+=arr[i];if(i>=n)sum-=arr[i-n];if(i>=n-1)out[i]=sum/n;}return out;}
  function rsi(arr,n){
    var out=new Array(arr.length).fill(null);var gains=0,losses=0;
    for(var i=1;i<arr.length;i++){
      var d=arr[i]-arr[i-1];var g=Math.max(d,0);var l=Math.max(-d,0);
      if(i<=n){gains+=g;losses+=l;if(i===n){gains/=n;losses/=n;var rs=losses===0?100:gains/losses;out[i]=100-100/(1+rs);}}
      else{gains=(gains*(n-1)+g)/n;losses=(losses*(n-1)+l)/n;var rs2=losses===0?100:gains/losses;out[i]=100-100/(1+rs2);}
    }
    return out;
  }
  function ema(arr,n){var out=new Array(arr.length).fill(null);var k=2/(n+1);var prev=null;for(var i=0;i<arr.length;i++){if(arr[i]==null)continue;if(prev==null){prev=arr[i];}else{prev=arr[i]*k+prev*(1-k);}out[i]=prev;}return out;}
  function macdSignal(closes){
    var e12=ema(closes,12),e26=ema(closes,26);
    var macd=closes.map(function(_,i){return e12[i]!=null&&e26[i]!=null?e12[i]-e26[i]:null;});
    var sig=ema(macd.map(function(v){return v==null?0:v;}),9);
    return {macd:macd,sig:sig};
  }

  /* ---------- Strategy signals (long-only) ---------- */
  function sigSMA(closes){var f=sma(closes,50),s=sma(closes,200);return closes.map(function(_,i){return f[i]!=null&&s[i]!=null?(f[i]>s[i]?1:0):0;});}
  function sigRSI(closes){var r=rsi(closes,14);var pos=0;return closes.map(function(_,i){var v=r[i];if(v==null)return 0;if(v<30)pos=1;else if(v>70)pos=0;return pos;});}
  function sigMACD(closes){var x=macdSignal(closes);return closes.map(function(_,i){return x.macd[i]!=null&&x.sig[i]!=null?(x.macd[i]>x.sig[i]?1:0):0;});}

  /* ---------- Backtest engine ---------- */
  function runBacktest(series,strategy){
    var closes=series.map(function(d){return d.c;});
    var sig=strategy==='sma'?sigSMA(closes):strategy==='rsi'?sigRSI(closes):sigMACD(closes);
    // Lag signals by 1 day (no look-ahead).
    var lagged=[0].concat(sig.slice(0,-1));
    var equity=[1];var bh=[1];
    for(var i=1;i<closes.length;i++){
      var r=(closes[i]/closes[i-1])-1;
      equity.push(equity[i-1]*(1+(lagged[i]*r)));
      bh.push(bh[i-1]*(1+r));
    }
    // Stats
    var years=(series[series.length-1].t-series[0].t)/(365.25*86400*1000);
    var totalRet=equity[equity.length-1]-1;
    var bhRet=bh[bh.length-1]-1;
    var cagr=Math.pow(1+totalRet,1/Math.max(years,0.01))-1;
    var bhCagr=Math.pow(1+bhRet,1/Math.max(years,0.01))-1;
    // Daily returns + volatility + Sharpe
    var rets=[];for(var j=1;j<equity.length;j++)rets.push(equity[j]/equity[j-1]-1);
    var mean=rets.reduce(function(a,b){return a+b;},0)/rets.length;
    var sd=Math.sqrt(rets.reduce(function(a,b){return a+(b-mean)*(b-mean);},0)/rets.length);
    var sharpe=sd>0?(mean/sd)*Math.sqrt(252):0;
    // Max drawdown
    var peak=equity[0],maxDD=0;
    for(var k=0;k<equity.length;k++){if(equity[k]>peak)peak=equity[k];var dd=(equity[k]-peak)/peak;if(dd<maxDD)maxDD=dd;}
    // Win rate (per non-zero signal day)
    var wins=0,trades=0;for(var m=1;m<lagged.length;m++){if(lagged[m]===1){trades++;if(closes[m]>closes[m-1])wins++;}}
    var winRate=trades>0?wins/trades:0;
    return {equity:equity,bh:bh,series:series,totalRet:totalRet,bhRet:bhRet,cagr:cagr,bhCagr:bhCagr,sharpe:sharpe,maxDD:maxDD,winRate:winRate,trades:trades,years:years};
  }

  /* ---------- SVG plot ---------- */
  function plot(res){
    var w=720,h=260,pad={t:16,r:16,b:24,l:48};
    var n=res.equity.length;
    var all=res.equity.concat(res.bh);
    var min=Math.min.apply(null,all),max=Math.max.apply(null,all);
    function x(i){return pad.l+(i/(n-1))*(w-pad.l-pad.r);}
    function y(v){return h-pad.b-((v-min)/(max-min||1))*(h-pad.t-pad.b);}
    function path(arr,color){var d=arr.map(function(v,i){return (i===0?'M':'L')+x(i).toFixed(1)+' '+y(v).toFixed(1);}).join(' ');return '<path d="'+d+'" fill="none" stroke="'+color+'" stroke-width="1.8" stroke-linejoin="round"/>';}
    var ticks=4;var grid='';for(var i=0;i<=ticks;i++){var v=min+(i/ticks)*(max-min);var yy=y(v);grid+='<line x1="'+pad.l+'" y1="'+yy+'" x2="'+(w-pad.r)+'" y2="'+yy+'" stroke="#E2E8F0" stroke-width="1"/><text x="'+(pad.l-6)+'" y="'+(yy+4)+'" text-anchor="end" font-size="10" fill="#64748B" font-family="IBM Plex Mono, monospace">'+v.toFixed(2)+'x</text>';}
    return '<svg viewBox="0 0 '+w+' '+h+'" width="100%" height="'+h+'" role="img" aria-label="Equity curve">'+grid+path(res.bh,'#94A3B8')+path(res.equity,'#C9A227')+'</svg><div class="plot-legend"><span><i style="background:#C9A227"></i> Strategy</span><span><i style="background:#94A3B8"></i> Buy &amp; hold</span></div>';
  }

  function pct(v){return (v*100).toFixed(2)+'%';}
  function render(res){
    var out=document.getElementById('bt-out');
    if(!res){out.innerHTML='';return;}
    out.innerHTML='<div class="bt-results">'+
      '<div class="bt-stats">'+
        '<div><span class="muted small">Years</span><strong>'+res.years.toFixed(1)+'</strong></div>'+
        '<div><span class="muted small">Strategy total</span><strong class="'+(res.totalRet>=0?'gain':'loss')+'">'+pct(res.totalRet)+'</strong></div>'+
        '<div><span class="muted small">Buy &amp; hold total</span><strong>'+pct(res.bhRet)+'</strong></div>'+
        '<div><span class="muted small">Strategy CAGR</span><strong>'+pct(res.cagr)+'</strong></div>'+
        '<div><span class="muted small">B&amp;H CAGR</span><strong>'+pct(res.bhCagr)+'</strong></div>'+
        '<div><span class="muted small">Sharpe (rf=0)</span><strong>'+res.sharpe.toFixed(2)+'</strong></div>'+
        '<div><span class="muted small">Max drawdown</span><strong class="loss">'+pct(res.maxDD)+'</strong></div>'+
        '<div><span class="muted small">Days long</span><strong>'+res.trades+'</strong></div>'+
      '</div>'+
      '<div class="bt-plot">'+plot(res)+'</div>'+
      '<p class="small muted">No transaction costs, slippage, taxes, or borrow modelled. Past performance is not indicative of future results. Educational only.</p>'+
    '</div>';
  }

  /* ---------- UI ---------- */
  host.innerHTML='<form id="bt-form" class="bt-form" onsubmit="return false">'+
    '<div class="field"><label for="bt-asset">Asset class</label><select id="bt-asset"><option value="crypto">Crypto (CoinGecko)</option><option value="equity">Equity / Index (Stooq)</option></select></div>'+
    '<div class="field"><label for="bt-ticker">Ticker / coin ID</label><input id="bt-ticker" value="bitcoin" placeholder="bitcoin, ethereum … or AAPL, ^SPX, TCS.NS"></div>'+
    '<div class="field"><label for="bt-strategy">Strategy</label><select id="bt-strategy"><option value="sma">SMA crossover (50/200)</option><option value="rsi">RSI(14) mean-reversion</option><option value="macd">MACD(12/26/9)</option></select></div>'+
    '<div class="field"><label for="bt-days">History (crypto only, days)</label><input id="bt-days" type="number" min="90" max="3650" step="1" value="1825"></div>'+
    '<button type="submit" class="btn btn-primary" id="bt-run">Run backtest</button>'+
    '<p class="small muted" style="margin-top:10px">Crypto IDs use CoinGecko names (bitcoin, ethereum, solana…). Equity tickers use Stooq format (e.g. <code>aapl.us</code>, <code>^spx</code>, <code>tcs.in</code>).</p>'+
  '</form><div id="bt-out"></div>';

  document.getElementById('bt-asset').addEventListener('change',function(e){
    document.getElementById('bt-ticker').value=e.target.value==='crypto'?'bitcoin':'aapl.us';
  });
  document.getElementById('bt-run').addEventListener('click',function(){
    var out=document.getElementById('bt-out');
    var asset=document.getElementById('bt-asset').value;
    var ticker=document.getElementById('bt-ticker').value.trim();
    var strat=document.getElementById('bt-strategy').value;
    var days=parseInt(document.getElementById('bt-days').value,10)||1825;
    if(!ticker){out.innerHTML='<p class="callout danger small">Enter a ticker or coin ID.</p>';return;}
    out.innerHTML='<p class="muted small">Fetching data…</p>';
    var p=asset==='crypto'?fetchCrypto(ticker,days):fetchEquity(ticker);
    p.then(function(series){
      if(!series||series.length<60){out.innerHTML='<p class="callout danger small">Not enough data for that ticker. Double-check the symbol.</p>';return;}
      var res=runBacktest(series,strat);
      render(res);
    }).catch(function(err){out.innerHTML='<p class="callout danger small">Data fetch failed: '+(err&&err.message?err.message:'unknown error')+'. CoinGecko / Stooq may rate-limit; try again in 30s.</p>';});
  });
})();
