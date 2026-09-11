import { useTranslation } from "react-i18next"
import { Link } from "react-router-dom"

import { ErrorState } from "@/components/common/ErrorState"
import { TextPage } from "@/components/common/TextPage"
import { OperatorAddress } from "@/features/legal/OperatorAddress"
import { readOperatorDetails } from "@/features/legal/operatorDetails"
import { inlineLinkClass } from "@/lib/inlineLink"
import { useTranslatedList } from "@/lib/useTranslatedList"

/**
 * Das Impressum unter {@code /imprint} (KAN-100). Bis dahin stand hier die
 * Platzhalterhuelle aus KAN-7 mit dem Satz, der Inhalt werde noch
 * ergaenzt. Mit dieser Seite und der Datenschutzerklaerung verliert sie
 * ihre letzten beiden Routen und ist deshalb entfallen, wie ihr eigenes
 * Javadoc es vorgesehen hatte.
 *
 * <p><strong>Warum die Seite vor dem Oeffentlichstellen fertig sein muss.</strong>
 * Das Portal wird unter einer privaten Domain erreichbar sein und traegt
 * dabei Namen und Bildmarke der Hochschule Bremen. Ohne Impressum stuende
 * nirgends, dass dahinter keine Hochschule steht, sondern eine
 * Abschlussarbeit; und die Namensnennung, zu der die Lizenz der
 * Reaktionssymbole verpflichtet, haette bis dahin ueberhaupt keinen Ort in
 * der Anwendung. Genau das haelt {@code NOTICE.md} als vorgesehenen Weg fest.
 *
 * <p><strong>Der Abschnitt zur Hochschule ist der Kern und keine
 * Hoeflichkeit.</strong> In der Klaerungsrunde zu KAN-100 ist entschieden
 * worden, Name und Bildmarke zu behalten und die Klarstellung allein hier zu
 * fuehren, nicht zusaetzlich in der Fusszeile. Damit traegt dieser Abschnitt
 * die ganze Last: er ist die einzige Stelle der Anwendung, an der steht, wem
 * die Seite gehoert und wem nicht.
 *
 * <p><strong>Die Angaben zum Betreiber kommen nicht aus i18n.</strong> Alles
 * uebrige auf dieser Seite schon (Frontend-Regel 7), aber eine
 * ladungsfaehige Privatanschrift gehoert nicht in ein oeffentliches
 * Repository; die Begruendung steht in
 * {@link readOperatorDetails}. Fehlen sie, zeigt die Seite einen sichtbaren
 * Hinweis und keine erfundene Anschrift (Frontend-Regel 10).
 *
 * <p>Aufbau aus Ueberschriften und Listen wie die Barrierefreiheitserklaerung:
 * die Seite ist ein Text und keine Oberflaeche. Textspalte und Kopfbereich
 * stellt {@link TextPage} (KAN-95).
 */
export default function ImprintPage() {
  const { t } = useTranslation()
  const list = useTranslatedList()
  const details = readOperatorDetails()

  return (
    <TextPage
      title={t("imprint.title")}
      intro={t("imprint.intro")}
      notes={[t("imprint.prototypeNote")]}
    >
      <section className="flex flex-col gap-3">
        <h2 className="type-h2">{t("imprint.operator.title")}</h2>
        {details ? (
          <>
            <p className="type-body">{t("imprint.operator.intro")}</p>
            <OperatorAddress
              details={details}
              emailLabel={t("imprint.operator.emailLabel")}
            />
            <p className="type-body">{t("imprint.operator.responsible")}</p>
          </>
        ) : (
          /*
            Eine Meldungsflaeche und kein Absatz (Befund des
            Frontend-Reviews). Auf einem oeffentlich erreichbaren Stand
            heisst dieser Satz „diesem Portal fehlt sein Impressum"; als
            gewoehnlicher Absatz saehe er aus wie ein weiterer Teil des
            Impressums. ErrorState ist die vorhandene Huelle dafuer und
            bringt role="alert" mit, ohne eine Ueberschrift zu setzen,
            die die Abschnittsordnung stoeren wuerde.
          */
          <ErrorState message={t("imprint.operator.missing")} />
        )}
        <p className="type-body">
          {t("imprint.operator.contactText")}{" "}
          <Link to="/support" className={inlineLinkClass}>
            {t("imprint.operator.contactLink")}
          </Link>
        </p>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="type-h2">{t("imprint.university.title")}</h2>
        <p className="type-body">{t("imprint.university.intro")}</p>
        <ul className="type-body flex list-disc flex-col gap-2 ps-6">
          {list("imprint.university.items").map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="type-h2">{t("imprint.content.title")}</h2>
        <ul className="type-body flex list-disc flex-col gap-2 ps-6">
          {list("imprint.content.items").map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="type-h2">{t("imprint.attribution.title")}</h2>
        <p className="type-body">{t("imprint.attribution.intro")}</p>
        {/*
          Der Nennungstext steht als Zitat und nicht als gewoehnlicher Absatz:
          er ist woertlich vorgeschrieben und darf nicht uebersetzt werden.
          Deshalb lautet er in de.json und en.json gleich.

          Dieselbe Zeichnung wie jedes andere Zitat der Anwendung
          (styles/project-content.css, blockquote): vier Viertelpixel in
          der Primaerfarbe. Vorher stand hier border-border, und das war
          in beiden Modi praktisch unsichtbar (rund 1,2:1 gegen den
          Hintergrund), das Zitat also gar nicht als solches erkennbar.

          lang="en", weil der Wortlaut englisch bleiben MUSS und das
          Dokument deutsch ist: ohne die Angabe spricht ein Screenreader
          ihn deutsch aus (SC 3.1.2).

          Der Verweis auf die Quelle gehoert zur Nennung, so gibt
          Flaticon sie aus; NOTICE.md fuehrt dieselbe Adresse. Ziel und
          rel stehen im Code und nicht in i18n, uebersetzt wird nur der
          Wortlaut. Kein target="_blank", wie ueberall in dieser
          Anwendung (renderer/renderInline.tsx).
        */}
        <blockquote
          lang="en"
          className="type-body border-s-4 border-primary ps-4 text-muted-foreground"
        >
          <a
            href="https://www.flaticon.com/free-icons/clapping"
            rel="noopener noreferrer"
            className={inlineLinkClass}
          >
            {t("imprint.attribution.notice")}
          </a>
        </blockquote>
        <p className="type-body">{t("imprint.attribution.detail")}</p>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="type-h2">{t("imprint.related.title")}</h2>
        <p className="type-body">{t("imprint.related.intro")}</p>
        <ul className="type-body flex list-disc flex-col gap-2 ps-6">
          <li>
            <Link to="/privacy" className={inlineLinkClass}>
              {t("imprint.related.privacy")}
            </Link>
          </li>
          <li>
            <Link to="/accessibility" className={inlineLinkClass}>
              {t("imprint.related.accessibility")}
            </Link>
          </li>
        </ul>
      </section>
    </TextPage>
  )
}
