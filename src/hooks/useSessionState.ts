import { useState, useCallback } from "react";

/**
 * useState backed by sessionStorage. Persists state across navigation
 * within the same browser tab/session.
 * Saves synchronously inside setState to guarantee persistence before unmount.
 */
export function useSessionState<T>(key: string, defaultValue: T): [T, (value: T | ((prev: T) => T)) => void, () => void] {
  const [state, setStateRaw] = useState<T>(() => {
    try {
      const stored = sessionStorage.getItem(key);
      if (stored !== null) return JSON.parse(stored);
    } catch {}
    return defaultValue;
  });

  const setState = useCallback((value: T | ((prev: T) => T)) => {
    setStateRaw(prev => {
      const next = value instanceof Function ? value(prev) : value;
      try {
        sessionStorage.setItem(key, JSON.stringify(next));
      } catch {}
      return next;
    });
  }, [key]);

  const clear = useCallback(() => {
    try { sessionStorage.removeItem(key); } catch {}
    setStateRaw(defaultValue);
  }, [key, defaultValue]);

  return [state, setState, clear];
}
