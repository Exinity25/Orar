(() => {
  'use strict';

  const CHAT_KEY='orar_gemini_chats_v1';
  const API_KEY='orar_gemini_api_key_v1';
  const MODEL='gemini-2.5-flash';
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
    const trimmed=chats.slice(0,30).map(chat=>({...chat,messages:(chat.messages||[]).slice(-120)}));
    localStorage.setItem(CHAT_KEY,JSON.stringify(trimmed));
    window.dispatchEvent(new CustomEvent('orar-local-change',{detail:{key:CHAT_KEY}}));
  }
  const apiKey=()=>{try{return String(localStorage.getItem(API_KEY)||'').trim();}catch{return '';}};
  function saveApiKey(value){
    try{
      const clean=String(value||'').trim();
      if(clean)localStorage.setItem(API_KEY,clean);else localStorage.removeItem(API_KEY);
    }catch{}
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
  async function generate(key,contents,systemText='',json=false){
    const response=await fetch('https://generativelanguage.googleapis.com/v1beta/models/'+encodeURIComponent(MODEL)+':generateContent',{
      method:'POST',
      headers:{'Content-Type':'application/json','x-goog-api-key':key},
      body:JSON.stringify({
        systemInstruction:systemText?{parts:[{text:systemText}]}:undefined,
        contents,
        generationConfig:json?{temperature:.1,responseMimeType:'application/json'}:{temperature:.45}
      })
    });
    let payload=null;try{payload=await response.json();}catch{}
    if(!response.ok){
      const message=String(payload?.error?.message||'Gemini nu a răspuns.');
      if(response.status===400&&/api key/i.test(message))throw Error('Cheia Gemini nu este validă.');
      if(response.status===429)throw Error('Ai atins limita Gemini Free Tier. Încearcă din nou mai târziu.');
      throw Error(message);
    }
    const text=extractText(payload);
    if(!text)throw Error('Gemini nu a returnat conținut.');
    return text;
  }

  window.OrarGemini={
    mount({root,getSchedule,applySchedule,getAppContext,changeView,tell}){
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
            if(!key||key===API_KEY||/session|token|account/i.test(key))continue;
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
        'Ai acces read-only la snapshot-ul curent al aplicației inclus mai jos: orar, planificator, teme, Classroom, Mail și Drive în măsura în care sunt încărcate în aplicație.',
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
        page.innerHTML=`<div class="gemini-shell ${collapsed?'is-collapsed':''}">
          <aside class="gemini-sidebar" aria-label="Chat-uri Gemini">
            <div class="gemini-sidebar-top">
              <button class="gemini-collapse" type="button" data-gemini-colla