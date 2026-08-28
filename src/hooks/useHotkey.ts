// useHotkey — window-level shortcut that stays out of the way of text entry.
// MIT License

import { useEffect } from 'react'

function isTextEntryTarget(element: Element | null): boolean {
  return (
    element instanceof HTMLInputElement ||
    element instanceof HTMLTextAreaElement ||
    element?.getAttribute('contenteditable') === 'true'
  )
}

export function useHotkey(key: string, handler: () => void): void {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== key) return
      if (event.ctrlKey || event.metaKey || event.altKey) return
      if (isTextEntryTarget(document.activeElement)) return
      event.preventDefault()
      handler()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [key, handler])
}
