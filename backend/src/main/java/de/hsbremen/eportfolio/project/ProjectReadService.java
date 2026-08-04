package de.hsbremen.eportfolio.project;

import de.hsbremen.eportfolio.auth.AuthenticatedUser;
import de.hsbremen.eportfolio.common.dto.PageResponse;
import de.hsbremen.eportfolio.common.enums.ProjectStatus;
import de.hsbremen.eportfolio.common.enums.UserStatus;
import de.hsbremen.eportfolio.common.error.ErrorCodes;
import de.hsbremen.eportfolio.common.error.ResourceNotFoundException;
import de.hsbremen.eportfolio.common.error.ValidationException;
import de.hsbremen.eportfolio.project.dto.BlockResponse;
import de.hsbremen.eportfolio.project.dto.MemberResponse;
import de.hsbremen.eportfolio.project.dto.PersonResponse;
import de.hsbremen.eportfolio.project.dto.ProjectCardResponse;
import de.hsbremen.eportfolio.project.dto.ProjectDetailResponse;
import de.hsbremen.eportfolio.project.dto.ProjectFilterRequest;
import de.hsbremen.eportfolio.project.dto.StatusHistoryResponse;
import de.hsbremen.eportfolio.reaction.ReactionCount;
import de.hsbremen.eportfolio.reaction.ReactionRepository;
import de.hsbremen.eportfolio.user.User;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.AuthenticationCredentialsNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Die beiden lesenden Projekt-Endpoints aus API-Contract §6.1:
 * {@code GET /api/projects} und {@code GET /api/projects/{id}}.
 *
 * <p><strong>Warum ein eigener Lesedienst</strong> und nicht ein
 * {@code ProjectService} fuer alles: die schreibenden Endpoints (KAN-17 bis
 * KAN-19) bringen den Zustandsautomaten aus §4.1, die Statushistorie und die
 * Versionspruefung mit. Das Lesen teilt davon nichts ausser der Entity, haelt
 * aber die gesamte Filter- und Sichtbarkeitslogik. In einer gemeinsamen Klasse
 * stuenden zwei Themen nebeneinander, die sich nur den Namen teilen.
 *
 * <p>Klassenweit {@code readOnly}: jede Methode liest ausschliesslich. Das
 * erspart Hibernate den Dirty-Check und macht die Absicht sichtbar.
 */
@Service
@Transactional(readOnly = true)
public class ProjectReadService {

	/**
	 * Felder, nach denen {@code GET /api/projects} sortieren darf (§1:
	 * {@code ?sort=<feld>,<asc|desc>}).
	 *
	 * <p><strong>Warum eine Positivliste</strong> und nicht einfach alles, was
	 * Spring Data annimmt: der Parameter geht sonst ungefiltert in eine
	 * {@code order by}-Klausel ueber beliebige Pfade des Objektmodells. Ein
	 * {@code ?sort=author.passwordHash,asc} wuerde die Liste nach dem
	 * Passworthash ordnen und damit ueber die Reihenfolge Rueckschluesse auf ein
	 * Feld erlauben, das nach §3.1 den Server nie verlassen darf. Unbekannte
	 * Felder enden ausserdem in einer Ausnahme aus dem Persistenzlayer, also in
	 * einem 500 statt in einer verstaendlichen Antwort.
	 *
	 * <p>{@code reactionCount} steht bewusst nicht darin: es ist kein Feld,
	 * sondern eine Aggregation und liesse sich nur mit Join und
	 * {@code group by} sortieren.
	 */
	private static final Set<String> ALLOWED_SORT_FIELDS = Set.of(
			"title", "semester", "status", "createdAt", "updatedAt", "publishedAt");

	/**
	 * Standardsortierung: zuletzt bearbeitete Projekte zuerst.
	 *
	 * <p>Nicht {@code publishedAt}, obwohl das fuer die oeffentliche Galerie
	 * naeher laege: das Feld ist bei allem ausser {@code PUBLISHED} null (§3.3),
	 * und in den angemeldeten Ansichten („Meine Projekte", „Meine Reviews")
	 * stuenden dann ausgerechnet die Entwuerfe in willkuerlicher Reihenfolge am
	 * Anfang. {@code updatedAt} ist in jedem Status gesetzt und ergibt in allen
	 * Ansichten dieselbe verstaendliche Ordnung.
	 */
	private static final Sort DEFAULT_SORT = Sort.by(Sort.Direction.DESC, "updatedAt");

