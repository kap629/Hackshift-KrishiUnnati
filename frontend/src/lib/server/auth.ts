import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

export async function authenticatedUser(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!url || !key) return { error: NextResponse.json({ error: 'Supabase is not configured.' }, { status: 503 }) };
  if (!token) return { error: NextResponse.json({ error: 'Sign in to continue.' }, { status: 401 }) };
  const supabase = createClient(url, key, { auth: { persistSession: false }, global: { headers: { Authorization: `Bearer ${token}` } } });
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return { error: NextResponse.json({ error: 'Your session is invalid or expired. Please sign in again.' }, { status: 401 }) };
  return { user: data.user, supabase };
}
