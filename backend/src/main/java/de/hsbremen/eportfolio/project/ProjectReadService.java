package de.hsbremen.eportfolio.project;

import de.hsbremen.eportfolio.auth.AuthenticatedUser;
import de.hsbremen.eportfolio.common.dto.PageResponse;
import de.hsbremen.eportfolio.common.enums.ProjectStatus;
import de.hsbremen.eportfolio.common.enums.UserStatus;
import de.hsbremen.eportfolio.common.error.ErrorCodes;
import de.hsbremen.eportfolio.common.error.ResourceNotFoundException;
import de.hsbremen.eportfolio.common.error.ValidationException;
import de.hsbremen.eportfolio.masterdata.Tag;
import de.hsbremen.eportfolio.portfolio.PortfolioAvatar;
import de.hsbremen.eportfolio.portfolio.PortfolioRepository;
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
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
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
	 * Sortierfelder, deren Name im Request nicht der Pfad im Objektmodell ist.
	 *
	 * <p>Nur {@code semester} steht darin, und zwar seit Contract v45: das Feld
	 * ist am Projekt ein Fremdschluessel (§3.3, §3.18), und sortiert wird nach
	 * der von der Administration gepflegten Reihenfolge. Ein Sortieren nach dem
	 * Namen ergaebe „SoSe 2026" vor „WiSe 2025/26", ein Sortieren nach der ID
	 * eine zufaellige Ordnung.
	 *
	 * <p>Der Name des Parameters bleibt {@code semester}: §6.6 fuehrt ihn so,
	 * und {@code sortOrder} ist eine Eigenschaft der Stammdatenzeile und nichts,
	 * das der Client kennen muss.
	 *
	 * <p>Der Pfad erzeugt einen <em>aeusseren</em> Join, weil der Bezug
	 * {@code nullable} ist. Projekte ohne Semester fallen also nicht aus der
	 * Liste, sondern landen dort, wo Postgres NULL einsortiert (aufsteigend
	 * zuletzt).
	 */
	private static final Map<String, String> SORT_PATHS = Map.of(
			"semester", "semester.sortOrder");

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

	/**
	 * Reihenfolge der Projektmitglieder: Nachname, dann Vorname.
	 *
	 * <p>Die Zuordnungstabelle hat keine eigene Ordnung, und eine
	 * Mitgliederliste, die bei jedem Aufruf anders sortiert ist, wirkt in der
	 * Oberflaeche wie ein Fehler. Kachel und Detailantwort teilen sich die
	 * Konstante, damit dasselbe Projekt an beiden Stellen dieselbe Reihenfolge
	 * zeigt (§3.13; an der Kachel seit Contract v78).
	 */
	private static final Comparator<ProjectMember> BY_MEMBER_NAME = Comparator
			.comparing((ProjectMember member) -> nameOrEmpty(member.getUser(), true))
			.thenComparing(member -> nameOrEmpty(member.getUser(), false));

	private final ProjectRepository projectRepository;

	private final ProjectMemberRepository projectMemberRepository;

	private final BlockRepository blockRepository;

	private final ProjectStatusHistoryRepository statusHistoryRepository;

	private final ReactionRepository reactionRepository;

	/**
	 * Nur fuer die Profilbilder der Autor:innen und, seit Contract v78, der
	 * Projektmitglieder: die Kachel zeigt sie, das Projekt kennt sie nicht
	 * (§3.2). Gelesen wird ausschliesslich, und zwar gesammelt je Seite.
	 */
	private final PortfolioRepository portfolioRepository;

	private final ProjectPermissionService permissions;

	public ProjectReadService(ProjectRepository projectRepository,
			ProjectMemberRepository projectMemberRepository,
			BlockRepository blockRepository,
			ProjectStatusHistoryRepository statusHistoryRepository,
			ReactionRepository reactionRepository,
			PortfolioRepository portfolioRepository,
			ProjectPermissionService permissions) {
		this.projectRepository = projectRepository;
		this.projectMemberRepository = projectMemberRepository;
		this.blockRepository = blockRepository;
		this.statusHistoryRepository = statusHistoryRepository;
		this.reactionRepository = reactionRepository;
		this.portfolioRepository = portfolioRepository;
		this.permissions = permissions;
	}

	// ------------------------------------------------------------------
	// GET /api/projects
	// ------------------------------------------------------------------

	/**
	 * Gefilterte Projektliste im Seitenformat aus §6.6.
	 *
	 * <p>Der Umfang haengt an der Rolle (§5, seit v42): PUBLIC sieht nur
	 * Veroeffentlichtes, Studierende zusaetzlich ihre eigenen Projekte, die
	 * Redaktion zusaetzlich die ihr zugewiesenen ab der Einreichung, der Admin
	 * alles. Diese Schranke steht immer in der Abfrage; ein Filterwert kann sie
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

		return PageResponse.from(page, this::cards);
	}

	/**
	 * Verknuepft Sichtbarkeitsschranke und gesetzte Filter mit UND.
	 *
	 * <p>Die Schranke ist der Startwert und steht damit garantiert in jeder
	 * Abfrage, auch wenn spaeter ein Filter hinzukommt und jemand vergisst, ihn
	 * einzuhaengen.
	 *
	 * <p>Die sieben mehrwertigen Sachfilter (seit Contract v43, KAN-64) laufen
	 * ueber {@link #addAll}: jeder liefert ein einziges in-Praedikat, seine
	 * Werte sind also ODER-verknuepft, waehrend verschiedene Filter hier
	 * weiterhin mit UND aneinanderhaengen.
	 */
	private Specification<Project> conditions(AuthenticatedUser user, ProjectFilterRequest filter) {
		List<Specification<Project>> parts = new ArrayList<>();
		parts.add(ProjectSpecifications.visibleFor(user));

		addAll(parts, filter.category(), ProjectSpecifications::category);
		addAll(parts, filter.faculty(), ProjectSpecifications::faculty);
		addAll(parts, filter.studyProgram(), ProjectSpecifications::studyProgram);
		addAll(parts, filter.module(), ProjectSpecifications::module);
		addAll(parts, filter.degree(), ProjectSpecifications::degree);
		addAll(parts, filter.type(), ProjectSpecifications::type);
		add(parts, filter.status(), ProjectSpecifications::status);
		add(parts, filter.author(), ProjectSpecifications::author);
		addAll(parts, filter.semester(), ProjectSpecifications::semester);
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
	 * Haengt einen mehrwertigen Filter an, wenn er tatsaechlich Werte traegt.
	 *
	 * <p>Null-Elemente fallen vorher heraus: ein leerer Einzelwert wie in
	 * {@code ?faculty=a&faculty=} wird von Springs Konvertierung zu
	 * {@code null} im Listenelement, und ein {@code in} mit {@code null}
	 * darin vergliche gegen nichts. Das ist dieselbe Umdeutung „leer heisst
	 * fehlend" wie bei {@link #emptyAsNull(String)}. Bleibt nichts uebrig
	 * (Parameter fehlt oder ist ueberall leer), ist der Filter nicht gesetzt.
	 */
	private static <V> void addAll(List<Specification<Project>> parts, List<V> values,
			Function<List<V>, Specification<Project>> part) {
		if (values == null) {
			return;
		}
		List<V> present = values.stream().filter(Objects::nonNull).toList();
		if (!present.isEmpty()) {
			parts.add(part.apply(present));
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

		List<Sort.Order> orders = new ArrayList<>();
		for (Sort.Order order : requested) {
			if (!ALLOWED_SORT_FIELDS.contains(order.getProperty())) {
				throw new ValidationException(ErrorCodes.VALIDATION_FAILED,
						"Nach diesem Feld kann nicht sortiert werden. Erlaubt sind: "
								+ ALLOWED_SORT_FIELDS.stream().sorted().collect(Collectors.joining(", "))
								+ ".");
			}
			orders.add(order.withProperty(
					SORT_PATHS.getOrDefault(order.getProperty(), order.getProperty())));
		}
		orders.add(Sort.Order.asc("id"));

		return PageRequest.of(
				pageable.getPageNumber(),
				pageable.getPageSize(),
				Sort.by(orders));
	}

	/**
	 * Bildet eine ganze Seite Projekte auf Kacheln ab und holt dabei die
	 * Reaktionszahlen in einer einzigen Abfrage.
	 *
	 * <p>Die Tags kommen aus dem Lazy-Loading der Entity; {@code Project.tags}
	 * traegt dafuer ein {@code @BatchSize}, sodass auch sie eine Seite mit einer
	 * Abfrage abdecken. Zusammen mit dem {@code @EntityGraph} des Repositories
	 * kostet eine Seite damit sechs Abfragen (Treffer, Anzahl, Tags, Reaktionen,
	 * Mitglieder, Profilbilder) statt sechs plus einem Vielfachen der
	 * Seitengroesse. Die letzten beiden kamen mit Contract v78 dazu, als
	 * {@code members} an die Kachel rueckte (§3.13). Dass ihre Zahl an der
	 * Seite haengt und nicht an der Zahl der Kacheln, haelt
	 * {@code ProjectListQueryCountTest} fest.
	 *
	 * <p><strong>Oeffentlich, damit andere Module dieselbe Kachel bekommen.</strong>
	 * {@code GET /api/top10} und {@code GET /api/admin/top10-nominations} (KAN-24)
	 * zeigen dieselbe Projektkachel wie die Liste. Baute das Top-10-Modul sie
	 * selbst, entstuende die Sammelabfrage fuer Tags und Reaktionen ein zweites
	 * Mal oder, was wahrscheinlicher ist, gar nicht. Dieselbe Ueberlegung wie bei
	 * {@link #publishedCardsOfAuthor}.
	 *
	 * <p><strong>Ohne Rechtepruefung.</strong> Diese Methode bildet ab, was ihr
	 * gegeben wird; welche Projekte das sein duerfen, entscheidet der Aufrufer.
	 * Die Sichtbarkeitsschranke aus §5 steckt in {@link #list} in der Abfrage und
	 * nicht hier.
	 *
	 * @param projects Projekte mit bereits geladenen Bezuegen (Autor, Kategorie,
	 *                 Fakultaet, Studiengang); der Aufrufer sorgt dafuer ueber
	 *                 einen {@code @EntityGraph}
	 */
	public List<ProjectCardResponse> cards(List<Project> projects) {
		Map<UUID, Long> reactions = reactionsPerProject(projects);
		Map<UUID, List<ProjectMember>> members = membersPerProject(projects);
		Map<UUID, String> avatars = avatarsPerPerson(projects, members);

		return projects.stream()
				.map(project -> ProjectCardResponse.from(
						project,
						sortedTags(project),
						reactions.getOrDefault(project.getId(), 0L),
						avatarOf(project.getAuthor(), avatars),
						memberCards(members.getOrDefault(project.getId(), List.of()), avatars)))
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

	/**
	 * Die Mitglieder aller Projekte einer Seite in einer Abfrage (§3.13, seit
	 * Contract v78).
	 *
	 * <p>Dieselbe Ueberlegung wie bei {@link #avatarsPerPerson}: die
	 * Mitgliederliste je Kachel zu holen waere genau das N+1-Verhalten, das
	 * diese Klasse fuer Tags, Reaktionen und Profilbilder bereits vermeidet.
	 * Zugeordnet wird ueber {@code member.getProject().getId()}; das Projekt
	 * steht deshalb im {@code @EntityGraph} der Abfrage.
	 *
	 * <p>Projekte ohne Mitglieder fehlen in der Zuordnung. Ein fehlender
	 * Schluessel bedeutet dasselbe wie eine leere Liste, naemlich eine
	 * Einzelarbeit; der Aufrufer setzt dafuer {@code List.of()} ein.
	 */
	private Map<UUID, List<ProjectMember>> membersPerProject(List<Project> projects) {
		List<UUID> ids = projects.stream().map(Project::getId).toList();
		if (ids.isEmpty()) {
			return Map.of();
		}
		return projectMemberRepository.findByProjectIdIn(ids).stream()
				.collect(Collectors.groupingBy(member -> member.getProject().getId()));
	}

	/**
	 * Die Profilbilder aller auf einer Seite gezeigten Personen in einer
	 * Abfrage: Autor:innen und, seit Contract v78, Projektmitglieder.
	 *
	 * <p>Das Bild haengt am Portfolio und nicht am Projekt (§3.2); es je
	 * Kachel nachzuladen waere genau das N+1-Verhalten, das diese Klasse fuer
	 * Tags und Reaktionen bereits vermeidet. Eine Seite kostet damit eine
	 * Abfrage mehr, unabhaengig von ihrer Groesse.
	 *
	 * <p><strong>Eine Abfrage fuer beide Personenkreise</strong> und nicht je
	 * eine: die Mengen ueberschneiden sich (wer an einem Projekt mitwirkt, ist
	 * am naechsten oft Autor:in), und zwei Abfragen ergaeben zwei Zuordnungen
	 * fuer dieselbe Frage.
	 *
	 * <p>Die IDs laufen ueber ein Set: eine Person kann mehrere Projekte auf
	 * derselben Seite haben, und unter "My Portfolio" ist das der Normalfall.
	 */
	private Map<UUID, String> avatarsPerPerson(List<Project> projects,
			Map<UUID, List<ProjectMember>> membersPerProject) {

		Set<UUID> userIds = projects.stream()
				.map(Project::getAuthor)
				.filter(Objects::nonNull)
				.map(User::getId)
				.collect(Collectors.toCollection(HashSet::new));

		membersPerProject.values().stream()
				.flatMap(List::stream)
				.map(ProjectMember::getUser)
				.filter(Objects::nonNull)
				.map(User::getId)
				.forEach(userIds::add);

		if (userIds.isEmpty()) {
			return Map.of();
		}
		return portfolioRepository.findAvatarsByUserIds(userIds).stream()
				.collect(Collectors.toMap(PortfolioAvatar::userId, PortfolioAvatar::avatarUrl));
	}

	/**
	 * Die Mitglieder einer Kachel, geordnet und mit ihren bereits geladenen
	 * Profilbildern (§3.13).
	 */
	private static List<MemberResponse> memberCards(List<ProjectMember> members,
			Map<UUID, String> avatars) {
		return members.stream()
				.sorted(BY_MEMBER_NAME)
				.map(member -> MemberResponse.from(member, avatarOf(member.getUser(), avatars)))
				.toList();
	}

	/** Bild aus der Sammelabfrage, {@code null} fuer Personen ohne hinterlegtes. */
	private static String avatarOf(User user, Map<UUID, String> avatars) {
		return user == null ? null : avatars.get(user.getId());
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

		/*
		 * Zwei getrennte Fragen seit Contract v55 (§3.3): die Redaktion eines
		 * veroeffentlichten Projekts sieht jede:r, den Verlauf weiterhin nur die
		 * Projektseite, die zugewiesene Redaktion und der Admin (§3.12).
		 */
		boolean internalsVisible = permissions.maySeeProjectInternals(user, project);
		boolean editorsVisible = permissions.maySeeProjectEditors(user, project);

		return ProjectDetailResponse.from(
				project,
				sortedTags(project),
				reactionRepository.countByProjectId(projectId),
				members(projectId),
				blocks(projectId),
				editorsVisible ? editors(project) : null,
				internalsVisible ? statusHistory(projectId) : null);
	}

	/**
	 * Die Detailantwort auf {@code DELETE /api/projects/{id}/editors/me}
	 * (§6.1, seit Contract v68), gebaut aus der Sicht, die die abgebende Person
	 * bis zu diesem Aufruf hatte.
	 *
	 * <p><strong>Warum {@link #detail} hier nicht taugt.</strong> Der Aufruf
	 * nimmt der anfragenden Person genau die Berechtigung, mit der sie ihn
	 * ausgeloest hat: sie ist danach nicht mehr zugewiesen, und war sie die
	 * letzte, steht das Projekt zudem im {@code DRAFT}. {@code detail} wuerde
	 * seine eigene Leseschranke anwenden und die Antwort auf die soeben
	 * erledigte Aktion mit 403 beenden. Die Statushistorie fiele aus demselben
	 * Grund weg, obwohl gerade sie den Uebergang traegt, den der Aufruf
	 * ausgeloest hat (§3.12).
	 *
	 * <p><strong>Das oeffnet nichts.</strong> Die Person war im Moment der
	 * Anfrage die zugewiesene Redaktion und durfte dieselben Felder lesen; die
	 * Berechtigung dafuer hat {@code ProjectWorkflowService.resignAsEditor}
	 * unmittelbar davor geprueft. Geliefert wird eine einzige Momentaufnahme als
	 * Ergebnis ihrer eigenen Handlung, kein weiterer Zugang: ein zweiter Aufruf
	 * auf {@code GET /api/projects/{id}} endet mit 403.
	 *
	 * <p><strong>Sie nimmt das Projekt und keine ID.</strong> Paketprivat
	 * schuetzt vor fremden Paketen, nicht vor dem naechsten Nachbarn: mit einer
	 * rohen {@code UUID} koennte jede kuenftige Klasse dieses Pakets sie auf ein
	 * beliebiges Projekt richten und {@code editors} samt Statushistorie ohne
	 * Pruefung bekommen. Ein bereits geladenes {@link Project} kann dagegen nur
	 * einreichen, wer es geladen und legitimiert hat; nebenbei entfaellt die
	 * zweite Abfrage. Ohne {@code AuthenticatedUser}, damit sie sich nicht
	 * versehentlich als allgemeiner Lesepfad benutzen laesst.
	 *
	 * @param project das Projekt, dessen Zuweisung gerade abgegeben wurde,
	 *                bereits geladen und vom Aufrufer geprueft
	 */
	@Transactional(readOnly = true)
	ProjectDetailResponse detailAfterOwnResignation(Project project) {
		UUID projectId = project.getId();

		return ProjectDetailResponse.from(
				project,
				sortedTags(project),
				reactionRepository.countByProjectId(projectId),
				members(projectId),
				blocks(projectId),
				editors(project),
				statusHistory(projectId));
	}

	/**
	 * Die Mitglieder der Detailantwort (§3.13), ohne Profilbild: die
	 * Detailansicht zeigt keines, auch nicht bei der Autor:in. Wer eines
	 * braucht, gibt es wie die Kachel von aussen mit.
	 */
	private List<MemberResponse> members(UUID projectId) {
		return projectMemberRepository.findByProjectId(projectId).stream()
				.sorted(BY_MEMBER_NAME)
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
		return cards(projectRepository.findByAuthorIdAndStatusOrderByPublishedAtDescIdAsc(
				authorId, ProjectStatus.PUBLISHED));
	}

	// ------------------------------------------------------------------

	/**
	 * Behandelt einen leeren Parameter wie einen fehlenden.
	 *
	 * <p>{@code ?q=} kommt als leere Zeichenkette an, nicht als {@code null}.
	 * Ohne diese Umdeutung wuerde ein Formular, das unausgefuellte Felder
	 * mitschickt, nach dem leeren Suchbegriff filtern. Die ID-Filter brauchen
	 * das nicht: Springs Umwandlung nach {@code UUID} macht aus einer leeren
	 * Zeichenkette bereits {@code null}.
	 */
	private static String emptyAsNull(String value) {
		if (value == null) {
			return null;
		}
		String trimmed = value.trim();
		return trimmed.isEmpty() ? null : trimmed;
	}

	/**
	 * Tags alphabetisch, als Namen. Die Entity haelt sie in einem {@code Set},
	 * das keine Reihenfolge zusichert; ohne Sortierung koennte dieselbe Kachel
	 * zwischen zwei Aufrufen unterschiedlich aussehen.
	 *
	 * <p>Seit Contract v57 steht hinter jedem Tag eine Stammdatenzeile (§3.19).
	 * An der Antwort aendert das nichts: {@code tags} bleibt eine Liste von
	 * Namen (§3.3). Die {@code id} eines Tags braucht allein die Vorschlagsliste
	 * aus {@code GET /api/tags}, nicht das Projekt.
	 */
	private static List<String> sortedTags(Project project) {
		return project.getTags().stream()
				.map(Tag::getName)
				.sorted()
				.toList();
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
