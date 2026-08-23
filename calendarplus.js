// EquiCare calendar + complete daily record
(function(){
  let cursor=new Date();cursor=new Date(cursor.getFullYear(),cursor.getMonth(),1);
  let dayUrls=[];
  const PHOTO_DB='equicare_media',PHOTO_STORE='photos';

  function pad(n){return String(n).padStart(2,'0')}
  function ymd(y,m,d){return `${y}-${pad(m+1)}-${pad(d)}`}
  function localYmd(v){const d=new Date(v);if(Number.isNaN(d.getTime()))return '';return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`}
  function fullDate(s){try{return new Date(s+'T12:00:00').toLocaleDateString('de-DE',{weekday:'long',day:'2-digit',month:'long',year:'numeric'})}catch(_){return s}}
  function monthTitle(d){return d.toLocaleDateString('de-DE',{month:'long',year:'numeric'})}
  function timeOf(v){try{return new Date(v).toLocaleTimeString('de-DE',{hour:'2-digit',minute:'2-digit'})}catch(_){return ''}}
  function itchClass(v){const n=Number(v)||0;return n<=0?'s0':n<=3?'s1':n<=6?'s2':'s3'}
  function sevText(v){const n=Number(v)||0;return n===0?'Kein Juckreiz':n<=3?'Leicht':n<=6?'Stark':'Sehr stark'}
  function esc2(v=''){return typeof esc==='function'?esc(v):String(v).replace(/[&<>"']/g,'')}
  function durationText(a,b){return typeof duration==='function'?duration(a,b):'—'}

  function openPhotoDB(){return new Promise((resolve,reject)=>{try{const r=indexedDB.open(PHOTO_DB,1);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);r.onupgradeneeded=()=>{const db=r.result;if(!db.objectStoreNames.contains(PHOTO_STORE))db.createObjectStore(PHOTO_STORE,{keyPath:'id'})}}catch(e){reject(e)}})}
  async function allPhotos(){try{const db=await openPhotoDB();return await new Promise((resolve,reject)=>{const tx=db.transaction(PHOTO_STORE,'readonly');const r=tx.objectStore(PHOTO_STORE).getAll();r.onsuccess=()=>resolve(r.result||[]);r.onerror=()=>reject(r.error)})}catch(_){return []}}
  function horseId(){const h=activeHorse();return h?.id||h?.name||'horse'}
  function photosForDate(all,date){return all.filter(p=>p.horseId===horseId()&&localYmd(p.createdAt)===date).sort((a,b)=>a.createdAt.localeCompare(b.createdAt))}
  function revokeDayUrls(){dayUrls.forEach(u=>URL.revokeObjectURL(u));dayUrls=[]}
  function photoUrl(blob){const u=URL.createObjectURL(blob);dayUrls.push(u);return u}

  function treatmentDate(t){
    const s=String(t?.[0]||'');
    let m=s.match(/^(\d{2})\.(\d{2})\.(\d{4})/);if(m)return `${m[3]}-${m[2]}-${m[1]}`;
    m=s.match(/^(\d{2})\.(\d{2})\./);if(m){const now=new Date();return `${now.getFullYear()}-${m[2]}-${m[1]}`}
    return '';
  }
  function treatmentsForDate(h,date){return (h.treatments||[]).filter(t=>treatmentDate(t)===date)}
  function envForDate(h,date){return (h.envHistory||[]).filter(x=>x.date===date).sort((a,b)=>(a.ts||'').localeCompare(b.ts||''))}
  function numberStats(items,key){const a=items.map(x=>Number(x[key])).filter(Number.isFinite);if(!a.length)return null;const avg=a.reduce((s,v)=>s+v,0)/a.length;return {avg,min:Math.min(...a),max:Math.max(...a),last:a[a.length-1]}}
  function fmt(v,d=1){const n=Number(v);if(!Number.isFinite(n))return '—';return n.toFixed(d).replace('.0','')}
  function statLine(label,icon,s,unit=''){if(!s)return '';return `<div class="day-stat"><span>${icon}</span><div><small>${label}</small><b>${fmt(s.avg)}${unit}</b><em>${fmt(s.min)}–${fmt(s.max)}${unit}</em></div></div>`}

  function hasAnyForDate(h,date){return !!(h.daily.find(x=>x.date===date)||envForDate(h,date).length||treatmentsForDate(h,date).length)}

  function calendarScreen(){
    const h=activeHorse();if(!h)return emptyState();
    const y=cursor.getFullYear(),m=cursor.getMonth(),first=(new Date(y,m,1).getDay()+6)%7,count=new Date(y,m+1,0).getDate(),today=localYmd(new Date());
    const cells=[];for(let i=0;i<first;i++)cells.push('<span class="cal-empty"></span>');
    for(let d=1;d<=count;d++){
      const date=ymd(y,m,d),rec=h.daily.find(x=>x.date===date),env=envForDate(h,date),tr=treatmentsForDate(h,date),has=!!(rec||env.length||tr.length),cls=rec?itchClass(rec.itch):'s0';
      cells.push(`<button type="button" class="cal-day ${cls} ${date===today?'today':''} ${has?'has-data':''}" data-cal-date="${date}" onclick="EquiCalendar.open('${date}')"><span>${d}</span><div class="cal-dots">${rec?'<i class="dot-health"></i>':''}${env.length||rec?.weatherAuto?'<i class="dot-weather"></i>':''}${tr.length?'<i class="dot-treatment"></i>':''}<i class="dot-photo" data-photo-dot="${date}" hidden></i></div></button>`)
    }
    return `<div class="top cal-top"><button class="back" onclick="back()">‹</button><div><div class="title">Kalender</div><div class="sub">${esc2(h.name)} · Tagesakten</div></div><span></span></div><div class="card cal-card"><div class="cal-month"><button type="button" onclick="EquiCalendar.move(-1)">‹</button><b>${monthTitle(cursor)}</b><button type="button" onclick="EquiCalendar.move(1)">›</button></div><div class="week"><span>Mo</span><span>Di</span><span>Mi</span><span>Do</span><span>Fr</span><span>Sa</span><span>So</span></div><div class="cal cal-plus">${cells.join('')}</div><div class="cal-legend"><span><i class="dot-health"></i>Gesundheit</span><span><i class="dot-weather"></i>Wetter</span><span><i class="dot-treatment"></i>Behandlung</span><span><i class="dot-photo"></i>Foto</span></div></div><div class="sub cal-help">Tippe auf einen Tag, um alle gespeicherten Informationen dieses Tages zu öffnen.</div>`;
  }

  async function decoratePhotos(){
    if(R!=='calendar')return;const all=await allPhotos(),h=activeHorse();if(!h)return;
    root.querySelectorAll('[data-photo-dot]').forEach(el=>{const date=el.dataset.photoDot;const n=all.filter(p=>p.horseId===horseId()&&localYmd(p.createdAt)===date).length;if(n){el.hidden=false;el.closest('.cal-day')?.classList.add('has-photo')}})
  }

  function weatherBlock(rec,env){
    const source=env.length?env:(rec&&rec.weatherAuto?[{temp:rec.temp,hum:rec.hum,uv:rec.uv,wind:rec.wind,rain:rec.precipitation,pollenMax:rec.pollenMax,insectWeatherScore:rec.insectWeatherScore,pollenMain:rec.pollenMain,pollenLevel:rec.pollenLevel,insectWeatherRisk:rec.insectWeatherRisk,weatherText:rec.weatherText}]:[]);
    if(!source.length)return '<div class="day-empty">Keine Wetter- oder Umweltwerte gespeichert.</div>';
    const last=source[source.length-1],temp=numberStats(source,'temp'),hum=numberStats(source,'hum'),uv=numberStats(source,'uv'),wind=numberStats(source,'wind'),rain=numberStats(source,'rain'),pollen=numberStats(source,'pollenMax'),insect=numberStats(source,'insectWeatherScore');
    return `<div class="row between day-card-head"><div><b>🌤️ Wetter & Umwelt</b><div class="sub">${source.length} gespeicherte Messung${source.length===1?'':'en'}</div></div><span class="badge">${esc2(last.weatherText||rec?.weatherText||'')}</span></div><div class="day-stats">${statLine('Temperatur','🌡️',temp,' °C')}${statLine('Luftfeuchte','💧',hum,' %')}${statLine('UV-Index','☀️',uv,'')}${statLine('Wind','💨',wind,' km/h')}${statLine('Regen','🌧️',rain,' mm')}${statLine('Pollen','🌾',pollen,' /m³')}${statLine('Insekten-Wetter','🪰',insect,' /4')}</div>${last.pollenLevel||last.pollenMain?`<div class="day-mini-note">Pollen: ${esc2(last.pollenLevel||'—')}${last.pollenMain?' · '+esc2(last.pollenMain):''}</div>`:''}${last.insectWeatherRisk?`<div class="day-mini-note">Insekten-Wetter: ${esc2(last.insectWeatherRisk)}</div>`:''}`;
  }

  function treatmentBlock(items){if(!items.length)return '<div class="day-empty">Keine Behandlung an diesem Tag dokumentiert.</div>';return items.map(t=>`<div class="day-treatment"><div><b>${esc2(t[2]||'Behandlung')}</b><small>${esc2(t[1]||'')}</small></div><div><span>${esc2(t[3]||'')}</span><small>${esc2(t[0]||'')}</small></div></div>`).join('')}

  function photoBlock(items){
    if(!items.length)return '<div class="day-empty">Keine Fotos an diesem Tag gespeichert.</div>';
    return `<div class="day-photo-grid">${items.map(p=>`<button type="button" onclick="openRegionPhoto('${p.id}')"><img src="${photoUrl(p.blob)}" alt="${esc2(p.region||'Pferdefoto')}"><div><b>${esc2(p.region||'Bereich')}</b><span>${timeOf(p.createdAt)} · ${['Kein','Leicht','Stark','Extrem'][Number(p.severity)||0]}</span></div></button>`).join('')}</div>`;
  }

  async function openDay(date){
    const h=activeHorse();if(!h)return;revokeDayUrls();
    const rec=h.daily.find(x=>x.date===date)||null,env=envForDate(h,date),tr=treatmentsForDate(h,date),all=await allPhotos(),photos=photosForDate(all,date);
    const has=!!(rec||env.length||tr.length||photos.length);
    const itch=rec?.itch;
    modal.innerHTML=`<div class="sheetbg" onclick="if(event.target===this)closeSheet()"><div class="sheet day-file-sheet"><div class="row between day-file-title"><div><h2>${fullDate(date)}</h2><div class="sub">${esc2(h.name)} · vollständige Tagesakte</div></div><button class="back" onclick="closeSheet()">×</button></div>${!has?'<div class="card day-empty-big">Für diesen Tag sind noch keine Einträge gespeichert.</div>':`<div class="day-summary"><div><small>Juckreiz</small><b>${itch!=null?esc2(itch)+'/10':'—'}</b><span>${itch!=null?sevText(itch):'nicht dokumentiert'}</span></div><div><small>Insekten</small><b>${esc2(rec?.insects||'—')}</b><span>manuelle Einschätzung</span></div><div><small>Weide</small><b>${rec?durationText(rec.start,rec.end):'—'}</b><span>${rec?.start||'—'} – ${rec?.end||'—'}</span></div></div><div class="card day-section">${weatherBlock(rec,env)}</div><div class="card day-section"><div class="row between day-card-head"><div><b>📷 Fotos</b><div class="sub">${photos.length} Aufnahme${photos.length===1?'':'n'}</div></div></div>${photoBlock(photos)}</div><div class="card day-section"><b>🌿 Weide & Schutz</b><div class="detail"><div class="drow"><span>Weidezeit</span><span>${rec?durationText(rec.start,rec.end):'—'}</span></div><div class="drow"><span>Zeitraum</span><span>${esc2(rec?.start||'—')} – ${esc2(rec?.end||'—')}</span></div><div class="drow"><span>Schutz</span><span>${esc2(rec?.blanket||'—')}</span></div></div>${rec?.pastureNote?`<div class="day-note">${esc2(rec.pastureNote)}</div>`:''}</div><div class="card day-section"><b>🧴 Behandlungen</b>${treatmentBlock(tr)}</div>${rec?.note?`<div class="card day-section"><b>📝 Notiz</b><div class="day-note">${esc2(rec.note)}</div></div>`:''}`}</div></div>`;
  }

  window.EquiCalendar={
    move(n){cursor=new Date(cursor.getFullYear(),cursor.getMonth()+Number(n),1);render()},
    open:openDay,
    today(){const n=new Date();cursor=new Date(n.getFullYear(),n.getMonth(),1);render()},
    decoratePhotos
  };
  screens.calendar=calendarScreen;

  const oldRender=render;
  render=function(){oldRender();if(R==='calendar')setTimeout(decoratePhotos,0)};
})();