	private final ProjectRepository projectRepository;

	private final ProjectMemberRepository projectMemberRepository;

	private final BlockRepository blockRepository;

	private final ProjectStatusHistoryRepository statusHistoryRepository;

	private final ReactionRepository reactionRepository;

	private final ProjectPermissionService permissions;

	public ProjectReadService(ProjectRepository projectRepository,
			ProjectMemberRepository projectMemberRepository,
			BlockRepository blockRepository,
			ProjectStatusHistoryRepository statusHistoryRepository,
			ReactionRepository reactionRepository,
			ProjectPermissionService permissions) {
		this.projectRepository = projectRepository;
		this.projectMemberRepository = projectMemberRepository;
		this.blockRepository = blockRepository;
		this.statusHistoryRepository = statusHistoryRepository;
		this.reactionRepository = reactionRepository;
		this.permissions = permissions;
	}

	// ------------------------------------------------------------------
	// GET /api/projects
	// ------------------------------------------------------------------

	/**
	 * Gefilterte Projektliste im Seitenformat aus §6.6.
	 *
	 * <p>Der Umfang haengt an der Rolle: PUBLIC sieht nur Veroeffentlichtes,
	 * Studierende zusaetzlich ihre eigenen Projekte, Redaktion und Admin alles
	 * (§5). Diese Schranke steht immer in der Abfrage; ein Filterwert kann sie
	 * nicht aufweichen, sondern die Treffermenge nur weiter verkleinern.
	 *
	 * <p><strong>Kein 404 bei unbekannten Filter-IDs.</strong> Ein
	 * {@code ?category=<unbekannt>} ergibt eine leere Liste. Der Parameter
	 * filtert eine Liste, er adressiert keine Ressource; dieselbe Festlegung
	 * gilt schon bei den Stammdaten-Endpoints.
	 *
	 * @param user     angemeldete Person, {@code null} bedeutet PUBLIC
	 * @param filter   die gesetzten Filter aus §6.1
	 * @param pageable Seite, Groesse und Sortierung
	 * @throws ValidationException bei einem unbekannten Sortierfeld oder einem
	 *                             {@code editor}, der weder {@code me} noch eine
	 *                             UUID ist (400)
	 */
	public PageResponse<ProjectCardResponse> list(AuthenticatedUser user,
			ProjectFilterRequest filter, Pageable pageable) {

		Page<Project> page = projectRepository.findAll(
				conditions(user, filter),
				completeSort(pageable));

		return PageResponse.from(page, this::toCards);
	}

	/**
	 * Verknuepft Sichtbarkeitsschranke und gesetzte Filter mit UND.
	 *
	 * <p>Die Schranke ist der Startwert und steht damit garantiert in jeder
	 * Abfrage, auch wenn spaeter ein Filter hinzukommt und jemand vergisst, ihn
	 * einzuhaengen.
	 */
	private Specification<Project> conditions(AuthenticatedUser user, ProjectFilterRequest filter) {
		List<Specification<Project>> parts = new ArrayList<>();
		parts.add(ProjectSpecifications.visibleFor(user));

		add(parts, filter.category(), ProjectSpecifications::category);
		add(parts, filter.faculty(), ProjectSpecifications::faculty);
		add(parts, filter.studyProgram(), ProjectSpecifications::studyProgram);
		add(parts, filter.module(), ProjectSpecifications::module);
		add(parts, filter.degree(), ProjectSpecifications::degree);
		add(parts, filter.type(), ProjectSpecifications::type);
		add(parts, filter.status(), ProjectSpecifications::status);
		add(parts, filter.author(), ProjectSpecifications::author);
		add(parts, emptyAsNull(filter.semester()), ProjectSpecifications::semester);
		add(parts, emptyAsNull(filter.q()), ProjectSpecifications::searchText);
		add(parts, editorId(user, filter.editor()), ProjectSpecifications::editor);

		return parts.stream().reduce(Specification::and).orElseThrow();
	}

