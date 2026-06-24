import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { supabase } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  try {
    const { username, password } = await req.json()
    if (!username || !password) {
      return NextResponse.json({ error: 'Thiếu username hoặc password' }, { status: 400 })
    }

    const { data: user, error } = await supabase
      .from('bpo_users')
      .select('id, username, password_hash')
      .eq('username', username.trim())
      .single()

    if (error || !user) {
      return NextResponse.json({ error: 'Username hoặc password không đúng' }, { status: 401 })
    }

    const valid = await bcrypt.compare(password, user.password_hash)
    if (!valid) {
      return NextResponse.json({ error: 'Username hoặc password không đúng' }, { status: 401 })
    }

    const res = NextResponse.json({ success: true })
    res.cookies.set('bpo_session', user.id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 12,
      path: '/',
    })
    return res
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
