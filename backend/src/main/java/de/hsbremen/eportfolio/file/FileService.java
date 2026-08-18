package de.hsbremen.eportfolio.file;

import de.hsbremen.eportfolio.auth.AuthenticatedUser;
import de.hsbremen.eportfolio.common.enums.ProjectStatus;
import de.hsbremen.eportfolio.common.enums.Role;
import de.hsbremen.eportfolio.common.enums.UserStatus;
import de.hsbremen.eportfolio.common.error.ConflictException;
import de.hsbremen.eportfolio.common.error.ErrorCodes;
import de.hsbremen.eportfolio.common.error.RangeNotSatisfiableException;
import de.hsbremen.eportfolio.common.error.ResourceNotFoundException;
import de.hsbremen.eportfolio.common.error.ValidationException;
import de.hsbremen.eportfolio.file.dto.StoredFileResponse;
import de.hsbremen.eportfolio.project.Project;
import de.hsbremen.eportfolio.project.ProjectPermissionService;
import de.hsbremen.eportfolio.project.ProjectRepository;
import de.hsbremen.eportfolio.user.UserRepository;
import java.io.IOException;
import java.io.InputStream;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpRange;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.AuthenticationCredentialsNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

/**
 * Die drei Datei-Endpoints aus API-Contract §6.1: Upload, Auslieferung und
 * Loeschen (§3.15, §3.15.1).
 *
 * <p><strong>Reihenfolge der Pruefungen</strong> wie im {@code BlockService},
 * nach §6.3.1: laden (fehlt: 404), Berechtigung (ohne Anmeldung 401, sonst
 * 403), Statusregel (409), fachliche Validierung (400), erst dann schreiben.
 *
 * <p><strong>Upload nur in {@code DRAFT} und {@code REVISION}</strong>
 * (Klaerung zu KAN-23): eine Datei an einem Projekt ist entstehender Inhalt
 * (§5, "Projekt-Inhalt bearbeiten"), und ihre Sichtbarkeit haengt am
 * Projektstatus (§3.15). Ohne die Schranke liesse sich an einem
 * {@code PUBLISHED}-Projekt eine sofort oeffentlich abrufbare Datei am
 * gesamten redaktionellen Workflow vorbei erzeugen. Verloren geht dabei
 * nichts: in gesperrten Status liesse sich die zurueckgegebene URL ohnehin
 * in keinem Block speichern.
 *
 * <p><strong>Beim Loeschen faellt erst die Zeile, dann das Objekt.</strong>
 * Scheitert das Loeschen im Speicher, rollt die Transaktion die Zeile
 * zurueck und beides bleibt bestehen; die Gegenrichtung liesse eine Zeile
 * zurueck, deren Objekt fehlt, und jeder Abruf ergaebe 500.
 */
@Service
public class FileService {

	private final StoredFileRepository files;

	private final ProjectRepository projects;

	private final UserRepository users;

	private final ProjectPermissionService permissions;

	private final FileStorage storage;

	public FileService(StoredFileRepository files,
			ProjectRepository projects,
			UserRepository users,
			ProjectPermissionService permissions,
			FileStorage storage) {
		this.files = files;
		this.projects = projects;
		this.users = users;
		this.permissions = permissions;
		this.storage = storage;
	}

	// ------------------------------------------------------------------
	// POST /api/files
	// ------------------------------------------------------------------

