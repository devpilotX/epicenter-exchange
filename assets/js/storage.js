/* Epicenter Exchange — lightweight IndexedDB wrapper.
   Stores user watchlist, calculator history, and reading list locally.
   No data ever leaves the browser. */
(function(){
  'use strict';
  var DB_NAME='epicenter';var DB_VERSION=1;var db=null;
  function open(){return new Promise(function(resolve,reject){
    if(db)return resolve(db);
    if(!('indexedDB' in window))return reject(new Error('no indexeddb'));
    var req=indexedDB.open(DB_NAME,DB_VERSION);
    req.onupgradeneeded=function(){
      var d=req.result;
      if(!d.objectStoreNames.contains('watchlist'))d.createObjectStore('watchlist',{keyPath:'symbol'});
      if(!d.objectStoreNames.contains('history'))d.createObjectStore('history',{keyPath:'id',autoIncrement:true});
      if(!d.objectStoreNames.contains('reading'))d.createObjectStore('reading',{keyPath:'url'});
      if(!d.objectStoreNames.contains('prefs'))d.createObjectStore('prefs',{keyPath:'key'});
    };
    req.onsuccess=function(){db=req.result;resolve(db);};
    req.onerror=function(){reject(req.error);};
  });}
  function tx(store,mode){return open().then(function(d){return d.transaction(store,mode).objectStore(store);});}
  function put(store,val){return tx(store,'readwrite').then(function(s){return new Promise(function(res,rej){var r=s.put(val);r.onsuccess=function(){res(r.result);};r.onerror=function(){rej(r.error);};});});}
  function del(store,key){return tx(store,'readwrite').then(function(s){return new Promise(function(res,rej){var r=s.delete(key);r.onsuccess=function(){res();};r.onerror=function(){rej(r.error);};});});}
  function all(store){return tx(store,'readonly').then(function(s){return new Promise(function(res,rej){var r=s.getAll();r.onsuccess=function(){res(r.result);};r.onerror=function(){rej(r.error);};});});}
  function get(store,key){return tx(store,'readonly').then(function(s){return new Promise(function(res,rej){var r=s.get(key);r.onsuccess=function(){res(r.result);};r.onerror=function(){rej(r.error);};});});}
  window.EpicenterDB={open:open,put:put,del:del,all:all,get:get};

  /* Theme toggle (persists in localStorage, instant, no flash) */
  try{
    var saved=localStorage.getItem('ee-theme');
    if(saved==='dark')document.documentElement.setAttribute('data-theme','dark');
  }catch(e){}
  window.EpicenterTheme={
    toggle:function(){
      var cur=document.documentElement.getAttribute('data-theme');
      var next=cur==='dark'?'light':'dark';
      document.documentElement.setAttribute('data-theme',next);
      try{localStorage.setItem('ee-theme',next);}catch(e){}
      return next;
    },
    current:function(){return document.documentElement.getAttribute('data-theme')||'light';}
  };
})();
