package de.hsbremen.eportfolio.sitecontent;

import java.util.Arrays;
import java.util.List;
import java.util.Optional;

/**
 * Die pflegbaren Textstellen der oeffentlichen Startseite (§3.21).
 *
 * <p><strong>Der Konstantenname ist der Speicherwert, der i18n-Schluessel die
 * Aussenform.</strong> In {@code site_content.content_key} steht
 * {@code HOME_HERO_LABEL}, wie bei jedem anderen als Zeichenkette abgelegten
 * Enum im Schema, und der Check-Constraint {@code ck_site_content_key} zaehlt
 * genau diese Namen auf. Nach aussen gibt {@link #i18nKey()} dagegen
 * {@code home.hero.label} zurueck, denn das ist, was der Client braucht: er
 * legt den Servertext ueber seine eigene i18n-Vorgabe, und dafuer muss der
 * Schluessel derselbe sein. Die Zuordnung steht deshalb genau einmal, naemlich
 * hier.
 *
 * <p><strong>Warum eine feste Liste und kein Freitextschluessel.</strong> Ein
 * beliebiger Schluessel liesse die Administration Text unter einem Namen
 * ablegen, den die Startseite nie liest, und niemand bemerkte es. Die
 * Aufzaehlung ist zugleich die Vorlage fuer die Pflegemaske: sie kennt ohne
 * weitere Absprache alle Felder, die es zu fuellen gibt.
 *
 * <p><strong>Drei Beschriftungen fehlen bewusst.</strong>
 * {@code home.top10.viewProject}, {@code home.top10.freeSlot} und
 * {@code home.top10.freeBadge} stehen nicht in dieser Liste. Sie gehoeren zu
 * Komponenten, die auch ausserhalb der Startseite auftreten (die Kachel der
 * Top-10 und der freie Platz erscheinen ebenso in der Top-10-Verwaltung); wer
 * sie hier aenderte, aenderte sie unbemerkt an einer zweiten Stelle mit.
 *
 * <p><strong>Pflichtplatzhalter gehoeren zum Schluessel und nicht zum Text.</strong>
 * Der gespeicherte Wert wird vom Frontend mit denselben Werten interpoliert wie
 * die i18n-Vorgabe. Fehlt der Platzhalter, verschwindet die Zahl wortlos aus
 * der Seite, statt dass etwas kaputtgeht; genau deshalb prueft der Server ihn
 * beim Speichern und nicht erst die Anzeige (400 {@code VALIDATION_FAILED},
 * §6.2). Umgekehrt darf ein Text keinen Platzhalter tragen, den niemand fuellt:
 * er stuende danach wortwoertlich auf der Seite.
 */
public enum SiteContentKey {

	/** Kleine Auszeichnung ueber der Ueberschrift des Kopfbereichs. */
	HOME_HERO_LABEL("home.hero.label"),

	/** Erste Zeile der Hauptueberschrift. */
	HOME_HERO_TITLE_LINE1("home.hero.titleLine1"),

	/** Zweite Zeile der Hauptueberschrift. */
	HOME_HERO_TITLE_LINE2("home.hero.titleLine2"),

	/** Fliesstext unter der Hauptueberschrift. */
	HOME_HERO_SUBTITLE("home.hero.subtitle"),

	/** Beschriftung der Schaltflaeche, die zur Top-10 fuehrt. */
	HOME_HERO_EXPLORE_TOP10("home.hero.exploreTop10"),

	/** Kleine Auszeichnung ueber der Ueberschrift des Top-10-Abschnitts. */
	HOME_TOP10_LABEL("home.top10.label"),

	/**
	 * Ueberschrift des Top-10-Abschnitts. Traegt das laufende Jahr und braucht
	 * deshalb {@code {{year}}}.
	 */
	HOME_TOP10_TITLE("home.top10.title", "year"),

	/** Fliesstext unter der Ueberschrift des Top-10-Abschnitts. */
	HOME_TOP10_DESCRIPTION("home.top10.description"),

	/** Kleine Auszeichnung ueber der Ueberschrift des Abschlussabschnitts. */
	HOME_CTA_LABEL("home.cta.label"),

	/** Ueberschrift des Abschlussabschnitts. */
	HOME_CTA_TITLE("home.cta.title"),

	/**
	 * Fliesstext des Abschlussabschnitts. Nennt zwei gezaehlte Groessen und
	 * braucht deshalb {@code {{works}}} und {@code {{faculties}}}.
	 */
	HOME_CTA_DESCRIPTION("home.cta.description", "works", "faculties"),

	/** Beschriftung der Kennzahl "Projekte". */
	HOME_CTA_STAT_WORKS("home.cta.statWorks"),

	/** Beschriftung der Kennzahl "Fakultaeten". */
	HOME_CTA_STAT_FACULTIES("home.cta.statFaculties"),

	/** Beschriftung der Kennzahl "Studiengaenge". */
	HOME_CTA_STAT_PROGRAMS("home.cta.statPrograms"),

	/** Beschriftung der Schaltflaeche, die zur Projektbibliothek fuehrt. */
	HOME_CTA_OPEN_LIBRARY("home.cta.openLibrary");

	private final String i18nKey;

	private final List<String> requiredPlaceholders;

	SiteContentKey(String i18nKey, String... requiredPlaceholders) {
		this.i18nKey = i18nKey;
		this.requiredPlaceholders = List.of(requiredPlaceholders);
	}

	/**
	 * Der Schluessel, unter dem das Frontend denselben Text in seinen
	 * i18n-Dateien fuehrt, etwa {@code home.hero.label}. Das ist die einzige
	 * Form, die in Request und Response vorkommt.
	 */
	public String i18nKey() {
		return i18nKey;
	}

	/**
	 * Die Platzhalternamen, die im gespeicherten Text vorkommen muessen, ohne
	 * die geschweiften Klammern. Leer heisst: der Text darf ueberhaupt keinen
	 * Platzhalter tragen.
	 */
	public List<String> requiredPlaceholders() {
		return requiredPlaceholders;
	}

	/**
	 * Sucht den Schluessel zu seiner Aussenform. Leer heisst: die Startseite
	 * kennt diesen Schluessel nicht, und der Aufruf endet mit 400
	 * {@code VALIDATION_FAILED} (§6.2).
	 *
	 * <p>Verglichen wird exakt und nicht ohne Ruecksicht auf Gross- und
	 * Kleinschreibung: der Client schickt zurueck, was er aus dieser API
	 * bekommen hat, und eine tolerante Suche verdeckte einen Tippfehler in
	 * seinen i18n-Dateien, statt ihn zu melden.
	 */
	public static Optional<SiteContentKey> fromI18nKey(String i18nKey) {
		return Arrays.stream(values())
				.filter(key -> key.i18nKey.equals(i18nKey))
				.findFirst();
	}
}
