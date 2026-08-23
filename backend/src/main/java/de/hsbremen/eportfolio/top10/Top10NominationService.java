package de.hsbremen.eportfolio.top10;

import de.hsbremen.eportfolio.auth.AuthenticatedUser;
import de.hsbremen.eportfolio.common.enums.NominationStatus;
import de.hsbremen.eportfolio.common.enums.ProjectStatus;
import de.hsbremen.eportfolio.common.enums.UserStatus;
import de.hsbremen.eportfolio.common.error.ConflictException;
import de.hsbremen.eportfolio.common.error.ErrorCodes;
import de.hsbremen.eportfolio.common.error.ResourceNotFoundException;
import de.hsbremen.eportfolio.common.error.ValidationException;
import de.hsbremen.eportfolio.project.Project;
import de.hsbremen.eportfolio.project.ProjectPermissionService;
import de.hsbremen.eportfolio.project.ProjectReadService;
import de.hsbremen.eportfolio.project.ProjectRepository;
import de.hsbremen.eportfolio.project.dto.ProjectCardResponse;
import de.hsbremen.eportfolio.top10.dto.Top10AcceptRequest;
import de.hsbremen.eportfolio.top10.dto.Top10NominationRequest;
import de.hsbremen.eportfolio.top10.dto.Top10NominationResponse;
import de.hsbremen.eportfolio.user.User;
import de.hsbremen.eportfolio.user.UserRepository;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.AuthenticationCredentialsNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Vorschlag und Entscheidung (§3.11, §3.11.1): die Nominierung durch die
 * Redaktion und die drei Admin-Endpoints aus §6.1
 * ({@code GET /api/admin/top10-nominations}, {@code .../accept},
 * {@code .../reject}).
 *
 * <p><strong>Nominierung und Liste sind zwei Dinge.</strong> Dieser Dienst
 * schreibt das Protokoll, {@link Top10Service} die angezeigte Liste. Beim
 * Annehmen ruft er dort {@code addAt} auf; der umgekehrte Weg existiert nicht.
 * Deshalb ist das Protokoll auch dann noch vollstaendig, wenn ein Projekt die
 * Liste laengst wieder verlassen hat: dass ein Vorschlag angenommen wurde,
 * bleibt wahr.
 *
 * <p><strong>Reihenfolge der Pruefungen</strong> wie im {@code ReactionService},
 * nach §6.3.1: laden (fehlt → 404) → Berechtigung (nein → 401 ohne Anmeldung,
 * sonst 403) → Zustand (nein → 409) → schreiben.
 *
 * <p><strong>Zu den drei 409ern dieses Moduls</strong>, die beim Lesen leicht
 * durcheinandergehen:
 * <ul>
 * <li>{@code PROJECT_NOT_PUBLISHED}: das Projekt hat den falschen Status
 * (§3.11.1 Regel 1).</li>
 * <li>{@code RESOURCE_IN_USE}: Projekt oder Platz sind schon vergeben
 * (§3.11.1 Regel 2).</li>
 * <li>{@code NOMINATION_ALREADY_DECIDED}: ueber den Vorschlag ist entschieden.</li>
 * </ul>
 */
@Service
@Transactional
public class Top10NominationService {

	/**
	 * Einziger zulaessiger Wert von {@code nominatedBy} (§6.1). Dieselbe
	 * Schreibweise wie {@code ProjectFilterRequest.EDITOR_ME}, damit beide
	 * Selbstbezuege im Contract gleich aussehen.
	 */
	static final String OWN_SCOPE = "me";

	private final Top10NominationRepository nominationRepository;

	private final Top10EntryRepository entryRepository;

	private final ProjectRepository projectRepository;

	private final UserRepository userRepository;

	private final Top10Service top10Service;

	private final ProjectReadService readService;

	private final ProjectPermissionService permissions;

	public Top10NominationService(Top10NominationRepository nominationRepository,
			Top10EntryRepository entryRepository,
			ProjectRepository projectRepository,
			UserRepository userRepository,
			Top10Service top10Service,
			ProjectReadService readService,
			ProjectPermissionService permissions) {
		this.nominationRepository = nominationRepository;
		this.entryRepository = entryRepository;
		this.projectRepository = projectRepository;
		this.userRepository = userRepository;
		this.top10Service = top10Service;
		this.readService = readService;
		this.permissions = permissions;
	}

