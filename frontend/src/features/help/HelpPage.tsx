import { useTranslation } from "react-i18next"
import { Link } from "react-router-dom"

import { useAuth } from "@/api/auth/AuthContext"
import { TextPage } from "@/components/common/TextPage"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { inlineLinkClass } from "@/lib/inlineLink"
import { useTranslatedList } from "@/lib/useTranslatedList"
import { cn } from "@/lib/utils"

import {
  helpSectionsFor,
  type HelpSection,
  type HelpTopic,
} from "./helpSections"
import { helpScreenshots } from "./screenshots"

/**
 * Hilfe und Dokumentation unter {@code /help} (KAN-93).
 *
 * <p><strong>Eine Seite, vier Bereiche, eine Sicht je Zugriffsebene.</strong>
 * Wer nicht angemeldet ist, liest, wie man Projekte findet und ein Konto
 * bekommt; ein angemeldetes Konto liest zusaetzlich den Editor, ein Konto mit
 * EDITOR die Redaktion, ein Konto mit ADMIN alles. Die Aufteilung steht in
 * {@code helpSections.ts} und nicht hier, damit sie ohne Rendern pruefbar
 * bleibt.
 *
 * <p><strong>Ohne Zugriffsschranke.</strong> Die Route liegt bewusst offen:
 * PUBLIC ist der Zustand „nicht angemeldet" (§2.1), und genau diese Personen
 * sollen nachlesen koennen, wie das Portal funktioniert. Verborgen wird
 * nichts Schuetzenswertes, die Seite laedt keine Serverdaten.
 *
 * <p><strong>Ueberschriften.</strong> h1 die Seite, h2 je Bereich, h3 je
 * aufklappbarer Punkt. Die dritte Ebene setzt nicht diese Datei, sondern die
 * Primitive: Base UI rendert {@code Accordion.Header} fest als {@code h3}
 * (nachgesehen in {@code @base-ui/react/accordion/header}). Ein eigenes
 * {@code h3} daneben waere eine Ueberschrift zu viel.
 *
 * <p><strong>Aufbau wie die Barrierefreiheitserklaerung</strong>
 * (KAN-42): dieselbe Textbreite, dieselben typografischen Klassen, kein
 * eigenes {@code main} und keine eigene Fusszeile, die stellt der
 * Anwendungsrahmen. Diese Seite ist ein Text mit Bildern und keine
 * Oberflaeche. Seit KAN-95 ist „dieselbe Huelle" keine Absichtserklaerung
 * mehr, sondern {@link TextPage}: beide Seiten nehmen sie, und die dritte
 * entsteht ohne dritte Kopie.
 *
 * <p><strong>Alles kommt aus i18n</strong>, deutsch und englisch, die
 * Alternativtexte der Bilder eingeschlossen. Die Bilder selbst erzeugt
 * {@code pnpm screenshots}; sie zeigen die englische Oberflaeche im hellen
 * Modus, und genau das steht als {@code help.imageNote} auch im Kopf der
 * Seite. Eine Abbildung, die etwas anderes zeigt als die Oberflaeche der
 * lesenden Person, ist kein Fehler, solange sie es sagt.
 */
