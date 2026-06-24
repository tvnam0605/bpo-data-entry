'use client'

import { useEffect, useState, useCallback, useRef } from 'react'

type Grid = string[][]
type CellPos = { r: number; c: number }
type Selection = { start: CellPos; end: CellPos }

const POLL_INTERVAL = 5000
const MIN_ROWS = 50
const MIN_COLS = 26
const COL_WIDTH = 100
const ROW_HEIGHT = 22
const ROW_HEADER_WIDTH = 48
const COL_HEADER_HEIGHT = 24
const BUFFER = 20

function colLabel(i: number): string {
  let label = ''
  let n = i
  while (n >= 0) {
    label = String.fromCharCode(65 + (n % 26)) + label
    n = Math.floor(n / 26) - 1
  }
  return label
}

function toRange(tab: string, row: number, col: number): string {
  return `'${tab}'!${colLabel(col)}${row + 1}`
}

function normalizeSelection(sel: Selection): { r1: number; c1: number; r2: number; c2: number } {
  return {
    r1: Math.min(sel.start.r, sel.end.r),
    c1: Math.min(sel.start.c, sel.end.c),
    r2: Math.max(sel.start.r, sel.end.r),
    c2: Math.max(sel.start.c, sel.end.c),
  }
}

function inSelection(r: number, c: number, sel: Selection | null): boolean {
  if (!sel) return false
  const { r1, c1, r2, c2 } = normalizeSelection(sel)
  return r >= r1 && r <= r2 && c >= c1 && c <= c2
}

