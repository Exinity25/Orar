(() => {
  'use strict';
  const scopes = ['openid','email','profile',
    'https://www.googleapis.com/auth/classroom.courses.readonly',
    'https://www.googleapis.com/auth/classroom.courseworkmaterials.readonly',
    'https://www.googleapis.com/auth/classroom.coursework.me.readonly',
    'https://www.googleapis.com/auth/classroom.announcements.readonly',
    'https://www.googleapis.com/auth/drive.readonly'];
  const esc = (s='') => String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const safeURL = value => {try{const u=new URL(value);return u.protocol==='https:'?u.href:'';}catch{return '';}};
  const link = (url,title,cls='classroom-link') => {const safe=safeURL(url);return safe?`<a class="${cls}" href="${esc(safe)}" target="_blank" rel="noopener noreferrer">${esc(title)} ↗</a>`:'';};
  const linkifyText = value => String(value||'').split(/(https?:\/\/[^\s]+|www\.[^\s]+)/gi).map(part=>{
    if(!/^(https?:\/\/|www\.)/i.test(part))return esc(part);
    let clean=part,trailing='';while(/[),.;!?]$/.test(clean)){trailing=clean.slice(-1)+trailing;clean=clean.slice(0,-1);}
    const href=safeURL(/^www\./i.test(clean)?'https://'+clean:clean);
    return href?`<a class="classroom-inline-link" href="${esc(href)}" target="_blank" rel="noopener noreferrer">${esc(clean)}</a>${esc(trailing)}`:esc(part);
  }).join('');
  const previewable = title => /\.(pdf|xlsx?)$/i.test(String(title||'').trim());
  const previewButton = file => {
    const title=String(file?.title||'Fișier');
    if(!file?.id || !previewable(title))return '';
    return `<button class="classroom-link classroom-preview-link" type="button" data-cr-preview="${esc(file.id)}" data-cr-preview-title="${esc(title)}">${esc(title)} <span aria-hidden="true">▣</span></button>`;
  };
  let gisPromise,xlsxPromise;
  function loadXlsx(){
    if(window.XLSX)return Promise.resolve(window.XLSX);
    if(xlsxPromise)return xlsxPromise;
    xlsxPromise=new Promise((resolve,reject)=>{
      const s=document.createElement('script');s.src='https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';s.async=true;
      s.onload=()=>window.XLSX?resolve(window.XLSX):reject(Error('Nu s-a putut încărca viewerul Excel.'));
      s.onerror=()=>{xlsxPromise=null;s.remove();reject(Error('Nu s-a putut încărca viewerul Excel.'));};document.head.append(s);
    });return xlsxPromise;
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
    const profile=document.createElement('div');profile.className='classroom-profile hub-hidden';root.querySelector('.hub-drawer').append(profile);
    const viewer=document.createElement('div');viewer.className='classroom-viewer hub-hidden';viewer.setAttribute('role','dialog');viewer.setAttribute('aria-modal','true');viewer.setAttribute('aria-labelledby','classroomViewerTitle');
    viewer.innerHTML=`<div class="classroom-viewer-backdrop" data-cr-viewer-close></div><section class="classroom-viewer-dialog"><header class="classroom-viewer-header"><div><span class="classroom-kind">Previzualizare locală</span><h2 id="classroomViewerTitle" data-cr-viewer-title>Fișier</h2></div><div class="classroom-viewer-actions"><a class="hub-small-button classroom-viewer-drive" data-cr-viewer-drive target="_blank" rel="noopener noreferrer">Deschide în Drive ↗</a><button class="hub-small-button classroom-viewer-close" type="button" data-cr-viewer-close aria-label="Închide previzualizarea">✕</button></div></header><div class="classroom-viewer-content" data-cr-viewer-content></div></section>`;root.append(viewer);
    let viewerReturnFocus=null,viewerObjectUrl='',viewerGeneration=0;
    function resetViewerContent(){
      if(viewerObjectUrl){URL.revokeObjectURL(viewerObjectUrl);viewerObjectUrl='';}
      viewer.querySelector('[data-cr-viewer-content]').replaceChildren();
    }
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
        if(metadata?.capabilities?.canDownload===false)throw Error('Fișierul poate fi văzut în Google Drive, dar proprietarul sau organizația a dezactivat descărcarea. Din acest motiv nu poate fi afișat local în site.');
        const response=await fetch(base+'?alt=media',{headers:{Authorization:'Bearer '+token},cache:'no-store',credentials:'omit'});
        if(generation!==viewerGeneration)return;
        if(response.status===401)throw Error('Sesiunea Google a expirat. Reconectează contul.');
        if(!response.ok){
          let payload=null;try{payload=await response.clone().json();}catch{}
          const reason=String(payload?.error?.errors?.[0]?.reason || payload?.error?.status || '');
          const server=String(payload?.error?.message||'');
          const hay=(reason+' '+server).toLowerCase();
          if(hay.includes('download') || hay.includes('cannotdownload'))throw Error('Google permite vizualizarea fișierului, dar nu permite descărcarea lui pentru acest cont. Viewerul local nu poate ocoli această restricție.');
          if(hay.includes('insufficient') || hay.includes('scope'))throw Error('Tokenul Google nu are permisiunea Drive read-only. Deconectează-te și conectează-te din nou.');
          throw Error('Fișierul nu a putut fi descărcat din Google Drive'+(reason?' ('+reason+')':'')+'.');
        }
        if(/\.pdf$/i.test(name)){
          const blob=await response.blob();if(generation!==viewerGeneration)return;
          viewerObjectUrl=URL.createObjectURL(blob.type==='application/pdf'?blob:new Blob([blob],{type:'application/pdf'}));
          const frame=document.createElement('iframe');frame.className='classroom-local-pdf';frame.title='Previzualizare PDF';frame.src=viewerObjectUrl;viewer.querySelector('[data-cr-viewer-content]').replaceChildren(frame);return;
        }
        if(/\.xlsx?$/i.test(name)){
          const data=await response.arrayBuffer();if(generation!==viewerGeneration)return;
          const XLSX=await loadXlsx();if(generation!==viewerGeneration)return;
          const workbook=XLSX.read(data,{type:'array'}),box=viewer.querySelector('[data-cr-viewer-content]');
          if(!workbook.SheetNames.length)throw Error('Fișierul Excel nu conține foi care pot fi afișate.');
          const renderSheet=sheetName=>{
            const rows=XLSX.utils.sheet_to_json(workbook.Sheets[sheetName],{header:1,defval:'',raw:false});
            const limit=2500,shown=rows.slice(0,limit),table=document.createElement('table');table.className='classroom-excel-table';
            const tbody=document.createElement('tbody');shown.forEach((row,rowIndex)=>{const tr=document.createElement('tr');(row.length?row:['']).forEach(value=>{const cell=document.createElement(rowIndex===0?'th':'td');cell.textContent=String(value??'');tr.append(cell);});tbody.append(tr);});table.append(tbody);
            const wrap=document.createElement('div');wrap.className='classroom-excel-scroll';wrap.append(table);
            const fragment=document.createDocumentFragment();
            if(workbook.SheetNames.length>1){const select=document.createElement('select');select.className='classroom-sheet-select';select.setAttribute('aria-label','Alege foaia Excel');workbook.SheetNames.forEach(n=>{const option=document.createElement('option');option.value=n;option.textContent=n;option.selected=n===sheetName;select.append(option);});select.addEventListener('change',()=>renderSheet(select.value));fragment.append(select);}
            fragment.append(wrap);if(rows.length>limit){const note=document.createElement('p');note.className='classroom-viewer-limit';note.textContent='Sunt afișate primele '+limit+' de rânduri.';fragment.append(note);}box.replaceChildren(fragment);
          };
          renderSheet(workbook.SheetNames[0]);return;
        }
        throw Error('Acest tip de fișier nu are viewer local.');
      }catch(error){if(generation===viewerGeneration)viewerMessage(error?.message||'Nu am putut afișa fișierul.','alert');}
    }
    viewer.addEventListener('click',e=>{if(e.target.closest('[data-cr-viewer-close]'))closeViewer();});
    viewer.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();closeViewer();}});
    const SESSION_KEY='orar_classroom_session_v2',OLD_SESSION_KEY='orar_classroom_session_v1';
    const ACCOUNT_KEY='orar_classroom_account_v1';
    let token='',expires=0,grantedScopes='',client=null,courses=[],posts=[],selected=null,loading=false,message='',warning='',generation=0,session=0,expireTimer,visible=false,reauthenticating=false;
    const configured=()=>/^[\w.-]+\.apps\.googleusercontent\.com$/.test(window.ORAR_CLASSROOM_CLIENT_ID||'');
    function rememberedAccount(){try{const value=JSON.parse(localStorage.getItem(ACCOUNT_KEY)||'null');return value&&value.email?value:null;}catch{return null;}}
    function renderProfile(account,connected=Boolean(token&&Date.now()<expires)){
      if(!account?.email){profile.replaceChildren();profile.classList.add('hub-hidden');return;}
      const picture=safeURL(account.picture||'');
      profile.innerHTML=`<button class="classroom-profile-summary" type="button" data-cr-profile-toggle aria-expanded="false">${picture?`<img src="${esc(picture)}" alt="" referrerpolicy="no-referrer">`:'<span class="classroom-profile-avatar" aria-hidden="true">G</span>'}<span class="classroom-profile-copy"><strong>${esc(account.name||'Cont Google')}</strong><span>${esc(account.email)}</span></span><span class="classroom-profile-chevron" aria-hidden="true">›</span></button><div class="classroom-profile-menu"><div class="classroom-profile-details"><strong>${connected?'Cont Google conectat':'Cont Google memorat'}</strong><span>${esc(account.email)}</span></div><button class="hub-small-button classroom-profile-logout" type="button" data-cr-logout>Deconectează</button></div>`;
      profile.classList.remove('hub-hidden');
    }
    function saveSession(){try{localStorage.setItem(SESSION_KEY,JSON.stringify({token,expires,grantedScopes}));}catch{}}
    function forgetSession(){try{localStorage.removeItem(SESSION_KEY);}catch{}}
    function restoreSession(){
      try{localStorage.removeItem(OLD_SESSION_KEY);const saved=JSON.parse(localStorage.getItem(SESSION_KEY)||'null');if(saved?.token && Number(saved.expires)>Date.now()+5000){token=saved.token;expires=Number(saved.expires);grantedScopes=String(saved.grantedScopes||'');return true;}forgetSession();}catch{forgetSession();}
      return false;
    }
    function scheduleExpiry(){clearTimeout(expireTimer);if(token&&expires>Date.now())expireTimer=setTimeout(()=>clearSession('Sesiunea Google trebuie reînnoită.',false),Math.max(0,expires-Date.now()));}
    function clearSession(text='',forgetAccount=false){
      closeViewer(false);generation++;session++;clearTimeout(expireTimer);token='';expires=0;grantedScopes='';forgetSession();courses=[];posts=[];selected=null;loading=false;message=text;warning='';reauthenticating=false;
      if(forgetAccount){try{localStorage.removeItem(ACCOUNT_KEY);}catch{}profile.replaceChildren();profile.classList.add('hub-hidden');}
      else renderProfile(rememberedAccount(),false);
      render();
    }
    function logout(){const old=token;clearSession('',true);if(old && window.google?.accounts?.oauth2)window.google.accounts.oauth2.revoke(old,()=>{});}
    profile.addEventListener('click',e=>{
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
      try{const result=await listAll('courses','courses',g);if(g!==generation)return;courses=result.filter(c=>!['DECLINED','SUSPENDED'].includes(c.courseState));}
      catch(e){if(g===generation)message=e.message;}
      finally{if(g===generation){loading=false;render();}}
    }
    async function loadCourse(id){
      const course=courses.find(c=>c.id===id);if(!course)return;
      selected=course;posts=[];loading=true;message='';warning='';const g=++generation;render();
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
      const body=posts.map(post=>`<article class="classroom-post"><span class="classroom-kind">${esc(post.kind)}</span><h3>${esc(post.title|| (post.kind==='Anunț'?'Anunț':'Material'))}</h3>${post.description||post.text?`<p>${linkifyText(post.description||post.text)}</p>`:''}<div class="classroom-attachments">${attachments(post)}</div>${link(post.alternateLink,'Vezi în Classroom')}</article>`).join('');
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
            if(response.error || !response.access_token){reauthenticating=false;message='Conectarea nu a fost finalizată. Poți încerca din nou.';render();return;}
            reauthenticating=false;token=response.access_token;expires=Date.now()+Number(response.expires_in||3600)*1000;grantedScopes=String(response.scope||'');saveSession();scheduleExpiry();const authSession=++session;
            loadCourses();
            try{const user=await api('https://openidconnect.googleapis.com/v1/userinfo');if(authSession!==session || !token)return;
              const account={name:user.name||'Cont Google',email:user.email||'',picture:safeURL(user.picture)||''};
              if(account.email){try{localStorage.setItem(ACCOUNT_KEY,JSON.stringify(account));}catch{}renderProfile(account,true);}
            }catch{renderProfile(rememberedAccount(),true);}
          },error_callback:()=>{reauthenticating=false;message='Reconectarea Google nu a putut fi făcută automat. Apasă din nou pe conectare.';render();}});
        render();
      }catch(e){message=e.message;render();}
    }
    function requestAccess(preferRemembered=false){
      if(!client || reauthenticating)return;
      const remembered=rememberedAccount();reauthenticating=true;message='';render();
      const options=preferRemembered&&remembered?{prompt:'',login_hint:remembered.email}:{prompt:'select_account'};
      try{client.requestAccessToken(options);}catch{reauthenticating=false;render();}
    }
    page.addEventListener('click',e=>{
      const preview=e.target.closest('[data-cr-preview]');if(preview){openViewer(preview.dataset.crPreview,preview.dataset.crPreviewTitle);return;}
      if(e.target.closest('[data-cr-signin]') && client)requestAccess(Boolean(rememberedAccount()));
      if(e.target.closest('[data-cr-refresh]'))selected?loadCourse(selected.id):loadCourses();
      const course=e.target.closest('[data-cr-course]');if(course){
        if(selected?.id===course.dataset.crCourse){generation++;selected=null;posts=[];loading=false;warning='';message='';render();}
        else loadCourse(course.dataset.crCourse);
      }
    });
    const restored=restoreSession();renderProfile(rememberedAccount(),restored);if(restored)scheduleExpiry();
    render();prepareSignIn();
    return {element:page,show(){
      visible=true;render();prepareSignIn();
      if(token && Date.now()<expires){if(!courses.length&&!loading)loadCourses();}
      page.classList.remove('is-entering');void page.offsetWidth;page.classList.add('is-entering');page.querySelector('h1').focus({preventScroll:true});
    }};
  }};
})();
