/* Cortes Airbnb — aplicación independiente, sin servicios externos. */
(() => {
  'use strict';
  const STORE_KEY = 'cortes_airbnb_mensuales_v1';
  const MONTHS = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
  const SEED = JSON.parse(document.getElementById('seed-data').textContent);
  const clone = x => JSON.parse(JSON.stringify(x));
  const esc = value => String(value ?? '').replace(/[&<>"']/g, x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]));
  const num = x => { const n=typeof x==='string'? Number(x.replace(/,/g,'')):Number(x); return Number.isFinite(n)? n:0; };
  const validAmount = x => x!==null && x!==undefined && x!=='' && Number.isFinite(Number(x)) && Number(x)>=0;
  const amountEntry = x => x==='' ? null : (validAmount(x)?Number(x):null);
  const round2 = v => Math.round((num(v)+Number.EPSILON)*100)/100;
  const money = (v, digits=2) => num(v).toLocaleString('es-MX',{style:'currency',currency:'MXN',minimumFractionDigits:digits,maximumFractionDigits:digits});
  const signMoney = v => `${v>0?'+':v<0?'−':''}${money(Math.abs(v),0)}`;
  const monthName = key => `${MONTHS[Number(key.slice(5,7))-1]||''} ${key.slice(0,4)}`;
  const upperMonth = key => monthName(key).replace(/^./, ch=>ch.toUpperCase());
  const offsetMonth=(key,n)=>{let [y,m]=key.split('-').map(Number);let d=new Date(y,m-1+n,1);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`};
  const nowMonth=()=>{let d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`};
  const loadDB=()=>{try{const value=JSON.parse(localStorage.getItem(STORE_KEY));if(value&&value.version===1&&Array.isArray(value.settings?.accounts)&&value.months&&typeof value.months==='object')return value;}catch(e){}return clone(SEED);};
  let db=loadDB(); db.drafts ||= {};
  const profilePresets = {
    a_mp:[12,0,12,15,25000,12],c_mp:[12,0,12,15,25000,12],
    a_revolut:[7,0,7,15,25000,7],
    a_open:[7,0,7,13,30000,7],c_open:[7,0,7,13,30000,7],f_open:[7,0,7,13,30000,7],
    c_turbo:[6.5,0,6.5,13,25000,0],f_turbo:[6.5,0,6.5,13,25000,0],
    f_uala:[6.75,30000,0,15,30000,0],
    f_klarmax:[15,25000,0,15,25000,0],
    f_klarinv:[6,0,6,8,0,8],
    f_plata:[7,20000,0,15,25000,9]
  };
  function initializeAccount(a){
    if(a.baseRate!==undefined && a.preferredRate!==undefined)return;
    let spec=profilePresets[a.id] || [num(a.normalRate),0,num(a.normalRate),num(a.maxRate),Math.max(0,num(a.cap)),num(a.normalRate)];
    const keys=['baseRate','baseCap','baseExcessRate','preferredRate','preferredCap','preferredExcessRate'];
    keys.forEach((k,i)=>{if(a[k]===undefined)a[k]=spec[i]});
    // Recover simple-rate edits made with earlier versions where possible.
    if(a.interestType==='simple' || (!profilePresets[a.id])){
      if(a.normalRate!==undefined)a.baseRate=num(a.normalRate);
      if(a.maxRate!==undefined)a.preferredRate=num(a.maxRate);
      if(a.cap!==undefined)a.preferredCap=num(a.cap);
    }
    if(a.interestOverrides){
      const ov=a.interestOverrides;
      if(ov.normal!==undefined)a.baseRate=num(ov.normal);
      if(ov.promo!==undefined)a.preferredRate=num(ov.promo);
      if(ov.max!==undefined)a.preferredRate=num(ov.max);
      if(ov.ultra!==undefined)a.preferredRate=num(ov.ultra);
    }
  }
  db.settings.accounts.forEach(initializeAccount);

  const saveDB = () => { try{localStorage.setItem(STORE_KEY, JSON.stringify(db));return true;}catch(e){showFlash('No se pudo guardar en este navegador. Descarga un respaldo o libera espacio.','error');return false;} };
  const closedKeys = () => Object.keys(db.months).filter(k=>db.months[k].closed).sort();
  const latestClosed = () => closedKeys().at(-1) || '2026-01';
  const firstClosed = () => closedKeys()[0] || '2026-01';
  const previousClosed = key => closedKeys().filter(k=>k<key).at(-1) || null;
  const accountById = id => db.settings.accounts.find(a=>a.id===id);
  const balancesTotal = d => d?.startBalance!==undefined ? num(d.startBalance) : round2(Object.values(d?.balances||{}).reduce((s,x)=>s+num(x),0));
  const owners = () => db.settings.owners;
  const ownerTotal = (d,owner)=>round2(db.settings.accounts.filter(a=>ownerOf(d,a)===owner).reduce((sum,a)=>sum+num(d?.balances?.[a.id]),0));
  const incomeTotal = d => round2((d?.airbnb||[]).reduce((sum,x)=>sum+num(x),0));
  const extraTotal = d => round2((d?.extras||[]).reduce((sum,x)=>sum+num(x.amount),0));
  const ownsBalance=(d,id)=>Object.prototype.hasOwnProperty.call(d?.balances||{},id);
  const activeAccounts = d => db.settings.accounts.filter(a=>ownsBalance(d,a.id));
  const ownerOf=(d,a)=>d?.ownerSnapshot?.[a.id]||a.owner;
  const safeRate=(x)=>Math.max(0,Math.min(100,num(x)));
  const selectedMode=(d,a)=>{
    const mode=d?.rateModes?.[a.id];
    if(mode==='base'||mode==='improved'||mode==='custom')return mode;
    const oldRate=d?.rates?.[a.id];
    if(oldRate!==undefined && oldRate!==null){
      if(Math.abs(num(oldRate)-num(a.baseRate))<.001)return 'base';
      if(Math.abs(num(oldRate)-num(a.preferredRate))<.001)return 'improved';
    }
    if(mode==='promo'||mode==='max'||mode==='plus'||mode==='ultra'||mode==='apartados')return 'improved';
    if(mode==='normal'||mode==='saldo'||mode==='cuenta'||mode==='sinplus'||mode==='flexible')return 'base';
    return oldRate!==undefined?'custom':'base';
  };
  const accountInterest=(d,a)=>{
    if(!d||d.startBalance!==undefined)return 0;
    const balance=Math.max(0,num(d?.balances?.[a.id]));
    const mode=selectedMode(d,a), p=d.profileSnapshots?.[a.id]||a;
    let rate,cap,excess;
    if(mode==='base'){
      rate=safeRate(p.baseRate);cap=Math.max(0,num(p.baseCap));excess=safeRate(p.baseExcessRate);
    }else if(mode==='improved'){
      rate=safeRate(p.preferredRate);cap=Math.max(0,num(p.preferredCap));excess=safeRate(p.preferredExcessRate);
    }else{
      rate=safeRate(d?.rates?.[a.id]??p.baseRate);
      cap=Math.max(0,num(d?.customCaps?.[a.id]));
      excess=safeRate(d?.customExcessRates?.[a.id]??0);
    }
    const interestPerYear=cap>0 ? Math.min(balance,cap)*rate+Math.max(0,balance-cap)*excess : balance*rate;
    return interestPerYear/1200;
  };
  const totalInterest = d => {
    if(!d)return 0;
    if(d.closed && d.interestSnapshot && Number.isFinite(d.interestSnapshot.total))return d.interestSnapshot.total;
    if(d.closed && d.source==='pdf' && !d.adjusted && typeof d.originalInterest==='number')return d.originalInterest;
    return round2(activeAccounts(d).reduce((sum,a)=>sum+accountInterest(d,a),0));
  };
  const yieldSource = d=>d?.interestSnapshot?'Calculado al guardar':d?.source==='pdf'&&!d.adjusted?'Del PDF':'Estimación actual';
  const metrics = (key,d)=>{
    if(!d) return null;
    const previous=previousClosed(key);
    const prior=previous? balancesTotal(db.months[previous]) : null;
    const balance=balancesTotal(d),airbnb=incomeTotal(d),extras=extraTotal(d);
    const change=prior===null?null:round2(balance-prior);
    const out=change===null?null:round2(airbnb+extras-change);
    return {key, balance,airbnb,extras,change,out,interest:totalInterest(d),previous};
  };
  // El ahorro neto es el cambio del saldo total, no una suma de depósitos.
  // Para 2026 la referencia es el saldo inicial de enero; en años posteriores,
  // el cierre de diciembre anterior. No se incluyen borradores.
  function annualSavings(cutoffKey){
    const year=cutoffKey.slice(0,4);
    const yearKeys=closedKeys().filter(k=>k.startsWith(year+'-') && k<=cutoffKey);
    if(!yearKeys.length)return null;
    const endingKey=yearKeys.at(-1);
    const priorDecember=`${Number(year)-1}-12`;
    let startingKey, baselineLabel;
    if(db.months[priorDecember]?.closed){startingKey=priorDecember;baselineLabel='diciembre anterior';}
    else if(db.months[year+'-01']?.closed){startingKey=year+'-01';baselineLabel='saldo inicial de enero';}
    else{startingKey=yearKeys[0];baselineLabel='primer corte disponible ('+monthName(startingKey)+')';}
    const [sy,sm]=startingKey.split('-').map(Number), [ey,em]=endingKey.split('-').map(Number);
    const monthsElapsed=(ey-sy)*12+em-sm;
    const saved=round2(balancesTotal(db.months[endingKey])-balancesTotal(db.months[startingKey]));
    return {year,endingKey,startingKey,baselineLabel,monthsElapsed,saved,average:monthsElapsed>0?round2(saved/monthsElapsed):null};
  }
  const currentMonth=nowMonth();
  const nextEditable = () => {const last=latestClosed();return last>=currentMonth?offsetMonth(last,1):currentMonth;};
  const state = {tab:'resumen',dashboardMonth:latestClosed(),editorMonth:nextEditable(),draft:null,year:latestClosed().slice(0,4),chart:'flows',showRates:true,adminOpen:false,openConfigAccount:null};
  const root=document.getElementById('content');
  function emptyMonth(key){
    const prev=previousClosed(key), previous=prev?db.months[prev]:null;
    const balances={},rates={},rateModes={},ownerSnapshot={};
    db.settings.accounts.filter(a=>a.active!==false).forEach(a=>{
      balances[a.id]=num(previous?.balances?.[a.id]);
      ownerSnapshot[a.id]=a.owner;
      let previousMode=previous?selectedMode(previous,a):'base';
      const previousRate=previous?.rates?.[a.id];
      const mode=previousMode==='custom'?'custom':previousMode;
      rateModes[a.id]=mode;
      rates[a.id]=mode==='improved'?num(a.preferredRate):mode==='base'?num(a.baseRate):num(previousRate??a.baseRate);
    });
    return {closed:false,source:'manual',balances,rates,rateModes,ownerSnapshot,customCaps:{},customExcessRates:{},airbnb:owners().map(()=>0),extras:[],adjusted:true,reviewed:false};
  }
  function loadDraft(){
    const k=state.editorMonth;
    state.draft=clone(db.drafts[k]||db.months[k]||emptyMonth(k));
    state.draft.balances ||= {};state.draft.rates ||= {};state.draft.extras ||= [];
    state.draft.rateModes ||= {};state.draft.customCaps ||= {};state.draft.customExcessRates ||= {};state.draft.ownerSnapshot ||= {};
    state.draft.airbnb ||= owners().map(()=>0);
    if(state.draft.reviewed===undefined)state.draft.reviewed=false;
    activeAccounts(state.draft).forEach(a=>{state.draft.ownerSnapshot[a.id]??=a.owner});
  }
  function draftPersist(){
    if(state.draft?.adjusted){
      delete state.draft.interestSnapshot;
      delete state.draft.profileSnapshots;
    }
    db.drafts[state.editorMonth]=clone(state.draft);
    saveDB();
  }
  function setTab(tab){
    state.tab=tab;
    if(tab==='resumen'&&!db.months[state.dashboardMonth]?.closed)state.dashboardMonth=latestClosed();
    if(tab==='cierre'&&!state.draft)loadDraft();
    render();window.scrollTo({top:0,behavior:'instant'});
  }
  const formatDelta = v => v===null?'Sin corte previo':`<span class="${v<0?'red':v>0?'green':'muted'}">${signMoney(v)}</span>`;
  const badge=(text,type='closed')=>`<span class="pill pill-${type}">${esc(text)}</span>`;
  function showFlash(message,type='success'){
    const el=document.getElementById('flash');el.innerHTML=`<div class="flash ${type==='error'?'error':''}">${esc(message)}</div>`;
    window.scrollTo({top:0,behavior:'smooth'});
  }
  function render(){
    document.querySelectorAll('.nav-link').forEach(b=>{let active=b.dataset.tab===state.tab;b.classList.toggle('active',active);b.setAttribute('aria-current',active?'page':'false')});
    if(!closedKeys().length && ['resumen','estadisticas'].includes(state.tab)){
      root.innerHTML=`<section class="section-head"><div><span class="eyebrow">CORTES AIRBNB</span><h1>Tu app está lista</h1><p class="subtitle">Este sitio se publica sin datos bancarios. Importa tu respaldo privado para recuperar tus cuentas, ingresos e historial.</p></div></section><section class="card panel-pad"><div class="panel-head"><h2 class="panel-title">Empezar con tus datos</h2></div><p class="panel-description">Los datos se guardarán solo en este navegador. No se sincronizan automáticamente entre teléfonos y computadoras.</p><div class="settings-actions"><button class="button button-primary" data-action="import-backup">↑ Importar respaldo JSON</button><button class="button button-ghost" data-action="open-settings">⚙ Configuración</button></div></section>`;
    }else root.innerHTML=state.tab==='resumen'?renderSummary():state.tab==='cierre'?renderEditor():state.tab==='configuracion'?renderSettings():renderStats();
    document.getElementById('settings-shortcut')?.setAttribute('aria-pressed',state.tab==='configuracion'?'true':'false');
  }
  function renderSummary(){
    const current=db.months[state.dashboardMonth]||db.months[latestClosed()];
    const value=metrics(state.dashboardMonth,current);
    const savings=annualSavings(state.dashboardMonth);
    const change=value.change, months=closedKeys();
    const last=latestClosed();
    const newCut = nextEditable();
    const rows=months.filter(k=>k!==firstClosed()).reverse().map(key=>{
      const m=metrics(key,db.months[key]);return `<tr role="button" tabindex="0" data-view-month="${key}" title="Ver ${monthName(key)}"><td><strong>${upperMonth(key)}</strong></td><td>${money(m.airbnb,0)}</td><td class="${m.out<0?'green':''}">${money(m.out,0)}</td><td>${money(m.balance,0)}</td></tr>`;
    }).join('');
    const ownerRows=current.startBalance!==undefined ? '<p class="subtitle">Enero solo registra un saldo inicial; no contiene reparto por titular.</p>' : owners().map(owner=>`<div class="owner card"><div class="owner-label">${esc(owner)}</div><div class="owner-value">${money(ownerTotal(current,owner),0)}</div><div class="owner-count">${db.settings.accounts.filter(a=>ownsBalance(current,a.id)&&ownerOf(current,a)===owner).length} cuentas</div></div>`).join('');
    const compactRows=months.slice().reverse().map(key=>{const m=metrics(key,db.months[key]);return `<button class="month-list-item" type="button" data-view-month="${key}"><span class="month-list-top"><strong>${upperMonth(key)}</strong><b>${money(m.balance,0)}</b></span><span class="month-list-bottom"><span>${m.change===null?'Saldo inicial':`Cambio ${signMoney(m.change)}`}</span><span>${m.out===null?'Punto de partida':`Airbnb ${money(m.airbnb,0)} · Salidas ${money(m.out,0)}`}</span></span></button>`}).join('');
    return `
      <section class="section-head"><div><span class="eyebrow">TU DINERO, DE UN VISTAZO</span><h1>Resumen mensual</h1><p class="subtitle">Cortes guardados y evolución del saldo total.</p></div>
      <div class="toolbar"><button class="icon-button" data-action="summary-prev" aria-label="Mes anterior">‹</button><span class="month-label">${upperMonth(state.dashboardMonth)}</span><button class="icon-button" data-action="summary-next" aria-label="Mes siguiente">›</button></div></section>
      <section class="hero"><span class="eyebrow">SALDO TOTAL AL CORTE</span><div class="hero-value">${money(value.balance)}</div><small>Todas tus cuentas, sumadas en un solo lugar.</small>
      <div class="hero-bot"><div class="hero-change ${change===null?'neutral':change<0?'negative':'positive'}">${change===null?'Saldo inicial':`<span>${change<0?'↘':'↗'}</span> ${signMoney(change)}`}</div><small>${change===null?'Inicio del historial':`respecto a ${monthName(value.previous)}`}</small></div></section>
      ${savings?`<section class="annual-band" aria-label="Ahorro del año">
        <div class="annual-cell"><span class="annual-label">AHORRO NETO DESDE EL INICIO DEL AÑO</span><strong class="annual-number ${savings.saved<0?'red':savings.saved>0?'green':''}">${signMoney(savings.saved)}</strong><span class="annual-desc">Respecto al ${esc(savings.baselineLabel)}</span></div>
        <div class="annual-cell"><span class="annual-label">PROMEDIO MENSUAL DE AHORRO</span><strong class="annual-number ${savings.average===null?'':savings.average<0?'red':savings.average>0?'green':''}">${savings.average===null?'—':signMoney(savings.average)}</strong><span class="annual-desc">${savings.monthsElapsed?`En ${savings.monthsElapsed} ${savings.monthsElapsed===1?'mes':'meses'} de evolución`:'Aún no hay meses transcurridos'}</span></div>
      </section><p class="annual-explainer">Es la variación del saldo acumulado, no un registro de gastos: incluye los intereses que ya hayan entrado a las cuentas.</p>`:''}
      <div class="dashboard-grid">
        ${metricCard('↗','Ingresos Airbnb',money(value.airbnb,0),'Total de los tres titulares')}
        ${metricCard('+','Otros ingresos',money(value.extras,0),'Ajenos a Airbnb')}
        ${metricCard('↙','Salidas calculadas',value.out===null?'—':money(value.out,0),'Estimación por diferencia')}
        ${metricCard('◎','Intereses estimados',value.interest?money(value.interest,0):'—',yieldSource(current)+' · no se suman')}
      </div>
      ${last<newCut?`<section class="section" style="margin-top:20px"><div class="hint"><span>✦</span><div><strong>Tu próximo corte: ${upperMonth(newCut)}.</strong> Las cuentas ya aparecerán con los saldos del último mes. Solo tendrás que actualizar los importes y guardar.</div><button class="button button-primary button-small" data-action="go-next-cut">Abrir</button></div></section>`:''}
      <section class="section"><details class="owner-details card"><summary>Ver saldo por titular <span class="tiny">${upperMonth(state.dashboardMonth)}</span></summary><div class="owner-grid">${ownerRows}</div></details></section>
      <section class="section"><div class="section-header"><h2 class="section-title">Historial mensual</h2><button class="section-action" data-tab="estadisticas">Ver gráficas →</button></div>
      <div class="mobile-month-list card">${compactRows}</div>
      <div class="desktop-history card table-scroll"><table class="history-table"><thead><tr><th>Mes</th><th>Airbnb</th><th>Salidas calculadas</th><th>Saldo total</th></tr></thead><tbody>${rows}</tbody></table></div>
      <p class="tiny">Salidas calculadas = ingresos registrados − variación del saldo. Pueden incluir ajustes e intereses ya abonados.</p>${current.source==='pdf'&&current.adjusted&&current.originalInterest!==undefined?`<p class="tiny">Intereses originales del PDF para este mes: ${money(current.originalInterest,0)}. La cifra principal se recalculó al editar.</p>`:''}</section>
      <section class="section"><div class="hint"><span>🔒</span><div><strong>Privado y manual.</strong> Esta versión no se conecta a cuentas bancarias. Los datos permanecen en este navegador; exporta un respaldo periódicamente.</div></div></section>
    `;
  }
  function metricCard(ico,title,value,desc){return `<div class="metric card"><span class="metric-icon">${ico}</span><div class="metric-label">${esc(title)}</div><div class="metric-value">${value}</div><div class="metric-detail">${esc(desc)}</div></div>`}
  function editorMetrics(){return metrics(state.editorMonth,state.draft)}
  function moneyField(value,attr,placeholder='0.00'){return `<input class="field field-money" inputmode="decimal" type="number" step="0.01" min="0" ${attr} value="${value===null||value===undefined?'':num(value)}" placeholder="${placeholder}">`}
  function otherIncomeRow(item,i){
    const opts=['<option value="">Sin cuenta específica</option>',...db.settings.accounts.map(a=>`<option value="${esc(a.id)}" ${item.accountId===a.id?'selected':''}>${esc(a.owner)} · ${esc(a.name)}</option>`)].join('');
    return `<div class="extra-item"><label><span class="field-label">Cantidad</span>${moneyField(item.amount,`data-extra-value="${i}"`)}</label><button class="button button-danger button-small" data-action="delete-extra" data-idx="${i}" aria-label="Eliminar ingreso">×</button></div><details class="extra-details"><summary>Detalle opcional</summary><div class="extra-details-fields"><label><span class="field-label">Cuenta</span><select class="field" data-extra-account="${i}">${opts}</select></label><label><span class="field-label">Concepto</span><input class="field" data-extra-note="${i}" placeholder="Ej. reembolso" value="${esc(item.note||'')}"></label></div></details>`;
  }
  function accountRow(a){
    const rawBalance=state.draft.balances?.[a.id];
    const bal=num(rawBalance), rate=num(state.draft.rates?.[a.id]??a.baseRate);
    const previous=previousClosed(state.editorMonth);
    const diff=previous===null?null:round2(bal-num(db.months[previous]?.balances?.[a.id]));
    const selected=selectedMode(state.draft,a);
    const opts=[{id:'base',label:`Base · ${num(a.baseRate)}%`},{id:'improved',label:`Mejorada · ${num(a.preferredRate)}%`},{id:'custom',label:'Otra tasa…'}];
    const options=opts.map(o=>`<option value="${o.id}" ${selected===o.id?'selected':''}>${esc(o.label)}</option>`).join('');
    return `<div class="account-row" data-acc-row="${esc(a.id)}">
      <div class="account-name-block"><div><div class="account-name">${esc(a.name)}</div><div class="account-sub" data-diff="${esc(a.id)}">${diff===null?'Sin corte anterior':`Variación: ${diff===0?'$0':signMoney(diff)}`}</div></div></div>
      <div class="account-input">${moneyField(rawBalance,`data-balance="${esc(a.id)}" aria-label="Saldo de ${esc(a.name)} de ${esc(ownerOf(state.draft,a))}"`)}</div>
      <div class="rate-cell"><div class="account-rate"><select data-rate-preset="${esc(a.id)}" aria-label="Tasa de ${esc(a.name)}">${options}</select>
      ${selected==='custom'?`<label class="eligible-label">Tasa personalizada %<input class="field custom-rate" type="number" step="0.01" min="0" max="100" data-rate-manual="${esc(a.id)}" value="${rate}"></label><label class="eligible-label">Tope $ (0 = sin tope)${moneyField(state.draft.customCaps?.[a.id]??0,`data-custom-cap="${esc(a.id)}"`)}</label><label class="eligible-label">Excedente %<input class="field" type="number" step="0.01" min="0" max="100" data-custom-excess="${esc(a.id)}" value="${num(state.draft.customExcessRates?.[a.id]??0)}"></label>`:''}
      </div><div class="account-interest" data-interest="${esc(a.id)}">≈ ${money(accountInterest(state.draft,a),0)}/mes</div>
      </div></div>`;
  }
  function group(owner){
    const acc=activeAccounts(state.draft).filter(a=>ownerOf(state.draft,a)===owner);
    return `<section class="account-group card"><div class="group-header"><div><div class="group-name">${esc(owner)}</div><div class="tiny">${acc.length} cuentas</div></div><div class="group-total" data-owner-total="${esc(owner)}">${money(ownerTotal(state.draft,owner),0)}</div></div>${acc.map(accountRow).join('')}</section>`;
  }
  function editorPreview(){
    const m=editorMetrics();
    const prior=m.previous?money(balancesTotal(db.months[m.previous]),0):'—';
    return `<div class="result-mini"><span>Saldo anterior</span><strong>${prior}</strong></div><div class="result-mini"><span>Diferencia</span><strong class="${m.change<0?'red':m.change>0?'green':''}">${m.change===null?'—':signMoney(m.change)}</strong></div><div class="result-mini"><span>Salidas netas</span><strong>${m.out===null?'—':money(m.out,0)}</strong></div>`;
  }
  function renderEditor(){
    if(!state.draft)loadDraft();
    const m=editorMetrics();
    const closed=!!db.months[state.editorMonth]?.closed;
    const ownerInputs=owners().map((owner,i)=>`<div class="field-line"><label class="field-label" for="income-${i}">${esc(owner)}</label>${moneyField(state.draft.airbnb[i],`id="income-${i}" data-owner-income="${i}"`)}</div>`).join('');
    const extraRows=state.draft.extras.map(otherIncomeRow).join('');
    const bankGroups=owners().map(group).join('');
    const jan=state.editorMonth==='2026-01';
    return `<div class="editor-top section-head"><div><span class="eyebrow">ACTUALIZA, CALCULA, GUARDA</span><h1>Cierre mensual</h1><p class="subtitle">Se suman todas las cuentas; no hace falta clasificar transferencias.</p></div><div><label class="field-label" for="editor-month">Mes del corte</label><input class="date-input" type="month" id="editor-month" min="2026-01" value="${state.editorMonth}"></div></div>
      <div class="hint ${closed?'':'warning'}"><span>${closed?'✓':'✦'}</span><div><strong>${closed?'Corte guardado · '+upperMonth(state.editorMonth):'Corte pendiente · '+upperMonth(state.editorMonth)}</strong><div>${closed?'Puedes editarlo; los cambios solo se aplican al pulsar «Guardar corte».':'Hemos copiado el último saldo guardado como punto de partida. No es el saldo real del nuevo mes hasta que lo actualices.'}</div></div></div>
      <div class="editor-row section" style="margin-top:17px"><section class="card panel-pad"><div class="panel-head"><h2 class="panel-title">Ingresos de Airbnb</h2><span class="pill pill-closed">Manual</span></div>${ownerInputs}<div class="tiny">Total Airbnb: <strong id="airbnb-total">${money(m.airbnb)}</strong></div></section>
      <section class="card panel-pad"><div class="panel-head"><h2 class="panel-title">Otros ingresos</h2><button class="button button-soft button-small" data-action="add-extra">+ Añadir</button></div><p class="panel-description" style="margin-top:0;margin-bottom:13px">Dinero que entró a estas cuentas por otros motivos, no por Airbnb. No incluyas transferencias entre las cuentas del listado.</p><div id="extras-list">${extraRows||'<p class="tiny">Ningún ingreso adicional registrado.</p>'}</div><div class="tiny">Total adicional: <strong id="extras-total">${money(m.extras)}</strong></div></section></div>
      ${jan?`<section class="card panel-pad section"><div class="section-header"><h2 class="panel-title">Saldo inicial de enero</h2></div><p class="panel-description">Si tienes un saldo inicial, introdúcelo aquí.</p>${moneyField(state.draft.startBalance??0,'data-start-balance="true"')}</section>`:
      `<section class="section"><div class="section-header"><div><h2 class="section-title">Saldos de todas las cuentas</h2><p class="subtitle">Actualiza los saldos. Las transferencias entre cuentas se compensan.</p></div></div><button class="button button-soft button-small config-quick" data-action="open-settings">⚙ Configurar bancos y tasas</button>${bankGroups}
      <p class="tiny" style="margin-top:11px">Elige la modalidad que corresponda en cada cuenta. Los intereses estimados equivalen aproximadamente a 1/12 del interés anual sobre el saldo indicado, con los topes correspondientes; pueden diferir de los reales.</p></section>`}
      <section class="section"><div class="section-header"><h2 class="section-title">Resultado de este mes</h2><span class="tiny">${closed?'Revisión del corte':'Vista previa · aún no guardado'}</span></div><div class="editor-result" id="editor-preview">${editorPreview()}</div><div class="hint"><span>◎</span><div>Intereses potenciales: <strong id="editor-interest">${money(m.interest)}</strong> al mes, aproximadamente. Se calculan con tasas orientativas y no se suman de nuevo al saldo.</div></div>
      ${!jan&&!closed?`<label class="review-check"><input type="checkbox" id="review-balances" ${state.draft.reviewed?'checked':''}><span>Revisé los saldos de este mes</span></label>`:''}</section>
      <div class="closing-sticky"><div><small>SALDO TOTAL ${closed?'DEL CORTE':'PREVISTO'}</small><strong id="editor-balance">${money(m.balance)}</strong><div class="sub-result" id="editor-change">Airbnb ${money(m.airbnb,0)} · Otros ${money(m.extras,0)}</div></div><button class="button button-primary" data-action="save-cut">${closed?'Guardar cambios':'Guardar corte'} ✓</button></div>
    `;
  }
  function renderSettings(){
    const total=db.settings.accounts.length;
    const active=db.settings.accounts.filter(a=>a.active!==false).length;
    return `<section class="section-head"><div><span class="eyebrow">TUS DATOS Y TUS CUENTAS</span><h1>Configuración</h1><p class="subtitle">Bancos, titulares, tasas y respaldos en un solo lugar.</p></div><button type="button" class="button button-ghost button-small back-settings" data-tab="resumen">← Resumen</button></section>
    <section class="card panel-pad"><div class="section-header"><h2 class="panel-title">Respaldo de tus datos</h2></div>
    <p class="panel-description" style="margin:0 0 16px">Descarga una copia de tus cortes y configuraciones. Puedes recuperarla si cambias de teléfono o navegador.</p>
    <div class="settings-actions"><button class="button button-primary" data-action="export-backup">↓ Descargar respaldo</button><button class="button button-ghost" data-action="import-backup">↑ Importar respaldo</button><button class="button button-ghost" data-action="export-csv">↓ CSV ${esc(state.year)}</button></div>
    <p class="tiny" style="margin-bottom:0">Tus datos se guardan en este navegador y no se sincronizan entre dispositivos. Importar un respaldo reemplaza los datos que tengas aquí, previa confirmación.</p></section>
    <section class="card panel-pad section" id="manage-accounts"><div class="section-header"><div><h2 class="panel-title">Cuentas y tasas</h2><p class="panel-description">${active} activas · ${total} registradas. Agrega, edita o quita cuentas sin perder cortes anteriores.</p></div></div>
    ${renderConfig()}</section>
    <details class="settings-advanced section"><summary>Opciones avanzadas</summary><p class="tiny">Reiniciar la aplicación borra los datos locales. Descarga primero un respaldo.</p><button class="button button-danger button-small" data-action="reset-app">Reiniciar aplicación</button></details>`;
  }
  function renderConfig(){
    const entries=db.settings.accounts.slice().sort((a,b)=>Number(a.active===false)-Number(b.active===false)).map(a=>{
      const open=state.openConfigAccount===a.id?'open':'';
      const selectOwners=owners().map(o=>`<option value="${esc(o)}" ${o===a.owner?'selected':''}>${esc(o)}</option>`).join('');
      const pct=(label,key)=>`<label>${label}<input class="field" type="number" inputmode="decimal" step="0.01" min="0" max="100" data-account-field="${key}" data-id="${esc(a.id)}" value="${num(a[key])}"></label>`;
      const cap=(label,key)=>`<label>${label}<input class="field" type="number" inputmode="decimal" step="0.01" min="0" data-account-field="${key}" data-id="${esc(a.id)}" value="${num(a[key])}"></label>`;
      return `<details class="config-account" data-config-account="${esc(a.id)}" ${open}>
        <summary><span><strong>${esc(a.name)}</strong><small>${esc(a.owner)} · ${a.active===false?'Quitada de nuevos cortes':`Base ${num(a.baseRate)}% · Mejorada ${num(a.preferredRate)}%`}</small></span><span class="config-edit-label">Editar ▾</span></summary>
        <div class="config-account-body">
          <div class="config-ident"><label>Nombre de la cuenta<input class="field" maxlength="80" data-account-name="${esc(a.id)}" value="${esc(a.name)}"></label><label>Titular<select class="field" data-account-owner="${esc(a.id)}">${selectOwners}</select></label></div>
          <div class="config-tier"><h4>Base</h4><div class="config-rates">${pct('Tasa base %','baseRate')}${cap('Hasta $ (0 = sin tope)','baseCap')}${pct('Excedente %','baseExcessRate')}</div></div>
          <div class="config-tier"><h4>Mejorada</h4><div class="config-rates">${pct('Tasa mejorada %','preferredRate')}${cap('Hasta $ (0 = sin tope)','preferredCap')}${pct('Excedente %','preferredExcessRate')}</div></div>
          <p class="tiny">El porcentaje del excedente solo se aplica cuando indicas un tope. Usa 0% cuando el excedente no genera interés.</p>
          <button class="button ${a.active===false?'button-soft':'button-danger'} button-small" data-action="toggle-account" data-id="${esc(a.id)}">${a.active===false?'↻ Volver a agregar a los nuevos cortes':'− Quitar de los próximos cortes'}</button>
        </div></details>`;
    }).join('');
    return `<p class="tiny">Configura cada cuenta cuando cambien sus condiciones. En el cierre basta elegir Base o Mejorada. Si tienes dos productos con tasas distintas dentro del mismo banco, puedes agregarlos como cuentas separadas.</p>
      <div class="account-config-list">${entries}</div>
      <div class="config-new"><h3 class="panel-title">Agregar cuenta</h3><div class="config-add"><label><span class="field-label">Banco o producto</span><input class="field" id="add-bank-name" placeholder="Nombre de la cuenta" maxlength="80"></label><label><span class="field-label">Titular</span><select class="field" id="add-bank-owner">${owners().map(o=>`<option>${esc(o)}</option>`).join('')}</select></label><button class="button button-soft" data-action="add-account">+ Agregar</button></div></div>
      <p class="tiny" style="margin-top:15px">«Quitar» solo la oculta en nuevos cortes: los saldos anteriores se mantienen. Descarga un respaldo antes de cambios importantes.</p>
      `;
  }
  function chartData(){
    const year=state.year;
    return MONTHS.map((name,i)=>{
      const key=`${year}-${String(i+1).padStart(2,'0')}`;
      const m=db.months[key]; const n=m?.closed?metrics(key,m):null;
      return {month:name.slice(0,3).replace(/^./,x=>x.toUpperCase()),key,n};
    });
  }
  function chartSVG(data,kind){
    const recorded=data.filter(d=>d.n&&(kind==='balance'||d.n.change!==null));
    if(!recorded.length)return `<div class="empty"><h3>Aún no hay cortes para ${esc(state.year)}</h3><p>Registra un corte mensual para empezar a ver las gráficas.</p></div>`;
    const mobile=window.innerWidth<560;
    const W=mobile?355:790,H=mobile?255:280,top=24,bottom=mobile?209:232,left=mobile?35:55,right=mobile?345:763;
    let series=[],vals=[];
    if(kind==='flows'){series=[{name:'Airbnb',color:'#1c7662',key:'airbnb'},{name:'Salidas calculadas',color:'#dd9c68',key:'out'}];vals=recorded.flatMap(d=>[d.n.airbnb,d.n.out??0]);}
    if(kind==='balance'){series=[{name:'Saldo total',color:'#1c7662',key:'balance'}];vals=recorded.map(d=>d.n.balance);}
    if(kind==='changes'){series=[{name:'Variación del saldo',color:'#1c7662',key:'change'}];vals=recorded.map(d=>d.n.change??0);}
    if(kind==='interest'){series=[{name:'Intereses estimados',color:'#7b8dce',key:'interest'}];vals=recorded.map(d=>d.n.interest);}
    let min=Math.min(0,...vals),max=Math.max(1,...vals);
    if(kind==='balance'){min=Math.floor(Math.min(...vals)*.9/50000)*50000;max=Math.ceil(Math.max(...vals)*1.03/50000)*50000;}
    else if(min>=0) max=max*1.15;
    else{max*=1.15;min*=1.15;}
    const y = v => top+(max-v)*(bottom-top)/(max-min||1);
    const x = i => left+(i+.5)*(right-left)/12;
    let svg=`<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Gráfica de ${kind==='flows'?'ingresos de Airbnb y salidas':kind==='balance'?'saldo total':kind==='changes'?'variación mensual':'intereses estimados'} en ${state.year}">`;
    for(let t=0;t<=4;t++){let val=min+(max-min)*t/4,yy=y(val);svg+=`<line x1="${left}" y1="${yy.toFixed(2)}" x2="${right}" y2="${yy.toFixed(2)}" stroke="#e2ebe5" stroke-width="1"/><text x="${left-8}" y="${yy+4}" fill="#83948b" text-anchor="end" font-size="10">${Math.abs(val)>=1000?`${(val/1000).toFixed(0)}k`:Math.round(val)}</text>`}
    if(kind==='balance'){
      const coords=data.map((d,i)=>d.n?{x:x(i),y:y(d.n.balance),v:d.n.balance,month:d.month}:null).filter(Boolean);
      const line=coords.map((pt,i)=>`${i?'L':'M'}${pt.x} ${pt.y}`).join(' ');
      svg+=`<path d="${line}" stroke="#19715e" fill="none" stroke-width="3.5" stroke-linejoin="round" stroke-linecap="round"/>`;
      coords.forEach(pt=>svg+=`<circle cx="${pt.x}" cy="${pt.y}" r="4.4" fill="#19715e" stroke="white" stroke-width="2"><title>${pt.month}: ${money(pt.v)}</title></circle>`);
    }else if(kind==='flows'){
      data.forEach((d,i)=>{if(!d.n||d.n.change===null)return;const xx=x(i);[{v:d.n.airbnb,color:'#1c7662',dx:mobile?-8:-15},{v:d.n.out??0,color:'#df9e67',dx:mobile?1:3}].forEach(bar=>{let yy=y(Math.max(0,bar.v)),zero=y(0),h=Math.max(2,Math.abs(y(bar.v)-zero));svg+=`<rect x="${xx+bar.dx}" y="${bar.v>=0?yy:zero}" width="${mobile?7:13}" height="${h}" rx="3" fill="${bar.color}"><title>${d.month}: ${money(bar.v)}</title></rect>`})});
    }else{
      const prop=kind==='changes'?'change':'interest';
      data.forEach((d,i)=>{if(!d.n||d.n.change===null)return;let v=num(d.n[prop]);let py=y(v),zero=y(0),xx=x(i)-(mobile?6:9);svg+=`<rect x="${xx}" y="${Math.min(py,zero)}" width="${mobile?12:18}" height="${Math.max(2,Math.abs(zero-py))}" fill="${v<0?'#d78371':kind==='interest'?'#858dcf':'#1c7662'}" rx="3"><title>${d.month}: ${money(v)}</title></rect>`})
    }
    data.forEach((d,i)=>svg+=`<text x="${x(i)}" y="${H-20}" text-anchor="middle" font-size="11" font-weight="${d.n?'650':'450'}" fill="${d.n?'#426558':'#aebcb5'}">${d.month}</text>`);
    svg+='</svg>';
    return `<div class="chart-box">${svg}</div><div class="chart-legend">${series.map(s=>`<span class="legend-item"><i class="legend-swatch" style="background:${s.color}"></i>${s.name}</span>`).join('')}<span class="tiny">Desliza la gráfica si no cabe en pantalla.</span></div>`;
  }
  function renderStats(){
    const data=chartData(),entries=data.filter(d=>d.n);
    const flowEntries=entries.filter(d=>d.n.change!==null);
    const rev=round2(flowEntries.reduce((s,d)=>s+d.n.airbnb,0));
    const extras=round2(flowEntries.reduce((s,d)=>s+d.n.extras,0));
    const outgoing=round2(flowEntries.reduce((s,d)=>s+(d.n.out??0),0));
    const yieldEst=round2(flowEntries.reduce((s,d)=>s+(d.n.interest||0),0));
    const ending=entries.at(-1)?.n?.balance ?? null;
    const savedYear=entries.length?annualSavings(entries.at(-1).key):null;
    const years=[...new Set([...Object.keys(db.months),nowMonth(),state.year].map(k=>k.slice(0,4)))].sort();
    const label=state.chart==='flows'?'Airbnb y salidas calculadas':state.chart==='balance'?'Evolución del saldo total':state.chart==='changes'?'Variación mensual del saldo':'Intereses mensuales estimados';
    const lastChart=(state.chart==='balance'?entries:flowEntries).at(-1);
    const chartRead=lastChart?state.chart==='flows'?`Último corte: ${upperMonth(lastChart.key)} · Airbnb ${money(lastChart.n.airbnb,0)} · Salidas ${money(lastChart.n.out,0)}`:
      state.chart==='balance'?`Último corte: ${upperMonth(lastChart.key)} · ${money(lastChart.n.balance,0)}`:
      state.chart==='changes'?`Última variación: ${upperMonth(lastChart.key)} · ${signMoney(lastChart.n.change)}`:
      `Último interés estimado: ${upperMonth(lastChart.key)} · ${money(lastChart.n.interest,0)}`:'Sin datos de flujos registrados';
    return `<section class="section-head"><div><span class="eyebrow">CÓMO EVOLUCIONA TU DINERO</span><h1>Estadísticas</h1><p class="subtitle">Comparaciones basadas en tus cierres guardados.</p></div><div><label class="field-label" for="stats-year">Año</label><select class="year-switch" id="stats-year">${years.map(y=>`<option ${y===state.year?'selected':''}>${y}</option>`).join('')}</select></div></section>
    ${savedYear?`<section class="annual-band stats-annual"><div class="annual-cell"><span class="annual-label">AHORRO NETO DEL AÑO</span><strong class="annual-number ${savedYear.saved<0?'red':savedYear.saved>0?'green':''}">${signMoney(savedYear.saved)}</strong><span class="annual-desc">Desde ${esc(savedYear.baselineLabel)}</span></div><div class="annual-cell"><span class="annual-label">PROMEDIO DE AHORRO POR MES</span><strong class="annual-number ${savedYear.average===null?'':savedYear.average<0?'red':savedYear.average>0?'green':''}">${savedYear.average===null?'—':signMoney(savedYear.average)}</strong><span class="annual-desc">${savedYear.monthsElapsed?`${savedYear.monthsElapsed} meses transcurridos`:'Sin meses adicionales'}</span></div></section><p class="annual-explainer">Crecimiento neto del saldo entre el comienzo del periodo y el último corte guardado del año.</p>`:''}
    <div class="stats-cards"><div class="card stat-box"><small>Ingresos Airbnb</small><strong>${money(rev,0)}</strong></div><div class="card stat-box"><small>Salidas calculadas</small><strong>${money(outgoing,0)}</strong></div><div class="card stat-box"><small>Saldo último corte</small><strong>${ending===null?'—':money(ending,0)}</strong></div></div>
    <section class="section card card-inset"><div class="section-header"><h2 class="section-title">${label}</h2></div><div class="graph-actions">${[['flows','Ingresos / salidas'],['balance','Saldo'],['changes','Variación'],['interest','Intereses']].map(([key,l])=>`<button class="chip" data-chart="${key}" aria-pressed="${state.chart===key}">${l}</button>`).join('')}</div><div id="chart-area">${chartSVG(data,state.chart)}</div><p class="chart-reading">${chartRead}</p>${flowEntries.length===0?'<p class="tiny">El saldo inicial de enero no representa ingresos ni gastos.</p>':''}</section>
    <section class="section"><div class="section-header"><h2 class="section-title">Totales del año</h2><span class="tiny">Meses con corte registrado</span></div><div class="dashboard-grid" style="margin-top:0">${metricCard('↗','Airbnb',money(rev,0),'Suma de los meses')}${metricCard('+','Otros ingresos',money(extras,0),'Registrados manualmente')}${metricCard('↙','Salidas calculadas',money(outgoing,0),'Por diferencia')}${metricCard('◎','Intereses estimados',money(yieldEst,0),'Suma orientativa')}</div></section>
    <section class="section"><div class="section-header"><h2 class="section-title">Comparativa mensual</h2><button class="section-action" data-action="export-csv">Exportar CSV ↓</button></div>
    <div class="mobile-month-list card">${entries.slice().reverse().map(d=>`<div class="month-list-item stat-history"><span class="month-list-top"><strong>${upperMonth(d.key)}</strong><b>${money(d.n.balance,0)}</b></span><span class="month-list-bottom"><span>${d.n.change===null?'Saldo inicial':`Variación ${signMoney(d.n.change)}`}</span><span>${d.n.out===null?'Punto de partida':`Airbnb ${money(d.n.airbnb,0)} · Salidas ${money(d.n.out,0)}`}</span></span></div>`).join('')}</div>
    <div class="desktop-history card table-scroll"><table class="history-table"><thead><tr><th>Mes</th><th>Airbnb</th><th>Otros</th><th>Variación</th><th>Salidas calculadas</th><th>Intereses est.</th><th>Saldo</th></tr></thead><tbody>${entries.map(d=>`<tr><td><strong>${upperMonth(d.key)}</strong></td><td>${d.n.change===null?'—':money(d.n.airbnb,0)}</td><td>${d.n.change===null?'—':money(d.n.extras,0)}</td><td class="${d.n.change<0?'red':'green'}">${d.n.change===null?'—':signMoney(d.n.change)}</td><td>${d.n.out===null?'—':money(d.n.out,0)}</td><td>${d.n.change===null?'—':money(d.n.interest,0)}</td><td>${money(d.n.balance,0)}</td></tr>`).join('')}</tbody></table></div><p class="tiny">Salidas calculadas = Airbnb + otros ingresos − variación total. Enero de 2026 es solo el saldo inicial. Intereses estimados: informativos, no se suman a los ingresos.</p></section>
    `;
  }
  function refreshLive(){
    if(state.tab!=='cierre')return;
    const m=editorMetrics();
    const get = id=>document.getElementById(id);
    if(get('editor-preview'))get('editor-preview').innerHTML=editorPreview();
    if(get('editor-balance'))get('editor-balance').textContent=money(m.balance);
    if(get('editor-change'))get('editor-change').textContent=`Airbnb ${money(m.airbnb,0)} · Otros ${money(m.extras,0)}`;
    if(get('editor-interest'))get('editor-interest').textContent=money(m.interest);
    if(get('airbnb-total'))get('airbnb-total').textContent=money(m.airbnb);
    if(get('extras-total'))get('extras-total').textContent=money(m.extras);
    owners().forEach(owner=>{const el=document.querySelector('[data-owner-total="'+CSS.escape(owner)+'"]');if(el)el.textContent=money(ownerTotal(state.draft,owner),0)});
    document.querySelectorAll('[data-interest]').forEach(el=>{let a=accountById(el.dataset.interest);if(a)el.textContent=selectedMode(state.draft,a)==='pending'?'Tasa por elegir':`≈ ${money(accountInterest(state.draft,a),0)}/mes`});
  }
  function saveCut(){
    const key=state.editorMonth;
    const existing=db.months[key];
    if(key==='2026-01'){
      if(!validAmount(state.draft.startBalance))return showFlash('Escribe un saldo inicial válido.','error');
    }else{
      const missing=activeAccounts(state.draft).filter(a=>!validAmount(state.draft.balances?.[a.id]));
      if(missing.length)return showFlash(`Hay ${missing.length} saldos sin completar. Escribe 0 si la cuenta está vacía.`, 'error');
      if(!existing?.closed && !state.draft.reviewed)return showFlash('Antes de guardar, confirma que revisaste los saldos del mes.','error');
    }
    if(!existing?.closed && incomeTotal(state.draft)===0&&extraTotal(state.draft)===0){
      if(!confirm('No has registrado ingresos este mes. ¿Quieres guardar igualmente el corte?'))return;
    }
    if(existing?.closed && key<latestClosed()){
      if(!confirm('Estás modificando un corte antiguo. Esto cambiará las variaciones y salidas calculadas de los meses posteriores. ¿Guardar?'))return;
    }
    const prepared=clone(state.draft);
    prepared.closed=true;
    prepared.source=existing?.source||'manual';
    prepared.adjusted=prepared.source==='pdf'?!!state.draft.adjusted:true;
    // Keep the PDF's original values even when a month is amended.
    if(prepared.source==='pdf'){
      prepared.originalInterest=existing?.originalInterest??prepared.originalInterest;
      prepared.originalTotal=existing?.originalTotal??prepared.originalTotal;
    }
    if(prepared.adjusted || prepared.source!=='pdf'){
      const perAccount={};
      activeAccounts(prepared).forEach(a=>{perAccount[a.id]=round2(accountInterest(prepared,a))});
      const total=round2(activeAccounts(prepared).reduce((sum,a)=>sum+accountInterest(prepared,a),0));
      prepared.interestSnapshot={total,perAccount,date:new Date().toISOString()};
      prepared.profileSnapshots=Object.fromEntries(activeAccounts(prepared).map(a=>[a.id,Object.fromEntries(['baseRate','baseCap','baseExcessRate','preferredRate','preferredCap','preferredExcessRate'].map(k=>[k,num(a[k])]))]));
    }
    // Imported values remain as reference until the user changes that month's cut.
    if(prepared.source==='pdf'&&!prepared.adjusted)delete prepared.interestSnapshot;
    const oldMonths=db.months;
    db.months={...oldMonths,[key]:prepared};delete db.drafts[key];
    if(!saveDB()){db.months=oldMonths;db.drafts[key]=clone(state.draft);return;}
    state.draft=null;state.editorMonth=nextEditable();state.dashboardMonth=key;state.year=key.slice(0,4);
    showFlash(`Corte de ${monthName(key)} guardado correctamente.`);
    state.tab='resumen';render();
  }
  function nextSummaryMonth(delta){const keys=closedKeys();const idx=keys.indexOf(state.dashboardMonth);state.dashboardMonth=keys[Math.max(0,Math.min(keys.length-1,idx+delta))];render()}
  function setEditorMonth(key){if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(key)||key<'2026-01'){showFlash('El mes no es válido.','error');return;}
    state.editorMonth=key;loadDraft();render();
  }
  function download(content,type,name){
    const blob=new Blob([content],{type}),url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=name;document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);
  }
  function exportBackup(){saveDB();download(JSON.stringify(db,null,2),'application/json;charset=utf-8',`cortes-airbnb-respaldo-${new Date().toISOString().slice(0,10)}.json`)}
  function csvMoney(x){return num(x).toFixed(2)}
  function exportCsv(){
    const head=['Mes',...owners().map(o=>'Airbnb '+o),'Airbnb total','Otros ingresos','Saldo total','Diferencia saldo','Salidas netas','Intereses estimados'];
    const rows=closedKeys().filter(k=>k.startsWith(`${state.year}-`)).map(k=>{const d=db.months[k],m=metrics(k,d),base=m.change===null;return [k,...[0,1,2].map(i=>base?'':csvMoney(d.airbnb?.[i]||0)),base?'':csvMoney(m.airbnb),base?'':csvMoney(m.extras),csvMoney(m.balance),base?'':csvMoney(m.change),base?'':csvMoney(m.out),base?'':csvMoney(m.interest)];});
    const text='\ufeff'+[head,...rows].map(row=>row.join(';')).join('\r\n');
    download(text,'text/csv;charset=utf-8',`cortes-airbnb-historial-${state.year}.csv`);
  }
  function importBackup(file){
    if(!file)return;
    if(file.size>10_000_000)return showFlash('El archivo es demasiado grande.','error');
    const reader=new FileReader();reader.onload=()=>{
      let d;try{d=JSON.parse(reader.result)}catch(e){showFlash('El JSON no se puede leer.','error');return;}
      const valid=d&&d.version===1&&d.settings&&Array.isArray(d.settings.accounts)&&Array.isArray(d.settings.owners)&&d.settings.accounts.length>0&&d.months&&typeof d.months==='object'&&Object.keys(d.months).length>0;
      if(!valid){showFlash('El archivo no contiene un respaldo válido de Cortes Airbnb.','error');return;}
      if(!confirm('Importar este respaldo reemplazará los datos actuales de este navegador. ¿Continuar?'))return;
      db=d;db.drafts||={};db.settings.accounts.forEach(initializeAccount);if(!saveDB())return;
      state.dashboardMonth=latestClosed();state.editorMonth=nextEditable();state.draft=null;state.year=latestClosed().slice(0,4);state.tab='resumen';render();showFlash('Respaldo importado. Revisa los totales de tus cortes.');
    };reader.readAsText(file);
  }
  // Inputs are updated in place so they never lose focus while amounts are typed.
  document.addEventListener('input',e=>{
    const t=e.target;
    if(state.tab!=='cierre')return;
    let changed=false;
    if(t.dataset.ownerIncome!==undefined){state.draft.airbnb[Number(t.dataset.ownerIncome)]=Math.max(0,num(t.value));changed=true;}
    if(t.dataset.balance!==undefined){let id=t.dataset.balance;state.draft.balances[id]=amountEntry(t.value);changed=true;let prev=previousClosed(state.editorMonth),diff=prev&&validAmount(t.value)?round2(num(t.value)-num(db.months[prev].balances?.[id])):null;let el=document.querySelector('[data-diff="'+CSS.escape(id)+'"]');if(el)el.textContent=diff===null?'Sin corte anterior':`Variación: ${diff===0?'$0':signMoney(diff)}`;}
    if(t.dataset.rateManual!==undefined){state.draft.rates[t.dataset.rateManual]=Math.max(0,num(t.value));changed=true;}
    if(t.dataset.customCap!==undefined){state.draft.customCaps[t.dataset.customCap]=Math.max(0,num(t.value));changed=true;}
    if(t.dataset.customExcess!==undefined){state.draft.customExcessRates[t.dataset.customExcess]=safeRate(t.value);changed=true;}
    if(t.dataset.extraValue!==undefined){state.draft.extras[Number(t.dataset.extraValue)].amount=Math.max(0,num(t.value));changed=true;}
    if(t.dataset.extraNote!==undefined){state.draft.extras[Number(t.dataset.extraNote)].note=t.value;changed=true;}
    if(t.dataset.startBalance!==undefined){state.draft.startBalance=Math.max(0,num(t.value));changed=true;}
    if(changed){state.draft.adjusted=true;draftPersist();refreshLive()}
  });
  document.addEventListener('change',e=>{
    const t=e.target;
    if(t.id==='editor-month')return setEditorMonth(t.value);
    if(t.id==='stats-year'){state.year=t.value;return render();}
    if(state.tab!=='cierre'&&state.tab!=='configuracion')return;
    if(t.dataset.accountField!==undefined){
      const a=accountById(t.dataset.id),field=t.dataset.accountField;
      if(!a||!['baseRate','baseCap','baseExcessRate','preferredRate','preferredCap','preferredExcessRate'].includes(field))return;
      if(t.value==='' || !Number.isFinite(Number(t.value)) || Number(t.value)<0 || (field.toLowerCase().includes('rate')&&Number(t.value)>100)){
        showFlash('Escribe un valor válido para esa tasa o tope.','error');return;
      }
      a[field]=num(t.value);
      if(state.draft&&ownsBalance(state.draft,a.id)){
        state.draft.adjusted=true;
        const mode=selectedMode(state.draft,a);
        if(mode==='base')state.draft.rates[a.id]=num(a.baseRate);
        if(mode==='improved')state.draft.rates[a.id]=num(a.preferredRate);
        draftPersist();
      }
      saveDB();state.openConfigAccount=a.id;state.adminOpen=true;
      // Existing monthly cuts are unchanged until explicitly edited and saved.
      render();return;
    }
    if(t.dataset.accountName!==undefined){
      const a=accountById(t.dataset.accountName),name=t.value.trim();
      if(!a||!name){showFlash('La cuenta necesita un nombre.','error');return;}
      a.name=name;saveDB();state.openConfigAccount=a.id;state.adminOpen=true;render();return;
    }
    if(t.dataset.accountOwner!==undefined){
      const a=accountById(t.dataset.accountOwner),newOwner=t.value;
      if(!a||!owners().includes(newOwner)||newOwner===a.owner)return;
      // Record the old owner for all previous saved cuts; move the account only in future cuts.
      for(const d of Object.values(db.months)){
        if(d?.closed&&ownsBalance(d,a.id)){
          d.ownerSnapshot ||= {};
          d.ownerSnapshot[a.id] ||= a.owner;
        }
      }
      a.owner=newOwner;
      if(state.draft&&!db.months[state.editorMonth]?.closed){state.draft.ownerSnapshot[a.id]=newOwner;draftPersist()}
      saveDB();state.openConfigAccount=a.id;state.adminOpen=true;render();return;
    }
    if(t.id==='review-balances'){state.draft.reviewed=t.checked;draftPersist();return;}
    if(t.dataset.extraAccount!==undefined){state.draft.extras[Number(t.dataset.extraAccount)].accountId=t.value;state.draft.adjusted=true;draftPersist();}
    if(t.dataset.ratePreset!==undefined){
      const id=t.dataset.ratePreset,a=accountById(id);if(!a)return;
      const mode=t.value;
      if(!['base','improved','custom'].includes(mode))return;
      if(mode==='custom'&&selectedMode(state.draft,a)!=='custom'){
        state.draft.rates[id]=selectedMode(state.draft,a)==='improved'?num(a.preferredRate):num(a.baseRate);
      }
      state.draft.rateModes[id]=mode;
      if(mode==='base')state.draft.rates[id]=num(a.baseRate);
      if(mode==='improved')state.draft.rates[id]=num(a.preferredRate);
      state.draft.adjusted=true;
      draftPersist();render();
      if(mode==='custom')document.querySelector('[data-rate-manual="'+CSS.escape(id)+'"]')?.focus();
    }
  });
  document.addEventListener('click',e=>{
    const tab=e.target.closest('[data-tab]');if(tab){setTab(tab.dataset.tab);return;}
    const graph=e.target.closest('[data-chart]');if(graph){state.chart=graph.dataset.chart;render();return;}
    const tr=e.target.closest('[data-view-month]');if(tr){state.dashboardMonth=tr.dataset.viewMonth;render();return;}
    const btn=e.target.closest('[data-action]');if(!btn)return;
    const act=btn.dataset.action;
    if(act==='summary-prev')return nextSummaryMonth(-1);
    if(act==='summary-next')return nextSummaryMonth(1);
    if(act==='go-next-cut'){state.editorMonth=nextEditable();loadDraft();return setTab('cierre');}
    if(act==='add-extra'){state.draft.extras.push({amount:0,accountId:'',note:''});state.draft.adjusted=true;draftPersist();return render();}
    if(act==='delete-extra'){state.draft.extras.splice(Number(btn.dataset.idx),1);state.draft.adjusted=true;draftPersist();return render();}
    if(act==='save-cut')return saveCut();
    if(act==='export-backup')return exportBackup();
    if(act==='export-csv')return exportCsv();
    if(act==='import-backup'){document.getElementById('import-file').click();return;}
    if(act==='open-settings'){
      state.tab='configuracion';render();window.scrollTo({top:0,behavior:'instant'});return;
    }
    if(act==='toggle-account'){
      const a=accountById(btn.dataset.id);if(!a)return;
      const removing=a.active!==false;
      if(removing){
        const saldo=num(state.draft?.balances?.[a.id]);
        if(!confirm(saldo>0 ?
          `¿Quitar ${a.name} de los próximos cortes? El saldo actual de ${money(saldo,0)} seguirá en cortes ya guardados. Si sigue siendo tu dinero, asegúrate de incluirlo en otra cuenta del próximo corte.` :
          `¿Quitar ${a.name} de los próximos cortes? Sus datos anteriores se conservarán.`))return;
      }
      a.active=!removing;
      if(state.draft&&!db.months[state.editorMonth]?.closed){
        if(removing){delete state.draft.balances[a.id];delete state.draft.rates[a.id];delete state.draft.rateModes[a.id];delete state.draft.ownerSnapshot[a.id];}
        else {state.draft.balances[a.id]=0;state.draft.rateModes[a.id]='base';state.draft.rates[a.id]=num(a.baseRate);state.draft.ownerSnapshot[a.id]=a.owner;}
        state.draft.adjusted=true;state.draft.reviewed=false;draftPersist();
      }
      state.openConfigAccount=a.id;state.adminOpen=true;saveDB();render();return;
    }
    if(act==='add-account'){
      const name=document.getElementById('add-bank-name')?.value?.trim(),owner=document.getElementById('add-bank-owner')?.value;
      if(!name||!owners().includes(owner)){showFlash('Indica el nombre y titular de la cuenta.','error');return;}
      const id='acct_'+Date.now()+'_'+Math.random().toString(36).slice(2,7);
      const a={id,name,owner,baseRate:0,baseCap:0,baseExcessRate:0,preferredRate:0,preferredCap:0,preferredExcessRate:0,active:true};
      db.settings.accounts.push(a);
      if(state.draft&&!db.months[state.editorMonth]?.closed){
        state.draft.balances[id]=0;state.draft.rates[id]=0;state.draft.rateModes[id]='base';state.draft.ownerSnapshot[id]=owner;
        state.draft.adjusted=true;state.draft.reviewed=false;draftPersist();
      }
      state.openConfigAccount=id;state.adminOpen=true;saveDB();render();
      document.querySelector('[data-config-account="'+CSS.escape(id)+'"]')?.scrollIntoView({behavior:'smooth',block:'center'});return;
    }
    if(act==='reset-app'){
      if(!confirm('¿Reiniciar la app y borrar tus datos de este navegador? Descarga primero un respaldo.'))return;
      if(!confirm('Confirmación final: ¿eliminar los cierres añadidos y recuperar el archivo original?'))return;
      db=clone(SEED);db.drafts={};db.settings.accounts.forEach(initializeAccount);saveDB();state.editorMonth=nextEditable();state.dashboardMonth=latestClosed();state.year='2026';loadDraft();render();showFlash('Se reinició la app. Importa tu respaldo para recuperar tus datos.');return;
    }
  });
  document.addEventListener('keydown',e=>{
    const tr=e.target.closest('[data-view-month]');if(tr&&(e.key==='Enter'||e.key===' ')){e.preventDefault();state.dashboardMonth=tr.dataset.viewMonth;render()}
  });
  document.getElementById('import-file').addEventListener('change',e=>{importBackup(e.target.files?.[0]);e.target.value=''});
  document.addEventListener('toggle',e=>{if(e.target.matches('[data-config-account]') && e.target.open){state.openConfigAccount=e.target.dataset.configAccount;}},true);
  if(location.protocol==='https:'&&'serviceWorker' in navigator)navigator.serviceWorker.register('./sw.js').catch(()=>{});
  saveDB();loadDraft();render();
})();
