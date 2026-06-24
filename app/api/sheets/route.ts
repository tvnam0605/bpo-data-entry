import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { getSheetTabs, getSheetData } from '@/lib/sheets'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const getSheetId = async (): Promise<string> => {
  const { data, error } = await supabase
    .from('sheet_config')
    .select('sheet_id')
    .eq('id', 1)
    .single()
    .throwOnError()

  if (!data?.sheet_id) throw new Error('Sheet chưa được cấu hình')
  return data.sheet_id
}

export async function GET(req: NextRequest) {
  try {
    const tab = req.nextUrl.searchParams.get('tab')
    const sheetId = await getSheetId()

    if (!tab) {
      const tabs = await getSheetTabs(sheetId)
      return NextResponse.json({ tabs, sheetId })
    }

    const data = await getSheetData(sheetId, tab)
    return NextResponse.json({ data })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}