package de.hsbremen.eportfolio.projekt;

import de.hsbremen.eportfolio.auth.AngemeldeterBenutzer;
import de.hsbremen.eportfolio.benutzer.User;
import de.hsbremen.eportfolio.common.enums.ProjektStatus;
import de.hsbremen.eportfolio.common.enums.Rolle;
import de.hsbremen.eportfolio.common.enums.UserStatus;
import java.util.Set;
import java.util.UUID;
import org.springframework.stereotype.Service;

/**
 * Bildet die Rechtematrix aus API-Contract §5 und die Uebergangstabelle aus
 * §4.1 ab.
 *
 * <p><strong>Warum ein eigener Service:</strong> Rollenannotationen wie
 * {@code @PreAuthorize("hasRole('REDAKTEUR')")} beantworten nur die Frage „darf
 * diese Rolle so etwas ueberhaupt?". Die Matrix kennt aber die Stufe
 * „(✓) = nur eigene Ressource" — ob jemand <em>dieses</em> Projekt bearbeiten
 * darf, haengt an {@code autorId}, an der Projektmitgliedschaft (§3.13) und an
 * den zugewiesenen Redakteur:innen (§3.3). Das steht in den Daten, nicht in der
 * Rolle, und laesst sich mit einer Annotation nicht ausdruecken. Beide Ebenen
 * werden gebraucht.
 *
 * <p><strong>Konvention:</strong> {@code benutzer == null} bedeutet PUBLIC —
 * nicht angemeldet (§2.1). PUBLIC ist kein Enum-Wert und steht nirgends in der
 * Datenbank.
 *
 * <p><strong>Aufrufkontext:</strong> die Methoden lesen {@code autor},
 * {@code mitglieder} und {@code redakteure} vom uebergebenen Projekt. Diese
 * Beziehungen sind LAZY und {@code open-in-view} ist aus — die Aufrufer muessen
 * also innerhalb einer Transaktion laufen.
 */
@Service
public class ProjektBerechtigungService {

	private final BerechtigungEigenschaften eigenschaften;

	public ProjektBerechtigungService(BerechtigungEigenschaften eigenschaften) {
		this.eigenschaften = eigenschaften;
	}

	// ------------------------------------------------------------------
	// Grundlegende Beziehungen zwischen Benutzer und Projekt
	// ------------------------------------------------------------------

	/** Ersteller:in und Eigentuemer:in des Projekts ({@code autorId}, §3.3). */
	public boolean istAutor(AngemeldeterBenutzer benutzer, Projekt projekt) {
		if (!angemeldet(benutzer) || projekt.getAutor() == null) {
			return false;
		}
		return benutzer.getId().equals(projekt.getAutor().getId());
	}

	/** Co-Autor:in bzw. Mitwirkende:r (§3.13). */
	public boolean istMitglied(AngemeldeterBenutzer benutzer, Projekt projekt) {
		if (!angemeldet(benutzer)) {
			return false;
		}
		return projekt.getMitglieder().stream()
				.map(Projektmitglied::getUser)
				.anyMatch(mitglied -> mitglied != null && benutzer.getId().equals(mitglied.getId()));
	}

	/**
	 * „Projektseite" im Sinne von §2.4 und §3.13: Autor:in plus
	 * Projektmitglieder — im Gegensatz zu Redaktion und Admin.
	 */
	public boolean istProjektseite(AngemeldeterBenutzer benutzer, Projekt projekt) {
		return istAutor(benutzer, projekt) || istMitglied(benutzer, projekt);
	}

	/**
	 * Betreuende:r Redakteur:in dieses Projekts (Join-Tabelle
	 * {@code projekt_redakteur}, §3.3). Nicht zu verwechseln mit der System-
	 * Rolle REDAKTEUR: die sagt nur, dass jemand ueberhaupt Redakteur:in ist,
	 * diese Methode, dass er/sie fuer <em>dieses</em> Projekt zustaendig ist.
	 */
	public boolean istZugewiesenerRedakteur(AngemeldeterBenutzer benutzer, Projekt projekt) {
		if (!angemeldet(benutzer)) {
			return false;
		}
		Set<User> redakteure = projekt.getRedakteure();
		return redakteure.stream()
				.anyMatch(redakteur -> redakteur != null && benutzer.getId().equals(redakteur.getId()));
	}

