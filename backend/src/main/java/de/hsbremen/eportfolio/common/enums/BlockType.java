package de.hsbremen.eportfolio.common.enums;

/**
 * Typ eines Inhaltsblocks. Ein Block entspricht genau einem Top-Level-Knoten
 * des ProseMirror-Dokuments; der Typ ist die abfragbare Projektion von
 * {@code content.type}. LINK ist bewusst kein Blocktyp (Links sind Marks),
 * Aufgabenlisten sind nicht Teil des Schemas.
 */
public enum BlockType {
	HEADING,
	TEXT,
	LIST,
	QUOTE,
	CODE,
	FORMULA,
	TABLE,
	DIVIDER,
	IMAGE,
	GALLERY,
	VIDEO,
	AUDIO,
	DOCUMENT,
	EMBED
}