	/**
	 * Nimmt einen Upload an (§6.1): mit {@code projectId} eine Projektdatei,
	 * ohne einen Avatar, den jede angemeldete Person fuer sich selbst
	 * hochlaedt (§3.15).
	 *
	 * @param user      angemeldete Person; {@code SecurityConfig} laesst den
	 *                  Pfad nur authentifiziert zu, die Pruefung hier ist der
	 *                  Riegel fuer den Fall, dass sich das aendert
	 * @param file      der Multipart-Teil {@code file}
	 * @param projectId optional; fehlt sie, entsteht ein Avatar
	 */
	@Transactional
	public StoredFileResponse upload(AuthenticatedUser user, MultipartFile file, UUID projectId) {
		if (user == null || user.getStatus() != UserStatus.ACTIVE) {
			throw new AuthenticationCredentialsNotFoundException("Anmeldung erforderlich.");
		}

		Project project = null;
		if (projectId != null) {
			project = projects.findById(projectId)
					.orElseThrow(() -> ResourceNotFoundException.forProject(projectId));
			if (!permissions.mayUploadFile(user, project)) {
				throw new AccessDeniedException(
						"Zu diesem Projekt duerfen nur Projektseite, zugewiesene Redaktion und "
								+ "Administration Dateien hochladen (§5).");
			}
			if (!permissions.isContentEditable(project)) {
				throw ConflictException.statusNotEditable(project.getStatus().name());
			}
		}

		AllowedFileType type = requireAllowedType(file);
		requireWithinLimit(file, type);

		String key = buildKey(project);
		try (InputStream data = file.getInputStream()) {
			storage.store(key, data, file.getSize(), type.mimeType());
		} catch (IOException e) {
			throw new FileStorageException("Der Upload konnte nicht gelesen werden.", e);
		}

		StoredFile stored = new StoredFile();
		stored.setProject(project);
		stored.setUploadedBy(users.findById(user.getId())
				.orElseThrow(() -> new AccessDeniedException("Das Konto existiert nicht mehr.")));
		stored.setFileName(displayFileName(file));
		stored.setMimeType(type.mimeType());
		stored.setSize(file.getSize());
		stored.setPath(key);
		return StoredFileResponse.from(files.save(stored));
	}

	// ------------------------------------------------------------------
	// GET /api/files/{id}
	// ------------------------------------------------------------------

	/**
	 * Liest eine Datei fuer die Auslieferung und loest dabei einen
	 * HTTP-Range-Kopf auf (§6.1, kontextabhaengig; §3.15).
	 *
	 * <p>Oeffentlich, wenn das zugehoerige Projekt {@code PUBLISHED} ist oder
	 * es sich um einen Avatar handelt ({@code projectId = null}, §3.15);
	 * sonst entscheidet {@code mayReadFile} und die Fehlerpolitik aus §6.3.1.
	 *
	 * <p>{@code publiclyCacheable} unterscheidet die beiden
	 * Cache-Control-Werte aus §3.15. Avatare fallen nach dem Wortlaut des
	 * Contracts unter "sonst" und damit unter {@code private, no-store},
	 * obwohl sie oeffentlich abrufbar sind (Klaerung zu KAN-23).
	 *
	 * <p><strong>Die Reihenfolge folgt §6.3.1 und aendert sich nicht:</strong>
	 * Zeile laden (fehlt: 404), Leserecht pruefen (ohne Anmeldung 401, sonst
	 * 403), <em>erst dann</em> den Bereich aufloesen. Andernfalls verriete ein
	 * 416 auf eine fremde Datei deren Groesse, noch bevor die Berechtigung
	 * gefallen ist.
	 *
	 * <p><strong>Vier Faelle, drei davon ohne 416.</strong> Kein Range-Kopf
	 * ergibt 200 mit dem vollstaendigen Inhalt. Ein unlesbarer Kopf wird
	 * ignoriert und ergibt ebenfalls 200: RFC 9110 schreibt das ausdruecklich
	 * vor, weil ein Server, der einen kaputten Kopf zum Fehler macht, jeden
	 * Zwischenspeicher mit eigener Range-Syntax aussperrt. Eine Anfrage nach
	 * mehreren Bereichen ergibt ebenfalls 200, denn die korrekte Antwort darauf
	 * waere {@code multipart/byteranges}, und die baut dieses Portal nicht. Nur
	 * der verstandene, aber unerfuellbare Bereich ergibt 416.
	 *
	 * <p><strong>Grundlage jeder Rechnung ist {@code StoredFile.size}</strong>
	 * und nicht eine Abfrage am Objektspeicher. Das spart je Abruf einen
	 * Netzweg und haelt die Rechnung dort, wo auch die Berechtigung faellt.
	 *
	 * @param user        angemeldete Person, {@code null} bedeutet PUBLIC
	 * @param rangeHeader der rohe {@code Range}-Kopf, darf {@code null} sein
	 */
	@Transactional(readOnly = true)
	public FileDownload download(AuthenticatedUser user, UUID id, String rangeHeader) {
		StoredFile file = files.findById(id)
				.orElseThrow(() -> ResourceNotFoundException.forFile(id));

		Project project = file.getProject();
		if (project != null && !permissions.mayReadFile(user, project)) {
			throw noReadAccess(user);
		}

		boolean publiclyCacheable = project != null
				&& project.getStatus() == ProjectStatus.PUBLISHED;
		long totalSize = file.getSize();

		HttpRange range = firstRange(rangeHeader);
		if (range == null) {
			return new FileDownload(file.getId(), file.getFileName(), file.getMimeType(),
					totalSize, totalSize, 0, Math.max(totalSize - 1, 0), false,
					publiclyCacheable, storage.load(file.getPath()));
		}

		if (totalSize <= 0) {
			throw new RangeNotSatisfiableException(totalSize);
		}
		long start = range.getRangeStart(totalSize);
		long end = range.getRangeEnd(totalSize);
		if (start >= totalSize || start > end) {
			throw new RangeNotSatisfiableException(totalSize);
		}
		long length = end - start + 1;
		return new FileDownload(file.getId(), file.getFileName(), file.getMimeType(),
				length, totalSize, start, end, true, publiclyCacheable,
				storage.load(file.getPath(), start, length));
	}