	// ------------------------------------------------------------------
	// §5 — Lesen
	// ------------------------------------------------------------------

	/**
	 * Zeile „Veroeffentlichte Projekte lesen" (alle ✓) und „Nicht-
	 * veroeffentlichte Projekte lesen" (PUBLIC ✗, STUDIERENDE (✓), REDAKTEUR ✓,
	 * ADMIN ✓).
	 */
	public boolean darfProjektLesen(AngemeldeterBenutzer benutzer, Projekt projekt) {
		if (projekt.getStatus() == ProjektStatus.VEROEFFENTLICHT) {
			return true;
		}
		if (!angemeldet(benutzer)) {
			return false;
		}
		// REDAKTEUR steht in der Matrix mit vollem Haken, nicht mit (✓):
		// die Redaktion darf auch nicht zugewiesene Projekte einsehen.
		return benutzer.hatRolle(Rolle.REDAKTEUR, Rolle.ADMIN) || istProjektseite(benutzer, projekt);
	}

	// ------------------------------------------------------------------
	// §5 — Anlegen und Bearbeiten
	// ------------------------------------------------------------------

	/** Zeile „Projekt anlegen": alle angemeldeten Rollen ✓. */
	public boolean darfProjektAnlegen(AngemeldeterBenutzer benutzer) {
		return angemeldet(benutzer);
	}

	/**
	 * Zeile „Projekt-Inhalt bearbeiten": STUDIERENDE (✓), REDAKTEUR (✓),
	 * ADMIN siehe OF 2.
	 *
	 * <p>Vorgeschaltet gilt die harte Regel aus §4.1: Inhalte sind nur in
	 * {@code ENTWURF} und {@code UEBERARBEITUNG} aenderbar. In den uebrigen
	 * Status ist die Bearbeitung fuer <em>alle</em> gesperrt (→ 409
	 * {@code PROJEKT_STATUS_NICHT_BEARBEITBAR}), unabhaengig von der Rolle.
	 */
	public boolean darfInhaltBearbeiten(AngemeldeterBenutzer benutzer, Projekt projekt) {
		if (!angemeldet(benutzer) || !istInhaltlichBearbeitbar(projekt)) {
			return false;
		}
		if (istProjektseite(benutzer, projekt)) {
			return true;
		}
		if (benutzer.hatRolle(Rolle.REDAKTEUR)) {
			// (✓) = nur eigene Ressource, hier: das zugewiesene Projekt.
			return istZugewiesenerRedakteur(benutzer, projekt);
		}
		if (benutzer.hatRolle(Rolle.ADMIN)) {
			// OF 2, Default false: Admin aendert Status, nicht fremde Inhalte.
			return eigenschaften.adminDarfFremdeInhalteBearbeiten();
		}
		return false;
	}

	/** §4.1: Inhaltsbearbeitung nur in ENTWURF und UEBERARBEITUNG. */
	public boolean istInhaltlichBearbeitbar(Projekt projekt) {
		return projekt.getStatus() == ProjektStatus.ENTWURF
				|| projekt.getStatus() == ProjektStatus.UEBERARBEITUNG;
	}

	/**
	 * Zeile „Projekt loeschen" nach §6.1: Autor:in nur im Entwurf, Admin
	 * jederzeit.
	 */
	public boolean darfProjektLoeschen(AngemeldeterBenutzer benutzer, Projekt projekt) {
		if (!angemeldet(benutzer)) {
			return false;
		}
		if (benutzer.hatRolle(Rolle.ADMIN)) {
			return true;
		}
		return istAutor(benutzer, projekt) && projekt.getStatus() == ProjektStatus.ENTWURF;
	}

