import {NextRequest,NextResponse} from 'next/server';
import {authenticatedUser} from '@/lib/server/auth';

export async function GET(request:NextRequest){
 const auth=await authenticatedUser(request);if(auth.error)return auth.error;
 const url=process.env.INFERENCE_SERVICE_URL;if(!url)return NextResponse.json({status:'model_not_ready',model_ready:false,message:'Model service is not configured.'});
 try{const response=await fetch(`${url.replace(/\/$/,'')}/health`,{cache:'no-store',signal:AbortSignal.timeout(5000)});const result=await response.json();return NextResponse.json(result,{status:response.ok?200:503});}
 catch{return NextResponse.json({status:'model_not_ready',model_ready:false,message:'Model service is unreachable.'},{status:503});}
}
