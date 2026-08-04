package de.hsbremen.eportfolio.portfolio;

import de.hsbremen.eportfolio.auth.AuthenticatedUser;
import de.hsbremen.eportfolio.common.error.ResourceNotFoundException;
import de.hsbremen.eportfolio.portfolio.dto.OwnPortfolioResponse;
import de.hsbremen.eportfolio.portfolio.dto.PortfolioResponse;
import de.hsbremen.eportfolio.portfolio.dto.PortfolioUpdateRequest;
import de.hsbremen.eportfolio.project.ProjectPermissionService;
import de.hsbremen.eportfolio.project.ProjectReadService;
import de.hsbremen.eportfolio.user.User;
import de.hsbremen.eportfolio.user.UserRepository;
import java.util.UUID;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Die drei Portfolio-Endpoints aus API-Contract §6.1 (KAN-22) und die einzige
 * Stelle, an der eine Portfolio-Zeile entsteht (§3.2.1).
 *
 * <p><strong>Das Portfolio entsteht mit dem Benutzerkonto</strong>, nicht beim
 * ersten Schreibzugriff. §3.2 legt eine 1:1-Beziehung zu {@code User} fest;
 * entstuende die Zeile erst spaeter, waere die Beziehung faktisch 1:0..1 und
 * jede lesende Stelle muesste den Fall „User ohne Portfolio" behandeln. Die
 * Invariante sofort herzustellen ist billiger, als sie ueberall zu pruefen.
 *
 * <p><strong>Deshalb genau eine Anlagestelle:</strong> {@link #createFor(User)}.
 * Drei Wege rufen sie auf: die Registrierung (KAN-26), die Kontoanlage durch die
 * Administration (KAN-25) und der {@code DevTestUserSeeder}. Verteilte
 * Anlagelogik fuehrt zuverlaessig dazu, dass ein Weg vergessen wird,
 * typischerweise der Admin-Pfad, weil er nicht Teil des sichtbaren Nutzerflusses
 * ist. Von den drei Wegen existiert heute nur der Seeder; die beiden anderen
 * kommen mit ihren Tickets dazu und finden die Methode vor.
 *
 * <p><strong>Defensiv trotz garantierter Anlage</strong> (§3.2.1): ein fehlendes
 * Portfolio ergibt bei {@link #own} 200 mit leeren Feldern und kein 404, und
 * {@link #update} legt die Zeile bei Bedarf an. Ohne das entstuende der
 * widerspruechliche Fall, dass GET mit 200 antwortet und das anschliessende PUT
 * mit 404 scheitert. Das ist ein Sicherheitsnetz fuer Konten aus der Zeit vor
 * dieser Zusage und kein regulaerer Weg.
 *
 * <p><strong>Zur Abhaengigkeit auf {@code project}:</strong> dieses Modul ruft
 * {@link ProjectReadService} und {@link ProjectPermissionService}, umgekehrt
 * kennt {@code project} das Portfolio nicht. Die Richtung ist damit eindeutig
 * und es entsteht kein Kreis.
 */
@Service
public class PortfolioService {

	private final PortfolioRepository portfolioRepository;

	private final UserRepository userRepository;

	private final ProjectReadService projectReadService;

	private final ProjectPermissionService permissions;

	public PortfolioService(PortfolioRepository portfolioRepository,
			UserRepository userRepository,
			ProjectReadService projectReadService,
			ProjectPermissionService permissions) {
		this.portfolioRepository = portfolioRepository;
		this.userRepository = userRepository;
		this.projectReadService = projectReadService;
		this.permissions = permissions;
	}

	// ------------------------------------------------------------------
	// §3.2.1: die einzige Anlagestelle
	// ------------------------------------------------------------------

	/**
	 * Legt das Portfolio zu einem Benutzerkonto an, <strong>idempotent</strong>.
	 *
	 * <p>Ein zweiter Aufruf legt keine zweite Zeile an, sondern liefert die
	 * bestehende. Das ist die Bedingung dafuer, dass die Methode aus jedem der
	 * drei Wege aus §3.2.1 bedenkenlos aufgerufen werden kann, auch mehrfach: der
	 * Dev-Seeder laeuft bei jedem Start, und ein Registrierungsvorgang kann
	 * wiederholt werden.
	 *
	 * <p><strong>Zur Gleichzeitigkeit:</strong> die Pruefung „gibt es schon?" und
	 * das Anlegen sind nicht atomar. Legten zwei Anfragen gleichzeitig dasselbe
	 * Konto an, scheiterte die zweite am Unique auf {@code user_id} und damit an
	 * der Datenbank statt an einer stillen Doppelzeile. Ein echter Wettlauf ist
	 * hier nicht konstruierbar: die drei Aufrufer legen die Zeile jeweils im
	 * selben Vorgang wie den {@code User} an, den es vorher noch nicht gab.
	 *
	 * @param user gespeichertes Konto mit vergebener ID
	 * @return die vorhandene oder neu angelegte Zeile; die Aufrufer duerfen sie
	 *         ignorieren
	 */
	@Transactional
	public Portfolio createFor(User user) {
		return portfolioRepository.findByUserId(user.getId())
				.orElseGet(() -> {
					Portfolio portfolio = new Portfolio();
					portfolio.setUser(user);
					return portfolioRepository.save(portfolio);
				});
	}

	// ------------------------------------------------------------------
	// GET /api/portfolios/{userId}
	// ------------------------------------------------------------------

	/**
	 * Das oeffentliche Profil einer Person (§6.1), erreichbar ohne Anmeldung.
	 *
	 * <p><strong>Der 404 haengt am Konto, nicht am Portfolio.</strong> §6.1 nennt
	 * als einzigen Fehlerfall „unbekannter User". Existiert das Konto und fehlt
	 * nur die Profil-Zeile, bleiben Biografie und Avatar leer und die Antwort ist
	 * 200; die Projektliste ist davon ohnehin unabhaengig, weil sie aus einer
	 * Abfrage stammt (§3.2).
	 *
	 * <p><strong>Der Kontostatus spielt keine Rolle.</strong> Auch das Profil
	 * eines deaktivierten Kontos ist abrufbar. Entscheidung aus der
	 * Klaerungsrunde zu KAN-22: die veroeffentlichten Projekte einer deaktivierten
	 * Person bleiben nach §5 sichtbar und fuehren sie weiterhin als Autor:in, und
	 * {@code GET /api/projects?author={id}} ist laut §6.1 ausdruecklich als
	 * oeffentliche Autorenuebersicht gedacht. Ein 404 auf das Profil waere dazu
	 * widerspruechlich. Ein Konto mit offener Registrierung hat noch nichts
	 * veroeffentlicht und liefert schlicht eine leere Liste.
	 *
	 * <p><strong>Ohne {@code hsbEmail}</strong>, ohne Ausnahme (§3.1). Die private
	 * Adresse steht dagegen bewusst darin (§3.2); beides sichert das DTO
	 * strukturell zu.
	 *
	 * @param userId ID aus dem Pfad
	 * @throws ResourceNotFoundException wenn es das Konto nicht gibt (404)
	 */
	@Transactional(readOnly = true)
	public PortfolioResponse publicProfile(UUID userId) {
		User user = userRepository.findById(userId)
				.orElseThrow(() -> ResourceNotFoundException.forUser(userId));

		return PortfolioResponse.from(
				user,
				portfolioRepository.findByUserId(userId).orElse(null),
				projectReadService.publishedCardsOfAuthor(userId));
	}

	// ------------------------------------------------------------------
	// GET /api/portfolio/me
	// ------------------------------------------------------------------

	/**
	 * Das eigene Profil (§6.1).
	 *
	 * <p>Fehlt die Zeile, ist die Antwort <strong>200 mit leeren Feldern</strong>
	 * und kein 404 (§3.2.1). Ein 404 waere hier die falsche Auskunft: das Profil
	 * einer angemeldeten Person gibt es, es ist nur noch nicht gefuellt, und der
	 * Client soll das Formular anzeigen statt einer Fehlerseite.
	 *
	 * <p>Das Feld {@code mayEditPortfolio} kommt aus dem
	 * {@link ProjectPermissionService} und nicht als festes {@code true} in die
	 * Antwort. Heute ist es fuer jede angemeldete Person wahr (§5, Zeile „Eigenes
	 * Portfolio bearbeiten"); sobald §6.7 die erzwungene Passwortaenderung
	 * mitbringt (KAN-28), aendert sich die Regel an genau einer Stelle und nicht
	 * hier.
	 *
	 * @param user angemeldete Person; ohne Token kommt die Anfrage hier nicht an
	 */
	@Transactional(readOnly = true)
	public OwnPortfolioResponse own(AuthenticatedUser user) {
		return OwnPortfolioResponse.from(
				portfolioRepository.findByUserId(user.getId()).orElse(null),
				permissions.mayEditPortfolio(user, user.getId()));
	}

	// ------------------------------------------------------------------
	// PUT /api/portfolio/me
	// ------------------------------------------------------------------

	/**
	 * Aendert Biografie und Avatar des eigenen Profils (§6.1) und legt die Zeile
	 * bei Bedarf an.
	 *
	 * <p><strong>Vollstaendiges Ersetzen:</strong> beide Felder werden mit dem
	 * Body ueberschrieben, ein fehlendes Feld leert also den bisherigen Wert. Zur
	 * Begruendung siehe {@link PortfolioUpdateRequest}.
	 *
	 * <p><strong>Nur das eigene Profil.</strong> Der Endpoint bekommt keine
	 * Benutzerkennung, weder im Pfad noch im Body; geaendert wird die Zeile zur
	 * angemeldeten Person. Ein fremdes Profil zu bearbeiten ist damit kein Recht,
	 * das jemand haben oder nicht haben koennte, sondern etwas, das dieser
	 * Endpoint gar nicht ausdruecken kann. Die Pruefung ueber
	 * {@link ProjectPermissionService#mayEditPortfolio} steht trotzdem davor,
	 * damit die Zeile aus §5 auch im Code eine Entsprechung hat und nicht nur in
	 * der Form des Pfades steckt.
	 *
	 * @param user    angemeldete Person
	 * @param request neuer Zielzustand des Profils
	 * @throws AccessDeniedException wenn die Rechtematrix es nicht zulaesst (403)
	 */
	@Transactional
	public OwnPortfolioResponse update(AuthenticatedUser user, PortfolioUpdateRequest request) {
		boolean mayEdit = permissions.mayEditPortfolio(user, user.getId());
		if (!mayEdit) {
			throw new AccessDeniedException("Das eigene Portfolio darf derzeit nicht bearbeitet werden.");
		}

		// Der Umweg ueber das Konto laeuft nur, wenn die Zeile fehlt, also im
		// Ausnahmefall aus §3.2.1. Im Regelfall kostet der Upsert keine
		// zusaetzliche Abfrage.
		Portfolio portfolio = portfolioRepository.findByUserId(user.getId())
				.orElseGet(() -> createFor(userRepository.findById(user.getId())
						.orElseThrow(() -> ResourceNotFoundException.forUser(user.getId()))));

		portfolio.setBiography(request.biography());
		portfolio.setAvatarUrl(request.avatarUrl());

		return OwnPortfolioResponse.from(portfolioRepository.save(portfolio), mayEdit);
	}
}
