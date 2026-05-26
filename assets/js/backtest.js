/* Epicenter Exchange backtester v5 - backend-proxied (api.epicenterexchange.com).
   Equity: Yahoo Finance via /history. Crypto: CryptoCompare via /crypto/history (5y+ reliable, no key, no 401).
   4 strategies (SMA, RSI, MACD, Bollinger). 20+ quant metrics. Long-only, lag-1 (no look-ahead). */
(function(){
  'use strict';
  var mount = document.getElementById('backtest-app');
  if(!mount) return;
  var API = 'https://api.epicenterexchange.com';

  var ASSETS = {
    'Crypto':{type:'crypto',items:[['bitcoin','Bitcoin (BTC)'],['ethereum','Ethereum (ETH)'],['solana','Solana (SOL)'],['ripple','XRP'],['binancecoin','BNB'],['cardano','Cardano (ADA)'],['dogecoin','Dogecoin'],['polkadot','Polkadot'],['avalanche-2','Avalanche'],['chainlink','Chainlink'],['matic-network','Polygon'],['litecoin','Litecoin'],['tron','TRON'],['stellar','Stellar'],['monero','Monero']]},
    'US indices':{type:'equity',items:[['^GSPC','S&P 500'],['^NDX','NASDAQ 100'],['^DJI','Dow Jones'],['^RUT','Russell 2000']]},
    'US stocks':{type:'equity',items:[['AAPL','Apple'],['MSFT','Microsoft'],['NVDA','NVIDIA'],['GOOGL','Alphabet'],['AMZN','Amazon'],['META','Meta'],['TSLA','Tesla'],['JPM','JPMorgan'],['V','Visa'],['JNJ','Johnson & Johnson'],['WMT','Walmart'],['BRK-B','Berkshire B'],['KO','Coca-Cola'],['DIS','Disney'],['NFLX','Netflix']]},
    'India indices':{type:'equity',items:[['^NSEI','NIFTY 50'],['^BSESN','BSE Sensex'],['^NSEBANK','Bank Nifty']]},
    'India stocks':{type:'equity',items:[['RELIANCE.NS','Reliance'],['TCS.NS','TCS'],['HDFCBANK.NS','HDFC Bank'],['INFY.NS','Infosys'],['ICICIBANK.NS','ICICI Bank'],['HINDUNILVR.NS','HUL'],['ITC.NS','ITC'],['SBIN.NS','SBI'],['BHARTIARTL.NS','Bharti Airtel'],['KOTAKBANK.NS','Kotak Bank'],['LT.NS','Larsen & Toubro'],['ASIANPAINT.NS','Asian Paints'],['AXISBANK.NS','Axis Bank'],['MARUTI.NS','Maruti'],['ONGC.NS','ONGC']]},
    'UK & Europe':{type:'equity',items:[['^FTSE','FTSE 100'],['HSBA.L','HSBC'],['BP.L','BP'],['GSK.L','GSK'],['AZN.L','AstraZeneca'],['ULVR.L','Unilever'],['SHEL.L','Shell'],['VOD.L','Vodafone'],['^GDAXI','DAX'],['^FCHI','CAC 40']]},
    'Asia':{type:'equity',items:[['^N225','Nikkei 225'],['^HSI','Hang Seng'],['000001.SS','Shanghai Comp'],['^KS11','KOSPI']]}
  };
  var STRATS = [['sma','SMA 50/200 crossover'],['rsi','RSI(14) mean-reversion'],['macd','MACD(12,26,9)'],['bb','Bollinger reversion (20,2)']];

  function buildUI(){
    var groupOpts = Object.keys(ASSETS).map(function(g){
      return '<optgroup label="'+g+'">'+ASSETS[g].items.map(function(it){
        return '<option value="'+g+'::'+it[0]+'">'+it[1]+'</option>';
      }).join('')+'</optgroup>';
    }).join('');
    mount.innerHTML = '<div class="calc-form"><div class="grid grid-2">'+
      '<div class="field"><label>Asset</label><select id="bt-asset">'+groupOpts+'</select></div>'+
      '<div class="field"><label>Strategy</label><select id="bt-strat">'+STRATS.map(function(s){return '<option value="'+s[0]+'">'+s[1]+'</option>';}).join('')+'</select></div>'+
      '<div class="field"><label>Lookback (years)</label><select id="bt-yrs"><option value="1">1</option><option value="2">2</option><option value="3">3</option><option value="5" selected>5</option><option value="max">Max</option></select></div>'+
      '<div class="field" style="align-self:end"><button class="btn btn-primary" id="bt-run" type="button">Run backtest</button></div>'+
      '</div><div id="bt-status" class="small muted" aria-live="polite" style="min-height:1.4em;margin-top:8px"></div><div id="bt-out"></div></div>';
    document.getElementById('bt-run').addEventListener('click', run);
  }
  buildUI();

  function status(t,c){var el=document.getElementById('bt-status');el.textContent=t;el.style.color=c||'';}

  function fetchCrypto(id, yrs){
    var days = yrs==='max' ? 2000 : Math.min(parseInt(yrs)*365, 2000);
    return fetch(API+'/crypto/history?id='+encodeURIComponent(id)+'&days='+days)
      .then(function(r){if(!r.ok)throw new Error('Backend '+r.status);return r.json();})
      .then(function(j){if(!j.points||!j.points.length)throw new Error('No crypto data');return j.points.map(function(p){return {t:p[0],c:p[1]};});});
  }
  function fetchEquity(symbol, yrs){
    var range = yrs==='max' ? 'max' : (yrs+'y');
    if(['1','2','3','5','10'].indexOf(yrs)===-1 && yrs!=='max') range = '5y';
    return fetch(API+'/history?symbol='+encodeURIComponent(symbol)+'&range='+range+'&interval=1d')
      .then(function(r){if(!r.ok)return r.json().then(function(j){throw new Error(j.detail||('Backend '+r.status));});return r.json();})
      .then(function(j){if(!j.points||!j.points.length)throw new Error('No data for '+symbol);return j.points.map(function(p){return {t:p[0],c:p[1]};});});
  }

  function sma(arr,n){var out=new Array(arr.length).fill(null),s=0;for(var i=0;i<arr.length;i++){s+=arr[i];if(i>=n)s-=arr[i-n];if(i>=n-1)out[i]=s/n;}return out;}
  function ema(arr,n){var out=new Array(arr.length).fill(null),k=2/(n+1),prev=null;for(var i=0;i<arr.length;i++){if(prev===null){if(i>=n-1){var s=0;for(var j=i-n+1;j<=i;j++)s+=arr[j];prev=s/n;out[i]=prev;}}else{prev=arr[i]*k+prev*(1-k);out[i]=prev;}}return out;}
  function rsi(arr,n){var out=new Array(arr.length).fill(null),g=0,l=0;for(var i=1;i<arr.length;i++){var d=arr[i]-arr[i-1];var u=Math.max(d,0),v=Math.max(-d,0);if(i<=n){g+=u;l+=v;if(i===n){g/=n;l/=n;out[i]=l===0?100:100-100/(1+g/l);}}else{g=(g*(n-1)+u)/n;l=(l*(n-1)+v)/n;out[i]=l===0?100:100-100/(1+g/l);}}return out;}
  function macd(arr){var e12=ema(arr,12),e26=ema(arr,26),m=arr.map(function(_,i){return (e12[i]!=null&&e26[i]!=null)?e12[i]-e26[i]:null;});var sig=ema(m.map(function(v){return v||0;}),9);return {macd:m,signal:sig};}
  function bbands(arr,n,k){var m=sma(arr,n),up=new Array(arr.length).fill(null),lo=new Array(arr.length).fill(null);for(var i=n-1;i<arr.length;i++){var s=0;for(var j=i-n+1;j<=i;j++)s+=Math.pow(arr[j]-m[i],2);var sd=Math.sqrt(s/n);up[i]=m[i]+k*sd;lo[i]=m[i]-k*sd;}return {mid:m,up:up,lo:lo};}

  function buildSignal(prices, strat){
    var n=prices.length, p=prices.map(function(x){return x.c;}), raw=new Array(n).fill(0);
    if(strat==='sma'){var s50=sma(p,50),s200=sma(p,200);for(var i=0;i<n;i++)raw[i]=(s50[i]!=null&&s200[i]!=null&&s50[i]>s200[i])?1:0;}
    else if(strat==='rsi'){var r=rsi(p,14);var st=0;for(var i=0;i<n;i++){if(r[i]==null){raw[i]=0;continue;}if(r[i]<30)st=1;else if(r[i]>70)st=0;raw[i]=st;}}
    else if(strat==='macd'){var m=macd(p);for(var i=0;i<n;i++)raw[i]=(m.macd[i]!=null&&m.signal[i]!=null&&m.macd[i]>m.signal[i])?1:0;}
    else if(strat==='bb'){var b=bbands(p,20,2);var st2=0;for(var i=0;i<n;i++){if(b.lo[i]==null){raw[i]=0;continue;}if(p[i]<b.lo[i])st2=1;else if(p[i]>b.mid[i])st2=0;raw[i]=st2;}}
    var sig=new Array(n).fill(0);for(var i=1;i<n;i++)sig[i]=raw[i-1];
    return sig;
  }

  function avg(a){if(!a.length)return 0;var s=0;for(var i=0;i<a.length;i++)s+=a[i];return s/a.length;}
  function stdev(a,m){if(a.length<2)return 0;var s=0;for(var i=0;i<a.length;i++)s+=Math.pow(a[i]-m,2);return Math.sqrt(s/(a.length-1));}
  function cov(a,b,ma,mb){var n=Math.min(a.length,b.length);if(n<2)return 0;var s=0;for(var i=0;i<n;i++)s+=(a[i]-ma)*(b[i]-mb);return s/(n-1);}

  function backtest(prices, sig){
    var n=prices.length, rets=new Array(n).fill(0), bh=new Array(n).fill(0);
    var eq=1, bhEq=1, eqArr=[1], bhArr=[1];
    var trades=0, longDays=0, wins=[], losses=[];
    var inPos=false, entry=0;
    for(var i=1;i<n;i++){
      var r = prices[i].c/prices[i-1].c - 1;
      bh[i] = r;
      var posRet = sig[i]*r;
      rets[i] = posRet;
      eq *= (1+posRet);
      bhEq *= (1+r);
      eqArr.push(eq);
      bhArr.push(bhEq);
      if(sig[i]===1) longDays++;
      if(!inPos && sig[i]===1){inPos=true; entry=prices[i].c; trades++;}
      else if(inPos && sig[i]===0){var tr=prices[i].c/entry-1; if(tr>0)wins.push(tr); else losses.push(tr); inPos=false;}
    }
    if(inPos){var tr2=prices[n-1].c/entry-1; if(tr2>0)wins.push(tr2); else losses.push(tr2);}
    var years = (prices[n-1].t-prices[0].t)/(365.25*24*3600*1000);
    var cagr = Math.pow(eq, 1/Math.max(years,0.01))-1;
    var bhCagr = Math.pow(bhEq, 1/Math.max(years,0.01))-1;
    var mean = avg(rets.slice(1));
    var sd = stdev(rets.slice(1), mean);
    var neg = rets.slice(1).filter(function(x){return x<0;});
    var dStd = stdev(neg, 0);
    var sharpe = sd>0 ? mean/sd*Math.sqrt(252) : 0;
    var sortino = dStd>0 ? mean/dStd*Math.sqrt(252) : 0;
    var vol = sd*Math.sqrt(252);
    var peak = eqArr[0], maxDD = 0;
    for(var i=0;i<eqArr.length;i++){if(eqArr[i]>peak)peak=eqArr[i]; var dd=eqArr[i]/peak-1; if(dd<maxDD)maxDD=dd;}
    var sorted = rets.slice(1).slice().sort(function(a,b){return a-b;});
    var var95 = sorted.length ? sorted[Math.floor(sorted.length*0.05)] : 0;
    var bhMean = avg(bh.slice(1)), bhStd = stdev(bh.slice(1), bhMean);
    var beta = bhStd>0 ? cov(rets.slice(1), bh.slice(1), mean, bhMean)/(bhStd*bhStd) : 0;
    var alpha = (mean - beta*bhMean)*252;
    var diff = rets.slice(1).map(function(x,i){return x - bh.slice(1)[i];});
    var diffMean = avg(diff), diffStd = stdev(diff, diffMean);
    var ir = diffStd>0 ? diffMean/diffStd*Math.sqrt(252) : 0;
    var wr = (wins.length+losses.length)>0 ? wins.length/(wins.length+losses.length) : 0;
    var avgWin = wins.length ? avg(wins) : 0;
    var avgLoss = losses.length ? avg(losses) : 0;
    var pf;
    if(losses.length && Math.abs(losses.reduce(function(a,b){return a+b;},0))>0)
      pf = Math.abs(wins.reduce(function(a,b){return a+b;},0)/losses.reduce(function(a,b){return a+b;},0));
    else pf = wins.length ? Infinity : 0;
    var calmar = maxDD<0 ? cagr/Math.abs(maxDD) : 0;
    return {n:n, years:years, totalRet:eq-1, bhTotal:bhEq-1, cagr:cagr, bhCagr:bhCagr, alpha:alpha, beta:beta, timeInvested:longDays/n, sharpe:sharpe, sortino:sortino, calmar:calmar, ir:ir, vol:vol, maxDD:maxDD, var95:var95, trades:trades, winRate:wr, avgWin:avgWin, avgLoss:avgLoss, pf:pf, longDays:longDays, eqArr:eqArr, bhArr:bhArr};
  }

  function plot(eqArr, bhArr){
    var W=800, H=280, P=32, n=eqArr.length;
    var mx = Math.max(Math.max.apply(null,eqArr), Math.max.apply(null,bhArr));
    var mn = Math.min(Math.min.apply(null,eqArr), Math.min.apply(null,bhArr));
    var sx = function(i){return P+i/(n-1)*(W-2*P);};
    var sy = function(v){return H-P-(v-mn)/(mx-mn||1)*(H-2*P);};
    function path(arr){var s=''; for(var i=0;i<arr.length;i++) s+=(i===0?'M':'L')+sx(i).toFixed(1)+' '+sy(arr[i]).toFixed(1); return s;}
    return '<svg viewBox="0 0 '+W+' '+H+'" style="width:100%;height:auto;background:#fff;border:1px solid #E2E8F0;border-radius:8px;margin:12px 0">'+
      '<path d="'+path(bhArr)+'" fill="none" stroke="#94A3B8" stroke-width="1.5"></path>'+
      '<path d="'+path(eqArr)+'" fill="none" stroke="#C9A227" stroke-width="2"></path>'+
      '<text x="'+(W-P)+'" y="16" text-anchor="end" font-size="11" fill="#64748B"><tspan fill="#C9A227">--- Strategy</tspan>  <tspan fill="#94A3B8">--- Buy &amp; Hold</tspan></text></svg>';
  }

  function pct(x){return (x*100).toFixed(2)+'%';}
  function num(x,d){return (x||0).toFixed(d||2);}

  function renderResult(meta, r){
    var rows = [['Years',num(r.years,2)],['Bars',r.n],['Strategy total',pct(r.totalRet)],['Buy & hold total',pct(r.bhTotal)],['Strategy CAGR',pct(r.cagr)],['B&H CAGR',pct(r.bhCagr)],['Alpha (ann.)',pct(r.alpha)],['Beta',num(r.beta,2)],['Time invested',pct(r.timeInvested)],['Sharpe',num(r.sharpe,2)],['Sortino',num(r.sortino,2)],['Calmar',num(r.calmar,2)],['Info ratio',num(r.ir,2)],['Volatility (ann.)',pct(r.vol)],['Max drawdown',pct(r.maxDD)],['Daily VaR 95%',pct(r.var95)],['Trades',r.trades],['Win rate',pct(r.winRate)],['Avg win',pct(r.avgWin)],['Avg loss',pct(r.avgLoss)],['Profit factor',isFinite(r.pf)?num(r.pf,2):'inf']];
    var tbl = '<table class="calc-out"><tbody>'+rows.map(function(p){return '<tr><th>'+p[0]+'</th><td>'+p[1]+'</td></tr>';}).join('')+'</tbody></table>';
    document.getElementById('bt-out').innerHTML = '<div class="callout"><strong>'+meta.label+'</strong> &middot; '+meta.strat+' &middot; '+meta.range+'</div>'+plot(r.eqArr, r.bhArr)+tbl+'<p class="muted small">Long-only, daily bars, lag-1 (no look-ahead). No costs / slippage / taxes modelled. Educational only.</p>';
  }

  function run(){
    var sel = document.getElementById('bt-asset').value;
    var strat = document.getElementById('bt-strat').value;
    var yrs = document.getElementById('bt-yrs').value;
    var parts = sel.split('::'), group = parts[0], ticker = parts[1];
    var info = ASSETS[group];
    var label = info.items.filter(function(it){return it[0]===ticker;})[0][1];
    status('Fetching '+label+'...', '#64748B');
    document.getElementById('bt-out').innerHTML = '';
    var p = info.type==='crypto' ? fetchCrypto(ticker, yrs) : fetchEquity(ticker, yrs);
    p.then(function(prices){
      if(prices.length<60) throw new Error('Need 60+ daily bars (got '+prices.length+')');
      status('Running '+strat.toUpperCase()+' on '+prices.length+' bars...', '#64748B');
      var sig = buildSignal(prices, strat);
      var r = backtest(prices, sig);
      status('Done. '+pct(r.totalRet)+' vs B&H '+pct(r.bhTotal)+'.', '#10B981');
      renderResult({label:label, strat:STRATS.filter(function(s){return s[0]===strat;})[0][1], range:yrs+' yr'}, r);
    }).catch(function(e){
      status('Error: '+(e.message||e), '#EF4444');
    });
  }
})();
