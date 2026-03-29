import { useCallback, useEffect, useRef, useState } from 'react'
import type { ClientMessage, ServerMessage } from '../types/messages'

type Status = 'disconnected' | 'connecting' | 'connected' | 'error'

interface UseWebSocketOptions {
  onMessage: (msg: ServerMessage) => void
  onStatusChange?: (status: Status) => void
}

export function useWebSocket(projectId: string | null, options: UseWebSocketOptions) {
  const { onMessage, onStatusChange } = options
  const wsRef = useRef<WebSocket | null>(null)
  const [status, setStatus] = useState<Status>('disconnected')
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const updateStatus = useCallback((s: Status) => {
    setStatus(s)
    onStatusChange?.(s)
  }, [onStatusChange])

  const connect = useCallback(() => {
    if (!projectId) return
    if (wsRef.current?.readyState === WebSocket.OPEN) return

    updateStatus('connecting')
    const url = `ws://${window.location.host}/ws/project/${projectId}`
    const ws = new WebSocket(url)
    wsRef.current = ws

    ws.onopen = () => updateStatus('connected')

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data) as ServerMessage
        onMessage(msg)
      } catch {
        console.error('Failed to parse WS message:', event.data)
      }
    }

    ws.onclose = () => {
      updateStatus('disconnected')
      // Auto-reconnect after 3 seconds
      reconnectTimer.current = setTimeout(connect, 3000)
    }

    ws.onerror = () => {
      updateStatus('error')
      ws.close()
    }
  }, [projectId, onMessage, updateStatus])

  const disconnect = useCallback(() => {
    if (reconnectTimer.current) clearTimeout(reconnectTimer.current)
    wsRef.current?.close()
    wsRef.current = null
    updateStatus('disconnected')
  }, [updateStatus])

  const send = useCallback((msg: ClientMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg))
    } else {
      console.warn('WebSocket not connected, cannot send:', msg)
    }
  }, [])

  useEffect(() => {
    if (projectId) {
      connect()
    } else {
      disconnect()
    }
    return () => {
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current)
      wsRef.current?.close()
    }
  }, [projectId]) // eslint-disable-line react-hooks/exhaustive-deps

  return { send, status, connect, disconnect }
}
