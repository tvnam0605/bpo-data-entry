import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { getServerSession } from 'next-auth'
import { supabase } from '@/lib/supabase'

const requireAdmin = async () => {
  const session = await getServerSession()
  if (!session?.user?.email) throw new Error('Unauthorized')
}

export async function GET() {
  try {
    await requireAdmin()
    const { data, error } = await supabase
      .from('bpo_users')
      .select('id, username, full_name, created_at')
      .order('created_at', { ascending: false })
    if (error) throw new Error(error.message)
    return NextResponse.json({ users: data })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: e.message === 'Unauthorized' ? 401 : 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireAdmin()
    const { username, password, full_name } = await req.json()
    if (!username?.trim() || !password || !full_name?.trim()) {
      return NextResponse.json({ error: 'Thiếu thông tin' }, { status: 400 })
    }
    const hash = await bcrypt.hash(password, 10)
    const { error } = await supabase
      .from('bpo_users')
      .insert({ username: username.trim(), password_hash: hash, full_name: full_name.trim() })
    if (error) {
      if (error.code === '23505') return NextResponse.json({ error: 'Username đã tồn tại' }, { status: 400 })
      throw new Error(error.message)
    }
    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: e.message === 'Unauthorized' ? 401 : 500 })
  }
}

export async function PUT(req: NextRequest) {
  try {
    await requireAdmin()
    const { id, password } = await req.json()
    if (!id || !password) {
      return NextResponse.json({ error: 'Thiếu thông tin' }, { status: 400 })
    }
    const hash = await bcrypt.hash(password, 10)
    const { error } = await supabase
      .from('bpo_users')
      .update({ password_hash: hash })
      .eq('id', id)
    if (error) throw new Error(error.message)
    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: e.message === 'Unauthorized' ? 401 : 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    await requireAdmin()
    const { id } = await req.json()
    const { error } = await supabase.from('bpo_users').delete().eq('id', id)
    if (error) throw new Error(error.message)
    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: e.message === 'Unauthorized' ? 401 : 500 })
  }
}