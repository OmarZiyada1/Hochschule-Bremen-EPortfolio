package de.hsbremen.eportfolio.project.dto;

import de.hsbremen.eportfolio.common.enums.Degree;
import de.hsbremen.eportfolio.common.enums.ProjectStatus;
import de.hsbremen.eportfolio.common.enums.ProjectType;
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
 * <p>Jedes Feld ist optional; {@code null} heisst „dieser Filter ist nicht
 * gesetzt".
 *
 * @param category     ID einer Kategorie (§3.6)
 * @param faculty      ID einer Fakultaet (§3.8)
 * @param studyProgram ID eines Studiengangs (§3.7)
 * @param module       ID eines Moduls (§3.9)
 * @param degree       (§2.7)
 * @param type         Projekttyp (§2.6)
 * @param semester     exakte Schreibweise, z. B. „WS 2025/26"
 * @param q            Suchbegriff fuer Titel und Kurzbeschreibung
 * @param status       Projektstatus (§2.2); wirkt nur innerhalb dessen, was die
 *                     Sichtbarkeitsschranke ohnehin freigibt
 * @param author       ID der Autor:in
 * @param editor       ID einer Redakteur:in oder das Wort {@code me} fuer „Meine
 *                     Reviews"; bleibt als Zeichenkette stehen, weil er beide
 *                     Formen annimmt und erst der Service ihn aufloest
 */
public record ProjectFilterRequest(
		UUID category,
		UUID faculty,
		UUID studyProgram,
		UUID module,
		Degree degree,
		ProjectType type,
		String semester,
		String q,
		ProjectStatus status,
		UUID author,
		String editor) {

	/** Der Sonderwert des Parameters {@code editor} aus §6.1. */
	public static final String EDITOR_ME = "me";
}
