import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
} from 'react'

interface ToastContextType {
  showToast: (message: string, duration?: number) => void
}

const ToastContext = createContext<ToastContextType | undefined>(undefined)

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [message, setMessage] = useState<string | null>(null)
  const [visible, setVisible] = useState(false)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const showToast = useCallback((msg: string, duration = 3500) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    setMessage(msg)
    setVisible(true)
    timeoutRef.current = setTimeout(() => {
      setVisible(false)
      timeoutRef.current = setTimeout(() => {
        setMessage(null)
        timeoutRef.current = null
      }, 300)
    }, duration)
  }, [])

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {message && (
        <div
          role="status"
          aria-live="polite"
          className={`fixed left-4 right-4 z-50 rounded-lg bg-emerald-600 px-4 py-3 text-center text-sm font-medium text-white shadow-lg transition-all duration-300 ${
            visible
              ? 'bottom-24 translate-y-0 opacity-100'
              : 'bottom-24 translate-y-4 opacity-0'
          }`}
        >
          {message}
        </div>
      )}
    </ToastContext.Provider>
  )
}

export function useToast() {
  const context = useContext(ToastContext)
  if (context === undefined) {
    throw new Error('useToast must be used within a ToastProvider')
  }
  return context
}
