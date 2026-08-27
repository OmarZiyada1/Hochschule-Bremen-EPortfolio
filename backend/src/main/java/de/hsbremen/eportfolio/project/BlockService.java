package de.hsbremen.eportfolio.project;

import com.fasterxml.jackson.databind.JsonNode;
import de.hsbremen.eportfolio.auth.AuthenticatedUser;
import de.hsbremen.eportfolio.common.enums.BlockType;
import de.hsbremen.eportfolio.common.enums.UserStatus;
import de.hsbremen.eportfolio.common.error.ConflictException;
import de.hsbremen.eportfolio.common.error.ErrorCodes;
import de.hsbremen.eportfolio.common.error.ResourceNotFoundException;
import de.hsbremen.eportfolio.common.error.ValidationException;
import de.hsbremen.eportfolio.project.dto.BlockRequest;
import de.hsbremen.eportfolio.project.dto.BlocksResponse;
import de.hsbremen.eportfolio.project.dto.BlocksUpdateRequest;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.AuthenticationCredentialsNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Die beiden Block-Endpoints aus API-Contract §6.1:
 * {@code GET /api/projects/{id}/blocks} und
 * {@code PUT /api/projects/{id}/blocks}, also der Autosave-Pfad des Editors.
 *
 * <p><strong>Warum ein Dienst und nicht zwei</strong>, anders als bei
 * {@link ProjectReadService} und {@link ProjectWriteService}: die Trennung dort
 * gibt es, weil Lesen und Schreiben eines Projekts sich nichts teilen ausser der
 * Entity. Hier ist es umgekehrt. Beide Methoden beantworten dieselbe Frage
 * („welche Bloecke gehoeren zu diesem Projekt"), liefern dieselbe Antwortform
 * und teilen sich Ladevorgang und Fehlerpolitik. Zwei Klassen mit je einer
 * Methode wuerden diese Gemeinsamkeit nur verstecken.
 *
 * <p><strong>Reihenfolge der Pruefungen</strong> wie im
 * {@link ProjectWriteService}, nach §6.3.1: laden (fehlt → 404) → Berechtigung
 * (nein → 401 ohne Anmeldung, sonst 403) → Statusregel (nein → 409) →
 * Versionsstand (nein → 409) → fachliche Validierung (nein → 400) → schreiben.
 *
 * <p><strong>Die gesamte eingeschickte Liste wird geprueft, bevor die erste
 * Zeile angefasst wird.</strong> Sonst haette ein ungueltiger Block am Ende der
 * Liste die vorherigen schon geschrieben, und die 400er-Antwort liesse ein halb
 * gespeichertes Dokument zurueck. Dieselbe Ueberlegung wie bei
 * {@code ProjectWriteService.replaceMembers}.
 */
@Service
public class BlockService {

	private final ProjectRepository projectRepository;

	private final BlockRepository blockRepository;

	private final BlockValidationService validation;

	private final ProjectPermissionService permissions;

	public BlockService(ProjectRepository projectRepository,
			BlockRepository blockRepository,
			BlockValidationService validation,
			ProjectPermissionService permissions) {
		this.projectRepository = projectRepository;
		this.blockRepository = blockRepository;
		this.validation = validation;
		this.permissions = permissions;
	}

	// ------------------------------------------------------------------
	// GET /api/projects/{id}/blocks
	// ------------------------------------------------------------------

	/**
	 * Blockliste eines Projekts, geordnet nach {@code orderIndex} (§6.1).
	 *
	 * <p>Die Sichtbarkeit ist dieselbe wie beim Projekt selbst: der Inhalt ist
	 * das Projekt, nur in einer anderen Zerlegung. Eine eigene Regel waere die
	 * Stelle, an der ein Entwurf ueber den Umweg seines Inhalts doch oeffentlich
	 * wuerde. Fehlerpolitik nach §6.3.1, wie in
	 * {@link ProjectReadService#detail}: 404, wenn es die ID nicht gibt, 401 ohne
	 * Anmeldung, 403 bei fehlendem Leserecht.
	 *
	 * @param user      angemeldete Person, {@code null} bedeutet PUBLIC
	 * @param projectId ID aus dem Pfad
	 */
	@Transactional(readOnly = true)
	public BlocksResponse list(AuthenticatedUser user, UUID projectId) {
		Project project = load(projectId);

		if (!permissions.mayReadProject(user, project)) {
			throw noReadAccess(user);
		}

		return BlocksResponse.from(project,
				blockRepository.findByProjectIdOrderByOrderIndexAsc(projectId));
	}

	// ------------------------------------------------------------------
	// PUT /api/projects/{id}/blocks
	// ------------------------------------------------------------------

	/**
	 * Ersetzt die gesamte Blockliste eines Projekts in einer Transaktion (§6.1).
	 *
	 * <p>Der Abgleich laeuft ueber die mitgeschickten IDs: eine bekannte
	 * {@code id} aktualisiert die vorhandene Zeile, eine fehlende legt eine neue
	 * an, und was nicht mehr in der Liste steht, wird geloescht. Die Zeilen
	 * bleiben damit ueber die Autosave-Takte hinweg dieselben, worauf spaetere
	 * blockbezogene Kommentare angewiesen sind (§6.1, „Stabile Block-IDs").
	 *
	 * @param user      angemeldete Person; ohne Anmeldung kommt die Anfrage hier
	 *                  nicht an, weil {@code SecurityConfig} nur {@code GET} auf
	 *                  diesen Pfad freigibt (401)
	 * @param projectId ID aus dem Pfad
	 * @param request   {@code version} und die vollstaendige neue Blockliste
	 * @throws ResourceNotFoundException wenn es die ID nicht gibt (404)
	 * @throws AccessDeniedException     wenn die Person nicht zur Projektseite
	 *                                   gehoert (403)
	 * @throws ConflictException         wenn der Status die Bearbeitung sperrt
	 *                                   oder {@code version} veraltet ist (409)
	 * @throws ValidationException       bei unbekanntem Typ, ungueltigem Inhalt,
	 *                                   gesperrtem Provider, luecken- oder
	 *                                   fehlerhafter Reihenfolge oder einer
	 *                                   fremden Block-ID (400)
	 */
	@Transactional
	public BlocksResponse replace(AuthenticatedUser user, UUID projectId,
			BlocksUpdateRequest request) {

		Project project = load(projectId);
		requireEditable(user, project);
		requireCurrentVersion(project, request.version());

		List<ResolvedBlock> wanted = resolve(project, request.blocks());
		apply(project, wanted);

		// Ohne diesen Anstoss bliebe die Zeile in "project" unberuehrt: die
		// Aenderung steckt allein in "block". Begruendung an AuditableEntity.
		project.touch();
		projectRepository.saveAndFlush(project);

		return BlocksResponse.from(project, project.getBlocks());
	}

	// ------------------------------------------------------------------
	// Pruefungen vor dem Schreiben
	// ------------------------------------------------------------------

	/**
	 * Trennt die beiden Gruende, aus denen ein Autosave scheitern kann, in zwei
	 * verschiedene Antworten, genau wie
	 * {@code ProjectWriteService.requireEditable}.
	 *
	 * <p>Gehoert die anfragende Person zur Projektseite, liegt es am Status:
	 * <strong>409</strong> {@code PROJECT_STATUS_NOT_EDITABLE} (§4.1). Sonst
	 * fehlt ihr das Recht: <strong>403</strong> {@code NO_PERMISSION}. Die
	 * Reihenfolge ist bewusst so, damit ein 409 nicht Unbeteiligten den Status
	 * eines fremden Entwurfs verraet.
	 */
	private void requireEditable(AuthenticatedUser user, Project project) {
		if (permissions.mayEditBlocks(user, project)) {
			return;
		}
		if (permissions.isProjectSide(user, project)) {
			throw ConflictException.statusNotEditable(project.getStatus().name());
		}
		throw new AccessDeniedException(
				"Den Inhalt aendern duerfen nur die Autor:in und die Projektmitglieder (§6.1).");
	}

	/**
	 * Vergleicht die {@code version} aus dem Body mit dem Stand in der Datenbank
	 * (§6.4), aus demselben Grund wie im {@link ProjectWriteService}: der Zaehler
	 * an der Entity gehoert Hibernate, und ohne diesen Vergleich bliebe der
	 * eingeschickte Wert wirkungslos. Gerade beim Autosave zaehlt das: zwei
	 * offene Editor-Fenster derselben Person sind der haeufigste Weg, eigene
	 * Arbeit unbemerkt zu ueberschreiben.
	 */
	private void requireCurrentVersion(Project project, Long expected) {
		if (!Objects.equals(project.getVersion(), expected)) {
			throw ConflictException.versionConflict();
		}
	}

	/**
	 * Prueft die eingeschickte Liste vollstaendig und bringt sie in eine Form,
	 * die sich ohne weitere Fehlerquellen schreiben laesst.
	 *
	 * <p>Geprueft wird in dieser Reihenfolge: Blocktyp bekannt (400
	 * {@code BLOCK_TYPE_UNKNOWN}), Inhalt passend zum Typ (400
	 * {@code BLOCK_CONTENT_INVALID} bzw. {@code EMBED_PROVIDER_NOT_ALLOWED}),
	 * IDs eindeutig und zu diesem Projekt gehoerig, Reihenfolge lueckenlos ab 0.
	 * Dazwischen die eine Regel, die die ganze Liste betrifft: hoechstens ein
	 * TABLE_OF_CONTENTS (§2.5 seit Contract v84).
	 * Erst danach faellt die erste Schreiboperation an.
	 */
	private List<ResolvedBlock> resolve(Project project, List<BlockRequest> requested) {
		List<ResolvedBlock> resolved = new ArrayList<>(requested.size());
		for (int index = 0; index < requested.size(); index++) {
			BlockRequest entry = requested.get(index);
			BlockType type = blockType(entry.type(), index);
			validation.validate(type, entry.content(), index);
			resolved.add(new ResolvedBlock(entry.id(), type, entry.orderIndex(), entry.content(),
					entry.schemaVersionOrDefault()));
		}

		validation.requireAtMostOneTableOfContents(
				resolved.stream().map(ResolvedBlock::type).toList());
		requireKnownIds(project, resolved);
		requireGaplessOrder(resolved);
		return resolved;
	}

	/**
	 * Loest den Blocktyp auf. Ein Wert ausserhalb von §2.5 ergibt
	 * <strong>400</strong> {@code BLOCK_TYPE_UNKNOWN}.
	 *
	 * <p>Die Meldung nennt die zulaessigen Werte, aber nicht den eingeschickten:
	 * was ungeprueft hereinkommt, geht nicht ungeprueft wieder hinaus. Dieselbe
	 * Zurueckhaltung wie beim Parameter {@code editor} im
	 * {@link ProjectReadService}.
	 */
	private BlockType blockType(String value, int index) {
		try {
			return BlockType.valueOf(value.trim());
		} catch (IllegalArgumentException ex) {
			throw new ValidationException(ErrorCodes.BLOCK_TYPE_UNKNOWN,
					"Block " + index + ": unbekannter Blocktyp. Zulaessig sind: "
							+ Arrays.stream(BlockType.values())
									.map(Enum::name)
									.collect(Collectors.joining(", "))
							+ " (§2.5).");
		}
	}

	/**
	 * Jede mitgeschickte {@code id} muss zu einem Block <em>dieses</em> Projekts
	 * gehoeren und darf nur einmal vorkommen; sonst <strong>400</strong>.
	 *
	 * <p><strong>Warum eine unbekannte ID nicht einfach als neuer Block gilt.</strong>
	 * Eine ID aus einem anderen Projekt wuerde dessen Zeile in dieses Projekt
	 * umhaengen, ein Tippfehler in der ID wuerde den eigentlich gemeinten Block
	 * loeschen und daneben einen neuen anlegen. In beiden Faellen antwortete der
	 * Server mit 200 auf etwas, das der Editor so nicht gemeint hat. Der Client
	 * schickt hier ausschliesslich IDs zurueck, die er zuvor von diesem Endpoint
	 * bekommen hat; passt eine davon nicht, ist das ein Fehler und kein
	 * Zwischenstand.
	 */
	private void requireKnownIds(Project project, List<ResolvedBlock> resolved) {
		Set<UUID> known = project.getBlocks().stream()
				.map(Block::getId)
				.collect(Collectors.toCollection(HashSet::new));

		Set<UUID> seen = new HashSet<>();
		for (int index = 0; index < resolved.size(); index++) {
			UUID id = resolved.get(index).id();
			if (id == null) {
				continue;
			}
			if (!known.contains(id)) {
				throw new ValidationException(ErrorCodes.VALIDATION_FAILED,
						"Block " + index + ": zu dieser id gehoert kein Block dieses Projekts. "
								+ "Neue Bloecke werden ohne id geschickt (§6.1).");
			}
			if (!seen.add(id)) {
				throw new ValidationException(ErrorCodes.VALIDATION_FAILED,
						"Block " + index + ": dieselbe id kommt in der Liste mehrfach vor.");
			}
		}
	}

	/**
	 * {@code orderIndex} muss ueber die ganze Liste lueckenlos ab 0 laufen, jeder
	 * Wert genau einmal; sonst <strong>400</strong> (§3.4).
	 *
	 * <p><strong>Warum der Server nicht einfach nach Listenposition
	 * durchnummeriert.</strong> Dann waere jede Luecke und jede Dopplung
	 * stillschweigend behoben, und ein Client, der die Reihenfolge falsch
	 * berechnet, bekaeme nie zu sehen, dass sein Dokument anders gespeichert
	 * wird, als er es meint. Der Index ist Teil der Anfrage, nicht ihre
	 * Verpackung.
	 *
	 * <p>Der Fehlercode ist {@code VALIDATION_FAILED} und nicht
	 * {@code BLOCK_CONTENT_INVALID}: §6.2 beschreibt Letzteren als „content.type
	 * passt nicht zu type oder Pflicht-attrs fehlen", also als Aussage ueber
	 * einen einzelnen Block. Hier ist kein Block fuer sich falsch, sondern die
	 * Liste als Ganzes.
	 */
	private void requireGaplessOrder(List<ResolvedBlock> resolved) {
		Set<Integer> indexes = resolved.stream()
				.map(ResolvedBlock::orderIndex)
				.collect(Collectors.toCollection(LinkedHashSet::new));

		boolean gapless = indexes.size() == resolved.size()
				&& indexes.stream().allMatch(value -> value < resolved.size());

		if (!gapless) {
			throw new ValidationException(ErrorCodes.VALIDATION_FAILED,
					"orderIndex muss ueber die gesamte Liste lueckenlos ab 0 laufen und jeden Wert "
							+ "genau einmal vergeben; erwartet werden 0 bis " + (resolved.size() - 1)
							+ " (§3.4).");
		}
	}

	// ------------------------------------------------------------------
	// Schreiben
	// ------------------------------------------------------------------

	/**
	 * Schreibt die neue Blockliste in das Aggregat.
	 *
	 * <p><strong>Warum abgeglichen und nicht geleert und neu angelegt.</strong>
	 * Beim Leeren und Neuanlegen bekaeme jeder Block bei jedem Autosave-Takt eine
	 * neue UUID, was genau das Gegenteil der Festlegung „Stabile Block-IDs" aus
	 * §6.1 waere. Dieselbe Ueberlegung wie bei
	 * {@code ProjectWriteService.replaceMembers}.
	 *
	 * <p><strong>Warum das Umsortieren hier gefahrlos ist.</strong> Zwei Bloecke
	 * zu tauschen heisst, dass zwischenzeitlich zwei Zeilen denselben
	 * {@code orderIndex} tragen. Der Unique-Constraint
	 * {@code uq_block_project_order_index} ist deshalb
	 * {@code deferrable initially deferred} (§3.4): geprueft wird erst beim
	 * Commit, wenn die Liste wieder eindeutig ist. Ohne diese Eigenschaft
	 * brauchte der Tausch den Umweg ueber Platzhalterwerte.
	 *
	 * <p>Die Sammlung des Projekts traegt {@code cascade = ALL} und
	 * {@code orphanRemoval = true} (§3.4). Das Entfernen aus der Liste ist
	 * deshalb bereits das Loeschen der Zeile; ein eigener Aufruf am Repository
	 * waere derselbe Vorgang ein zweites Mal.
	 */
	private void apply(Project project, List<ResolvedBlock> wanted) {
		Map<UUID, Block> existing = new LinkedHashMap<>();
		for (Block block : project.getBlocks()) {
			existing.put(block.getId(), block);
		}

		Set<UUID> keep = wanted.stream()
				.map(ResolvedBlock::id)
				.filter(Objects::nonNull)
				.collect(Collectors.toCollection(HashSet::new));

		project.getBlocks().removeIf(block -> !keep.contains(block.getId()));

		for (ResolvedBlock entry : wanted) {
			Block block = existing.get(entry.id());
			if (block == null) {
				block = new Block();
				block.setProject(project);
				project.getBlocks().add(block);
			}
			block.setType(entry.type());
			block.setOrderIndex(entry.orderIndex());
			block.setContent(entry.content());
			block.setSchemaVersion(entry.schemaVersion());
		}
	}

	// ------------------------------------------------------------------
	// Gemeinsame Hilfsmittel
	// ------------------------------------------------------------------

	private Project load(UUID projectId) {
		return projectRepository.findById(projectId)
				.orElseThrow(() -> ResourceNotFoundException.forProject(projectId));
	}

	/**
	 * Die beiden Antworten auf ein fehlendes Leserecht, unterschieden nach
	 * §6.3.1: ohne Anmeldung 401, angemeldet 403.
	 */
	private RuntimeException noReadAccess(AuthenticatedUser user) {
		if (user == null || user.getStatus() != UserStatus.ACTIVE) {
			return new AuthenticationCredentialsNotFoundException(
					"Dieses Projekt ist nicht oeffentlich. Anmeldung erforderlich.");
		}
		return new AccessDeniedException("Fuer dieses Projekt fehlt die Leseberechtigung.");
	}

	/**
	 * Ein gepruefter Block aus dem Request, bevor er auf eine Entity trifft.
	 *
	 * <p>Ein eigener Typ statt des {@link BlockRequest}, weil {@code type} hier
	 * bereits das Enum ist und {@code schemaVersion} bereits seinen Default hat.
	 * Damit kann {@link #apply} nichts mehr aufloesen und nichts mehr ablehnen:
	 * jede Entscheidung ist zu diesem Zeitpunkt gefallen.
	 */
	private record ResolvedBlock(UUID id, BlockType type, int orderIndex, JsonNode content,
			int schemaVersion) {
	}
}
