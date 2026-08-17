import { ArrowLeftIcon } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Link } from "react-router-dom"

import { useAuth } from "@/api/auth/AuthContext"
import { apiErrorMessageKey, isApiError } from "@/api/errors"
import { Alert, AlertTitle } from "@/components/ui/alert"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Card, CardContent } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { PasswordResetSection } from "@/features/portfolio/components/PasswordResetSection"
import { ProfileForm } from "@/features/portfolio/components/ProfileForm"
import { useOwnPortfolio } from "@/features/portfolio/hooks/usePortfolio"

/**
 * "Profil bearbeiten" nach dem gleichnamigen Template (KAN-34): eine
 * zentrierte Karte mit Avatar, Formular und dem Bereich zum Zuruecksetzen
 * des Passworts.
 *
 * <p>Die Seite steht jeder angemeldeten Rolle offen, auch ADMIN:
 * GET /api/portfolio/me ist an keine Rolle gebunden (§3.2). Fehlt die
 * Portfolio-Zeile, antwortet der Server 200 mit leeren Feldern (§3.2.1);
 * das Formular erscheint dann leer und nicht als Fehlerseite.
 *
 * <p>Das Formular wird erst mit geladenen Daten eingehaengt, damit es ohne
 * nachtraegliches Zuruecksetzen aus einem Effekt auskommt; bis dahin steht
 * ein Skelett in der Form der Karte.
 */
export default function ProfileEditPage() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const { data, isPending, error } = useOwnPortfolio()

  /* RequireAuth laesst niemanden ohne Sitzung hierher; der Zweig deckt nur
     den Moment ab, in dem die Umleitung noch nicht gerendert ist. */
  if (user === null) {
    return null
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8">
      <Breadcrumb className="inline-flex self-start rounded-control border px-3 py-2">
        <BreadcrumbList className="type-body-sm">
          <BreadcrumbItem>
            <BreadcrumbLink
              render={<Link to="/" />}
              className="font-medium text-primary hover:text-primary-hover"
            >
              {t("common.nav.home")}
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{t("portfolio.profile.breadcrumb")}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <Link
        to="/my-portfolio"
        className="type-body-sm flex items-center gap-2 self-center font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline focus-visible:underline"
      >
        <ArrowLeftIcon aria-hidden="true" className="size-4" />
        {t("portfolio.profile.back")}
      </Link>

      <Card className="mx-auto w-full max-w-xl">
        <CardContent className="flex flex-col gap-6 px-6">
          {isPending ? (
            <>
              <Skeleton className="mx-auto size-24 rounded-card" />
              <Skeleton className="h-8 w-48 rounded-control" />
              <Skeleton className="h-64 rounded-control" />
            </>
          ) : (
            <>
              {/* Ein Fehler beim Profil verhindert das Formular nicht:
                  Name und Adresse kommen aus dem Auth-Kontext, nur
                  Biografie und Bild fehlen dann. Gemeldet wird er
                  trotzdem, statt still leere Felder zu zeigen. */}
              {error !== null && (
                <Alert variant="destructive">
                  <AlertTitle>
                    {isApiError(error)
                      ? t(apiErrorMessageKey(error), {
                          defaultValue: error.message,
                        })
                      : t("apiError.INTERNAL_ERROR")}
                  </AlertTitle>
                </Alert>
              )}

              <ProfileForm user={user} portfolio={data} />

              <Separator />

              <PasswordResetSection email={user.email ?? ""} />
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
