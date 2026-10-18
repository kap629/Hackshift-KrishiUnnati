import {NextRequest,NextResponse} from 'next/server';
import {authenticatedUser} from '@/lib/server/auth';

export async function GET(request:NextRequest){
 const auth=await authenticatedUser(request);if(auth.error)return auth.error;
 const crop=request.nextUrl.searchParams.get('crop')?.slice(0,80)||'your crop';const location=request.nextUrl.searchParams.get('location');
 if(!location)return NextResponse.json({error:'A general location is needed for a weather-aware report.'},{status:400});
 const url=new URL('/api/v1/weather',request.url);url.searchParams.set('q',location);url.searchParams.set('locale',request.nextUrl.searchParams.get('locale')||'en');
 const response=await fetch(url,{headers:{Authorization:request.headers.get('authorization')||''},cache:'no-store'});const weather=await response.json();if(!response.ok)return NextResponse.json(weather,{status:response.status});
 const rain=weather.daily?.precipitation_probability_max?.[0];const locale=request.nextUrl.searchParams.get('locale')||'en';
 const rainy=typeof rain==='number'&&rain>=60;
 const line=locale.startsWith('hi')?(rainy?`जल्द बारिश हो सकती है। ${crop} के खेत में पानी निकलने की व्यवस्था देखें और बारिश के बाद पौधों की जांच करें।`:'मौसम पूर्वानुमान को ध्यान में रखें। पानी देने या उपचार से पहले खेत की स्थिति जांचें।'):
  locale.startsWith('ta')?(rainy?`விரைவில் மழை பெய்யலாம். ${crop} வயலில் நீர் வடிகாலைச் சரிபார்த்து, மழைக்குப் பிறகு செடிகளைப் பாருங்கள்.`:'வானிலை முன்னறிவிப்பை ஒரு வழிகாட்டியாகப் பயன்படுத்துங்கள். நீர் பாய்ச்சுவதற்கு அல்லது சிகிச்சைக்கு முன் வயலைப் பாருங்கள்.'):
  rainy?`Rain is possible soon. For ${crop}, check field drainage and inspect plants after rainfall.`:`Use the forecast as context. Check field conditions before watering or treating ${crop}.`;
 const limitations=locale.startsWith('hi')?'यह सामान्य जानकारी है, निदान या मिट्टी की नमी का माप नहीं।':locale.startsWith('ta')?'இது பொதுவான தகவல் மட்டுமே; நோயறிதல் அல்லது மண் ஈரப்பத அளவீடு அல்ல.':'This general note is not a diagnosis or a measured soil condition.';
 return NextResponse.json({source:weather.source,fetched_at:weather.fetched_at,stale:weather.stale,location:weather.location,summary:line,evidence:['Weather forecast from Open-Meteo','Crop selected by the user'],limitations});
}
