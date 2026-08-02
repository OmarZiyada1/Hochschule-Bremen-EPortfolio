package de.hsbremen.eportfolio.projekt;

import de.hsbremen.eportfolio.auth.AngemeldeterBenutzer;
import de.hsbremen.eportfolio.common.dto.SeiteAntwort;
import de.hsbremen.eportfolio.common.enums.Abschluss;
import de.hsbremen.eportfolio.common.enums.ProjektStatus;
import de.hsbremen.eportfolio.common.enums.Projekttyp;
import de.hsbremen.eportfolio.projekt.dto.ProjektDetailAntwort;
import de.hsbremen.eportfolio.projekt.dto.ProjektFilterAnfrage;
import de.hsbremen.eportfolio.projekt.dto.ProjektKachelAntwort;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.UUID;
import org.springdoc.core.annotations.ParameterObject;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Die lesenden Projekt-Endpoints aus API-Contract §6.1.
 *
 * <p>Beide Pfade sind in {@code SecurityConfig} bereits als PUBLIC-GET
 * freigegeben; die Regeln standen dort schon vor diesem Controller, damit er
 * nicht versehentlich hinter {@code anyRequest().authenticated()} landet. „Frei
 * erreichbar" heisst hier ausdruecklich nicht „alles sichtbar": was ein
 * Aufrufer tatsaechlich bekommt, entscheidet der {@link ProjektLeseService}
 * anhand der Rechtematrix (§5). Ohne Token ist
 * {@code @AuthenticationPrincipal} {@code null}, und genau das ist der
 * PUBLIC-Fall aus §2.1.
 *
 * <p>Der Controller bleibt duenn: Parameter binden, Dienst rufen. Filterlogik,
 * Sichtbarkeit und Fehlerpolitik liegen im Service.
 */
@RestController
@RequestMapping("/api/projekte")
@Tag(name = "Projekte", description = "Projektliste und Projektdetail (§6.1). Ohne Token sind "
		+ "nur veroeffentlichte Projekte sichtbar; mit Token richtet sich der Umfang nach der "
		+ "Rechtematrix aus §5.")
public class ProjektController {

	private final ProjektLeseService projektLeseService;

	public ProjektController(ProjektLeseService projektLeseService) {
		this.projektLeseService = projektLeseService;
	}

