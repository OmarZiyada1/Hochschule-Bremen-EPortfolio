package de.hsbremen.eportfolio.support.dto;

import de.hsbremen.eportfolio.common.enums.SupportRequestCategory;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/**
 * Koerper von {@code POST /api/support} (§6.1, §3.20).
 *
 * <p>Der einzige Anfragekoerper des Projekts, der ohne Token hereinkommt. Die
 * Laengengrenzen stehen deshalb nicht nur in der Datenbank, sondern auch hier:
 * was ueber sie hinausgeht, faellt schon an der Bean-Validation und erreicht
 * den Dienst gar nicht.
 *
 * <p><strong>Die Meldungen nennen das Feld nicht selbst.</strong> Den Namen
 * stellt der {@code GlobalExceptionHandler} ohnehin voran, im Format
 * {@code "feld: Meldung"} (§6.2); ihn hier zu wiederholen ergaebe
 * {@code "name: name: …"}. Das Formular haengt die Meldung an die richtige
 * Zeile, ohne den Text zu deuten.
 *
 * @param name     Name der absendenden Person. Kommt immer aus dem Formular,
 *                 auch bei angemeldeten Konten (§3.20)
 * @param email    Adresse fuer die Antwort. Ebenfalls immer aus dem Formular:
 *                 wer die Anmeldung mit der eigenen Adresse gerade nicht
 *                 schafft, muss eine erreichbare zweite nennen koennen
 * @param category Einordnung nach §2.14
 * @param subject  Betreffzeile, in der Liste der Administration die
 *                 Ueberschrift der Karte
 * @param message  der Text der Anfrage, reiner Text ohne Auszeichnung
 * @param website  das versteckte Feld gegen automatisierte Einsendungen, siehe
 *                 den Kommentar an der Komponente
 */
@Schema(name = "SupportRequestCreateRequest",
		description = "Eine Anfrage aus dem oeffentlichen Kontaktformular (§6.1).")
public record SupportRequestCreateRequest(

		@Schema(description = "Name der absendenden Person.", example = "Lena Brandt")
		@NotBlank(message = "Name fehlt.")
		@Size(min = 2, max = 120, message = "Der Name muss 2 bis 120 Zeichen lang sein.")
		String name,

		@Schema(description = "Adresse fuer die Antwort. Der Server verschickt nichts; die "
				+ "Administration antwortet aus dem eigenen Postfach (§3.20).",
				example = "lena.brandt@example.org")
		@NotBlank(message = "E-Mail-Adresse fehlt.")
		@Email(message = "Keine gueltige E-Mail-Adresse.")
		@Size(max = 255,
				message = "Die E-Mail-Adresse darf hoechstens 255 Zeichen lang sein.")
		String email,

		@Schema(description = "Einordnung der Anfrage (§2.14).", example = "TECHNICAL_ISSUE")
		@NotNull(message = "Kategorie fehlt.")
		SupportRequestCategory category,

		@Schema(description = "Betreffzeile.", example = "Anmeldung schlaegt fehl")
		@NotBlank(message = "Betreff fehlt.")
		@Size(min = 3, max = 160,
				message = "Der Betreff muss 3 bis 160 Zeichen lang sein.")
		String subject,

		@Schema(description = "Der Text der Anfrage.",
				example = "Seit gestern komme ich mit meiner HSB-Kennung nicht mehr hinein.")
		@NotBlank(message = "Beschreibung fehlt.")
		@Size(min = 10, max = 2000,
				message = "Die Beschreibung muss 10 bis 2000 Zeichen lang sein.")
		String message,

		// Das Feld ist eine Falle und kein Feld (§6.1). Es steht im Formular, ist
		// fuer Menschen unsichtbar und bleibt deshalb leer; ein Programm, das
		// jedes Eingabefeld ausfuellt, fuellt es aus.
		//
		// Bewusst ohne jede Bean-Validation: ein @Null hier ergaebe 400
		// VALIDATION_FAILED und verriete damit genau das, was verborgen bleiben
		// soll. Ausgewertet wird das Feld im SupportService, der bei gefuelltem
		// Wert mit 201 antwortet und nichts speichert.
		//
		// Der Name ist bewusst gewoehnlich: ein Feld namens honeypot wuerde von
		// jedem Programm uebersprungen, das mehr tut als blind auszufuellen.
		@Schema(description = "Bleibt leer. Im Formular fuer Menschen unsichtbar.", example = "")
		String website) {
}
