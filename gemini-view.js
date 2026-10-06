(() => {
  'use strict';

  const CHAT_KEY='orar_gemini_chats_v1';
  const MODEL='gemini-3.8-flash';
  const MAX_FILE_BYTES=12*1024*1024;
  const esc=(value='')=>String(value).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,9);

  function readChats(){
    try{
      const parsed=JSON.parse(localStorage.getItem(CHAT_KEY)||'[]');
      return Array.isArray(parsed)?parsed.filter(x=>x&&x.id&&Array.isArray(x.messages)).slice(0,30):[];
    }catch{return [];}
  }
  function writeChats(chats){
    const trimmed=chats.slice(0,30).map(chat=>({...chat,messages:(chat.messages||[]).slice(-120).map(message=>{const {parts,...safe}=message;return safe;})}));
    localStorage.setItem(CHAT_KEY,JSON.stringify(trimmed));
    window.dispatchEvent(new CustomEvent('orar-local-change',{detail:{key:CHAT_KEY}}));
  }
  function linkify(text=''){
    return esc(text).replace(/(https?:\/\/[^\s<]+)/g,'<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>');
  }
  async function filePart(file){
    if(!file)return null;
    if(file.size>MAX_FILE_BYTES)throw Error('Fișierul '+file.name+' depășește 12 MB.');
    const data=await new Promise((resolve,reject)=>{
      const reader=new FileReader();
      reader.onload=()=>resolve(String(reader.result||''));
      reader.onerror=()=>reject(Error('Nu am putut citi '+file.name+'.'));
      reader.readAsDataURL(file);
    });
    const base64=data.slice(data.indexOf(',')+1);
    const mime=file.type||(/\.pdf$/i.test(file.name)?'application/pdf':'application/octet-stream');
    return {inlineData:{mimeType:mime,data:base64}};
  }
  function extractText(payload){
    const parts=payload?.candidates?.[0]?.content?.parts||[];
    return parts.map(part=>part?.text||'').filter(Boolean).join('\n').trim();
  }
  async function generate(accessToken,contents,systemText='',json=false){
    const response=await fetch('https://generativelanguage.googleapis.com/v1beta/models/'+encodeURIComponent(MODEL)+':generateContent',{
      method:'POST',
      headers:{'Content-Type':'application/json','Authorization':'Bearer '+accessToken},
      body:JSON.stringify({
        systemInstruction:systemText?{parts:[{text:systemText}]}:undefined,
        contents,
        generationConfig:json?{temperature:.1,responseMimeType:'application/json'}:{temperature:.45}
      })
    });
    let payload=null;try{payload=await response.json();}catch{}
    if(!response.ok){
      const message=String(payload?.error?.message||'Gemini nu a răspuns.');
      if(response.status===401||response.status===403)throw Error('Gemini nu este autorizat pentru contul Google. Reconectează contul și acceptă permisiunea Gemini.');
      if(response.status===429)throw Error('Ai atins limita Gemini Free Tier. Încearcă din nou mai târziu.');
      throw Error(message);
    }
    const text=extractText(payload);
    if(!text)throw Error('Gemini nu a returnat conținut.');
    return text;
  }

  window.OrarGemini={
    mount({root,getSchedule,applySchedule,getAppContext,getGoogleToken,requestGoogleAccess,changeView,tell}){
      const page=document.createElement('main');
      page.id='hubGeminiPage';
      page.className='hub-page hub-hidden gemini-page';
      page.setAttribute('aria-labelledby','geminiHeading');
      root.append(page);

      const importDialog=document.createElement('dialog');
      importDialog.className='planner-dialog gemini-import-dialog';
      root.append(importDialog);

      let chats=readChats();
      let activeId=chats[0]?.id||'';
      let collapsed=false;
      let chatMenuOpen=false;
      let busy=false;
      let pendingFiles=[];

      function activeChat(){return chats.find(chat=>chat.id===activeId)||null;}
      function createChat(){
        const chat={id:uid(),title:'Chat nou',created:Date.now(),updated:Date.now(),messages:[]};
        chats.unshift(chat);activeId=chat.id;writeChats(chats);render();
      }
      function deleteChat(id){
        chats=chats.filter(chat=>chat.id!==id);
        if(activeId===id)activeId=chats[0]?.id||'';
        writeChats(chats);render();
      }
      function titleFrom(text){
        const value=String(text||'').replace(/\s+/g,' ').trim();
        return value?value.slice(0,42):'Chat nou';
      }
      function appContext(){
        const base={schedule:getSchedule?.()||null};
        try{Object.assign(base,getAppContext?.()||{});}catch{}
        const local={};
        try{
          for(let i=0;i<localStorage.length;i++){
            const key=localStorage.key(i);
            if(!key||key==='orar_gemini_api_key_v1'||key===CHAT_KEY||/session|token|account/i.test(key))continue;
            if(!/^(orar_|c11_1_)/.test(key))continue;
            const value=localStorage.getItem(key);
            if(value!=null&&value.length<180000)local[key]=value;
          }
        }catch{}
        base.localStorage=local;
        return base;
      }
      const systemPrompt=()=>[
        'Ești Gemini integrat în aplicația universitară Orar.',
        'Răspunde implicit în română, clar și practic.',
        'Ai acces read-only la snapshot-ul curent al aplicației inclus mai jos: orarul complet, materii, profesori, săli, locații și timpi de deplasare, toate task-urile și termenele, notițele, examenele, prezențele, catalogul, sesiunile de studiu/focus, resursele, Classroom, Mail și Drive în măsura în care sunt încărcate în aplicație.',
        'Nu pretinde că vezi informații care nu apar în snapshot.',
        'Poți analiza fișierele atașate de utilizator.',
        'Nu modifica datele aplicației din chat; importul automat al orarului se face separat prin funcția Upload.',
        'SNAPSHOT APLICAȚIE:\n'+JSON.stringify(appContext())
      ].join('\n\n');

      function messageParts(message,includeAttachments=false){
        const parts=[{text:String(message.text||'')}];
        if(includeAttachments&&Array.isArray(message.parts))parts.push(...message.parts);
        return parts;
      }
      function renderMessages(chat){
        if(!chat||!chat.messages.length)return '<div class="gemini-empty"><span>✦</span><h2>Cu ce te pot ajuta?</h2><p>Gemini poate folosi contextul curent al aplicației și fișierele pe care le atașezi.</p></div>';
        return chat.messages.map(message=>`<article class="gemini-message is-${message.role==='model'?'model':'user'}"><div class="gemini-message-label">${message.role==='model'?'Gemini':'Tu'}</div><div class="gemini-message-body">${linkify(message.text||'')}</div>${message.attachments?.length?`<div class="gemini-message-files">${message.attachments.map(file=>`<span>▧ ${esc(file.name)}</span>`).join('')}</div>`:''}</article>`).join('');
      }
      function render(){
        const chat=activeChat();
        page.innerHTML=`<div class="gemini-shell ${collapsed?'is-collapsed':''} ${chatMenuOpen?'is-chats-open':''}">
          <button class="gemini-chat-menu-toggle" type="button" data-gemini-chat-menu aria-expanded="${chatMenuOpen?'true':'false'}" aria-label="${chatMenuOpen?'Închide conversațiile Gemini':'Deschide conversațiile Gemini'}"><span></span><span></span><span></span></button>
          <button class="gemini-chat-backdrop" type="button" data-gemini-chat-backdrop aria-label="Închide lista de conversații"></button>
          <aside class="gemini-sidebar" aria-label="Chat-uri Gemini">
            <div class="gemini-sidebar-top">
              <button class="gemini-collapse" type="button" data-gemini-collapse aria-label="${collapsed?'Extinde lista de chat-uri':'Restrânge lista de chat-uri'}">${collapsed?'›':'‹'}</button>
              <button class="hub-primary gemini-new-chat" type="button" data-gemini-new><span>＋</span><strong>Chat nou</strong></button>
            </div>
            <div class="gemini-chat-list">${chats.map(item=>`<div class="gemini-chat-row ${item.id===activeId?'is-active':''}"><button type="button" data-gemini-chat="${esc(item.id)}"><span>◌</span><strong>${esc(item.title||'Chat nou')}</strong></button><button type="button" class="gemini-chat-delete" data-gemini-delete="${esc(item.id)}" aria-label="Șterge chat">×</button></div>`).join('')}</div>
            <div class="gemini-key-button" title="Gemini folosește contul Google conectat"><span>G</span><strong>Cont Google</strong></div>
          </aside>
          <section class="gemini-main">
            <header class="gemini-header"><div><span class="hub-eyebrow">AI</span><h1 id="geminiHeading" tabindex="-1">Gemini</h1></div><small>gemini-3.8-flash · Cont Google</small></header>
            <div class="gemini-conversation" data-gemini-conversation>${renderMessages(chat)}${busy?'<div class="gemini-thinking"><i></i><i></i><i></i></div>':''}</div>
            <div class="gemini-pending-files">${pendingFiles.map((file,index)=>`<span>▧ ${esc(file.name)} <button type="button" data-gemini-remove-file="${index}" aria-label="Elimină fișierul">×</button></span>`).join('')}</div>
            <form class="gemini-composer" data-gemini-form>
              <label class="gemini-attach" aria-label="Atașează fișiere">＋<input type="file" data-gemini-files multiple accept="image/*,.pdf,.txt,.md,.csv,.json,.xml,.html,.doc,.docx,.ppt,.pptx,.xls,.xlsx"></label>
              <textarea name="message" rows="1" maxlength="20000" placeholder="Mesaj pentru Gemini…" aria-label="Mesaj pentru Gemini"></textarea>
              <button class="gemini-send" type="submit" ${busy?'disabled':''} aria-label="Trimite">↑</button>
            </form>
          </section>
        </div>`;
        requestAnimationFrame(()=>{
          const box=page.querySelector('[data-gemini-conversation]');if(box)box.scrollTop=box.scrollHeight;
        });
      }

      async function sendMessage(text){
        const clean=String(text||'').trim();
        if(!clean&&pendingFiles.length===0)return;
        const accessToken=String(getGoogleToken?.()||'');if(!accessToken){requestGoogleAccess?.();tell?.('Acceptă permisiunea Gemini pentru contul Google conectat, apoi încearcă din nou.');return;}
        if(!activeChat())createChat();
        const chat=activeChat(),files=pendingFiles.slice();pendingFiles=[];
        const attachmentParts=[];
        busy=true;
        const userMessage={role:'user',text:clean||'Analizează fișierele atașate.',attachments:files.map(file=>({name:file.name,type:file.type,size:file.size})),parts:attachmentParts};
        chat.messages.push(userMessage);if(chat.title==='Chat nou')chat.title=titleFrom(clean||files[0]?.name);chat.updated=Date.now();writeChats(chats);render();
        try{
          for(const file of files)attachmentParts.push(await filePart(file));
          const recent=chat.messages.slice(-24);
          const history=recent.map((message,index)=>({role:message.role,parts:messageParts(message,index===recent.length-1)}));
          const answer=await generate(accessToken,history,systemPrompt(),false);
          chat.messages.push({role:'model',text:answer,attachments:[]});chat.updated=Date.now();writeChats(chats);
        }catch(error){
          chat.messages.push({role:'model',text:'Eroare: '+(error?.message||'Gemini nu a răspuns.'),attachments:[]});writeChats(chats);
        }finally{busy=false;render();}
      }

      function cleanScheduleObject(raw,current){
        if(!raw||typeof raw!=='object'||!Array.isArray(raw.times)||!raw.classes||typeof raw.classes!=='object')throw Error('Gemini nu a returnat un orar valid.');
        const times=raw.times.slice(0,24).map(pair=>Array.isArray(pair)?[String(pair[0]||''),String(pair[1]||'')]:null).filter(pair=>pair&&/^\d{2}:\d{2}$/.test(pair[0])&&/^\d{2}:\d{2}$/.test(pair[1]));
        if(!times.length)throw Error('Nu am putut identifica intervalele orare.');
        const classes={};
        for(const [key,value] of Object.entries(raw.classes)){
          if(!/^\d+-[0-4]$/.test(key)||!value||typeof value!=='object')continue;
          const row=Number(key.split('-')[0]);if(row>=times.length)continue;
          const normalizeItem=item=>{
            if(!item||typeof item!=='object')return null;
            const subject=String(item.subject||'').trim();if(!subject)return null;
            const week=['PARĂ','IMPARĂ'].includes(String(item.week||'').toUpperCase())?String(item.week).toUpperCase():'MEREU';
            const type=['CURS','SEMINAR','LABORATOR'].includes(String(item.type||'').toUpperCase())?String(item.type).toUpperCase():'CURS';
            return {type,subject,professor:String(item.professor||'').trim(),location:String(item.location||'').trim(),week,note:'',deadline:'',cardColor:'default'};
          };
          const item=normalizeItem(value);if(!item)continue;
          const alt=normalizeItem(value.alternate);if(alt){item.alternate=alt;if(item.week==='MEREU')item.week='IMPARĂ';if(alt.week==='MEREU')alt.week=item.week==='IMPARĂ'?'PARĂ':'IMPARĂ';}
          classes[key]=item;
        }
        if(!Object.keys(classes).length)throw Error('Nu am identificat nicio activitate în imagine/PDF.');
        return {title:String(raw.title||current?.title||'Orar').slice(0,120),subtitle:String(raw.subtitle||current?.subtitle||'').slice(0,180),times,classes};
      }

      async function importSchedule(file,group=''){
        const accessToken=String(getGoogleToken?.()||'');if(!accessToken){requestGoogleAccess?.();throw Error('Acceptă permisiunea Gemini pentru contul Google conectat, apoi încearcă din nou.');}
        if(!file)throw Error('Alege o poză sau un PDF.');
        if(!/^image\//.test(file.type)&&file.type!=='application/pdf'&&!/\.pdf$/i.test(file.name))throw Error('Pentru importul orarului folosește o fotografie sau un PDF.');
        const current=getSchedule();
        const hiddenInstruction=[
          'Analizează imaginea/PDF-ul cu orarul universitar și transformă-l în JSON pentru aplicația Orar.',
          'Răspunde EXCLUSIV cu JSON valid, fără markdown și fără explicații.',
          'Schema exactă: {"title":"...","subtitle":"...","times":[["08:00","09:30"]],"classes":{"0-0":{"type":"CURS","subject":"...","professor":"...","location":"...","week":"MEREU","alternate":{"type":"LABORATOR","subject":"...","professor":"...","location":"...","week":"IMPARĂ"}}}}.',
          'Cheia classes este "rand-zi": ziua 0=Luni, 1=Marți, 2=Miercuri, 3=Joi, 4=Vineri; randul corespunde poziției în vectorul times.',
          'Importă obligatoriu materia, profesorul și locația exact cum apar. Tipul trebuie să fie CURS, SEMINAR sau LABORATOR.',
          'Dacă nu este specificată săptămâna pară/impară pentru o activitate, folosește MEREU.',
          'Dacă o celulă este împărțită printr-o diagonală și nu există etichete text pentru paritate, interpretează activitatea de DEASUPRA diagonalei ca IMPARĂ și activitatea de SUB diagonală ca PARĂ și pune a doua activitate în alternate. Dacă imaginea are etichete explicite, urmează etichetele în locul acestei convenții.',
          'Nu inventa profesori, săli sau materii care nu sunt lizibile. Pentru câmpurile nelizibile folosește șir gol, cu excepția subject care trebuie să existe.',
          group?('Utilizatorul a indicat grupa: '+group+'. Dacă documentul conține mai multe grupe/subgrupe, importă activitățile relevante acestei grupe și activitățile comune.'):'Nu a fost specificată o grupă; importă programul principal vizibil în document.',
          'Orarul curent este furnizat doar ca reper pentru titlu/subtitlu, nu copia clase vechi care nu apar în fișier: '+JSON.stringify({title:current.title,subtitle:current.subtitle,times:current.times})
        ].join('\n');
        const part=await filePart(file);
        const result=await generate(accessToken,[{role:'user',parts:[{text:hiddenInstruction},part]}],'Ești un extractor strict de orare universitare. Nu adăuga comentarii.',true);
        let parsed;try{parsed=JSON.parse(result.replace(/^```json\s*|```$/g,'').trim());}catch{throw Error('Gemini a returnat un răspuns care nu poate fi importat. Încearcă din nou cu o poză mai clară.');}
        const schedule=cleanScheduleObject(parsed,current);
        applySchedule(schedule);
        tell?.('Orarul a fost importat cu Gemini.');
        return schedule;
      }

      function openScheduleImport(){
        importDialog.innerHTML=`<div class="pl-dialog-head"><h2>Importă orarul cu Gemini</h2><button type="button" data-gemini-dialog-close aria-label="Închide">✕</button></div>
          <form data-gemini-import-form>
            <label>Poză sau PDF<input name="file" type="file" accept="image/*,.pdf,application/pdf" required></label>
            <label>Grupă / subgrupă <span class="gemini-optional">(opțional)</span><input name="group" maxlength="80" placeholder="ex. C_11/1"></label>
            <small>Gemini va încerca să importe materiile, profesorii, sălile și săptămânile pare/impare direct în Orar.</small>
            <button class="hub-primary">Importă automat</button>
          </form>`;
        if(!importDialog.open)importDialog.showModal();
      }

      page.addEventListener('click',e=>{
        if(e.target.closest('[data-gemini-chat-menu]')){chatMenuOpen=!chatMenuOpen;render();return;}
        if(e.target.closest('[data-gemini-chat-backdrop]')){chatMenuOpen=false;render();return;}
        if(e.target.closest('[data-gemini-collapse]')){collapsed=!collapsed;render();return;}
        if(e.target.closest('[data-gemini-new]')){createChat();return;}
        const chatButton=e.target.closest('[data-gemini-chat]');if(chatButton){activeId=chatButton.dataset.geminiChat;if(window.innerWidth<=900)chatMenuOpen=false;render();return;}
        const del=e.target.closest('[data-gemini-delete]');if(del){deleteChat(del.dataset.geminiDelete);return;}
        const remove=e.target.closest('[data-gemini-remove-file]');if(remove){pendingFiles.splice(Number(remove.dataset.geminiRemoveFile),1);render();}
      });
      page.addEventListener('change',e=>{
        const input=e.target.closest('[data-gemini-files]');if(!input)return;
        const selected=[...input.files].filter(file=>file.size<=MAX_FILE_BYTES).slice(0,8);
        pendingFiles=[...pendingFiles,...selected].slice(0,8);render();
      });
      page.addEventListener('submit',e=>{
        const form=e.target.closest('[data-gemini-form]');if(!form)return;e.preventDefault();const field=form.elements.message;const text=field.value;field.value='';sendMessage(text);
      });
      page.addEventListener('keydown',e=>{
        const field=e.target.closest('.gemini-composer textarea');if(!field)return;
        if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();const text=field.value;field.value='';sendMessage(text);}
      });
      importDialog.addEventListener('click',e=>{if(e.target.closest('[data-gemini-dialog-close]'))importDialog.close();});
      importDialog.addEventListener('submit',async e=>{
        const form=e.target.closest('[data-gemini-import-form]');if(!form)return;
        e.preventDefault();const button=form.querySelector('button[type=submit],button:not([type])'),data=new FormData(form),file=form.elements.file.files[0],group=String(data.get('group')||'').trim();
        button.disabled=true;button.textContent='Gemini analizează…';
        try{await importSchedule(file,group);importDialog.close();}
        catch(error){tell?.(error?.message||'Importul nu a reușit.');button.disabled=false;button.textContent='Importă automat';}
      });

      const scheduleButton=document.createElement('button');
      scheduleButton.type='button';scheduleButton.className='schedule-gemini-upload';scheduleButton.innerHTML='<span>✦</span> Upload';
      scheduleButton.setAttribute('aria-label','Importă orarul din poză sau PDF cu Gemini');
      scheduleButton.addEventListener('click',openScheduleImport);
      document.querySelector('.app')?.append(scheduleButton);

      if(!chats.length)createChat();else render();

      return {
        element:page,
        show(){chatMenuOpen=false;page.classList.remove('is-entering');void page.offsetWidth;page.classList.add('is-entering');render();page.querySelector('#geminiHeading')?.focus({preventScroll:true});},
        hide(){},
        openScheduleImport,
        contextSnapshot(){return {chats:chats.map(chat=>({id:chat.id,title:chat.title,updated:chat.updated,messages:chat.messages.slice(-20).map(m=>({role:m.role,text:m.text,attachments:m.attachments}))}))};}
      };
    }
  };
})();
