'use client';
import Image from 'next/image';
import { ChangeEvent, FormEvent, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CloudSun, Leaf, LogOut, Mic, MicOff, Send, Volume2, Settings } from 'lucide-react';
import { getSupabase } from '@/lib/supabase/client';
import { localeCodes, localeFrom, messages, photoMessages, Locale } from '@/lib/i18n';

type ChatMessage = { role: 'assistant'|'user'; content: string; urgency?: 'routine'|'soon'|'urgent'|'unclear'; needsExpert?: boolean };
type Weather = { location: string; current: {temperature_2m?:number;relative_humidity_2m?:number;precipitation?:number;wind_speed_10m?:number}; daily: {time:string[];temperature_2m_max?:number[];temperature_2m_min?:number[];precipitation_probability_max?:number[];precipitation_sum?:number[]} ; fetched_at:string; source:string; stale?:boolean };

export default function ChatPage() {
  const router = useRouter();
  const [locale, setLocale] = useState<Locale>('en');
  const [messagesState, setMessagesState] = useState<ChatMessage[]>([{role:'assistant',content:messages.en.hello}]);
  const [text, setText] = useState('');
  const [crop, setCrop] = useState('');
  const [busy, setBusy] = useState(false);
  const [recording, setRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [weather, setWeather] = useState<Weather|null>(null);
  const [farmReport, setFarmReport] = useState<any>(null);
  const [recentScans, setRecentScans] = useState<any[]>([]);
  const [weatherError, setWeatherError] = useState('');
  const [location, setLocation] = useState('');
  const [scan, setScan] = useState<Record<string, any>|null>(null);
  const [selectedPhoto, setSelectedPhoto] = useState<File|null>(null);
  const [photoPreview, setPhotoPreview] = useState<string|null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [userId, setUserId] = useState('');
  const [conversationId, setConversationId] = useState<string|null>(null);
  const mediaRecorder = useRef<MediaRecorder|null>(null);
  const photoInputRef = useRef<HTMLInputElement|null>(null);
  const audioChunks = useRef<Blob[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const supabase = getSupabase();
  const t = messages[locale];

  useEffect(() => {
    const saved = window.localStorage.getItem('krishiunnati-locale');
    if (saved) setLocale(localeFrom(saved));
    if (!supabase) return;
    supabase.auth.getSession().then(async ({data}) => {
      if (!data.session) { router.replace('/login'); return; }
      setUserId(data.session.user.id);
      const {data:scans}=await supabase.from('crop_scans').select('id,crop_id,predicted_label,uncertainty,created_at').eq('user_id',data.session.user.id).order('created_at',{ascending:false}).limit(3);
      if(scans)setRecentScans(scans);
      const {data:latestReport}=await supabase.from('farm_reports').select('report').eq('user_id',data.session.user.id).order('created_at',{ascending:false}).limit(1).maybeSingle();
      if(latestReport?.report)setFarmReport(latestReport.report);
      const {data:existing} = await supabase.from('conversations').select('id,locale').eq('user_id',data.session.user.id).eq('status','open').order('created_at',{ascending:false}).limit(1).maybeSingle();
      if (existing) { setConversationId(existing.id); if (existing.locale) setLocale(localeFrom(existing.locale));
        const {data:history}=await supabase.from('messages').select('role,content').eq('conversation_id',existing.id).order('created_at',{ascending:true}).limit(80);
        if (history?.length) setMessagesState(history.map(m=>({role:m.role as ChatMessage['role'],content:m.content}))); else setMessagesState([{role:'assistant',content:t.hello}]);
      } else setMessagesState([{role:'assistant',content:t.hello}]);
    });
  }, [router]);

  useEffect(()=>{scrollRef.current?.scrollTo({top:scrollRef.current.scrollHeight,behavior:'smooth'});},[messagesState,transcript,scan]);
  useEffect(()=>{window.localStorage.setItem('krishiunnati-locale',locale);},[locale]);
  useEffect(()=>{document.documentElement.lang=localeCodes[locale];},[locale]);
  useEffect(()=>{if(!photoPreview)return;return()=>URL.revokeObjectURL(photoPreview);},[photoPreview]);

  async function ensureConversation(): Promise<string|null> {
    if (conversationId || !supabase || !userId) return conversationId;
    const {data,error}=await supabase.from('conversations').insert({user_id:userId,locale:localeCodes[locale],status:'open'}).select('id').single();
    if (error || !data) return null;
    setConversationId(data.id); return data.id;
  }

  async function sendMessage(message:string) {
    const trimmed=message.trim(); if (!trimmed || busy) return;
    setNotice(''); setText(''); setTranscript(''); setScan(null);
    const next=[...messagesState,{role:'user' as const,content:trimmed}]; setMessagesState(next); setBusy(true);
    const cid=await ensureConversation();
    const session=(await supabase?.auth.getSession())?.data.session;
    if (cid && supabase) await supabase.from('messages').insert({conversation_id:cid,user_id:userId,role:'user',content:trimmed,locale:localeCodes[locale]});
    try {
      const response=await fetch('/api/v1/chat',{method:'POST',headers:{'Content-Type':'application/json',...(session?{Authorization:`Bearer ${session.access_token}`}:{})},body:JSON.stringify({conversation_id:cid,message:trimmed,locale:localeCodes[locale],crop_id:crop||null})});
      const data=await response.json();
      if(!response.ok) throw new Error(data.error||'The crop assistant is unavailable right now.');
      const answer=String(data.assistant_message||'');
      setMessagesState([...next,{role:'assistant',content:answer,urgency:data.urgency,needsExpert:data.needs_expert}]);
      if(cid&&supabase) await supabase.from('messages').insert({conversation_id:cid,user_id:userId,role:'assistant',content:answer,locale:localeCodes[locale]});
    } catch(e) { setNotice(e instanceof Error?e.message:'Could not reach the assistant. Check your connection and try again.'); }
    finally {setBusy(false);}
  }

  function onSubmit(e:FormEvent){e.preventDefault();void sendMessage(text);}
  async function startRecording(){
    if(!navigator.mediaDevices?.getUserMedia||!window.MediaRecorder){setNotice('Voice recording is not supported here. You can type your question instead.');return;}
    try{const stream=await navigator.mediaDevices.getUserMedia({audio:true});const recorder=new MediaRecorder(stream);mediaRecorder.current=recorder;audioChunks.current=[];
      recorder.ondataavailable=event=>{if(event.data.size)audioChunks.current.push(event.data)};
      recorder.onstop=async()=>{stream.getTracks().forEach(track=>track.stop());const blob=new Blob(audioChunks.current,{type:recorder.mimeType||'audio/webm'});await transcribe(blob)};
      recorder.start();setRecording(true);setNotice('Listening… Tap the microphone again to finish.');
      window.setTimeout(()=>{if(recorder.state==='recording')recorder.stop();setRecording(false);},30000);
    }catch{setNotice('Microphone access was not granted. You can type your question instead.');}
  }
  async function stopRecording(){const recorder=mediaRecorder.current;if(recorder&&recorder.state==='recording'){recorder.stop();setRecording(false);setNotice('Transcribing your words…');}}
  async function transcribe(blob:Blob){
    if(blob.size>10*1024*1024){setNotice('Audio is too large. Please record a shorter message.');return;}
    const session=(await supabase?.auth.getSession())?.data.session;const form=new FormData();form.append('audio',blob,'farmer-message.webm');form.append('locale',localeCodes[locale]);
    try{const response=await fetch('/api/v1/voice/transcribe',{method:'POST',headers:session?{Authorization:`Bearer ${session.access_token}`}:{},body:form});const data=await response.json();if(!response.ok)throw new Error(data.error||'Transcription is unavailable.');setTranscript(data.transcript||'');setNotice('');}
    catch(e){setNotice(e instanceof Error?e.message:'Transcription failed. Please type your question.');}
  }
  async function speak(message:string){
    const session=(await supabase?.auth.getSession())?.data.session;
    try{const response=await fetch('/api/v1/voice/speak',{method:'POST',headers:{'Content-Type':'application/json',...(session?{Authorization:`Bearer ${session.access_token}`}:{})},body:JSON.stringify({text:message,locale:localeCodes[locale]})});if(!response.ok)throw new Error();const audio=new Audio(URL.createObjectURL(await response.blob()));await audio.play();}
    catch{if('speechSynthesis'in window){const utterance=new SpeechSynthesisUtterance(message);utterance.lang=localeCodes[locale];speechSynthesis.speak(utterance);}else setNotice('Audio playback is unavailable. The response is shown as text.');}
  }
  function choosePhoto(e:ChangeEvent<HTMLInputElement>){
    const file=e.target.files?.[0];if(!file)return;
    if(file.size>10*1024*1024){setNotice('Choose an image smaller than 10 MB.');e.currentTarget.value='';return;}
    if(!['image/jpeg','image/png','image/webp'].includes(file.type)){setNotice('Choose a JPG, PNG, or WEBP leaf photo.');e.currentTarget.value='';return;}
    setSelectedPhoto(file);setPhotoPreview(URL.createObjectURL(file));setScan(null);setNotice('');
  }
  function discardPhoto(){setSelectedPhoto(null);setPhotoPreview(null);if(photoInputRef.current)photoInputRef.current.value='';}
  async function analyzePhoto(){
    const file=selectedPhoto;if(!file||photoBusy)return;
    setPhotoBusy(true);setNotice('Checking whether the crop-screening model is ready…');setScan(null);const session=(await supabase?.auth.getSession())?.data.session;const form=new FormData();form.append('image',file);form.append('crop_id',crop);
    try{const response=await fetch('/api/v1/scans',{method:'POST',headers:session?{Authorization:`Bearer ${session.access_token}`}:{},body:form});const data=await response.json();if(!response.ok)throw new Error(data.error||data.detail||'Crop screening is unavailable.');setScan(data);setNotice('');if(supabase&&userId){const {data:saved}=await supabase.from('crop_scans').insert({user_id:userId,crop_id:crop||'unspecified',predicted_label:data.class_name||data.disease||null,model_score:data.confidence??null,uncertainty:data.uncertainty||'unknown',result:data,model_version:data.model_version||null}).select('id,crop_id,predicted_label,uncertainty,created_at').single();if(saved)setRecentScans([saved,...recentScans].slice(0,3));}}
    catch(e){setNotice(e instanceof Error?e.message:'Photo screening failed.');}
    finally{setPhotoBusy(false);}
  }
  async function getWeather(e:FormEvent){e.preventDefault();setWeatherError('');setWeather(null);const session=(await supabase?.auth.getSession())?.data.session;
    try{const response=await fetch(`/api/v1/weather?q=${encodeURIComponent(location)}&crop=${encodeURIComponent(crop)}&locale=${locale}`,{headers:session?{Authorization:`Bearer ${session.access_token}`}:{}});const data=await response.json();if(!response.ok)throw new Error(data.error||'Weather information is unavailable.');setWeather(data);if(supabase&&userId)await supabase.from('weather_snapshots').insert({user_id:userId,location_label:data.location,provider:data.source,payload:data,fetched_at:data.fetched_at});const reportResponse=await fetch(`/api/v1/farm-report?location=${encodeURIComponent(location)}&crop=${encodeURIComponent(crop)}&locale=${locale}`,{headers:session?{Authorization:`Bearer ${session.access_token}`}:{}});const reportData=await reportResponse.json();if(reportResponse.ok){setFarmReport(reportData);if(supabase&&userId)await supabase.from('farm_reports').insert({user_id:userId,crop_id:crop||null,location_label:reportData.location,report:reportData});}}
    catch(e){setWeatherError(e instanceof Error?e.message:'Could not update weather.');}
  }
  async function signOut(){await supabase?.auth.signOut();router.replace('/');}
  const handleLanguage=(value:string)=>{const next=localeFrom(value);setLocale(next);if(messagesState.length<=1)setMessagesState([{role:'assistant',content:messages[next].hello}]);if(supabase&&userId)void supabase.from('profiles').upsert({user_id:userId,preferred_language:localeCodes[next],updated_at:new Date().toISOString()});};

  return <div className="app-shell"><header className="topbar"><a className="brand" href="/"><Image src="/branding/krishiunnati-logo.png" alt="KrishiUnnati logo" width={1017} height={182} priority /></a><div className="top-actions"><label className="sr-only" htmlFor="language">{t.language}</label><select className="language-select" id="language" value={locale} onChange={e=>handleLanguage(e.target.value)}><option value="en">English</option><option value="hi">हिन्दी</option><option value="ta">தமிழ்</option></select><a className="icon-button" href="/settings" aria-label="Settings" title="Privacy and settings"><Settings size={18}/></a><button className="icon-button" onClick={signOut} title="Sign out" aria-label="Sign out"><LogOut size={18}/></button></div></header>
    <main className="main-wrap"><div className="welcome-row"><div><h1>{locale==='hi'?'आज आपकी फसल को किस मदद की ज़रूरत है?':locale==='ta'?'இன்று உங்கள் பயிருக்கு என்ன உதவி தேவை?':'Let’s understand what your crop needs.'}</h1><p>{locale==='hi'?'अपनी फसल की बात अपनी भाषा में बताएं।':locale==='ta'?'உங்கள் மொழியில் பயிரைப் பற்றி சொல்லுங்கள்.':'Tell us what you noticed. You can speak, type, or share a leaf photo.'}</p><div className="devanagari-tag">कृषि उन्नति · किसान की बात, किसान की भाषा में</div></div><span className="status-chip"><i/> {userId?'Private farmer session':'Connecting securely'}</span></div>
      <div className="layout-grid"><section className="chat-card" aria-label="Crop help chat"><div className="chat-head"><div className="bot-avatar"><Leaf size={20}/></div><div><strong>KrishiUnnati assistant</strong><small>Short questions · practical next steps</small></div></div><div className="chat-scroll" ref={scrollRef} aria-live="polite">{messagesState.map((m,i)=><div key={i} className={`message ${m.role}`}><span>{m.content}</span>{m.role==='assistant'&&m.urgency&&<span className={`urgency-chip ${m.urgency}`}>{photoMessages[locale].urgency}: {photoMessages[locale][m.urgency]}</span>}{m.role==='assistant'&&m.needsExpert&&<span className="expert-chip">{photoMessages[locale].expert}</span>}{m.role==='assistant'&&<button className="speak-inline" onClick={()=>speak(m.content)} aria-label="Listen to response"><Volume2 size={14}/></button>}</div>)}{busy&&<div className="message assistant"><span className="typing-dots">● ● ●</span></div>}</div>
        <div className="quick-actions">{([['crop',t.crop],['water',t.water],['weather',t.weather],['other',t.other]] as const).map(([key,label])=><button key={key} className="quick-action" onClick={()=>void sendMessage(label)}>{label}</button>)}</div>
        {transcript!==''&&<div className="transcript-review"><label htmlFor="transcript">{t.transcriptReview}</label><textarea id="transcript" value={transcript} onChange={e=>setTranscript(e.target.value)}/><div><button className="small-button" onClick={()=>void sendMessage(transcript)}>{t.send}</button><button className="muted-link" onClick={()=>setTranscript('')}>Discard</button></div></div>}
        {notice&&<div className="inline-notice" role="status">{notice}</div>}
        {scan&&<div className="scan-result" role="status"><strong>{scan.status==='model_not_ready'?'Photo screening needs setup':scan.uncertainty==='uncertain'?'The photo is hard to classify':`Possible result: ${scan.disease||scan.class_name||'review needed'}`}</strong><span>{scan.message||scan.guidance||`Model score: ${Math.round((scan.confidence||0)*100)}% (not a calibrated disease probability). ${scan.urgency||''}`}</span>{scan.alternatives?.length>0&&<p>Other possibilities: {scan.alternatives.map((x:any)=>x.disease||x.class_name).join(', ')}</p>}<small>This is screening only. Confirm important decisions with a local agricultural expert.</small></div>}
        <div className="attachment-row"><label htmlFor="photo">{t.choosePhoto}</label><input ref={photoInputRef} id="photo" type="file" accept="image/jpeg,image/png,image/webp" onChange={choosePhoto}/><label htmlFor="crop-select">Crop</label><select id="crop-select" value={crop} onChange={e=>setCrop(e.target.value)}><option value="">{t.selectCrop}</option>{[['apple','Apple'],['blueberry','Blueberry'],['cherry','Cherry'],['maize','Maize'],['grape','Grape'],['orange','Orange'],['peach','Peach'],['pepper','Bell pepper'],['potato','Potato'],['raspberry','Raspberry'],['soybean','Soybean'],['squash','Squash'],['strawberry','Strawberry'],['tomato','Tomato'],['other','Other crop (chat help only)']].map(([id,name])=><option key={id} value={id}>{name}</option>)}</select></div>
        {photoPreview&&<div className="photo-review"><Image src={photoPreview} alt="Selected crop leaf preview" width={128} height={128} unoptimized/><div><p>{photoMessages[locale].review}</p><div className="photo-actions"><button className="small-button" onClick={()=>void analyzePhoto()} disabled={photoBusy}>{photoBusy?'Checking…':photoMessages[locale].analyze}</button><button className="muted-link" onClick={discardPhoto} disabled={photoBusy}>{photoMessages[locale].remove}</button></div></div></div>}
        <form className="composer" onSubmit={onSubmit}><button type="button" className={`icon-button voice-button ${recording?'recording':''}`} onClick={recording?stopRecording:startRecording} aria-label={recording?'Stop recording':'Speak a message'} title={recording?'Stop recording':'Speak'}>{recording?<MicOff size={18}/>:<Mic size={18}/>}</button><textarea aria-label={t.placeholder} value={text} onChange={e=>setText(e.target.value)} placeholder={t.placeholder} rows={1} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();void sendMessage(text)}}}/><button className="send-button" type="submit" aria-label={t.send} disabled={busy||!text.trim()}><Send size={18}/></button></form>
      </section>
      <aside className="side-column"><section className="side-card"><div className="side-title"><h2>{t.weatherTitle}</h2><CloudSun size={19} color="#64874b"/></div><form className="weather-form" onSubmit={getWeather}><input className="location-input" value={location} onChange={e=>setLocation(e.target.value)} placeholder={t.location} aria-label={t.location} required/><button className="small-button" type="submit">{t.getWeather}</button></form>{weatherError&&<p className="error-box">{weatherError}</p>}{weather&&<><p className="weather-place">{weather.location}</p><div className="weather-grid"><div className="weather-stat"><span>{t.temperature}</span><strong>{weather.current.temperature_2m??'—'}°C</strong></div><div className="weather-stat"><span>{t.humidity}</span><strong>{weather.current.relative_humidity_2m??'—'}%</strong></div><div className="weather-stat"><span>{t.rain}</span><strong>{weather.current.precipitation??'—'} mm</strong></div><div className="weather-stat"><span>{t.wind}</span><strong>{weather.current.wind_speed_10m??'—'} km/h</strong></div></div><p className="weather-foot">{weather.source} · Updated {new Date(weather.fetched_at).toLocaleString()} {weather.stale?'· Cached data':''}</p></>}</section>
      <section className="side-card"><div className="side-title"><h2>{t.report}</h2><Leaf size={18} color="#64874b"/></div>{farmReport?<div className="report-box"><strong>What to keep in mind</strong>{farmReport.summary}<p>{farmReport.limitations}</p><small>Evidence: {farmReport.evidence?.join(' · ')}</small></div>:<p className="report-intro">{t.reportIntro}</p>}<div className="notice"><strong>Get expert confirmation.</strong><br/>Weather and photo screening can be wrong or incomplete. Follow local agricultural guidance.</div></section>
      {recentScans.length>0&&<section className="side-card"><div className="side-title"><h2>{t.recentChecks}</h2><span>Private to you</span></div>{recentScans.map(item=><div className="recent-scan" key={item.id}><strong>{item.predicted_label||'Screening check'}</strong><span>{item.crop_id} · {item.uncertainty}</span></div>)}</section>}</aside></div>
    </main><footer className="disclaimer">KrishiUnnati offers educational crop screening, not confirmed diagnosis. Do not make expensive or chemical-treatment decisions from this result alone. Contact a local agricultural extension expert when symptoms are severe, spreading, or unclear.</footer></div>;
}
