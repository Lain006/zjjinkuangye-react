import { useSyncExternalStore } from 'react'

const preference = window.matchMedia('(prefers-reduced-motion: reduce)')
const changeEvent = 'stage-motion-change'
// Reuse the original plate preference so returning readers retain their choice.
const storageKey = 'mineral-plate-paused'
let paused = false
try { paused = sessionStorage.getItem(storageKey) === 'true' } catch { /* Storage is optional. */ }

function subscribe(notify: () => void) {
  window.addEventListener(changeEvent, notify)
  preference.addEventListener('change', notify)
  return () => {
    window.removeEventListener(changeEvent, notify)
    preference.removeEventListener('change', notify)
  }
}

export function stageMotionState() {
  if (preference.matches) return 'reduced'
  return paused ? 'paused' : 'running'
}

export function useStageMotion() {
  return useSyncExternalStore(subscribe, stageMotionState)
}

export function toggleStageMotion() {
  if (preference.matches) return
  paused = !paused
  try { sessionStorage.setItem(storageKey, String(paused)) } catch { /* Keep the in-memory setting. */ }
  window.dispatchEvent(new Event(changeEvent))
}
