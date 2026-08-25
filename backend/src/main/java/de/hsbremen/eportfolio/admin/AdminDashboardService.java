package de.hsbremen.eportfolio.admin;

import de.hsbremen.eportfolio.admin.dto.DashboardResponse;
import de.hsbremen.eportfolio.admin.dto.FacultyProjectCountResponse;
import de.hsbremen.eportfolio.auth.AuthenticatedUser;
import de.hsbremen.eportfolio.common.enums.BlockType;
import de.hsbremen.eportfolio.common.enums.NominationStatus;
import de.hsbremen.eportfolio.common.enums.ProjectStatus;
import de.hsbremen.eportfolio.common.enums.Role;
import de.hsbremen.eportfolio.common.enums.UserStatus;
import de.hsbremen.eportfolio.masterdata.Faculty;
import de.hsbremen.eportfolio.masterdata.FacultyRepository;
import de.hsbremen.eportfolio.project.BlockRepository;
import de.hsbremen.eportfolio.project.ProjectFacultyCount;
import de.hsbremen.eportfolio.project.ProjectPermissionService;
import de.hsbremen.eportfolio.project.ProjectRepository;
import de.hsbremen.eportfolio.project.dto.ReferenceResponse;
import de.hsbremen.eportfolio.top10.Top10EntryRepository;
import de.hsbremen.eportfolio.top10.Top10FacultyCount;
import de.hsbremen.eportfolio.top10.Top10NominationRepository;
import de.hsbremen.eportfolio.user.UserRepository;
import java.util.ArrayList;
import java.util.EnumMap;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.function.ToLongFunction;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Die Kennzahlen von {@code GET /api/admin/dashboard} (§6.1).
 *
 * <p><strong>Fuenf Abfragen mit {@code group by}, zwei Zaehlungen und eine
 * Stammdatenliste.</strong> Die vier Enum-Aufschluesselungen umfassen zusammen
 * fuenf Projektstatus, drei Rollen, drei Kontostatus und vierzehn Blocktypen,
 * dazu kommt je eine Zeile fuer jede Fakultaet. Jeden Wert einzeln zu zaehlen
 * waere derselbe Inhalt in fuenfundzwanzig Datenbankrunden plus einer je
 * Fakultaet, und jede neue Enum-Konstante brauchte eine weitere Zeile Code.
 *
 * <p><strong>{@code projectsByFaculty} faellt aus dem Muster</strong> (Contract
 * v76): es gruppiert nicht ueber ein Enum, sondern ueber Stammdaten, und braucht
 * deshalb den vollstaendigen Fakultaetsbestand als zweite Abfrage statt einer
 * Werteliste aus dem Code. Begruendung an {@link #byFaculty()}.
 *
 * <p><strong>Ohne Sichtbarkeitsschranke.</strong> Gezaehlt wird der gesamte
 * Bestand, auch Entwuerfe und deaktivierte Konten. Das ist keine Ausnahme von
 * §5, sondern deren Anwendung: die Zeile „Admin-Dashboard" traegt einen Haken
 * ausschliesslich bei ADMIN, und dieselbe Rolle darf Projekte in jedem Status
 * ohnehin lesen. Eine gefilterte Zahl waere fuer den einzigen zugelassenen
 * Aufrufer schlicht falsch.
 *
 * <p><strong>Kein Zeitbezug.</strong> Alle Kennzahlen sind Bestandsgroessen zum
 * Zeitpunkt des Aufrufs; §6.1 nennt keinen Verlauf und keinen Zeitraum. Ein
 * Verlauf braeuchte entweder gespeicherte Momentaufnahmen oder eine Auswertung
 * der Statushistorie und waere ein eigenes Ticket.
 */
@Service
// Klassenweit, weil dieser Dienst ausschliesslich zaehlt: kein Dirty-Check, kein
// Flush, eine Verbindung statt sieben, und die Leseabsicht steht am Typ.
//
// Einen gemeinsamen Snapshot ergibt das nicht. PostgreSQL laeuft hier auf der
// Voreinstellung READ COMMITTED, und dort bekommt jedes Statement seinen eigenen
// Stand; zwischen zwei der Abfragen kann also weiterhin ein Projekt entstehen.
// Fuer Bestandsgroessen einer Anzeige ist das hinnehmbar: im schlimmsten Fall
// steht eine gerade angelegte Fakultaet mit 0 in der Liste. Wer wirklich einen
// Zeitpunkt braeuchte, muesste Isolation.REPEATABLE_READ setzen, und das ist
// fuer ein Dashboard nicht angemessen.
@Transactional(readOnly = true)
public class AdminDashboardService {

	private final ProjectRepository projectRepository;

	private final UserRepository userRepository;

	private final BlockRepository blockRepository;

	private final Top10NominationRepository nominationRepository;

	private final Top10EntryRepository top10EntryRepository;

	private final FacultyRepository facultyRepository;

	private final ProjectPermissionService permissions;

	public AdminDashboardService(ProjectRepository projectRepository,
			UserRepository userRepository,
			BlockRepository blockRepository,
			Top10NominationRepository nominationRepository,
			Top10EntryRepository top10EntryRepository,
			FacultyRepository facultyRepository,
			ProjectPermissionService permissions) {
		this.projectRepository = projectRepository;
		this.userRepository = userRepository;
		this.blockRepository = blockRepository;
		this.nominationRepository = nominationRepository;
		this.top10EntryRepository = top10EntryRepository;
		this.facultyRepository = facultyRepository;
		this.permissions = permissions;
	}

	/**
	 * Alle sieben Kennzahlen aus §6.1.
	 *
	 * @param user angemeldete Person; die Filterkette laesst auf
	 *             {@code /api/admin/**} nur ADMIN durch
	 * @throws AccessDeniedException wenn die Rolle nicht ADMIN ist (403)
	 */
	public DashboardResponse dashboard(AuthenticatedUser user) {
		if (!permissions.maySeeAdminDashboard(user)) {
			throw new AccessDeniedException(
					"Das Dashboard der Administrationsseite ist ausschliesslich fuer ADMIN (§5).");
		}

		return new DashboardResponse(
				byEnum(ProjectStatus.class, projectRepository.countPerStatus(),
						count -> count.status(), count -> count.count()),
				byFaculty(),
				userRepository.count(),
				byEnum(Role.class, userRepository.countPerRole(),
						count -> count.role(), count -> count.count()),
				byEnum(UserStatus.class, userRepository.countPerStatus(),
						count -> count.status(), count -> count.count()),
				nominationRepository.countByStatus(NominationStatus.PENDING),
				byEnum(BlockType.class, blockRepository.countPerType(),
						count -> count.type(), count -> count.count()));
	}

	/**
	 * Die Kennzahl {@code projectsByFaculty} (§6.1, Contract v76): je Fakultaet
	 * eine Zeile, sortiert nach dem Kuerzel, auch fuer Fakultaeten ohne Projekt.
	 *
	 * <p><strong>Warum die Fakultaeten getrennt geladen werden.</strong> Dieselbe
	 * Aufgabe wie in {@link #byEnum}, nur ohne Enum: der vollstaendige Bestand,
	 * gegen den aufgefuellt wird, steht nicht im Code, sondern in der Tabelle. Die
	 * Zaehlabfrage allein liefert nur Fakultaeten mit mindestens einem Projekt;
	 * eine ohne Projekt verschwaende sonst stillschweigend, statt als Null
	 * dazustehen.
	 *
	 * <p>Ein {@code left join} von der Fakultaet aus kaeme mit einer Abfrage aus
	 * und laedt als Konstruktor-Projektion ebenfalls keine Entitaeten. Der
	 * zweistufige Weg ist trotzdem der bessere: er benutzt die vorhandene
	 * Abbildung {@link ReferenceResponse#from(Faculty)} weiter, statt Name und
	 * Kuerzel ein zweites Mal in einer eigenen Projektion zu fuehren, und die
	 * Zaehlabfrage bleibt symmetrisch zu {@code countPerStatus()}. Die zweite
	 * Abfrage kostet bei einer Handvoll Stammdatenzeilen nichts.
	 *
	 * <p>{@code HashMap} und nicht {@code EnumMap}: der Schluessel ist eine UUID.
	 * Die Reihenfolge der Antwort kommt deshalb nicht aus der Karte, sondern aus
	 * der sortierten Fakultaetsliste.
	 *
	 * <p><strong>Seit Contract v82 drei Zaehlungen statt einer.</strong> Neben dem
	 * Bestand stehen die Projekte mit Top-10-Platz und die mit angenommener
	 * Nominierung. Beide werden roh ausgeliefert und nicht gegeneinander
	 * verrechnet: sie ueberschneiden sich in beide Richtungen, und welche
	 * Abschnitte daraus ein gestapelter Balken macht, ist eine Frage der
	 * Darstellung (Begruendung an {@link FacultyProjectCountResponse}).
	 */
	private List<FacultyProjectCountResponse> byFaculty() {
		Map<UUID, Long> counts = new HashMap<>();
		for (ProjectFacultyCount row : projectRepository.countPerFaculty()) {
			counts.put(row.facultyId(), row.count());
		}
		Map<UUID, Long> inTop10 = perFaculty(top10EntryRepository.countPerFaculty());
		Map<UUID, Long> accepted = perFaculty(nominationRepository
				.countProjectsPerFacultyByStatus(NominationStatus.ACCEPTED));

		List<Faculty> faculties = facultyRepository.findAllByOrderByAbbreviationAsc();
		List<FacultyProjectCountResponse> result = new ArrayList<>(faculties.size());
		for (Faculty faculty : faculties) {
			UUID id = faculty.getId();
			result.add(new FacultyProjectCountResponse(ReferenceResponse.from(faculty),
					counts.getOrDefault(id, 0L),
					inTop10.getOrDefault(id, 0L),
					accepted.getOrDefault(id, 0L)));
		}
		return result;
	}

	/** Ergebniszeilen der Kuratierungs-Abfragen als Karte ueber die Fakultaets-ID. */
	private static Map<UUID, Long> perFaculty(List<Top10FacultyCount> rows) {
		Map<UUID, Long> result = new HashMap<>();
		for (Top10FacultyCount row : rows) {
			result.put(row.facultyId(), row.count());
		}
		return result;
	}

	/**
	 * Baut aus den Ergebniszeilen einer {@code group by}-Abfrage eine Karte ueber
	 * <em>alle</em> Werte des Enums und traegt fuer die fehlenden 0 ein.
	 *
	 * <p>Das Auffuellen ist der eigentliche Zweck der Methode. Die Datenbank
	 * liefert nur Zeilen, zu denen es Datensaetze gibt; ein Status ohne Projekt
	 * fehlte in der Antwort einfach. Das Frontend muesste dann die Enum-Werte
	 * selbst kennen, um ein vollstaendiges Diagramm zu zeichnen, und der Contract
	 * fuehrte seine Enums an zwei Stellen (§2).
	 *
	 * <p>{@code EnumMap} und nicht {@code HashMap}, damit die Schluessel in der
	 * Deklarationsreihenfolge des Enums herauskommen und nicht in der eines
	 * Hashwerts. Sie ist stabil und fachlich lesbar; bei {@code ProjectStatus}
	 * ist es die Reihenfolge des Zustandsautomaten aus §4.1.
	 *
	 * @param <E>     Enum der Aufschluesselung
	 * @param <R>     Ergebniszeile der Abfrage, etwa {@code ProjectStatusCount}
	 * @param type    Klasse des Enums, fuer {@code EnumMap} und die Werteliste
	 * @param rows    Ergebniszeilen; jeder Enum-Wert kommt darin hoechstens
	 *                einmal vor, weil nach genau dieser Spalte gruppiert wurde
	 * @param keyOf   liest den Enum-Wert aus einer Ergebniszeile
	 * @param countOf liest die Zahl aus einer Ergebniszeile
	 */
	private static <E extends Enum<E>, R> Map<E, Long> byEnum(Class<E> type, List<R> rows,
			Function<R, E> keyOf, ToLongFunction<R> countOf) {

		Map<E, Long> result = new EnumMap<>(type);
		for (E value : type.getEnumConstants()) {
			result.put(value, 0L);
		}
		for (R row : rows) {
			result.put(keyOf.apply(row), countOf.applyAsLong(row));
		}
		return result;
	}
}
