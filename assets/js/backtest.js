/* Epicenter Exchange — in-browser backtester v3.
   - Crypto via CoinGecko (open CORS)
   - Equities/indices via Stooq through CORS proxies (Stooq sends no CORS header)
   - 15+ quant metrics: CAGR, Sharpe, Sortino, Calmar, Info Ratio, Beta, Alpha,
     Volatility, Max DD + duration, Win-rate, Profit factor, streaks, VaR 95%, etc.
   - Long-only, daily bars, lag-1 to avoid look-ahead. */
(function(){
  'use strict';
  var host=document.getElementById('backtest-app');
  if(!host)return;

  var CORS_PROXIES=[
    function(u){return 'https://corsproxy.io/?url='+encodeURIComponent(u);},
    function(u){return 'https://api.allorigins.win/raw?url='+encodeURIComponent(u);},
    function(u){return 'https://api.codetabs.com/v1/proxy?quest='+encodeURIComponent(u);}
  ];
  function fetchWithProxy(url){
    var i=0;
    function attempt(){
      if(i>=CORS_PROXIES.length)return Promise.reject(new Error('all proxies failed'));
      var p=CORS_PROXIES[i++](url);
      return fetch(p).then(function(r){if(!r.ok)throw new Error('proxy '+(i-1)+' '+r.status);return r.text();}).catch(function(){return attempt();});
    }
    return attempt();
  }

  var TICKERS={
    'Crypto':[['bitcoin','Bitcoin'],['ethereum','Ethereum'],['solana','Solana'],['cardano','Cardano'],['ripple','XRP'],['dogecoin','Dogecoin'],['polkadot','Polkadot'],['avalanche-2','Avalanche'],['chainlink','Chainlink'],['matic-network','Polygon'],['litecoin','Litecoin'],['binancecoin','BNB'],['tron','TRON'],['stellar','Stellar'],['monero','Monero']],
    'US indices':[['^spx','S&P 500'],['^ndx','NASDAQ 100'],['^dji','Dow Jones'],['^rut','Russell 2000']],
    'US stocks':[['aapl.us','Apple'],['msft.us','Microsoft'],['googl.us','Alphabet'],['amzn.us','Amazon'],['nvda.us','NVIDIA'],['meta.us','Meta'],['tsla.us','Tesla'],['jpm.us','JPMorgan'],['v.us','Visa'],['jnj.us','J&J'],['wmt.us','Walmart'],['pg.us','P&G'],['brk-b.us','Berkshire B'],['ko.us','Coca-Cola'],['dis.us','Disney']],
    'India indices':[['^nse','NIFTY 50'],['^bsx','BSE Sensex']],
    'India stocks':[['reliance.in','Reliance'],['tcs.in','TCS'],['infy.in','Infosys'],['hdfcbank.in','HDFC Bank'],['icicibank.in','ICICI Bank'],['hindunilvr.in','HUL'],['itc.in','ITC'],['sbin.in','SBI'],['bhartiartl.in','Bharti Airtel'],['kotakbank.in','Kotak Bank'],['lt.in','L&T'],['asianpaint.in','Asian Paints'],['axisbank.in','Axis Bank'],['maruti.in','Maruti'],['ongc.in','ONGC']],
    'UK':[['^ftm','FTSE 100'],['^ftmc','FTSE 250'],['hsba.uk','HSBC'],['bp.uk','BP'],['gsk.uk','GSK'],['azn.uk','AstraZeneca'],['ulvr.uk','Unilever'],['shel.uk','Shell'],['vod.uk','Vodafone']],
    'Global':[['^dax','DAX'],['^cac','CAC 40'],['^n225','Nikkei 225'],['^hsi','Hang Seng']]
  };
  function isCryptoId(id){return TICKERS['Crypto'].some(function(p){return p[0]===id;});}

  function fetchCrypto(id,days){
    var url='https://api.coingecko.com/api/v3/coins/'+id+'/market_chart?vs_currency=usd&days='+days+'&interval=daily';
    return fetch(url).then(function(r){if(!r.ok)throw new Error('coingecko '+r.status);return r.json();}).then(function(d){return (d.prices||[]).map(function(p){return{t:p[0],c:p[1]};});});
  }
  function fetchEquity(ticker){
    var url='https://stooq.com/q/d/l/?s='+encodeURIComponent(ticker)+'&i=d';
    return fetchWithProxy(url).then(function(csv){
      var lines=(csv||'').trim().split(/\r?\n/),out=[];
      for(var i=1;i<lines.length;i++){var p=lines[i].split(',');if(p.length<5)continue;var t=new Date(p[0]).getTime();var c=parseFloat(p[4]);if(isFinite(t)&&isFinite(c))out.push({t:t,c:c});}
      return out;
    });
  }

  function sma(a,n){var o=new Array(a.length).fill(null),s=0;for(var i=0;i<a.length;i++){s+=a[i];if(i>=n)s-=a[i-n];if(i>=n-1)o[i]=s/n;}return o;}
  function rsi(a,n){var o=new Array(a.length).fill(null),g=0,l=0;for(var i=1;i<a.length;i++){var d=a[i]-a[i-1],gg=Math.max(d,0),ll=Math.max(-d,0);if(i<=n){g+=gg;l+=ll;if(i===n){g/=n;l/=n;var rs=l===0?100:g/l;o[i]=100-100/(1+rs);}}else{g=(g*(n-1)+gg)/n;l=(l*(n-1)+ll)/n;var rs2=l===0?100:g/l;o[i]=100-100/(1+rs2);}}return o;}
  function ema(a,n){var o=new Array(a.length).fill(null),k=2/(n+1),p=null;for(var i=0;i<a.length;i++){if(a[i]==null)continue;p=p==null?a[i]:a[i]*k+p*(1-k);o[i]=p;}return o;}
  function macdSig(c){var e12=ema(c,12),e26=ema(c,26);var m=c.map(function(_,i){return e12[i]!=null&&e26[i]!=null?e12[i]-e26[i]:null;});var s=ema(m.map(function(v){return v==null?0:v;}),9);return {m:m,s:s};}
  function boll(c,n,k){var m=sma(c,n),b=[];for(var i=0;i<c.length;i++){if(m[i]==null){b.push({u:null,l:null});continue;}var s=0;for(var j=i-n+1;j<=i;j++)s+=(c[j]-m[i])*(c[j]-m[i]);var sd=Math.sqrt(s/n);b.push({u:m[i]+k*sd,l:m[i]-k*sd});}return b;}

  function sigSMA(c){var f=sma(c,50),s=sma(c,200);return c.map(function(_,i){return f[i]!=null&&s[i]!=null?(f[i]>s[i]?1:0):0;});}
  function sigRSI(c){var r=rsi(c,14),p=0;return c.map(function(_,i){var v=r[i];if(v==null)return 0;if(v<30)p=1;else if(v>70)p=0;return p;});}
  function sigMACD(c){var x=macdSig(c);return c.map(function(_,i){return x.m[i]!=null&&x.s[i]!=null?(x.m[i]>x.s[i]?1:0):0;});}
  function sigBoll(c){var b=boll(c,20,2),p=0;return c.map(function(v,i){var bb=b[i];if(!bb||bb.l==null)return 0;if(v<bb.l)p=1;else if(v>bb.u)p=0;return p;});}

  function runBacktest(series,strategy){
    var c=series.map(function(d){return d.c;});
    var sig=strategy==='sma'?sigSMA(c):strategy==='rsi'?sigRSI(c):strategy==='macd'?sigMACD(c):sigBoll(c);
    var lag=[0].concat(sig.slice(0,-1));
    var eq=[1],bh=[1];
    for(var i=1;i<c.length;i++){var r=(c[i]/c[i-1])-1;eq.push(eq[i-1]*(1+(lag[i]*r)));bh.push(bh[i-1]*(1+r));}
    var yrs=(series[series.length-1].t-series[0].t)/(365.25*86400*1000);
    var tr=eq[eq.length-1]-1,bhr=bh[bh.length-1]-1;
    var cagr=Math.pow(1+tr,1/Math.max(yrs,0.01))-1;
    var bhCagr=Math.pow(1+bhr,1/Math.max(yrs,0.01))-1;
    var rs=[],brs=[];for(var j=1;j<eq.length;j++){rs.push(eq[j]/eq[j-1]-1);brs.push(bh[j]/bh[j-1]-1);}
    var mean=rs.reduce(function(a,b){return a+b;},0)/rs.length;
    var bMean=brs.reduce(function(a,b){return a+b;},0)/brs.length;
    var sd=Math.sqrt(rs.reduce(function(a,b){return a+(b-mean)*(b-mean);},0)/rs.length);
    var sharpe=sd>0?(mean/sd)*Math.sqrt(252):0;
    var down=rs.filter(function(x){return x<0;});
    var dsd=down.length?Math.sqrt(down.reduce(function(a,b){return a+b*b;},0)/down.length):0;
    var sortino=dsd>0?(mean/dsd)*Math.sqrt(252):0;
    var peak=eq[0],mdd=0,curDur=0,ddDur=0;
    for(var k=0;k<eq.length;k++){if(eq[k]>=peak){peak=eq[k];curDur=0;}else{curDur++;ddDur=Math.max(ddDur,curDur);}var dd=(eq[k]-peak)/peak;if(dd<mdd)mdd=dd;}
    var calmar=Math.abs(mdd)>0.001?cagr/Math.abs(mdd):0;
    var volAnn=sd*Math.sqrt(252);
    var cov=0,vb=0;for(var m=0;m<rs.length;m++){cov+=(rs[m]-mean)*(brs[m]-bMean);vb+=(brs[m]-bMean)*(brs[m]-bMean);}cov/=rs.length;vb/=rs.length;
    var beta=vb>0?cov/vb:0,alpha=(mean-beta*bMean)*252;
    var ex=rs.map(function(v,idx){return v-brs[idx];});
    var em=ex.reduce(function(a,b){return a+b;},0)/ex.length;
    var es=Math.sqrt(ex.reduce(function(a,b){return a+(b-em)*(b-em);},0)/ex.length);
    var ir=es>0?(em/es)*Math.sqrt(252):0;
    var sorted=rs.slice().sort(function(a,b){return a-b;});
    var var95=sorted[Math.floor(sorted.length*0.05)]||0;
    var daysLong=lag.filter(function(x){return x===1;}).length;
    var pctInv=daysLong/lag.length;
    var trades=[],entry=null;
    for(var t=1;t<lag.length;t++){
      if(lag[t]===1&&lag[t-1]===0)entry={i:t,p:c[t]};
      else if(lag[t]===0&&lag[t-1]===1&&entry){trades.push({pl:(c[t]/entry.p)-1,d:t-entry.i});entry=null;}
    }
    if(entry)trades.push({pl:(c[c.length-1]/entry.p)-1,d:c.length-1-entry.i,open:true});
    var wins=trades.filter(function(x){return x.pl>0;});
    var losses=trades.filter(function(x){return x.pl<=0;});
    var wr=trades.length?wins.length/trades.length:0;
    var aw=wins.length?wins.reduce(function(a,b){return a+b.pl;},0)/wins.length:0;
    var al=losses.length?losses.reduce(function(a,b){return a+b.pl;},0)/losses.length:0;
    var pf=al<0?Math.abs((aw*wins.length)/(al*losses.length)):0;
    var lw=0,ll=0,cw=0,cl=0;
    trades.forEach(function(x){if(x.pl>0){cw++;cl=0;lw=Math.max(lw,cw);}else{cl++;cw=0;ll=Math.max(ll,cl);}});
    return {eq:eq,bh:bh,tr:tr,bhr:bhr,cagr:cagr,bhCagr:bhCagr,sharpe:sharpe,sortino:sortino,calmar:calmar,mdd:mdd,ddDur:ddDur,volAnn:volAnn,beta:beta,alpha:alpha,ir:ir,var95:var95,pctInv:pctInv,daysLong:daysLong,nTrades:trades.length,wr:wr,aw:aw,al:al,pf:pf,lw:lw,ll:ll,yrs:yrs};
  }

  function plot(r){
    var w=720,h=280,p={t:16,r:16,b:24,l:52};
    var n=r.eq.length;
    var all=r.eq.concat(r.bh),min=Math.min.apply(null,all),max=Math.max.apply(null,all);
    function x(i){return p.l+(i/(n-1))*(w-p.l-p.r);}
    function y(v){return h-p.b-((v-min)/(max-min||1))*(h-p.t-p.b);}
    function path(a,c){var d=a.map(function(v,i){return (i===0?'M':'L')+x(i).toFixed(1)+' '+y(v).toFixed(1);}).join(' ');return '<path d="'+d+'" fill="none" stroke="'+c+'" stroke-width="1.8"/>';}
    var g='';for(var i=0;i<=4;i++){var v=min+(i/4)*(max-min);var yy=y(v);g+='<line x1="'+p.l+'" y1="'+yy+'" x2="'+(w-p.r)+'" y2="'+yy+'" stroke="#E2E8F0"/><text x="'+(p.l-6)+'" y="'+(yy+4)+'" text-anchor="end" font-size="10" fill="#64748B" font-family="IBM Plex Mono, monospace">'+v.toFixed(2)+'x</text>';}
    return '<svg viewBox="0 0 '+w+' '+h+'" width="100%" height="'+h+'" role="img">'+g+path(r.bh,'#94A3B8')+path(r.eq,'#C9A227')+'</svg><div class="plot-legend"><span><i style="background:#C9A227"></i> Strategy</span><span><i style="background:#94A3B8"></i> Buy &amp; hold</span></div>';
  }
  function pct(v){return (v*100).toFixed(2)+'%';}
  function num(v,d){return (v||0).toFixed(d||2);}
  function stat(l,v,cls){return '<div><span class="muted small">'+l+'</span><strong'+(cls?' class="'+cls+'"':'')+'>'+v+'</strong></div>';}
  function render(r){
    var out=document.getElementById('bt-out');
    out.innerHTML='<div class="bt-results">'+
      '<h3 style="margin-top:0">Returns</h3><div class="bt-stats">'+
        stat('Years',num(r.yrs,1))+stat('Strategy total',pct(r.tr),r.tr>=0?'gain':'loss')+stat('B&amp;H total',pct(r.bhr),r.bhr>=0?'gain':'loss')+stat('Strategy CAGR',pct(r.cagr))+stat('B&amp;H CAGR',pct(r.bhCagr))+stat('Alpha (ann.)',pct(r.alpha),r.alpha>=0?'gain':'loss')+stat('Beta vs B&amp;H',num(r.beta))+stat('% time invested',pct(r.pctInv))+
      '</div>'+
      '<h3>Risk</h3><div class="bt-stats">'+
        stat('Sharpe',num(r.sharpe))+stat('Sortino',num(r.sortino))+stat('Calmar',num(r.calmar))+stat('Info ratio',num(r.ir))+stat('Volatility (ann.)',pct(r.volAnn))+stat('Max drawdown',pct(r.mdd),'loss')+stat('Max DD length',r.ddDur+'d')+stat('VaR 95% (1d)',pct(r.var95),'loss')+
      '</div>'+
      '<h3>Trades</h3><div class="bt-stats">'+
        stat('# Trades',num(r.nTrades,0))+stat('Win rate',pct(r.wr))+stat('Avg win',pct(r.aw),'gain')+stat('Avg loss',pct(r.al),'loss')+stat('Profit factor',num(r.pf))+stat('Longest win streak',r.lw)+stat('Longest loss streak',r.ll)+stat('Days long',r.daysLong)+
      '</div>'+
      '<h3>Equity curve</h3><div class="bt-plot">'+plot(r)+'</div>'+
      '<p class="small muted" style="margin-top:16px">Long-only daily bars, lag-1 (no look-ahead). No costs, slippage, taxes, or borrow modelled. Past performance does not predict future. Educational only.</p>'+
    '</div>';
  }

  function opts(){
    var h='';
    Object.keys(TICKERS).forEach(function(g){h+='<optgroup label="'+g+'">';TICKERS[g].forEach(function(t){h+='<option value="'+t[0]+'">'+t[1]+' ('+t[0]+')</option>';});h+='</optgroup>';});
    return h;
  }
  host.innerHTML='<form id="bt-form" class="bt-form" onsubmit="return false">'+
    '<div class="field"><label for="bt-preset">Quick pick (60+ instruments)</label><select id="bt-preset">'+opts()+'</select></div>'+
    '<div class="field"><label for="bt-ticker">Or type a ticker</label><input id="bt-ticker" value="bitcoin" placeholder="bitcoin, ^spx, aapl.us, tcs.in…"></div>'+
    '<div class="field"><label for="bt-strategy">Strategy</label><select id="bt-strategy"><option value="sma">SMA 50/200 crossover</option><option value="rsi">RSI(14) mean-reversion</option><option value="macd">MACD(12/26/9)</option><option value="boll">Bollinger reversion (20,2)</option></select></div>'+
    '<div class="field"><label for="bt-days">History (crypto, days)</label><input id="bt-days" type="number" min="90" max="3650" step="1" value="1825"></div>'+
    '<button type="submit" class="btn btn-primary" id="bt-run">Run backtest</button>'+
    '<p class="small muted" style="margin-top:10px">Equities/indices fetched via CORS proxy (Stooq sends no CORS header). Crypto from CoinGecko direct. All math runs locally in your browser.</p>'+
  '</form><div id="bt-out"></div>';

  document.getElementById('bt-preset').addEventListener('change',function(e){document.getElementById('bt-ticker').value=e.target.value;});
  document.getElementById('bt-run').addEventListener('click',function(){
    var out=document.getElementById('bt-out');
    var t=document.getElementById('bt-ticker').value.trim().toLowerCase();
    var s=document.getElementById('bt-strategy').value;
    var d=parseInt(document.getElementById('bt-days').value,10)||1825;
    if(!t){out.innerHTML='<p class="callout danger small">Enter a ticker.</p>';return;}
    out.innerHTML='<p class="muted small">Fetching data… (5–15s on first request)</p>';
    var crypto=isCryptoId(t)||(!t.includes('.')&&!t.startsWith('^'));
    var p=crypto?fetchCrypto(t,d):fetchEquity(t);
    p.then(function(series){
      if(!series||series.length<60){out.innerHTML='<p class="callout danger small">Not enough data (need 60+ bars). Pick from the dropdown.</p>';return;}
      render(runBacktest(series,s));
    }).catch(function(err){out.innerHTML='<p class="callout danger small">Fetch failed: '+(err&&err.message?err.message:'unknown')+'. Try again in 30s or pick another ticker.</p>';});
  });
})();
