import { NextRequest, NextResponse } from 'next/server';
import { authenticatedUser } from '@/lib/server/auth';

export const runtime = 'nodejs';
export const maxDuration = 60;
export async function POST(request: NextRequest) {
  const auth = await authenticatedUser(request); if (auth.error) return auth.error;
  const apiKey=process.env.GEMINI_API_KEY, model=process.env.GEMINI_TRANSCRIBE_MODEL;
  if(!apiKey||!model)return NextResponse.json({error:'Voice transcription is not configured. You can type your question instead.'},{status:503});
  const form=await request.formData();const audio=form.get('audio');const locale=String(form.get('locale')||'en-IN');
  if(!(audio instanceof File))return NextResponse.json({error:'Audio file is missing.'},{status:400});
  if(audio.size===0||audio.size>10*1024*1024)return NextResponse.json({error:'Audio must be between 1 byte and 10 MB.'},{status:413});
  const mime=audio.type.split(';')[0].toLowerCase();
  const allowed=['audio/webm','audio/ogg','audio/wav','audio/mpeg','audio/mp4','audio/aac','audio/opus'];
  if(!allowed.includes(mime))return NextResponse.json({error:'This audio format is not supported by the service. Please type your question.'},{status:415});
  const bytes=Buffer.from(await audio.arrayBuffer());
  let uploadedName:string|undefined;
  try{
    const start=await fetch('https://generativelanguage.googleapis.com/upload/v1beta/files',{method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':apiKey,'X-Goog-Upload-Protocol':'resumable','X-Goog-Upload-Command':'start','X-Goog-Upload-Header-Content-Length':String(bytes.length),'X-Goog-Upload-Header-Content-Type':mime},body:JSON.stringify({file:{display_name:'krishiunnati-audio'}}),cache:'no-store'});
    if(!start.ok)return NextResponse.json({error:'Speech upload failed. Please type your question.'},{status:502});
    const uploadUrl=start.headers.get('x-goog-upload-url');if(!uploadUrl)return NextResponse.json({error:'Speech upload could not be started.'},{status:502});
    const uploaded=await fetch(uploadUrl,{method:'POST',headers:{'Content-Length':String(bytes.length),'X-Goog-Upload-Offset':'0','X-Goog-Upload-Command':'upload, finalize','Content-Type':mime},body:bytes,cache:'no-store'});
    if(!uploaded.ok)return NextResponse.json({error:'Speech upload failed. Please type your question.'},{status:502});
    const fileInfo=await uploaded.json();uploadedName=fileInfo.file?.name;const uri=fileInfo.file?.uri;
    if(!uri||!uploadedName)return NextResponse.json({error:'Speech file was not accepted by the transcription service.'},{status:502});
    const languageHints=['en-IN','hi-IN','ta-IN'].includes(locale)?[locale]:[];
    const response=await fetch('https://generativelanguage.googleapis.com/v1beta/interactions',{method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':apiKey},cache:'no-store',body:JSON.stringify({model,input:[{type:'audio',uri,mime_type:mime}],generation_config:{transcription_config:{language_codes:languageHints}}})});
    if(!response.ok)return NextResponse.json({error:'Speech transcription failed. Please try again or type your question.'},{status:502});
    const data=await response.json();const transcript=String(data.output_text||'').trim();
    if(!transcript)return NextResponse.json({error:'No speech was recognized. Please try again or type your question.'},{status:422});
    return NextResponse.json({transcript,language_hint:locale,needs_user_review:true});
  }catch{return NextResponse.json({error:'Speech service is unavailable. Please type your question.'},{status:502});}
  finally{if(uploadedName)await fetch(`https://generativelanguage.googleapis.com/v1beta/${uploadedName}`,{method:'DELETE',headers:{'x-goog-api-key':apiKey},cache:'no-store'}).catch(()=>{});}
}
