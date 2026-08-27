package de.hsbremen.eportfolio.common.enums;

/**
 * Typ eines Inhaltsblocks. Ein Block entspricht genau einem Top-Level-Knoten
 * des ProseMirror-Dokuments; der Typ ist die abfragbare Projektion von
 * {@code content.type}. LINK ist bewusst kein Blocktyp (Links sind Marks),
 * Aufgabenlisten sind nicht Teil des Schemas.
 *
 * <p>{@code TABLE_OF_CONTENTS} kam mit Contract v84 dazu (KAN-83). Das
 * Inhaltsverzeichnis ist ein Block mit gespeicherter Momentaufnahme und keine
 * Ableitung beim Lesen: Detailansicht, Redaktionsansicht und PDF-Export rendern
 * ohne laufenden Editor, eine Ableitung waere dort dreimal getrennt zu bauen.
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
	EMBED,
	TABLE_OF_CONTENTS
}
