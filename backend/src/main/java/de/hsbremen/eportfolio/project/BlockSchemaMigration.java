package de.hsbremen.eportfolio.project;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import de.hsbremen.eportfolio.common.enums.BlockType;
import java.util.List;

/**
 * Bringt gespeicherte Blockinhalte einer aelteren Schemaversion beim Lesen in
 * die aktuelle Form (API-Contract §2.10).
 *
 * <p><strong>Warum es diese Klasse gibt.</strong> §2.10 verlangt woertlich:
 * „Bei jeder Aenderung der Node-Typen wird die Version erhoeht und eine
 * Migrationsfunktion ergaenzt." Contract v51 hat mehrere Attributformen
 * geaendert, und KAN-72 weist die alten Formen auf dem Schreibweg jetzt aktiv
 * ab. Ohne diese Klasse waere ein Dokument aus v50 nicht mehr speicherbar:
 * {@code PUT /api/projects/{id}/blocks} prueft die <em>gesamte</em> Liste,
 * bevor es die erste Zeile anfasst, also braechte ein einziger alter
 * Medienblock jeden weiteren Autosave des ganzen Projekts zum Scheitern.
 *
 * <p><strong>Migriert wird beim Lesen, nicht beim Schreiben.</strong> Die
 * Datenbankzeile bleibt unangetastet: der Lesepfad laeuft in einer
 * {@code readOnly}-Transaktion, ein Rueckschreiben erhoehte
 * {@code Project.version} ohne Zutun der Autor:in und liefe dem Optimistic
 * Locking aus §6.4 in die Quere. Der Editor bekommt die neue Form, schickt sie
 * beim naechsten Speichern mit {@link #CURRENT_VERSION} zurueck, und erst
 * dadurch steht sie auch in der Datenbank. Das ist zugleich der Unterschied zur
 * Regel „der Server schreibt nicht in das Dokument" (§3.4): dort geht es um den
 * Schreibweg, der keine Vorgabewerte ergaenzt, hier um das Uebersetzen eines
 * alten Formats.
 *
 * <p><strong>Der Knoten wird kopiert.</strong> {@code Block.content} haengt in
 * derselben Transaktion an der Entity; eine Aenderung am Original meldete
 * Hibernate als schmutzig und schriebe sie zurueck, also genau das, was hier
 * nicht geschehen soll.
 *
 * <p><strong>Getragene Grenze beim Alternativtext.</strong> Die alte Galerie
 * fuehrte nur Datei-IDs, ein Alternativtext je Bild existierte nicht und laesst
 * sich nicht erfinden. Die Migration setzt deshalb den leeren {@code alt}, den
 * §2.5 als „ausdruecklich schmueckend" liest. Das ist die einzige Form, die
 * durch die Validierung geht; fachlich richtig wird sie erst, wenn die
 * Autor:in die Galerie im Editor wieder anfasst.
 */
public final class BlockSchemaMigration {

	/**
	 * Aktuelle Version des Editor-Schemas (§2.10).
	 *
	 * <p><strong>1 auf 2 mit Contract v51:</strong> {@code AUDIO.src} ist
	 * entfallen, {@code GALLERY.fileIds} heisst jetzt {@code items} und traegt
	 * Objekte statt blosser IDs, und {@code HEADING.level} kannte die Ebene 1
	 * nicht mehr.
	 *
	 * <p><strong>2 auf 3 mit Contract v63:</strong> {@code HEADING.level} deckt
	 * wieder 1 bis 6 ab, und die Renderabbildung ist um eine Stufe versetzt.
	 * Dieselbe Zahl bedeutet damit etwas anderes als vorher, weshalb es ohne
	 * Migration nicht abgeht: ein gespeichertes {@code level: 2} war bis v62
	 * die oberste Zwischenueberschrift und waere ab v63 die zweite, jeder
	 * vorhandene Beitrag rutschte also eine Stufe nach unten.
	 */
	public static final int CURRENT_VERSION = 3;

	private BlockSchemaMigration() {
		// Nur statische Funktionen, kein Zustand.
	}

	/**
	 * Der Inhalt in der aktuellen Schemaversion.
	 *
	 * <p>Ist nichts zu tun, kommt der eingereichte Knoten unveraendert zurueck;
	 * nur wenn wirklich migriert wird, entsteht eine Kopie. Der haeufigste Fall
	 * ist damit kostenlos.
	 *
	 * @param type        Blocktyp, weil die Migration je Typ verschieden ist
	 * @param content     gespeicherter ProseMirror-Knoten
	 * @param fromVersion {@code Block.schemaVersion} der gespeicherten Zeile
	 */
	public static JsonNode toCurrent(BlockType type, JsonNode content, int fromVersion) {
		if (fromVersion >= CURRENT_VERSION || content == null || !content.isObject()) {
			return content;
		}
		JsonNode migrated = content;
		if (fromVersion < 2) {
			migrated = migrateOneToTwo(type, migrated);
		}
		if (fromVersion < 3) {
			migrated = migrateTwoToThree(type, migrated);
		}
		return migrated;
	}

