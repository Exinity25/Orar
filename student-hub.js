(() => {
  'use strict';
  const KEY = 'orar_subject_homework_v1';
  const esc = (value='') => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const normalize = value => String(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().replace(/\s+/g,' ').toLocaleLowerCase('ro');
  const svg = paths => `<svg viewBox="0 0 24 24" aria-hidden="true">${paths}</svg>`;
  const icons = {
    menu:svg('<path d="M4 6h16M4 12h16M4 18h16"/>'),
    calendar:svg('<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M7 3v4m10-4v4M3 11h18m-13 4h2m4 0h2"/>'),
    book:svg('<path d="M12 5v15M3 4h5a4 4 0 0 1 4 2 4 4 0 0 1 4-2h5v15h-5a5 5 0 0 0-4 2 5 5 0 0 0-4-2H3Z"/>'),
    classroom:svg('<rect x="3" y="4" width="18" height="15" rx="2"/><circle cx="12" cy="10" r="2"/><path d="M8 16c0-4 8-4 8 0M7 22h10"/>'),
    customize:svg('<path d="M4 20h4l11-11-4-4L4 16v4Z"/><path d="m13.5 6.5 4 4"/><path d="M4 16l4 4"/>')
  };
  let initialized = false;
  window.OrarStudentHub = {init({getSchedule}) {
    if(initialized) return;
    initialized = true;
    const app = document.querySelector('.app');
    let store = {subjects:{}};
    let storageProblem = false;
    try {
      const raw = localStorage.getItem(KEY);
      if(raw){
        const parsed = JSON.parse(raw);
        if(!parsed || !parsed.subjects || typeof parsed.subjects !== 'object' || Array.isArray(parsed.subjects)) throw Error('invalid');
        store = parsed;
      }
    } catch(e){storageProblem = true;}
    let view = 'schedule', search = '', serial = 0, statusTimer;
    const openSubjects = new Set(), drafts = new Map();
    let deletion = null;
    const root = document.createElement('div');root.id='studentHub';
    root.innerHTML = `
      <button class="hub-menu-button" id="hubMenu" type="button" aria-label="Deschide meniul" aria-expanded="false" aria-controls="hubDrawer">${icons.menu}</button>
      <div class="hub-layer" id="hubLayer" aria-hidden="true" inert>
        <div class="hub-backdrop" id="hubBackdrop"></div>
        <aside class="hub-drawer" id="hubDrawer" role="dialog" aria-modal="true" aria-label="Meniu principal">
          <div class="hub-brand"><div><strong>Orar<span class="hub-brand-dot">.</span></strong><small>Spațiul tău pentru facultate</small></div><button class="hub-close" id="hubClose" type="button" aria-label="Închide meniul">✕</button></div>
          <nav class="hub-nav" aria-label="Secțiuni">
            <button class="hub-nav-item" data-hub-view="schedule" aria-current="page" type="button"><span class="hub-icon">${icons.calendar}</span><span class="hub-nav-copy"><strong>Orar</strong><small>Programul săptămânii</small></span></button>
            <button class="hub-nav-item" data-hub-view="subjects" type="button"><span class="hub-icon">${icons.book}</span><span class="hub-nav-copy"><strong>Materii</strong><small>Teme și termene</small></span></button>
            <button class="hub-nav-item" id="hubClassroom" data-hub-view="classroom" type="button"><span class="hub-icon">${icons.classroom}</span><span class="hub-nav-copy"><strong>Classroom</strong><small>Clase și materiale</small></span></button>
            <button class="hub-nav-item" data-hub-view="customize" type="button"><span class="hub-icon">${icons.customize}</span><span class="hub-nav-copy"><strong>Personalizare</strong><small>Temă și fundal</small></span></button>
          </nav>
        </aside>
      </div>
      <main class="hub-page hub-hidden" id="hubSubjects" aria-labelledby="hubHeading">
        <div class="hub-content"><header class="hub-page-header"><h1 class="hub-heading" id="hubHeading" tabindex="-1">Materii</h1><p class="hub-intro">Un singur loc pentru temele și termenele tale.</p><div class="hub-stats" id="hubStats"></div></header>
        <label class="hub-search"><span aria-hidden="true">⌕</span><input id="hubSearch" type="search" placeholder="Caută o materie…" aria-label="Caută o materie" autocomplete="off"></label>
        <div class="hub-subject-list" id="hubSubjectList"></div>
        </div>
      </main>
      <main class="hub-page hub-hidden" id="hubCustomize" aria-labelledby="hubCustomizeHeading">
        <div class="hub-content">
          <header class="hub-page-header"><h1 class="hub-heading" id="hubCustomizeHeading" tabindex="-1">Personalizare</h1><p class="hub-intro">Personalizează culorile și fundalul doar pe dispozitivul tău.</p></header>
          <section class="hub-custom-section" aria-labelledby="hubThemeHeading">
            <div class="hub-custom-section-head"><div><span class="hub-eyebrow">Aspect</span><h2 id="hubThemeHeading">Theme</h2></div><small>DEFAULT păstrează exact aspectul actual.</small></div>
            <div class="hub-theme-grid" id="hubThemeGrid">
              <button class="hub-theme-card" type="button" data-theme-choice="default" aria-pressed="false"><span class="hub-theme-preview theme-preview-default"><i></i><i></i><i></i></span><strong>DEFAULT</strong><small>Negru · roșu · Bleach</small></button>
              <button class="hub-theme-card" type="button" data-theme-choice="ice" aria-pressed="false"><span class="hub-theme-preview theme-preview-ice"><i></i><i></i><i></i></span><strong>ICE</strong><small>Alb · albastru · negru</small></button>
              <button class="hub-theme-card" type="button" data-theme-choice="ocean" aria-pressed="false"><span class="hub-theme-preview theme-preview-ocean"><i></i><i></i><i></i></span><strong>OCEAN</strong><small>Navy · cyan · alb</small></button>
              <button class="hub-theme-card" type="button" data-theme-choice="forest" aria-pressed="false"><span class="hub-theme-preview theme-preview-forest"><i></i><i></i><i></i></span><strong>FOREST</strong><small>Grafit · verde · alb</small></button>
              <button class="hub-theme-card" type="button" data-theme-choice="violet" aria-pressed="false"><span class="hub-theme-preview theme-preview-violet"><i></i><i></i><i></i></span><strong>VIOLET</strong><small>Antracit · violet · alb</small></button>
            </div>
          </section>
          <section class="hub-custom-section" aria-labelledby="hubBackgroundHeading">
            <div class="hub-custom-section-head"><div><span class="hub-eyebrow">Imagine</span><h2 id="hubBackgroundHeading">Custom background</h2></div><small>Imaginea rămâne local pe dispozitivul tău.</small></div>
            <div class="hub-background-card">
              <div class="hub-background-copy"><strong id="hubBackgroundStatus">DEFAULT</strong><span>Poți încărca o fotografie proprie sau reveni oricând la fundalul original.</span></div>
              <div class="hub-background-actions">
                <label class="hub-primary hub-upload-label" for="hubBackgroundInput">Alege fotografie</label>
                <input class="hub-custom-file" id="hubBackgroundInput" type="file" accept="image/*">
                <button class="hub-small-button" id="hubBackgroundReset" type="button">Revino la original</button>
              </div>
            </div>
          </section>
        </div>
      </main>
      <div class="hub-status" id="hubStatus" role="status" aria-live="polite"></div>`;
    document.body.append(root);
    const classroom = window.OrarClassroom.mount(root);
    const $ = selector => root.querySelector(selector);
    const menu=$('#hubMenu'), layer=$('#hubLayer'), page=$('#hubSubjects'), customPage=$('#hubCustomize'), list=$('#hubSubjectList');
    layer.inert = true;
    const THEME_KEY='orar_theme_v1',BG_MODE_KEY='orar_background_mode_v1',BG_NAME_KEY='orar_background_name_v1';
    const THEMES=new Set(['default','ice','ocean','forest','violet']);
    const themeMeta={default:'#080b12',ice:'#f4f8ff',ocean:'#071626',forest:'#07130e',violet:'#120b1d'};
    let backgroundObjectUrl='';
    const currentTheme=()=>{try{const value=localStorage.getItem(THEME_KEY)||'default';return THEMES.has(value)?value:'default';}catch{return 'default';}};
    const updateThemeButtons=()=>{root.querySelectorAll('[data-theme-choice]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.themeChoice===currentTheme())));};
    const applyTheme=(name,save=true)=>{
      if(!THEMES.has(name))name='default';
      if(name==='default')delete document.body.dataset.orarTheme;else document.body.dataset.orarTheme=name;
      const pageBg={
        default:'#080b12',
        ice:'#eaf3ff',
        ocean:'#08131f',
        forest:'#070c09',
        violet:'#0b0711'
      }[name]||'#080b12';
      document.documentElement.style.backgroundColor=pageBg;
      document.body.style.backgroundColor=pageBg;
      const meta=document.querySelector('meta[name="theme-color"]');if(meta)meta.setAttribute('content',themeMeta[name]||themeMeta.default);
      if(save){try{localStorage.setItem(THEME_KEY,name);}catch{}}
      updateThemeButtons();
    };
    const openBackgroundDb=()=>new Promise((resolve,reject)=>{
      if(!('indexedDB' in window)){reject(Error('IndexedDB indisponibil'));return;}
      const request=indexedDB.open('orar_customization_v1',1);
      request.onupgradeneeded=()=>{if(!request.result.objectStoreNames.contains('assets'))request.result.createObjectStore('assets');};
      request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error||Error('Nu s-a putut deschide stocarea.'));
    });
    const backgroundDbAction=async(mode,value)=>{
      const db=await openBackgroundDb();
      return new Promise((resolve,reject)=>{
        const tx=db.transaction('assets',mode==='read'?'readonly':'readwrite'),store=tx.objectStore('assets');
        const request=mode==='read'?store.get('background'):mode==='delete'?store.delete('background'):store.put(value,'background');
        request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);tx.oncomplete=()=>db.close();tx.onerror=()=>{db.close();reject(tx.error);};
      });
    };
    const updateBackgroundStatus=()=>{
      const mode=(()=>{try{return localStorage.getItem(BG_MODE_KEY);}catch{return null;}})();
      const name=(()=>{try{return localStorage.getItem(BG_NAME_KEY)||'Fotografie personalizată';}catch{return 'Fotografie personalizată';}})();
      const el=$('#hubBackgroundStatus');if(el)el.textContent=mode==='custom'?name:'DEFAULT';
    };
    const applyStoredBackground=async()=>{
      let custom=false;try{custom=localStorage.getItem(BG_MODE_KEY)==='custom';}catch{}
      if(!custom){
        if(backgroundObjectUrl){URL.revokeObjectURL(backgroundObjectUrl);backgroundObjectUrl='';}
        document.body.classList.remove('orar-custom-background');document.body.style.removeProperty('--orar-custom-background');updateBackgroundStatus();return;
      }
      try{
        const blob=await backgroundDbAction('read');
        if(!blob)throw Error('missing');
        if(backgroundObjectUrl)URL.revokeObjectURL(backgroundObjectUrl);
        backgroundObjectUrl=URL.createObjectURL(blob);document.body.style.setProperty('--orar-custom-background',`url("${backgroundObjectUrl}")`);document.body.classList.add('orar-custom-background');updateBackgroundStatus();
      }catch{
        try{localStorage.removeItem(BG_MODE_KEY);localStorage.removeItem(BG_NAME_KEY);}catch{}
        document.body.classList.remove('orar-custom-background');document.body.style.removeProperty('--orar-custom-background');updateBackgroundStatus();
      }
    };
    const prepareBackground=file=>new Promise((resolve,reject)=>{
      if(!file||!file.type.startsWith('image/')){reject(Error('Alege un fișier imagine.'));return;}
      if(file.size>25*1024*1024){reject(Error('Imaginea este prea mare. Alege una sub 25 MB.'));return;}
      const url=URL.createObjectURL(file),img=new Image();
      img.onload=()=>{
        try{
          const max=2400,scale=Math.min(1,max/Math.max(img.naturalWidth,img.naturalHeight)),canvas=document.createElement('canvas');
          canvas.width=Math.max(1,Math.round(img.naturalWidth*scale));canvas.height=Math.max(1,Math.round(img.naturalHeight*scale));
          const ctx=canvas.getContext('2d');ctx.drawImage(img,0,0,canvas.width,canvas.height);
          canvas.toBlob(blob=>{URL.revokeObjectURL(url);blob?resolve(blob):resolve(file);},'image/jpeg',.88);
        }catch(e){URL.revokeObjectURL(url);resolve(file);}
      };
      img.onerror=()=>{URL.revokeObjectURL(url);reject(Error('Imaginea nu poate fi citită de browser.'));};img.src=url;
    });
    applyTheme(currentTheme(),false);applyStoredBackground();
    const tell = message => {clearTimeout(statusTimer);$('#hubStatus').textContent=message;$('#hubStatus').classList.add('is-visible');statusTimer=setTimeout(()=>$('#hubStatus').classList.remove('is-visible'),2600);};
    const today = () => {const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
    const validDate = value => typeof value==='string' && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : '';
    const dateLabel = value => value ? value.split('-').reverse().join('.') : 'Fără termen';
    const savedSubject = id => Object.prototype.hasOwnProperty.call(store.subjects,id) ? store.subjects[id] : null;
    const tasksFor = id => Array.isArray(savedSubject(id)?.tasks) ? savedSubject(id).tasks : [];
    const collectSubjects = () => {
      const subjects=new Map();
      const add = item => {
        const name=String(item?.subject || '').trim();if(!name)return;
        const id=normalize(name);if(!subjects.has(id))subjects.set(id,{id,name,count:0,current:true});subjects.get(id).count++;
      };
      Object.values(getSchedule()?.classes || {}).forEach(item=>{add(item);if(item?.alternate)add(item.alternate);});
      Object.entries(store.subjects).forEach(([id,value])=>{
        if(!subjects.has(id) && Array.isArray(value?.tasks) && value.tasks.length) subjects.set(id,{id,name:String(value.name||id),count:0,current:false});
      });
      return [...subjects.values()].sort((a,b)=>a.name.localeCompare(b.name,'ro'));
    };
    const persist = next => {
      if(storageProblem){tell('Salvarea locală nu este disponibilă. Temele existente nu au fost suprascrise.');return false;}
      try {localStorage.setItem(KEY,JSON.stringify(next));window.dispatchEvent(new CustomEvent('orar-local-change',{detail:{key:KEY}}));store=next;return true;}
      catch(e){tell('Nu am putut salva. Verifică spațiul disponibil și accesul la stocare.');return false;}
    };
    const mutate = (id,name,fn) => {
      const next=JSON.parse(JSON.stringify(store));
      if(!Object.prototype.hasOwnProperty.call(next.subjects,id))Object.defineProperty(next.subjects,id,{value:{name,tasks:[]},enumerable:true,writable:true,configurable:true});
      if(!Array.isArray(next.subjects[id].tasks))next.subjects[id].tasks=[];
      fn(next.subjects[id].tasks);next.subjects[id].name=name;
      return persist(next);
    };
    const draftFor = id => drafts.get(id) || {text:'',deadline:'',editing:null};
    const taskMarkup = (task,id) => {
      const due=validDate(task.deadline), overdue=!task.done && due && due<today(), isToday=!task.done && due===today();
      return `<li class="hub-task ${task.done?'is-done':''}" data-task-id="${esc(task.id)}"><div class="hub-task-main"><input class="hub-task-check" type="checkbox" data-task-done ${task.done?'checked':''} aria-label="Marchează tema ca ${task.done?'nefinalizată':'finalizată'}"><span class="hub-task-text">${esc(task.text)}</span></div><div class="hub-task-meta"><span class="hub-due ${overdue?'is-overdue':isToday?'is-today':''}">${task.done?'Finalizată':overdue?'Termen depășit · '+dateLabel(due):isToday?'Termen astăzi':dateLabel(due)}</span><div class="hub-task-actions"><button class="hub-small-button" type="button" data-task-edit>Editează</button><button class="hub-small-button is-danger" type="button" data-task-delete>${deletion===id+':'+task.id?'Confirmă ștergerea':'Șterge'}</button></div></div></li>`;
    };
    const renderSubjects = () => {
      const subjects=collectSubjects(), all=subjects.flatMap(s=>tasksFor(s.id));
      $('#hubStats').innerHTML=`<span class="hub-pill">${subjects.length} materii</span><span class="hub-pill">${all.filter(t=>!t.done).length} teme de făcut</span><span class="hub-pill">${all.filter(t=>!t.done && validDate(t.deadline) && t.deadline<today()).length} cu termen depășit</span>`;
      const visible=subjects.filter(s=>normalize(s.name).includes(normalize(search)));
      list.innerHTML=visible.map((subject,index)=>{
        const {id,name,count,current}=subject, tasks=tasksFor(id), draft=draftFor(id), pending=tasks.filter(t=>!t.done).length;
        const sorted=[...tasks].sort((a,b)=>Number(Boolean(a.done))-Number(Boolean(b.done)) || (validDate(a.deadline)||'9999').localeCompare(validDate(b.deadline)||'9999'));
        return `<details class="hub-subject" data-subject-id="${esc(id)}" ${openSubjects.has(id)?'open':''}><summary><span class="hub-icon hub-subject-mark">${icons.book}</span><span class="hub-subject-name"><strong>${esc(name)}</strong><small>${current?count+(count===1?' activitate în orar':' activități în orar'):'Păstrată dintr-un orar anterior'} · ${pending?pending+(pending===1?' temă de făcut':' teme de făcut'):'Nicio temă în așteptare'}</small></span><span class="hub-chevron" aria-hidden="true">›</span></summary><div class="hub-subject-body"><ul class="hub-tasks">${sorted.map(task=>taskMarkup(task,id)).join('')}</ul>${tasks.length?'':'<p class="hub-empty">Adaugă prima temă pentru această materie.</p>'}<form class="hub-form"><label for="hubTaskText${index}">${draft.editing?'Editează tema':'Temă nouă'}<textarea id="hubTaskText${index}" name="text" placeholder="Ce ai de pregătit?" required maxlength="5000">${esc(draft.text)}</textarea></label><div class="hub-form-footer"><label for="hubTaskDate${index}">Termen<input id="hubTaskDate${index}" type="date" name="deadline" value="${esc(draft.deadline)}"></label><button class="hub-primary" type="submit">${draft.editing?'Salvează':'Adaugă tema'}</button>${draft.editing?'<button class="hub-small-button" type="button" data-task-cancel>Anulează</button>':''}</div></form></div></details>`;
      }).join('') || '<p class="hub-empty">'+(search?'Nu am găsit această materie.':'Adaugă materiile în orar, iar ele vor apărea aici.')+'</p>';
      list.querySelectorAll('details').forEach(el=>{wireSubjectMotion(el);el.addEventListener('toggle',()=>{if(!el.isConnected || subjectMotions.has(el))return;el.open?openSubjects.add(el.dataset.subjectId):openSubjects.delete(el.dataset.subjectId);});});
    };

    const subjectMotions = new WeakMap();
    function wireSubjectMotion(details){
      const summary=details.querySelector('summary');
      const panel=details.querySelector('.hub-subject-body');
      if(!summary || !panel)return;

      summary.addEventListener('click',e=>{
        e.preventDefault();

        const previous=subjectMotions.get(details);
        const opening=previous ? !previous.opening : !details.open;
        const reduce=window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        const id=details.dataset.subjectId;

        if(previous){
          previous.animations.forEach(animation=>animation.cancel());
          subjectMotions.delete(details);
        }

        opening ? openSubjects.add(id) : openSubjects.delete(id);

        if(reduce || !details.animate){
          details.open=opening;
          details.style.height='';
          details.style.overflow='';
          panel.style.opacity='';
          panel.style.transform='';
          return;
        }

        const fromHeight=details.getBoundingClientRect().height;
        if(opening)details.open=true;

        const summaryHeight=summary.getBoundingClientRect().height;
        const borderTop=parseFloat(getComputedStyle(details).borderTopWidth)||0;
        const borderBottom=parseFloat(getComputedStyle(details).borderBottomWidth)||0;
        const targetHeight=opening
          ? summaryHeight + panel.scrollHeight + borderTop + borderBottom
          : summaryHeight + borderTop + borderBottom;

        details.style.height=fromHeight+'px';
        details.style.overflow='hidden';
        details.style.willChange='height';
        panel.style.willChange='opacity, transform';

        const heightAnimation=details.animate(
          [{height:fromHeight+'px'},{height:targetHeight+'px'}],
          {duration:opening?220:190,easing:'cubic-bezier(.22,.75,.2,1)',fill:'forwards'}
        );

        const panelAnimation=panel.animate(
          opening
            ? [{opacity:0,transform:'translateY(-6px)'},{opacity:1,transform:'translateY(0)'}]
            : [{opacity:1,transform:'translateY(0)'},{opacity:0,transform:'translateY(-5px)'}],
          {duration:opening?180:145,easing:'ease-out',fill:'forwards'}
        );

        const state={opening,animations:[heightAnimation,panelAnimation]};
        subjectMotions.set(details,state);

        Promise.allSettled(state.animations.map(animation=>animation.finished)).then(()=>{
          if(subjectMotions.get(details)!==state)return;
          subjectMotions.delete(details);
          details.open=opening;
          details.style.height='';
          details.style.overflow='';
          details.style.willChange='';
          panel.style.willChange='';
          panel.style.opacity='';
          panel.style.transform='';
          state.animations.forEach(animation=>animation.cancel());
        });
      });
    }

    const closeMenu = (restore=true) => {
      layer.classList.remove('is-open');layer.setAttribute('aria-hidden','true');layer.inert=true;
      menu.setAttribute('aria-expanded','false');app.inert=false;page.inert=false;customPage.inert=false;classroom.element.inert=false;menu.inert=false;
      if(restore)menu.focus({preventScroll:true});
    };
    const openMenu = () => {
      layer.inert=false;layer.setAttribute('aria-hidden','false');layer.classList.add('is-open');menu.setAttribute('aria-expanded','true');
      app.inert=true;page.inert=true;customPage.inert=true;classroom.element.inert=true;menu.inert=true;$('#hubClose').focus({preventScroll:true});
    };
    const changeView = next => {
      view=next;closeMenu(false);
      app.classList.toggle('hub-hidden',view!=='schedule');page.classList.toggle('hub-hidden',view!=='subjects');customPage.classList.toggle('hub-hidden',view!=='customize');classroom.element.classList.toggle('hub-hidden',view!=='classroom');
      root.querySelectorAll('[data-hub-view]').forEach(el=>el.dataset.hubView===view?el.setAttribute('aria-current','page'):el.removeAttribute('aria-current'));
      if(view==='subjects'){
        renderSubjects();page.classList.remove('is-entering');void page.offsetWidth;page.classList.add('is-entering');$('#hubHeading').focus({preventScroll:true});
      } else if(view==='classroom') classroom.show();
      else if(view==='customize'){updateThemeButtons();updateBackgroundStatus();customPage.classList.remove('is-entering');void customPage.offsetWidth;customPage.classList.add('is-entering');$('#hubCustomizeHeading').focus({preventScroll:true});}
      else menu.focus({preventScroll:true});
    };
    menu.addEventListener('click',openMenu);$('#hubClose').addEventListener('click',()=>closeMenu());$('#hubBackdrop').addEventListener('click',()=>closeMenu());
    root.querySelectorAll('[data-hub-view]').forEach(el=>el.addEventListener('click',()=>changeView(el.dataset.hubView)));
    layer.addEventListener('keydown',e=>{
      if(e.key==='Escape'){e.preventDefault();closeMenu();}
      if(e.key==='Tab'){
        const focusable=[...layer.querySelectorAll('button,a[href]')],first=focusable[0],last=focusable.at(-1);
        if(e.shiftKey && document.activeElement===first){e.preventDefault();last.focus();}
        else if(!e.shiftKey && document.activeElement===last){e.preventDefault();first.focus();}
      }
    });
    $('#hubThemeGrid').addEventListener('click',e=>{const button=e.target.closest('[data-theme-choice]');if(!button)return;applyTheme(button.dataset.themeChoice);tell('Tema '+button.querySelector('strong').textContent+' este activă.');});
    $('#hubBackgroundInput').addEventListener('change',async e=>{
      const file=e.target.files?.[0];if(!file)return;
      try{
        const blob=await prepareBackground(file);await backgroundDbAction('write',blob);
        localStorage.setItem(BG_MODE_KEY,'custom');localStorage.setItem(BG_NAME_KEY,file.name||'Fotografie personalizată');
        await applyStoredBackground();tell('Fundalul personalizat a fost salvat pe acest dispozitiv.');
      }catch(error){tell(error?.message||'Nu am putut salva fundalul.');}
      finally{e.target.value='';}
    });
    $('#hubBackgroundReset').addEventListener('click',async()=>{
      try{await backgroundDbAction('delete');}catch{}
      try{localStorage.removeItem(BG_MODE_KEY);localStorage.removeItem(BG_NAME_KEY);}catch{}
      await applyStoredBackground();tell('Fundalul Bleach DEFAULT a fost restaurat.');
    });
    $('#hubSearch').addEventListener('input',e=>{search=e.target.value;renderSubjects();});
    list.addEventListener('input',e=>{
      const details=e.target.closest('[data-subject-id]');if(!details || !e.target.closest('form'))return;
      const form=e.target.closest('form'),id=details.dataset.subjectId;
      drafts.set(id,{...draftFor(id),text:form.elements.text.value,deadline:form.elements.deadline.value});
    });
    list.addEventListener('submit',e=>{
      e.preventDefault();const form=e.target, details=form.closest('[data-subject-id]');if(!details)return;
      const id=details.dataset.subjectId, subject=collectSubjects().find(s=>s.id===id), text=form.elements.text.value.trim(),deadline=validDate(form.elements.deadline.value),draft=draftFor(id);
      if(!text){form.elements.text.focus();return;}
      const success=mutate(id,subject.name,tasks=>{
        const found=draft.editing && tasks.find(t=>t.id===draft.editing);
        if(found){found.text=text;found.deadline=deadline;}
        else tasks.push({id:crypto.randomUUID?crypto.randomUUID():Date.now().toString(36)+'-'+(++serial),text,deadline,done:false});
      });
      if(success){drafts.delete(id);openSubjects.add(id);renderSubjects();tell(draft.editing?'Tema a fost actualizată.':'Tema a fost salvată.');}
    });
    list.addEventListener('change',e=>{
      if(!e.target.matches('[data-task-done]'))return;
      const details=e.target.closest('[data-subject-id]'),id=details.dataset.subjectId,taskId=e.target.closest('[data-task-id]').dataset.taskId,subject=collectSubjects().find(s=>s.id===id);
      if(mutate(id,subject.name,tasks=>{const task=tasks.find(t=>t.id===taskId);if(task)task.done=e.target.checked;})){openSubjects.add(id);renderSubjects();}else e.target.checked=!e.target.checked;
    });
    list.addEventListener('click',e=>{
      const details=e.target.closest('[data-subject-id]');if(!details)return;const id=details.dataset.subjectId;
      if(e.target.closest('[data-task-cancel]')){drafts.delete(id);openSubjects.add(id);renderSubjects();return;}
      const row=e.target.closest('[data-task-id]');if(!row)return;
      const task=tasksFor(id).find(t=>t.id===row.dataset.taskId);if(!task)return;
      if(e.target.closest('[data-task-edit]')){
        drafts.set(id,{text:task.text,deadline:validDate(task.deadline),editing:task.id});openSubjects.add(id);renderSubjects();
        const section=[...list.querySelectorAll('[data-subject-id]')].find(el=>el.dataset.subjectId===id);section.querySelector('textarea').focus();
      }
      if(e.target.closest('[data-task-delete]')){
        if(deletion!==id+':'+task.id){deletion=id+':'+task.id;e.target.textContent='Confirmă ștergerea';return;}
        const subject=collectSubjects().find(s=>s.id===id);
        if(mutate(id,subject.name,tasks=>{const index=tasks.findIndex(t=>t.id===task.id);if(index>=0)tasks.splice(index,1);})){deletion=null;if(draftFor(id).editing===task.id)drafts.delete(id);openSubjects.add(id);renderSubjects();tell('Tema a fost ștearsă.');}
      }
    });
    window.addEventListener('storage',e=>{if(e.key!==KEY)return;try{const next=JSON.parse(e.newValue||'{"subjects":{}}');if(next?.subjects && typeof next.subjects==='object'){store=next;if(view==='subjects')renderSubjects();}}catch{}});
    document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible' && view==='subjects')renderSubjects();});
  }};
})();