export default function HelpPage() {
  const { t } = useTranslation()
  const { role } = useAuth()
  const sections = helpSectionsFor(role)

  return (
    /* Zwei kleine Absaetze im Kopf: der Rollenhinweis und der Bildhinweis.
       Die Abbildungen zeigen die englische Oberflaeche im hellen Modus, auch
       wenn die lesende Person gerade Deutsch oder Dunkel benutzt
       (Entscheidung der Klaerungsrunde zu KAN-93). Das steht einmal im Kopf
       und nicht an jedem Bild: einmal gesagt reicht, zwanzigmal wiederholt
       liest es niemand mehr. */
    <TextPage
      title={t("help.title")}
      intro={t("help.intro")}
      notes={[t("help.roleHint"), t("help.imageNote")]}
    >
      {/* Ein Sprungverzeichnis und keine bloße Liste: es fuehrt nur die
          Bereiche, die diese Zugriffsebene ueberhaupt sieht, und ist damit
          zugleich die Antwort auf „was steht hier drin". Eigene nav mit
          eigenem Namen, wie die Spalten der Fusszeile (SC 1.3.1).

          Ab dem zweiten Bereich, nicht ab dem ersten: wer nicht angemeldet
          ist, sieht genau einen, und ein Verzeichnis mit einem einzigen
          Eintrag verspricht eine Gliederung, die es nicht gibt. Es stuende
          dann als leere Karte zwischen Einleitung und Inhalt. */}
      {sections.length > 1 && (
        <nav
          aria-label={t("help.contents")}
          className="flex flex-col gap-2 rounded-card border border-border bg-card p-4"
        >
          <p className="type-label-xs font-semibold text-accent-foreground uppercase">
            {t("help.contents")}
          </p>
          <ul className="flex flex-wrap gap-x-4 gap-y-1">
            {sections.map((section) => (
              <li key={section.key}>
                <a
                  href={`#help-${section.key}`}
                  className={cn("type-body-sm", inlineLinkClass)}
                >
                  {t(`help.${section.key}.title`)}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      )}

      {sections.map((section) => (
        <HelpSectionView key={section.key} section={section} />
      ))}

      <p className="type-body">
        {t("help.feedback.text")}{" "}
        <Link to="/support" className={inlineLinkClass}>
          {t("help.feedback.link")}
        </Link>
      </p>
    </TextPage>
  )
}

/** Ein Bereich: Ueberschrift, Einleitung, Akkordeon. */
function HelpSectionView({ section }: { section: HelpSection }) {
  const { t } = useTranslation()
  const headingId = `help-${section.key}-heading`

  return (
    <section
      id={`help-${section.key}`}
      aria-labelledby={headingId}
      /* scroll-mt-4: der Sprung aus dem Verzeichnis soll die Ueberschrift
         nicht bündig an die Fensterkante setzen. Die Kopfleiste klebt in
         dieser Anwendung nicht, mehr Abstand braucht es also nicht. */
      className="flex scroll-mt-4 flex-col gap-3"
    >
      <h2 id={headingId} className="type-h2">
        {t(`help.${section.key}.title`)}
      </h2>
      <p className="type-body text-muted-foreground">
        {t(`help.${section.key}.intro`)}
      </p>
      {/* Mehrere Punkte duerfen offen stehen: wer eine Anleitung liest,
          vergleicht zwei Schritte, und ein Akkordeon, das den vorigen Punkt
          zuklappt, kostet genau dabei den Zusammenhang. Zu Beginn ist keiner
          offen, damit die Bereichsuebersicht auf einen Blick passt. */}
      <Accordion multiple defaultValue={[]}>
        {section.topics.map((topic) => (
          <AccordionItem key={topic.key} value={topic.key}>
            {/* Die Schriftrolle sitzt auf einem eigenen span und nicht am
                Ausloeser. `type-body` steht in @layer components, die
                Registry setzt am Trigger `text-sm` in @layer utilities, und
                die Utility gewinnt unabhaengig von der Spezifitaet: die
                Klasse traege am Ausloeser gar nichts bei (derselbe Fall wie
                in KAN-80). Das span hat keine konkurrierende Utility. */}
            <AccordionTrigger>
              <span className="type-body font-semibold">
                {t(`help.${section.key}.topics.${topic.key}.title`)}
              </span>
            </AccordionTrigger>
            {/*
              hiddenUntilFound statt des Standardverhaltens: Base UI haengt
              ein geschlossenes Panel aus dem Baum aus, und Strg+F faende den
              Hilfetext dann nicht. Ausgerechnet auf einer Hilfeseite ist die
              Browsersuche der erste Griff; mit diesem Attribut findet sie
              den Treffer und der Browser klappt den Punkt selbst auf.

              [&_p]:mb-0! mit Ausrufezeichen, weil die Regel der Registry
              (`[&_p:not(:last-child)]:mb-4`) in derselben Ebene liegt und
              die hoehere Spezifitaet hat. Ohne das Ausrufezeichen stuenden
              zwischen Text und Aufzaehlung zwei Abstaende uebereinander,
              also 2rem statt 1rem (Befund aus dem Review).
            */}
            <AccordionContent
              hiddenUntilFound
              className="flex flex-col gap-4 pb-6 [&_p]:mb-0!"
            >
              <HelpTopicBody sectionKey={section.key} topic={topic} />
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </section>
  )
}

/** Fliesstext, Aufzaehlung und, wo es eine gibt, die Abbildung. */
function HelpTopicBody({
  sectionKey,
  topic,
}: {
  sectionKey: string
  topic: HelpTopic
}) {
  const { t } = useTranslation()
  const base = `help.${sectionKey}.topics.${topic.key}`

  /* Wie in der Barrierefreiheitserklaerung: die Aufzaehlung steht als Feld in
     der Sprachdatei, damit ein Punkt mehr keine Codeaenderung braucht
     (KAN-95: derselbe Helfer aus lib/). */
  const translatedList = useTranslatedList()
  const steps = translatedList(`${base}.steps`)

  const image = topic.shot === undefined ? null : helpScreenshots[topic.shot]

  return (
    <>
      <p className="type-body">{t(`${base}.text`)}</p>
      {steps.length > 0 && (
        <ul className="type-body flex list-disc flex-col gap-2 ps-6">
          {steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ul>
      )}
      {image !== null && (
        <figure className="flex flex-col gap-2">
          {/* Der Alternativtext beschreibt, was auf dem Bild zu sehen ist;
              die Unterschrift sagt, worauf zu achten ist. Beides ist noetig
              und keines ersetzt das andere: ein leeres alt waere hier falsch,
              das Bild traegt Inhalt.

              width und height sind kein Beiwerk und keine Anzeigegroesse
              (die macht w-full h-auto), sondern das Seitenverhaeltnis. Base
              UI misst beim Oeffnen die Hoehe des Panels und schreibt sie als
              --accordion-panel-height; das Bild beginnt in genau diesem
              Moment zu laden und zaehlte ohne Masse mit Hoehe null. Das
              Panel oeffnete auf die falsche Hoehe und sprang danach
              (Befund aus dem Review). Die Zahlen kommen aus dem Bilderlauf
              und nicht aus der Hand. */}
          <img
            src={image.src}
            width={image.width}
            height={image.height}
            alt={t(`${base}.imageAlt`)}
            loading="lazy"
            decoding="async"
            className="h-auto w-full rounded-card border border-border"
          />
          <figcaption className="type-body-sm text-muted-foreground">
            {t(`${base}.imageCaption`)}
          </figcaption>
        </figure>
      )}
    </>
  )
}
