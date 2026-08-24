import { useQuery } from "@tanstack/react-query"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { BreadcrumbBar } from "@/components/common/BreadcrumbBar"

import { useAuth } from "@/api/auth/AuthContext"
import { apiErrorMessageKey, isApiError } from "@/api/errors"
import { authQueries } from "@/api/queries/auth"
import { Alert, AlertTitle } from "@/components/ui/alert"
import { Card, CardContent } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { PasswordChangeSection } from "@/features/portfolio/components/PasswordChangeSection"
import { ProfileForm } from "@/features/portfolio/components/ProfileForm"
import { useOwnPortfolio } from "@/features/portfolio/hooks/usePortfolio"

/**
 * "Profil bearbeiten" nach dem gleichnamigen Template (KAN-34, ueberarbeitet
 * mit KAN-69): eine zentrierte Karte mit Avatar, Formular und dem Bereich
 * "Passwort aendern".
 *
 * <p>Der Breadcrumb fuehrt seit KAN-69 dreistufig ueber "Mein Portfolio":
 * die Seite liegt unterhalb von /my-portfolio, und der fruehere eigene Link
 * "Zurueck zum Portfolio" ist damit ersatzlos entfallen, den Weg traegt der
 * Breadcrumb.
 *
 * <p>Die Seite steht jeder angemeldeten Rolle offen, auch ADMIN:
 * GET /api/portfolio/me ist an keine Rolle gebunden (§3.2). Fehlt die
 * Portfolio-Zeile, antwortet der Server 200 mit leeren Feldern (§3.2.1);
 * das Formular erscheint dann leer und nicht als Fehlerseite.
 *
 * <p>Das Formular wird erst mit geladenen Daten eingehaengt, damit es ohne
 * nachtraegliches Zuruecksetzen aus einem Effekt auskommt; bis dahin steht
 * ein Skelett in der Form der Karte.
 *
 * <p><strong>Die Person kommt frisch vom Server</strong> (KAN-69), nicht aus
 * dem Auth-Kontext: der haelt den Stand des Logins im localStorage, und der
 * kann aelter sein als das, was der Server heute liefert. Genau das fiel bei
 * der Sichtpruefung auf: die mit Contract v50 hinzugekommene
 * {@code hsbEmail} fehlte in einer Sitzung, die vor der Aenderung begonnen
 * hatte, und das Feld blieb leer. Gelesen wird deshalb ueber
 * {@code authQueries.me()}; der gespeicherte Stand dient nur noch als
 * Rueckfalllinie, wenn die Abfrage scheitert.
 */
export default function ProfileEditPage() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const { data, isPending, error } = useOwnPortfolio()
  const me = useQuery(authQueries.me())
  /* Ungespeicherte Eingaben des Formulars: der Weg "Passwort vergessen"
     verlaesst die Seite und fragt dann vorher nach (Skill frontend-design,
     Abschnitt 5). */
  const [profileDirty, setProfileDirty] = useState(false)

  /* RequireAuth laesst niemanden ohne Sitzung hierher; der Zweig deckt nur
     den Moment ab, in dem die Umleitung noch nicht gerendert ist. */
  if (user === null) {
    return null
  }

  /* Scheitert die Abfrage, steht immer noch der gespeicherte Stand zur
     Verfuegung: die Seite bleibt bedienbar, nur moeglicherweise ohne die
     zuletzt serverseitig geaenderten Felder. Gemeldet wird der Fehler
     trotzdem, zusammen mit dem des Portfolios. */
  const person = me.data ?? user
  const loadError = error ?? me.error

  return (
    <>
      <BreadcrumbBar
        items={[
          { label: t("common.nav.home"), to: "/" },
          { label: t("common.nav.myPortfolio"), to: "/my-portfolio" },
          { label: t("portfolio.profile.breadcrumb") },
        ]}
      />

      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8">
        <Card className="mx-auto w-full max-w-xl">
          <CardContent className="flex flex-col gap-6 px-6">
            {isPending || me.isPending ? (
              <>
                <Skeleton className="mx-auto size-24 rounded-pill" />
                <Skeleton className="h-8 w-48 rounded-control" />
                <Skeleton className="h-64 rounded-control" />
              </>
            ) : (
              <>
                {/* Ein Fehler verhindert das Formular nicht: Name und Adresse
                  stehen notfalls im Auth-Kontext, nur Biografie und Bild
                  fehlen dann. Gemeldet wird er trotzdem, statt still leere
                  oder veraltete Felder zu zeigen. */}
                {loadError !== null && (
                  <Alert variant="destructive">
                    <AlertTitle>
                      {isApiError(loadError)
                        ? t(apiErrorMessageKey(loadError), {
                            defaultValue: loadError.message,
                          })
                        : t("apiError.INTERNAL_ERROR")}
                    </AlertTitle>
                  </Alert>
                )}

                <ProfileForm
                  user={person}
                  portfolio={data}
                  onDirtyChange={setProfileDirty}
                />

                <Separator />

                <PasswordChangeSection
                  email={person.email}
                  unsavedChanges={profileDirty}
                />
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  )
}