	// ------------------------------------------------------------------
	// POST /api/projects/{id}/top10-nomination
	// ------------------------------------------------------------------

	/**
	 * Schlaegt ein Projekt fuer die Top-10 vor (§6.1), <strong>201</strong>.
	 *
	 * <p>Die drei Bedingungen aus §3.11.1 in der Reihenfolge, in der sie geprueft
	 * werden:
	 * <ol>
	 * <li>Das Projekt ist {@code PUBLISHED}, sonst <strong>409</strong>
	 * {@code PROJECT_NOT_PUBLISHED}. Die Top-10 steht auf der oeffentlichen
	 * Startseite; ein Entwurf dort waere ein Sichtbarkeitsleck.</li>
	 * <li>Es steht noch nicht in der Liste, sonst <strong>409</strong>
	 * {@code RESOURCE_IN_USE}.</li>
	 * <li>Es hat keine offene Nominierung, sonst ebenfalls <strong>409</strong>
	 * {@code RESOURCE_IN_USE}. Ohne diese Regel stapeln sich Duplikate in der
	 * Admin-Ansicht und die Entscheidungshistorie wird unlesbar.</li>
	 * </ol>
	 *
	 * <p><strong>Eine abgelehnte Nominierung sperrt nicht.</strong> Regel 2
	 * spricht von der <em>offenen</em> Nominierung. Nach einem {@code reject}
	 * darf dasselbe Projekt erneut vorgeschlagen werden, etwa in einem spaeteren
	 * Semester oder von jemand anderem; die Ablehnung war eine Entscheidung ueber
	 * einen Vorschlag und kein dauerhafter Ausschluss des Projekts.
	 *
	 * <p><strong>Kein Vier-Augen-Prinzip.</strong> Wer ein eigenes
	 * veroeffentlichtes Projekt vorschlaegt, darf das: §5 traegt in der Zeile
	 * „Projekt fuer Top-10 nominieren" bei EDITOR und ADMIN unmarkierte Haken und
	 * keine Fussnote wie beim Genehmigen. Entschieden wird ohnehin von der
	 * Administration, der Vorschlag allein bewirkt nichts.
	 *
	 * @param user      angemeldete Person; ohne Anmeldung kommt die Anfrage hier
	 *                  nicht an, weil {@code SecurityConfig} auf den Projektpfaden
	 *                  nur {@code GET} freigibt (401)
	 * @param projectId ID aus dem Pfad
	 * @param request   die vorgeschlagene Stufe (§2.13), Pflichtangabe seit
	 *                  Contract v68
	 * @throws ResourceNotFoundException wenn es die Projekt-ID nicht gibt (404)
	 * @throws AccessDeniedException     wenn die Rolle weder EDITOR noch ADMIN ist
	 *                                   (403)
	 * @throws ConflictException         bei Verstoss gegen §3.11.1 (409)
	 */
	public Top10NominationResponse nominate(AuthenticatedUser user, UUID projectId,
			Top10NominationRequest request) {

		Project project = projectRepository.findWithReferencesById(projectId)
				.orElseThrow(() -> ResourceNotFoundException.forProject(projectId));

		requireMayNominate(user);
		requirePublished(project);

		if (entryRepository.existsByProjectId(projectId)) {
			throw ConflictException.resourceInUse(
					"Dieses Projekt steht bereits in der Top-10 und laesst sich nicht erneut "
							+ "nominieren (§3.11.1).");
		}
		if (nominationRepository.existsByProjectIdAndStatus(projectId, NominationStatus.PENDING)) {
			throw ConflictException.resourceInUse(
					"Fuer dieses Projekt liegt bereits eine offene Nominierung vor (§3.11.1).");
		}

		Top10Nomination nomination = new Top10Nomination();
		nomination.setProject(project);
		nomination.setNominatedBy(currentUser(user));
		nomination.setProposedTier(request.proposedTier());
		nomination.setStatus(NominationStatus.PENDING);

		return toResponse(nominationRepository.saveAndFlush(nomination));
	}

