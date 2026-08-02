package de.hsbremen.eportfolio.projekt;

import de.hsbremen.eportfolio.auth.AngemeldeterBenutzer;
import de.hsbremen.eportfolio.benutzer.User;
import de.hsbremen.eportfolio.common.dto.SeiteAntwort;
import de.hsbremen.eportfolio.common.enums.UserStatus;
import de.hsbremen.eportfolio.common.error.Fehlercodes;
import de.hsbremen.eportfolio.common.error.RessourceNichtGefundenException;
import de.hsbremen.eportfolio.common.error.ValidierungException;
import de.hsbremen.eportfolio.projekt.dto.BlockAntwort;
import de.hsbremen.eportfolio.projekt.dto.MitgliedAntwort;
import de.hsbremen.eportfolio.projekt.dto.PersonAntwort;
import de.hsbremen.eportfolio.projekt.dto.ProjektDetailAntwort;
import de.hsbremen.eportfolio.projekt.dto.ProjektFilterAnfrage;
import de.hsbremen.eportfolio.projekt.dto.ProjektKachelAntwort;
import de.hsbremen.eportfolio.projekt.dto.StatusHistorieAntwort;
import de.hsbremen.eportfolio.reaktion.ReaktionAnzahl;
import de.hsbremen.eportfolio.reaktion.ReaktionRepository;
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
 * {@code GET /api/projekte} und {@code GET /api/projekte/{id}}.
 *
 * <p><strong>Warum ein eigener Lesedienst</strong> und nicht ein
 * {@code ProjektService} fuer alles: die schreibenden Endpoints (KAN-17 bis
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
public class ProjektLeseService {

	/**
	 * Felder, nach denen {@code GET /api/projekte} sortieren darf (§1:
	 * {@code ?sort=<feld>,<asc|desc>}).
	 *
	 * <p><strong>Warum eine Positivliste</strong> und nicht einfach alles, was
	 * Spring Data annimmt: der Parameter geht sonst ungefiltert in eine
	 * {@code order by}-Klausel ueber beliebige Pfade des Objektmodells. Ein
	 * {@code ?sort=autor.passwortHash,asc} wuerde die Liste nach dem Passworthash
	 * ordnen und damit ueber die Reihenfolge Rueckschluesse auf ein Feld
	 * erlauben, das nach §3.1 den Server nie verlassen darf. Unbekannte Felder
	 * enden ausserdem in einer Ausnahme aus dem Persistenzlayer, also in einem
	 * 500 statt in einer verstaendlichen Antwort.
	 *
	 * <p>{@code reaktionAnzahl} steht bewusst nicht darin: es ist kein Feld,
	 * sondern eine Aggregation und liesse sich nur mit Join und
	 * {@code group by} sortieren.
	 */
	private static final Set<String> ERLAUBTE_SORTIERFELDER = Set.of(
			"titel", "semester", "status", "erstelltAm", "aktualisiertAm", "veroeffentlichtAm");

	/**
	 * Standardsortierung: zuletzt bearbeitete Projekte zuerst.
	 *
	 * <p>Nicht {@code veroeffentlichtAm}, obwohl das fuer die oeffentliche
	 * Galerie naeher laege: das Feld ist bei allem ausser
	 * {@code VEROEFFENTLICHT} null (§3.3), und in den angemeldeten Ansichten
	 * („Meine Projekte", „Meine Reviews") stuenden dann ausgerechnet die
	 * Entwuerfe in willkuerlicher Reihenfolge am Anfang. {@code aktualisiertAm}
	 * ist in jedem Status gesetzt und ergibt in allen Ansichten dieselbe
	 * verstaendliche Ordnung.
	 */
	private static final Sort STANDARDSORTIERUNG = Sort.by(Sort.Direction.DESC, "aktualisiertAm");

	private final ProjektRepository projektRepository;

	private final ProjektmitgliedRepository projektmitgliedRepository;

	private final BlockRepository blockRepository;

	private final ProjektStatusHistorieRepository statusHistorieRepository;

	private final ReaktionRepository reaktionRepository;

	private final ProjektBerechtigungService berechtigungen;

	public ProjektLeseService(ProjektRepository projektRepository,
			ProjektmitgliedRepository projektmitgliedRepository,
			BlockRepository blockRepository,
			ProjektStatusHistorieRepository statusHistorieRepository,
			ReaktionRepository reaktionRepository,
			ProjektBerechtigungService berechtigungen) {
		this.projektRepository = projektRepository;
		this.projektmitgliedRepository = projektmitgliedRepository;
		this.blockRepository = blockRepository;
		this.statusHistorieRepository = statusHistorieRepository;
		this.reaktionRepository = reaktionRepository;
		this.berechtigungen = berechtigungen;
	}

	// ------------------------------------------------------------------
	// GET /api/projekte
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
	 * {@code ?kategorie=<unbekannt>} ergibt eine leere Liste. Der Parameter
	 * filtert eine Liste, er adressiert keine Ressource; dieselbe Festlegung
	 * gilt schon bei den Stammdaten-Endpoints.
	 *
	 * @param benutzer     angemeldete Person, {@code null} bedeutet PUBLIC
	 * @param filter       die gesetzten Filter aus §6.1
	 * @param seitenwunsch Seite, Groesse und Sortierung
	 * @throws ValidierungException bei einem unbekannten Sortierfeld oder einem
	 *                              {@code redakteur}, der weder {@code me} noch
	 *                              eine UUID ist (400)
	 */
	public SeiteAntwort<ProjektKachelAntwort> liste(AngemeldeterBenutzer benutzer,
			ProjektFilterAnfrage filter, Pageable seitenwunsch) {

		Page<Projekt> seite = projektRepository.findAll(
				bedingungen(benutzer, filter),
				vervollstaendigeSortierung(seitenwunsch));

		return SeiteAntwort.aus(seite, this::aufKacheln);
	}

	/**
	 * Verknuepft Sichtbarkeitsschranke und gesetzte Filter mit UND.
	 *
	 * <p>Die Schranke ist der Startwert und steht damit garantiert in jeder
	 * Abfrage, auch wenn spaeter ein Filter hinzukommt und jemand vergisst, ihn
	 * einzuhaengen.
	 */
	private Specification<Projekt> bedingungen(AngemeldeterBenutzer benutzer, ProjektFilterAnfrage filter) {
		List<Specification<Projekt>> teile = new ArrayList<>();
		teile.add(ProjektSpezifikationen.sichtbarFuer(benutzer));

		ergaenze(teile, filter.kategorie(), ProjektSpezifikationen::kategorie);
		ergaenze(teile, filter.fakultaet(), ProjektSpezifikationen::fakultaet);
		ergaenze(teile, filter.studiengang(), ProjektSpezifikationen::studiengang);
		ergaenze(teile, filter.modul(), ProjektSpezifikationen::modul);
		ergaenze(teile, filter.abschluss(), ProjektSpezifikationen::abschluss);
		ergaenze(teile, filter.typ(), ProjektSpezifikationen::typ);
		ergaenze(teile, filter.status(), ProjektSpezifikationen::status);
		ergaenze(teile, filter.autor(), ProjektSpezifikationen::autor);
		ergaenze(teile, leerAlsNull(filter.semester()), ProjektSpezifikationen::semester);
		ergaenze(teile, leerAlsNull(filter.q()), ProjektSpezifikationen::suchtext);
		ergaenze(teile, redakteurId(benutzer, filter.redakteur()), ProjektSpezifikationen::redakteur);

		return teile.stream().reduce(Specification::and).orElseThrow();
	}

	private static <W> void ergaenze(List<Specification<Projekt>> teile, W wert,
			Function<W, Specification<Projekt>> baustein) {
		if (wert != null) {
			teile.add(baustein.apply(wert));
		}
	}

	/**
	 * Loest den Parameter {@code redakteur} auf: entweder das Wort {@code me}
	 * oder eine UUID (§6.1).
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
	 * {@code autor}.
	 */
	private UUID redakteurId(AngemeldeterBenutzer benutzer, String redakteur) {
		String wert = leerAlsNull(redakteur);
		if (wert == null) {
			return null;
		}
		if (ProjektFilterAnfrage.REDAKTEUR_ICH.equalsIgnoreCase(wert)) {
			if (!angemeldet(benutzer)) {
				throw new AuthenticationCredentialsNotFoundException(
						"Der Filter \"redakteur=me\" setzt eine Anmeldung voraus.");
			}
			return benutzer.getId();
		}
		try {
			return UUID.fromString(wert);
		} catch (IllegalArgumentException ex) {
			// Bewusst ohne den eingeschickten Wert in der Meldung: was
			// ungeprueft hereinkommt, geht nicht ungeprueft wieder hinaus.
			throw new ValidierungException(Fehlercodes.VALIDIERUNG_FEHLGESCHLAGEN,
					"Der Parameter \"redakteur\" erwartet eine UUID oder das Wort \"me\".");
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
	private Pageable vervollstaendigeSortierung(Pageable seitenwunsch) {
		Sort gewuenscht = seitenwunsch.getSort().isSorted() ? seitenwunsch.getSort() : STANDARDSORTIERUNG;

		for (Sort.Order ordnung : gewuenscht) {
			if (!ERLAUBTE_SORTIERFELDER.contains(ordnung.getProperty())) {
				throw new ValidierungException(Fehlercodes.VALIDIERUNG_FEHLGESCHLAGEN,
						"Nach diesem Feld kann nicht sortiert werden. Erlaubt sind: "
								+ ERLAUBTE_SORTIERFELDER.stream().sorted().collect(Collectors.joining(", "))
								+ ".");
			}
		}

		return PageRequest.of(
				seitenwunsch.getPageNumber(),
				seitenwunsch.getPageSize(),
				gewuenscht.and(Sort.by(Sort.Direction.ASC, "id")));
	}

	/**
	 * Bildet eine ganze Seite Projekte auf Kacheln ab und holt dabei die
	 * Reaktionszahlen in einer einzigen Abfrage.
	 *
	 * <p>Die Tags kommen aus dem Lazy-Loading der Entity; {@code Projekt.tags}
	 * traegt dafuer ein {@code @BatchSize}, sodass auch sie eine Seite mit einer
	 * Abfrage abdecken. Zusammen mit dem {@code @EntityGraph} des Repositories
	 * kostet eine Seite damit vier Abfragen (Treffer, Anzahl, Tags,
	 * Reaktionen) statt vier plus dem Dreifachen der Seitengroesse.
	 */
	private List<ProjektKachelAntwort> aufKacheln(List<Projekt> projekte) {
		Map<UUID, Long> reaktionen = reaktionenJeProjekt(projekte);

		return projekte.stream()
				.map(projekt -> ProjektKachelAntwort.aus(
						projekt,
						sortierteTags(projekt),
						reaktionen.getOrDefault(projekt.getId(), 0L)))
				.toList();
	}

	private Map<UUID, Long> reaktionenJeProjekt(List<Projekt> projekte) {
		List<UUID> ids = projekte.stream().map(Projekt::getId).toList();
		if (ids.isEmpty()) {
			// Ein "in ()" mit leerer Liste ist in SQL nicht ueberall gueltig;
			// die Abfrage waere ohnehin sinnlos.
			return Map.of();
		}
		return reaktionRepository.zaehleJeProjekt(ids).stream()
				.collect(Collectors.toMap(ReaktionAnzahl::projektId, ReaktionAnzahl::anzahl));
	}

	// ------------------------------------------------------------------
	// GET /api/projekte/{id}
	// ------------------------------------------------------------------

	/**
	 * Ein einzelnes Projekt mit Inhalt, Mitgliedern und Metadaten.
	 *
	 * <p>Fehlerpolitik nach §6.3.1, in dieser Reihenfolge:
	 * <ol>
	 * <li>Es gibt kein Projekt mit dieser ID: <strong>404</strong>
	 * {@code PROJEKT_NICHT_GEFUNDEN}.</li>
	 * <li>Es gibt eines, die anfragende Person ist nicht angemeldet:
	 * <strong>401</strong> {@code NICHT_AUTHENTIFIZIERT}.</li>
	 * <li>Es gibt eines, sie ist angemeldet, darf es aber nicht lesen:
	 * <strong>403</strong> {@code KEINE_BERECHTIGUNG}.</li>
	 * </ol>
	 *
	 * <p>Die Existenz wird also nicht hinter einem 404 verborgen. Das ist eine
	 * bewusste Entscheidung des Contracts: IDs sind UUIDs und nicht erratbar,
	 * die Semantik bleibt ueber alle Endpoints gleich, und ein Tippfehler im
	 * Client bleibt von einem Rechteproblem unterscheidbar.
	 *
	 * @param benutzer  angemeldete Person, {@code null} bedeutet PUBLIC
	 * @param projektId ID aus dem Pfad
	 */
	public ProjektDetailAntwort detail(AngemeldeterBenutzer benutzer, UUID projektId) {
		Projekt projekt = projektRepository.findMitBezuegenById(projektId)
				.orElseThrow(() -> RessourceNichtGefundenException.fuerProjekt(projektId));

		if (!berechtigungen.darfProjektLesen(benutzer, projekt)) {
			if (!angemeldet(benutzer)) {
				throw new AuthenticationCredentialsNotFoundException(
						"Dieses Projekt ist nicht oeffentlich. Anmeldung erforderlich.");
			}
			throw new AccessDeniedException("Fuer dieses Projekt fehlt die Leseberechtigung.");
		}

		boolean internaSichtbar = berechtigungen.darfProjektinternaSehen(benutzer, projekt);

		return ProjektDetailAntwort.aus(
				projekt,
				sortierteTags(projekt),
				reaktionRepository.countByProjektId(projektId),
				mitglieder(projektId),
				blocks(projektId),
				internaSichtbar ? redakteure(projekt) : null,
				internaSichtbar ? statusHistorie(projektId) : null);
	}

	private List<MitgliedAntwort> mitglieder(UUID projektId) {
		return projektmitgliedRepository.findByProjektId(projektId).stream()
				// Stabile Reihenfolge: die Zuordnungstabelle hat keine, und eine
				// Mitgliederliste, die bei jedem Aufruf anders sortiert ist,
				// wirkt in der UI wie ein Fehler.
				.sorted(Comparator
						.comparing((Projektmitglied mitglied) -> nameOderLeer(mitglied.getUser(), true))
						.thenComparing(mitglied -> nameOderLeer(mitglied.getUser(), false)))
				.map(MitgliedAntwort::aus)
				.toList();
	}

	/**
	 * Inhalt des Projekts, geordnet nach {@code reihenfolge} (§6.1).
	 *
	 * <p>Bewusst ueber das Repository und nicht ueber {@code projekt.getBlocks()}:
	 * die Detailantwort setzt sich durchgehend aus Abfragen zusammen, so wie es
	 * Mitglieder und Statushistorie ohnehin tun. Das ist ein Aufruf statt eines
	 * Zugriffs auf den Zustand des Aggregats und liefert damit unabhaengig davon,
	 * ob die Sammlung im laufenden Persistenzkontext schon einmal angefasst
	 * wurde, denselben Stand wie die Datenbank. Kosten sind dieselben: eine
	 * Abfrage.
	 */
	private List<BlockAntwort> blocks(UUID projektId) {
		return blockRepository.findByProjektIdOrderByReihenfolgeAsc(projektId).stream()
				.map(BlockAntwort::aus)
				.toList();
	}

	private List<PersonAntwort> redakteure(Projekt projekt) {
		return projekt.getRedakteure().stream()
				.sorted(Comparator
						.comparing((User user) -> nameOderLeer(user, true))
						.thenComparing(user -> nameOderLeer(user, false)))
				.map(PersonAntwort::aus)
				.toList();
	}

	private List<StatusHistorieAntwort> statusHistorie(UUID projektId) {
		return statusHistorieRepository.findByProjektIdOrderByZeitpunktAsc(projektId).stream()
				.map(StatusHistorieAntwort::aus)
				.toList();
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
	private static String leerAlsNull(String wert) {
		if (wert == null) {
			return null;
		}
		String getrimmt = wert.trim();
		return getrimmt.isEmpty() ? null : getrimmt;
	}

	/**
	 * Tags alphabetisch. Die Entity haelt sie in einem {@code Set}, das keine
	 * Reihenfolge zusichert; ohne Sortierung koennte dieselbe Kachel zwischen
	 * zwei Aufrufen unterschiedlich aussehen.
	 */
	private static List<String> sortierteTags(Projekt projekt) {
		return projekt.getTags().stream().sorted().toList();
	}

	private static String nameOderLeer(User user, boolean nachname) {
		if (user == null) {
			return "";
		}
		String wert = nachname ? user.getNachname() : user.getVorname();
		return wert == null ? "" : wert;
	}

	/** Wie im {@code ProjektBerechtigungService}: angemeldet heisst auch AKTIV (§2.9). */
	private static boolean angemeldet(AngemeldeterBenutzer benutzer) {
		return benutzer != null && benutzer.getStatus() == UserStatus.AKTIV;
	}
}
