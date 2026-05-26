/* Epicenter Exchange - in-browser backtester v5.
   Data via our backend (api.epicenterexchange.com): Yahoo for equity, CryptoCompare for crypto (5y+ reliable).
   4 strategies (SMA, RSI, MACD, Bollinger). 20+ quant metrics. Long-only, lag-1 (no look-ahead). */
(function(){
  'use strict';
  var mount = document.getElementById('backtest-app');
  if(!mount) return;

  var API = 'https://api.epicenterexchange.com';

  var ASSETS = {
    'Crypto': {type:'crypto', items:[
      ['bitcoin','Bitcoin (BTC)'],['ethereum','Ethereum (ETH)'],['solana','Solana (SOL)'],
      ['ripple','XRP'],['binancecoin','BNB'],['cardano','Cardano (ADA)'],
      ['dogecoin','Dogecoin'],['polkadot','Polkadot'],['avalanche-2','Avalanche'],
      ['chainlink','Chainlink'],['matic-network','Polygon'],['litecoin','Litecoin'],
      ['tron','TRON'],['stellar','Stellar'],['monero','Monero']
    ]},
    'US indices': {type:'equity', items:[
      ['^GSPC','S&P 500'],['^NDX','NASDAQ 100'],['^DJI','Dow Jones'],['^RUT','Russell 2000']
    ]},
    'US stocks': {type:'equity', items:[
      ['AAPL','Apple'],['MSFT','Microsoft'],['NVDA','NVIDIA'],['GOOGL','Alphabet'],
      ['AMZN','Amazon'],['META','Meta'],['TSLA','Tesla'],['JPM','JPMorgan'],
      ['V','Visa'],['JNJ','Johnson & Johnson'],['WMT','Walmart'],['BRK-B','Berkshire B'],
      ['KO','Coca-Cola'],['DIS','Disney