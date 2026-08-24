package de.hsbremen.eportfolio.common.enums;

/**
 * Stufe, die die Redaktion beim Nominieren vorschlaegt (§2.13, §3.11.1).
 *
 * <p><strong>Eine Stufe und kein Platz.</strong> Bis Contract v67 nannte der
 * Vorschlag unmittelbar eine Position. Wer nominiert, kennt die uebrige Liste
 * aber nicht, und deshalb blieb das Feld meist leer; die Stufe ist die Angabe,
 * die eine Redakteur:in tatsaechlich treffen kann.
 *
 * <p><strong>Die Platzbereiche im Kommentar sind Erlaeuterung.</strong> Sie
 * binden nichts: {@code POST /api/admin/top10-nominations/{id}/accept} vergibt
 * den Platz frei, und der Server prueft nicht, ob er zur Stufe passt (§3.11.1
 * Regel 4). Eine Bindung zwaenge die Administration, einen als {@code TOP_1}
 * vorgeschlagenen Beitrag erst abzulehnen, um ihn auf Platz 4 zu setzen.
 */
public enum NominationTier {

	/** Absoluter Spitzenplatz, gemeint ist Platz 1. */
	TOP_1,

	/** Vordere Gruppe, gemeint sind die Plaetze 2 bis 5. */
	TOP_5,

	/** Aufnahme in die Liste, gemeint sind die Plaetze 6 bis 10. */
	TOP_10
}
