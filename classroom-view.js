(() => {
  'use strict';
  const scopes = ['openid','email','profile',
    'https://www.googleapis.com/auth/classroom.courses.readonly',
    'https://www.googleapis.com/auth/classroom.courseworkmaterials.readonly',
    'https://www.googleapis.com/auth/classroom.coursework.me.readonly',
    'https://www.googleapis.com/auth/classroom.announcements.readonly'];
  const esc = (s='') => String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const safeURL = value => {try{const u=new URL(value);return u.protocol==='https:'?u.href:'';}catch{return '';}};
  const link = (url,title,cls='classroom-link') => {const safe=safeURL(url);return safe?`<a class="${cls}" href="${esc(safe)}" target="_blank" rel="noopener noreferrer">${esc(title)} ↗</a>`:'';};
  const previewable = title => /\.(pdf|xlsx?)$/i.test(String(title||'').trim());
  const previewButton = file => {
    const title=String(file?.title||'Fișier');
    if(!file?.id || !previewable(title))return '';
    return `<button class="classroom-link classroom-preview-link" type="button" data-cr-preview="${esc(file.id)}" data-cr-preview-title="${esc(title)}">${esc(title)} <span aria-hidden="true">▣</span></button>`;
  };
  let gisPromise;
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
    viewer.innerHTML=`<div class="classroom-viewer-backdrop" data-cr-viewer-close></div><section class="classroom-viewer-dialog"><header class="classroom-viewer-header"><div><span class="classroom-kind">Previzualizare</span><h2 id="classroomViewerTitle" data-cr-viewer-title>Fișier</h2></div><div class="classroom-viewer-actions"><a class="hub-small-button classroom-viewer-drive" data-cr-viewer-drive target="_blank" rel="noopener noreferrer">Deschide în Drive ↗</a><button class="hub-small-button classroom-viewer-close" type="button" data-cr-viewer-close aria-label="Închide previzualizarea">✕</button></div></header><iframe data-cr-viewer-frame title="Previzualizare fișier" referrerpolicy="no-referrer" allowfullscreen></iframe></section>`;root.append(viewer);
    let viewerReturnFocus=null;
    function closeViewer(restore=true){
      if(viewer.classList.contains('hub-hidden'))return;
      viewer.classList.add('hub-hidden');viewer.querySelector('[data-cr-viewer-frame]').src='about:blank';document.body.classList.remove('classroom-viewer-open');
      if(restore && viewerReturnFocus?.isConnected)viewerReturnFocus.focus({preventScroll:true});viewerReturnFocus=null;
    }
    function openViewer(id,title){
      const fileId=String(id||'');if(!/^[A-Za-z0-9_-]+$/.test(fileId))return;
      viewerReturnFocus=document.activeElement instanceof HTMLElement?document.activeElement:null;
      viewer.querySelector('[data-cr-viewer-title]').textContent=title||'Fișier';
      viewer.querySelector('[data-cr-viewer-frame]').src='https://drive.google.com/file/d/'+encodeURIComponent(fileId)+'/preview';
      viewer.querySelector('[data-cr-viewer-drive]').href='https://drive.google.com/file/d/'+encodeURIComponent(fileId)+'/view';
      viewer.classList.remove('hub-hidden');document.body.classList.add('classroom-viewer-open');viewer.querySelector('.classroom-viewer-close').focus({preventScroll:true});
    }
    viewer.addEventListener('click',e=>{if(e.target.closest('[data-cr-viewer-close]'))closeViewer();});
    viewer.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();closeViewer();}});
    let token='',expires=0,client=null,courses=[],posts=[],selected=null,loading=false,message='',warning='',generation=0,session=0,expireTimer,visible=false;
    const configured=()=>/^[\w.-]+\.apps\.googleusercontent\.com$/.test(window.ORAR_CLASSROOM_CLIENT_ID||'');
    function clearSession(text=''){
      closeViewer(false);generation++;session++;clearTimeout(expireTimer);token='';expires=0;courses=[];posts=[];selected=null;loading=false;message=text;warning='';profile.replaceChildren();profile.classList.add('hub-hidden');render();
    }
    async function api(url){
      if(!token || Date.now()>=expires){clearSession('Sesiunea a expirat. Conectează-te din nou.');throw Error('Sesiunea a expirat. Conectează-te din nou.');}
      const response=await fetch(url,{headers:{Authorization:'Bearer '+token},cache:'no-store',credentials:'omit'});
      if(response.status===401){clearSession('Sesiunea a expirat. Conectează-te din nou.');throw Error('Sesiunea a expirat. Conectează-te din nou.');}
      if(!response.ok)throw Error(response.status===403?'Google nu a permis accesul. Verifică permisiunile acordate și accesul contului la această clasă.':'Nu am putut încărca datele din Classroom. Încearcă din nou.');
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
      const definitions=[['courseWorkMaterials','courseWorkMaterial','Material'],['courseWork','courseWork','Temă'],['announcements','announcements','Anunț']];
      const results=await Promise.allSettled(definitions.map(async([endpoint,field,kind])=>(await listAll('courses/'+encodeURIComponent(id)+'/'+endpoint,field,g)).map(item=>({...item,kind}))));
      if(g!==generation)return;
      const successful=results.filter(r=>r.status==='fulfilled');posts=successful.flatMap(r=>r.value).sort((a,b)=>(b.updateTime||b.creationTime||'').localeCompare(a.updateTime||a.creationTime||''));
      const errors=results.filter(r=>r.status==='rejected');
      if(errors.length)warning=successful.length?'Unele secțiuni nu au putut fi încărcate. Poți reîncerca sau deschide clasa în Google Classroom.':errors[0].reason.message;
      loading=false;render();
    }
    function attachments(post){
      return (post.materials||[]).map(m=>{
        if(m.driveFile?.driveFile){const f=m.driveFile.driveFile;return previewButton(f) || link(f.alternateLink || (f.id?'https://drive.google.com/file/d/'+encodeURIComponent(f.id)+'/view':''),f.title||'Fișier Google Drive');}
        if(m.link)return link(m.link.url,m.link.title||'Deschide linkul');
        if(m.youtubeVideo)return link(m.youtubeVideo.alternateLink || (m.youtubeVideo.id?'https://www.youtube.com/watch?v='+encodeURIComponent(m.youtubeVideo.id):''),m.youtubeVideo.title||'Video');
        if(m.form)return link(m.form.formUrl,m.form.title||'Formular');
        return '';
      }).join('');
    }
    function render(){
      const signed=Boolean(token && Date.now()<expires);
      page.innerHTML=`<div class="hub-content"><header class="hub-page-header"><h1 class="hub-heading" id="classroomHeading" tabindex="-1">Classroom</h1><p class="hub-intro">Clasele și materialele tale, într-un singur loc.</p></header>
        <div class="classroom-actions">${signed?'<button class="hub-small-button" data-cr-refresh>Actualizează</button><button class="hub-small-button" data-cr-logout>Deconectează</button>':`<button class="hub-primary" data-cr-signin ${!configured()||!client?'disabled':''}>Conectează contul Google</button>`}${link('https://classroom.google.com/','Deschide Google Classroom')}</div>
        ${message?`<p class="classroom-notice" role="alert">${esc(message)}</p>`:''}
        ${!configured()?'<div class="classroom-welcome"><h2>Conectarea Google nu este activată încă</h2><p>După activare, aici vei vedea clasele și materialele contului tău.</p></div>':!signed?'<div class="classroom-welcome"><h2>Materialele tale, aproape</h2><p>Conectează-te pentru a vedea clasele, documentele și materialele publicate. Nimic nu va fi modificat în Classroom.</p></div>':''}
        ${signed&&selected?`<button class="hub-small-button classroom-back" data-cr-back>← Toate clasele</button><div class="classroom-course-heading"><h2>${esc(selected.name)}</h2>${link(selected.alternateLink,'Deschide clasa')}</div>`:''}
        ${loading?'<p class="classroom-notice" role="status">Se încarcă…</p>':''}
        ${warning?`<p class="classroom-notice" role="alert">${esc(warning)}</p>`:''}
        ${signed&&!selected&&!loading?`<div class="classroom-courses">${courses.map(c=>`<button class="classroom-course" data-cr-course="${esc(c.id)}"><strong>${esc(c.name)}</strong><span>${esc(c.section||c.descriptionHeading||'')}${c.courseState==='ARCHIVED'?' · Arhivată':''}</span><small>Vezi materialele →</small></button>`).join('')||'<p class="hub-empty">Nu există clase vizibile pentru acest cont.</p>'}</div>`:''}
        ${signed&&selected&&!loading?`<div class="classroom-posts">${posts.map(post=>`<article class="classroom-post"><span class="classroom-kind">${esc(post.kind)}</span><h3>${esc(post.title|| (post.kind==='Anunț'?'Anunț':'Material'))}</h3>${post.description||post.text?`<p>${esc(post.description||post.text)}</p>`:''}<div class="classroom-attachments">${attachments(post)}</div>${link(post.alternateLink,'Vezi în Classroom')}</article>`).join('')||(!warning?'<p class="hub-empty">Nu sunt materiale publicate în această clasă.</p>':'')}</div>`:''}</div>`;
    }
    async function prepareSignIn(){
      if(!configured() || client)return;
      try{
        await loadGoogle();
        client=window.google.accounts.oauth2.initTokenClient({client_id:window.ORAR_CLASSROOM_CLIENT_ID,scope:scopes.join(' '),include_granted_scopes:true,
          callback:async response=>{
            if(response.error || !response.access_token){message='Conectarea nu a fost finalizată. Poți încerca din nou.';render();return;}
            token=response.access_token;expires=Date.now()+Number(response.expires_in||3600)*1000;const authSession=++session;
            clearTimeout(expireTimer);expireTimer=setTimeout(()=>clearSession('Sesiunea a expirat. Conectează-te din nou.'),Math.max(0,expires-Date.now()));
            loadCourses();
            try{const user=await api('https://openidconnect.googleapis.com/v1/userinfo');if(authSession!==session || !token)return;
              profile.innerHTML=`${safeURL(user.picture)?`<img src="${esc(safeURL(user.picture))}" alt="Fotografia contului Google" referrerpolicy="no-referrer">`:''}<div><strong>${esc(user.name||'Cont Google')}</strong><span>${esc(user.email||'')}</span></div>`;profile.classList.remove('hub-hidden');
            }catch{/* Profile is optional; course access can still work. */}
          },error_callback:()=>{message='Fereastra Google a fost închisă sau blocată. Apasă din nou pe conectare.';render();}});
        render();
      }catch(e){message=e.message;render();}
    }
    page.addEventListener('click',e=>{
      const preview=e.target.closest('[data-cr-preview]');if(preview){openViewer(preview.dataset.crPreview,preview.dataset.crPreviewTitle);return;}
      if(e.target.closest('[data-cr-signin]') && client)client.requestAccessToken({prompt:'select_account'});
      if(e.target.closest('[data-cr-refresh]'))selected?loadCourse(selected.id):loadCourses();
      if(e.target.closest('[data-cr-back]')){generation++;selected=null;posts=[];loading=false;warning='';message='';render();}
      const course=e.target.closest('[data-cr-course]');if(course)loadCourse(course.dataset.crCourse);
      if(e.target.closest('[data-cr-logout]')){const old=token;clearSession();if(old && window.google?.accounts?.oauth2)window.google.accounts.oauth2.revoke(old,()=>{});}
    });
    render();
    return {element:page,show(){visible=true;render();prepareSignIn();page.classList.remove('is-entering');void page.offsetWidth;page.classList.add('is-entering');page.querySelector('h1').focus({preventScroll:true});}};
  }};
})();