	/**
	 * Projektliste mit Filtern und Paginierung.
	 *
	 * <p>Die Filter werden einzeln gebunden statt als Objekt, damit jeder von
	 * ihnen in der OpenAPI-Beschreibung seine eigene Erklaerung tragen kann. Zu
	 * einem {@code ProjektFilterAnfrage} gebuendelt werden sie erst beim
	 * Weiterreichen.
	 */
	@Operation(summary = "Projektliste lesen",
			description = "Liefert eine Seite im Format SeiteAntwort<ProjektKachelAntwort> (§6.6). "
					+ "Ohne Token kommen nur veroeffentlichte Projekte; Studierende sehen "
					+ "zusaetzlich ihre eigenen, Redaktion und Admin alle (§5). Unbekannte "
					+ "Filter-IDs ergeben eine leere Liste, kein 404.")
	@ApiResponse(responseCode = "200", description = "Eine Seite der Projektliste.")
	@ApiResponse(responseCode = "400", description = "Ein Parameter hat nicht das erwartete Format "
			+ "oder es wurde nach einem nicht erlaubten Feld sortiert.")
	@ApiResponse(responseCode = "401", description = "\"redakteur=me\" ohne Anmeldung, oder das "
			+ "mitgeschickte Token ist ungueltig bzw. abgelaufen.")
	@GetMapping
	public SeiteAntwort<ProjektKachelAntwort> liste(
			@AuthenticationPrincipal AngemeldeterBenutzer benutzer,

			@Parameter(description = "Filter: ID einer Kategorie aus GET /api/kategorien.")
			@RequestParam(name = "kategorie", required = false) UUID kategorie,

			@Parameter(description = "Filter: ID einer Fakultaet aus GET /api/fakultaeten.")
			@RequestParam(name = "fakultaet", required = false) UUID fakultaet,

			@Parameter(description = "Filter: ID eines Studiengangs aus GET /api/studiengaenge.")
			@RequestParam(name = "studiengang", required = false) UUID studiengang,

			@Parameter(description = "Filter: ID eines Moduls aus GET /api/module.")
			@RequestParam(name = "modul", required = false) UUID modul,

			@Parameter(description = "Filter: angestrebter Abschluss (§2.7).")
			@RequestParam(name = "abschluss", required = false) Abschluss abschluss,

			@Parameter(description = "Filter: Projekttyp (§2.6).")
			@RequestParam(name = "typ", required = false) Projekttyp typ,

			@Parameter(description = "Filter: Semester in genau der gespeicherten Schreibweise.",
					example = "WS 2025/26")
			@RequestParam(name = "semester", required = false) String semester,

			@Parameter(description = "Suchbegriff fuer Titel und Kurzbeschreibung, unabhaengig "
					+ "von Gross- und Kleinschreibung.")
			@RequestParam(name = "q", required = false) String q,

			@Parameter(description = "Filter: Projektstatus (§2.2). Wirkt nur innerhalb dessen, "
					+ "was ohne Anmeldung ohnehin sichtbar ist.")
			@RequestParam(name = "status", required = false) ProjektStatus status,

			@Parameter(description = "Filter: ID der Autor:in.")
			@RequestParam(name = "autor", required = false) UUID autor,

			@Parameter(description = "Filter: ID einer zugewiesenen Redakteur:in, oder \"me\" "
					+ "fuer \"Meine Reviews\". \"me\" setzt eine Anmeldung voraus.",
					example = "me")
			@RequestParam(name = "redakteur", required = false) String redakteur,

			@ParameterObject
			@PageableDefault(size = 20, sort = "aktualisiertAm", direction = Sort.Direction.DESC)
			Pageable seitenwunsch) {

		ProjektFilterAnfrage filter = new ProjektFilterAnfrage(
				kategorie, fakultaet, studiengang, modul, abschluss, typ, semester, q, status, autor,
				redakteur);

		return projektLeseService.liste(benutzer, filter, seitenwunsch);
	}

	/**
	 * Ein einzelnes Projekt.
	 *
	 * <p>Die drei Fehlerfaelle folgen §6.3.1 und sind bewusst unterscheidbar:
	 * 404, wenn es die ID nicht gibt, 401 ohne Anmeldung, 403 bei fehlendem
	 * Leserecht. Die Existenz einer Ressource wird also nicht verschleiert.
	 */
	@Operation(summary = "Projekt lesen",
			description = "Metadaten, Mitglieder, Inhalt (geordnet) und version. Die Felder "
					+ "\"redakteure\" und \"statusHistorie\" sind nur fuer die Projektseite, die "
					+ "zugewiesene Redaktion und Admins gefuellt, sonst null (§3.12).")
	@ApiResponse(responseCode = "200", description = "Das Projekt.")
	@ApiResponse(responseCode = "401", description = "Das Projekt ist nicht oeffentlich und es "
			+ "wurde kein gueltiges Token mitgeschickt.")
	@ApiResponse(responseCode = "403", description = "Angemeldet, aber ohne Leserecht auf dieses "
			+ "Projekt.")
	@ApiResponse(responseCode = "404", description = "Unter dieser ID gibt es kein Projekt.")
	@GetMapping("/{id}")
	public ProjektDetailAntwort detail(
			@AuthenticationPrincipal AngemeldeterBenutzer benutzer,

			@Parameter(description = "ID des Projekts.")
			@PathVariable("id") UUID id) {

		return projektLeseService.detail(benutzer, id);
	}
}
