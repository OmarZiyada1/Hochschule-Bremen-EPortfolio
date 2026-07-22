package de.hsbremen.eportfolio.common.enums;

/**
 * Typ eines Inhaltsblocks. Ein Block entspricht genau einem Top-Level-Knoten
 * des ProseMirror-Dokuments; der Typ ist die abfragbare Projektion von
 * {@code inhalt.type}. LINK ist bewusst kein Blocktyp (Links sind Marks),
 * Aufgabenlisten sind nicht Teil des Schemas.
 */
public enum BlockTyp {
	UEBERSCHRIFT,
	TEXT,
	LISTE,
	ZITAT,
	CODE,
	FORMEL,
	TABELLE,
	TRENNLINIE,
	BILD,
	GALERIE,
	VIDEO,
	AUDIO,
	DOKUMENT,
	EINBETTUNG
}
