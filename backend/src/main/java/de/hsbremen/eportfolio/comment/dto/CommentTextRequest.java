package de.hsbremen.eportfolio.comment.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * Body von {@code PATCH /api/comments/{id}} (§6.1): der neue Text eines bereits
 * angelegten Kommentars.
 *
 * <p><strong>Warum nur der Text und nicht auch {@code type}.</strong> Der Typ
 * bestimmt, wer den Kommentar ueberhaupt sehen darf (§2.3). Waere er
 * nachtraeglich aenderbar, liesse sich eine gelesene Rueckmeldung in eine
 * interne Notiz verwandeln und damit vor der Projektseite verstecken, oder
 * umgekehrt eine Notiz nachtraeglich veroeffentlichen. Wer etwas anderes sagen
 * will, schreibt einen neuen Kommentar.
 *
 * <p><strong>Kein {@code version}-Feld</strong>, aus demselben Grund wie in
 * {@code RevisionRequest}: §6.4 schuetzt das gemeinsame Bearbeiten eines
 * Projekts. Einen Kommentar bearbeitet ausschliesslich seine Verfasser:in
 * (§6.1), es gibt hier also keine zweite Person, deren Arbeit verloren gehen
 * koennte.
 *
 * @param text der neue Kommentartext, mit denselben Grenzen wie beim Anlegen
 */
public record CommentTextRequest(
		@Schema(description = "Der neue Kommentartext.",
				example = "Nachtrag: die Quellenangaben sind inzwischen ergaenzt.")
		@NotBlank(message = "text fehlt. Ein Kommentar ohne Text sagt nichts.")
		@Size(max = 5000, message = "text ist zu lang (hoechstens 5000 Zeichen).")
		String text) {
}
