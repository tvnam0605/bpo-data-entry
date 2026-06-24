import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { supabase } from '@/lib/supabase'

export async function GET() {
  try {
    const { data, error } = await supabase
      .from('sheet_config')
      .select('sheet_id, updated_at')
      .eq('id', 1)
      .single()
    if (error) throw new Error(error.message)
    return NextResponse.json(data)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await getServerSession()
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { sheet_id } = await req.json()
    if (!sheet_id?.trim()) {
      return NextResponse.json({ error: 'Sheet ID không hợp lệ' }, { status: 400 })
    }

    const { error } = await supabase
      .from('sheet_config')
      .update({ sheet_id: sheet_id.trim(), updated_at: new Date().toISOString() })
      .eq('id', 1)

    if (error) throw new Error(error.message)
    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
