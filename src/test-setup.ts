import '@testing-library/jest-dom'

const storageMap = new Map<string, string>()
const mockStorage: Storage = {
  get length() {
    return storageMap.size
  },
  clear() {
    storageMap.clear()
  },
  getItem(key: string) {
    return storageMap.has(key) ? storageMap.get(key)! : null
  },
  setItem(key: string, value: string) {
    storageMap.set(key, String(value))
  },
  removeItem(key: string) {
    storageMap.delete(key)
  },
  key(index: number) {
    return Array.from(storageMap.keys())[index] ?? null
  },
}

Object.defineProperty(globalThis, 'localStorage', {
  value: mockStorage,
  writable: true,
  configurable: true,
})
if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'localStorage', {
    value: mockStorage,
    writable: true,
    configurable: true,
  })
}


