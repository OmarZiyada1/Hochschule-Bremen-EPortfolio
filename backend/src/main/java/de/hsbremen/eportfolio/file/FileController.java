package de.hsbremen.eportfolio.file;

import de.hsbremen.eportfolio.auth.AuthenticatedUser;
import de.hsbremen.eportfolio.file.dto.StoredFileResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.UUID;
import org.springframework.core.io.InputStreamResource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

/**
 * Die drei Datei-Endpoints aus API-Contract §6.1 (KAN-23).
 *
 * <p><strong>Zur Freigabe in {@code SecurityConfig}:</strong> dort steht
 * {@code /api/files/*} als PUBLIC-GET, weil Avatare und Dateien
 * veroeffentlichter Projekte ohne Anmeldung abrufbar sind (§3.15, §5). Ohne
 * die Zeile ergaebe der Abruf eines Avatars 401. {@code POST} und
 * {@code DELETE} fallen unter {@code anyRequest().authenticated()}. Die
 * eigentliche Entscheidung trifft der {@link FileService}, nicht die
 * Filterkette.
 *
 * <p>Der Controller bleibt duenn: Parameter binden, Dienst rufen, Header
 * setzen. Rechte, Statusregeln und die Typpruefung liegen im Dienst.
 */
@RestController
@RequestMapping("/api/files")
@Tag(name = "Dateien", description = "Hochgeladene Medien: Bilder, Audio, Dokumente, Avatare "
		+ "(§3.15). Die Bytes liegen in einem Objektspeicher; ausgeliefert wird ausschliesslich "
		+ "ueber GET /api/files/{id}, eine zweite Adresse gibt es nicht (§3.15.1).")
public class FileController {

	private final FileService fileService;

	public FileController(FileService fileService) {
		this.fileService = fileService;
	}

	@Operation(summary = "Datei hochladen",
			description = "Multipart-Upload (Teil \"file\", optional Feld \"projectId\"). Mit "
					+ "projectId entsteht eine Projektdatei (nur in DRAFT und REVISION), ohne ein "
					+ "Avatar. Geprueft werden MIME-Allowlist, Signatur am Dateianfang und "
					+ "Groessenlimit (§3.15).")
	@ApiResponse(responseCode = "201", description = "Metadaten samt url = /api/files/{id}.")
	@ApiResponse(responseCode = "400", description = "FILE_TYPE_NOT_ALLOWED, wenn der Typ nicht "
			+ "in der Allowlist steht oder der Inhalt nicht zu ihm passt; FILE_TOO_LARGE oberhalb "
			+ "des Limits (10 MB Bilder, 25 MB Audio und PDF).")
	@ApiResponse(responseCode = "401", description = "Kein gueltiges Token mitgeschickt.")
	@ApiResponse(responseCode = "403", description = "Angemeldet, aber ohne Upload-Recht auf "
			+ "dieses Projekt (§5).")
	@ApiResponse(responseCode = "404", description = "Unter dieser projectId gibt es kein "
			+ "Projekt.")
	@ApiResponse(responseCode = "409", description = "PROJECT_STATUS_NOT_EDITABLE, wenn das "
			+ "Projekt nicht in DRAFT oder REVISION steht (§4.1).")
	@PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
	@ResponseStatus(HttpStatus.CREATED)
	public StoredFileResponse upload(
			@AuthenticationPrincipal AuthenticatedUser user,

			@RequestPart("file") MultipartFile file,

			@Parameter(description = "ID des Projekts. Fehlt sie, entsteht ein Avatar.")
			@RequestParam(name = "projectId", required = false) UUID projectId) {

		return fileService.upload(user, file, projectId);
	}

	/**
	 * Auslieferung ueber die Anwendung, nicht aus dem Container (§3.15.1):
	 * die Sichtbarkeit haengt am Projektstatus, und eine oeffentliche
	 * Objekt-URL kennt diesen Zustand nicht.
	 *
	 * <p>{@code ETag} und {@code Cache-Control} nach §3.15; ein 304 auf
	 * {@code If-None-Match} gibt es bewusst nicht, weil §6.3 den Statuscode
	 * nicht fuehrt (Klaerung zu KAN-23). Der ETag ist die Datei-ID: eine
	 * Datei wird nie geaendert, ihre ID identifiziert den Inhalt damit
	 * vollstaendig.
	 */
	@Operation(summary = "Datei abrufen",
			description = "Streamt den Inhalt mit korrektem Content-Type. Oeffentlich, wenn das "
					+ "zugehoerige Projekt PUBLISHED ist oder es sich um einen Avatar handelt; "
					+ "sonst gelten die Regeln des Projekts (§3.15, §5).")
	@ApiResponse(responseCode = "200", description = "Der Dateiinhalt.")
	@ApiResponse(responseCode = "401", description = "Die Datei ist nicht oeffentlich und es "
			+ "wurde kein gueltiges Token mitgeschickt.")
	@ApiResponse(responseCode = "403", description = "Angemeldet, aber ohne Leserecht auf das "
			+ "zugehoerige Projekt.")
	@ApiResponse(responseCode = "404", description = "Unter dieser ID gibt es keine Datei.")
	@GetMapping("/{id}")
	public ResponseEntity<InputStreamResource> download(
			@AuthenticationPrincipal AuthenticatedUser user,

			@Parameter(description = "ID der Datei.")
			@PathVariable("id") UUID id) {

		FileService.FileDownload download = fileService.download(user, id);
		return ResponseEntity.ok()
				.contentType(MediaType.parseMediaType(download.mimeType()))
				.contentLength(download.size())
				.eTag("\"" + download.id() + "\"")
				.header(HttpHeaders.CACHE_CONTROL,
						download.publiclyCacheable() ? "public, max-age=86400" : "private, no-store")
				.body(new InputStreamResource(download.content()));
	}

	@Operation(summary = "Datei loeschen",
			description = "Entfernt Datenbankzeile und Objekt im Speicher. Erlaubt sind die "
					+ "Person, die hochgeladen hat (bei Projektdateien nur in DRAFT und "
					+ "REVISION), und die Administration jederzeit (§6.1).")
	@ApiResponse(responseCode = "204", description = "Geloescht.")
	@ApiResponse(responseCode = "401", description = "Kein gueltiges Token mitgeschickt.")
	@ApiResponse(responseCode = "403", description = "Angemeldet, aber weder Uploader:in noch "
			+ "ADMIN.")
	@ApiResponse(responseCode = "404", description = "Unter dieser ID gibt es keine Datei.")
	@ApiResponse(responseCode = "409", description = "PROJECT_STATUS_NOT_EDITABLE, wenn die "
			+ "Uploader:in eine Projektdatei ausserhalb von DRAFT und REVISION loeschen will.")
	@DeleteMapping("/{id}")
	@ResponseStatus(HttpStatus.NO_CONTENT)
	public void delete(
			@AuthenticationPrincipal AuthenticatedUser user,

			@Parameter(description = "ID der Datei.")
			@PathVariable("id") UUID id) {

		fileService.delete(user, id);
	}
}
