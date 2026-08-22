// EquiCare product scan / OCR module
(function(){
  const OCR_CDN='https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
  let pendingScan=null;

  function e(id){return document.getElementById(id)}
  function html(v=''){return typeof esc==='function'?esc(v):String(v).replace(/[&<>"']/g,'')}

  function productLibrary(){
    const h=activeHorse();
    if(!h.productLibrary) h.productLibrary=[];
    return h.productLibrary;
  }

  function recentProducts(){
    return [...productLibrary()].sort((a,b)=>(b.lastUsed||'').localeCompare(a.lastUsed||'')).slice(0,6);
  }

  function recentProductHtml(){
    const items=recentProducts();
    if(!items.length) return '<div class="sub">Noch keine gespeicherten Produkte.</div>';
    return `<div class="recent-products">${items.map(p=>`<button type="button" class="product-chip" onclick="useProduct('${encodeURIComponent(p.name)}','${encodeURIComponent(p.type||'')}')">${html(p.name)}</button>`).join('')}</div>`;
  }

  window.useProduct=function(name,type){
    const n=decodeURIComponent(name||'');
    const t=decodeURIComponent(type||'');
    if(e('tp'))e('tp').value=n;
    if(t&&e('tt'))e('tt').value=t;
  };

  function loadOCR(){
    if(window.Tesseract) return Promise.resolve(window.Tesseract);
    return new Promise((resolve,reject)=>{
      const s=document.createElement('script');
      s.src=OCR_CDN;s.async=true;
      s.onload=()=>resolve(window.Tesseract);
      s.onerror=()=>reject(new Error('OCR konnte nicht geladen werden'));
      document.head.appendChild(s);
    });
  }

  async function compressImage(file,max=1600,quality=.82){
    const url=URL.createObjectURL(file);
    try{
      const img=new Image();
      await new Promise((res,rej)=>{img.onload=res;img.onerror=rej;img.src=url});
      const scale=Math.min(1,max/Math.max(img.naturalWidth,img.naturalHeight));
      const w=Math.max(1,Math.round(img.naturalWidth*scale)),h=Math.max(1,Math.round(img.naturalHeight*scale));
      const c=document.createElement('canvas');c.width=w;c.height=h;
      c.getContext('2d',{alpha:false}).drawImage(img,0,0,w,h);
      return c.toDataURL('image/jpeg',quality);
    } finally { URL.revokeObjectURL(url); }
  }

  async function detectBarcode(file){
    if(!('BarcodeDetector' in window)) return '';
    try{
      const formats=['ean_13','ean_8','upc_a','upc_e','code_128','qr_code'];
      const detector=new BarcodeDetector({formats});
      const bitmap=await createImageBitmap(file);
      const codes=await detector.detect(bitmap);
      bitmap.close&&bitmap.close();
      return codes[0]?.rawValue||'';
    }catch(_){return ''}
  }

  const rejectWords=/^(ingredients?|inhaltsstoffe?|anwendung|warning|achtung|hinweis|hersteller|vertrieb|kontakt|www\.|http|made in|barcode|batch|charge|lot|mindestens|haltbar|best before)$/i;
  const units=/^\s*\d+[\s.,\d]*(ml|l|g|kg|mg|oz|fl\.?\s*oz)\s*$/i;

  function cleanLine(s){return s.replace(/[|_[\]{{}}<>]/g,' ').replace(/\s+/g,' ').trim()}
  function lineScore(line,index){
    if(!line||line.length<3||line.length>55)return -99;
    if(rejectWords.test(line)||units.test(line))return -99;
    if(/^(\d[\d .,:;\/-]*)$/.test(line))return -99;
    if(/@|https?:|www\./i.test(line))return -50;
    const letters=(line.match(/[A-Za-zÀ-ÿ]/g)||[]).length;
    if(letters<3)return -40;
    let score=letters/Math.max(1,line.length)*5;
    score+=Math.max(0,4-index*.45);
    if(/^[A-ZÀ-Ý0-9][A-Za-zÀ-ÿ0-9 '&+.-]+$/.test(line))score+=2;
    if(/creme|cream|salbe|lotion|spray|shampoo|gel|balsam|balm|pflege|care|haut|skin/i.test(line))score+=3;
    if(line.length>=5&&line.length<=30)score+=1.5;
    return score;
  }

  function parseProduct(text){
    const lines=(text||'').split(/\r?\n/).map(cleanLine).filter(Boolean);
    const ranked=lines.map((line,i)=>({line,i,score:lineScore(line,i)})).filter(x=>x.score>-20).sort((a,b)=>b.score-a.score);
    let name=ranked[0]?.line||'';
    // Often brand is on line 1 and product name on line 2. Combine when both look plausible.
    const first=lines.slice(0,4).filter((l,i)=>lineScore(l,i)>3);
    if(first.length>=2 && first[0].length+first[1].length<48 && !first[0].toLowerCase().includes(first[1].toLowerCase())){
      const combined=first[0]+' '+first[1];
      if(lineScore(first[0],0)+lineScore(first[1],1)>lineScore(name,0)+2) name=combined;
    }
    const all=text||'';
    let type='Andere';
    if(/creme|cream/i.test(all))type='Creme';
    else if(/salbe|ointment/i.test(all))type='Salbe';
    else if(/spray/i.test(all))type='Spray';
    else if(/shampoo/i.test(all))type='Shampoo';
    else if(/lotion/i.test(all))type='Lotion';
    else if(/gel\b/i.test(all))type='Gel';
    return {name,type,lines:ranked.slice(0,5).map(x=>x.line)};
  }

  function setScanStatus(text,kind='info'){
    const s=e('scanStatus');if(!s)return;s.className='scan-status '+kind;s.textContent=text;
  }

  window.scanProduct=function(){
    const input=e('productScanInput');
    if(input){input.value='';input.click()}
  };

  window.handleProductScan=async function(input){
    const file=input?.files?.[0];if(!file)return;
    pendingScan=null;
    const preview=e('productPreview');
    try{
      setScanStatus('Foto wird vorbereitet …');
      const image=await compressImage(file);
      if(preview){preview.src=image;preview.hidden=false}
      const barcodePromise=detectBarcode(file);
      setScanStatus('Etikett wird gelesen … 0 %');
      const T=await loadOCR();
      const result=await T.recognize(image,'deu+eng',{logger:m=>{
        if(m.status==='recognizing text'&&typeof m.progress==='number')setScanStatus(`Etikett wird gelesen … ${Math.round(m.progress*100)} %`);
      }});
      const barcode=await barcodePromise;
      const parsed=parseProduct(result?.data?.text||'');
      pendingScan={image,barcode,text:result?.data?.text||'',...parsed};
      if(parsed.name&&e('tp'))e('tp').value=parsed.name;
      if(parsed.type&&e('tt'))e('tt').value=parsed.type;
      if(e('barcodeValue'))e('barcodeValue').value=barcode;
      if(parsed.name){
        setScanStatus(`Erkannt: ${parsed.name}${barcode?' · EAN '+barcode:''}. Bitte kurz prüfen und dann speichern.`,'ok');
      }else{
        setScanStatus(`Produktname nicht sicher erkannt${barcode?' · Barcode '+barcode:''}. Bitte Namen manuell ergänzen.`,'warn');
      }
    }catch(err){
      console.error(err);
      setScanStatus('Automatische Erkennung war nicht möglich. Du kannst den Produktnamen trotzdem manuell eingeben.','warn');
    }
  };

  function treatmentAreaOptions(){
    const areas=['Schopf','Mähnenkamm','Mähne','Hals','Brust','Rücken','Rumpf','Bauch','Bauchnaht','Kruppe','Schweifrübe','Schweif','Vorderbein','Hinterbein'];
    const selected=(typeof zone==='string'&&zone)||'Mähnenkamm';
    return areas.map(a=>`<option ${a===selected?'selected':''}>${a}</option>`).join('');
  }

  window.treatmentSheet=function(){
    openSheet('Behandlung hinzufügen',`
      <div class="field"><label>Bereich</label><select id="ta">${treatmentAreaOptions()}</select></div>
      <div class="scan-card">
        <div class="row between"><div><b>Produkt automatisch erkennen</b><div class="sub">Etikett oder Vorderseite fotografieren</div></div><button type="button" class="btn soft" onclick="scanProduct()">📷 Produkt scannen</button></div>
        <input id="productScanInput" type="file" accept="image/*" capture="environment" hidden onchange="handleProductScan(this)">
        <img id="productPreview" class="product-preview" hidden alt="Produktfoto">
        <div id="scanStatus" class="scan-status">Kamera öffnen und Produkt möglichst frontal fotografieren.</div>
      </div>
      <div class="field"><label>Produktname *</label><input id="tp" autocomplete="off" placeholder="wird nach dem Scan automatisch vorgeschlagen"></div>
      <div class="split">
        <div class="field"><label>Produktart</label><select id="tt">${['Creme','Salbe','Lotion','Spray','Shampoo','Gel','Medikament','Andere'].map(x=>`<option>${x}</option>`).join('')}</select></div>
        <div class="field"><label>Barcode / EAN</label><input id="barcodeValue" inputmode="numeric" placeholder="optional"></div>
      </div>
      <div class="field"><label>Menge / Anwendung</label><input id="td" placeholder="z. B. dünn aufgetragen"></div>
      <div class="field"><label>Zuletzt verwendet</label>${recentProductHtml()}</div>
    `,'Behandlung speichern','saveTreatment()');
  };

  window.saveTreatment=function(){
    const product=e('tp')?.value.trim()||'';
    if(!product){note('Bitte Produktname eingeben');e('tp')?.focus();return}
    const h=activeHorse();
    const type=e('tt')?.value||'Andere';
    const barcode=e('barcodeValue')?.value.trim()||pendingScan?.barcode||'';
    const area=e('ta')?.value||'Mähnenkamm';
    const dose=e('td')?.value.trim()||'';
    const d=new Date();
    const stamp=d.toLocaleDateString('de-DE',{day:'2-digit',month:'2-digit',year:'numeric'})+' '+d.toLocaleTimeString('de-DE',{hour:'2-digit',minute:'2-digit'});
    if(!h.treatments)h.treatments=[];
    h.treatments.unshift([stamp,area,product,dose,{type,barcode,scanned:!!pendingScan}]);
    if(!h.productLibrary)h.productLibrary=[];
    const key=(barcode||product).toLowerCase();
    const idx=h.productLibrary.findIndex(p=>((p.barcode||p.name)||'').toLowerCase()===key || p.name.toLowerCase()===product.toLowerCase());
    const item={name:product,type,barcode,lastUsed:new Date().toISOString()};
    if(idx>=0)h.productLibrary[idx]={...h.productLibrary[idx],...item};else h.productLibrary.push(item);
    save();pendingScan=null;closeSheet();note('Behandlung und Produkt gespeichert');render();
  };
})();
