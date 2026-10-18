import { NextRequest, NextResponse } from 'next/server';
import { authenticatedUser } from '@/lib/server/auth';

export const runtime = 'nodejs';
export const maxDuration = 60;
const localeToVoice:Record<string,string>={'en-IN':'Aoede','hi-IN':'Kore','ta-IN':'Kore'};
export async function POST(request:NextRequest){
  const auth=await authenticatedUser(request);if(auth.error)return auth.error;
  const key=process.env.GEMINI_API_KEY,model=process.env.GEMINI_TTS_MODEL;
  if(!key||!model)return NextResponse.json({error:'Speech playback is not configured. The written response is still available.'},{status:503});
  let body:any;try{body=await request.json()}catch{return NextResponse.json({error:'Send valid JSON.'},{status:400})}
  if(typeof body.text!=='string'||!body.text.trim()||body.text.length>1200)return NextResponse.json({error:'Text must contain 1–1,200 characters.'},{status:400});
  const locale=typeof body.locale==='string'&&Object.hasOwn(localeToVoice,body.locale)?body.locale:'en-IN';
  try{
    const upstream=await fetch('https://generativelanguage.googleapis.com/v1beta/interactions',{method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':key},cache:'no-store',body:JSON.stringify({model,input:[{type:'user_input',content:[{type:'text',text:body.text,annotations:[{type:'speech_metadata',style:`Speak clearly and warmly in the language identified by ${locale}. Use a steady, easy-to-understand pace.`}]}]}],response_format:{type:'audio'},generation_config:{speech_config:[{voice:localeToVoice[locale]||'Kore'}]}})});
    if(!upstream.ok)return NextResponse.json({error:'Speech playback is unavailable.'},{status:502});
    const result=await upstream.json();const part=result.steps?.filter((step:any)=>step.type==='model_output').flatMap((step:any)=>step.content||[]).find((content:any)=>content.type==='audio'&&content.data);
    if(!part)return NextResponse.json({error:'The speech service returned no audio.'},{status:502});
    return new NextResponse(Buffer.from(part.data,'base64'),{headers:{'Content-Type':'audio/wav','Cache-Control':'no-store'}});
  }catch{return NextResponse.json({error:'Speech playback is unavailable.'},{status:502});}
}
