'use client'

import { useSession, signIn, signOut } from 'next-auth/react'
import { useEffect, useState } from 'react'

export default function AdminPage() {
  const { data: session, status } = useSession()
  const [sheetId, setSheetId] = useState('')
  const [inputValue, setInputValue] = useState('')
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 2500)
  }

  useEffect(() => {
    if (status !== 'authenticated') return
    fetch('/api/config')
      .then(r => r.json())
      .then(d => {
        setSheetId(d.sheet_id ?? '')
        setInputValue(d.sheet_id ?? '')
      })
      .finally(() => setLoading(false))
  }, [status])

  const extractSheetId = (input: string): string => {
    const match = input.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/)
    return match ? match[1] : input.trim()
  }

  const handleSave = async () => {
    const id = extractSheetId(inputValue)
    if (!id) { showToast('Sheet ID không hợp lệ', 'error'); return }
    setSaving(true)
    try {
      const res = await fetch('/api/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sheet_id: id }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setSheetId(id)
      setInputValue(id)
      showToast('Đã cập nhật Sheet ID')
    } catch (e: any) {
      showToast(e.message || 'Lưu thất bại', 'error')
    } finally {
      setSaving(false)
    }
  }

  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center h-screen text-sm text-gray-400">
        Đang tải...
      </div>
    )
  }

  if (status === 'unauthenticated') {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="bg-white border border-gray-200 rounded-lg p-8 w-80 text-center">
        
          <h1 className="font-medium text-gray-800 mb-1">Admin</h1>
          <p className="text-xs text-gray-400 mb-6">Chỉ dành cho PIC — đăng nhập bằng mail Shopee hoặc SPX</p>
          <button
            onClick={() => signIn('google')}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 border border-gray-200 rounded-md text-sm hover:bg-gray-50 transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Đăng nhập với Google
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 font-sans text-sm">
      <div className="flex items-center justify-between px-6 py-3 bg-white border-b border-gray-200">
        <span className="font-medium text-gray-800">Admin — Cấu hình Sheet</span>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-400">{session?.user?.email}</span>
          <button
            onClick={() => signOut()}
            className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
          >
            Đăng xuất
          </button>
        </div>
      </div>

      <div className="max-w-xl mx-auto mt-12 px-4">
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h2 className="font-medium text-gray-800 mb-1">Sheet tháng hiện tại</h2>
          <p className="text-xs text-gray-400 mb-5">
            Paste link Google Sheet hoặc Sheet ID. BPO sẽ thấy sheet mới ngay lập tức.
          </p>

          {loading ? (
            <div className="h-10 bg-gray-100 rounded-md animate-pulse mb-4" />
          ) : (
            <>
              {sheetId && (
                <div className="mb-4 p-3 bg-gray-50 rounded-md border border-gray-100">
                  <p className="text-xs text-gray-400 mb-0.5">Sheet ID hiện tại</p>
                  <p className="text-xs font-mono text-gray-600 break-all">{sheetId}</p>
                </div>
              )}

              <label className="block text-xs text-gray-500 mb-1.5">Sheet ID hoặc link mới</label>
              <input
                type="text"
                value={inputValue}
                onChange={e => setInputValue(e.target.value)}
                placeholder="https://docs.google.com/spreadsheets/d/..."
                className="w-full px-3 py-2 text-xs border border-gray-200 rounded-md focus:outline-none focus:border-blue-400 font-mono"
              />

              <div className="flex gap-2 mt-4">
                <button
                  onClick={handleSave}
                  disabled={saving || !inputValue.trim()}
                  className="px-4 py-2 text-xs bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {saving ? 'Đang lưu...' : 'Cập nhật'}
                </button>
                <a
                  href="/"
                  className="px-4 py-2 text-xs border border-gray-200 rounded-md hover:bg-gray-50 transition-colors text-gray-600"
                >
                  Xem BPO view
                </a>
              </div>
            </>
          )}
        </div>

        <div className="mt-4 bg-amber-50 border border-amber-100 rounded-lg p-4">
          <p className="text-xs text-amber-700 font-medium mb-1">Lưu ý</p>
          <ul className="text-xs text-amber-600 space-y-1 list-disc list-inside">
            <li>Service Account phải được share quyền Editor trên Sheet mới</li>
            <li>Thay đổi có hiệu lực ngay — BPO không cần reload</li>
            <li>Các ô protected trong Sheet sẽ báo lỗi khi BPO cố sửa</li>
          </ul>
        </div>
      </div>

      {toast && (
        <div
          className={`fixed bottom-6 left-1/2 -translate-x-1/2 px-4 py-2 rounded-md text-xs text-white shadow-md z-50 ${
            toast.type === 'error' ? 'bg-red-500' : 'bg-gray-800'
          }`}
        >
          {toast.msg}
        </div>
      )}
    </div>
  )
}
