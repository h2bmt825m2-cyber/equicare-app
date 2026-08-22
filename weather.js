// EquiCare automatic location + persistent weather/environment history
(function(){
  const PREF='equicare_weather_auto_v1';
  const CACHE='equicare_weather_cache_v3';
  let busy=false;

  function e(id){return document.getElementById(id)}
  function readCache(){try{return JSON.parse(localStorage.getItem(CACHE)||'null')}catch(_){return null}}
  function round(v,d=1){const n=Number(v);if(!Number.isFinite(n))return null;const p=10**d;return Math.round(n*p)/p}
  function weatherText(code){const c=Number(code);if(c===0)return 'Klar';if([1,2].includes(c))return 'Leicht bewölkt';if(c===3)return 'Bewölkt';if([45,48].includes(c))return 'Nebel';if([51,53,55,56,57].includes(c))return 'Nieselregen';if([61,63,65,66,67,80,81,82].includes(c))return 'Regen';if([71,73,75,77,85,86].includes(c))return 'Schnee';if([95,96,99].includes(c))return 'Gewitter';return 'Wetterdaten'}
  function weatherIcon(code){const t=weatherText(code);if(t==='Klar')return '☀️';if(t.includes('bewölkt')||t==='Bewölkt')return '⛅️';if(t==='Nebel')return '🌫️';if(t==='Regen'||t==='Nieselregen')return '🌧️';if(t==='Schnee')return '🌨️';if(t==='Gewitter')return '⛈️';return '🌤️'}
  function nearestHourly(hourly,key){if(!hourly||!Array.isArray(hourly.time)||!Array.isArray(hourly[key]))return null;const now=Date.now();let best=0,bestDiff=Infinity;hourly.time.forEach((t,i)=>{const ms=new Date(t).getTime(),diff=Math.abs(ms-now);if(Number.isFinite(ms)&&diff<bestDiff){best=i;bestDiff=diff}});return hourly[key][best]??null}
  function pollenSummary(hourly){const species=[['Gräser','grass_pollen'],['Birke','birch_pollen'],['Erle','alder_pollen'],['Beifuß','mugwort_pollen'],['Ambrosia','ragweed_pollen']];const values=species.map(([name,key])=>({name,value:round(nearestHourly(hourly,key),1)||0}));const main=[...values].sort((a,b)=>b.value-a.value)[0]||{name:'—',value:0};let level='Sehr gering';if(main.value>=50)level='Hoch';else if(main.value>=10)level='Mittel';else if(main.value>=1)level='Gering';return {values,main:main.name,max:main.value,level}}
  function insectWeather(temp,hum,wind,rain){const t=Number(temp),h=Number(hum),w=Number(wind),r=Number(rain);let score=0;if(t>=12&&t<=32)score++;if(t>=18&&t<=28)score++;if(h>=55)score++;if(w<=15)score++;if(r>1)score-=2;else if(r>.2)score--;score=Math.max(0,Math.min(4,score));return {score,label:['Sehr gering','Gering','Mittel','Hoch','Sehr hoch'][score]}}
  function numStats(items,key){const a=items.map(x=>Number(x[key])).filter(Number.isFinite);if(!a.length)return null;const sum=a.reduce((s,v)=>s+v,0);return {avg:round(sum/a.length,1),min:round(Math.min(...a),1),max:round(Math.max(...a),1),last:round(a[a.length-1],1)}}

  function snapshotFrom(w){
    return {
      ts:new Date().toISOString(),date:todayISO(),
      temp:round(w.temperature_2m,1),hum:round(w.relative_humidity_2m,0),
      weatherCode:Number(w.weather_code),weatherText:weatherText(w.weather_code),
      wind:round(w.wind_speed_10m,1),rain:round(w.precipitation,1),uv:round(w.uv_index,1),
      pollenMax:round(w.pollen?.max,1),pollenMain:w.pollen?.main||'',pollenLevel:w.pollen?.level||'',pollenValues:w.pollen?.values||[],
      insectWeatherScore:Number(w.insectWeather?.score??0),insectWeatherRisk:w.insectWeather?.label||'',
      lat:round(w.lat,3),lon:round(w.lon,3)
    };
  }

  function persistSnapshot(w){
    const h=activeHorse();if(!h)return;
    if(!Array.isArray(h.envHistory))h.envHistory=[];
    const snap=snapshotFrom(w);
    h.envHistory.push(snap);
    const daySnaps=h.envHistory.filter(x=>x.date===snap.date);
    let idx=h.daily.findIndex(x=>x.date===snap.date);
    const base=idx>=0?h.daily[idx]:{date:snap.date,itch:0,insects:'Keine',start:'',end:'',blanket:'Keine Decke',note:''};
    const envStats={
      temp:numStats(daySnaps,'temp'),hum:numStats(daySnaps,'hum'),uv:numStats(daySnaps,'uv'),wind:numStats(daySnaps,'wind'),
      rain:numStats(daySnaps,'rain'),pollen:numStats(daySnaps,'pollenMax'),insectWeather:numStats(daySnaps,'insectWeatherScore')
    };
    const next={...base,
      temp:snap.temp,hum:snap.hum,weatherCode:snap.weatherCode,weatherText:snap.weatherText,wind:snap.wind,precipitation:snap.rain,uv:snap.uv,
      pollenMax:snap.pollenMax,pollenMain:snap.pollenMain,pollenLevel:snap.pollenLevel,pollenValues:snap.pollenValues,
      insectWeatherScore:snap.insectWeatherScore,insectWeatherRisk:snap.insectWeatherRisk,
      envStats,envSamples:daySnaps.length,weatherAuto:true,weatherUpdated:snap.ts,location:{lat:snap.lat,lon:snap.lon}
    };
    if(idx>=0)h.daily[idx]=next;else h.daily.push(next);
    h.daily.sort((a,b)=>a.date.localeCompare(b.date));
    save();
  }

  function getPosition(){return new Promise((resolve,reject)=>{if(!navigator.geolocation)return reject(new Error('Standort wird von diesem Browser nicht unterstützt.'));navigator.geolocation.getCurrentPosition(resolve,reject,{enableHighAccuracy:false,timeout:12000,maximumAge:300000})})}

  async function refresh(userInitiated=true){
    if(busy)return;busy=true;
    const status=e('weatherAutoStatus');if(status)status.textContent='Standort und Umweltwerte werden geladen …';
    try{
      const pos=await getPosition(),lat=pos.coords.latitude,lon=pos.coords.longitude;
      const weatherUrl=`https://api.open-meteo.com/v1/forecast?latitude=${encodeURIComponent(lat)}&longitude=${encodeURIComponent(lon)}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m,precipitation&hourly=uv_index&forecast_days=1&temperature_unit=celsius&wind_speed_unit=kmh&precipitation_unit=mm&timezone=auto`;
      const pollenUrl=`https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${encodeURIComponent(lat)}&longitude=${encodeURIComponent(lon)}&hourly=alder_pollen,birch_pollen,grass_pollen,mugwort_pollen,ragweed_pollen&forecast_days=1&timezone=auto`;
      const [weatherRes,pollenRes]=await Promise.all([fetch(weatherUrl,{cache:'no-store'}),fetch(pollenUrl,{cache:'no-store'}).catch(()=>null)]);
      if(!weatherRes.ok)throw new Error('Wetterdienst nicht erreichbar.');
      const data=await weatherRes.json();if(!data.current)throw new Error('Keine aktuellen Wetterdaten empfangen.');
      let pollen={values:[],main:'—',max:0,level:'Nicht verfügbar'};if(pollenRes&&pollenRes.ok){try{const pd=await pollenRes.json();pollen=pollenSummary(pd.hourly)}catch(_){}}
      const uv=round(nearestHourly(data.hourly,'uv_index'),1);
      const insectWx=insectWeather(data.current.temperature_2m,data.current.relative_humidity_2m,data.current.wind_speed_10m,data.current.precipitation);
      const cache={...data.current,uv_index:uv,pollen,insectWeather:insectWx,lat,lon,updated:new Date().toISOString()};
      localStorage.setItem(CACHE,JSON.stringify(cache));localStorage.setItem(PREF,'1');persistSnapshot(cache);
      if(typeof render==='function'&&(R==='today'||R==='quick'||R==='history'))render();
      if(typeof note==='function')note('Umweltwerte gespeichert');
    }catch(err){
      console.error(err);let msg='Wetter konnte nicht automatisch geladen werden.';if(err&&err.code===1)msg='Standortzugriff wurde nicht erlaubt.';else if(err&&err.code===2)msg='Standort konnte nicht ermittelt werden.';else if(err&&err.code===3)msg='Standortabfrage hat zu lange gedauert.';if(userInitiated&&typeof note==='function')note(msg);const s=e('weatherAutoStatus');if(s)s.textContent=msg;
    }finally{busy=false}
  }

  function card(){
    const c=readCache(),enabled=localStorage.getItem(PREF)==='1',h=activeHorse(),d=h?h.daily.find(x=>x.date===todayISO()):null,w=d&&d.weatherAuto?d:c;
    if(!w)return `<div class="card env-card"><div class="row between"><div><b>🌤️ Wetter & Umwelt</b><div id="weatherAutoStatus" class="sub">Standort noch nicht aktiviert</div></div><button class="btn soft" type="button" onclick="EquiWeather.refresh(true)">Aktivieren</button></div><div class="sub env-hint">Einmal Standort freigeben, danach speichert EquiCare jeden erfolgreichen Abruf automatisch.</div></div>`;
    const temp=w.temp??w.temperature_2m,hum=w.hum??w.relative_humidity_2m,wind=w.wind??w.wind_speed_10m,rain=w.precipitation??0,uv=w.uv??w.uv_index,pollenMax=w.pollenMax??w.pollen?.max??0,pollenMain=w.pollenMain??w.pollen?.main??'—',pollenLevel=w.pollenLevel??w.pollen?.level??'—',insect=w.insectWeatherRisk??w.insectWeather?.label??'—',code=w.weatherCode??w.weather_code,samples=d?.envSamples||0;
    return `<div class="card env-card"><div class="row between env-head"><div><b>${weatherIcon(code)} Wetter & Umwelt</b><div id="weatherAutoStatus" class="sub">${weatherText(code)} · automatisch gespeichert${samples?` · ${samples} Messung${samples===1?'':'en'} heute`:''}</div></div><button class="env-refresh" type="button" onclick="EquiWeather.refresh(true)" aria-label="Wetter aktualisieren">↻</button></div><div class="env-grid"><div><small>Temperatur</small><b>${temp??'—'} °C</b></div><div><small>Luftfeuchte</small><b>${hum??'—'} %</b></div><div><small>UV-Index</small><b>${uv??'—'}</b></div><div><small>Wind</small><b>${wind??'—'} km/h</b></div></div><details class="env-details"><summary>Weitere Umweltwerte <span>anzeigen</span></summary><div class="env-detail-grid"><div><span>🌧️ Regen</span><b>${rain??0} mm</b></div><div><span>🌾 Pollen</span><b>${pollenLevel}</b><small>${pollenMain}${Number(pollenMax)>0?' · '+pollenMax+' /m³':''}</small></div><div><span>🪰 Insekten-Wetter</span><b>${insect}</b><small>aus Wetterwerten geschätzt</small></div><div><span>💾 Verlauf</span><b>${samples||'—'}</b><small>gespeicherte Messungen heute</small></div></div><div class="env-disclaimer">Jeder erfolgreiche Abruf wird mit Datum und Uhrzeit gespeichert. Pollen- und Insekten-Wetterwerte sind modellierte bzw. geschätzte Umweltwerte und keine medizinische Bewertung.</div></details></div>`;
  }

  const oldToday=screens.today;screens.today=function(){return oldToday()+card()};
  const oldQuick=screens.quick;screens.quick=function(){return oldQuick()+card()};
  window.EquiWeather={refresh,card};
  setTimeout(()=>{if(localStorage.getItem(PREF)==='1')refresh(false)},700);
})();