	// ------------------------------------------------------------------
	// §4.1 — Statusuebergaenge
	// ------------------------------------------------------------------

	/**
	 * „Einreichen": ENTWURF/UEBERARBEITUNG → EINGEREICHT durch die Autor:in.
	 *
	 * <p>ADMIN ist in der Matrix ausdruecklich mit ✗ eingetragen, auch wenn er
	 * das Projekt selbst angelegt haette.
	 */
	public boolean darfEinreichen(AngemeldeterBenutzer benutzer, Projekt projekt) {
		if (!angemeldet(benutzer) || benutzer.hatRolle(Rolle.ADMIN)) {
			return false;
		}
		if (projekt.getStatus() != ProjektStatus.ENTWURF
				&& projekt.getStatus() != ProjektStatus.UEBERARBEITUNG) {
			return false;
		}
		// §4.1 und §6.1 nennen beide ausdruecklich die Autor:in, nicht die
		// Projektseite. Mitglieder duerfen mitschreiben, aber nicht einreichen.
		return istAutor(benutzer, projekt);
	}

	/**
	 * „Genehmigen": EINGEREICHT → GENEHMIGT durch REDAKTEUR (Fussnote ¹) oder
	 * ADMIN.
	 */
	public boolean darfGenehmigen(AngemeldeterBenutzer benutzer, Projekt projekt) {
		return darfRedaktionellEntscheiden(benutzer, projekt, ProjektStatus.EINGEREICHT);
	}

	/**
	 * „Veroeffentlichen": GENEHMIGT → VEROEFFENTLICHT durch REDAKTEUR
	 * (Fussnote ¹) oder ADMIN.
	 */
	public boolean darfVeroeffentlichen(AngemeldeterBenutzer benutzer, Projekt projekt) {
		return darfRedaktionellEntscheiden(benutzer, projekt, ProjektStatus.GENEHMIGT);
	}

	/**
	 * „Zur Ueberarbeitung zurueckgeben": EINGEREICHT/GENEHMIGT/VEROEFFENTLICHT
	 * → UEBERARBEITUNG durch REDAKTEUR oder ADMIN.
	 *
	 * <p>Hier steht in der Matrix kein Fussnotenzeichen ¹ — das
	 * Vier-Augen-Prinzip greift also nicht. Das ist plausibel: eine Ruecknahme
	 * ist keine Freigabe und niemand verschafft sich damit einen Vorteil.
	 */
	public boolean darfZurueckgeben(AngemeldeterBenutzer benutzer, Projekt projekt) {
		if (!angemeldet(benutzer) || !benutzer.hatRolle(Rolle.REDAKTEUR, Rolle.ADMIN)) {
			return false;
		}
		return projekt.getStatus() == ProjektStatus.EINGEREICHT
				|| projekt.getStatus() == ProjektStatus.GENEHMIGT
				|| projekt.getStatus() == ProjektStatus.VEROEFFENTLICHT;
	}

	/**
	 * Gemeinsame Pruefung fuer Genehmigen und Veroeffentlichen inklusive
	 * Vier-Augen-Prinzip.
	 *
	 * <p><strong>Zur Reichweite des Vier-Augen-Prinzips:</strong> Fussnote ¹
	 * der Matrix haengt ausschliesslich an den REDAKTEUR-Zellen; die
	 * ADMIN-Spalte traegt einen unmarkierten Haken. Deshalb greift die Sperre
	 * hier nur fuer REDAKTEUR. Ob ein Admin sein eigenes Projekt freigeben
	 * koennen soll, ist mit den Pruefern zu klaeren (siehe Rueckmeldung zu
	 * KAN-5).
	 */
	private boolean darfRedaktionellEntscheiden(AngemeldeterBenutzer benutzer, Projekt projekt,
			ProjektStatus erwarteterStatus) {
		if (!angemeldet(benutzer) || projekt.getStatus() != erwarteterStatus) {
			return false;
		}
		if (benutzer.hatRolle(Rolle.ADMIN)) {
			return true;
		}
		if (!benutzer.hatRolle(Rolle.REDAKTEUR)) {
			return false;
		}
		if (eigenschaften.vierAugenPrinzip() && istAutor(benutzer, projekt)) {
			return false;
		}
		return true;
	}

