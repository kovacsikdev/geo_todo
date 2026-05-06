import { useCallback, useState } from "react";
import type { Toast, ToastKind } from "../components/ToastStack";

export function useToastQueue() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((message: string, kind: ToastKind = "error") => {
    const id = globalThis.crypto.randomUUID();
    setToasts((prev) => [...prev, { id, message, kind }]);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  return {
    toasts,
    showToast,
    dismissToast,
  };
}
