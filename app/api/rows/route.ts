import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { appendRow, updateRow, deleteRow, getSheetsClient } from '@/lib/sheets'

const getSheetId = async (): Promise<string> => {
  const { data, error } = await supabase
    .from('sheet_config')
    .select('sheet_id')
    .eq('id', 1)
    .single()
  if (error || !data?.sheet_id) throw new Error('Sheet chưa được cấu hình')
  return data.sheet_id
}

export async function POST(req: NextRequest) {
  try {
    const { tab, values } = await req.json()
    const sheetId = await getSheetId()
    await appendRow(sheetId, tab, values)
    return NextResponse.json({ success: true })
  } catch (e: any) {
    const status = e.message?.includes('protected') ? 403 : 500
    return NextResponse.json({ error: e.message }, { status })
  }
}

export async function PUT(req: NextRequest) {
  try {
    const { range, values } = await req.json()
    const sheetId = await getSheetId()
    await updateRow(sheetId, range, values)
    return NextResponse.json({ success: true })
  } catch (e: any) {
    const status = e.message?.includes('protected') ? 403 : 500
    return NextResponse.json({ error: e.message }, { status })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { tab, rowIndex } = await req.json()
    const sheetId = await getSheetId()

    const client = await getSheetsClient()
    const meta = await client.spreadsheets.get({ spreadsheetId: sheetId })
    const sheet = meta.data.sheets?.find(s => s.properties?.title === tab)
    const gid = sheet?.properties?.sheetId

    if (gid == null) throw new Error(`Tab "${tab}" không tồn tại`)

    await deleteRow(sheetId, gid, rowIndex)
    return NextResponse.json({ success: true })
  } catch (e: any) {
    const status = e.message?.includes('protected') ? 403 : 500
    return NextResponse.json({ error: e.message }, { status })
  }
}
