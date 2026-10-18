import { NextRequest,NextResponse } from 'next/server';
import { authenticatedUser } from '@/lib/server/auth';

export const runtime='nodejs';
export const maxDuration=60;
export async function POST(request:NextRequest){
  const auth=await authenticatedUser(request);if(auth.error)return auth.error;
  const service=process.env.INFERENCE_SERVICE_URL,token=process.env.INFERENCE_SERVICE_TOKEN;
  if(!service)return NextResponse.json({status:'model_not_ready',error:'The crop-screening model is not installed. Follow the README to prepare the dataset and train the model.'},{status:503});
  const form=await request.formData();const image=form.get('image'),cropId=String(form.get('crop_id')||'').slice(0,80);
  if(!(image instanceof File))return NextResponse.json({error:'Choose a leaf photo first.'},{status:400});
  if(image.size===0||image.size>10*1024*1024)return NextResponse.json({error:'Image must be smaller than 10 MB.'},{status:413});
  const valid=['image/jpeg','image/png','image/webp'];if(!valid.includes(image.type))return NextResponse.json({error:'Use a JPG, PNG, or WEBP photo.'},{status:415});
  try{const outgoing=new FormData();outgoing.append('image',image,image.name);outgoing.append('crop_id',cropId);const response=await fetch(`${service.replace(/\/$/,'')}/predict`,{method:'POST',headers:token?{'X-Service-Token':token}:{},body:outgoing,cache:'no-store',signal:AbortSignal.timeout(50000)});const result=await response.json();return NextResponse.json(result,{status:response.status});}
  catch{return NextResponse.json({error:'The screening service is unavailable. No prediction was made.'},{status:502});}
}
