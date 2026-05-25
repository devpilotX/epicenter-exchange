// Live ticker using CoinGecko (free, no key) + static India/US/UK fallback rendered server-side.
// If offline / blocked, the ticker still shows static seed values.
async function loadTicker(){
  const el = document.getElementById('ticker-track');
  if (!el) return;
  const fallback = [
    {sym:'NIFTY 50', px:'22,431', chg:'+0.83%', up:true},
    {sym:'SENSEX',   px:'73,920', chg:'+0.61%', up:true},
    {sym:'BANK NIFTY',px:'47,210',chg:'-0.22%', up:false},
    {sym:'S&P 500',  px:'5,287',  chg:'+0.31%', up:true},
    {sym:'NASDAQ',   px:'16,920', chg:'+0.48%', up:true},
    {sym:'FTSE 100', px:'8,142',  chg:'-0.11%', up:false},
  ];
  let crypto = [];
  try{
    const r = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana,ripple&vs_currencies=usd&include_24hr_change=true');
    if(r.ok){
      const d = await r.json();
      crypto = [
        {sym:'BTC', px:'$'+d.bitcoin.usd.toLocaleString(), chg:d.bitcoin.usd_24h_change.toFixed(2)+'%', up:d.bitcoin.usd_24h_change>=0},
        {sym:'ETH', px:'$'+d.ethereum.usd.toLocaleString(), chg:d.ethereum.usd_24h_change.toFixed(2)+'%', up:d.ethereum.usd_24h_change>=0},
        {sym:'SOL', px:'$'+d.solana.usd.toLocaleString(), chg:d.solana.usd_24h_change.toFixed(2)+'%', up:d.solana.usd_24h_change>=0},
        {sym:'XRP', px:'$'+d.ripple.usd.toLocaleString(), chg:d.ripple.usd_24h_change.toFixed(2)+'%', up:d.ripple.usd_24h_change>=0},
      ];
    }
  }catch(e){/* offline — use fallback only */}
  const items = [...fallback, ...crypto];
  const html = items.map(i => `<span>${i.sym} <strong>${i.px}</strong> <span class="${i.up?'gain':'loss'}">${i.up?'▲':'▼'} ${i.chg.replace('-','').replace('+','')}</span></span>`).join('');
  el.innerHTML = html + html; // doubled for seamless scroll
}
loadTicker();
