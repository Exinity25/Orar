(() => {
  'use strict';
  const scopes = ['openid','email','profile',
    'https://www.googleapis.com/auth/classroom.courses.readonly',
    'https://www.googleapis.com/auth/classroom.courseworkmaterials.readonly',
    'https://www.googleapis.com/auth/classroom.coursework.me.readonly',
    'https://www.googleapis.com/auth/classroom.announcements.readonly',
    'https://www.googleapis.com/auth/drive.readonly',
    'https://www.googleapis.com/auth/drive.appdata',
    'https://www.googleapis.com/auth/gmail.modify',
    'https://www.googleapis.com/auth/gmail.send'];
  const esc = (s='') => String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const safeURL = value => {try{const u=new URL(String(value||'').trim());return ['https:','http:','mailto:','tel:'].includes(u.protocol)?u.href:'';}catch{return '';}};
  const link = (url,title,cls='classroom-link') => {const safe=safeURL(url);return safe?`<a class="${cls}" href="${esc(safe)}" target="_blank" rel="noopener noreferrer">${esc(title)} ↗</a>`:'';};
  const linkifyText = value => String(value||'').split(/(https?:\/\/[^\s]+|www\.[^\s]+)/gi).map(part=>{
    if(!/^(https?:\/\/|www\.)/i.test(part))return esc(part);
    let clean=part,trailing='';while(/[),.;!?]$/.test(clean)){trailing=clean.slice(-1)+trailing;clean=clean.slice(0,-1);}
    const href=safeURL(/^www\./i.test(clean)?'https://'+clean:clean);
    return href?`<a class="classroom-inline-link" href="${esc(href)}" target="_blank" rel="noopener noreferrer">${esc(clean)}</a>${esc(trailing)}`:esc(part);
  }).join('');
  const previewable = title => /\.(pdf|docx?|xlsx?|xlsm|csv|pptx?|odt|ods|odp|rtf|pages|numbers|key|zip|rar|7z|jpe?g|png|gif|webp|bmp|svg|avif|heic|heif|txt|md|json|xml|log|html?|css|js|ts|py|java|c|cpp|h|mp3|m4a|aac|flac|wav|ogg|mp4|m4v|mov|webm)$/i.test(String(title||'').trim());
  const previewButton = file => {
    const title=String(file?.title||'Fișier');
    if(!file?.id)return '';
    return `<button class="classroom-link classroom-preview-link" type="button" data-cr-preview="${esc(file.id)}" data-cr-preview-title="${esc(title)}">${esc(title)} <span aria-hidden="true">▣</span></button>`;
  };
  let gisPromise,xlsxPromise,excelStylesPromise,pdfjsPromise,mammothPromise,purifyPromise;
  function loadScript(src,test,reset){
    if(test())return Promise.resolve();
    if(reset.value)return reset.value;
    reset.value=new Promise((resolve,reject)=>{
      const s=document.createElement('script');s.src=src;s.async=true;
      s.onload=()=>test()?resolve():reject(Error('Biblioteca de previzualizare nu s-a inițializat.'));
      s.onerror=()=>{reset.value=null;s.remove();reject(Error('Nu s-a putut încărca biblioteca de previzualizare.'));};document.head.append(s);
    });
    return reset.value;
  }
  function loadMammoth(){
    if(window.mammoth)return Promise.resolve(window.mammoth);
    const ref={get value(){return mammothPromise;},set value(v){mammothPromise=v;}};
    return loadScript('https://cdn.jsdelivr.net/npm/mammoth@1.8.0/mammoth.browser.min.js',()=>Boolean(window.mammoth),ref).then(()=>window.mammoth);
  }
  function loadPurify(){
    if(window.DOMPurify)return Promise.resolve(window.DOMPurify);
    const ref={get value(){return purifyPromise;},set value(v){purifyPromise=v;}};
    return loadScript('https://cdn.jsdelivr.net/npm/dompurify@3.1.7/dist/purify.min.js',()=>Boolean(window.DOMPurify),ref).then(()=>window.DOMPurify);
  }
  function loadPdfJs(){
    if(pdfjsPromise)return pdfjsPromise;
    pdfjsPromise=import('https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.min.mjs').then(pdfjs=>{
      pdfjs.GlobalWorkerOptions.workerSrc='https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.worker.min.mjs';
      return pdfjs;
    }).catch(err=>{pdfjsPromise=null;throw err;});
    return pdfjsPromise;
  }
  function loadXlsx(){
    if(window.XLSX)return Promise.resolve(window.XLSX);
    if(xlsxPromise)return xlsxPromise;
    xlsxPromise=new Promise((resolve,reject)=>{
      const s=document.createElement('script');s.src='https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';s.async=true;
      s.onload=()=>window.XLSX?resolve(window.XLSX):reject(Error('Nu s-a putut încărca viewerul Excel.'));
      s.onerror=()=>{xlsxPromise=null;s.remove();reject(Error('Nu s-a putut încărca viewerul Excel.'));};document.head.append(s);
    });return xlsxPromise;
  }
  function loadExcelStyles(){
    const ref={get value(){return excelStylesPromise;},set value(v){excelStylesPromise=v;}};
    return loadScript('https://cdn.jsdelivr.net/npm/exceljs@4.4.0/dist/exceljs.min.js',()=>Boolean(window.ExcelJS),ref).then(()=>window.ExcelJS);
  }
  function loadGoogle(){
    if(window.google?.accounts?.oauth2)return Promise.resolve();
    if(gisPromise)return gisPromise;
    gisPromise=new Promise((resolve,reject)=>{
      const s=document.createElement('script');s.src='https://accounts.google.com/gsi/client';s.async=true;
      s.onload=resolve;s.onerror=()=>{gisPromise=null;s.remove();reject(Error('Nu s-a putut încărca autentificarea Google. Verifică conexiunea și încearcă din nou.'));};document.head.append(s);
    });return gisPromise;
  }
  window.OrarClassroom={mount(root){
    const page=document.createElement('main');page.id='hubClassroomPage';page.className='hub-page hub-hidden';page.setAttribute('aria-labelledby','classroomHeading');root.append(page);
    const mailPage=document.createElement('main');mailPage.id='hubMailPage';mailPage.className='hub-page hub-hidden mail-page';mailPage.setAttribute('aria-labelledby','mailHeading');root.append(mailPage);
    const mailModal=document.createElement('dialog');mailModal.className='planner-dialog mail-dialog';root.append(mailModal);
    const profile=document.createElement('div');profile.className='classroom-profile hub-hidden';root.querySelector('.hub-drawer').append(profile);
    const viewer=document.createElement('div');viewer.className='classroom-viewer hub-hidden';viewer.setAttribute('role','dialog');viewer.setAttribute('aria-modal','true');viewer.setAttribute('aria-labelledby','classroomViewerTitle');
    viewer.innerHTML=`<div class="classroom-viewer-backdrop" data-cr-viewer-close></div><section class="classroom-viewer-dialog"><header class="classroom-viewer-header"><h2 id="classroomViewerTitle" data-cr-viewer-title>Fișier</h2><div class="classroom-viewer-actions"><button class="hub-small-button classroom-viewer-download" type="button" data-cr-viewer-download disabled aria-label="Descarcă fișierul">↓ Descarcă</button><a class="hub-small-button classroom-viewer-drive" data-cr-viewer-drive target="_blank" rel="noopener noreferrer">Deschide în Drive ↗</a><button class="hub-small-button classroom-viewer-close" type="button" data-cr-viewer-close aria-label="Închide previzualizarea">✕</button></div></header><div class="classroom-viewer-content" data-cr-viewer-content></div></section>`;root.append(viewer);
    const downloadButton=viewer.querySelector('[data-cr-viewer-download]');
    const downloadStatus=document.createElement('p');downloadStatus.className='classroom-download-status';downloadStatus.setAttribute('role','status');downloadStatus.hidden=true;viewer.querySelector('.classroom-viewer-header').append(downloadStatus);
    let viewerDownload=null;
    let viewerReturnFocus=null,viewerObjectUrl='',viewerGeneration=0,viewerZoom=1,viewerZoomTarget=null,viewerMinZoom=1;
    let pinchStartDistance=0,pinchStartZoom=1,pinchWorldX=0,pinchWorldY=0,pinchFrame=0;
    function sizeWorkbookStage(){
      if(!viewerZoomTarget?.classList.contains('classroom-excel-document'))return;
      const stage=viewerZoomTarget.parentElement;
      stage.style.width=Math.ceil(viewerZoomTarget.offsetWidth*viewerZoom)+'px';
      stage.style.height=Math.ceil(viewerZoomTarget.offsetHeight*viewerZoom)+'px';
    }
    function setViewerZoom(next,focusX=null,focusY=null){
      if(!viewerZoomTarget)return;
      const box=viewer.querySelector('[data-cr-viewer-content]'),oldZoom=viewerZoom;
      const nextZoom=Math.max(viewerMinZoom,Math.min(6,Number(next)||1));
      const rect=box.getBoundingClientRect();
      const localX=focusX==null?box.clientWidth/2:focusX-rect.left;
      const localY=focusY==null?box.clientHeight/2:focusY-rect.top;
      const worldX=(box.scrollLeft+localX)/Math.max(.001,oldZoom);
      const worldY=(box.scrollTop+localY)/Math.max(.001,oldZoom);
      viewerZoom=nextZoom;
      viewerZoomTarget.style.transform='scale('+viewerZoom+')';
      viewerZoomTarget.style.transformOrigin='0 0';
      viewerZoomTarget.style.setProperty('--viewer-zoom',String(viewerZoom));
      sizeWorkbookStage();
      box.scrollLeft=Math.max(0,worldX*viewerZoom-localX);
      box.scrollTop=Math.max(0,worldY*viewerZoom-localY);
    }
    function enableViewerZoom(target,minZoom=1,initialZoom=1){viewer.querySelector('[data-cr-viewer-content]').classList.add('has-local-zoom');viewerZoomTarget=target;viewerMinZoom=Math.max(.01,Math.min(1,Number(minZoom)||1));viewerZoom=Math.max(viewerMinZoom,Number(initialZoom)||1);target.classList.add('classroom-zoom-target');target.style.transform='scale('+viewerZoom+')';target.style.transformOrigin='0 0';target.style.setProperty('--viewer-zoom',String(viewerZoom));sizeWorkbookStage();}
    function enableFramePinch(frame){disableViewerZoom();}
    function disableViewerZoom(){viewer.querySelector('[data-cr-viewer-content]').classList.remove('has-local-zoom');if(pinchFrame)cancelAnimationFrame(pinchFrame);pinchFrame=0;viewerZoomTarget=null;viewerZoom=1;viewerMinZoom=1;pinchStartDistance=0;pinchWorldX=pinchWorldY=0;}
    function resetViewerContent(){
      disableViewerZoom();
      if(viewerDownload?.objectUrl)URL.revokeObjectURL(viewerDownload.objectUrl);
      viewerDownload=null;downloadButton.disabled=true;downloadButton.textContent='↓ Descarcă';downloadButton.title='Fișierul se încarcă';downloadStatus.hidden=true;downloadStatus.textContent='';
      viewer.querySelector('.classroom-image-zoom-controls')?.remove();
      if(viewerObjectUrl){URL.revokeObjectURL(viewerObjectUrl);viewerObjectUrl='';}
      viewer.querySelector('[data-cr-viewer-content]').replaceChildren();
    }
    downloadButton.addEventListener('click',async()=>{
      const file=viewerDownload,generation=viewerGeneration;if(!file)return;
      downloadButton.disabled=true;downloadStatus.hidden=true;
      try{
        if(!file.objectUrl){
          downloadButton.textContent='Se descarcă…';
          if(!token||Date.now()>=expires)throw Error('Sesiunea Google a expirat. Reconectează contul pentru descărcare.');
          const result=await fetch(file.url,{headers:{Authorization:'Bearer '+token},cache:'no-store',credentials:'omit'});
          if(!result.ok)throw Error(result.status===401?'Sesiunea Google a expirat. Reconectează contul.':'Google nu a permis descărcarea fișierului.');
          const blob=await result.blob();if(generation!==viewerGeneration||viewerDownload!==file)return;
          file.objectUrl=URL.createObjectURL(blob);
        }
        if(generation!==viewerGeneration||viewerDownload!==file)return;
        const anchor=document.createElement('a');anchor.href=file.objectUrl;anchor.download=file.name;anchor.hidden=true;
        viewer.append(anchor);anchor.click();anchor.remove();
      }catch(error){if(generation===viewerGeneration){downloadStatus.textContent=error.message||'Descărcarea nu a reușit. Încearcă din nou.';downloadStatus.hidden=false;}}
      finally{if(generation===viewerGeneration&&viewerDownload===file){downloadButton.disabled=false;downloadButton.textContent='↓ Descarcă';}}
    });
    function viewerMessage(text,kind='status'){
      const box=viewer.querySelector('[data-cr-viewer-content]');box.innerHTML=`<div class="classroom-viewer-message" role="${kind}">${esc(text)}</div>`;
    }
    function closeViewer(restore=true){
      if(viewer.classList.contains('hub-hidden'))return;
      viewerGeneration++;resetViewerContent();viewer.classList.add('hub-hidden');document.body.classList.remove('classroom-viewer-open');
      if(restore && viewerReturnFocus?.isConnected)viewerReturnFocus.focus({preventScroll:true});viewerReturnFocus=null;
    }
    async function openViewer(id,title){
      const fileId=String(id||'');if(!/^[A-Za-z0-9_-]+$/.test(fileId))return;
      const name=String(title||'Fișier'),generation=++viewerGeneration;
      viewerReturnFocus=document.activeElement instanceof HTMLElement?document.activeElement:null;resetViewerContent();
      viewer.querySelector('[data-cr-viewer-title]').textContent=name;
      viewer.querySelector('[data-cr-viewer-drive]').href='https://drive.google.com/file/d/'+encodeURIComponent(fileId)+'/view';
      viewer.classList.remove('hub-hidden');document.body.classList.add('classroom-viewer-open');viewerMessage('Se încarcă fișierul…');viewer.querySelector('.classroom-viewer-close').focus({preventScroll:true});
      if(!token || Date.now()>=expires){viewerMessage('Sesiunea Google a expirat. Închide viewerul și reconectează contul.','alert');return;}
      try{
        const driveScope='https://www.googleapis.com/auth/drive.readonly';
        if(grantedScopes && !grantedScopes.split(/\s+/).includes(driveScope))throw Error('Tokenul Google actual nu include permisiunea Drive read-only. Deconectează-te și conectează-te din nou; dacă Google nu îți oferă această permisiune, contul de facultate o poate bloca.');
        const base='https://www.googleapis.com/drive/v3/files/'+encodeURIComponent(fileId);
        const metadataResponse=await fetch(base+'?fields=id,name,mimeType,capabilities(canDownload),webViewLink',{headers:{Authorization:'Bearer '+token},cache:'no-store',credentials:'omit'});
        if(generation!==viewerGeneration)return;
        if(metadataResponse.status===401)throw Error('Sesiunea Google a expirat. Reconectează contul.');
        if(!metadataResponse.ok){
          let payload=null;try{payload=await metadataResponse.clone().json();}catch{}
          const reason=String(payload?.error?.errors?.[0]?.reason || payload?.error?.status || '');
          const server=String(payload?.error?.message||'');
          const hay=(reason+' '+server).toLowerCase();
          if(hay.includes('insufficient') || hay.includes('scope'))throw Error('Contul este conectat, dar tokenul nu are permisiunea Drive read-only. Deconectează-te și conectează-te din nou, apoi acceptă accesul la Google Drive.');
          if(hay.includes('accessnotconfigured') || hay.includes('api has not been used') || hay.includes('service disabled'))throw Error('Google Drive API nu este activ pentru proiectul OAuth. Activează Google Drive API în proiectul Orar-Classroom.');
          if(hay.includes('domainpolicy') || hay.includes('admin') || hay.includes('policy'))throw Error('Administratorul contului Google Workspace pare să blocheze accesul acestei aplicații la Drive. Este necesară aprobarea administratorului facultății.');
          throw Error('Google Drive a refuzat accesul la fișier'+(reason?' ('+reason+')':'')+'.');
        }
        const metadata=await metadataResponse.json();
        const driveName=String(metadata?.name||name||'Fișier').trim();
        viewer.querySelector('[data-cr-viewer-title]').textContent=driveName;
        const exactDriveLink=safeURL(metadata?.webViewLink||'');if(exactDriveLink)viewer.querySelector('[data-cr-viewer-drive]').href=exactDriveLink;
        const mime=String(metadata?.mimeType||'').split(';')[0].trim().toLowerCase();
        const googleNative=mime.startsWith('application/vnd.google-apps.');
        const officeDocument=/\.(docx?|xlsx?|xlsm|pptx?|odt|ods|odp|rtf|pages|numbers|key)$/i.test(driveName)
          || /(?:msword|officedocument|ms-excel|ms-powerpoint|opendocument|rtf)/i.test(mime);
        const archive=/\.(zip|rar|7z)$/i.test(driveName) || /(?:zip|rar|7z|compressed|archive)/i.test(mime);
        const localSupported=/\.(pdf|csv|jpe?g|png|gif|webp|bmp|svg|avif|txt|md|json|xml|log|html?|css|js|ts|py|java|c|cpp|h|mp3|m4a|aac|flac|wav|ogg|mp4|m4v|mov|webm)$/i.test(driveName);
        const nativeGoogleDoc=mime==='application/vnd.google-apps.document'||mime==='application/vnd.google-apps.spreadsheet'||mime==='application/vnd.google-apps.presentation';
        const officeMimeDownloadable=/application\/(?:vnd\.openxmlformats-officedocument\.(?:wordprocessingml\.document|spreadsheetml\.sheet)|vnd\.ms-(?:excel|word)|msword)/i.test(mime);
        const downloadableOffice=/\.(docx?|xlsx?|xlsm|csv)$/i.test(driveName)||officeMimeDownloadable;
        let renderName=driveName,renderMime=mime,response;
        const downloadAllowed=metadata?.capabilities?.canDownload!==false;
        downloadButton.title=downloadAllowed?'Descarcă fișierul':'Proprietarul a dezactivat descărcarea';
        if(downloadAllowed&&!googleNative)viewerDownload={name:driveName,url:base+'?alt=media',objectUrl:''};
        if(nativeGoogleDoc){
          if(!downloadAllowed)throw Error('Proprietarul a dezactivat exportul/descărcarea acestui fișier.');
          const target=mime==='application/vnd.google-apps.spreadsheet'
            ?{mime:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',ext:'.xlsx'}
            :mime==='application/vnd.google-apps.document'
              ?{mime:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',ext:'.docx'}
              :{mime:'application/pdf',ext:'.pdf'};
          renderMime=target.mime;
          renderName=/\.[a-z0-9]{2,6}$/i.test(driveName)?driveName.replace(/\.[a-z0-9]{2,6}$/i,target.ext):driveName+target.ext;
          viewerDownload={name:renderName,url:base+'/export?mimeType='+encodeURIComponent(target.mime),objectUrl:''};
          response=await fetch(base+'/export?mimeType='+encodeURIComponent(target.mime),{headers:{Authorization:'Bearer '+token},cache:'no-store',credentials:'omit'});
        }else{
          if((archive && !downloadableOffice) || (!localSupported && !downloadableOffice && !officeDocument)){
            const driveBox=viewer.querySelector('[data-cr-viewer-content]');
            const frame=document.createElement('iframe');frame.className='classroom-drive-office-preview';frame.title='Previzualizare '+driveName;
            frame.src='https://drive.google.com/file/d/'+encodeURIComponent(fileId)+'/preview';
            frame.setAttribute('allow','clipboard-read; clipboard-write; fullscreen');frame.setAttribute('allowfullscreen','');
            frame.setAttribute('referrerpolicy','no-referrer-when-downgrade');
            driveBox.replaceChildren(frame);disableViewerZoom();downloadButton.disabled=!viewerDownload;return;
          }
          if(metadata?.capabilities?.canDownload===false)throw Error('Fișierul poate fi văzut în Google Drive, dar proprietarul sau organizația a dezactivat descărcarea. Din acest motiv nu poate fi afișat local în site.');
          response=await fetch(base+'?alt=media',{headers:{Authorization:'Bearer '+token},cache:'no-store',credentials:'omit'});
        }
        if(generation!==viewerGeneration)return;
        if(response.status===401)throw Error('Sesiunea Google a expirat. Reconectează contul.');
        if(!response.ok){
          let payload=null;try{payload=await response.clone().json();}catch{}
          const reason=String(payload?.error?.errors?.[0]?.reason || payload?.error?.status || '');
          const server=String(payload?.error?.message||'');
          const hay=(reason+' '+server).toLowerCase();
          if(hay.includes('download') || hay.includes('cannotdownload') || hay.includes('export'))throw Error('Google nu permite exportul/descărcarea acestui fișier pentru contul curent.');
          if(hay.includes('insufficient') || hay.includes('scope'))throw Error('Tokenul Google nu are permisiunea Drive read-only. Deconectează-te și conectează-te din nou.');
          throw Error('Fișierul nu a putut fi încărcat din Google Drive'+(reason?' ('+reason+')':'')+'.');
        }
        // Reuse the authorized original bytes for preview and local download.
        const fileBlob=await response.blob();if(generation!==viewerGeneration)return;
        if(viewerDownload){viewerDownload.objectUrl=URL.createObjectURL(fileBlob);downloadButton.disabled=false;}
        response=new Response(fileBlob,{headers:response.headers});
        if(/\.pdf$/i.test(renderName)||renderMime==='application/pdf'){
          const data=await response.arrayBuffer();if(generation!==viewerGeneration)return;
          const pdfjs=await loadPdfJs();if(generation!==viewerGeneration)return;
          const pdf=await pdfjs.getDocument({data:new Uint8Array(data)}).promise;if(generation!==viewerGeneration)return;
          const box=viewer.querySelector('[data-cr-viewer-content]'),pages=document.createElement('div');pages.className='classroom-pdf-pages';
          box.replaceChildren(pages);
          for(let pageNo=1;pageNo<=pdf.numPages;pageNo++){
            if(generation!==viewerGeneration)return;
            const page=await pdf.getPage(pageNo),base=page.getViewport({scale:1});
            const available=Math.max(280,Math.min(1100,box.clientWidth||window.innerWidth)-24);
            const scale=Math.min(2,available/base.width),viewport=page.getViewport({scale});
            const wrap=document.createElement('div');wrap.className='classroom-pdf-page';
            const canvas=document.createElement('canvas'),dpr=Math.max(1,window.devicePixelRatio||1);
            const android=/Android/i.test(navigator.userAgent);
            const preferredRatio=Math.min(android?6:5,Math.max(android?3.75:3,dpr*(android?1.5:1.3))),maxPixels=android?32000000:26000000;
            const safeRatio=Math.sqrt(maxPixels/Math.max(1,viewport.width*viewport.height));
            const ratio=Math.max(1,Math.min(preferredRatio,safeRatio));
            canvas.width=Math.max(1,Math.floor(viewport.width*ratio));canvas.height=Math.max(1,Math.floor(viewport.height*ratio));
            canvas.style.width=viewport.width+'px';canvas.style.height=viewport.height+'px';
            wrap.append(canvas);pages.append(wrap);
            const ctx=canvas.getContext('2d',{alpha:false,desynchronized:false});
            if(ctx){ctx.imageSmoothingEnabled=true;if('imageSmoothingQuality' in ctx)ctx.imageSmoothingQuality='high';}
            await page.render({canvasContext:ctx,viewport,transform:ratio===1?null:[ratio,0,0,ratio,0,0],intent:'display'}).promise;
            const links=document.createElement('div');links.className='classroom-pdf-links';links.style.width=viewport.width+'px';links.style.height=viewport.height+'px';
            const seenLinks=new Set();
            const addPdfLink=(href,left,top,width,height,label='Deschide linkul din PDF')=>{
              if(!href)return;
              const key=[href,Math.round(left),Math.round(top),Math.round(width),Math.round(height)].join('|');if(seenLinks.has(key))return;seenLinks.add(key);
              const a=document.createElement('a');a.className='classroom-pdf-link';a.href=href;a.style.left=Math.max(0,left)+'px';a.style.top=Math.max(0,top)+'px';a.style.width=Math.max(14,width)+'px';a.style.height=Math.max(14,height)+'px';a.setAttribute('aria-label',label);
              a.target='_blank';a.rel='noopener noreferrer';
              a.addEventListener('click',e=>{
                e.stopPropagation();
                if(href.startsWith('#pdf-page-')){e.preventDefault();const target=pages.querySelector(href);if(target)target.scrollIntoView({behavior:'smooth',block:'start'});}
              });
              links.append(a);
            };
            const annotations=await page.getAnnotations({intent:'display'});
            for(const annotation of annotations||[]){
              if(annotation.subtype!=='Link' || !annotation.rect)continue;
              const rawUrl=annotation.url||annotation.unsafeUrl||'';
              let href=safeURL(rawUrl);
              if(!href && annotation.dest){
                try{
                  const dest=typeof annotation.dest==='string'?await pdf.getDestination(annotation.dest):annotation.dest;
                  if(dest?.[0]!=null){
                    const ref=dest[0],index=typeof ref==='object'?await pdf.getPageIndex(ref):Math.max(0,Number(ref)||0);
                    href='#pdf-page-'+(index+1);
                  }
                }catch{}
              }
              if(!href)continue;
              const rect=viewport.convertToViewportRectangle(annotation.rect),left=Math.min(rect[0],rect[2]),top=Math.min(rect[1],rect[3]),width=Math.abs(rect[0]-rect[2]),height=Math.abs(rect[1]-rect[3]);
              addPdfLink(href,left,top,width,height);
            }
            // Some PDFs visually contain URLs but do not encode them as Link annotations.
            // Detect URL text runs too and place real clickable hit areas over them.
            try{
              const textContent=await page.getTextContent();
              const urlRe=/(https?:\/\/[^\s<>"')\]]+|www\.[^\s<>"')\]]+)/gi;
              for(const item of textContent.items||[]){
                const str=String(item.str||'');if(!str)continue;
                let match;urlRe.lastIndex=0;
                while((match=urlRe.exec(str))){
                  let raw=match[0].replace(/[.,;!?]+$/,'');
                  const href=safeURL(/^www\./i.test(raw)?'https://'+raw:raw);if(!href)continue;
                  const tx=pdfjs.Util.transform(viewport.transform,item.transform),fontH=Math.max(10,Math.hypot(tx[2],tx[3]));
                  const fullW=Math.max(fontH,Math.abs(Number(item.width)||0)*viewport.scale),ratioStart=match.index/Math.max(1,str.length),ratioWidth=raw.length/Math.max(1,str.length);
                  addPdfLink(href,tx[4]+fullW*ratioStart,tx[5]-fontH,Math.max(18,fullW*ratioWidth),fontH*1.2,'Deschide '+raw);
                }
              }
            }catch{}
            if(links.childElementCount)wrap.append(links);
            wrap.id='pdf-page-'+pageNo;
          }
          enableViewerZoom(pages);return;
        }
        if(/\.(xlsx?|xlsm|csv)$/i.test(renderName)||/(?:spreadsheetml\.sheet|ms-excel)/i.test(renderMime)){
          const data=await response.arrayBuffer();if(generation!==viewerGeneration)return;
          const XLSX=await loadXlsx();if(generation!==viewerGeneration)return;
          const workbook=XLSX.read(data,{type:'array',cellStyles:true,cellDates:true,cellNF:true,cellFormula:true,cellHTML:true}),box=viewer.querySelector('[data-cr-viewer-content]');
          // SheetJS supplies values and number formats; ExcelJS preserves the XLSX styles.
          let styledWorkbook=null,styleWarning='';
          if(new Uint8Array(data)[0]===0x50 && new Uint8Array(data)[1]===0x4b){
            try{
              const ExcelJS=await loadExcelStyles();if(generation!==viewerGeneration)return;
              styledWorkbook=new ExcelJS.Workbook();await styledWorkbook.xlsx.load(data);
            }catch{styledWorkbook=null;styleWarning='Formatarea originală nu a putut fi încărcată. Sunt afișate datele foii.';}
            if(generation!==viewerGeneration)return;
          }
          if(!workbook.SheetNames.length)throw Error('Fișierul Excel nu conține foi care pot fi afișate.');
          const renderSheet=sheetName=>{
            disableViewerZoom();
            const styledSheet=styledWorkbook?.getWorksheet(sheetName);
            const sheet=workbook.Sheets[sheetName],ref=sheet?.['!ref'];
            const range=XLSX.utils.decode_range(ref||'A1'),maxRows=2500,maxCols=120,endRow=Math.min(range.e.r,range.s.r+2499),endCol=Math.min(range.e.c,range.s.c+119);
            const indexedColors=['000000','FFFFFF','FF0000','00FF00','0000FF','FFFF00','FF00FF','00FFFF','000000','FFFFFF','FF0000','00FF00','0000FF','FFFF00','FF00FF','00FFFF','800000','008000','000080','808000','800080','008080','C0C0C0','808080'];
            const normalizeColor=raw=>{
              let value=String(raw||'').replace(/^#/,'').trim();
              if(/^[0-9a-f]{8}$/i.test(value))value=value.slice(-6);
              return /^[0-9a-f]{6}$/i.test(value)?'#'+value:'';
            };
            const themeOrder=['lt1','dk1','lt2','dk2','accent1','accent2','accent3','accent4','accent5','accent6','hlink','folHlink'];
            const themeColor=index=>{
              const scheme=workbook?.Themes?.themeElements?.clrScheme;
              const node=scheme?.[themeOrder[index]] ?? scheme?.[index];
              if(typeof node==='string')return normalizeColor(node);
              return normalizeColor(node?.rgb || node?.val || node?.lastClr || node?.srgbClr?.val || node?.sysClr?.lastClr || node?.color);
            };
            const tintColor=(hex,tint)=>{
              if(!hex || !Number.isFinite(tint) || tint===0)return hex;
              const rgb=hex.slice(1).match(/../g).map(part=>parseInt(part,16));
              const mixed=rgb.map(channel=>Math.max(0,Math.min(255,Math.round(tint<0?channel*(1+tint):channel+(255-channel)*tint))));
              return '#'+mixed.map(channel=>channel.toString(16).padStart(2,'0')).join('');
            };
            const excelColor=value=>{
              if(!value)return '';
              if(typeof value==='string')return normalizeColor(value);
              let color=normalizeColor(value.argb||value.rgb);
              if(!color && Number.isInteger(value.indexed))color=normalizeColor(indexedColors[value.indexed]||'');
              if(!color && value.theme!==undefined)color=themeColor(Number(value.theme));
              const tint=Number(value.tint);
              return color && Number.isFinite(tint) && tint!==0?tintColor(color,tint):color;
            };
            const resolvedStyle=cell=>{
              const direct=cell?.s;
              if(direct && typeof direct==='object')return direct;
              if(!Number.isInteger(direct))return null;
              const styles=workbook?.Styles,xf=styles?.CellXf?.[direct];
              if(!xf)return null;
              return {...xf,font:styles?.Fonts?.[xf.fontId],fill:styles?.Fills?.[xf.fillId],border:styles?.Borders?.[xf.borderId],alignment:xf.alignment};
            };
            const borderCss=side=>{
              if(!side?.style)return '';
              const color=excelColor(side.color)||'#9ca3af';
              const widths={medium:2,thick:3,double:3};
              const kinds={dotted:'dotted',dashed:'dashed',dashDot:'dashed',dashDotDot:'dashed',double:'double'};
              return (widths[side.style]||1)+'px '+(kinds[side.style]||'solid')+' '+color;
            };
            const applyCellStyle=(td,cell,original)=>{
              const style=original?.style||resolvedStyle(cell);
              if(style){
                const fill=(style.fill?.pattern||style.fill?.patternType)==='none'?'':excelColor(style.fill?.fgColor)||excelColor(style.fill?.bgColor);if(fill)td.style.backgroundColor=fill;
                const font=style.font||{},fontColor=excelColor(font.color);if(fontColor)td.style.color=fontColor;
                if(font.bold)td.style.fontWeight='700';
                if(font.italic)td.style.fontStyle='italic';
                if(font.underline)td.style.textDecoration='underline';
                if(font.strike)td.style.textDecoration=(td.style.textDecoration?td.style.textDecoration+' ':'')+'line-through';
                if(Number(font.size||font.sz)>0)td.style.fontSize=Math.max(1,Math.min(256,Number(font.size||font.sz)*4/3))+'px';
                if(font.name)td.style.fontFamily=String(font.name)+', system-ui, sans-serif';
                const horizontal=style.alignment?.horizontal;
                if(['left','center','right','justify'].includes(horizontal))td.style.textAlign=horizontal;
                const vertical=style.alignment?.vertical;
                if(['top','center','bottom'].includes(vertical))td.style.verticalAlign=vertical==='center'?'middle':vertical;
                if(style.alignment?.wrapText){td.style.whiteSpace='normal';td.style.overflow='visible';td.style.textOverflow='clip';}
                if(Number(style.alignment?.indent)>0)td.style.paddingLeft=(8+Number(style.alignment.indent)*10)+'px';
                const border=style.border,top=borderCss(border?.top),right=borderCss(border?.right),bottom=borderCss(border?.bottom),left=borderCss(border?.left);
                if(top)td.style.borderTop=top;if(right)td.style.borderRight=right;if(bottom)td.style.borderBottom=bottom;if(left)td.style.borderLeft=left;
              }
              if(cell?.t==='n' && !td.style.textAlign)td.style.textAlign='right';
              if(cell?.t==='b' && !td.style.textAlign)td.style.textAlign='center';
            };
            const starts=new Map(),skip=new Set();
            (sheet['!merges']||[]).forEach(m=>{
              if(m.s.r>=range.s.r&&m.s.r<=endRow&&m.s.c>=range.s.c&&m.s.c<=endCol)starts.set(m.s.r+':'+m.s.c,{rowspan:Math.min(m.e.r,endRow)-m.s.r+1,colspan:Math.min(m.e.c,endCol)-m.s.c+1});
              for(let r=Math.max(m.s.r,range.s.r);r<=Math.min(m.e.r,endRow);r++)for(let col=Math.max(m.s.c,range.s.c);col<=Math.min(m.e.c,endCol);col++)if(r!==m.s.r||col!==m.s.c)skip.add(r+':'+col);
            });
            const table=document.createElement('table');table.className='classroom-excel-table classroom-excel-document';table.setAttribute('aria-label',sheetName);
            const cg=document.createElement('colgroup'),columnWidths=[];let tableWidth=0;
            for(let col=range.s.c;col<=endCol;col++){
              const meta=sheet['!cols']?.[col],original=styledSheet?.getColumn(col+1),ce=document.createElement('col');let width=Number(meta?.wpx)||0;
              if(original?.hidden||meta?.hidden){columnWidths[col]=0;ce.style.display='none';cg.append(ce);continue;}
              if(Number(original?.width)>0)width=Math.floor(Number(original.width)*7+5);
              if(!width&&Number(meta?.wch)>0)width=Math.round(Number(meta.wch)*8+18);
              if(!width&&Number(meta?.width)>0)width=Math.round(Number(meta.width)*8+18);
              if(!width){let longest=8;for(let r=range.s.r;r<=Math.min(endRow,range.s.r+80);r++){const cell=sheet[XLSX.utils.encode_cell({r,c:col})];if(cell)longest=Math.max(longest,Math.min(28,String(cell.w??XLSX.utils.format_cell(cell)??'').length));}width=longest*8+20;}
              width=Math.max(1,width);columnWidths[col]=width;tableWidth+=width;ce.style.width=width+'px';cg.append(ce);
            }
            table.append(cg);
            table.style.width=tableWidth+'px';
            const tbody=document.createElement('tbody');
            for(let r=range.s.r;r<=endRow;r++){
              const tr=document.createElement('tr'),rowMeta=sheet['!rows']?.[r],originalRow=styledSheet?.getRow(r+1);
              if(originalRow?.hidden||rowMeta?.hidden)tr.style.display='none';
              const rowHeight=Number(originalRow?.height||styledSheet?.properties.defaultRowHeight||rowMeta?.hpt)*4/3||Number(rowMeta?.hpx)||20;
              tr.style.height=Math.max(1,rowHeight)+'px';
              for(let col=range.s.c;col<=endCol;col++){
                const key=r+':'+col;if(skip.has(key))continue;
                const td=document.createElement('td'),merge=starts.get(key),cell=sheet[XLSX.utils.encode_cell({r,c:col})];
                if(merge){td.rowSpan=merge.rowspan;td.colSpan=merge.colspan;td.classList.add('is-merged');}
                const value=cell?String(cell.w??XLSX.utils.format_cell(cell)??''):'';
                if(safeURL(cell?.l?.Target)){const link=document.createElement('a');link.href=safeURL(cell.l.Target);link.target='_blank';link.rel='noopener noreferrer';link.textContent=value;td.append(link);}else td.textContent=value;
                if(styledSheet?.getColumn(col+1).hidden||sheet['!cols']?.[col]?.hidden)td.style.display='none';
                applyCellStyle(td,cell,originalRow?.getCell(col+1));
                // Excel lets unwrapped text extend into adjacent empty cells.
                // Keep the original column widths and stop before any occupied/merged cell.
                if(value&&!merge&&cell?.t==='s'&&td.style.whiteSpace!=='normal'&&(!td.style.textAlign||td.style.textAlign==='left')){
                  let textWidth=columnWidths[col]||0;
                  for(let next=col+1;next<=endCol;next++){
                    const nextKey=r+':'+next,nextCell=sheet[XLSX.utils.encode_cell({r,c:next})];
                    if(starts.has(nextKey)||skip.has(nextKey)||nextCell?.f||(nextCell?.v!=null&&String(nextCell.v)!==''))break;
                    textWidth+=columnWidths[next]||0;
                  }
                  if(textWidth>(columnWidths[col]||0)){
                    const text=document.createElement('span');text.className='classroom-excel-overflow-text';text.style.width=Math.max(0,textWidth-4)+'px';
                    while(td.firstChild)text.append(td.firstChild);td.append(text);td.classList.add('has-overflow-text');
                  }
                }
                if(cell?.f)td.title='='+cell.f;tr.append(td);
              }
              tbody.append(tr);
            }
            table.append(tbody);
            const wrap=document.createElement('div');wrap.className='classroom-workbook-stage';wrap.append(table);
            const fragment=document.createDocumentFragment();
            if(workbook.SheetNames.length>1){const select=document.createElement('select');select.className='classroom-sheet-select';select.setAttribute('aria-label','Alege foaia Excel');workbook.SheetNames.forEach(n=>{const o=document.createElement('option');o.value=n;o.textContent=n;o.selected=n===sheetName;select.append(o);});select.addEventListener('change',()=>renderSheet(select.value));fragment.append(select);}
            if(ref)fragment.append(wrap);else{const empty=document.createElement('p');empty.className='classroom-viewer-message';empty.textContent='Foaia este goală.';fragment.append(empty);}
            if(range.e.r>endRow||range.e.c>endCol){const note=document.createElement('p');note.className='classroom-viewer-limit';note.textContent='Fișier mare: sunt afișate maximum '+maxRows+' rânduri și '+maxCols+' coloane.';fragment.append(note);}if(styleWarning){const note=document.createElement('p');note.className='classroom-viewer-limit';note.textContent=styleWarning;fragment.prepend(note);}
            box.replaceChildren(fragment);
            if(!ref){box.scrollLeft=0;box.scrollTop=0;return;}
            const fit=Math.min(1,Math.max(1,box.clientWidth-24)/Math.max(1,table.offsetWidth));
            enableViewerZoom(table,Math.min(.1,fit),fit);box.scrollLeft=0;box.scrollTop=0;
          };
          renderSheet(workbook.SheetNames[0]);return;
        }
        if(/\.docx?$/i.test(renderName)||/(?:wordprocessingml\.document|msword)/i.test(renderMime)){
          const data=await response.arrayBuffer();if(generation!==viewerGeneration)return;
          const [mammoth,purify]=await Promise.all([loadMammoth(),loadPurify()]);if(generation!==viewerGeneration)return;
          const result=await mammoth.convertToHtml({arrayBuffer:data},{
            convertImage:mammoth.images.imgElement(async image=>({src:'data:'+image.contentType+';base64,'+await image.read('base64')}))
          });
          if(generation!==viewerGeneration)return;
          const doc=document.createElement('article');doc.className='classroom-docx-document';
          doc.innerHTML=purify.sanitize(result.value,{USE_PROFILES:{html:true}});
          doc.querySelectorAll('a[href]').forEach(a=>{const href=safeURL(a.getAttribute('href'));if(href){a.href=href;a.target='_blank';a.rel='noopener noreferrer';}else a.removeAttribute('href');});
          const walker=document.createTreeWalker(doc,NodeFilter.SHOW_TEXT);
          const textNodes=[];while(walker.nextNode())if(!walker.currentNode.parentElement?.closest('a,script,style'))textNodes.push(walker.currentNode);
          textNodes.forEach(node=>{
            const value=node.nodeValue||'',re=/(https?:\/\/[^\s<>"']+|www\.[^\s<>"']+)/gi;if(!re.test(value))return;re.lastIndex=0;
            const frag=document.createDocumentFragment();let last=0,match;
            while((match=re.exec(value))){frag.append(document.createTextNode(value.slice(last,match.index)));const raw=match[0],href=safeURL(/^www\./i.test(raw)?'https://'+raw:raw);if(href){const a=document.createElement('a');a.href=href;a.target='_blank';a.rel='noopener noreferrer';a.textContent=raw;frag.append(a);}else frag.append(document.createTextNode(raw));last=match.index+raw.length;}
            frag.append(document.createTextNode(value.slice(last)));node.replaceWith(frag);
          });
          const box=viewer.querySelector('[data-cr-viewer-content]');box.replaceChildren(doc);enableViewerZoom(doc);return;
        }
        if(/\.(jpe?g|png|gif|webp|bmp|svg|avif|heic|heif)$/i.test(renderName)||renderMime.startsWith('image/')){
          const blob=await response.blob();if(generation!==viewerGeneration)return;
          viewerObjectUrl=URL.createObjectURL(blob);
          const stage=document.createElement('div');stage.className='classroom-image-stage';
          const img=document.createElement('img');img.className='classroom-image-preview';img.alt=name;img.src=viewerObjectUrl;img.draggable=false;
          stage.append(img);const box=viewer.querySelector('[data-cr-viewer-content]');box.replaceChildren(stage);
          try{await img.decode();}catch{}
          if(generation!==viewerGeneration)return;
          const stageStyle=getComputedStyle(stage);
          const paddingX=parseFloat(stageStyle.paddingLeft)+parseFloat(stageStyle.paddingRight),paddingY=parseFloat(stageStyle.paddingTop)+parseFloat(stageStyle.paddingBottom);
          const availableW=Math.max(1,box.clientWidth-paddingX),availableH=Math.max(1,box.clientHeight-paddingY);
          const naturalW=Math.max(1,img.naturalWidth||availableW),naturalH=Math.max(1,img.naturalHeight||availableH);
          const fit=Math.min(1,availableW/naturalW,availableH/naturalH),fitW=Math.max(1,Math.round(naturalW*fit)),fitH=Math.max(1,Math.round(naturalH*fit));
          img.style.width=fitW+'px';img.style.height=fitH+'px';img.style.maxWidth='none';img.style.maxHeight='none';
          stage.style.width=box.clientWidth+'px';stage.style.minWidth=box.clientWidth+'px';stage.style.minHeight=box.clientHeight+'px';
          enableViewerZoom(stage,1,1);
          const zoomControls=document.createElement('div');zoomControls.className='classroom-image-zoom-controls';
          for(const [label,text,zoom] of [['Micșorează','−',()=>viewerZoom/1.5],['Potrivește imaginea','100%',()=>1],['Mărește','+',()=>viewerZoom*1.5]]){
            const button=document.createElement('button');button.type='button';button.className='hub-small-button';button.textContent=text;button.setAttribute('aria-label',label);
            button.addEventListener('click',()=>setViewerZoom(zoom()));zoomControls.append(button);
          }
          viewer.querySelector('.classroom-viewer-actions').prepend(zoomControls);
          const cancelImageTap=e=>{e.preventDefault();e.stopPropagation();};
          img.addEventListener('click',cancelImageTap,{capture:true});
          img.addEventListener('dblclick',cancelImageTap,{capture:true});
          return;
        }
        if(/\.(txt|md|json|xml|log|html?|css|js|ts|py|java|c|cpp|h)$/i.test(name)){
          const text=await response.text();if(generation!==viewerGeneration)return;
          const pre=document.createElement('pre');pre.className='classroom-text-preview';
          const re=/(https?:\/\/[^\s<>"']+|www\.[^\s<>"']+)/gi;let last=0,match;
          while((match=re.exec(text))){pre.append(document.createTextNode(text.slice(last,match.index)));const raw=match[0],href=safeURL(/^www\./i.test(raw)?'https://'+raw:raw);if(href){const a=document.createElement('a');a.href=href;a.target='_blank';a.rel='noopener noreferrer';a.textContent=raw;pre.append(a);}else pre.append(document.createTextNode(raw));last=match.index+raw.length;}
          pre.append(document.createTextNode(text.slice(last)));
          viewer.querySelector('[data-cr-viewer-content]').replaceChildren(pre);disableViewerZoom();return;
        }
        if(/\.(mp3|m4a|aac|flac|wav|ogg)$/i.test(name)){
          const blob=await response.blob();if(generation!==viewerGeneration)return;
          viewerObjectUrl=URL.createObjectURL(blob);
          const wrap=document.createElement('div');wrap.className='classroom-media-stage';
          const audio=document.createElement('audio');audio.controls=true;audio.preload='metadata';audio.src=viewerObjectUrl;wrap.append(audio);
          viewer.querySelector('[data-cr-viewer-content]').replaceChildren(wrap);disableViewerZoom();return;
        }
        if(/\.(mp4|m4v|mov|webm)$/i.test(name)){
          const blob=await response.blob();if(generation!==viewerGeneration)return;
          viewerObjectUrl=URL.createObjectURL(blob);
          const wrap=document.createElement('div');wrap.className='classroom-media-stage';
          const video=document.createElement('video');video.controls=true;video.playsInline=true;video.preload='metadata';video.src=viewerObjectUrl;wrap.append(video);
          viewer.querySelector('[data-cr-viewer-content]').replaceChildren(wrap);disableViewerZoom();return;
        }
        throw Error('Acest tip de fișier nu are încă viewer local.');
      }catch(error){if(generation===viewerGeneration)viewerMessage(error?.message||'Nu am putut afișa fișierul.','alert');}
    }
    viewer.addEventListener('click',e=>{
      if(e.target.closest('[data-cr-viewer-close]')){closeViewer();return;}
    });
    const viewerContent=viewer.querySelector('[data-cr-viewer-content]');
    const touchDistance=touches=>Math.hypot(touches[0].clientX-touches[1].clientX,touches[0].clientY-touches[1].clientY);
    const touchCenter=touches=>({x:(touches[0].clientX+touches[1].clientX)/2,y:(touches[0].clientY+touches[1].clientY)/2});
    viewerContent.addEventListener('touchstart',e=>{
      if(!viewerZoomTarget||e.touches.length!==2)return;
      e.preventDefault();
      if(pinchFrame)cancelAnimationFrame(pinchFrame);
      pinchStartDistance=Math.max(1,touchDistance(e.touches));pinchStartZoom=viewerZoom;
      const center=touchCenter(e.touches),rect=viewerContent.getBoundingClientRect();
      pinchWorldX=(viewerContent.scrollLeft+center.x-rect.left)/viewerZoom;
      pinchWorldY=(viewerContent.scrollTop+center.y-rect.top)/viewerZoom;
    },{passive:false});
    viewerContent.addEventListener('touchmove',e=>{
      if(!viewerZoomTarget||e.touches.length!==2||!pinchStartDistance)return;
      e.preventDefault();
      const distance=touchDistance(e.touches),center=touchCenter(e.touches),nextZoom=Math.max(viewerMinZoom,Math.min(6,pinchStartZoom*(distance/pinchStartDistance)));
      if(pinchFrame)cancelAnimationFrame(pinchFrame);
      pinchFrame=requestAnimationFrame(()=>{
        pinchFrame=0;if(!viewerZoomTarget)return;
        const rect=viewerContent.getBoundingClientRect(),localX=center.x-rect.left,localY=center.y-rect.top;
        viewerZoom=nextZoom;viewerZoomTarget.style.transform='scale('+viewerZoom+')';viewerZoomTarget.style.transformOrigin='0 0';viewerZoomTarget.style.setProperty('--viewer-zoom',String(viewerZoom));
        sizeWorkbookStage();
        viewerContent.scrollLeft=Math.max(0,pinchWorldX*viewerZoom-localX);
        viewerContent.scrollTop=Math.max(0,pinchWorldY*viewerZoom-localY);
      });
    },{passive:false});
    viewerContent.addEventListener('touchend',e=>{if(e.touches.length<2){pinchStartDistance=0;if(pinchFrame){cancelAnimationFrame(pinchFrame);pinchFrame=0;}}},{passive:true});
    viewerContent.addEventListener('touchcancel',()=>{pinchStartDistance=0;if(pinchFrame){cancelAnimationFrame(pinchFrame);pinchFrame=0;}},{passive:true});
    ['gesturestart','gesturechange','gestureend'].forEach(type=>viewerContent.addEventListener(type,e=>{
      if(viewerZoomTarget?.classList?.contains('classroom-image-stage'))e.preventDefault();
    },{passive:false}));
    viewerContent.addEventListener('dblclick',e=>{if(e.target.closest('.classroom-image-preview,.classroom-image-stage'))e.preventDefault();},{passive:false});
    viewer.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();closeViewer();}});
    const SESSION_KEY='orar_classroom_session_v2',OLD_SESSION_KEY='orar_classroom_session_v1';
    const ACCOUNT_KEY='orar_classroom_account_v1';
    let token='',expires=0,grantedScopes='',client=null,courses=[],posts=[],selected=null,loading=false,message='',warning='',generation=0,session=0,expireTimer,visible=false,reauthenticating=false;
    let mailItems=[],mailLoading=false,mailMessage='',mailOpen=null,mailBody='',mailUnread=0,mailVisible=false,mailNext='';
    let courseToggleMotion=0;
    const configured=()=>/^[\w.-]+\.apps\.googleusercontent\.com$/.test(window.ORAR_CLASSROOM_CLIENT_ID||'');
    function rememberedAccount(){try{const value=JSON.parse(localStorage.getItem(ACCOUNT_KEY)||'null');return value&&value.email?value:null;}catch{return null;}}
    function renderProfile(account,connected=Boolean(token&&Date.now()<expires)){
      profile.classList.remove('is-open');
      if(!account?.email){
        const disabled=!configured()||!client||reauthenticating;
        profile.innerHTML=`<button class="classroom-profile-summary classroom-profile-signin" type="button" data-cr-profile-signin ${disabled?'disabled':''}><span class="classroom-profile-avatar classroom-profile-google" aria-hidden="true">G</span><span class="classroom-profile-copy"><strong>${reauthenticating?'Se conectează…':'Conectează contul Google'}</strong><span>Classroom · Drive · Mail</span></span><span class="classroom-profile-signin-arrow" aria-hidden="true">→</span></button>`;
        profile.classList.remove('hub-hidden');return;
      }
      const picture=safeURL(account.picture||'');
      profile.innerHTML=`<button class="classroom-profile-summary" type="button" data-cr-profile-toggle aria-expanded="false">${picture?`<img src="${esc(picture)}" alt="" referrerpolicy="no-referrer">`:'<span class="classroom-profile-avatar" aria-hidden="true">G</span>'}<span class="classroom-profile-copy"><strong>${esc(account.name||'Cont Google')}</strong><span>${esc(account.email)}</span></span><span class="classroom-profile-chevron" aria-hidden="true">›</span></button><div class="classroom-profile-menu"><div class="classroom-profile-details"><strong>${connected?'Cont Google conectat':'Sesiunea Google trebuie reînnoită'}</strong><span>${esc(account.email)}</span></div>${!connected?`<button class="hub-small-button classroom-profile-reconnect" type="button" data-cr-profile-signin ${!client||reauthenticating?'disabled':''}>${reauthenticating?'Se reconectează…':'Reconectează contul'}</button>`:''}<button class="hub-small-button classroom-profile-logout" type="button" data-cr-logout>Deconectează</button></div>`;
      profile.classList.remove('hub-hidden');
    }
    function saveSession(){try{localStorage.setItem(SESSION_KEY,JSON.stringify({token,expires,grantedScopes}));}catch{}}
    const CLOUD_FILE='orar-sync.json';
    const CLOUD_SKIP=new Set(['orar_google_session_v1','orar_cloud_pending_v1']);
    const cloudKeys=()=>Object.keys(localStorage).filter(key=>!CLOUD_SKIP.has(key));
    let cloudFileId='',cloudTimer=0,cloudApplying=false,cloudUploading=false;
    const PENDING_KEY='orar_cloud_pending_v1';
    const pendingCloud=()=>{try{return JSON.parse(localStorage.getItem(PENDING_KEY)||'{}');}catch{return {};}};
    function acknowledgeCloud(sent){const pending=pendingCloud();for(const key of Object.keys(sent))if(pending[key]===sent[key])delete pending[key];localStorage.setItem(PENDING_KEY,JSON.stringify(pending));if(Object.keys(pending).length)scheduleCloudUpload();}

    const cloudPayload=()=>{const values={};for(const key of cloudKeys()){const value=localStorage.getItem(key);if(value!==null)values[key]=value;}return {version:2,updatedAt:Date.now(),values};};
    async function findCloudFile(){
      if(cloudFileId)return cloudFileId;
      const q=encodeURIComponent("name='"+CLOUD_FILE+"' and 'appDataFolder' in parents and trashed=false");
      const r=await fetch('https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q='+q+'&fields=files(id,name,modifiedTime)&orderBy=modifiedTime%20desc&pageSize=10',{headers:{Authorization:'Bearer '+token},cache:'no-store'});
      if(!r.ok)throw Error('Drive appData indisponibil.');
      const files=(await r.json()).files||[];
      cloudFileId=files[0]?.id||'';
      if(files.length>1){
        Promise.allSettled(files.slice(1).map(file=>fetch('https://www.googleapis.com/drive/v3/files/'+encodeURIComponent(file.id),{method:'DELETE',headers:{Authorization:'Bearer '+token}}))).catch(()=>{});
      }
      return cloudFileId;
    }
    async function uploadCloud(){
      if(cloudApplying||!token||Date.now()>=expires||!grantedScopes.includes('drive.appdata'))return;
      if(cloudUploading)return;cloudUploading=true;
      try{
      const sent=pendingCloud(),payload=cloudPayload(),id=await findCloudFile();
      if(id){const previous=await fetch('https://www.googleapis.com/drive/v3/files/'+encodeURIComponent(id)+'?alt=media',{headers:{Authorization:'Bearer '+token},cache:'no-store'});if(!previous.ok)throw Error('Nu s-a putut verifica backup-ul existent.');const remote=await previous.json();for(const [key,value] of Object.entries(remote.values||{}))if(!sent[key]&&typeof value==='string'&&!Object.prototype.hasOwnProperty.call(payload.values,key))payload.values[key]=value;}
      const body=JSON.stringify(payload);
      if(id){const r=await fetch('https://www.googleapis.com/upload/drive/v3/files/'+encodeURIComponent(id)+'?uploadType=media',{method:'PATCH',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body});if(!r.ok)throw Error('Nu s-a putut sincroniza orarul.');acknowledgeCloud(sent);return;}
      const boundary='orar_sync_boundary',meta=JSON.stringify({name:CLOUD_FILE,parents:['appDataFolder']});
      const multipart='--'+boundary+'\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n'+meta+'\r\n--'+boundary+'\r\nContent-Type: application/json\r\n\r\n'+body+'\r\n--'+boundary+'--';
      const r=await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'multipart/related; boundary='+boundary},body:multipart});
      if(!r.ok)throw Error('Nu s-a putut crea backup-ul orarului.');cloudFileId=(await r.json()).id||'';acknowledgeCloud(sent);
      }finally{cloudUploading=false;}
    }
    function scheduleCloudUpload(){clearTimeout(cloudTimer);cloudTimer=setTimeout(()=>uploadCloud().catch(()=>{}),450);}
    async function restoreCloud(){
      if(!token||Date.now()>=expires||!grantedScopes.includes('drive.appdata'))return false;
      if(Object.keys(pendingCloud()).length)await uploadCloud();
      const id=await findCloudFile();if(!id){await uploadCloud();return;}
      const r=await fetch('https://www.googleapis.com/drive/v3/files/'+encodeURIComponent(id)+'?alt=media',{headers:{Authorization:'Bearer '+token},cache:'no-store'});if(!r.ok)return;
      const remote=await r.json();if(!remote?.values)return;
      cloudApplying=true;let changed=false,needsBackfill=false;
      for(const key of new Set([...cloudKeys(),...Object.keys(remote.values||{})])){
        if(pendingCloud()[key])continue;
        const hasRemote=Object.prototype.hasOwnProperty.call(remote.values,key),local=localStorage.getItem(key);
        if(hasRemote){
          const value=String(remote.values[key]);
          if(local!==value){localStorage.setItem(key,value);changed=true;}
        }else if(local!==null)needsBackfill=true;
      }
      cloudApplying=false;
      if(changed){location.reload();return true;}
      if(needsBackfill)scheduleCloudUpload();
      return false;
    }
    window.addEventListener('orar-local-change',event=>{const key=event.detail?.key;if(cloudApplying||!key||CLOUD_SKIP.has(key))return;try{const pending=pendingCloud();pending[key]=Date.now()+':'+Math.random();localStorage.setItem(PENDING_KEY,JSON.stringify(pending));}catch{}scheduleCloudUpload();});
    window.addEventListener('orar-cloud-sync-request',async()=>{
      try{
        if(!token||Date.now()>=expires||!grantedScopes.includes('drive.appdata')){
          window.dispatchEvent(new CustomEvent('orar-cloud-sync-result',{detail:{ok:false,message:'Conectează contul Google din Classroom pentru Cloud sync.'}}));
          return;
        }
        const changed=await restoreCloud();
        if(!changed)window.dispatchEvent(new CustomEvent('orar-cloud-sync-result',{detail:{ok:true,message:'Datele sunt sincronizate cu cloud-ul.'}}));
      }catch{
        window.dispatchEvent(new CustomEvent('orar-cloud-sync-result',{detail:{ok:false,message:'Sincronizarea cu cloud-ul nu a reușit.'}}));
      }
    });
    function forgetSession(){try{localStorage.removeItem(SESSION_KEY);}catch{}}
    function restoreSession(){
      try{localStorage.removeItem(OLD_SESSION_KEY);const saved=JSON.parse(localStorage.getItem(SESSION_KEY)||'null');if(saved?.token && Number(saved.expires)>Date.now()+5000){token=saved.token;expires=Number(saved.expires);grantedScopes=String(saved.grantedScopes||'');return true;}forgetSession();}catch{forgetSession();}
      return false;
    }
    function scheduleExpiry(){clearTimeout(expireTimer);if(token&&expires>Date.now())expireTimer=setTimeout(()=>clearSession('Sesiunea Google trebuie reînnoită.',false),Math.max(0,expires-Date.now()));}
    function clearSession(text='',forgetAccount=false){
      closeViewer(false);generation++;session++;clearTimeout(expireTimer);token='';expires=0;grantedScopes='';forgetSession();courses=[];posts=[];selected=null;loading=false;message=text;warning='';reauthenticating=false;mailItems=[];mailOpen=null;mailBody='';mailUnread=0;mailMessage='';window.dispatchEvent(new CustomEvent('orar-mail-unread',{detail:{count:0}}));
      if(forgetAccount){try{localStorage.removeItem(ACCOUNT_KEY);}catch{}}
      renderProfile(rememberedAccount(),false);
      render();renderMail();
    }
    function logout(){const old=token;clearSession('',true);if(old && window.google?.accounts?.oauth2)window.google.accounts.oauth2.revoke(old,()=>{});}
    profile.addEventListener('click',e=>{
      const signIn=e.target.closest('[data-cr-profile-signin]');
      if(signIn){if(client && !signIn.disabled)requestAccess(Boolean(rememberedAccount()));return;}
      const toggle=e.target.closest('[data-cr-profile-toggle]');
      if(toggle){const open=profile.classList.toggle('is-open');toggle.setAttribute('aria-expanded',String(open));return;}
      if(e.target.closest('[data-cr-logout]'))logout();
    });
    async function api(url){
      if(!token || Date.now()>=expires){clearSession('Sesiunea Google trebuie reînnoită.',false);throw Error('Sesiunea Google trebuie reînnoită.');}
      const response=await fetch(url,{headers:{Authorization:'Bearer '+token},cache:'no-store',credentials:'omit'});
      if(response.status===401){clearSession('Sesiunea Google trebuie reînnoită.',false);throw Error('Sesiunea Google trebuie reînnoită.');}
      if(!response.ok){
        let payload=null;try{payload=await response.clone().json();}catch{}
        const reason=payload?.error?.errors?.[0]?.reason || payload?.error?.status || '';
        const serverMessage=payload?.error?.message || '';
        const error=Error(response.status===403?'Google nu a permis accesul la această secțiune.':'Nu am putut încărca datele din Classroom.');
        error.status=response.status;error.googleReason=String(reason);error.googleMessage=String(serverMessage);throw error;
      }
      return response.json();
    }

    const mailScopeOk=()=>Boolean(token&&Date.now()<expires&&grantedScopes.includes('gmail.modify')&&grantedScopes.includes('gmail.send'));
    async function gmailApi(path,options={}){
      if(!token||Date.now()>=expires)throw Error('Sesiunea Google trebuie reînnoită.');
      const response=await fetch('https://gmail.googleapis.com/gmail/v1/users/me/'+path,{...options,headers:{Authorization:'Bearer '+token,...(options.headers||{})},cache:'no-store',credentials:'omit'});
      if(response.status===401){clearSession('Sesiunea Google trebuie reînnoită.',false);throw Error('Sesiunea Google trebuie reînnoită.');}
      if(!response.ok){let payload=null;try{payload=await response.clone().json();}catch{}const reason=String(payload?.error?.errors?.[0]?.reason||payload?.error?.status||''),msg=String(payload?.error?.message||''),hay=(reason+' '+msg).toLowerCase();if(hay.includes('accessnotconfigured')||hay.includes('api has not been used')||hay.includes('service disabled'))throw Error('Gmail API nu este activată pentru proiectul Google al aplicației.');if(hay.includes('insufficient')||hay.includes('scope'))throw Error('Reconectează contul Google și acceptă permisiunile pentru Mail.');throw Error(msg||'Gmail nu a putut fi accesat.');}
      if(response.status===204)return null;return response.json();
    }
    const mailHeader=(row,name)=>row?.payload?.headers?.find(h=>String(h.name).toLowerCase()===name.toLowerCase())?.value||'';
    function decodeMailData(data=''){try{const normalized=String(data).replace(/-/g,'+').replace(/_/g,'/'),pad='='.repeat((4-normalized.length%4)%4),binary=atob(normalized+pad),bytes=Uint8Array.from(binary,c=>c.charCodeAt(0));return new TextDecoder().decode(bytes);}catch{return '';}}
    function mailPlain(payload){if(!payload)return '';const parts=payload.parts||[],plain=parts.find(p=>p.mimeType==='text/plain'&&p.body?.data);if(plain)return decodeMailData(plain.body.data);for(const part of parts){const nested=mailPlain(part);if(nested)return nested;}if(payload.mimeType==='text/plain'&&payload.body?.data)return decodeMailData(payload.body.data);if(payload.mimeType==='text/html'&&payload.body?.data){const doc=new DOMParser().parseFromString(decodeMailData(payload.body.data),'text/html');return doc.body?.textContent||'';}return '';}
    function encodeMailRaw(text){const bytes=new TextEncoder().encode(text);let binary='';for(const b of bytes)binary+=String.fromCharCode(b);return btoa(binary).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');}
    async function refreshMailSummary(){if(!mailScopeOk())return;try{const label=await gmailApi('labels/INBOX');mailUnread=Number(label?.messagesUnread)||0;window.dispatchEvent(new CustomEvent('orar-mail-unread',{detail:{count:mailUnread}}));}catch{}}
    async function loadMailBatch(append=false){
      if(!mailScopeOk())return;
      mailLoading=true;mailMessage='';renderMail();
      try{const suffix=append&&mailNext?'&pageToken='+encodeURIComponent(mailNext):'',list=await gmailApi('messages?labelIds=INBOX&maxResults=50'+suffix),ids=(list?.messages||[]).map(x=>x.id),rows=await Promise.all(ids.map(async id=>{const q=new URLSearchParams({format:'metadata'});for(const h of ['Subject','From','Date'])q.append('metadataHeaders',h);return gmailApi('messages/'+encodeURIComponent(id)+'?'+q.toString());})),nextRows=rows.map(row=>({id:row.id,subject:mailHeader(row,'Subject')||'(fără subiect)',from:mailHeader(row,'From')||'Expeditor necunoscut',date:mailHeader(row,'Date'),snippet:row.snippet||'',unread:(row.labelIds||[]).includes('UNREAD')}));mailItems=append?[...mailItems,...nextRows.filter(row=>!mailItems.some(old=>old.id===row.id))]:nextRows;mailNext=String(list?.nextPageToken||'');await refreshMailSummary();}catch(e){mailMessage=e.message||'Nu am putut încărca mail-urile.';}finally{mailLoading=false;renderMail();}
    }
    async function refreshMail(){
      if(!mailScopeOk()){mailLoading=false;mailItems=[];mailNext='';mailMessage='Pentru Mail, reconectează contul Google și acceptă accesul Gmail.';renderMail();return;}
      mailNext='';await loadMailBatch(false);
    }
    async function openMail(id){if(!mailScopeOk())return;mailLoading=true;renderMail();try{const row=await gmailApi('messages/'+encodeURIComponent(id)+'?format=full');mailOpen={id:row.id,subject:mailHeader(row,'Subject')||'(fără subiect)',from:mailHeader(row,'From')||'',date:mailHeader(row,'Date')||''};mailBody=mailPlain(row.payload)||row.snippet||'(Mesaj fără conținut text.)';if((row.labelIds||[]).includes('UNREAD')){await gmailApi('messages/'+encodeURIComponent(id)+'/modify',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({removeLabelIds:['UNREAD']})});const item=mailItems.find(x=>x.id===id);if(item)item.unread=false;await refreshMailSummary();}}catch(e){mailMessage=e.message||'Mesajul nu a putut fi deschis.';}finally{mailLoading=false;renderMail();}}
    function renderMail(){
      const connected=Boolean(token&&Date.now()<expires),gmail=mailScopeOk(),account=rememberedAccount();let body='';
      if(!connected)body='<div class="classroom-welcome"><h2>Conectează contul Google</h2><p>Mail folosește același cont conectat pentru Classroom și Drive.</p><button class="hub-primary" data-mail-connect>Conectează contul Google</button></div>';
      else if(!gmail)body='<div class="classroom-welcome"><h2>Activează Mail</h2><p>Este necesar acces Gmail pentru a vedea inboxul și a trimite mesaje de pe '+esc(account?.email||'contul conectat')+'.</p><button class="hub-primary" data-mail-connect>Activează accesul Mail</button></div>';
      else if(mailOpen)body='<section class="mail-detail"><button class="hub-small-button" data-mail-back>← Inbox</button><article class="mail-message"><span class="hub-eyebrow">MESAJ</span><h2>'+esc(mailOpen.subject)+'</h2><div class="mail-meta"><strong>'+esc(mailOpen.from)+'</strong><span>'+esc(mailOpen.date)+'</span></div><pre>'+esc(mailBody)+'</pre></article></section>';
      else{const rows=mailItems.map(m=>'<button class="mail-card '+(m.unread?'is-unread':'')+'" type="button" data-mail-open="'+esc(m.id)+'"><span class="mail-sender">'+esc(m.from)+'</span><strong>'+esc(m.subject)+'</strong><span class="mail-snippet">'+esc(m.snippet)+'</span><time>'+esc(m.date)+'</time></button>').join('');body='<div class="mail-toolbar"><button class="hub-primary" data-mail-compose>Scrie mail</button><button class="hub-small-button" data-mail-refresh '+(mailLoading?'disabled':'')+'>'+(mailLoading?'Se actualizează…':'Actualizează')+'</button></div>'+(mailMessage?'<p class="classroom-notice" role="alert">'+esc(mailMessage)+'</p>':'')+'<div class="mail-list">'+(rows||(mailLoading?'':'<p class="hub-empty">Inboxul este gol.</p>'))+'</div>'+(mailNext?'<button class="hub-small-button mail-more" data-mail-more '+(mailLoading?'disabled':'')+'>Încarcă mai multe</button>':'');}
      mailPage.innerHTML='<div class="hub-content"><header class="hub-page-header"><h1 class="hub-heading" id="mailHeading" tabindex="-1">Mail</h1><p class="hub-intro">Inbox și trimitere de mesaje direct din contul Google conectat.</p></header>'+body+'</div>';
    }
    function composeMail(){mailModal.innerHTML='<div class="pl-dialog-head"><h2>Mail nou</h2><button type="button" data-mail-close aria-label="Închide">✕</button></div><form data-mail-form><label>Către<input name="to" type="email" required autocomplete="email"></label><label>Subiect<input name="subject" maxlength="300"></label><label>Mesaj<textarea name="body" rows="10" required maxlength="50000"></textarea></label><button class="hub-primary">Trimite</button></form>';if(!mailModal.open)mailModal.showModal();}
    mailPage.addEventListener('click',e=>{if(e.target.closest('[data-mail-connect]')){requestAccess(Boolean(rememberedAccount()));return;}if(e.target.closest('[data-mail-refresh]')){refreshMail();return;}if(e.target.closest('[data-mail-more]')){loadMailBatch(true);return;}if(e.target.closest('[data-mail-compose]')){composeMail();return;}if(e.target.closest('[data-mail-back]')){mailOpen=null;mailBody='';renderMail();return;}const open=e.target.closest('[data-mail-open]');if(open)openMail(open.dataset.mailOpen);});
    mailModal.addEventListener('click',e=>{if(e.target.closest('[data-mail-close]'))mailModal.close();});
    mailModal.addEventListener('submit',async e=>{const form=e.target.closest('[data-mail-form]');if(!form)return;e.preventDefault();const fd=new FormData(form),to=String(fd.get('to')||'').trim(),subject=String(fd.get('subject')||'').trim(),body=String(fd.get('body')||'');if(!to||!body)return;const raw=['To: '+to,'Subject: '+subject,'Content-Type: text/plain; charset="UTF-8"','MIME-Version: 1.0','',body].join('\r\n'),button=form.querySelector('button');button.disabled=true;button.textContent='Se trimite…';try{await gmailApi('messages/send',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({raw:encodeMailRaw(raw)})});mailModal.close();mailMessage='Mail trimis.';renderMail();}catch(err){mailMessage=err.message||'Mailul nu a putut fi trimis.';mailModal.close();renderMail();}});
    async function listAll(path,field,currentGeneration){
      const items=[];let next='';
      do{
        if(currentGeneration!==generation)throw Error('CANCELLED');
        const u=new URL('https://classroom.googleapis.com/v1/'+path);u.searchParams.set('pageSize','100');if(next)u.searchParams.set('pageToken',next);
        const data=await api(u.href);if(currentGeneration!==generation)throw Error('CANCELLED');items.push(...(data[field]||[]));next=data.nextPageToken||'';
      }while(next);
      return items;
    }
    async function loadCourses(){
      const g=++generation;selected=null;posts=[];loading=true;message='';warning='';render();
      try{const result=await listAll('courses','courses',g);if(g!==generation)return;courses=result.filter(c=>!['DECLINED','SUSPENDED'].includes(c.courseState));window.dispatchEvent(new CustomEvent('orar-classroom-authenticated'));}
      catch(e){if(g===generation)message=e.message;}
      finally{if(g===generation){loading=false;render();}}
    }
    function findCourseCard(id){
      const target=String(id);
      return Array.from(page.querySelectorAll('[data-cr-course-card]')).find(card=>card.dataset.crCourseCard===target)||null;
    }
    const reduceCourseMotion=()=>Boolean(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    function animateCourseOpen(id,fromHeight,motion){
      const card=findCourseCard(id),panel=card?.querySelector('.classroom-course-panel');
      if(!card || !panel || !fromHeight || reduceCourseMotion() || !card.animate)return;
      const targetHeight=Math.max(fromHeight,card.scrollHeight);
      card.style.height=fromHeight+'px';card.style.overflow='hidden';card.style.willChange='height';
      panel.style.animation='none';panel.style.opacity='0';panel.style.transform='translateY(-6px)';panel.style.willChange='opacity, transform';
      requestAnimationFrame(()=>requestAnimationFrame(async()=>{
        if(motion!==courseToggleMotion || !card.isConnected)return;
        const animations=[
          card.animate([{height:fromHeight+'px'},{height:targetHeight+'px'}],{duration:220,easing:'cubic-bezier(.22,.75,.2,1)',fill:'forwards'}),
          panel.animate([{opacity:0,transform:'translateY(-6px)'},{opacity:1,transform:'translateY(0)'}],{duration:180,easing:'ease-out',fill:'forwards'})
        ];
        await Promise.allSettled(animations.map(animation=>animation.finished));
        if(motion!==courseToggleMotion || !card.isConnected)return;
        animations.forEach(animation=>animation.cancel());
        card.style.height='';card.style.overflow='';card.style.willChange='';
        panel.style.animation='';panel.style.opacity='';panel.style.transform='';panel.style.willChange='';
      }));
    }
    async function closeCourse(id){
      const card=findCourseCard(id),motion=++courseToggleMotion;
      if(!card || reduceCourseMotion() || !card.animate){generation++;selected=null;posts=[];loading=false;warning='';message='';render();return;}
      const panel=card.querySelector('.classroom-course-panel'),summary=card.querySelector('.classroom-course-summary');
      const fromHeight=card.getBoundingClientRect().height,style=getComputedStyle(card);
      const targetHeight=(summary?.getBoundingClientRect().height||0)+(parseFloat(style.borderTopWidth)||0)+(parseFloat(style.borderBottomWidth)||0);
      card.style.height=fromHeight+'px';card.style.overflow='hidden';card.style.willChange='height';
      if(panel){panel.style.animation='none';panel.style.willChange='opacity, transform';}
      const animations=[card.animate([{height:fromHeight+'px'},{height:targetHeight+'px'}],{duration:190,easing:'cubic-bezier(.22,.75,.2,1)',fill:'forwards'})];
      if(panel)animations.push(panel.animate([{opacity:1,transform:'translateY(0)'},{opacity:0,transform:'translateY(-5px)'}],{duration:145,easing:'ease-out',fill:'forwards'}));
      await Promise.allSettled(animations.map(animation=>animation.finished));
      if(motion!==courseToggleMotion)return;
      animations.forEach(animation=>animation.cancel());
      generation++;selected=null;posts=[];loading=false;warning='';message='';render();
    }
    async function loadCourse(id){
      const course=courses.find(c=>c.id===id);if(!course)return;
      const wasOpen=Boolean(selected?.id===id),fromHeight=wasOpen?0:(findCourseCard(id)?.getBoundingClientRect().height||0),motion=++courseToggleMotion;
      selected=course;posts=[];loading=true;message='';warning='';const g=++generation;render();
      if(!wasOpen)animateCourseOpen(id,fromHeight,motion);
      const definitions=[['courseWorkMaterials','courseWorkMaterial','Material','Materiale'],['courseWork','courseWork','Temă','Teme'],['announcements','announcements','Anunț','Anunțuri']];
      const results=await Promise.allSettled(definitions.map(async([endpoint,field,kind,label])=>({label,items:(await listAll('courses/'+encodeURIComponent(id)+'/'+endpoint,field,g)).map(item=>({...item,kind}))})));
      if(g!==generation)return;
      const successful=results.filter(r=>r.status==='fulfilled');posts=successful.flatMap(r=>r.value.items).sort((a,b)=>(b.updateTime||b.creationTime||'').localeCompare(a.updateTime||a.creationTime||''));
      const failed=results.map((r,i)=>({result:r,label:definitions[i][3]})).filter(x=>x.result.status==='rejected');
      if(failed.length){
        const names=failed.map(x=>x.label).join(', '),reasons=[...new Set(failed.map(x=>x.result.reason?.googleReason||'').filter(Boolean))];
        const detail=reasons.length?' ('+reasons.join(', ')+')':'';
        warning='Nu s-au putut încărca: '+names+detail+'. Restul datelor clasei sunt afișate normal.';
      }
      loading=false;render();
    }
    function attachments(post){
      return (post.materials||[]).map(m=>{
        if(m.driveFile?.driveFile){const f=m.driveFile.driveFile;return previewButton(f) || link(f.alternateLink || (f.id?'https://drive.google.com/file/d/'+encodeURIComponent(f.id)+'/view':''),f.title||'Fișier Google Drive');}
        if(m.link)return link(m.link.url,m.link.title||m.link.url||'Deschide linkul');
        if(m.youtubeVideo)return link(m.youtubeVideo.alternateLink || (m.youtubeVideo.id?'https://www.youtube.com/watch?v='+encodeURIComponent(m.youtubeVideo.id):''),m.youtubeVideo.title||'Video');
        if(m.form)return link(m.form.formUrl,m.form.title||'Formular');
        return '';
      }).join('');
    }
    function postsMarkup(){
      if(loading)return '<p class="classroom-notice classroom-panel-notice" role="status">Se încarcă materialele…</p>';
      const notice=warning?`<p class="classroom-notice classroom-panel-notice" role="alert">${esc(warning)}</p>`:'';
      const body=posts.map(post=>`<article class="classroom-post"><span class="classroom-kind">${esc(post.kind)}</span><h3>${esc(post.title|| (post.kind==='Anunț'?'Anunț':'Material'))}</h3>${post.description||post.text?`<p>${linkifyText(post.description||post.text)}</p>`:''}<div class="classroom-attachments">${attachments(post)}</div><div class="classroom-post-classroom-link">${link(post.alternateLink,'Deschide în Classroom')}</div></article>`).join('');
      return notice+(body||(!warning?'<p class="hub-empty">Nu sunt materiale publicate în această clasă.</p>':''));
    }
    function courseMarkup(course){
      const open=Boolean(selected && selected.id===course.id);
      return `<section class="classroom-course ${open?'is-open':''}" data-cr-course-card="${esc(course.id)}">
        <button class="classroom-course-summary" type="button" data-cr-course="${esc(course.id)}" aria-expanded="${open?'true':'false'}">
          <span class="classroom-course-copy"><strong>${esc(course.name)}</strong><span>${esc(course.section||course.descriptionHeading||'')}${course.courseState==='ARCHIVED'?' · Arhivată':''}</span></span>
          <span class="classroom-course-chevron" aria-hidden="true">›</span>
        </button>
        ${open?`<div class="classroom-course-panel"><div class="classroom-course-panel-head">${link(course.alternateLink,'Deschide clasa în Classroom')}</div><div class="classroom-posts">${postsMarkup()}</div></div>`:''}
      </section>`;
    }
    function render(){
      const signed=Boolean(token && Date.now()<expires),remembered=rememberedAccount();
      page.innerHTML=`<div class="hub-content"><header class="hub-page-header"><h1 class="hub-heading" id="classroomHeading" tabindex="-1">Classroom</h1><p class="hub-intro">Clasele și materialele tale, într-un singur loc.</p></header>
        <div class="classroom-actions">${signed?'<button class="hub-small-button" data-cr-refresh>Actualizează</button>':`<button class="hub-primary" data-cr-signin ${!configured()||!client||reauthenticating?'disabled':''}>${reauthenticating?'Se reconectează…':remembered?'Continuă cu contul Google':'Conectează contul Google'}</button>`}${link('https://classroom.google.com/','Deschide Google Classroom')}</div>
        ${message?`<p class="classroom-notice" role="alert">${esc(message)}</p>`:''}
        ${!configured()?'<div class="classroom-welcome"><h2>Conectarea Google nu este activată încă</h2><p>După activare, aici vei vedea clasele și materialele contului tău.</p></div>':!signed?'<div class="classroom-welcome"><h2>Materialele tale, aproape</h2><p>Conectează-te pentru a vedea clasele, documentele și materialele publicate. Nimic nu va fi modificat în Classroom.</p></div>':''}
        ${signed?`<div class="classroom-courses">${courses.map(courseMarkup).join('')||(!loading?'<p class="hub-empty">Nu există clase vizibile pentru acest cont.</p>':'')}${loading&&!selected?'<p class="classroom-notice" role="status">Se încarcă clasele…</p>':''}</div>`:''}</div>`;
    }
    async function prepareSignIn(){
      if(!configured() || client)return;
      try{
        await loadGoogle();
        client=window.google.accounts.oauth2.initTokenClient({client_id:window.ORAR_CLASSROOM_CLIENT_ID,scope:scopes.join(' '),include_granted_scopes:true,
          callback:async response=>{
            if(response.error || !response.access_token){reauthenticating=false;message='Conectarea nu a fost finalizată. Poți încerca din nou.';renderProfile(rememberedAccount(),false);render();return;}
            reauthenticating=false;token=response.access_token;expires=Date.now()+Number(response.expires_in||3600)*1000;grantedScopes=String(response.scope||'');saveSession();scheduleExpiry();const authSession=++session;
            loadCourses();
            try{const user=await api('https://openidconnect.googleapis.com/v1/userinfo');if(authSession!==session || !token)return;
              const account={name:user.name||'Cont Google',email:user.email||'',picture:safeURL(user.picture)||''};
              if(account.email){try{localStorage.setItem(ACCOUNT_KEY,JSON.stringify(account));}catch{}renderProfile(account,true);} restoreCloud().catch(()=>{});if(mailScopeOk()){refreshMailSummary();if(mailVisible)refreshMail();}else if(mailVisible)renderMail();
            }catch{renderProfile(rememberedAccount(),true);}
          },error_callback:()=>{reauthenticating=false;message='Reconectarea Google nu a putut fi făcută automat. Apasă din nou pe conectare.';renderProfile(rememberedAccount(),false);render();}});
        renderProfile(rememberedAccount(),Boolean(token&&Date.now()<expires));
        render();
      }catch(e){message=e.message;renderProfile(rememberedAccount(),Boolean(token&&Date.now()<expires));render();}
    }
    function requestAccess(preferRemembered=false){
      if(!client || reauthenticating)return;
      const remembered=rememberedAccount();reauthenticating=true;message='';renderProfile(remembered,Boolean(token&&Date.now()<expires));render();
      const options=preferRemembered&&remembered?{prompt:'',login_hint:remembered.email}:{prompt:'select_account'};
      try{client.requestAccessToken(options);}catch{reauthenticating=false;renderProfile(rememberedAccount(),false);render();}
    }
    page.addEventListener('click',e=>{
      const preview=e.target.closest('[data-cr-preview]');if(preview){openViewer(preview.dataset.crPreview,preview.dataset.crPreviewTitle);return;}
      if(e.target.closest('[data-cr-signin]') && client)requestAccess(Boolean(rememberedAccount()));
      if(e.target.closest('[data-cr-refresh]'))selected?loadCourse(selected.id):loadCourses();
      const course=e.target.closest('[data-cr-course]');if(course){
        if(selected?.id===course.dataset.crCourse)closeCourse(course.dataset.crCourse);
        else loadCourse(course.dataset.crCourse);
      }
    });
    async function syncPlanner(){
      if(!token||Date.now()>=expires)throw Error('Conectează contul Google în Classroom pentru a actualiza materialele.');
      const authSession=session,courseList=(await listAll('courses','courses',generation)).filter(c=>!['DECLINED','SUSPENDED'].includes(c.courseState));
      const items=[];let failures=0;
      for(const course of courseList){
        if(session!==authSession)throw Error('Contul Google s-a schimbat. Reîncearcă actualizarea.');
        const defs=[['courseWork','courseWork'],['courseWorkMaterials','courseWorkMaterial'],['announcements','announcements']];
        const results=await Promise.allSettled(defs.map(async([endpoint,field])=>{
          const rows=await listAll('courses/'+encodeURIComponent(course.id)+'/'+endpoint,field,generation);
          return rows.map(row=>{let deadline='';if(row.dueDate){const date=new Date(Date.UTC(row.dueDate.year,row.dueDate.month-1,row.dueDate.day,row.dueTime?.hours||0,row.dueTime?.minutes||0));deadline=date.getFullYear()+'-'+String(date.getMonth()+1).padStart(2,'0')+'-'+String(date.getDate()).padStart(2,'0');}
            return {id:String(row.id),courseId:String(course.id),courseName:course.name,kind:endpoint,title:row.title||row.text||'Material',description:row.description||row.text||'',deadline,url:row.alternateLink||course.alternateLink||'',updated:row.updateTime||row.creationTime||'',files:(row.materials||[]).filter(m=>m.driveFile?.driveFile?.id).map(m=>({id:m.driveFile.driveFile.id,title:m.driveFile.driveFile.title||'Fișier'}))};});
        }));
        for(const result of results)if(result.status==='fulfilled')items.push(...result.value);else failures++;
      }
      if(session!==authSession)throw Error('Sesiunea Google s-a schimbat. Reîncearcă actualizarea.');
      if(failures)throw Error('Nu s-au putut actualiza toate secțiunile Classroom. Datele locale sunt păstrate; reîncearcă.');
      return {courses:courseList.map(c=>({id:String(c.id),name:c.name})),posts:items,updated:new Date().toISOString()};
    }
    const restored=restoreSession();renderProfile(rememberedAccount(),restored);if(restored){scheduleExpiry();restoreCloud().catch(()=>{});if(mailScopeOk())refreshMailSummary();}
    render();renderMail();prepareSignIn();setInterval(()=>{if(mailScopeOk())refreshMailSummary();},5*60000);
    return {element:page,mailElement:mailPage,syncPlanner,openFile:openViewer,isConnected:()=>Boolean(token&&Date.now()<expires),showMail(){mailVisible=true;renderMail();prepareSignIn();if(mailScopeOk()&&!mailLoading&&!mailItems.length)refreshMail();mailPage.classList.remove('is-entering');void mailPage.offsetWidth;mailPage.classList.add('is-entering');mailPage.querySelector('h1')?.focus({preventScroll:true});},show(){
      visible=true;render();prepareSignIn();
      if(token && Date.now()<expires){if(!courses.length&&!loading)loadCourses();}
      page.classList.remove('is-entering');void page.offsetWidth;page.classList.add('is-entering');page.querySelector('h1').focus({preventScroll:true});
    }};
  }};
})();