	// ------------------------------------------------------------------
	// GET /api/admin/top10-nominations
	// ------------------------------------------------------------------

	/**
	 * Das Nominierungsprotokoll (§6.1), neueste Vorschlaege zuerst.
	 *
	 * <p><strong>Einschliesslich der entschiedenen Nominierungen.</strong> §3.11
	 * fuehrt die Entity ausdruecklich als „Vorschlaege und Protokoll"; ein
	 * Protokoll, das nach der Entscheidung leer ist, waere keines. Der optionale
	 * Filter {@code status} grenzt auf einen Stand ein, ohne Angabe kommt alles.
	 *
	 * <p><strong>Ohne Paginierung.</strong> §6.1 fuehrt fuer diese Zeile keine,
	 * anders als bei {@code GET /api/admin/users} und
	 * {@code GET /api/admin/top10-audit}, wo sie ausdruecklich dabeisteht. Das
	 * passt zur Groessenordnung: nominiert wird von der Redaktion und in einer
	 * Liste von zehn Plaetzen, nicht von jeder angemeldeten Person.
	 *
	 * @param user   angemeldete Person; die Filterkette laesst auf
	 *               {@code /api/admin/**} nur ADMIN durch
	 * @param status optionaler Filter auf einen Stand (§2.8)
	 */
	@Transactional(readOnly = true)
	public List<Top10NominationResponse> nominations(AuthenticatedUser user,
			NominationStatus status) {

		requireCurator(user);

		List<Top10Nomination> nominations = status == null
				? nominationRepository.findAllByOrderByCreatedAtDescIdAsc()
				: nominationRepository.findByStatusOrderByCreatedAtDescIdAsc(status);

		return toResponses(nominations);
	}

	// ------------------------------------------------------------------
	// GET /api/top10-nominations?nominatedBy=me
	// ------------------------------------------------------------------

	/**
	 * Die eigenen Nominierungen der anfragenden Person (§6.1, seit Contract
	 * v68), neueste zuerst, ohne Paginierung.
	 *
	 * <p><strong>Warum es diesen Endpoint neben dem Admin-Spiegel gibt.</strong>
	 * {@code GET /api/admin/top10-nominations} liegt hinter
	 * {@code hasRole("ADMIN")}, und damit erfuhr eine Redakteur:in bis v67 nicht
	 * einmal, ob ihr eigener Vorschlag noch offen ist. Sie sah weder den Stand
	 * noch die Entscheidung; ein zweiter Vorschlag zum selben Projekt endete
	 * dann in einem 409, das sie sich nicht erklaeren konnte.
	 *
	 * <p><strong>{@code nominatedBy} ist Pflicht und laesst allein {@code me}
	 * zu.</strong> Der Parameter sieht aus wie ein Filter und ist der Zuschnitt
	 * der Ressource: ohne ihn waere der Pfad der vollstaendige Spiegel und damit
	 * eine Umgehung der Admin-Schranke. Ein anderer Wert ergibt
	 * <strong>400</strong> {@code VALIDATION_FAILED} und nicht 403, weil die
	 * Anfrage schon in ihrer Form nicht vorgesehen ist; wer fremde Vorschlaege
	 * lesen darf, nimmt den Admin-Pfad. Derselbe Zuschnitt wie bei
	 * {@code GET /api/projects?editor=me}.
	 *
	 * @param user        angemeldete Person; ohne Anmeldung 401 aus der
	 *                    Filterkette, als STUDENT 403 aus dieser Methode
	 * @param nominatedBy Pflichtparameter, einziger zulaessiger Wert
	 *                    {@code me}
	 * @param status      optionaler Filter auf einen Stand (§2.8)
	 * @throws ValidationException   wenn {@code nominatedBy} fehlt oder etwas
	 *                               anderes als {@code me} nennt (400)
	 * @throws AccessDeniedException wenn die Rolle weder EDITOR noch ADMIN ist
	 *                               (403)
	 */
	@Transactional(readOnly = true)
	public List<Top10NominationResponse> ownNominations(AuthenticatedUser user, String nominatedBy,
			NominationStatus status) {

		requireOwnScope(nominatedBy);
		requireMayReadOwn(user);

		UUID ownId = user.getId();
		List<Top10Nomination> nominations = status == null
				? nominationRepository.findByNominatedByIdOrderByCreatedAtDescIdAsc(ownId)
				: nominationRepository.findByNominatedByIdAndStatusOrderByCreatedAtDescIdAsc(
						ownId, status);

		return toResponses(nominations);
	}

