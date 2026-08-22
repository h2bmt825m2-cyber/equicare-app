// EquiCare product scanner v2 – multi-pass OCR, preprocessing and candidate selection
(function(){
  const OCR_CDN='https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
  let pendingScan=null;
  let workerPromise=null;

  function e(id){return document.getElementById(id)}
  function html(v=''){return typeof esc==='function'?esc(v):String(v).replace(/[&<>"']/g,'')}

  function productLibrary(){const h=activeHorse();if(!h.productLibrary)h.productLibrary=[];return h.productLibrary}
  function recentProducts(){return [...productLibrary()].sort((a,b)=>(b.lastUsed||'').localeCompare(a.lastUsed||'')).slice(0,8)}
  function recentProductHtml(){const items=recentProducts();if(!items.length)return '<div class="sub">Noch keine gespeicherten Produkte.</div>';return `<div class="recent-products">${items.map(p=>`<button type="button" class="product-chip" onclick="useProduct('${encodeURIComponent(p.name)}','${encodeURIComponent(p.type||'')}')">${html(p.name)}</button>`).join('')}</div>`}

  window.useProduct=function(name,type){const n=decodeURIComponent(name||''),t=decodeURIComponent(type||'');if(e('tp'))e('tp').value=n;if(t&&e('tt'))e('tt').value=t};

  function loadOCR(){
    if(window.Tesseract)return Promise.resolve(window.Tesseract);
    return new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=OCR_CDN;s.async=true;s.onload=()=>resolve(window.Tesseract);s.onerror=()=>reject(new Error('OCR konnte nicht geladen werden'));document.head.appendChild(s)})
  }

  async function getWorker(){
    if(workerPromise)return workerPromise;
    workerPromise=(async()=>{const T=await loadOCR();const w=await T.createWorker('deu+eng',1,{logger:m=>{if(m.status==='recognizing text'&&typeof m.progress==='number')setScanStatus(`Etikett wird gelesen … ${Math.round(m.progress*100)} %`)}});return w})();
    return workerPromise;
  }

  async function loadImage(file){
    const url=URL.createObjectURL(file);try{const img=new Image();await new Promise((res,rej)=>{img.onload=res;img.onerror=rej;img.src=url});return img}finally{setTimeout(()=>URL.revokeObjectURL(url),500)}
  }

  async function makeVariants(file){
    const img=await loadImage(file);
    const max=1800,scale=Math.min(1,max/Math.max(img.naturalWidth,img.naturalHeight));
    const w=Math.max(1,Math.round(img.naturalWidth*scale)),h=Math.max(1,Math.round(img.naturalHeight*scale));
    const base=document.createElement('canvas');base.width=w;base.height=h;const b=base.getContext('2d',{alpha:false});b.drawImage(img,0,0,w,h);
    const original=base.toDataURL('image/jpeg',.88);

    // enhanced grayscale/high-contrast version; helps curved/glossy labels on phones
    const enh=document.createElement('canvas');enh.width=w;enh.height=h;const x=enh.getContext('2d',{alpha:false});x.filter='grayscale(1) contrast(1.65) brightness(1.06)';x.drawImage(base,0,0,w,h);x.filter='none';
    const enhanced=enh.toDataURL('image/jpeg',.92);

    // center crop: labels are usually photographed in the middle
    const cw=Math.round(w*.88),ch=Math.round(h*.78),sx=Math.round((w-cw)/2),sy=Math.round((h-ch)/2);
    const crop=document.createElement('canvas');crop.width=cw;crop.height=ch;const c=crop.getContext('2d',{alpha:false});c.filter='grayscale(1) contrast(1.8) brightness(1.05)';c.drawImage(base,sx,sy,cw,ch,0,0,cw,ch);c.filter='none';
    return {preview:original,original,enhanced,crop:crop.toDataURL('image/jpeg',.94)};
  }

  async function detectBarcode(file){
    if(!('BarcodeDetector' in window))return '';
    try{const formats=['ean_13','ean_8','upc_a','upc_e','code_128','qr_code'];const detector=new BarcodeDetector({formats});const bitmap=await createImageBitmap(file);const codes=await detector.detect(bitmap);bitmap.close&&bitmap.close();return codes[0]?.rawValue||''}catch(_){return ''}
  }

  const rejectWords=/^(ingredients?|inhaltsstoffe?|anwendung|warning|achtung|hinweis|hersteller|vertrieb|kontakt|www\.|http|made in|barcode|batch|charge|lot|mindestens|haltbar|best before|gebrauchsanweisung|zusammensetzung)$/i;
  const units=/^\s*\d+[\s.,\d]*(ml|l|g|kg|mg|oz|fl\.?\s*oz|%)\s*$/i;
  function cleanLine(s){return String(s||'').replace(/[|_[\]{}<>]/g,' ').replace(/\s+/g,' ').trim()}
  function score(line,index){
    if(!line||line.length<3||line.length>62)return -99;if(rejectWords.test(line)||units.test(line))return -99;if(/^(\d[\d .,:;\/-]*)$/.test(line))return -99;if(/@|https?:|www\./i.test(line))return -60;
    const letters=(line.match(/[A-Za-zÀ-ÿ]/g)||[]).length;if(letters<3)return -50;
    let s=letters/Math.max(1,line.length)*5+Math.max(0,4-index*.35);
    if(/^[A-ZÀ-Ý0-9][A-Za-zÀ-ÿ0-9 '&+().-]+$/.test(line))s+=1.5;
    if(/creme|cream|salbe|ointment|lotion|spray|shampoo|gel|balsam|balm|pflege|care|haut|skin|derma|horse|equine/i.test(line))s+=3.4;
    if(line.length>=5&&line.length<=34)s+=1.8;
    const upper=(line.match(/[A-ZÀ-Ý]/g)||[]).length;if(upper>=3)s+=1;
    return s;
  }
  function candidatesFrom(texts){
    const all=[];
    texts.forEach(txt=>(txt||'').split(/\r?\n/).map(cleanLine).filter(Boolean).forEach((line,i)=>all.push({line,score:score(line,i)})));
    const best=new Map();
    all.filter(x=>x.score>-20).forEach(x=>{const key=x.line.toLowerCase().replace(/[^a-z0-9à-ÿ]+/g,' ');if(!best.has(key)||best.get(key).score<x.score)best.set(key,x)});
    const ranked=[...best.values()].sort((a,b)=>b.score-a.score).slice(0,10);
    // Combine first two strong lines, useful for BRAND + PRODUCT
    if(ranked.length>=2&&ranked[0].line.length+ranked[1].line.length<52){const combo=ranked[0].line+' '+ranked[1].line;ranked.unshift({line:combo,score:ranked[0].score+ranked[1].score+1})}
    const seen=new Set();return ranked.filter(x=>{const k=x.line.toLowerCase();if(seen.has(k))return false;seen.add(k);return true}).slice(0,6).map(x=>x.line)
  }
  function detectType(text){if(/creme|cream/i.test(text))return 'Creme';if(/salbe|ointment/i.test(text))return 'Salbe';if(/spray/i.test(text))return 'Spray';if(/shampoo/i.test(text))return 'Shampoo';if(/lotion/i.test(text))return 'Lotion';if(/\bgel\b/i.test(text))return 'Gel';return 'Andere'}

  function setScanStatus(text,kind='info'){const s=e('scanStatus');if(!s)return;s.className='scan-status '+kind;s.textContent=text}
  function renderCandidates(list){const box=e('scanCandidates');if(!box)return;if(!list?.length){box.innerHTML='';box.hidden=true;return}box.hidden=false;box.innerHTML=`<div class="sub" style="margin-bottom:6px">Welcher Name stimmt?</div><div class="candidate-list">${list.map((n,i)=>`<button type="button" class="candidate ${i===0?'best':''}" onclick="chooseScanCandidate('${encodeURIComponent(n)}')">${html(n)}</button>`).join('')}</div>`}
  window.chooseScanCandidate=function(v){const n=decodeURIComponent(v||'');if(e('tp'))e('tp').value=n;setScanStatus(`Ausgewählt: ${n}. Bitte kurz prüfen.`,'ok')};
  window.scanProduct=function(){const input=e('productScanInput');if(input){input.value='';input.click()}};

  window.handleProductScan=async function(input){
    const file=input?.files?.[0];if(!file)return;pendingScan=null;renderCandidates([]);
    const preview=e('productPreview');
    try{
      setScanStatus('Foto wird vorbereitet …');
      const variants=await makeVariants(file);if(preview){preview.src=variants.preview;preview.hidden=false}
      const barcodePromise=detectBarcode(file);
      const w=await getWorker();
      const texts=[];
      setScanStatus('Etikett wird gelesen …');
      await w.setParameters({tessedit_pageseg_mode:'6',preserve_interword_spaces:'1'});
      texts.push((await w.recognize(variants.enhanced)).data?.text||'');
      await w.setParameters({tessedit_pageseg_mode:'11'});
      texts.push((await w.recognize(variants.crop)).data?.text||'');
      const barcode=await barcodePromise;
      const candidates=candidatesFrom(texts);const joined=texts.join('\n');const type=detectType(joined);
      pendingScan={image:variants.preview,barcode,text:joined,candidates,type};
      if(e('tt'))e('tt').value=type;if(e('barcodeValue'))e('barcodeValue').value=barcode;
      renderCandidates(candidates);
      if(candidates[0]&&e('tp'))e('tp').value=candidates[0];
      if(candidates.length)setScanStatus(`${candidates.length} mögliche Produktnamen erkannt${barcode?' · EAN '+barcode:''}. Tippe unten auf den richtigen Namen.`,'ok');
      else setScanStatus(`Name nicht sicher erkannt${barcode?' · Barcode '+barcode:''}. Bitte Produktname manuell eintragen.`,'warn');
    }catch(err){console.error(err);setScanStatus('Die automatische Erkennung war nicht zuverlässig. Bitte Produktname manuell eintragen oder Foto erneut frontal ohne Spiegelung aufnehmen.','warn')}
  };

  function treatmentAreaOptions(){const areas=['Schopf','Mähnenkamm','Mähne','Hals','Brust','Rücken','Rumpf','Bauch','Bauchnaht','Kruppe','Schweifrübe','Schweif','Vorderbein','Hinterbein'];const selected=(typeof zone==='string'&&zone)||'Mähnenkamm';return areas.map(a=>`<option ${a===selected?'selected':''}>${a}</option>`).join('')}

  window.treatmentSheet=function(){
    openSheet('Behandlung hinzufügen',`
      <div class="field"><label>Bereich</label><select id="ta">${treatmentAreaOptions()}</select></div>
      <div class="scan-card">
        <div class="row between"><div><b>Produkt erkennen</b><div class="sub">Vorderseite möglichst frontal, nah und ohne Spiegelung fotografieren</div></div><button type="button" class="btn soft" onclick="scanProduct()">📷 Scannen</button></div>
        <input id="productScanInput" type="file" accept="image/*" capture="environment" hidden onchange="handleProductScan(this)">
        <img id="productPreview" class="product-preview" hidden alt="Produktfoto">
        <div id="scanStatus" class="scan-status">Tipp: Produktname sollte ungefähr die Hälfte des Fotos ausfüllen.</div>
        <div id="scanCandidates" hidden></div>
      </div>
      <div class="field"><label>Produktname *</label><input id="tp" autocomplete="off" placeholder="Erkannten Namen prüfen oder selbst eingeben"></div>
      <div class="split"><div class="field"><label>Produktart</label><select id="tt">${['Creme','Salbe','Lotion','Spray','Shampoo','Gel','Medikament','Andere'].map(x=>`<option>${x}</option>`).join('')}</select></div><div class="field"><label>Barcode / EAN</label><input id="barcodeValue" inputmode="numeric" placeholder="optional"></div></div>
      <div class="field"><label>Menge / Anwendung</label><input id="td" placeholder="z. B. dünn aufgetragen"></div>
      <div class="field"><label>Zuletzt verwendet</label>${recentProductHtml()}</div>
    `,'Behandlung speichern','saveTreatment()');
  };

  window.saveTreatment=function(){
    const product=e('tp')?.value.trim()||'';if(!product){note('Bitte Produktname eingeben');e('tp')?.focus();return}
    const h=activeHorse(),type=e('tt')?.value||'Andere',barcode=e('barcodeValue')?.value.trim()||pendingScan?.barcode||'',area=e('ta')?.value||'Mähnenkamm',dose=e('td')?.value.trim()||'';
    const d=new Date(),stamp=d.toLocaleDateString('de-DE',{day:'2-digit',month:'2-digit',year:'numeric'})+' '+d.toLocaleTimeString('de-DE',{hour:'2-digit',minute:'2-digit'});
    if(!h.treatments)h.treatments=[];h.treatments.unshift([stamp,area,product,dose,{type,barcode,scanned:!!pendingScan}]);
    if(!h.productLibrary)h.productLibrary=[];const key=(barcode||product).toLowerCase();const idx=h.productLibrary.findIndex(p=>((p.barcode||p.name)||'').toLowerCase()===key||p.name.toLowerCase()===product.toLowerCase());const item={name:product,type,barcode,lastUsed:new Date().toISOString()};if(idx>=0)h.productLibrary[idx]={...h.productLibrary[idx],...item};else h.productLibrary.push(item);
    save();pendingScan=null;closeSheet();note('Behandlung und Produkt gespeichert');render();
  };
})();