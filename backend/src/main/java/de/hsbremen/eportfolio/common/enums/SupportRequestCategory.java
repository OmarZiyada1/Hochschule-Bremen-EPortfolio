package de.hsbremen.eportfolio.common.enums;

/**
 * Einordnung einer Support-Anfrage (§2.14, §3.20).
 *
 * <p><strong>Eine Angabe der absendenden Person und keine Zusage des
 * Systems.</strong> Der Server prueft nicht, ob der Text zur gewaehlten
 * Einordnung passt, und leitet aus ihr weder eine Prioritaet noch eine
 * Zustaendigkeit ab. Eine Bindung haette gerade dort geschadet, wofuer das
 * Formular vor allem da ist: wer nicht hineinkommt, kann die Ursache seines
 * Problems nicht einordnen.
 *
 * <p><strong>Warum die Liste so kurz ist.</strong> Fuenf Werte stehen am Anfang
 * des Formulars, und eine lange Auswahlliste kostet dort mehr Zeit, als sie der
 * Administration spaeter spart. {@link #OTHER} faengt den Rest.
 */
public enum SupportRequestCategory {

	/** Technisches Problem, etwa eine Seite, die nicht laedt. */
	TECHNICAL_ISSUE,

	/** Konto und Anmeldung, etwa eine nicht ankommende Bestaetigungsmail. */
	ACCOUNT_ACCESS,

	/** Projekt und Einreichung, etwa ein Beitrag, der sich nicht einreichen laesst. */
	PROJECT_SUBMISSION,

	/**
	 * Hinweis auf einen veroeffentlichten Beitrag, der nicht stehen bleiben
	 * sollte.
	 *
	 * <p>Steht hier und nicht als Meldeweg am Beitrag selbst: eine Meldung am
	 * Beitrag setzt einen erreichbaren Beitrag und in aller Regel ein Konto
	 * voraus, das Kontaktformular dagegen nicht. Ein eigener Meldeweg am Beitrag
	 * bleibt davon unberuehrt (§2.14).
	 */
	ABUSE_REPORT,

	/** Sonstiges, wenn keine der vier Einordnungen passt. */
	OTHER
}