	private static <V> void add(List<Specification<Project>> parts, V value,
			Function<V, Specification<Project>> part) {
		if (value != null) {
			parts.add(part.apply(value));
		}
	}

	/**
	 * Loest den Parameter {@code editor} auf: entweder das Wort {@code me} oder
	 * eine UUID (§6.1).
	 *
	 * <p>{@code me} ohne Anmeldung ergibt <strong>401</strong> und keine leere
	 * Liste: „meine Reviews" ist ohne Identitaet nicht beantwortbar, und eine
	 * leere Liste waere die falsche Auskunft auf eine Frage, die der Server gar
	 * nicht verstehen kann.
	 *
	 * <p>Eine konkrete Redakteurs-ID darf dagegen auch PUBLIC angeben. Sie
	 * verraet nichts: die Sichtbarkeitsschranke laesst fuer nicht Angemeldete
	 * ohnehin nur veroeffentlichte Projekte durch. §6.1 fuehrt den Parameter
	 * unter „angemeldet zusaetzlich", was hier als Hinweis auf seinen
	 * Verwendungszweck gelesen wird und nicht als Verbot: ihn fuer PUBLIC zu
	 * sperren, wuerde eine oeffentliche Betreuungsuebersicht unmoeglich machen,
	 * ohne irgendetwas zu schuetzen. Dasselbe gilt fuer {@code status} und
	 * {@code author}.
	 */
	private UUID editorId(AuthenticatedUser user, String editor) {
		String value = emptyAsNull(editor);
		if (value == null) {
			return null;
		}
		if (ProjectFilterRequest.EDITOR_ME.equalsIgnoreCase(value)) {
			if (!isLoggedIn(user)) {
				throw new AuthenticationCredentialsNotFoundException(
						"Der Filter \"editor=me\" setzt eine Anmeldung voraus.");
			}
			return user.getId();
		}
		try {
			return UUID.fromString(value);
		} catch (IllegalArgumentException ex) {
			// Bewusst ohne den eingeschickten Wert in der Meldung: was
			// ungeprueft hereinkommt, geht nicht ungeprueft wieder hinaus.
			throw new ValidationException(ErrorCodes.VALIDATION_FAILED,
					"Der Parameter \"editor\" erwartet eine UUID oder das Wort \"me\".");
		}
	}

	/**
	 * Prueft die gewuenschte Sortierung und ergaenzt einen festen
	 * Gleichstandsbrecher.
	 *
	 * <p>Ohne eindeutige Ordnung darf die Datenbank gleichrangige Zeilen
	 * zwischen zwei Abfragen unterschiedlich anordnen. Beim Blaettern kann
	 * dasselbe Projekt dann auf zwei Seiten erscheinen und ein anderes auf
	 * keiner. Die ID haengt deshalb immer hinten an.
	 */
	private Pageable completeSort(Pageable pageable) {
		Sort requested = pageable.getSort().isSorted() ? pageable.getSort() : DEFAULT_SORT;

		for (Sort.Order order : requested) {
			if (!ALLOWED_SORT_FIELDS.contains(order.getProperty())) {
				throw new ValidationException(ErrorCodes.VALIDATION_FAILED,
						"Nach diesem Feld kann nicht sortiert werden. Erlaubt sind: "
								+ ALLOWED_SORT_FIELDS.stream().sorted().collect(Collectors.joining(", "))
								+ ".");
			}
		}

		return PageRequest.of(
				pageable.getPageNumber(),
				pageable.getPageSize(),
				requested.and(Sort.by(Sort.Direction.ASC, "id")));
	}

	/**
	 * Bildet eine ganze Seite Projekte auf Kacheln ab und holt dabei die
	 * Reaktionszahlen in einer einzigen Abfrage.
	 *
	 * <p>Die Tags kommen aus dem Lazy-Loading der Entity; {@code Project.tags}
	 * traegt dafuer ein {@code @BatchSize}, sodass auch sie eine Seite mit einer
	 * Abfrage abdecken. Zusammen mit dem {@code @EntityGraph} des Repositories
	 * kostet eine Seite damit vier Abfragen (Treffer, Anzahl, Tags,
	 * Reaktionen) statt vier plus dem Dreifachen der Seitengroesse.
	 */
	private List<ProjectCardResponse> toCards(List<Project> projects) {
		Map<UUID, Long> reactions = reactionsPerProject(projects);

		return projects.stream()
				.map(project -> ProjectCardResponse.from(
						project,
						sortedTags(project),
						reactions.getOrDefault(project.getId(), 0L)))
				.toList();
	}

