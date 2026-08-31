import { useTranslation } from "react-i18next"
import { Link } from "react-router-dom"

import { TextPage } from "@/components/common/TextPage"
import { inlineLinkClass } from "@/lib/inlineLink"
import { useTranslatedList } from "@/lib/useTranslatedList"

/**
 * Die Barrierefreiheitserklaerung unter {@code /accessibility} (KAN-42,
 * Umfang 9). Bis dahin stand hier ein {@link PlaceholderPage}.
 *
 * <p><strong>Kein foermliches Dokument nach BITV.</strong> Eine
 * Konformitaetserklaerung setzt eine Stelle voraus, die sie verantwortet,
 * einen Ueberwachungsweg und ein Schlichtungsverfahren; nichts davon gibt es
 * fuer einen Prototyp aus einer Abschlussarbeit. Diese Seite berichtet
 * stattdessen einen Pruefstand: was geprueft wurde, womit, und was dabei
 * offen geblieben ist. Eine unbelegte Zusage waere schlechter als eine
 * benannte Luecke.
 *
 * <p><strong>Die Grenzen stehen nicht am Ende, sondern gleichrangig.</strong>
 * Sie sind der Grund, warum es diese Seite gibt: die Zahl der bestandenen
 * Pruefungen sagt fuer sich genommen wenig, solange nicht danebensteht, was
 * die Pruefung nicht sehen konnte.
 *
 * <p>Aufbau aus Ueberschriften und Listen statt aus Karten: die Seite ist ein
 * Text und keine Oberflaeche. Alle Inhalte kommen aus i18n, deutsch und
 * englisch (Frontend-Regel 7). Textspalte und Kopfbereich stellt seit KAN-95
 * {@link TextPage}; hier steht nur noch, was diese Seite ausmacht.
 *
 * <p><strong>Datum und Zahlen stehen als Text in den Schluesseln</strong>, nicht
 * als Variablen aus dem Code. Ein spaeterer Durchgang aendert sie deshalb in
 * {@code de.json} und {@code en.json}, an vier Stellen. Das ist Absicht: der
 * Satz „geprueft am" ist eine Aussage ueber einen Vorgang und nicht ueber den
 * Code, und ein aus dem Build abgeleitetes Datum behauptete eine Pruefung,
 * die vielleicht gar nicht stattgefunden hat.
 */
export default function AccessibilityPage() {
  const { t } = useTranslation()
  /* Die Listen kommen als Feld aus i18n, damit ein Punkt mehr keine
     Codeaenderung braucht (KAN-95: der Helfer liegt in lib/). */
  const list = useTranslatedList()

  return (
    <TextPage
      title={t("accessibility.title")}
      intro={t("accessibility.intro")}
      notes={[t("accessibility.notFormal")]}
    >
      <section className="flex flex-col gap-3">
        <h2 className="type-h2">{t("accessibility.status.title")}</h2>
        <dl className="type-body flex flex-col gap-2">
          <div className="flex flex-wrap gap-x-2">
            <dt className="font-semibold">
              {t("accessibility.status.dateLabel")}
            </dt>
            <dd>{t("accessibility.status.date")}</dd>
          </div>
          <div className="flex flex-wrap gap-x-2">
            <dt className="font-semibold">
              {t("accessibility.status.targetLabel")}
            </dt>
            <dd>{t("accessibility.status.target")}</dd>
          </div>
          <div className="flex flex-wrap gap-x-2">
            <dt className="font-semibold">
              {t("accessibility.status.resultLabel")}
            </dt>
            <dd>{t("accessibility.status.result")}</dd>
          </div>
        </dl>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="type-h2">{t("accessibility.method.title")}</h2>
        <p className="type-body">{t("accessibility.method.intro")}</p>
        <ul className="type-body flex list-disc flex-col gap-2 ps-6">
          {list("accessibility.method.items").map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="type-h2">{t("accessibility.scope.title")}</h2>
        <p className="type-body">{t("accessibility.scope.intro")}</p>
        <ul className="type-body flex list-disc flex-col gap-2 ps-6">
          {list("accessibility.scope.items").map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="type-h2">{t("accessibility.limits.title")}</h2>
        <p className="type-body">{t("accessibility.limits.intro")}</p>
        <ul className="type-body flex list-disc flex-col gap-3 ps-6">
          {list("accessibility.limits.items").map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="type-h2">{t("accessibility.feedback.title")}</h2>
        <p className="type-body">
          {t("accessibility.feedback.text")}{" "}
          <Link to="/support" className={inlineLinkClass}>
            {t("accessibility.feedback.link")}
          </Link>
        </p>
      </section>
    </TextPage>
  )
}