	/**
	 * Dieselbe Antwort wie {@link #download(AuthenticatedUser, UUID, String)},
	 * aber ohne den Inhalt zu oeffnen: fuer {@code HEAD /api/files/{id}}.
	 *
	 * <p><strong>Warum das ein eigener Weg sein muss.</strong> Ohne ihn
	 * beantwortet Spring HEAD ueber dasselbe {@code @GetMapping} und verwirft
	 * den Rumpf erst am Ende: {@code HttpServlet.doHead} ruft {@code doGet} mit
	 * einem Wrapper, der nur mitzaehlt, und der Nachrichtenkonverter kopiert den
	 * Strom vollstaendig, bevor er weggeworfen wird. Ein HEAD auf ein
	 * 200-MB-Video zoege damit 200 MB aus dem Objektspeicher, um 0 Bytes
	 * auszuliefern, und der Zweck des Aufrufs waere ins Gegenteil verkehrt
	 * (Befund des code-reviewers zu KAN-72).
	 *
	 * <p>Rechte und Fehlerpolitik sind die des GET, deshalb dieselbe
	 * Reihenfolge nach §6.3.1: Zeile laden (404), Leserecht pruefen (401 oder
	 * 403). Ein Range-Kopf wird bewusst nicht aufgeloest: die Antwort traegt
	 * ohnehin keinen Rumpf, und RFC 9110 laesst den Server einen Range an einem
	 * HEAD ignorieren. {@code content} bleibt {@code null}.
	 */
	@Transactional(readOnly = true)
	public FileDownload metadata(AuthenticatedUser user, UUID id) {
		StoredFile file = files.findById(id)
				.orElseThrow(() -> ResourceNotFoundException.forFile(id));

		Project project = file.getProject();
		if (project != null && !permissions.mayReadFile(user, project)) {
			throw noReadAccess(user);
		}

		boolean publiclyCacheable = project != null
				&& project.getStatus() == ProjectStatus.PUBLISHED;
		long totalSize = file.getSize();
		return new FileDownload(file.getId(), file.getFileName(), file.getMimeType(),
				totalSize, totalSize, 0, Math.max(totalSize - 1, 0), false,
				publiclyCacheable, null);
	}

	/**
	 * Der einzige angeforderte Bereich, oder {@code null}, wenn kein oder kein
	 * bedienbarer Kopf mitkam.
	 *
	 * <p>{@code HttpRange.parseRanges} deckt alle drei Formen aus RFC 9110 ab:
	 * Anfang mit Ende ({@code bytes=0-99}), nur Anfang ({@code bytes=100-}) und
	 * Suffix ({@code bytes=-100}). Ein Syntaxfehler wirft; das faengt diese
	 * Methode ab und meldet „kein Bereich", nicht „Fehler".
	 *
	 * <p><strong>Mehrere Bereiche ergeben ebenfalls {@code null}</strong> und
	 * damit 200 mit dem vollstaendigen Inhalt. Die korrekte Antwort darauf
	 * waere {@code multipart/byteranges}, und die baut dieses Portal nicht;
	 * ein 206 auf nur den ersten Bereich waere dagegen eine Antwort, die weder
	 * der Client angefordert hat noch RFC 9110 vorsieht. Die vollstaendige
	 * Datei ist in jedem Fall eine gueltige Antwort auf eine Bereichsanfrage,
	 * und ein Medienelement kommt damit zurecht.
	 */
	private HttpRange firstRange(String rangeHeader) {
		if (rangeHeader == null || rangeHeader.isBlank()) {
			return null;
		}
		try {
			List<HttpRange> ranges = HttpRange.parseRanges(rangeHeader);
			return ranges.size() == 1 ? ranges.get(0) : null;
		} catch (IllegalArgumentException e) {
			return null;
		}
	}