	private Map<UUID, Long> reactionsPerProject(List<Project> projects) {
		List<UUID> ids = projects.stream().map(Project::getId).toList();
		if (ids.isEmpty()) {
			// Ein "in ()" mit leerer Liste ist in SQL nicht ueberall gueltig;
			// die Abfrage waere ohnehin sinnlos.
			return Map.of();
		}
		return reactionRepository.countPerProject(ids).stream()
				.collect(Collectors.toMap(ReactionCount::projectId, ReactionCount::count));
	}

	// ------------------------------------------------------------------
	// GET /api/projects/{id}
	// ------------------------------------------------------------------

	/**
	 * Ein einzelnes Projekt mit Inhalt, Mitgliedern und Metadaten.
	 *
	 * <p>Fehlerpolitik nach §6.3.1, in dieser Reihenfolge:
	 * <ol>
	 * <li>Es gibt kein Projekt mit dieser ID: <strong>404</strong>
	 * {@code PROJECT_NOT_FOUND}.</li>
	 * <li>Es gibt eines, die anfragende Person ist nicht angemeldet:
	 * <strong>401</strong> {@code NOT_AUTHENTICATED}.</li>
	 * <li>Es gibt eines, sie ist angemeldet, darf es aber nicht lesen:
	 * <strong>403</strong> {@code NO_PERMISSION}.</li>
	 * </ol>
	 *
	 * <p>Die Existenz wird also nicht hinter einem 404 verborgen. Das ist eine
	 * bewusste Entscheidung des Contracts: IDs sind UUIDs und nicht erratbar,
	 * die Semantik bleibt ueber alle Endpoints gleich, und ein Tippfehler im
	 * Client bleibt von einem Rechteproblem unterscheidbar.
	 *
	 * @param user      angemeldete Person, {@code null} bedeutet PUBLIC
	 * @param projectId ID aus dem Pfad
	 */
	public ProjectDetailResponse detail(AuthenticatedUser user, UUID projectId) {
		Project project = projectRepository.findWithReferencesById(projectId)
				.orElseThrow(() -> ResourceNotFoundException.forProject(projectId));

		if (!permissions.mayReadProject(user, project)) {
			if (!isLoggedIn(user)) {
				throw new AuthenticationCredentialsNotFoundException(
						"Dieses Projekt ist nicht oeffentlich. Anmeldung erforderlich.");
			}
			throw new AccessDeniedException("Fuer dieses Projekt fehlt die Leseberechtigung.");
		}

		boolean internalsVisible = permissions.maySeeProjectInternals(user, project);

		return ProjectDetailResponse.from(
				project,
				sortedTags(project),
				reactionRepository.countByProjectId(projectId),
				members(projectId),
				blocks(projectId),
				internalsVisible ? editors(project) : null,
				internalsVisible ? statusHistory(projectId) : null);
	}

	private List<MemberResponse> members(UUID projectId) {
		return projectMemberRepository.findByProjectId(projectId).stream()
				// Stabile Reihenfolge: die Zuordnungstabelle hat keine, und eine
				// Mitgliederliste, die bei jedem Aufruf anders sortiert ist,
				// wirkt in der UI wie ein Fehler.
				.sorted(Comparator
						.comparing((ProjectMember member) -> nameOrEmpty(member.getUser(), true))
						.thenComparing(member -> nameOrEmpty(member.getUser(), false)))
				.map(MemberResponse::from)
				.toList();
	}

	/**
	 * Inhalt des Projekts, geordnet nach {@code orderIndex} (§6.1).
	 *
	 * <p>Bewusst ueber das Repository und nicht ueber {@code project.getBlocks()}:
	 * die Detailantwort setzt sich durchgehend aus Abfragen zusammen, so wie es
	 * Mitglieder und Statushistorie ohnehin tun. Das ist ein Aufruf statt eines
	 * Zugriffs auf den Zustand des Aggregats und liefert damit unabhaengig davon,
	 * ob die Sammlung im laufenden Persistenzkontext schon einmal angefasst
	 * wurde, denselben Stand wie die Datenbank. Kosten sind dieselben: eine
	 * Abfrage.
	 */
	private List<BlockResponse> blocks(UUID projectId) {
		return blockRepository.findByProjectIdOrderByOrderIndexAsc(projectId).stream()
				.map(BlockResponse::from)
				.toList();
	}