	// ------------------------------------------------------------------
	// §5 — Kommentare (§2.3, §2.4)
	// ------------------------------------------------------------------

	/** Zeile „ANTWORT-Kommentar erstellen": STUDIERENDE (✓), REDAKTEUR ✓, ADMIN ✓. */
	public boolean darfAntwortKommentarErstellen(AngemeldeterBenutzer benutzer, Projekt projekt) {
		if (!angemeldet(benutzer)) {
			return false;
		}
		return benutzer.hatRolle(Rolle.REDAKTEUR, Rolle.ADMIN) || istProjektseite(benutzer, projekt);
	}

	/**
	 * Zeile „NOTIZ-Kommentar erstellen/lesen": nur REDAKTEUR und ADMIN.
	 * Interne Notizen sind fuer Studierende unsichtbar (§2.3) — die Liste in
	 * {@code GET /projekte/{id}/kommentare} muss serverseitig danach filtern.
	 */
	public boolean darfNotizVerwenden(AngemeldeterBenutzer benutzer) {
		return angemeldet(benutzer) && benutzer.hatRolle(Rolle.REDAKTEUR, Rolle.ADMIN);
	}

	/** Zeile „AENDERUNG-Kommentar erstellen": nur REDAKTEUR und ADMIN. */
	public boolean darfAenderungKommentarErstellen(AngemeldeterBenutzer benutzer) {
		return angemeldet(benutzer) && benutzer.hatRolle(Rolle.REDAKTEUR, Rolle.ADMIN);
	}

	/**
	 * Zeile „AENDERUNG-Status setzen": STUDIERENDE (✓)², REDAKTEUR ✓, ADMIN ✓.
	 * Fussnote ²: die Projektseite schaltet einen an sie gerichteten
	 * Aenderungswunsch auf erledigt — nicht die Redaktion (§2.4).
	 */
	public boolean darfAenderungStatusSetzen(AngemeldeterBenutzer benutzer, Projekt projekt) {
		if (!angemeldet(benutzer)) {
			return false;
		}
		return benutzer.hatRolle(Rolle.REDAKTEUR, Rolle.ADMIN) || istProjektseite(benutzer, projekt);
	}

	// ------------------------------------------------------------------
	// §5 — Dateien, Reaktionen, Portfolio
	// ------------------------------------------------------------------

	/** Zeile „Datei hochladen": STUDIERENDE (✓), REDAKTEUR (✓), ADMIN ✓. */
	public boolean darfDateiHochladen(AngemeldeterBenutzer benutzer, Projekt projekt) {
		if (!angemeldet(benutzer)) {
			return false;
		}
		if (benutzer.hatRolle(Rolle.ADMIN)) {
			return true;
		}
		if (benutzer.hatRolle(Rolle.REDAKTEUR)) {
			return istProjektseite(benutzer, projekt) || istZugewiesenerRedakteur(benutzer, projekt);
		}
		return istProjektseite(benutzer, projekt);
	}

	/**
	 * Zeile „Datei lesen" — Sichtbarkeit richtet sich nach dem zugehoerigen
	 * Projekt (§3.15). Die Entity {@code Datei} gibt es noch nicht; sobald sie
	 * existiert, laesst sich diese Methode direkt darauf anwenden.
	 */
	public boolean darfDateiLesen(AngemeldeterBenutzer benutzer, Projekt projekt) {
		return darfProjektLesen(benutzer, projekt);
	}

