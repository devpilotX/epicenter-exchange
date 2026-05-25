// SIP calculator: FV = P * [((1+r)^n - 1) / r] * (1+r), where r = annual/12, n = months
function sip(){
  const p = +document.getElementById('sip-amount').value;
  const annual = +document.getElementById('sip-rate').value;
  const years = +document.getElementById('sip-years').value;
  const r = annual/100/12, n = years*12;
  const fv = p * ((Math.pow(1+r,n)-1)/r) * (1+r);
  const invested = p*n;
  document.getElementById('sip-fv').textContent = '₹' + Math.round(fv).toLocaleString('en-IN');
  document.getElementById('sip-inv').textContent = '₹' + invested.toLocaleString('en-IN');
  document.getElementById('sip-gain').textContent = '₹' + Math.round(fv-invested).toLocaleString('en-IN');
}

// EMI: P*r*(1+r)^n / ((1+r)^n - 1)
function emi(){
  const P = +document.getElementById('emi-principal').value;
  const annual = +document.getElementById('emi-rate').value;
  const years = +document.getElementById('emi-years').value;
  const r = annual/100/12, n = years*12;
  const e = (P*r*Math.pow(1+r,n))/(Math.pow(1+r,n)-1);
  const total = e*n, interest = total-P;
  document.getElementById('emi-monthly').textContent = '₹' + Math.round(e).toLocaleString('en-IN');
  document.getElementById('emi-total').textContent = '₹' + Math.round(total).toLocaleString('en-IN');
  document.getElementById('emi-interest').textContent = '₹' + Math.round(interest).toLocaleString('en-IN');
}

// Retirement corpus: future expenses / safe-withdrawal-rate (4% rule)
function retire(){
  const monthly = +document.getElementById('ret-expense').value;
  const yearsTo = +document.getElementById('ret-years').value;
  const infl = +document.getElementById('ret-infl').value/100;
  const futureMonthly = monthly * Math.pow(1+infl, yearsTo);
  const corpus = (futureMonthly*12) / 0.04;
  document.getElementById('ret-future').textContent = '₹' + Math.round(futureMonthly).toLocaleString('en-IN');
  document.getElementById('ret-corpus').textContent = '₹' + Math.round(corpus).toLocaleString('en-IN');
}

window.sip = sip; window.emi = emi; window.retire = retire;
