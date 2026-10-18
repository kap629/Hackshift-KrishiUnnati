'use client';
import Image from 'next/image';
import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabase } from '@/lib/supabase/client';
import { Locale,localeCodes,localeFrom,messages } from '@/lib/i18n';

export default function LoginPage() {
  const router = useRouter();
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [locale,setLocale]=useState<Locale>('en');
  const supabase = getSupabase();
  const t=messages[locale];

  async function requestCode(event: FormEvent) {
    event.preventDefault(); setError(''); setNotice('');
    if (!supabase) { setError('Phone sign-in is not configured yet. Add Supabase URL, publishable key, and an SMS provider.'); return; }
    if (!/^\+[1-9]\d{7,14}$/.test(phone.replace(/[\s()-]/g, ''))) { setError('Enter a phone number with country code, for example +91…'); return; }
    setBusy(true);
    const { error: authError } = await supabase.auth.signInWithOtp({ phone: phone.replace(/[\s()-]/g, '') });
    setBusy(false);
    if (authError) { setError(authError.message); return; }
    setSent(true); setNotice(t.otpNotice);
  }

  async function verifyCode(event: FormEvent) {
    event.preventDefault(); setError(''); setBusy(true);
    if (!supabase) { setBusy(false); setError('Supabase sign-in is not configured.'); return; }
    const { error: authError } = await supabase.auth.verifyOtp({ phone: phone.replace(/[\s()-]/g, ''), token: code, type: 'sms' });
    setBusy(false);
    if (authError) { setError(authError.message); return; }
    router.replace('/chat');
  }

  return <main className="auth-page"><div className="auth-wrap"><Link href="/" className="auth-logo"><Image src="/branding/krishiunnati-logo.png" alt="KrishiUnnati logo" width={1017} height={182} priority /></Link><section className="auth-card"><label className="field-label" htmlFor="auth-language">{t.language}</label><select id="auth-language" className="language-select" value={locale} onChange={e=>setLocale(localeFrom(e.target.value))}><option value="en">English</option><option value="hi">हिन्दी</option><option value="ta">தமிழ்</option></select><h1>{t.loginTitle}</h1><p>{t.loginIntro}</p><div className="devanagari-tag">कृषि उन्नति · किसान की बात, किसान की भाषा में</div><form onSubmit={sent ? verifyCode : requestCode}><label className="field-label" htmlFor="phone">{t.phoneLabel}</label><input id="phone" className="auth-input" type="tel" autoComplete="tel" placeholder={t.phoneExample} value={phone} onChange={e=>setPhone(e.target.value)} disabled={sent || busy} required />{sent && <><label className="field-label" htmlFor="otp">{t.otpLabel}</label><input id="otp" className="auth-input" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,''))} required /></>}<button className="primary-button" type="submit" disabled={busy}>{busy ? <><span className="spinner"/> {t.pleaseWait}</> : sent ? t.verify : t.sendCode}</button></form>{error && <div className="error-box" role="alert">{error}</div>}{notice && <div className="success-box" role="status">{notice}</div>}<p className="helper">{t.phoneHint}</p>{sent && <button className="muted-link" onClick={()=>{setSent(false);setCode('');setNotice('');}}>{t.changePhone}</button>}</section><p className="footer-brand">कृषि उन्नति</p></div></main>;
}