	/**
	 * Version 2 nach 3, also die Ebenenumstellung aus Contract v63 (§2.5).
	 *
	 * <p><strong>Was hier passiert und warum genau das.</strong> Bis v62
	 * reichte {@code HEADING.level} von 2 bis 3, und die Anzeige gab die Ebene
	 * unveraendert als {@code h2} beziehungsweise {@code h3} aus. Seit v63
	 * reicht sie von 1 bis 6, und die Anzeige schiebt sie um eine Stufe: aus
	 * Ebene 1 wird {@code h2}. Bliebe der gespeicherte Wert stehen, saehe eine
	 * bestehende oberste Zwischenueberschrift ({@code level: 2}) danach wie
	 * ein {@code h3} aus, also eine Stufe kleiner als am Tag ihrer Entstehung.
	 * Die Abbildung 2 nach 1 und 3 nach 2 haelt das Aussehen jedes vorhandenen
	 * Beitrags unveraendert.
	 *
	 * <p><strong>Die Kette bleibt zusammenhaengend.</strong>
	 * {@link #migrateOneToTwo} hebt ein vor v51 geschriebenes {@code level: 1}
	 * auf 2, dieser Schritt macht daraus wieder 1, und das ist der Sache nach
	 * dieselbe oberste Zwischenueberschrift. Ein Dokument der Version 1 laeuft
	 * also durch beide Schritte und landet richtig.
	 *
	 * <p>Alles ausserhalb von {@code HEADING} bleibt unberuehrt, und innerhalb
	 * bleibt jedes andere Attribut stehen. Ein {@code level} ausserhalb von 2
	 * und 3 wird nicht angefasst: es kann aus keinem gueltigen Bestand
	 * stammen, und ein geratener Ersatzwert waere schlechter als der Wert, den
	 * die anschliessende Pruefung ohnehin mit 400 abweist.
	 */
	private static JsonNode migrateTwoToThree(BlockType type, JsonNode content) {
		if (type != BlockType.HEADING) {
			return content;
		}
		JsonNode level = content.path("attrs").path("level");
		if (!level.isIntegralNumber() || level.asInt() < 2 || level.asInt() > 3) {
			return content;
		}
		ObjectNode migrated = (ObjectNode) content.deepCopy();
		((ObjectNode) migrated.path("attrs")).put("level", level.asInt() - 1);
		return migrated;
	}

	/**
	 * Version 1 nach 2, also die Formaenderungen aus Contract v51 (§2.5).
	 *
	 * <p>Was §2.5 nicht geaendert hat, bleibt unberuehrt: Marks, Texte und alle
	 * uebrigen Attribute gehen unveraendert durch. Insbesondere wird kein
	 * Vorgabewert ergaenzt; {@code IMAGE.width} und {@code GALLERY.columns}
	 * bleiben abwesend, wenn sie abwesend waren.
	 */
	private static JsonNode migrateOneToTwo(BlockType type, JsonNode content) {
		ObjectNode migrated = (ObjectNode) content.deepCopy();
		JsonNode attrsNode = migrated.path("attrs");
		if (!attrsNode.isObject()) {
			return migrated;
		}
		ObjectNode attrs = (ObjectNode) attrsNode;

		switch (type) {
			case HEADING -> {
				// Die Ebene 1 der Seite ist seit v51 der Projekttitel (§3.3);
				// eine gespeicherte h1 wird zur obersten Zwischenueberschrift.
				if (attrs.path("level").isIntegralNumber() && attrs.path("level").asInt() < 2) {
					attrs.put("level", 2);
				}
			}
			case GALLERY -> {
				// fileIds heisst items und traegt Objekte, weil der alte Name
				// die Elementform falsch beschriebe (§2.5).
				JsonNode fileIds = attrs.path("fileIds");
				if (fileIds.isArray() && !attrs.has("items")) {
					ArrayNode items = attrs.putArray("items");
					for (JsonNode fileId : fileIds) {
						if (fileId.isTextual()) {
							items.addObject()
									.put("fileId", fileId.asText())
									.put("alt", "");
						}
					}
				}
				attrs.remove("fileIds");
			}
			// AUDIO kennt seit v51 nur die hochgeladene Datei; eine gespeicherte
			// Fremdadresse faellt weg, statt weiter ausgeliefert zu werden (§2.5).
			case AUDIO -> attrs.remove("src");
			// VIDEO speichert keine URL (§2.5): eine aus der Zeit vor der
			// Pruefung stammende Adresse verschwindet mit der Migration.
			case VIDEO -> attrs.remove(List.of("src", "embedUrl"));
			default -> { /* Die uebrigen Typen haben sich mit v51 nicht geaendert. */ }
		}
		return migrated;
	}
}
