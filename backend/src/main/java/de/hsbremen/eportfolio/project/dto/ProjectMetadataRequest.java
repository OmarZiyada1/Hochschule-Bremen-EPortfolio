package de.hsbremen.eportfolio.project.dto;

import de.hsbremen.eportfolio.common.enums.Degree;
import de.hsbremen.eportfolio.common.enums.ProjectType;
import java.util.List;
import java.util.Set;
import java.util.UUID;

/**
 * Die Felder, die sich {@link ProjectCreateRequest} und
 * {@link ProjectUpdateRequest} teilen: alle Metadaten eines Projekts aus §3.3
 * plus die beiden eingebetteten Listen aus §3.13.1 und §5 (Fussnote ³).
 *
 * <p><strong>Warum ein Interface neben zwei Records:</strong> Anlegen und
 * Aendern schreiben dieselben dreizehn Felder auf dasselbe Projekt und
 * unterscheiden sich nur in einem Punkt, dem {@code version}-Feld aus §6.4, das
 * es beim Anlegen noch nicht geben kann. Ohne diese gemeinsame Sicht muesste der
 * {@code ProjectWriteService} die Uebernahme zweimal schreiben, und die beiden
 * Fassungen liefen bei jeder kuenftigen Feldergaenzung auseinander. Ein
 * gemeinsames Record scheidet aus, weil {@code version} dann entweder beim
 * Anlegen mitgeschickt werden koennte oder beim Aendern nicht erzwingbar waere.
 *
 * <p>Die Records tragen die Bean-Validation; das Interface beschreibt nur die
 * Form. Deshalb steht hier keine Annotation: sie wuerde je nach Aufrufpfad
 * greifen oder nicht und den Eindruck erwecken, die Pruefung haenge am
 * Interface.
 */
public interface ProjectMetadataRequest {

	String title();

	String summary();

	/**
	 * Funktionsbezeichnung der Autor:in im Projekt (§3.3 seit Contract v66),
	 * freiwillig. Die Autor:in bleibt dabei Autor:in und wird kein Mitglied
	 * (§3.13.1); gefehlt hat allein die Moeglichkeit, ihre Rolle zu benennen.
	 */
	String authorRole();

	String coverImageUrl();

	ProjectType projectType();

	Degree degree();

	UUID semesterId();

	UUID categoryId();

	UUID facultyId();

	UUID studyProgramId();

	UUID moduleId();

	Set<String> tags();

	Set<UUID> editorIds();

	List<MemberRequest> members();
}
