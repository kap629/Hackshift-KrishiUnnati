import {NextRequest,NextResponse} from 'next/server';
import {createClient} from '@supabase/supabase-js';
import {authenticatedUser} from '@/lib/server/auth';

export async function GET(request:NextRequest){
 const auth=await authenticatedUser(request);if(auth.error)return auth.error;
 const {data,error}=await auth.supabase!.from('profiles').select('*').eq('user_id',auth.user!.id).maybeSingle();
 if(error)return NextResponse.json({error:'Could not load your profile.'},{status:500});return NextResponse.json({profile:data});
}
export async function PATCH(request:NextRequest){
 const auth=await authenticatedUser(request);if(auth.error)return auth.error;
 let body:any;try{body=await request.json()}catch{return NextResponse.json({error:'Send valid JSON.'},{status:400})}
 const updates:any={updated_at:new Date().toISOString()};
 if(body.preferred_language!==undefined){if(!['en-IN','hi-IN','ta-IN'].includes(body.preferred_language))return NextResponse.json({error:'Language is not supported.'},{status:400});updates.preferred_language=body.preferred_language;}
 if(body.general_location!==undefined){if(typeof body.general_location!=='string'||body.general_location.length>120)return NextResponse.json({error:'Location must be under 120 characters.'},{status:400});updates.general_location=body.general_location.trim()||null;}
 if(body.crops!==undefined){if(!Array.isArray(body.crops)||body.crops.length>20||body.crops.some((x:any)=>typeof x!=='string'||x.length>60))return NextResponse.json({error:'Crop list is invalid.'},{status:400});updates.crops=body.crops;}
 const {data,error}=await auth.supabase!.from('profiles').upsert({user_id:auth.user!.id,...updates}).select().single();
 if(error)return NextResponse.json({error:'Could not update your profile.'},{status:500});return NextResponse.json({profile:data});
}
export async function DELETE(request:NextRequest){
 const auth=await authenticatedUser(request);if(auth.error)return auth.error;
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!url||!key)return NextResponse.json({error:'Account deletion needs server-side Supabase admin configuration.'},{status:503});
 const admin=createClient(url,key,{auth:{persistSession:false}});const {error}=await admin.auth.admin.deleteUser(auth.user!.id);
 if(error)return NextResponse.json({error:'Account deletion failed. Please contact the project administrator.'},{status:502});
 return NextResponse.json({deleted:true});
}
