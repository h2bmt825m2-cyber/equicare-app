// EquiCare PWA install + offline/update support
(function(){
  let deferredPrompt=null;
  const isStandalone=()=>window.matchMedia('(display-mode: standalone)').matches||window.navigator.standalone===true;
  const isIOS=()=>/iphone|ipad|ipod/i.test(navigator.userAgent);
  const isSafari=()=>/^((?!chrome|android|crios|fxios).)*safari/i.test(navigator.userAgent);

  function onlineLabel(){return navigator.onLine?'Online · Synchroner Webzugriff':'Offline · lokale App-Daten verfügbar'}
  function onlineDot(){return navigator.onLine?'':' offline'}

  function installCard(){
    if(isStandalone())return `<div class="card pwa-card"><div class="row between"><div><b>📱 EquiCare App</b><div class="sub">Auf diesem Gerät installiert</div></div><span class="pwa-installed">✓ Installiert</span></div><div class="pwa-status"><i class="pwa-dot${onlineDot()}"></i>${onlineLabel()}</div></div>`;
    return `<div class="card pwa-card"><div class="row between"><div><b>📱 EquiCare installieren</b><div class="sub">Wie eine normale App vom Homescreen öffnen</div></div><button class="btn primary" type="button" onclick="EquiPWA.install()">Installieren</button></div><div class="pwa-status"><i class="pwa-dot${onlineDot()}"></i>${onlineLabel()}</div></div>`;
  }

  function iosSheet(){
    modal.innerHTML=`<div class="sheetbg" onclick="if(event.target===this)closeSheet()"><div class="sheet pwa-install-sheet"><div class="row between"><div><h2 style="margin:0">EquiCare installieren</h2><div class="sub">iPhone / iPad</div></div><button class="back" onclick="closeSheet()">×</button></div><div class="install-steps"><div class="install-step"><strong>1</strong><div><b>In Safari öffnen</b><span>Falls EquiCare gerade in einem anderen Browser geöffnet ist, öffne den Link in Safari.</span></div></div><div class="install-step"><strong>2</strong><div><b>Teilen antippen</b><span>Unten in Safari auf das Teilen-Symbol □↑ tippen.</span></div></div><div class="install-step"><strong>3</strong><div><b>„Zum Home-Bildschirm“</b><span>Nach unten scrollen und „Zum Home-Bildschirm“ auswählen.</span></div></div><div class="install-step"><strong>4</strong><div><b>Hinzufügen</b><span>Oben rechts „Hinzufügen“ tippen. Danach startet EquiCare im Vollbild vom Homescreen.</span></div></div></div><div class="sub">Deine vorhandenen Daten bleiben im Browser-/App-Speicher dieses Geräts erhalten.</div><button class="btn primary full" style="margin-top:12px" onclick="closeSheet()">Verstanden</button></div></div>`;
  }

  async function install(){
    if(isStandalone()){note('EquiCare ist bereits installiert');return}
    if(deferredPrompt){
      deferredPrompt.prompt();
      try{await deferredPrompt.userChoice}catch(_){ }
      deferredPrompt=null;
      render();
      return;
    }
    if(isIOS()){iosSheet();return}
    modal.innerHTML=`<div class="sheetbg" onclick="if(event.target===this)closeSheet()"><div class="sheet pwa-install-sheet"><div class="row between"><h2 style="margin:0">EquiCare installieren</h2><button class="back" onclick="closeSheet()">×</button></div><div class="sub" style="margin:12px 0">Öffne das Browser-Menü und wähle „App installieren“ oder „Zum Startbildschirm hinzufügen“.</div><button class="btn primary full" onclick="closeSheet()">OK</button></div></div>`;
  }

  window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredPrompt=e;});
  window.addEventListener('appinstalled',()=>{deferredPrompt=null;document.documentElement.classList.add('standalone');if(typeof note==='function')note('EquiCare wurde installiert');if(typeof render==='function')render();});
  window.addEventListener('online',()=>{if(typeof render==='function'&&R==='more')render();});
  window.addEventListener('offline',()=>{if(typeof render==='function'&&R==='more')render();});

  if(isStandalone())document.documentElement.classList.add('standalone');

  if('serviceWorker' in navigator){
    window.addEventListener('load',()=>{
      navigator.serviceWorker.register('./sw.js',{scope:'./'}).then(reg=>{
        reg.update().catch(()=>{});
      }).catch(err=>console.error('EquiCare Service Worker:',err));
    });
  }

  const originalMore=screens.more;
  screens.more=function(){return originalMore()+installCard()};

  // Optional PWA shortcuts / deep links
  const requested=new URLSearchParams(location.search).get('view');
  if(requested&&screens[requested])setTimeout(()=>go(requested,false),0);

  window.EquiPWA={install,isStandalone,installCard};
})();
