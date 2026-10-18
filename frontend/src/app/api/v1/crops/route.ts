import {NextRequest,NextResponse} from 'next/server';
import {authenticatedUser} from '@/lib/server/auth';

const supported=[
  {id:'apple',name:'Apple'}, {id:'blueberry',name:'Blueberry'}, {id:'cherry',name:'Cherry'},
  {id:'maize',name:'Maize'}, {id:'grape',name:'Grape'}, {id:'orange',name:'Orange'},
  {id:'peach',name:'Peach'}, {id:'pepper',name:'Bell pepper'}, {id:'potato',name:'Potato'},
  {id:'raspberry',name:'Raspberry'}, {id:'soybean',name:'Soybean'}, {id:'squash',name:'Squash'},
  {id:'strawberry',name:'Strawberry'}, {id:'tomato',name:'Tomato'},
];
export async function GET(request:NextRequest){const auth=await authenticatedUser(request);if(auth.error)return auth.error;return NextResponse.json({crops:supported,other:{id:'other',name:'Other crop (chat help only)'}});}
