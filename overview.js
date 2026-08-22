// EquiCare cleaner Today dashboard
(function(){
  function dateLong(s){try{return new Date((s||todayISO())+'T12:00:00').toLocaleDateString('de-DE',{weekday:'long',day:'2-digit',month:'2-digit'})}catch(_){return s||todayISO()}}
  function todayScreen(){
    const h=activeHorse();if(!h)return emptyState();
    const d=h.daily.find(x=>x.date===todayISO())||lastDaily(h);
    const openMeds=h.meds.filter(m=>!(m.am&&m.pm)).length;
    return `<button class="dash-horse" type="button" onclick="go('horses')"><div class="row"><div class="avatar">🐴</div><div><b>${esc(h.name||'Pferd')}</b><div class="sub">${dateLong(d.date||todayISO())}</div></div></div><span>Wechseln ›</span></button>
      <div class="dash-section-title"><span>Heute</span><button type="button" onclick="go('quick')">＋ Eintrag</button></div>
      <div class="card dash-itch"><div class="row between"><div><b>Juckreiz</b><div class="sub">heutige Einschätzung</div></div><strong>${Number(d.itch)||0}<small>/10</small></strong></div><div class="itch">${Array.from({length:11},(_,i)=>`<button data-itch="${i}" class="${Number(d.itch)===i?'on':''}">${i}</button>`).join('')}</div></div>
      <div class="dash-glance"><button type="button" onclick="go('pasture')"><span>🌿</span><div><small>Weide</small><b>${duration(d.start,d.end)}</b></div><i>›</i></button><button type="button" onclick="go('pasture')"><span>🧥</span><div><small>Schutz</small><b>${esc(d.blanket||'—')}</b></div><i>›</i></button><button type="button" onclick="go('meds')"><span>💊</span><div><small>Medikamente</small><b>${openMeds} offen</b></div><i>›</i></button><button type="button" onclick="go('feed')"><span>🥕</span><div><small>Fütterung</small><b>${h.feed.length} Einträge</b></div><i>›</i></button></div>
      ${window.EquiWeather?EquiWeather.card():''}
      <div class="dash-section-title"><span>Schnellzugriff</span></div><div class="dash-actions"><button type="button" onclick="go('map')"><span>🐴</span><b>Körperkarte</b><small>Bereiche & Fotos</small></button><button type="button" onclick="go('treatment')"><span>🧴</span><b>Behandlung</b><small>Produkt & Anwendung</small></button><button type="button" onclick="go('history')"><span>📈</span><b>Verlauf</b><small>Gesundheit & Umwelt</small></button></div>`;
  }
  screens.today=todayScreen;
})();
