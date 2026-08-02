package de.hsbremen.eportfolio.projekt.dto;

import de.hsbremen.eportfolio.common.enums.Abschluss;
import de.hsbremen.eportfolio.common.enums.ProjektStatus;
import de.hsbremen.eportfolio.common.enums.Projekttyp;
import java.util.UUID;

/**
 * Die Filterparameter von {@code GET /api/projekte} (§6.1), gebuendelt.
 *
 * <p>Ein Record statt elf Einzelparameter am Service: die Liste waechst mit
 * jedem Filter, den der Contract ergaenzt, und eine Signatur mit elf Argumenten
 * gleichen Typs ist eine Einladung zum Vertauschen. Der Controller bindet die
 * Query-Parameter weiterhin einzeln, damit die OpenAPI-Beschreibung jeden von
 * ihnen erklaeren kann.
 *
 * <p>Jedes Feld ist optional; {@code null} heisst „dieser Filter ist nicht
 * gesetzt".
 *
 * @param kategorie   ID einer Kategorie (§3.6)
 * @param fakultaet   ID einer Fakultaet (§3.8)
 * @param studiengang ID eines Studiengangs (§3.7)
 * @param modul       ID eines Moduls (§3.9)
 * @param abschluss   (§2.7)
 * @param typ         Projekttyp (§2.6)
 * @param semester    exakte Schreibweise, z. B. „WS 2025/26"
 * @param q           Suchbegriff fuer Titel und Kurzbeschreibung
 * @param status      Projektstatus (§2.2); wirkt nur innerhalb dessen, was die
 *                    Sichtbarkeitsschranke ohnehin freigibt
 * @param autor       ID der Autor:in
 * @param redakteur   ID einer Redakteur:in oder das Wort {@code me} fuer „Meine
 *                    Reviews"; bleibt als Zeichenkette stehen, weil er beide
 *                    Formen annimmt und erst der Service ihn aufloest
 */
public record ProjektFilterAnfrage(
		UUID kategorie,
		UUID fakultaet,
		UUID studiengang,
		UUID modul,
		Abschluss abschluss,
		Projekttyp typ,
		String semester,
		String q,
		ProjektStatus status,
		UUID autor,
		String redakteur) {

	/** Der Sonderwert des Parameters {@code redakteur} aus §6.1. */
	public static final String REDAKTEUR_ICH = "me";
}
