import { useQuery } from "@tanstack/react-query"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { useNavigate } from "react-router-dom"

import { useAuth } from "@/api/auth/AuthContext"
import { authQueries } from "@/api/queries/auth"
import { ErrorState } from "@/components/common/ErrorState"
import { Card, CardContent } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "@/components/ui/toast"
import { PasswordChangeSection } from "@/features/portfolio/components/PasswordChangeSection"
import { ProfileForm } from "@/features/portfolio/components/ProfileForm"
import { useOwnPortfolio } from "@/features/portfolio/hooks/usePortfolio"

/** Wohin ein abgeschlossenes Speichern fuehrt: das eigene Portfolio (KAN-105). */
const PORTFOLIO_PATH = "/my-portfolio"

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
 *
 * <p><strong>Wohin es nach dem Speichern geht, entscheidet diese
 * Seite</strong> (KAN-105), nicht das Formular: {@code ProfileForm} meldet
 * ueber Rueckrufe, was geschehen ist, und kennt keine Route. Ein
 * vollstaendiges Speichern ohne offenen Adresswechsel fuehrt ins Portfolio.
 * Bleibt ein Wechsel offen, bleibt auch die Seite stehen und oeffnet den
 * Dialog "Neue E-Mail-Adresse bestaetigen": wer eben eine neue Adresse
 * gespeichert hat, braucht als Naechstes den Code und nicht die
 * Projektliste. Teilerfolg und Fehlschlag melden nichts nach oben, die
 * Meldung dazu steht am Formular.
 *
 * <p>Die Rueckmeldung laeuft ueber den globalen Toaster und nicht ueber eine
 * Zeile auf dieser Seite: nach der Weiterleitung ist die Seite fort und nach
 * Bestaetigung oder Abbruch der Dialog, und eine Meldung darin verschwaende
 * mit ihnen (Skill frontend-design, Abschnitt 5).
 */
export default function ProfileEditPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { data, isPending, error } = useOwnPortfolio()
  const me = useQuery(authQueries.me())
  /* Ungespeicherte Eingaben des Formulars: der Weg "Passwort vergessen"
     verlaesst die Seite und fragt dann vorher nach (Skill frontend-design,
     Abschnitt 5). Seit KAN-105 entscheidet derselbe Zustand, ob eine
     Bestaetigung des Adresswechsels ins Portfolio fuehren darf. */
  const [profileDirty, setProfileDirty] = useState(false)
  /* Offen-Zustand des Dialogs "Neue E-Mail-Adresse bestaetigen". Er liegt
     hier und nicht im Formular, weil die Seite ihn nach dem Speichern ohne
     Klick oeffnet (KAN-105). */
  const [emailDialogOpen, setEmailDialogOpen] = useState(false)
  /*
   * Merker "in dieser Sitzung gespeichert, waehrend ein Wechsel offen ist"
   * (Entscheidung aus der Klaerungsrunde zu KAN-105). Nur mit ihm fuehrt die
   * spaetere Bestaetigung ins Portfolio: das Speichern war schon die
   * Handlung, die dorthin fuehren sollte, der Code hat sie nur aufgehalten.
   * Nach einem Neuladen fehlt der Merker, und die Bestaetigung ist dann eine
   * Handlung fuer sich, nach der die Seite stehen bleibt.
   */
  const [savedDuringEmailChange, setSavedDuringEmailChange] = useState(false)

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

  const onSaved = ({ pendingEmail }: { pendingEmail: string | null }) => {
    if (pendingEmail === null) {
      toast.add({ title: t("portfolio.profile.saved.all"), type: "success" })
      void navigate(PORTFOLIO_PATH)
      return
    }
    setSavedDuringEmailChange(true)
    setEmailDialogOpen(true)
  }

  /**
   * Ins Portfolio geht es nur, wenn der Merker steht und das Formular seit
   * dem Speichern unveraendert ist; neue Eingaben verwarf die Weiterleitung
   * sonst ohne Rueckfrage (Skill frontend-design, Abschnitt 5). Das gilt
   * auch, wenn der Dialog ueber die Hinweiszeile erneut geoeffnet wurde. Der
   * Toast steht in beiden Faellen.
   */
  const onEmailChangeConfirmed = () => {
    setEmailDialogOpen(false)
    toast.add({
      title: t("portfolio.profile.emailChange.confirmSuccess"),
      type: "success",
    })
    if (savedDuringEmailChange && !profileDirty) {
      void navigate(PORTFOLIO_PATH)
      return
    }
    setSavedDuringEmailChange(false)
  }

  /* Der Abbruch schliesst ein Speichern nicht ab, sondern nimmt einen Teil
     davon zurueck; die Seite bleibt deshalb immer stehen. type info statt
     success: zurueckgenommen ist der Wunsch, erreicht ist nichts Neues. */
  const onEmailChangeCancelled = () => {
    setEmailDialogOpen(false)
    setSavedDuringEmailChange(false)
    toast.add({
      title: t("portfolio.profile.emailChange.cancelSuccess"),
      type: "info",
    })
  }

  return (
    <>
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
                {loadError !== null && <ErrorState error={loadError} />}

                <ProfileForm
                  user={person}
                  portfolio={data}
                  onDirtyChange={setProfileDirty}
                  onSaved={onSaved}
                  emailDialogOpen={emailDialogOpen}
                  onEmailDialogOpenChange={setEmailDialogOpen}
                  onEmailChangeConfirmed={onEmailChangeConfirmed}
                  onEmailChangeCancelled={onEmailChangeCancelled}
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