	// ------------------------------------------------------------------
	// POST /api/admin/top10-nominations/{id}/accept
	// ------------------------------------------------------------------

	/**
	 * Nimmt einen Vorschlag an: setzt {@code status}, {@code decidedBy} und
	 * {@code decidedAt} und legt den {@code Top10Entry} auf dem gewuenschten Platz
	 * an (§3.11, §6.1).
	 *
	 * <p><strong>Der Platz aus dem Body gilt, nicht der Vorschlag.</strong> Die
	 * vorgeschlagene Stufe wird gelesen und angezeigt, sie bindet aber nichts:
	 * der Server prueft nicht, ob {@code position} in ihren Bereich faellt
	 * (§3.11.1 Regel 4, Klaerungsrunde zu KAN-37). Eine Bindung zwaenge die
	 * Administration, einen als {@code TOP_1} vorgeschlagenen Beitrag erst
	 * abzulehnen, um ihn auf Platz 4 zu setzen. Siehe
	 * {@link Top10AcceptRequest}.
	 *
	 * <p><strong>Der entschiedene Platz wandert zusaetzlich an die
	 * Nominierung</strong> (seit Contract v68). {@code proposedPosition} ist
	 * damit das Feld der Administration und nicht mehr der Wunsch der
	 * Redaktion; die Stufe steht daneben in {@code proposedTier}.
	 *
	 * <p><strong>Das Projekt muss immer noch veroeffentlicht sein.</strong>
	 * Zwischen Vorschlag und Entscheidung kann die Redaktion es zurueckgezogen
	 * haben. §3.11.1 Regel 1 gilt fuer die Aufnahme in die Liste und nicht nur fuer
	 * den Vorschlag; sonst brauchte es nur genug Zeit zwischen beiden Schritten,
	 * um einen Entwurf auf die Startseite zu bringen.
	 *
	 * <p><strong>Eine zweite Entscheidung wird abgewiesen</strong> mit
	 * <strong>409</strong> {@code NOMINATION_ALREADY_DECIDED} statt still
	 * ueberschrieben. Das Protokoll haelt fest, wer wann entschieden hat, und das
	 * bliebe davon nicht uebrig. Entscheidung aus der Klaerungsrunde zu KAN-24.
	 *
	 * @throws ResourceNotFoundException wenn es die Nominierung nicht gibt (404)
	 * @throws ConflictException         wenn bereits entschieden wurde, das Projekt
	 *                                   nicht mehr veroeffentlicht ist oder der
	 *                                   Platz belegt ist (409)
	 */
	public Top10NominationResponse accept(AuthenticatedUser user, UUID nominationId,
			Top10AcceptRequest request) {

		Top10Nomination nomination = load(nominationId);
		requireCurator(user);
		requirePending(nomination);

		Project project = nomination.getProject();
		requirePublished(project);

		// Einmal aufgeloest und an beide Schritte weitergegeben: die Entscheidung
		// an der Nominierung und der Protokolleintrag zur Aufnahme (§3.17) nennen
		// dieselbe Person, und ein zweiter Ladevorgang koennte das nur
		// auseinanderlaufen lassen.
		User admin = currentUser(user);
		top10Service.addAt(project, request.position(), admin);

		// Seit Contract v68 haelt die Nominierung den entschiedenen Platz selbst
		// fest. Der Eintrag in der Liste traegt ihn zwar auch, verschwindet aber
		// wieder, sobald das Projekt die Top-10 verlaesst; das Protokoll soll
		// danach noch sagen koennen, worauf entschieden wurde.
		nomination.setProposedPosition(request.position());

		return decide(nomination, admin, NominationStatus.ACCEPTED);
	}

