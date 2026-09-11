import { useTranslation } from "react-i18next"
import { Link } from "react-router-dom"

import { ErrorState } from "@/components/common/ErrorState"
import { TextPage } from "@/components/common/TextPage"
import { OperatorAddress } from "@/features/legal/OperatorAddress"
import { readOperatorDetails } from "@/features/legal/operatorDetails"
import { inlineLinkClass } from "@/lib/inlineLink"
import { useTranslatedList } from "@/lib/useTranslatedList"

/**
 * Die Datenschutzerklaerung unter {@code /privacy} (KAN-100). Bis dahin
 * stand hier die Platzhalterhuelle aus KAN-7, die mit diesem Ticket
 * entfallen ist.
 *
 * <p><strong>Die Seite beschreibt diese Anwendung und keine beliebige.</strong>
 * Jede Aussage darin ist am Code nachgeprueft und nicht aus einem Muster
 * uebernommen: dass Passworthash und Hochschuladresse den Server in keiner
 * Antwort verlassen, steht in Contract §3.1; dass die IP-Adresse fuer die
 * Sperre nach Fehlversuchen nur im Arbeitsspeicher gezaehlt wird, steht in
 * {@code AttemptCounter} als {@code ConcurrentHashMap} ohne Ablage in der
 * Datenbank; die drei Auftragsverarbeiter und ihre Standorte sind der
 * tatsaechlich ausgerollte Stapel aus {@code compose.prod.yml}. Ein
 * abgeschriebener Mustertext waere hier schlimmer als gar keiner, weil er
 * Zusagen macht, die niemand eingeloest hat.
 *
 * <p><strong>Der Abschnitt zur Loeschung sagt, was nicht geht.</strong> Es
 * gibt keine Selbstloeschung eines Kontos: die Administration kann nur
 * {@code DEACTIVATED} setzen, und {@code AdminUserService} loescht dabei
 * ausdruecklich keine Zeile, damit die Zuordnung veroeffentlichter Projekte
 * haelt. Artikel 17 DSGVO ist davon unberuehrt, also nennt die Seite den
 * Weg von Hand. Das ist die unangenehmere Auskunft und die einzige richtige.
 *
 * <p><strong>Und ebenso der Abschnitt zum Kontaktformular.</strong> Wer es
 * ohne Konto benutzt, hat hinterher keinen Weg ueber die Oberflaeche zu
 * seinen eigenen Daten; das Ticket verlangt ausdruecklich, diesen Weg zu
 * beschreiben, statt ihn zu uebergehen.
 *
 * <p>Die Angaben zum Verantwortlichen sind dieselben wie im Impressum und
 * kommen aus derselben Quelle, siehe {@link readOperatorDetails}. Aufbau und
 * Huelle wie bei der Barrierefreiheitserklaerung (KAN-95).
 */
export default function PrivacyPage() {
  const { t } = useTranslation()
  const list = useTranslatedList()
  const details = readOperatorDetails()

  return (
    <TextPage
      title={t("privacy.title")}
      intro={t("privacy.intro")}
      notes={[t("privacy.prototypeNote")]}
    >
      <section className="flex flex-col gap-3">
        <h2 className="type-h2">{t("privacy.controller.title")}</h2>
        {details ? (
          <>
            <p className="type-body">{t("privacy.controller.intro")}</p>
            <OperatorAddress
              details={details}
              emailLabel={t("privacy.controller.emailLabel")}
            />
          </>
        ) : (
          /* Meldungsflaeche statt Absatz, siehe ImprintPage. */
          <ErrorState message={t("privacy.controller.missing")} />
        )}
        <p className="type-body">{t("privacy.controller.noDpo")}</p>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="type-h2">{t("privacy.data.title")}</h2>
        <p className="type-body">{t("privacy.data.intro")}</p>
        <ul className="type-body flex list-disc flex-col gap-2 ps-6">
          {list("privacy.data.items").map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="type-h2">{t("privacy.purposes.title")}</h2>
        <ul className="type-body flex list-disc flex-col gap-2 ps-6">
          {list("privacy.purposes.items").map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="type-h2">{t("privacy.processors.title")}</h2>
        <p className="type-body">{t("privacy.processors.intro")}</p>
        <ul className="type-body flex list-disc flex-col gap-3 ps-6">
          {list("privacy.processors.items").map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <p className="type-body">{t("privacy.processors.note")}</p>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="type-h2">{t("privacy.retention.title")}</h2>
        <ul className="type-body flex list-disc flex-col gap-2 ps-6">
          {list("privacy.retention.items").map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="type-h2">{t("privacy.deletion.title")}</h2>
        <p className="type-body">{t("privacy.deletion.text")}</p>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="type-h2">{t("privacy.rights.title")}</h2>
        <p className="type-body">{t("privacy.rights.intro")}</p>
        <ul className="type-body flex list-disc flex-col gap-2 ps-6">
          {list("privacy.rights.items").map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <p className="type-body">{t("privacy.rights.authority")}</p>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="type-h2">{t("privacy.contactForm.title")}</h2>
        <p className="type-body">{t("privacy.contactForm.text")}</p>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="type-h2">{t("privacy.noTracking.title")}</h2>
        <p className="type-body">{t("privacy.noTracking.text")}</p>
        {/*
          Der Einwilligungsabsatz steht direkt hinter dem Dementi und
          nicht am Ende: die eingebetteten Medien sind die Ausnahme, die
          das Dementi einschraenkt, und eine Einschraenkung, die drei
          Absaetze spaeter kommt, liest niemand als solche.
        */}
        <p className="type-body">{t("privacy.noTracking.consent")}</p>
        <p className="type-body">{t("privacy.noTracking.storage")}</p>
        <p className="type-body">{t("privacy.noTracking.logout")}</p>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="type-h2">{t("privacy.indexing.title")}</h2>
        <p className="type-body">{t("privacy.indexing.text")}</p>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="type-h2">{t("privacy.related.title")}</h2>
        <p className="type-body">{t("privacy.related.intro")}</p>
        <ul className="type-body flex list-disc flex-col gap-2 ps-6">
          <li>
            <Link to="/imprint" className={inlineLinkClass}>
              {t("privacy.related.imprint")}
            </Link>
          </li>
          <li>
            <Link to="/accessibility" className={inlineLinkClass}>
              {t("privacy.related.accessibility")}
            </Link>
          </li>
        </ul>
      </section>
    </TextPage>
  )
}
