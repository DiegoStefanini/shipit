import { useEffect, useRef, useState } from 'react'

interface LogViewerProps {
  deployId: string
  status: string
  log?: string
}

export default function LogViewer({ deployId, status, log }: LogViewerProps) {
  const [lines, setLines] = useState<string[]>(log ? log.split('\n') : [])
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (status !== 'building') return

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws/logs/${deployId}`)

    ws.onmessage = (e) => {
      setLines((prev) => [...prev, e.data])
    }

    ws.onerror = () => {
      setLines((prev) => [...prev, '[connection error]'])
    }

    return () => {
      ws.close()
    }
  }, [deployId, status])

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight
    }
  }, [lines])

  return (
    <div
      ref={containerRef}
      style={{
        background: '#000',
        border: '1px solid #262626',
        borderRadius: '8px',
        padding: '16px',
        fontFamily: '"Fira Code", "Cascadia Code", "Consolas", monospace',
        fontSize: '13px',
        lineHeight: '1.7',
        color: '#10b981',
        maxHeight: '400px',
        overflowY: 'auto',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-all',
      }}
    >
      {lines.length === 0 ? (
        <span style={{ color: '#a1a1aa' }}>Waiting for logs...</span>
      ) : (
        lines.map((line, i) => <div key={i}>{line}</div>)
      )}
    </div>
  )
}
