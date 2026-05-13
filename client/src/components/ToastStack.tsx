import { useEffect } from 'react'
import './ToastStack.css'

export type ToastKind = 'error' | 'success' | 'info'

export type Toast = {
  id: string
  message: string
  kind: ToastKind
}

type ToastStackProps = {
  toasts: Toast[]
  onDismiss: (id: string) => void
}

const AUTO_DISMISS_MS = 3500

export const ToastStack = ({ toasts, onDismiss }: ToastStackProps) => {
  useEffect(() => {
    if (toasts.length === 0) {
      return
    }

    const oldest = toasts[0]
    const timer = window.setTimeout(() => {
      onDismiss(oldest.id)
    }, AUTO_DISMISS_MS)

    return () => window.clearTimeout(timer)
  }, [toasts, onDismiss])

  if (toasts.length === 0) {
    return null
  }

  return (
    <div className="toast-stack" role="status" aria-live="polite" aria-atomic="false">
      {toasts.map((toast) => (
        <div key={toast.id} className={`toast toast--${toast.kind}`}>
          <span className="toast-message">{toast.message}</span>
          <button
            type="button"
            className="toast-dismiss"
            aria-label="Dismiss notification"
            onClick={() => onDismiss(toast.id)}
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  )
}
