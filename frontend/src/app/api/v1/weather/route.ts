import { NextRequest,NextResponse } from 'next/server';
import { authenticatedUser } from '@/lib/server/auth';

export const runtime='nodejs';
const cache=new Map<string,{at:number;data:any}>();
export async function GET(request:NextRequest){
  const auth=await authenticatedUser(request);if(auth.error)return auth.error;
  const query=request.nextUrl.searchParams.get('q')?.trim();if(!query||query.length>100)return NextResponse.json({error:'Enter a town, district, or postal code.'},{status:400});
  const locale=request.nextUrl.searchParams.get('locale')||'en';const key=query.toLocaleLowerCase();const cached=cache.get(key);
  if(cached&&Date.now()-cached.at<15*60*1000)return NextResponse.json({...cached.data,stale:false,cached:true});
  try{
    const geoUrl=new URL('https://geocoding-api.open-meteo.com/v1/search');geoUrl.searchParams.set('name',query);geoUrl.searchParams.set('count','1');geoUrl.searchParams.set('language',locale);geoUrl.searchParams.set('format','json');geoUrl.searchParams.set('countryCode','IN');
    const geoResponse=await fetch(geoUrl,{cache:'no-store',signal:AbortSignal.timeout(8000)});if(!geoResponse.ok)throw new Error('geocoding');const geo=await geoResponse.json();const place=geo.results?.[0];
    if(!place)return NextResponse.json({error:'We could not find that place. Try a nearby town or district.'},{status:404});
    const forecastUrl=new URL('https://api.open-meteo.com/v1/forecast');forecastUrl.searchParams.set('latitude',String(place.latitude));forecastUrl.searchParams.set('longitude',String(place.longitude));forecastUrl.searchParams.set('current','temperature_2m,relative_humidity_2m,precipitation,weather_code,wind_speed_10m');forecastUrl.searchParams.set('daily','temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum');forecastUrl.searchParams.set('forecast_days','3');forecastUrl.searchParams.set('timezone','auto');
    const weatherResponse=await fetch(forecastUrl,{cache:'no-store',signal:AbortSignal.timeout(8000)});if(!weatherResponse.ok)throw new Error('forecast');const w=await weatherResponse.json();
    const data={location:[place.name,place.admin1].filter(Boolean).join(', '),latitude:place.latitude,longitude:place.longitude,current:w.current,daily:w.daily,timezone:w.timezone,fetched_at:new Date().toISOString(),source:'Open-Meteo',stale:false};cache.set(key,{at:Date.now(),data});return NextResponse.json(data);
  }catch{
    if(cached)return NextResponse.json({...cached.data,stale:true,cached:true});
    return NextResponse.json({error:'Weather could not be updated. Check your connection and try again.'},{status:502});
  }
}
