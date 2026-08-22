// EquiCare interactive history metrics
(function(){
  let selected='itch';
  const insectMap={Keine:0,Gering:1,Mittel:2,Stark:3,Extrem:4};
  const insectLabel=['Keine','Gering','Mittel','Stark','Extrem'];

  function minutes(a,b){if(!a||!b)return null;const A=a.split(':').map(Number),B=b.split(':').map(Number);let m=B[0]*60+B[1]-A[0]*60-A[1];if(m<0)m+=1440;return m}
  const metrics={
    itch:{label:'Juckreiz',icon:'🟣',unit:'/10',get:d=>Number.isFinite(Number(d.itch))?Number(d.itch):null,format:v=>`${v}/10`,floor:0,ceil:10},
    temp:{label:'Temperatur',icon:'🌡️',unit:'°C',get:d=>d.temp!==''&&Number.isFinite(Number(d.temp))?Number(d.temp):null,format:v=>`${Number(v).toFixed(1).replace('.0','')} °C`},
    hum:{label:'Luftfeuchte',icon:'💧',unit:'%',get:d=>d.hum!==''&&Number.isFinite(Number(d.hum))?Number(d.hum):null,format:v=>`${Math.round(v)} %`,floor:0,ceil:100},
    pasture:{label:'Weidezeit',icon:'🌿',unit:'h',get:d=>{const m=minutes(d.start,d.end);return m==null?null:m/60},format:v=>`${Math.floor(v)} h ${Math.round((v%1)*60)} min`,floor:0},
    insects:{label:'Insekten',icon:'🪰',unit:'',get:d=>Object.prototype.hasOwnProperty.call(insectMap,d.insects)?insectMap[d.insects]:null,format:v=>insectLabel[Math.round(v)]||'—',floor:0,ceil:4}
  };

  function dateLabel(s){try{return new Date(s+'T12:00:00').toLocaleDateString('de-DE',{day:'2-digit',month:'2-digit'})}catch(_){return s}}
  function fullDate(s){try{return new Date(s+'T12:00:00').toLocaleDateString('de-DE',{weekday:'short',day:'2-digit',month:'2-digit',year:'numeric'})}catch(_){return s}}
  function values(h,m){return h.daily.map(d=>({d,v:m.get(d)})).filter(x=>x.v!=null&&Number.isFinite(x.v)).slice(-30)}
  function stats(arr,m){if(!arr.length)return {avg:'—',min:'—',max:'—'};const vs=arr.map(x=>x.v),avg=vs.reduce((a,b)=>a+b,0)/vs.length;return {avg:m.format(avg),min:m.format(Math.min(...vs)),max:m.format(Math.max(...vs))}}

  function chart(arr,m){
    if(!arr.length)return '<div class="history-empty">Für diesen Wert sind noch keine Verlaufsdaten vorhanden.</div>';
    const vals=arr.map(x=>x.v);let min=m.floor!=null?m.floor:Math.min(...vals),max=m.ceil!=null?m.ceil:Math.max(...vals);if(max===min)max=min+1;if(m.floor==null){const pad=Math.max(1,(max-min)*.18);min-=pad;max+=pad}
    return `<div class="history-chart" role="group" aria-label="${m.label} Verlauf">${arr.map(x=>{const pct=Math.max(6,Math.min(100,((x.v-min)/(max-min))*88+8));return `<button type="button" class="history-bar" onclick="EquiHistory.day('${x.d.date}')" aria-label="${fullDate(x.d.date)} ${m.format(x.v)}"><span class="history-value">${m.format(x.v)}</span><i style="height:${pct}%"></i><small>${dateLabel(x.d.date)}</small></button>`}).join('')}</div>`;
  }
  function rows(arr,m){return `<div class="history-rows">${[...arr].reverse().slice(0,10).map(x=>`<button type="button" onclick="EquiHistory.day('${x.d.date}')"><span>${fullDate(x.d.date)}</span><b>${m.format(x.v)}</b><span>›</span></button>`).join('')}</div>`}

  function screen(){
    const h=activeHorse();if(!h)return emptyState();const m=metrics[selected]||metrics.itch,arr=values(h,m),s=stats(arr,m);
    return `<div class="row between"><div><div class="title">Verlauf</div><div class="sub">${esc(h.name)} · bis zu 30 Einträge</div></div><span class="badge">${m.icon} ${m.label}</span></div><div class="history-metrics">${Object.entries(metrics).map(([k,x])=>`<button type="button" class="${selected===k?'on':''}" onclick="EquiHistory.select('${k}')"><span>${x.icon}</span><b>${x.label}</b></button>`).join('')}</div><div class="card"><div class="row between"><div><b>${m.label}</b><div class="sub">Tippe auf einen Balken für Tagesdetails</div></div></div>${chart(arr,m)}</div><div class="history-stats"><div class="metric"><small>Durchschnitt</small><b>${s.avg}</b></div><div class="metric"><small>Minimum</small><b>${s.min}</b></div><div class="metric"><small>Maximum</small><b>${s.max}</b></div></div><div class="card"><b>Einzelwerte</b>${rows(arr,m)}</div>`;
  }

  function day(date){
    const h=activeHorse(),d=h?.daily.find(x=>x.date===date);if(!d)return;const pasture=minutes(d.start,d.end);
    openSheet(fullDate(date),`<div class="detail"><div class="drow"><span>Juckreiz</span><span>${d.itch??'—'}/10</span></div><div class="drow"><span>Temperatur</span><span>${d.temp!==''&&d.temp!=null?esc(d.temp)+' °C':'—'}</span></div><div class="drow"><span>Luftfeuchte</span><span>${d.hum!==''&&d.hum!=null?esc(d.hum)+' %':'—'}</span></div><div class="drow"><span>Insekten</span><span>${esc(d.insects||'—')}</span></div><div class="drow"><span>Weidezeit</span><span>${pasture==null?'—':Math.floor(pasture/60)+' h '+pasture%60+' min'}</span></div><div class="drow"><span>Schutz</span><span>${esc(d.blanket||'—')}</span></div>${d.weatherText?`<div class="drow"><span>Wetter</span><span>${esc(d.weatherText)}</span></div>`:''}${d.wind!=null?`<div class="drow"><span>Wind</span><span>${esc(d.wind)} km/h</span></div>`:''}${d.precipitation!=null?`<div class="drow"><span>Niederschlag</span><span>${esc(d.precipitation)} mm</span></div>`:''}</div>${d.note?`<div class="field"><label>Notiz</label><div class="history-note">${esc(d.note)}</div></div>`:''}`,'Schließen','closeSheet()');
  }

  window.EquiHistory={select(k){if(metrics[k]){selected=k;render()}},day};
  screens.history=screen;
})();
