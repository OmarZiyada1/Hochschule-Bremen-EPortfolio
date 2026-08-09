package de.hsbremen.eportfolio.project.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;
import java.util.List;
import java.util.UUID;

/**
 * Body von {@code POST /api/admin/projects/status} (§6.1, §4.1, KAN-46): der
 * Sammel-Statuswechsel der Administrationsseite.
 *
 * <p><strong>{@code action} ist ein {@code String} und kein Enum</strong>, aus
 * demselben Grund wie {@code BlockRequest.type}: als Enum scheiterte ein
 * unbekannter Wert schon an der JSON-Umwandlung, also bevor fachlicher Code
 * laeuft, und die Meldung kaeme aus Jackson statt aus dem Dienst. Die beiden
 * zulaessigen Werte sind ausserdem {@code kebab-case} und muessten in einem Enum
 * ohnehin auf {@code @JsonProperty} abgebildet werden. Der Dienst uebersetzt sie
 * in {@code ProjectTransition}, damit die Uebergangstabelle aus §4.1 auch hier
 * die einzige Quelle bleibt.
 *
 * <p><strong>Die Werte heissen wie die Einzel-Endpoints</strong>
 * ({@code POST /projects/{id}/publish} und
 * {@code POST /projects/{id}/request-revision}). §6.1 liess die Schreibweise
 * offen; KAN-46 legt sie so fest, weil derselbe Vorgang nicht unter zwei Namen
 * laufen soll, je nachdem ob er einzeln oder gesammelt ausgeloest wird.
 * Nachgetragen mit Contract v32.
 *
 * <p><strong>{@code reason} ist Pflicht, sobald {@code action} den Wert
 * {@code request-revision} traegt</strong>, und muss bei {@code publish} fehlen.
 * Der Einzel-Endpoint verlangt die Begruendung ebenfalls
 * ({@link RevisionRequest}): sie wird woertlich zum
 * {@code CHANGE_REQUEST}-Kommentar, und {@code Comment.text} ist
 * {@code not null}. Ohne das Feld gaebe es fuer den Sammel-Aufruf nur zwei
 * Auswege, naemlich einen leeren Kommentar oder einen vom Server erfundenen
 * Text; beides liesse die Autor:innen mit einem Arbeitsauftrag ohne Inhalt
 * zurueck. Ein Verstoss ergibt <strong>400</strong> {@code VALIDATION_FAILED},
 * und zwar fuer die ganze Anfrage: das ist ein Fehler im Aufruf und keine
 * Eigenschaft eines einzelnen Projekts.
 *
 * <p><strong>Kein {@code version}-Feld</strong>, wie bei den vier
 * Einzel-Uebergaengen: ein Uebergang schreibt nur {@code status} und
 * {@code publishedAt} und kann niemandes Arbeit ueberschreiben (§6.4).
 *
 * <p><strong>Keine Obergrenze fuer die Liste.</strong> Weder §6.1 noch das
 * Ticket nennen eine, und eine hier erfundene waere eine Regel, die nur im Code
 * stuende: die Oberflaeche waehlt aus einer paginierten Liste aus und wuesste
 * nicht, ab wann sie greift.
 *
 * @param projectIds die Projekte, die den Uebergang durchlaufen sollen; jedes
 *                   wird einzeln bewertet und einzeln berichtet
 * @param action     {@code publish} oder {@code request-revision}
 * @param reason     Begruendung, nur bei {@code request-revision}
 */
public record ProjectBulkStatusRequest(

		@Schema(description = "IDs der Projekte. Jedes wird einzeln geprueft und in einer eigenen "
				+ "Transaktion verarbeitet; ein unzulaessiger Uebergang blockiert die uebrigen "
				+ "nicht.")
		@NotEmpty(message = "projectIds fehlt oder ist leer. Ohne Auswahl gibt es nichts zu tun.")
		List<UUID> projectIds,

		@Schema(description = "Auszufuehrender Uebergang, benannt nach den Einzel-Endpoints aus "
				+ "§6.1.",
				allowableValues = {"publish", "request-revision"},
				example = "publish")
		@NotBlank(message = "action fehlt. Zulaessig sind publish und request-revision.")
		String action,

		@Schema(description = "Begruendung fuer die Ruecknahme. Pflicht bei request-revision, bei "
				+ "publish nicht erlaubt. Sie wird je Projekt ein eigener CHANGE_REQUEST-Kommentar "
				+ "im Status OPEN (§2.3, §2.4).",
				example = "Bitte die Quellenangaben ergaenzen.")
		@Size(max = 5000, message = "reason ist zu lang (hoechstens 5000 Zeichen).")
		String reason) {
}
