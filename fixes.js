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
  const ageValue=$id('ha').value;
  return {
    name:$id('hn').value.trim(),
    race:$id('hr').value.trim(),
    birth,
    age:ageValue===''?(birth?ageFromBirth(birth):''):Number(ageValue),
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