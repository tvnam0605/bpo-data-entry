'use client'

import { useSession, signIn, signOut } from 'next-auth/react'
import { useEffect, useState } from 'react'

type BPOUser = { id: string; username: string; full_name: string; created_at: string }

export default function AdminPage() {
  const { data: session, status } = useSession()
  const [sheetId, setSheetId] = useState('')
  const [inputValue, setInputValue] = useState('')
  const [saving, setSaving] = useState(false)
  const [loadingConfig, setLoadingConfig] = useState(true)
  const [users, setUsers] = useState<BPOUser[]>([])
  const [loadingUsers, setLoadingUsers] = useState(false)
  const [newUsername, setNewUsername] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newFullName, setNewFullName] = useState('')
  const [addingUser, setAddingUser] = useState(false)
  const [selectedUser, setSelectedUser] = useState<BPOUser | null>(null)
  const [resetPassword, setResetPassword] = useState('')
  const [resetting, setResetting] = useState(false)
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 2500)
  }

  useEffect(() => {
    if (status !== 'authenticated') return
    fetch('/api/config')
      .then(r => r.json())
      .then(d => { setSheetId(d.sheet_id ?? ''); setInputValue(d.sheet_id ?? '') })
      .finally(() => setLoadingConfig(false))
    fetchUsers()
  }, [status])

  const fetchUsers = async () => {
    setLoadingUsers(true)
    try {
      const res = await fetch('/api/bpo-users')
      const data = await res.json()
      if (res.ok) setUsers(data.users)
    } finally {
      setLoadingUsers(false)
    }
  }

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

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newUsername.trim() || !newPassword || !newFullName.trim()) return
    setAddingUser(true)
    try {
      const res = await fetch('/api/bpo-users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: newUsername, password: newPassword, full_name: newFullName }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setNewUsername('')
      setNewPassword('')
      setNewFullName('')
      showToast('Đã tạo user')
      fetchUsers()
    } catch (e: any) {
      showToast(e.message || 'Tạo user thất bại', 'error')
    } finally {
      setAddingUser(false)
    }
  }

  const handleDeleteUser = async () => {
    if (!selectedUser) return
    if (!confirm(`Xóa user "${selectedUser.username}"?`)) return
    try {
      const res = await fetch('/api/bpo-users', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: selectedUser.id }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      showToast('Đã xóa user')
      setSelectedUser(null)
      fetchUsers()
    } catch (e: any) {
      showToast(e.message || 'Xóa thất bại', 'error')
    }
  }

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedUser || !resetPassword) return
    setResetting(true)
    try {
      const res = await fetch('/api/bpo-users', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: selectedUser.id, password: resetPassword }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      showToast('Đã đổi mật khẩu')
      setResetPassword('')
    } catch (e: any) {
      showToast(e.message || 'Đổi mật khẩu thất bại', 'error')
    } finally {
      setResetting(false)
    }
  }

  if (status === 'loading') {
    return <div className="flex items-center justify-center h-screen text-sm text-gray-400">Đang tải...</div>
  }

  if (status === 'unauthenticated') {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="bg-white border border-gray-200 rounded-lg p-8 w-80 text-center">
          <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center mx-auto mb-4">
            <span className="text-blue-600 text-lg">🔒</span>
          </div>
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
        <span className="font-medium text-gray-800">Admin</span>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-400">{session?.user?.email}</span>
          <button onClick={() => signOut()} className="text-xs text-gray-400 hover:text-gray-600">Đăng xuất</button>
        </div>
      </div>

      <div className="max-w-3xl mx-auto mt-8 px-4 space-y-4">
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h2 className="font-medium text-gray-800 mb-1">Sheet tháng hiện tại</h2>
          <p className="text-xs text-gray-400 mb-4">Paste link Google Sheet hoặc Sheet ID.</p>
          {loadingConfig ? (
            <div className="h-8 bg-gray-100 rounded animate-pulse mb-3" />
          ) : (
            <>
              {sheetId && (
                <div className="mb-3 p-2.5 bg-gray-50 rounded border border-gray-100">
                  <p className="text-xs text-gray-400 mb-0.5">Hiện tại</p>
                  <p className="text-xs font-mono text-gray-600 break-all">{sheetId}</p>
                </div>
              )}
              <input
                type="text"
                value={inputValue}
                onChange={e => setInputValue(e.target.value)}
                placeholder="https://docs.google.com/spreadsheets/d/..."
                className="w-full px-3 py-2 text-xs border border-gray-200 rounded-md focus:outline-none focus:border-blue-400 font-mono mb-3"
              />
              <button
                onClick={handleSave}
                disabled={saving || !inputValue.trim()}
                className="px-4 py-2 text-xs bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? 'Đang lưu...' : 'Cập nhật'}
              </button>
            </>
          )}
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h2 className="font-medium text-gray-800 mb-4">Quản lý BPO Users</h2>

          <form onSubmit={handleAddUser} className="grid grid-cols-4 gap-2 mb-5">
            <input
              type="text"
              value={newFullName}
              onChange={e => setNewFullName(e.target.value)}
              placeholder="Họ và tên"
              required
              className="px-3 py-2 text-xs border border-gray-200 rounded-md focus:outline-none focus:border-blue-400"
            />
            <input
              type="text"
              value={newUsername}
              onChange={e => setNewUsername(e.target.value)}
              placeholder="Username"
              required
              className="px-3 py-2 text-xs border border-gray-200 rounded-md focus:outline-none focus:border-blue-400"
            />
            <input
              type="password"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              placeholder="Password"
              required
              className="px-3 py-2 text-xs border border-gray-200 rounded-md focus:outline-none focus:border-blue-400"
            />
            <button
              type="submit"
              disabled={addingUser}
              className="px-4 py-2 text-xs bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {addingUser ? '...' : '+ Thêm user'}
            </button>
          </form>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-gray-400 mb-2">Danh sách ({users.length})</p>
              {loadingUsers ? (
                <div className="space-y-1.5">
                  {[1,2,3].map(i => <div key={i} className="h-10 bg-gray-100 rounded animate-pulse" />)}
                </div>
              ) : users.length === 0 ? (
                <p className="text-xs text-gray-400 py-4 text-center">Chưa có user nào</p>
              ) : (
                <div className="space-y-1">
                  {users.map(u => (
                    <button
                      key={u.id}
                      onClick={() => { setSelectedUser(u); setResetPassword('') }}
                      className={`w-full text-left px-3 py-2.5 rounded border transition-colors ${
                        selectedUser?.id === u.id
                          ? 'bg-blue-50 border-blue-200'
                          : 'bg-gray-50 border-gray-100 hover:bg-gray-100'
                      }`}
                    >
                      <p className="text-xs font-medium text-gray-800">{u.full_name}</p>
                      <p className="text-xs text-gray-400">@{u.username} · {new Date(u.created_at).toLocaleDateString('vi-VN')}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div>
              {selectedUser ? (
                <div>
                  <p className="text-xs text-gray-400 mb-2">Chi tiết</p>
                  <div className="p-3 bg-gray-50 rounded border border-gray-100 mb-3">
                    <p className="text-xs font-medium text-gray-800">{selectedUser.full_name}</p>
                    <p className="text-xs text-gray-500">@{selectedUser.username}</p>
                    <p className="text-xs text-gray-400 mt-1">Tạo: {new Date(selectedUser.created_at).toLocaleDateString('vi-VN')}</p>
                  </div>

                  <form onSubmit={handleResetPassword} className="mb-3">
                    <p className="text-xs text-gray-500 mb-1.5">Đổi mật khẩu</p>
                    <div className="flex gap-2">
                      <input
                        type="password"
                        value={resetPassword}
                        onChange={e => setResetPassword(e.target.value)}
                        placeholder="Mật khẩu mới"
                        required
                        className="flex-1 px-3 py-2 text-xs border border-gray-200 rounded-md focus:outline-none focus:border-blue-400"
                      />
                      <button
                        type="submit"
                        disabled={resetting}
                        className="px-3 py-2 text-xs bg-gray-800 text-white rounded-md hover:bg-gray-900 disabled:opacity-50"
                      >
                        {resetting ? '...' : 'Đổi'}
                      </button>
                    </div>
                  </form>

                  <button
                    onClick={handleDeleteUser}
                    className="w-full px-3 py-2 text-xs text-red-500 border border-red-200 rounded-md hover:bg-red-50 transition-colors"
                  >
                    Xóa user này
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-center h-full text-xs text-gray-300 py-8">
                  Chọn user để xem chi tiết
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {toast && (
        <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 px-4 py-2 rounded-md text-xs text-white shadow-md z-50 ${
          toast.type === 'error' ? 'bg-red-500' : 'bg-gray-800'
        }`}>
          {toast.msg}
        </div>
      )}
    </div>
  )
}