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
      page.setAttribute('aria-labelledby','geminiHeading