	/**
	 * Zeile „Reaktion geben": alle angemeldeten Rollen ✓, aber nur auf
	 * veroeffentlichte Projekte (§3.10).
	 */
	public boolean darfReagieren(AngemeldeterBenutzer benutzer, Projekt projekt) {
		return angemeldet(benutzer) && projekt.getStatus() == ProjektStatus.VEROEFFENTLICHT;
	}

	/** Zeile „Eigenes Portfolio bearbeiten": alle Rollen (✓) — nur das eigene. */
	public boolean darfPortfolioBearbeiten(AngemeldeterBenutzer benutzer, UUID portfolioBesitzerId) {
		return angemeldet(benutzer) && benutzer.getId().equals(portfolioBesitzerId);
	}

	// ------------------------------------------------------------------
	// §5 — Zuweisung, Top-10, Administration
	// ------------------------------------------------------------------

	/**
	 * Zeile „Redakteur:innen einem Projekt zuweisen": STUDIERENDE (✓)³,
	 * REDAKTEUR ✗, ADMIN ✓.
	 *
	 * <p>Fussnote ³ meint die Auswahl der zustaendigen Redaktion beim Anlegen
	 * — deshalb hier auf den eigenen Entwurf beschraenkt. Achtung: §6.1 fuehrt
	 * {@code PUT /projekte/{id}/redakteure} als reinen ADMIN-Endpoint. Beides
	 * passt nur zusammen, wenn die studentische Auswahl ueber
	 * {@code POST /projekte} laeuft und nicht ueber diesen Endpoint. Siehe
	 * Rueckmeldung zu KAN-5.
	 */
	public boolean darfRedakteureZuweisen(AngemeldeterBenutzer benutzer, Projekt projekt) {
		if (!angemeldet(benutzer)) {
			return false;
		}
		if (benutzer.hatRolle(Rolle.ADMIN)) {
			return true;
		}
		if (benutzer.hatRolle(Rolle.REDAKTEUR)) {
			return false;
		}
		return istAutor(benutzer, projekt) && projekt.getStatus() == ProjektStatus.ENTWURF;
	}

	/** Zeile „Projekt fuer Top-10 nominieren": REDAKTEUR ✓, ADMIN ✓. */
	public boolean darfNominieren(AngemeldeterBenutzer benutzer) {
		return angemeldet(benutzer) && benutzer.hatRolle(Rolle.REDAKTEUR, Rolle.ADMIN);
	}

	/** Zeile „Top-10 kuratieren": nur ADMIN. */
	public boolean darfTop10Kuratieren(AngemeldeterBenutzer benutzer) {
		return istAdmin(benutzer);
	}

	/** Zeile „User verwalten (inkl. deaktivieren)": nur ADMIN. */
	public boolean darfUserVerwalten(AngemeldeterBenutzer benutzer) {
		return istAdmin(benutzer);
	}

	/** Zeile „Kategorien / Studiengaenge / Module / Fakultaeten verwalten": nur ADMIN. */
	public boolean darfStammdatenVerwalten(AngemeldeterBenutzer benutzer) {
		return istAdmin(benutzer);
	}

	/** Zeile „Admin-Dashboard": nur ADMIN. */
	public boolean darfAdminDashboardSehen(AngemeldeterBenutzer benutzer) {
		return istAdmin(benutzer);
	}

	// ------------------------------------------------------------------

	private boolean istAdmin(AngemeldeterBenutzer benutzer) {
		return angemeldet(benutzer) && benutzer.hatRolle(Rolle.ADMIN);
	}

	/**
	 * Angemeldet heisst: Benutzer vorhanden <em>und</em> {@code status = AKTIV}
	 * (§2.9, Hinweis unter der Matrix). Der Filter laesst nicht-aktive Konten
	 * zwar gar nicht erst durch; die Pruefung steht hier trotzdem, damit der
	 * Service auch fuer sich genommen richtig entscheidet.
	 */
	private boolean angemeldet(AngemeldeterBenutzer benutzer) {
		return benutzer != null && benutzer.getStatus() == UserStatus.AKTIV;
	}
}
