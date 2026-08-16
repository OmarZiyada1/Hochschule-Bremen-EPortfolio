package de.hsbremen.eportfolio.masterdata;

import de.hsbremen.eportfolio.common.domain.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;

/**
 * Ein waehlbares Semester (§3.18).
 *
 * <p><strong>Warum eine Stammdatenzeile und kein Enum:</strong> es kommen jedes
 * Jahr zwei Semester hinzu. Als Enum verlangte jedes davon ein Deployment, und
 * die Administrationsseite koennte keines anlegen. Bis Contract v44 stand am
 * Projekt stattdessen ein Freitextfeld; der Filter aus §6.1 vergleicht exakt,
 * also waren &bdquo;WiSe 2025/26&ldquo; und &bdquo;WS 25/26&ldquo; zwei
 * verschiedene Semester und eine verlaessliche Optionsliste war daraus nicht zu
 * bilden.
 *
 * <p><strong>{@code active} ist keine Loeschung</strong> und kein Kontostatus im
 * Sinne von §2.9. Das Feld entscheidet allein darueber, ob das Semester beim
 * Anlegen oder Bearbeiten eines Projekts zur Auswahl steht. Ein deaktiviertes
 * Semester bleibt an den Projekten stehen, die es tragen, und bleibt ein
 * gueltiger Filterwert; sonst fielen veroeffentlichte Projekte aus der Suche,
 * sobald ihr Semester vorbei ist.
 *
 * <p><strong>{@code sortOrder} wird gesetzt und nicht abgeleitet.</strong>
 * Alphabetisch stuende &bdquo;SoSe 2026&ldquo; vor &bdquo;WiSe 2025/26&ldquo;,
 * und aus dem Namen zu rechnen verlangte ein festgeschriebenes Format und
 * braeche bei jeder Sonderform. Die Zahl aendert die Administration ueber
 * {@code POST /api/admin/semesters/{id}/move} (§6.1).
 *
 * <p>Wie die uebrigen Stammdaten ohne Zeitstempel: {@link BaseEntity} bringt nur
 * die {@code id}.
 */
@Entity
public class Semester extends BaseEntity {

	@Column(nullable = false, unique = true, length = 64)
	private String name;

	/**
	 * Steht dieses Semester bei der Projektanlage zur Auswahl?
	 *
	 * <p>Die Vorbelegung entspricht dem, was ein neu angelegtes Semester sein
	 * soll, und deckt sich mit der Spalte: JPA schreibt sie bei jedem Insert
	 * mit, ein Datenbank-Default waere also wirkungslos.
	 */
	@Column(nullable = false)
	private boolean active = true;

	/** Reihenfolge in Liste, Auswahl und Filter; kleiner heisst weiter oben. */
	@Column(nullable = false)
	private int sortOrder;

	protected Semester() {
		// Von JPA benoetigt.
	}

	public String getName() {
		return name;
	}

	public void setName(String name) {
		this.name = name;
	}

	public boolean isActive() {
		return active;
	}

	public void setActive(boolean active) {
		this.active = active;
	}

	public int getSortOrder() {
		return sortOrder;
	}

	public void setSortOrder(int sortOrder) {
		this.sortOrder = sortOrder;
	}
}