	private List<PersonResponse> editors(Project project) {
		return project.getEditors().stream()
				.sorted(Comparator
						.comparing((User user) -> nameOrEmpty(user, true))
						.thenComparing(user -> nameOrEmpty(user, false)))
				.map(PersonResponse::from)
				.toList();
	}

	private List<StatusHistoryResponse> statusHistory(UUID projectId) {
		return statusHistoryRepository.findByProjectIdOrderByTimestampAsc(projectId).stream()
				.map(StatusHistoryResponse::from)
				.toList();
	}

	// ------------------------------------------------------------------
	// Kacheln fuer das oeffentliche Profil (§3.2, KAN-22)
	// ------------------------------------------------------------------

	/**
	 * Die veroeffentlichten Projekte einer Person als Kacheln, fuer
	 * {@code GET /api/portfolios/{userId}} (§3.2).
	 *
	 * <p><strong>Warum diese Methode hier steht und nicht im Portfolio-Modul:</strong>
	 * die Abbildung auf {@link ProjectCardResponse} holt Tags und Reaktionszahlen
	 * fuer die ganze Liste in je einer Abfrage nach. Baute das Portfolio seine
	 * Kacheln selbst, entstuende diese Sammelabfrage ein zweites Mal oder, was
	 * wahrscheinlicher ist, gar nicht.
	 *
	 * <p><strong>Ohne Rechtepruefung und ohne angemeldete Person</strong>, anders
	 * als {@link #list} und {@link #detail}. Die Abfrage liefert ausschliesslich
	 * {@code PUBLISHED}, und veroeffentlichte Projekte darf nach §5 jede:r lesen,
	 * auch ohne Anmeldung. Eine Sichtbarkeitsschranke haette hier nichts zu
	 * entscheiden, koennte den Umfang also auch nicht versehentlich erweitern.
	 *
	 * <p><strong>Ohne Paginierung</strong>, weil §6.1 fuer das Profil eine
	 * schlichte Liste fuehrt und kein Seitenformat nach §6.6.
	 *
	 * @param authorId ID der Person, deren Profil abgerufen wird
	 */
	public List<ProjectCardResponse> publishedCardsOfAuthor(UUID authorId) {
		return toCards(projectRepository.findByAuthorIdAndStatusOrderByPublishedAtDescIdAsc(
				authorId, ProjectStatus.PUBLISHED));
	}

	// ------------------------------------------------------------------

	/**
	 * Behandelt einen leeren Parameter wie einen fehlenden.
	 *
	 * <p>{@code ?q=} und {@code ?semester=} kommen als leere Zeichenkette an,
	 * nicht als {@code null}. Ohne diese Umdeutung wuerde ein Formular, das
	 * unausgefuellte Felder mitschickt, nach dem leeren Semester filtern und
	 * eine leere Liste bekommen.
	 */
	private static String emptyAsNull(String value) {
		if (value == null) {
			return null;
		}
		String trimmed = value.trim();
		return trimmed.isEmpty() ? null : trimmed;
	}

	/**
	 * Tags alphabetisch. Die Entity haelt sie in einem {@code Set}, das keine
	 * Reihenfolge zusichert; ohne Sortierung koennte dieselbe Kachel zwischen
	 * zwei Aufrufen unterschiedlich aussehen.
	 */
	private static List<String> sortedTags(Project project) {
		return project.getTags().stream().sorted().toList();
	}

	private static String nameOrEmpty(User user, boolean lastName) {
		if (user == null) {
			return "";
		}
		String value = lastName ? user.getLastName() : user.getFirstName();
		return value == null ? "" : value;
	}

	/** Wie im {@code ProjectPermissionService}: angemeldet heisst auch ACTIVE (§2.9). */
	private static boolean isLoggedIn(AuthenticatedUser user) {
		return user != null && user.getStatus() == UserStatus.ACTIVE;
	}
}
