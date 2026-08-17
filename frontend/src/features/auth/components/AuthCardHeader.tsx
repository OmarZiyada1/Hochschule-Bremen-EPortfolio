import { useTranslation } from "react-i18next"

import { RegistrationProgress } from "@/features/auth/components/RegistrationProgress"
import { cn } from "@/lib/utils"

/**
 * Kopf der Auth-Karten (KAN-33): Markenkachel, auf den Registrierungsseiten
 * die Fortschrittspunkte, darunter Titel und Untertitel. Die Kachel ist
 * aria-hidden, weil die Initialen nichts sagen, was der Untertitel nicht
 * ausgeschrieben enthaelt (Begruendung aus KAN-8).
 *
 * Die Registrierungs-Frames fuehren den Titel in primary, die Login-Karte
 * in foreground; brandTitle schaltet zwischen beiden.
 */
export function AuthCardHeader({
  title,
  subtitle,
  progress,
  brandTitle = false,
}: {
  /** Ueberschrift der Karte, bereits uebersetzt. */
  title: string
  /** Untertitel unter der Ueberschrift, bereits uebersetzt. */
  subtitle: string
  /** Gefuellte Fortschrittspunkte; ohne Angabe entfaellt die Reihe. */
  progress?: 1 | 2 | 3
  /** Titel in primary statt foreground (Registrierungs-Frames). */
  brandTitle?: boolean
}) {
  const { t } = useTranslation()

  return (
    <>
      <div className="flex flex-col items-center gap-2">
        <div
          aria-hidden="true"
          className="flex size-14 items-center justify-center rounded-modal bg-surface-brand text-surface-brand-foreground"
        >
          <span className="type-avatar-lg">{t("app.initials")}</span>
        </div>
        {progress !== undefined && <RegistrationProgress filled={progress} />}
      </div>

      <div className="flex flex-col items-center gap-1 text-center">
        <h1 className={cn("type-h1", brandTitle && "text-primary")}>{title}</h1>
        <p className="type-body-sm text-muted-foreground">{subtitle}</p>
      </div>
    </>
  )
}
