package de.hsbremen.eportfolio.admin;

import de.hsbremen.eportfolio.admin.dto.DashboardResponse;
import de.hsbremen.eportfolio.auth.AuthenticatedUser;
import de.hsbremen.eportfolio.common.enums.BlockType;
import de.hsbremen.eportfolio.common.enums.NominationStatus;
import de.hsbremen.eportfolio.common.enums.ProjectStatus;
import de.hsbremen.eportfolio.common.enums.Role;
import de.hsbremen.eportfolio.common.enums.UserStatus;
import de.hsbremen.eportfolio.project.BlockRepository;
import de.hsbremen.eportfolio.project.ProjectPermissionService;
import de.hsbremen.eportfolio.project.ProjectRepository;
import de.hsbremen.eportfolio.top10.Top10NominationRepository;
import de.hsbremen.eportfolio.user.UserRepository;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.function.ToLongFunction;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Die Kennzahlen von {@code GET /api/admin/dashboard} (§6.1).
 *
 * <p><strong>Vier Abfragen mit {@code group by} und eine Zaehlung, nicht
 * fuenfundzwanzig einzelne.</strong> Die vier Aufschluesselungen umfassen
 * zusammen fuenf Projektstatus, drei Rollen, drei Kontostatus und vierzehn
 * Blocktypen. Jeden Wert einzeln zu zaehlen waere derselbe Inhalt in
 * fuenfundzwanzig Datenbankrunden, und jede neue Enum-Konstante brauchte eine
 * weitere Zeile Code.
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
// Klassenweit, weil dieser Dienst ausschliesslich zaehlt. Die fuenf Abfragen
// laufen damit zudem in derselben Transaktion und sehen denselben Stand; sonst
// koennte zwischen zwei von ihnen ein Projekt entstehen und die Summen passten
// nicht zueinander.
@Transactional(readOnly = true)
public class AdminDashboardService {

	private final ProjectRepository projectRepository;

	private final UserRepository userRepository;

	private final BlockRepository blockRepository;

	private final Top10NominationRepository nominationRepository;

	private final ProjectPermissionService permissions;

	public AdminDashboardService(ProjectRepository projectRepository,
			UserRepository userRepository,
			BlockRepository blockRepository,
			Top10NominationRepository nominationRepository,
			ProjectPermissionService permissions) {
		this.projectRepository = projectRepository;
		this.userRepository = userRepository;
		this.blockRepository = blockRepository;
		this.nominationRepository = nominationRepository;
		this.permissions = permissions;
	}

	/**
	 * Alle sechs Kennzahlen aus §6.1.
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