	// ------------------------------------------------------------------
	// DELETE /api/files/{id}
	// ------------------------------------------------------------------

	/**
	 * Loescht Datenbankzeile und Objekt im Speicher (§6.1, "Uploader:in /
	 * ADMIN").
	 *
	 * <p><strong>Fuer die Uploader:in nur in {@code DRAFT} und
	 * {@code REVISION}</strong> (Klaerung zu KAN-23, Contract v25): das
	 * Loeschen ist das Spiegelbild des Uploads. Ohne die Schranke koennte die
	 * Uploader:in einer von Bloecken referenzierten Datei eines
	 * {@code PUBLISHED}-Projekts den Boden entziehen und veroeffentlichten
	 * Inhalt still brechen. Die Administration darf weiterhin jederzeit
	 * loeschen, und Avatare haengen an keinem Projekt und bleiben frei.
	 *
	 * <p>Bekannte Grenze, bewusst getragen: loescht die Datenbank ein Projekt
	 * ueber die Kaskade der Migration, erfaehrt kein Java-Code davon, und die
	 * Objekte der betroffenen Dateien bleiben im Speicher zurueck. Fuer den
	 * Prototyp hingenommen (Klaerung zu KAN-23); der Ausweg waere ein
	 * Aufraeumlauf, kein Eingriff in diesen Dienst.
	 */
	@Transactional
	public void delete(AuthenticatedUser user, UUID id) {
		StoredFile file = files.findById(id)
				.orElseThrow(() -> ResourceNotFoundException.forFile(id));

		if (!permissions.mayDeleteFile(user, file.getUploadedBy().getId())) {
			if (user == null || user.getStatus() != UserStatus.ACTIVE) {
				throw new AuthenticationCredentialsNotFoundException("Anmeldung erforderlich.");
			}
			throw new AccessDeniedException(
					"Loeschen duerfen nur die Person, die hochgeladen hat, und die "
							+ "Administration (§6.1).");
		}

		Project project = file.getProject();
		if (project != null && !user.hasRole(Role.ADMIN)
				&& !permissions.isContentEditable(project)) {
			throw ConflictException.statusNotEditable(project.getStatus().name());
		}

		String key = file.getPath();
		files.delete(file);
		files.flush();
		storage.delete(key);
	}

	// ------------------------------------------------------------------
	// Hilfsmittel
	// ------------------------------------------------------------------

	/**
	 * Eine gelesene Datei samt allem, was der Controller fuer die Antwort
	 * braucht. Kein Response-DTO: der Inhalt geht als Strom hinaus, nicht als
	 * JSON, und {@code publiclyCacheable} ist eine Header-Entscheidung.
	 *
	 * <p><strong>{@code size} ist die Laenge des Ausschnitts</strong>, nicht
	 * die der Datei (KAN-72). Der Controller setzt sie unveraendert als
	 * {@code Content-Length}, und bei einer Bereichsantwort ist genau das der
	 * richtige Wert; die Dateigroesse steht daneben in {@code totalSize} und
	 * geht in {@code Content-Range} ein. Ohne Range-Kopf sind beide gleich.
	 *
	 * @param size      Laenge des ausgelieferten Ausschnitts in Bytes
	 * @param totalSize Groesse der gesamten Datei, fuer {@code Content-Range}
	 * @param rangeEnd  letztes ausgeliefertes Byte, einschliesslich
	 * @param partial   {@code true} ergibt 206 statt 200
	 * @param content   Inhalt als Strom; {@code null} bei {@link #metadata},
	 *                  weil eine HEAD-Antwort keinen Rumpf traegt
	 */
	public record FileDownload(UUID id, String fileName, String mimeType, long size,
			long totalSize, long rangeStart, long rangeEnd, boolean partial,
			boolean publiclyCacheable, InputStream content) {
	}

