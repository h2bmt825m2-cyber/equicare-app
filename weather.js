// EquiCare automatic location + weather module
(function(){
  const PREF='equicare_weather_auto_v1';
  const CACHE='equicare_weather_cache_v1';
  let busy=false;

  function e(id){return document.getElementById(id)}
  function readCache(){try{return JSON.parse(localStorage.getItem(CACHE)||'null')}catch(_){return null}}
  function round(v,d=1){const p=10**d;return Math.round(Number(v)*p)/p}
  function weatherText(code){
    const c=Number(code);
    if(c===0)return 'Klar';
    if([1,2].includes(c))return 'Leicht bewölkt';
    if(c===3)return 'Bewölkt';
    if([45,48].includes(c))return 'Nebel';
    if([51,53,55,56,57].includes(c))return 'Nieselregen';
    if([61,63,65,66,67,80,81,82].includes(c))return 'Regen';
    if([71,73,75,77,85,86].includes(c))return 'Schnee';
    if([95,96,99].includes(c))return 'Gewitter';
    return 'Wetterdaten';
  }
  function weatherIcon(code){
    const t=weatherText(code);
    if(t==='Klar')return '☀️';
    if(t.includes('bewölkt')||t==='Bewölkt')return '⛅️';
    if(t==='Nebel')return '🌫️';
    if(t==='Regen'||t==='Nieselregen')return '🌧️';
    if(t==='Schnee')return '🌨️';
    if(t==='Gewitter')return '⛈️';
    return '🌤️';
  }

  function upsertTodayWeather(w){
    const h=activeHorse();if(!h)return;
    const date=todayISO();
    let idx=h.daily.findIndex(x=>x.date===date);
    const base=idx>=0?h.daily[idx]:{date,itch:0,insects:'Keine',start:'',end:'',blanket:'Keine Decke',note:''};
    const next={...base,
      temp:round(w.temperature_2m,1),
      hum:Math.round(Number(w.relative_humidity_2m)),
      weatherCode:Number(w.weather_code),
      weatherText:weatherText(w.weather_code),
      wind:round(w.wind_speed_10m,1),
      precipitation:round(w.precipitation,1),
      weatherAuto:true,
      weatherUpdated:new Date().toISOString(),
      location:{lat:round(w.lat,3),lon:round(w.lon,3)}
    };
    if(idx>=0)h.daily[idx]=next;else h.daily.push(next);
    h.daily.sort((a,b)=>a.date.localeCompare(b.date));
    save();
  }

  function getPosition(){
    return new Promise((resolve,reject)=>{
      if(!navigator.geolocation)return reject(new Error('Standort wird von diesem Browser nicht unterstützt.'));
      navigator.geolocation.getCurrentPosition(resolve,reject,{enableHighAccuracy:false,timeout:12000,maximumAge:300000});
    });
  }

  async function refresh(userInitiated=true){
    if(busy)return;busy=true;
    const status=e('weatherAutoStatus');if(status)status.textContent='Standort und Wetter werden geladen …';
    try{
      const pos=await getPosition();
      const lat=pos.coords.latitude,lon=pos.coords.longitude;
      const url=`https://api.open-meteo.com/v1/forecast?latitude=${encodeURIComponent(lat)}&longitude=${encodeURIComponent(lon)}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m,precipitation&temperature_unit=celsius&wind_speed_unit=kmh&precipitation_unit=mm&timezone=auto`;
      const res=await fetch(url,{cache:'no-store'});
      if(!res.ok)throw new Error('Wetterdienst nicht erreichbar.');
      const data=await res.json();
      if(!data.current)throw new Error('Keine aktuellen Wetterdaten empfangen.');
      const cache={...data.current,lat,lon,updated:new Date().toISOString()};
      localStorage.setItem(CACHE,JSON.stringify(cache));
      localStorage.setItem(PREF,'1');
      upsertTodayWeather(cache);
      if(typeof render==='function'&&(R==='today'||R==='quick'||R==='history'))render();
      if(typeof note==='function')note('Standort & Wetter aktualisiert');
    }catch(err){
      console.error(err);
      let msg='Wetter konnte nicht automatisch geladen werden.';
      if(err&&err.code===1)msg='Standortzugriff wurde nicht erlaubt.';
      else if(err&&err.code===2)msg='Standort konnte nicht ermittelt werden.';
      else if(err&&err.code===3)msg='Standortabfrage hat zu lange gedauert.';
      if(userInitiated&&typeof note==='function')note(msg);
      const s=e('weatherAutoStatus');if(s)s.textContent=msg;
    }finally{busy=false}
  }

  function card(){
    const c=readCache();
    const enabled=localStorage.getItem(PREF)==='1';
    const d=activeHorse()?activeHorse().daily.find(x=>x.date===todayISO()):null;
    const w=d&&d.weatherAuto?d:c;
    const main=w?`${weatherIcon(w.weatherCode??w.weather_code)} ${w.temp??w.temperature_2m} °C · ${w.hum??w.relative_humidity_2m}%`:'Noch nicht aktiviert';
    const extra=w?`${weatherText(w.weatherCode??w.weather_code)} · Wind ${w.wind??w.wind_speed_10m??'—'} km/h${Number(w.precipitation)>0?' · '+w.precipitation+' mm':''}`:'EquiCare kann nach deiner Freigabe den Handy-Standort verwenden.';
    return `<div class="card weather-auto-card"><div class="row between"><div><b>📍 Automatisches Wetter</b><div id="weatherAutoStatus" class="sub">${main}</div></div><button class="btn soft" type="button" onclick="EquiWeather.refresh(true)">${enabled?'Aktualisieren':'Aktivieren'}</button></div><div class="sub" style="margin-top:7px">${extra}</div>${enabled?'<div class="weather-ok">✓ Standortfreigabe aktiv · Wetter wird beim Öffnen automatisch aktualisiert</div>':''}</div>`;
  }

  const oldToday=screens.today;
  screens.today=function(){return oldToday()+card()};
  const oldQuick=screens.quick;
  screens.quick=function(){return oldQuick()+card()};

  window.EquiWeather={refresh,card};
  setTimeout(()=>{if(localStorage.getItem(PREF)==='1')refresh(false)},700);
})();
