package de.hsbremen.eportfolio.project.dto;

import de.hsbremen.eportfolio.common.enums.Degree;
import de.hsbremen.eportfolio.common.enums.ProjectStatus;
import de.hsbremen.eportfolio.common.enums.ProjectType;
import java.util.List;
import java.util.UUID;

/**
 * Die Filterparameter von {@code GET /api/projects} (§6.1), gebuendelt.
 *
 * <p>Ein Record statt elf Einzelparameter am Service: die Liste waechst mit
 * jedem Filter, den der Contract ergaenzt, und eine Signatur mit elf Argumenten
 * gleichen Typs ist eine Einladung zum Vertauschen. Der Controller bindet die
 * Query-Parameter weiterhin einzeln, damit die OpenAPI-Beschreibung jeden von
 * ihnen erklaeren kann.
 *
 * <p>Seit Contract v43 sind die sieben Sachfilter <strong>mehrwertig</strong>:
 * der Parameter darf wiederholt werden ({@code ?faculty=a&faculty=b}), die
 * Werte desselben Parameters sind ODER-verknuepft, verschiedene Parameter
 * bleiben untereinander UND-verknuepft. {@code q}, {@code status},
 * {@code author} und {@code editor} bleiben einwertig (KAN-64).
 *
 * <p>Jedes Feld ist optional; {@code null} (bei den Listen auch eine leere
 * Liste) heisst „dieser Filter ist nicht gesetzt".
 *
 * @param category     IDs von Kategorien (§3.6)
 * @param faculty      IDs von Fakultaeten (§3.8)
 * @param studyProgram IDs von Studiengaengen (§3.7)
 * @param module       IDs von Modulen (§3.9)
 * @param degree       angestrebte Abschluesse (§2.7)
 * @param type         Projekttypen (§2.6)
 * @param semester     IDs von Semestern (§3.18)
 * @param q            Suchbegriff fuer Titel, Kurzbeschreibung, Namen der
 *                     Autor:in und Schlagwoerter (§6.1, Suchumfang seit
 *                     Contract v81)
 * @param status       Projektstatus (§2.2); wirkt nur innerhalb dessen, was die
 *                     Sichtbarkeitsschranke ohnehin freigibt
 * @param author       ID der Autor:in
 * @param editor       ID einer Redakteur:in oder das Wort {@code me} fuer „Meine
 *                     Reviews"; bleibt als Zeichenkette stehen, weil er beide
 *                     Formen annimmt und erst der Service ihn aufloest
 */
public record ProjectFilterRequest(
		List<UUID> category,
		List<UUID> faculty,
		List<UUID> studyProgram,
		List<UUID> module,
		List<Degree> degree,
		List<ProjectType> type,
		List<UUID> semester,
		String q,
		ProjectStatus status,
		UUID author,
		String editor) {

	/** Der Sonderwert des Parameters {@code editor} aus §6.1. */
	public static final String EDITOR_ME = "me";
}
