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
      let line = e.data
      try {
        const parsed = JSON.parse(e.data)
        if (parsed.line) line = parsed.line
      } catch {
        // Use raw data
      }
      setLines((prev) => [...prev, line])
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
    <div ref={containerRef} className="log-viewer">
      {lines.length === 0 ? (
        <span className="text-muted">Waiting for logs...</span>
      ) : (
        lines.map((line, i) => <div key={i}>{line}</div>)
      )}
    </div>
  )
}