	/**
	 * Zweistufige Typpruefung (§3.15): der gemeldete Content-Type muss in der
	 * Allowlist stehen, und die ersten Bytes muessen zu ihm passen. Verstoss
	 * gegen eine der beiden Bedingungen ergibt denselben 400
	 * {@code FILE_TYPE_NOT_ALLOWED}; warum, steht in {@code ErrorCodes}.
	 */
	private AllowedFileType requireAllowedType(MultipartFile file) {
		AllowedFileType type = AllowedFileType.fromMimeType(file.getContentType())
				.orElseThrow(() -> new ValidationException(ErrorCodes.FILE_TYPE_NOT_ALLOWED,
						"Dieser Dateityp ist nicht zugelassen (§3.15). Erlaubt sind PNG, JPEG, "
								+ "WebP, MP3, WAV, OGG, PDF, MP4 und WebM."));

		byte[] head;
		try (InputStream in = file.getInputStream()) {
			head = in.readNBytes(AllowedFileType.HEADER_LENGTH);
		} catch (IOException e) {
			throw new FileStorageException("Der Upload konnte nicht gelesen werden.", e);
		}
		if (!type.matchesSignature(head)) {
			throw new ValidationException(ErrorCodes.FILE_TYPE_NOT_ALLOWED,
					"Der Inhalt der Datei passt nicht zum angegebenen Typ "
							+ type.mimeType() + " (§3.15).");
		}
		return type;
	}

	private void requireWithinLimit(MultipartFile file, AllowedFileType type) {
		if (file.getSize() > type.maxBytes()) {
			throw new ValidationException(ErrorCodes.FILE_TOO_LARGE,
					"Die Datei ist zu gross: fuer " + type.mimeType() + " sind hoechstens "
							+ (type.maxBytes() / (1024 * 1024)) + " MB zugelassen (§3.15).");
		}
	}

	/**
	 * Anbieterneutraler Schluessel nach §3.15.1:
	 * {@code projects/{projectId}/{uuid}} beziehungsweise
	 * {@code avatars/{uuid}}. Die UUID ist eine frische und nicht die der
	 * Zeile: die vergibt JPA erst beim Speichern, und der Schluessel muss
	 * vorher feststehen, weil das Objekt zuerst abgelegt wird.
	 */
	private String buildKey(Project project) {
		String name = UUID.randomUUID().toString();
		return project == null
				? "avatars/" + name
				: "projects/" + project.getId() + "/" + name;
	}

	/**
	 * Der Originalname ist reine Anzeigeinformation: gespeichert und
	 * ausgeliefert wird ausschliesslich ueber den Schluessel beziehungsweise
	 * die ID. Trotzdem wird er auf den letzten Pfadbestandteil gekuerzt
	 * (mancher Client schickt ganze Pfade mit) und auf die Spaltenlaenge
	 * begrenzt, damit der Upload nicht an einem ueberlangen Namen scheitert.
	 */
	private String displayFileName(MultipartFile file) {
		String name = file.getOriginalFilename();
		if (name == null || name.isBlank()) {
			return "unbenannt";
		}
		int lastSeparator = Math.max(name.lastIndexOf('/'), name.lastIndexOf('\\'));
		String plain = name.substring(lastSeparator + 1);
		if (plain.isBlank()) {
			return "unbenannt";
		}
		return plain.length() > 255 ? plain.substring(plain.length() - 255) : plain;
	}

	/**
	 * Die beiden Antworten auf ein fehlendes Leserecht, unterschieden nach
	 * §6.3.1: ohne Anmeldung 401, angemeldet 403. Wortgleich mit
	 * {@code BlockService}, weil beide dieselbe Sichtbarkeitsregel anwenden.
	 */
	private RuntimeException noReadAccess(AuthenticatedUser user) {
		if (user == null || user.getStatus() != UserStatus.ACTIVE) {
			return new AuthenticationCredentialsNotFoundException(
					"Diese Datei ist nicht oeffentlich. Anmeldung erforderlich.");
		}
		return new AccessDeniedException("Fuer diese Datei fehlt die Leseberechtigung.");
	}
}
