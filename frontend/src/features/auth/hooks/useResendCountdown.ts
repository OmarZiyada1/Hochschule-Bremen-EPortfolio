import { useCallback, useEffect, useState } from "react"

/**
 * Sperrfrist des Knopfs "Neuen Code anfordern" (KAN-33): 20 Sekunden nach
 * dem Figma-Template ("Neuen Code in 20s anfordern"). Eine reine
 * UI-Bremse gegen Doppelklicks; die verbindliche Bremse ist das
 * serverseitige Rate-Limit (§6.5), dessen 429 als Wartehinweis erscheint.
 */
export const RESEND_COOLDOWN_SECONDS = 20

/**
 * Zaehlt beim Einhaengen und nach jedem restart() von vorn herunter.
 * ready wird true, sobald die Frist abgelaufen ist.
 */
export function useResendCountdown(seconds = RESEND_COOLDOWN_SECONDS) {
  const [remaining, setRemaining] = useState(seconds)

  useEffect(() => {
    if (remaining <= 0) {
      return
    }
    const timer = setTimeout(() => {
      setRemaining((value) => Math.max(0, value - 1))
    }, 1000)
    return () => clearTimeout(timer)
  }, [remaining])

  const restart = useCallback(() => setRemaining(seconds), [seconds])

  return { remaining, ready: remaining <= 0, restart }
}