	// ------------------------------------------------------------------
	// POST /api/admin/top10-nominations/{id}/reject
	// ------------------------------------------------------------------

	/**
	 * Lehnt einen Vorschlag ab: setzt {@code status}, {@code decidedBy} und
	 * {@code decidedAt}, ohne die Liste anzufassen (§3.11, §6.1).
	 *
	 * <p><strong>Ohne Begruendung im Body</strong>, anders als bei
	 * {@code POST /api/projects/{id}/request-revision}. §6.1 sieht fuer diese
	 * Zeile keinen Koerper vor, und das passt zur Sache: die Ruecknahme richtet
	 * sich an die Autor:in und muss ihr sagen, was zu tun ist; die Ablehnung einer
	 * Nominierung ist eine kuratorische Entscheidung ueber einen Vorschlag der
	 * Redaktion und loest keine Arbeit aus.
	 *
	 * <p><strong>Das Projekt darf hier jeden Status haben.</strong> Ein Vorschlag
	 * zu einem inzwischen zurueckgezogenen Projekt laesst sich ablehnen, und genau
	 * das ist der sinnvolle Weg, ihn aus der Liste der offenen Punkte zu bekommen.
	 * Die Statuspruefung haengt an der Aufnahme, nicht an der Entscheidung.
	 *
	 * @throws ResourceNotFoundException wenn es die Nominierung nicht gibt (404)
	 * @throws ConflictException         wenn bereits entschieden wurde (409)
	 */
	public Top10NominationResponse reject(AuthenticatedUser user, UUID nominationId) {
		Top10Nomination nomination = load(nominationId);
		requireCurator(user);
		requirePending(nomination);

		return decide(nomination, currentUser(user), NominationStatus.REJECTED);
	}

	// ------------------------------------------------------------------
	// Pruefungen und gemeinsame Hilfsmittel
	// ------------------------------------------------------------------

	/**
	 * Schreibt die Entscheidung an die Nominierung. Beide Wege, Annahme wie
	 * Ablehnung, setzen dieselben drei Felder; nur der Wert unterscheidet sich.
	 */
	private Top10NominationResponse decide(Top10Nomination nomination, User admin,
			NominationStatus decision) {

		nomination.setStatus(decision);
		nomination.setDecidedBy(admin);
		nomination.setDecidedAt(Instant.now());

		return toResponse(nominationRepository.saveAndFlush(nomination));
	}

	/**
	 * Laedt eine Nominierung. Fehlt sie, folgt <strong>404</strong>
	 * {@code RESOURCE_NOT_FOUND}.
	 *
	 * <p>Geladen wird vor der Rechtepruefung, wie §6.3.1 es fuer alle Endpoints
	 * festlegt: 404 heisst „gibt es nicht", 403 heisst „gibt es, du darfst
	 * nicht". Praktisch wird der Unterschied hier nie sichtbar, weil die
	 * Filterkette auf {@code /api/admin/**} ohnehin nur ADMIN durchlaesst; die
	 * Reihenfolge steht trotzdem so da, damit dieser Dienst auch fuer sich
	 * genommen dieselbe Semantik hat wie die uebrigen.
	 */
	private Top10Nomination load(UUID nominationId) {
		return nominationRepository.findById(nominationId)
				.orElseThrow(() -> ResourceNotFoundException.forNomination(nominationId));
	}

	/**
	 * Eine bereits entschiedene Nominierung ergibt <strong>409</strong> und nicht
	 * 404: sie existiert, und §6.3.1 verbietet es, den Zustand einer vorhandenen
	 * Ressource hinter einem „gibt es nicht" zu verstecken.
	 */
	private void requirePending(Top10Nomination nomination) {
		if (nomination.getStatus() != NominationStatus.PENDING) {
			throw ConflictException.nominationAlreadyDecided(nomination.getStatus().name());
		}
	}

	/** §3.11.1 Regel 1, an beiden Stellen dieselbe Pruefung. */
	private void requirePublished(Project project) {
		if (project.getStatus() != ProjectStatus.PUBLISHED) {
			throw ConflictException.projectNotPublished(project.getStatus().name());
		}
	}

