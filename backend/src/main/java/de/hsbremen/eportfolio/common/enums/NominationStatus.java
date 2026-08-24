package de.hsbremen.eportfolio.common.enums;

/**
 * Stand einer Nominierung, solange sie noch offen ist oder bereits entschieden wurde.
 *
 * <p><strong>{@code WITHDRAWN} ist seit Contract v70 dabei</strong> (KAN-37) und
 * kein Sonderfall von {@code REJECTED}: abgelehnt hat die Administration einen
 * Vorschlag, den sie geprueft hat, zurueckgezogen wird der Vorschlag selbst.
 * Bis v69 gab es keinen Weg zurueck, ein versehentlicher Vorschlag blieb offen,
 * bis die Administration ihn ablehnte, und die Ablehnung stand danach im
 * Protokoll als kuratorische Entscheidung, die so niemand getroffen hatte.
 */
public enum NominationStatus {
	PENDING,
	ACCEPTED,
	REJECTED,

	/**
	 * Zurueckgezogen (§3.11.1, seit Contract v70). Die nominierende Person zieht
	 * ihren eigenen Vorschlag zurueck, solange er {@code PENDING} ist; die
	 * Administration jeden, auch einen bereits angenommenen. Im zweiten Fall
	 * verlaesst das Projekt dabei die kuratierte Liste.
	 */
	WITHDRAWN
}