export default function BPOPage() {
  const [tabs, setTabs] = useState<string[]>([])
  const [activeTab, setActiveTab] = useState('')
  const [grid, setGrid] = useState<Grid>([])
  const [gridSize, setGridSize] = useState({ rows: MIN_ROWS, cols: MIN_COLS })
  const [selectedCell, setSelectedCell] = useState<CellPos | null>(null)
  const [selection, setSelection] = useState<Selection | null>(null)
  const [editMode, setEditMode] = useState(false)
  const [inputStyle, setInputStyle] = useState<React.CSSProperties>({ display: 'none' })
  const [pendingCells, setPendingCells] = useState<Set<string>>(new Set())
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [lastSync, setLastSync] = useState<Date | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [freezeRow, setFreezeRow] = useState(0)
  const [freezeCol, setFreezeCol] = useState(0)
  const [scrollTop, setScrollTop] = useState(0)
  const [viewportHeight, setViewportHeight] = useState(600)

  const gridRef = useRef<Grid>([])
  const activeTabRef = useRef('')
  const selectedRef = useRef<CellPos | null>(null)
  const selectionRef = useRef<Selection | null>(null)
  const editModeRef = useRef(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const tableWrapRef = useRef<HTMLDivElement>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const undoStack = useRef<{ r: number; c: number; oldVal: string; newVal: string }[][]>([])
  const clipboardRef = useRef<string[][]>([])
  const isMouseSelecting = useRef(false)

  const showToast = useCallback((msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type })
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), 2000)
  }, [])

  const buildGrid = useCallback((data: string[][]): Grid => {
    const dataRows = Math.max(data.length + 20, MIN_ROWS)
    const dataCols = Math.max(Math.max(...(data.length ? data.map(r => r.length) : [0])), MIN_COLS)
    setGridSize({ rows: dataRows, cols: dataCols })
    return Array.from({ length: dataRows }, (_, r) =>
      Array.from({ length: dataCols }, (_, c) => data[r]?.[c] ?? '')
    )
  }, [])

  const fetchTabs = useCallback(async () => {
    try {
      const res = await fetch('/api/sheets')
      const data = await res.json()
      if (!res.ok) return
      setTabs(data.tabs)
      if (!activeTabRef.current && data.tabs.length > 0) {
        setActiveTab(data.tabs[0])
        activeTabRef.current = data.tabs[0]
      }
    } catch {}
  }, [])

  const fetchTabData = useCallback(async (tab: string, silent = false) => {
    if (!tab) return
    if (!silent) setSyncing(true)
    try {
      const res = await fetch(`/api/sheets?tab=${encodeURIComponent(tab)}`)
      const data = await res.json()
      if (!res.ok) return
      const raw: string[][] = data.data ?? []
      const newGrid = buildGrid(raw)
      if (editModeRef.current && selectedRef.current) {
        const { r, c } = selectedRef.current
        if (newGrid[r]) newGrid[r][c] = inputRef.current?.value ?? ''
      }
      gridRef.current = newGrid
      setGrid([...newGrid])
      setLastSync(new Date())
    } catch {
      if (!silent) showToast('Không tải được dữ liệu', 'error')
    } finally {
      if (!silent) setSyncing(false)
    }
  }, [buildGrid, showToast])

  useEffect(() => { fetchTabs() }, [fetchTabs])

  useEffect(() => {
    if (!activeTab) return
    activeTabRef.current = activeTab
    gridRef.current = []
    setGrid([])
    setFreezeRow(0)
    setFreezeCol(0)
    stopEdit()
    setSelectedCell(null)
    setSelection(null)
    selectedRef.current = null
    selectionRef.current = null
    fetchTabData(activeTab)
  }, [activeTab])

  useEffect(() => {
    const t = setInterval(fetchTabs, POLL_INTERVAL)
    return () => clearInterval(t)
  }, [fetchTabs])

  useEffect(() => {
    if (!activeTab) return
    const t = setInterval(() => fetchTabData(activeTabRef.current, true), POLL_INTERVAL)
    return () => clearInterval(t)
  }, [activeTab, fetchTabData])

  useEffect(() => {
    const el = tableWrapRef.current
    if (!el) return
    setViewportHeight(el.clientHeight)
    const onScroll = () => setScrollTop(el.scrollTop)
    const onResize = () => setViewportHeight(el.clientHeight)
    el.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onResize)
    return () => { el.removeEventListener('scroll', onScroll); window.removeEventListener('resize', onResize) }
  }, [])

  const saveCell = useCallback(async (r: number, c: number, val: string) => {
    const tab = activeTabRef.current
    const key = `${r}-${c}`
    setPendingCells(prev => new Set(prev).add(key))
    try {
      const res = await fetch('/api/rows', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ range: toRange(tab, r, c), values: [val] }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error)
    } catch (e: any) {
      showToast(e.message?.includes('protected') ? 'Ô này đang bị khóa' : 'Lưu thất bại', 'error')
    } finally {
      setPendingCells(prev => { const n = new Set(prev); n.delete(key); return n })
    }
  }, [showToast])

  const stopEdit = useCallback(() => {
    editModeRef.current = false
    setEditMode(false)
    setInputStyle({ display: 'none' })
  }, [])

  const commitEdit = useCallback(() => {
    if (!editModeRef.current || !selectedRef.current) return
    const { r, c } = selectedRef.current
    const val = inputRef.current?.value ?? ''
    const originalVal = gridRef.current[r]?.[c] ?? ''
    gridRef.current = gridRef.current.map((row, ri) =>
      ri === r ? row.map((v, ci) => ci === c ? val : v) : row
    )
    setGrid([...gridRef.current])
    stopEdit()
    if (val !== originalVal) {
      undoStack.current.push([{ r, c, oldVal: originalVal, newVal: val }])
      saveCell(r, c, val)
    }
    setTimeout(() => tableWrapRef.current?.focus(), 0)
  }, [saveCell, stopEdit])

  const positionInput = useCallback((r: number, c: number) => {
    const wrap = tableWrapRef.current
    if (!wrap) return
    const td = wrap.querySelector(`[data-cell="${r}-${c}"]`) as HTMLElement
    if (!td) return
    const tdRect = td.getBoundingClientRect()
    setInputStyle({
      position: 'fixed',
      top: tdRect.top,
      left: tdRect.left,
      width: Math.max(tdRect.width, 200),
      height: tdRect.height,
      zIndex: 50,
      border: '2px solid #3b82f6',
      outline: 'none',
      padding: '0 6px',
      fontSize: 12,
      fontFamily: 'inherit',
      background: 'white',
      boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
    })
  }, [])

  const startEdit = useCallback((r: number, c: number, initialChar?: string) => {
    if (editModeRef.current) commitEdit()
    selectedRef.current = { r, c }
    const newSel = { start: { r, c }, end: { r, c } }
    selectionRef.current = newSel
    setSelectedCell({ r, c })
    setSelection(newSel)
    editModeRef.current = true
    setEditMode(true)
    positionInput(r, c)
    setTimeout(() => {
      if (!inputRef.current) return
      inputRef.current.value = initialChar !== undefined ? initialChar : gridRef.current[r]?.[c] ?? ''
      inputRef.current.focus()
      if (initialChar === undefined) inputRef.current.select()
    }, 0)
  }, [commitEdit, positionInput])

  const selectCell = useCallback((r: number, c: number) => {
    if (editModeRef.current) commitEdit()
    selectedRef.current = { r, c }
    const newSel = { start: { r, c }, end: { r, c } }
    selectionRef.current = newSel
    setSelectedCell({ r, c })
    setSelection(newSel)
    setTimeout(() => tableWrapRef.current?.focus(), 0)
  }, [commitEdit])

  const extendSelection = useCallback((r: number, c: number) => {
    if (!selectedRef.current) return
    const newSel = { start: selectedRef.current, end: { r, c } }
    selectionRef.current = newSel
    setSelection(newSel)
  }, [])

  const scrollToRow = useCallback((r: number) => {
    const el = tableWrapRef.current
    if (!el) return
    const rowTop = COL_HEADER_HEIGHT + r * ROW_HEIGHT
    const rowBottom = rowTop + ROW_HEIGHT
    if (rowTop < el.scrollTop + COL_HEADER_HEIGHT) el.scrollTop = rowTop - COL_HEADER_HEIGHT
    else if (rowBottom > el.scrollTop + el.clientHeight) el.scrollTop = rowBottom - el.clientHeight
  }, [])

  const copySelection = useCallback(() => {
    const sel = selectionRef.current
    if (!sel) return null
    const { r1, c1, r2, c2 } = normalizeSelection(sel)
    const copied: string[][] = []
    for (let r = r1; r <= r2; r++) {
      const row: string[] = []
      for (let c = c1; c <= c2; c++) row.push(gridRef.current[r]?.[c] ?? '')
      copied.push(row)
    }
    const text = copied.map(row => row.join('\t')).join('\n')
    navigator.clipboard.writeText(text).catch(() => {})
    return { copied, r1, c1, r2, c2 }
  }, [])

  const handleCopy = useCallback(() => {
    const result = copySelection()
    if (!result) return
    clipboardRef.current = result.copied
    showToast(`Đã copy ${result.r2 - result.r1 + 1} hàng × ${result.c2 - result.c1 + 1} cột`)
  }, [copySelection, showToast])

  const handleCut = useCallback(() => {
    const result = copySelection()
    if (!result) return
    clipboardRef.current = result.copied
    const { r1, c1, r2, c2 } = result
    const newGrid = gridRef.current.map((row, ri) =>
      ri >= r1 && ri <= r2 ? row.map((v, ci) => ci >= c1 && ci <= c2 ? '' : v) : row
    )
    const changes = result.copied.flatMap((row, dr) =>
      row.map((oldVal, dc) => ({ r: r1 + dr, c: c1 + dc, oldVal, newVal: '' }))
        .filter(ch => ch.oldVal !== '')
    )
    gridRef.current = newGrid
    setGrid([...newGrid])
    if (changes.length) {
      undoStack.current.push(changes)
      changes.forEach(ch => saveCell(ch.r, ch.c, ''))
    }
    showToast(`Đã cut ${r2 - r1 + 1} hàng × ${c2 - c1 + 1} cột`)
  }, [copySelection, saveCell, showToast])

  const handlePaste = useCallback(() => {
    const cell = selectedRef.current
    if (!cell || !clipboardRef.current.length) return
    const data = clipboardRef.current
    const { r: startR, c: startC } = cell
    const newGrid = gridRef.current.map(row => [...row])
    const changes: { r: number; c: number; oldVal: string; newVal: string }[] = []
    for (let dr = 0; dr < data.length; dr++) {
      for (let dc = 0; dc < data[dr].length; dc++) {
        const r = startR + dr
        const c = startC + dc
        if (r < newGrid.length && c < (newGrid[0]?.length ?? 0)) {
          const oldVal = newGrid[r][c]
          const newVal = data[dr][dc]
          if (oldVal !== newVal) {
            newGrid[r][c] = newVal
            changes.push({ r, c, oldVal, newVal })
          }
        }
      }
    }
    if (!changes.length) return
    gridRef.current = newGrid
    setGrid([...newGrid])
    undoStack.current.push(changes)
    changes.forEach(ch => saveCell(ch.r, ch.c, ch.newVal))
    clipboardRef.current = []
    showToast(`Đã paste`)
  }, [saveCell, showToast])

  const handleUndo = useCallback(() => {
    const last = undoStack.current.pop()
    if (!last) return
    const changes = Array.isArray(last) ? last : [last]
    const newGrid = gridRef.current.map(row => [...row])
    changes.forEach(({ r, c, oldVal }) => { newGrid[r][c] = oldVal })
    gridRef.current = newGrid
    setGrid([...newGrid])
    changes.forEach(({ r, c, oldVal }) => saveCell(r, c, oldVal))
    showToast('Đã undo')
  }, [saveCell, showToast])

  const handleGridKeyDown = useCallback((e: React.KeyboardEvent) => {
    const cell = selectedRef.current
    if (!cell) return

    if (e.ctrlKey || e.metaKey) {
      if (e.key === 'c' || e.key === 'C') { e.preventDefault(); handleCopy(); return }
      if (e.key === 'x' || e.key === 'X') { e.preventDefault(); handleCut(); return }
      if (e.key === 'v' || e.key === 'V') { e.preventDefault(); handlePaste(); return }
      if (e.key === 'z' || e.key === 'Z') { e.preventDefault(); handleUndo(); return }
      if (e.key === 'a' || e.key === 'A') {
        e.preventDefault()
        const newSel = { start: { r: 0, c: 0 }, end: { r: gridSize.rows - 1, c: gridSize.cols - 1 } }
        selectionRef.current = newSel
        setSelection(newSel)
        return
      }
      return
    }

    if (editModeRef.current) return
    const { r, c } = cell

    if (e.key === 'Tab') { e.preventDefault(); selectCell(r, c + 1) }
    else if (e.key === 'ArrowDown') { e.preventDefault(); if (e.shiftKey) extendSelection(r + 1, selection?.end.c ?? c); else selectCell(r + 1, c); scrollToRow(r + 1) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); if (e.shiftKey) extendSelection(Math.max(0, r - 1), selection?.end.c ?? c); else selectCell(Math.max(0, r - 1), c); scrollToRow(r - 1) }
    else if (e.key === 'ArrowRight') { e.preventDefault(); if (e.shiftKey) extendSelection(selection?.end.r ?? r, c + 1); else selectCell(r, c + 1) }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); if (e.shiftKey) extendSelection(selection?.end.r ?? r, Math.max(0, c - 1)); else selectCell(r, Math.max(0, c - 1)) }
    else if (e.key === 'Enter' || e.key === 'F2') { e.preventDefault(); startEdit(r, c) }
    else if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault()
      const sel = selectionRef.current
      if (sel) {
        const { r1, c1, r2, c2 } = normalizeSelection(sel)
        const delChanges: { r: number; c: number; oldVal: string; newVal: string }[] = []
        const newGrid = gridRef.current.map((row, ri) =>
          ri >= r1 && ri <= r2 ? row.map((v, ci) => {
            if (ci >= c1 && ci <= c2 && v !== '') { delChanges.push({ r: ri, c: ci, oldVal: v, newVal: '' }); return '' }
            return v
          }) : row
        )
        gridRef.current = newGrid
        setGrid([...newGrid])
        if (delChanges.length) {
          undoStack.current.push(delChanges)
          delChanges.forEach(ch => saveCell(ch.r, ch.c, ''))
        }
      }
    }
    else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) startEdit(r, c, e.key)
  }, [selectCell, startEdit, saveCell, scrollToRow, extendSelection, handleCopy, handlePaste, handleUndo, gridSize, selection])

  const handleInputKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    const cell = selectedRef.current
    if (!cell) return
    if (e.ctrlKey || e.metaKey) {
      if (e.key === 'z' || e.key === 'Z') { e.preventDefault(); commitEdit(); handleUndo(); return }
      return
    }
    if (e.key === 'Enter') {
      e.preventDefault(); commitEdit()
      const next = { r: cell.r + 1, c: cell.c }
      selectedRef.current = next; setSelectedCell(next); scrollToRow(next.r)
    } else if (e.key === 'Tab') {
      e.preventDefault(); commitEdit()
      const next = { r: cell.r, c: cell.c + 1 }
      selectedRef.current = next; setSelectedCell(next)
    } else if (e.key === 'Escape') {
      stopEdit()
    }
  }, [commitEdit, stopEdit, scrollToRow, handleUndo])

  const handleCellMouseDown = useCallback((e: React.MouseEvent, r: number, c: number) => {
    if (e.shiftKey && selectedRef.current) {
      e.preventDefault()
      extendSelection(r, c)
      return
    }
    if (editModeRef.current) commitEdit()
    isMouseSelecting.current = true
    selectedRef.current = { r, c }
    const newSel = { start: { r, c }, end: { r, c } }
    selectionRef.current = newSel
    setSelectedCell({ r, c })
    setSelection(newSel)
    setTimeout(() => tableWrapRef.current?.focus(), 0)
  }, [commitEdit, extendSelection])

  const handleCellMouseEnter = useCallback((r: number, c: number) => {
    if (!isMouseSelecting.current) return
    extendSelection(r, c)
  }, [extendSelection])

  const handleMouseUp = useCallback(() => {
    isMouseSelecting.current = false
  }, [])

  const displayIndices = searchQuery
    ? grid.map((_, i) => i).filter(i => grid[i]?.some(c => String(c).toLowerCase().includes(searchQuery.toLowerCase())))
    : Array.from({ length: gridSize.rows }, (_, i) => i)

  const startIdx = Math.max(0, Math.floor((scrollTop - COL_HEADER_HEIGHT) / ROW_HEIGHT) - BUFFER)
  const endIdx = Math.min(displayIndices.length, Math.ceil((scrollTop - COL_HEADER_HEIGHT + viewportHeight) / ROW_HEIGHT) + BUFFER)
  const visibleIndices = displayIndices.slice(startIdx, endIdx)
  const paddingTop = startIdx * ROW_HEIGHT
  const paddingBottom = Math.max(0, (displayIndices.length - endIdx) * ROW_HEIGHT)

  const selLabel = (() => {
    if (!selection) return selectedCell ? `${colLabel(selectedCell.c)}${selectedCell.r + 1}` : ''
    const { r1, c1, r2, c2 } = normalizeSelection(selection)
    if (r1 === r2 && c1 === c2) return `${colLabel(c1)}${r1 + 1}`
    return `${colLabel(c1)}${r1 + 1}:${colLabel(c2)}${r2 + 1}`
  })()

  return (
    <div className="flex flex-col h-screen bg-white font-sans text-xs select-none" onMouseUp={handleMouseUp}>
      <input ref={inputRef} style={inputStyle} onKeyDown={handleInputKeyDown} />

      <div className="flex items-center gap-2 px-3 py-1.5 bg-white border-b border-gray-200 shrink-0">
        <span className="font-medium text-gray-700 text-sm">BPO Data Entry</span>
        <button
          onClick={async () => { await fetch('/api/bpo-auth/logout', { method: 'POST' }); window.location.href = '/login' }}
          className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
        >
          Đăng xuất
        </button>
        {freezeRow > 0 && (
          <span className="px-2 py-0.5 bg-blue-50 text-blue-600 rounded text-xs border border-blue-100">
            Freeze {freezeRow} hàng
            <button onClick={() => setFreezeRow(0)} className="ml-1 hover:text-blue-800">×</button>
          </span>
        )}
        {freezeCol > 0 && (
          <span className="px-2 py-0.5 bg-green-50 text-green-600 rounded text-xs border border-green-100">
            Freeze {freezeCol} cột
            <button onClick={() => setFreezeCol(0)} className="ml-1 hover:text-green-800">×</button>
          </span>
        )}
        <div className="flex-1" />
        {syncing && <span className="text-gray-400">Đang tải...</span>}
        {lastSync && !syncing && (
          <span className="text-gray-300">
            {lastSync.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </span>
        )}
        <input
          type="text"
          placeholder="Tìm kiếm..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className="px-2 py-1 text-xs border border-gray-200 rounded w-40 focus:outline-none focus:border-blue-400"
        />
      </div>

      <div className="flex items-center bg-[#f8f9fa] border-b border-gray-200 overflow-x-auto shrink-0">
        {tabs.map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-xs whitespace-nowrap border-r border-gray-200 transition-colors ${
              activeTab === tab ? 'bg-white text-blue-600 font-medium border-t-2 border-t-blue-600' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >{tab}</button>
        ))}
      </div>

      <div className="flex items-center gap-2 px-2 py-0.5 bg-white border-b border-gray-200 shrink-0">
        <span className="text-xs text-gray-500 font-mono w-24 text-center border border-gray-200 px-1 py-0.5 rounded">
          {selLabel}
        </span>
        <div className="w-px h-4 bg-gray-200" />
        <span className="text-xs text-gray-700 flex-1 font-mono">
          {selectedCell && !editMode ? grid[selectedCell.r]?.[selectedCell.c] ?? '' : ''}
        </span>
      </div>

      <div ref={tableWrapRef} className="flex-1 overflow-auto relative outline-none" onKeyDown={handleGridKeyDown} tabIndex={-1}>
        <table className="border-collapse" style={{ tableLayout: 'fixed' }}>
          <colgroup>
            <col style={{ width: ROW_HEADER_WIDTH, minWidth: ROW_HEADER_WIDTH }} />
            {Array.from({ length: gridSize.cols }, (_, c) => <col key={c} style={{ width: COL_WIDTH, minWidth: COL_WIDTH }} />)}
          </colgroup>
          <thead style={{ position: 'sticky', top: 0, zIndex: 20 }}>
            <tr>
              <th className="bg-[#f8f9fa] border-b border-r border-gray-200"
                style={{ width: ROW_HEADER_WIDTH, minWidth: ROW_HEADER_WIDTH, height: COL_HEADER_HEIGHT, position: 'sticky', left: 0, zIndex: 30 }} />
              {Array.from({ length: gridSize.cols }, (_, c) => (
                <th key={c}
                  onClick={() => setFreezeCol(prev => prev === c + 1 ? 0 : c + 1)}
                  className={`border-b border-r border-gray-200 text-center font-normal cursor-pointer transition-colors ${
                    c < freezeCol ? 'bg-green-50 text-green-700' : 'bg-[#f8f9fa] text-gray-500 hover:bg-gray-100'
                  } ${freezeCol === c + 1 ? 'border-r-2 border-r-green-400' : ''}`}
                  style={{
                    width: COL_WIDTH, minWidth: COL_WIDTH, height: COL_HEADER_HEIGHT,
                    position: c < freezeCol ? 'sticky' : undefined,
                    left: c < freezeCol ? ROW_HEADER_WIDTH + c * COL_WIDTH : undefined,
                    zIndex: c < freezeCol ? 25 : undefined,
                  }}
                >{colLabel(c)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paddingTop > 0 && <tr style={{ height: paddingTop }}><td colSpan={gridSize.cols + 1} /></tr>}
            {visibleIndices.map(ri => (
              <tr key={ri}>
                <td
                  onClick={() => setFreezeRow(prev => prev === ri + 1 ? 0 : ri + 1)}
                  className={`border-b border-r border-gray-200 text-center font-normal cursor-pointer transition-colors ${
                    ri < freezeRow ? 'bg-blue-50 text-blue-600' : 'bg-[#f8f9fa] text-gray-400 hover:bg-gray-100'
                  } ${freezeRow === ri + 1 ? 'border-b-2 border-b-blue-300' : ''}`}
                  style={{ width: ROW_HEADER_WIDTH, minWidth: ROW_HEADER_WIDTH, height: ROW_HEIGHT, position: 'sticky', left: 0, zIndex: 10 }}
                >{ri + 1}</td>
                {Array.from({ length: gridSize.cols }, (_, c) => {
                  const val = grid[ri]?.[c] ?? ''
                  const isSelected = selectedCell?.r === ri && selectedCell?.c === c
                  const isInSel = inSelection(ri, c, selection)
                  const isEditing = editMode && isSelected
                  const isPending = pendingCells.has(`${ri}-${c}`)
                  const isFrozenCol = c < freezeCol
                  return (
                    <td key={c}
                      data-cell={`${ri}-${c}`}
                      onMouseDown={e => handleCellMouseDown(e, ri, c)}
                      onMouseEnter={() => handleCellMouseEnter(ri, c)}
                      onDoubleClick={() => startEdit(ri, c)}
                      className={`border-b border-r border-gray-200 outline-none ${
                        isSelected && !isInSel ? 'ring-2 ring-inset ring-blue-500 z-10' :
                        isInSel ? 'bg-blue-100' : ''
                      } ${isPending ? 'bg-yellow-50' : !isInSel && isFrozenCol ? 'bg-[#f8f9fa]' : !isInSel ? 'bg-white' : ''}`}
                      style={{
                        height: ROW_HEIGHT, width: COL_WIDTH, minWidth: COL_WIDTH, padding: 0, cursor: 'cell',
                        ...(isFrozenCol ? { position: 'sticky', left: ROW_HEADER_WIDTH + c * COL_WIDTH, zIndex: 11 } : {}),
                      }}
                    >
                      <span className="block px-1.5 truncate text-gray-800"
                        style={{ lineHeight: `${ROW_HEIGHT}px`, visibility: isEditing ? 'hidden' : 'visible' }}
                      >{val}</span>
                    </td>
                  )
                })}
              </tr>
            ))}
            {paddingBottom > 0 && <tr style={{ height: paddingBottom }}><td colSpan={gridSize.cols + 1} /></tr>}
          </tbody>
        </table>
      </div>

      <div className="flex items-center gap-3 px-3 py-1 bg-[#f8f9fa] border-t border-gray-200 shrink-0 text-xs text-gray-400">
        <span>{gridSize.rows} hàng × {gridSize.cols} cột</span>
        {selLabel && <span className="text-blue-500">{selLabel}</span>}
        <div className="flex-1" />
        <span className={pendingCells.size > 0 ? 'text-yellow-500' : 'text-green-500'}>
          {pendingCells.size > 0 ? `Đang lưu ${pendingCells.size} ô...` : '● Đã đồng bộ'}
        </span>
        <span className="text-gray-300">{activeTab}</span>
      </div>

      {toast && (
        <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 px-4 py-2 rounded text-xs text-white z-50 ${
          toast.type === 'error' ? 'bg-red-500' : 'bg-gray-800'
        }`}>{toast.msg}</div>
      )}
    </div>
  )
}