	/**
	 * Zeile „Projekt fuer Top-10 nominieren" aus §5: EDITOR und ADMIN.
	 *
	 * <p>Die beiden Gruende fuer ein {@code false} auseinandergehalten wie im
	 * {@code ReactionService}: ohne Anmeldung 401, sonst 403. Der erste Fall kann
	 * die Filterkette schon abgefangen haben; die Unterscheidung steht hier
	 * trotzdem, damit der Dienst auch fuer sich genommen die richtige Antwort
	 * gibt.
	 */
	private void requireMayNominate(AuthenticatedUser user) {
		if (permissions.mayNominate(user)) {
			return;
		}
		if (user == null || user.getStatus() != UserStatus.ACTIVE) {
			throw new AuthenticationCredentialsNotFoundException(
					"Fuer eine Nominierung ist eine Anmeldung erforderlich (§5).");
		}
		throw new AccessDeniedException(
				"Fuer die Top-10 nominieren ausschliesslich Redaktion und Administration (§5).");
	}

	/**
	 * Der einzige zulaessige Wert von {@code nominatedBy} ist {@code me}
	 * (§6.1). Fehlt der Parameter oder steht etwas anderes darin, folgt
	 * <strong>400</strong> {@code VALIDATION_FAILED}.
	 */
	private void requireOwnScope(String nominatedBy) {
		if (!OWN_SCOPE.equals(nominatedBy)) {
			throw new ValidationException(ErrorCodes.VALIDATION_FAILED,
					"Der Parameter nominatedBy ist Pflicht und laesst allein den Wert \"me\" "
							+ "zu. Den vollstaendigen Spiegel liest die Administration ueber "
							+ "GET /api/admin/top10-nominations (§6.1).");
		}
	}

	/**
	 * Zeile „Eigene Top-10-Nominierungen lesen" aus §5: EDITOR und ADMIN.
	 *
	 * <p>Die beiden Gruende fuer ein {@code false} auseinandergehalten wie in
	 * {@link #requireMayNominate}: ohne Anmeldung 401, sonst 403.
	 */
	private void requireMayReadOwn(AuthenticatedUser user) {
		if (permissions.mayReadOwnNominations(user)) {
			return;
		}
		if (user == null || user.getStatus() != UserStatus.ACTIVE) {
			throw new AuthenticationCredentialsNotFoundException(
					"Fuer die eigenen Nominierungen ist eine Anmeldung erforderlich (§5).");
		}
		throw new AccessDeniedException(
				"Nominierungen fuehren ausschliesslich Redaktion und Administration (§5).");
	}

	/** Zeile „Top-10 kuratieren" aus §5: nur ADMIN, siehe {@code Top10Service}. */
	private void requireCurator(AuthenticatedUser user) {
		if (!permissions.mayCurateTop10(user)) {
			throw new AccessDeniedException("Ueber Nominierungen entscheidet ausschliesslich die "
					+ "Administration (§5).");
		}
	}

	/**
	 * Baut die Antworten und holt die Projektkacheln dabei fuer die ganze Liste
	 * in je einer Abfrage nach ({@code ProjectReadService.cards}).
	 */
	private List<Top10NominationResponse> toResponses(List<Top10Nomination> nominations) {
		List<ProjectCardResponse> cards = readService.cards(
				nominations.stream().map(Top10Nomination::getProject).toList());

		List<Top10NominationResponse> result = new ArrayList<>(nominations.size());
		for (int i = 0; i < nominations.size(); i++) {
			result.add(Top10NominationResponse.from(nominations.get(i), cards.get(i)));
		}
		return result;
	}

	private Top10NominationResponse toResponse(Top10Nomination nomination) {
		return toResponses(List.of(nomination)).get(0);
	}

	/**
	 * Die angemeldete Person als Entity, wie in
	 * {@code ProjectWorkflowService.currentUser}.
	 */
	private User currentUser(AuthenticatedUser user) {
		return userRepository.findById(user.getId()).orElseThrow(() -> new AccessDeniedException(
				"Das angemeldete Konto existiert nicht mehr."));
	}
}
