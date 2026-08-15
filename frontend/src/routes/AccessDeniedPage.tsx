import { LockIcon } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Link } from "react-router-dom"

import { EmptyState } from "@/components/common/EmptyState"
import { buttonVariants } from "@/components/ui/button"

/**
 * Sichtbare Meldung, wenn eine Route fuer die angemeldete Rolle gesperrt
 * ist (Ticket KAN-7, Umfang 3): ein studentisches Konto auf
 * /administration oder ein Admin-Konto auf /projects/new landet hier statt
 * auf einer leeren Seite. Der Weg zurueck fuehrt auf die Startseite.
 *
 * Dargestellt ueber den EmptyState aus KAN-29, mit Ebene 1: der ganze
 * Seiteninhalt ist diese Meldung, also traegt sie die Seitenueberschrift.
 */
export function AccessDeniedPage() {
  const { t } = useTranslation()

  return (
    <EmptyState
      headingLevel={1}
      icon={<LockIcon aria-hidden="true" />}
      title={t("accessDenied.title")}
      description={t("accessDenied.message")}
      action={
        <Link to="/" className={buttonVariants({ variant: "secondary" })}>
          {t("accessDenied.backHome")}
        </Link>
      }
      className="mx-auto max-w-3xl px-4 py-16"
    />
  )
}
