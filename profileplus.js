// EquiCare interactive horse profile: master data, health record, contacts and notes
(function(){
  let activeTab='profile';
  let editHealthId=null;
  let editContactId=null;

  const healthTypes=['Diagnose / Besonderheit','Allergie / Unverträglichkeit','Impfung','Entwurmung','Verletzung / OP','Untersuchung','Labor / Befund','Sonstiges'];
  const contactRoles=['Tierarzt','Pferdezahnarzt','Hufschmied / Hufpfleger','Tierklinik','Physiotherapie / Osteopathie','Stall / Betreiber','Notfallkontakt','Versicherung','Sonstiges'];

  function e(id){return document.getElementById(id)}
  function html(v=''){return typeof esc==='function'?esc(v):String(v).replace(/[&<>"']/g,'')}
  function id(){return 'rec_'+Date.now().toString(36)+Math.random().toString(36).slice(2,7)}
  function normalize(h){
    if(!Array.isArray(h.healthRecords))h.healthRecords=[];
    if(!Array.isArray(h.contacts))h.contacts=[];
    if(!Array.isArray(h.noteHistory))h.noteHistory=[];
    return h;
  }
  function fmtDate(v){if(!v)return 'ohne Datum';try{return new Date(v+'T12:00:00').toLocaleDateString('de-DE',{day:'2-digit',month:'2-digit',year:'numeric'})}catch(_){return v}}
  function today(){return typeof todayISO==='function'?todayISO():new Date().toISOString().slice(0,10)}
  function roleIcon(role=''){if(role.includes('Zahn'))return '🦷';if(role.includes('Huf'))return '🧲';if(role.includes('Klinik'))return '🏥';if(role.includes('Physio')||role.includes('Osteo'))return '👐';if(role.includes('Notfall'))return '🚨';if(role.includes('Stall'))return '🏡';if(role.includes('Versicherung'))return '🛡️';return '🩺'}
  function healthIcon(type=''){if(type.includes('Allerg'))return '⚠️';if(type.includes('Impf'))return '💉';if(type.includes('Entwurm'))return '🪱';if(type.includes('Verletz')||type.includes('OP'))return '🩹';if(type.includes('Untersuch'))return '🔎';if(type.includes('Labor'))return '🧪';if(type.includes('Diagnose'))return '🩺';return '📋'}
  function safeTel(v=''){return String(v).replace(/[^+0-9]/g,'')}
  function mail(v=''){return encodeURIComponent(String(v))}
  function map(v=''){return encodeURIComponent(String(v))}

  function tabBar(){return `<div class="profile-tabs" role="tablist">${[
    ['profile','Profil','🪪'],['health','Gesundheit','❤️'],['contacts','Kontakte','☎️'],['notes','Notizen','📝']
  ].map(([k,l,i])=>`<button type="button" class="${activeTab===k?'on':''}" onclick="EquiProfile.tab('${k}')"><span>${i}</span><b>${l}</b></button>`).join('')}</div>`}

  function header(h){return `<div class="top"><button class="back" onclick="back()">‹</button><div class="title">${html(h.name||'Pferd')}</div><span></span></div><div class="profile-hero"><div class="avatar">🐴</div><div><b>${html(h.name||'Pferd')}</b><span>${html(h.race||'Rasse offen')}${h.sex?' · '+html(h.sex):''}${h.birth?' · '+html(displayAge(h)):''}</span></div><button type="button" onclick="editHorse()">Bearbeiten</button></div>${tabBar()}`}

  function profilePane(h){return `<div class="card profile-pane"><div class="pane-title"><div><b>Stammdaten</b><span>Grunddaten des Pferdes</span></div><button class="btn soft" type="button" onclick="editHorse()">Bearbeiten</button></div><div class="detail">${detailRows(h)}</div></div><div class="profile-shortcuts"><button type="button" onclick="go('map')"><span>🐴</span><b>Körperkarte</b><small>Bereiche & Fotos</small></button><button type="button" onclick="go('calendar')"><span>📅</span><b>Kalender</b><small>Tagesakten</small></button><button type="button" onclick="go('history')"><span>📈</span><b>Verlauf</b><small>Gesundheit & Umwelt</small></button></div><button class="btn outline full profile-delete" onclick="deleteHorsePrompt()">Pferd löschen</button>`}

  function healthSummary(h){
    const r=h.healthRecords;
    const diagnoses=r.filter(x=>x.type==='Diagnose / Besonderheit').length;
    const allergies=r.filter(x=>x.type==='Allergie / Unverträglichkeit').length;
    const upcoming=r.filter(x=>x.nextDue&&x.nextDue>=today()).sort((a,b)=>a.nextDue.localeCompare(b.nextDue))[0];
    return `<div class="health-overview"><div><small>Einträge</small><b>${r.length}</b></div><div><small>Diagnosen</small><b>${diagnoses}</b></div><div><small>Allergien</small><b>${allergies}</b></div><div><small>Nächster Termin</small><b>${upcoming?fmtDate(upcoming.nextDue):'—'}</b></div></div>`;
  }
  function healthCards(h){
    if(!h.healthRecords.length)return `<div class="profile-empty"><span>❤️</span><b>Noch keine Gesundheitsdaten</b><p>Diagnosen, Impfungen, Allergien, Untersuchungen und weitere Einträge können hier dauerhaft dokumentiert werden.</p></div>`;
    return [...h.healthRecords].sort((a,b)=>(b.date||'').localeCompare(a.date||'')).map(x=>`<article class="health-record"><div class="record-icon">${healthIcon(x.type)}</div><div class="record-main"><div class="row between"><div><small>${html(x.type)}</small><b>${html(x.title||x.type)}</b></div><button class="record-menu" onclick="EquiProfile.editHealth('${x.id}')">Bearbeiten</button></div><div class="record-meta">${fmtDate(x.date)}${x.nextDue?` · nächster Termin ${fmtDate(x.nextDue)}`:''}</div>${x.details?`<p>${html(x.details)}</p>`:''}</div></article>`).join('')
  }
  function healthPane(h){return `${healthSummary(h)}<div class="pane-title profile-section-head"><div><b>Gesundheitsakte</b><span>Alle Einträge chronologisch</span></div><button class="btn primary" type="button" onclick="EquiProfile.healthSheet()">＋ Eintrag</button></div><div class="health-list">${healthCards(h)}</div><div class="profile-shortcuts"><button type="button" onclick="go('meds')"><span>💊</span><b>Medikamente</b><small>${h.meds?.length||0} angelegt</small></button><button type="button" onclick="go('treatment')"><span>🧴</span><b>Behandlungen</b><small>${h.treatments?.length||0} dokumentiert</small></button><button type="button" onclick="go('calendar')"><span>📅</span><b>Tagesakten</b><small>Kalender öffnen</small></button></div>`}

  function contactCards(h){
    if(!h.contacts.length)return `<div class="profile-empty"><span>☎️</span><b>Noch keine Kontakte</b><p>Lege Tierarzt, Zahnarzt, Hufschmied, Klinik oder andere wichtige Ansprechpartner an.</p></div>`;
    return h.contacts.map(c=>`<article class="contact-card"><div class="contact-top"><div class="record-icon">${roleIcon(c.role)}</div><div class="contact-name"><small>${html(c.role)}</small><b>${html(c.name||'Kontakt')}</b>${c.person?`<span>${html(c.person)}</span>`:''}</div><button class="record-menu" onclick="EquiProfile.editContact('${c.id}')">Bearbeiten</button></div>${c.phone||c.email||c.address?`<div class="contact-actions">${c.phone?`<a href="tel:${safeTel(c.phone)}"><span>📞</span>Anrufen</a>`:''}${c.email?`<a href="mailto:${mail(c.email)}"><span>✉️</span>E-Mail</a>`:''}${c.address?`<a href="https://maps.apple.com/?q=${map(c.address)}" target="_blank" rel="noopener"><span>📍</span>Route</a>`:''}</div>`:''}<div class="contact-details">${c.phone?`<div><span>Telefon</span><b>${html(c.phone)}</b></div>`:''}${c.email?`<div><span>E-Mail</span><b>${html(c.email)}</b></div>`:''}${c.address?`<div><span>Adresse</span><b>${html(c.address)}</b></div>`:''}${c.notes?`<div><span>Notiz</span><b>${html(c.notes)}</b></div>`:''}</div></article>`).join('')
  }
  function contactsPane(h){return `<div class="pane-title profile-section-head"><div><b>Wichtige Kontakte</b><span>${h.contacts.length} Kontakt${h.contacts.length===1?'':'e'} gespeichert</span></div><button class="btn primary" type="button" onclick="EquiProfile.contactSheet()">＋ Kontakt</button></div><div class="contact-list">${contactCards(h)}</div>`}

  function notesPane(h){return `<div class="card profile-pane"><div class="pane-title"><div><b>Allgemeine Notizen</b><span>Besonderheiten, Verhalten, Hinweise</span></div></div><textarea id="profileNoteText" class="profile-notes" placeholder="Hier kannst du alles Wichtige zu ${html(h.name||'diesem Pferd')} festhalten …">${html(h.notes||'')}</textarea><button class="btn primary full" type="button" onclick="EquiProfile.saveNotes()">Notizen speichern</button></div>${h.noteHistory.length?`<div class="card profile-pane"><b>Änderungsverlauf</b><div class="note-history">${[...h.noteHistory].reverse().slice(0,10).map(n=>`<div><span>${new Date(n.ts).toLocaleString('de-DE',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'})}</span><p>${html(n.text)}</p></div>`).join('')}</div></div>`:''}`}

  function profileScreen(){
    const h=normalize(activeHorse());if(!h)return emptyState();
    const panes={profile:profilePane,health:healthPane,contacts:contactsPane,notes:notesPane};
    return `${header(h)}<section class="profile-content">${(panes[activeTab]||profilePane)(h)}</section>`;
  }

  function healthSheet(record=null){
    const r=record||{};editHealthId=record?.id||null;
    openSheet(record?'Gesundheitseintrag bearbeiten':'Gesundheitseintrag hinzufügen',`<div class="field"><label>Art *</label><select id="phrType">${healthTypes.map(x=>`<option ${r.type===x?'selected':''}>${x}</option>`).join('')}</select></div><div class="field"><label>Titel *</label><input id="phrTitle" value="${html(r.title||'')}" placeholder="z. B. Sommerekzem, Tetanus-Impfung …"></div><div class="split"><div class="field"><label>Datum</label><input id="phrDate" type="date" value="${html(r.date||today())}"></div><div class="field"><label>Nächster Termin</label><input id="phrDue" type="date" value="${html(r.nextDue||'')}"></div></div><div class="field"><label>Details</label><textarea id="phrDetails" placeholder="Befund, Präparat, Tierarzt, Dosierung, Besonderheiten …">${html(r.details||'')}</textarea></div>${record?'<button class="btn outline full danger-action" type="button" onclick="EquiProfile.deleteHealth()">Eintrag löschen</button>':''}`,'Speichern','EquiProfile.saveHealth()')
  }
  function saveHealth(){
    const h=normalize(activeHorse()),title=e('phrTitle')?.value.trim()||'';if(!title){note('Bitte einen Titel eingeben');e('phrTitle')?.focus();return}
    const data={id:editHealthId||id(),type:e('phrType').value,title,date:e('phrDate').value,nextDue:e('phrDue').value,details:e('phrDetails').value.trim(),updatedAt:new Date().toISOString()};
    const i=h.healthRecords.findIndex(x=>x.id===data.id);if(i>=0)h.healthRecords[i]={...h.healthRecords[i],...data};else h.healthRecords.push(data);
    save();editHealthId=null;closeSheet();note('Gesundheitsdaten gespeichert');render();
  }
  function editHealth(idv){const h=normalize(activeHorse()),r=h.healthRecords.find(x=>x.id===idv);if(r)healthSheet(r)}
  function deleteHealth(){if(!editHealthId||!confirm('Diesen Gesundheitseintrag wirklich löschen?'))return;const h=normalize(activeHorse());h.healthRecords=h.healthRecords.filter(x=>x.id!==editHealthId);editHealthId=null;save();closeSheet();note('Eintrag gelöscht');render()}

  function contactSheet(record=null){
    const c=record||{};editContactId=record?.id||null;
    openSheet(record?'Kontakt bearbeiten':'Kontakt hinzufügen',`<div class="field"><label>Rolle *</label><select id="pcRole">${contactRoles.map(x=>`<option ${c.role===x?'selected':''}>${x}</option>`).join('')}</select></div><div class="field"><label>Name / Praxis *</label><input id="pcName" value="${html(c.name||'')}" placeholder="z. B. Tierarztpraxis Muster"></div><div class="field"><label>Ansprechpartner</label><input id="pcPerson" value="${html(c.person||'')}" placeholder="z. B. Dr. Mustermann"></div><div class="field"><label>Telefon</label><input id="pcPhone" inputmode="tel" value="${html(c.phone||'')}" placeholder="+49 …"></div><div class="field"><label>E-Mail</label><input id="pcEmail" inputmode="email" value="${html(c.email||'')}" placeholder="praxis@beispiel.de"></div><div class="field"><label>Adresse</label><input id="pcAddress" value="${html(c.address||'')}" placeholder="Straße, PLZ Ort"></div><div class="field"><label>Notiz</label><textarea id="pcNotes" placeholder="Sprechzeiten, Notdienst, Besonderheiten …">${html(c.notes||'')}</textarea></div>${record?'<button class="btn outline full danger-action" type="button" onclick="EquiProfile.deleteContact()">Kontakt löschen</button>':''}`,'Speichern','EquiProfile.saveContact()')
  }
  function saveContact(){
    const h=normalize(activeHorse()),name=e('pcName')?.value.trim()||'';if(!name){note('Bitte Name oder Praxis eingeben');e('pcName')?.focus();return}
    const data={id:editContactId||id(),role:e('pcRole').value,name,person:e('pcPerson').value.trim(),phone:e('pcPhone').value.trim(),email:e('pcEmail').value.trim(),address:e('pcAddress').value.trim(),notes:e('pcNotes').value.trim(),updatedAt:new Date().toISOString()};
    const i=h.contacts.findIndex(x=>x.id===data.id);if(i>=0)h.contacts[i]={...h.contacts[i],...data};else h.contacts.push(data);
    save();editContactId=null;closeSheet();note('Kontakt gespeichert');render();
  }
  function editContact(idv){const h=normalize(activeHorse()),c=h.contacts.find(x=>x.id===idv);if(c)contactSheet(c)}
  function deleteContact(){if(!editContactId||!confirm('Diesen Kontakt wirklich löschen?'))return;const h=normalize(activeHorse());h.contacts=h.contacts.filter(x=>x.id!==editContactId);editContactId=null;save();closeSheet();note('Kontakt gelöscht');render()}

  function saveNotes(){const h=normalize(activeHorse()),text=e('profileNoteText')?.value.trim()||'';h.notes=text;if(text)h.noteHistory.push({ts:new Date().toISOString(),text});save();note('Notizen gespeichert');render()}

  window.EquiProfile={
    tab(k){if(['profile','health','contacts','notes'].includes(k)){activeTab=k;render()}},
    healthSheet:()=>healthSheet(),saveHealth,editHealth,deleteHealth,
    contactSheet:()=>contactSheet(),saveContact,editContact,deleteContact,
    saveNotes
  };
  screens.profile=profileScreen;
})();
