function $id(id){return document.getElementById(id)}

saveDaily=function(){
  const h=activeHorse();
  const obj={
    date:$id('qd').value||todayISO(),
    itch:Number($id('qi').value),
    insects:$id('qin').value,
    start:$id('qs').value,
    end:$id('qe').value,
    blanket:$id('qb').value,
    temp:$id('qt').value===''?'':Number($id('qt').value),
    hum:$id('qh').value===''?'':Number($id('qh').value),
    note:$id('qn').value
  };
  const idx=h.daily.findIndex(x=>x.date===obj.date);
  if(idx>=0)h.daily[idx]={...h.daily[idx],...obj};else h.daily.push(obj);
  h.daily.sort((a,b)=>a.date.localeCompare(b.date));
  save();note('Tagesprotokoll gespeichert');go('today',false);
};

savePasture=function(){
  const h=activeHorse();
  h.housing=[...root.querySelectorAll('[data-house].on')].map(x=>x.dataset.house);
  const d=lastDaily(h);
  const obj={...d,start:$id('ps').value,end:$id('pe').value,pastureNote:$id('pn').value};
  const idx=h.daily.findIndex(x=>x.date===obj.date);
  if(idx>=0)h.daily[idx]=obj;else h.daily.push(obj);
  save();note('Weide & Haltung gespeichert');go('today',false);
};

readHorseForm=function(){
  const birth=$id('hb').value;
  return {
    name:$id('hn').value.trim(),
    race:$id('hr').value.trim(),
    birth,
    age:birth?ageFromBirth(birth):'',
    sex:$id('hs').value,
    color:$id('hc').value.trim(),
    height:$id('hh').value.trim(),
    weight:$id('hw').value.trim(),
    chip:$id('hchip').value.trim(),
    passport:$id('hpass').value.trim(),
    notes:$id('hnotes').value.trim()
  };
};

saveNewHorse=function(){
  const v=readHorseForm();
  if(!v.name){note('Bitte Name eingeben');$id('hn').focus();return}
  if(!v.race){note('Bitte Rasse eingeben');$id('hr').focus();return}
  const h=blankHorse(v);
  S.horses.push(h);S.activeHorseId=h.id;save();closeSheet();note('Pferd gespeichert');go('profile',false);
};

saveHorseEdit=function(){
  const h=activeHorse(),v=readHorseForm();
  if(!v.name){note('Bitte Name eingeben');$id('hn').focus();return}
  Object.assign(h,v);save();closeSheet();note('Pferdeprofil gespeichert');render();
};

saveMed=function(){
  const name=$id('mn').value.trim();
  if(!name){note('Bitte Medikament eingeben');$id('mn').focus();return}
  activeHorse().meds.push({id:uid(),name,dose:$id('md').value.trim(),reason:$id('mr').value.trim(),am:false,pm:false});
  save();closeSheet();note('Medikament gespeichert');render();
};

saveFeed=function(){
  const name=$id('fn').value.trim();
  if(!name){note('Bitte Futter eingeben');$id('fn').focus();return}
  activeHorse().feed.push([$id('fg').value,name,$id('fa').value.trim()]);
  save();closeSheet();note('Futter gespeichert');render();
};

saveTreatment=function(){
  const product=$id('tp').value.trim();
  if(!product){note('Bitte Behandlung eingeben');$id('tp').focus();return}
  const d=new Date();
  const stamp=d.toLocaleDateString('de-DE',{day:'2-digit',month:'2-digit'})+' '+d.toLocaleTimeString('de-DE',{hour:'2-digit',minute:'2-digit'});
  activeHorse().treatments.unshift([stamp,$id('ta').value.trim(),product,$id('td').value.trim()]);
  save();closeSheet();note('Behandlung gespeichert');render();
};

// Alter wird ausschließlich aus dem Geburtsdatum berechnet.
function updateHorseAgePreview(){
  const birth=$id('hb')?.value||'';
  const out=$id('haPreview');
  if(!out)return;
  const age=birth?ageFromBirth(birth):'';
  out.textContent=age===''?'—':age+' Jahre';
}

horseFields=function(h={}){
  const birth=normalizeBirth(h.birth);
  const calculatedAge=birth?ageFromBirth(birth):'';
  return `<div>
    <div class="field"><label>Name *</label><input id="hn" autocomplete="off" value="${esc(h.name||'')}" placeholder="z. B. Bella"></div>
    <div class="field"><label>Rasse *</label><input id="hr" autocomplete="off" value="${esc(h.race||'')}" placeholder="z. B. PRE"></div>
    <div class="split">
      <div class="field"><label>Geburtsdatum</label><input id="hb" type="date" value="${esc(birth)}" max="${todayISO()}" oninput="updateHorseAgePreview()" onchange="updateHorseAgePreview()"></div>
      <div class="field"><label>Alter</label><div id="haPreview" style="min-height:43px;padding:11px;border:1px solid var(--l);border-radius:11px;background:#f4f3f8;font-weight:750;color:var(--p);display:flex;align-items:center">${calculatedAge===''?'—':calculatedAge+' Jahre'}</div><div class="sub">wird automatisch berechnet</div></div>
    </div>
    <div class="split"><div class="field"><label>Geschlecht</label><select id="hs"><option value="">Bitte wählen</option>${['Stute','Wallach','Hengst'].map(x=>`<option ${h.sex===x?'selected':''}>${x}</option>`).join('')}</select></div><div class="field"><label>Farbe</label><input id="hc" value="${esc(h.color||'')}" placeholder="z. B. Schimmel"></div></div>
    <div class="split"><div class="field"><label>Stockmaß</label><input id="hh" value="${esc(h.height||'')}" placeholder="z. B. 164 cm"></div><div class="field"><label>Gewicht</label><input id="hw" value="${esc(h.weight||'')}" placeholder="z. B. 580 kg"></div></div>
    <div class="field"><label>Chipnummer</label><input id="hchip" value="${esc(h.chip||'')}"></div>
    <div class="field"><label>Equidenpass</label><input id="hpass" value="${esc(h.passport||'')}"></div>
    <div class="field"><label>Notizen</label><textarea id="hnotes" placeholder="Besonderheiten, Erkrankungen, Allergien …">${esc(h.notes||'')}</textarea></div>
  </div>`;
};

displayAge=function(h){
  const a=h?.birth?ageFromBirth(normalizeBirth(h.birth)):'';
  return a!==''?`${a} Jahre`:'Alter offen';
};

detailRows=function(h){
  const rows=[['Geburtsdatum',h.birth||'—'],['Alter',displayAge(h)],['Rasse',h.race||'—'],['Geschlecht',h.sex||'—'],['Farbe',h.color||'—'],['Stockmaß',h.height||'—'],['Gewicht',h.weight||'—'],['Chipnummer',h.chip||'—'],['Equidenpass',h.passport||'—']];
  return rows.map(x=>`<div class="drow"><span>${x[0]}</span><span>${esc(x[1])}</span></div>`).join('');
};