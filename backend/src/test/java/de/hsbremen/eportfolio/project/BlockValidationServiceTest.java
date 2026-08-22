package de.hsbremen.eportfolio.project;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import de.hsbremen.eportfolio.common.enums.BlockType;
import de.hsbremen.eportfolio.common.error.ErrorCodes;
import de.hsbremen.eportfolio.common.error.ValidationException;
import java.util.EnumMap;
import java.util.Map;
import java.util.function.Consumer;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.junit.jupiter.params.provider.ValueSource;

/**
 * Prueft die Blockvalidierung aus API-Contract §2.5 ohne Datenbank und ohne
 * Spring-Kontext: alle vierzehn Blocktypen in gueltiger Form, und je Regel ein
 * Verstoss mit dem Fehlercode, den §6.2 dafuer vorsieht.
 *
 * <p><strong>Warum die gueltigen Beispiele hier stehen und nicht nur im
 * Integrationstest.</strong> {@link #VALID_CONTENT} ist zugleich die
 * Beispielsammlung, gegen die der Round-Trip in {@code BlockIntegrationTest}
 * laeuft. An einer Stelle gepflegt, kann sie zwischen den beiden Tests nicht
 * auseinanderlaufen.
 *
 * <p>Mit KAN-72 ist die Sammlung auf Contract v51 gehoben: {@code GALLERY}
 * fuehrt {@code items} statt {@code fileIds}, und die uebrigen Beispiele
 * bleiben gueltig. Dazu kommen die Marks, die der Server bis dahin ueberhaupt
 * nicht ansah (Befund C3).
 */
class BlockValidationServiceTest {

	private static final ObjectMapper MAPPER = new ObjectMapper();

	private static final String FILE_ID = "3f1c9a52-0c1e-4a1f-9a3e-2f1d5c7b8e10";

	private static final String OTHER_FILE_ID = "7b2e4d61-9a8c-4f02-8d55-6c0b3a9e1d24";

	/**
	 * Ein gueltiger ProseMirror-Knoten je Blocktyp (§2.5), einschliesslich der
	 * typabhaengigen Pflicht-{@code attrs}.
	 */
	public static final Map<BlockType, JsonNode> VALID_CONTENT = validContent();

	private final BlockValidationService service = new BlockValidationService();

	@ParameterizedTest
	@EnumSource(BlockType.class)
	@DisplayName("Jeder der vierzehn Blocktypen aus §2.5 hat eine gueltige Form")
	void everyBlockTypeHasAValidForm(BlockType type) {
		assertThatCode(() -> service.validate(type, VALID_CONTENT.get(type), 0))
				.doesNotThrowAnyException();
	}

	@Test
	@DisplayName("Die Beispielsammlung deckt alle Enum-Werte ab")
	void sampleCoversEveryEnumValue() {
		assertThat(VALID_CONTENT).hasSize(BlockType.values().length);
	}

	// ------------------------------------------------------------------
	// 1. Attribute des Wurzelknotens (§2.5)
	// ------------------------------------------------------------------

	@Nested
	@DisplayName("HEADING: Ebenen 1 bis 6, Ausrichtung ohne Blocksatz (§2.5 seit v63)")
	class Heading {

		@ParameterizedTest
		@ValueSource(ints = { 1, 2, 3, 4, 5, 6 })
		@DisplayName("Die sechs Ebenen sind gueltig")
		void allSixLevels(int level) {
			assertThatCode(() -> service.validate(BlockType.HEADING, heading(level), 0))
					.doesNotThrowAnyException();
		}

		@ParameterizedTest
		@ValueSource(ints = { 0, 7 })
		@DisplayName("Ebene 0 und 7 ergeben 400 BLOCK_CONTENT_INVALID")
		void levelsOutsideTheRange(int level) {
			expect(ErrorCodes.BLOCK_CONTENT_INVALID, BlockType.HEADING, heading(level));
		}

		@Test
		@DisplayName("Die Meldung nennt den Projekttitel als Ebene 1 der Seite")
		void messageNamesTheProjectTitle() {
			assertThatThrownBy(() -> service.validate(BlockType.HEADING, heading(7), 0))
					.hasMessageContaining("Projekttitel");
		}

		@ParameterizedTest
		@ValueSource(strings = { "left", "center", "right" })
		@DisplayName("Drei Ausrichtungen sind gueltig")
		void allowedAlignments(String textAlign) {
			assertThatCode(() -> service.validate(BlockType.HEADING,
					headingAligned(2, textAlign), 0)).doesNotThrowAnyException();
		}

		@Test
		@DisplayName("Blocksatz an der Ueberschrift ergibt 400")
		void justifyIsRejected() {
			expect(ErrorCodes.BLOCK_CONTENT_INVALID, BlockType.HEADING,
					headingAligned(2, "justify"));
		}

		@Test
		@DisplayName("Blocksatz am Absatz bleibt gueltig")
		void justifyStaysAllowedOnParagraph() {
			JsonNode paragraph = node("paragraph",
					MAPPER.createObjectNode().put("textAlign", "justify"));
			assertThatCode(() -> service.validate(BlockType.TEXT, paragraph, 0))
					.doesNotThrowAnyException();
		}

		@Test
		@DisplayName("Fehlendes textAlign ist gueltig: der Server ergaenzt nichts")
		void alignmentMayBeAbsent() {
			assertThatCode(() -> service.validate(BlockType.HEADING, heading(3), 0))
					.doesNotThrowAnyException();
		}

		@Test
		@DisplayName("Ein ausdrueckliches null gilt als nicht gesetzt")
		void explicitNullIsTreatedAsAbsent() {
			ObjectNode attrs = MAPPER.createObjectNode().put("level", 2);
			attrs.putNull("textAlign");
			assertThatCode(() -> service.validate(BlockType.HEADING, node("heading", attrs), 0))
					.doesNotThrowAnyException();
		}

		private JsonNode heading(int level) {
			return node("heading", MAPPER.createObjectNode().put("level", level));
		}

		private JsonNode headingAligned(int level, String textAlign) {
			return node("heading", MAPPER.createObjectNode()
					.put("level", level)
					.put("textAlign", textAlign));
		}
	}

	@Nested
	@DisplayName("IMAGE: fileId als UUID, width aus 100, 75 und 50")
	class Image {

		@ParameterizedTest
		@ValueSource(ints = { 100, 75, 50 })
		@DisplayName("Die drei Stufen sind gueltig")
		void allowedWidths(int width) {
			assertThatCode(() -> service.validate(BlockType.IMAGE, image(attrs -> attrs
					.put("width", width)), 0)).doesNotThrowAnyException();
		}

		@Test
		@DisplayName("Fehlende width ist gueltig: der Server ergaenzt nichts")
		void widthMayBeAbsent() {
			assertThatCode(() -> service.validate(BlockType.IMAGE, image(attrs -> {
			}), 0)).doesNotThrowAnyException();
		}

		@Test
		@DisplayName("80 ergibt 400")
		void widthOutsideTheThreeSteps() {
			expect(ErrorCodes.BLOCK_CONTENT_INVALID, BlockType.IMAGE,
					image(attrs -> attrs.put("width", 80)));
		}

		@Test
		@DisplayName("Die Zeichenkette \"100\" ergibt 400: der Wert ist eine Zahl")
		void widthAsString() {
			expect(ErrorCodes.BLOCK_CONTENT_INVALID, BlockType.IMAGE,
					image(attrs -> attrs.put("width", "100")));
		}

		@Test
		@DisplayName("IMAGE ohne fileId")
		void imageWithoutFileId() {
			expect(ErrorCodes.BLOCK_CONTENT_INVALID, BlockType.IMAGE,
					node("imageBlock", MAPPER.createObjectNode().put("alt", "ohne Datei")));
		}

		@Test
		@DisplayName("fileId ohne UUID-Form ergibt 400")
		void fileIdIsNotAUuid() {
			expect(ErrorCodes.BLOCK_CONTENT_INVALID, BlockType.IMAGE,
					node("imageBlock", MAPPER.createObjectNode().put("fileId", "keine-uuid")));
		}

		private JsonNode image(Consumer<ObjectNode> extra) {
			ObjectNode attrs = MAPPER.createObjectNode()
					.put("fileId", FILE_ID)
					.put("alt", "Aufbau der Navigation");
			extra.accept(attrs);
			return node("imageBlock", attrs);
		}
	}

	@Nested
	@DisplayName("GALLERY: items statt fileIds, alt je Bild, columns 2 oder 3")
	class Gallery {

		@Test
		@DisplayName("Zwei Eintraege mit fileId und alt sind gueltig")
		void twoItems() {
			assertThatCode(() -> service.validate(BlockType.GALLERY,
					gallery(items(item(FILE_ID, "Startbildschirm"),
							item(OTHER_FILE_ID, "Detailansicht"))), 0))
					.doesNotThrowAnyException();
		}

		@Test
		@DisplayName("Leeres alt ist gueltig: die ausdrueckliche Aussage \"schmueckend\"")
		void emptyAltIsDecorative() {
			assertThatCode(() -> service.validate(BlockType.GALLERY,
					gallery(items(item(FILE_ID, ""))), 0)).doesNotThrowAnyException();
		}

		@Test
		@DisplayName("Fehlendes alt ergibt 400: ein vergessener Alternativtext")
		void missingAltIsAnError() {
			ObjectNode item = MAPPER.createObjectNode().put("fileId", FILE_ID);
			expect(ErrorCodes.BLOCK_CONTENT_INVALID, BlockType.GALLERY,
					gallery(items(item)));
		}

		@Test
		@DisplayName("Fehlendes fileId ergibt 400")
		void missingFileId() {
			ObjectNode item = MAPPER.createObjectNode().put("alt", "ohne Datei");
			expect(ErrorCodes.BLOCK_CONTENT_INVALID, BlockType.GALLERY,
					gallery(items(item)));
		}

		@Test
		@DisplayName("fileId ohne UUID-Form ergibt 400")
		void fileIdIsNotAUuid() {
			expect(ErrorCodes.BLOCK_CONTENT_INVALID, BlockType.GALLERY,
					gallery(items(item("keine-uuid", "Erstes Bild"))));
		}

		@Test
		@DisplayName("Leeres Array ergibt 400")
		void emptyItems() {
			expect(ErrorCodes.BLOCK_CONTENT_INVALID, BlockType.GALLERY,
					gallery(MAPPER.createArrayNode()));
		}

		@Test
		@DisplayName("Ein Array aus Zeichenketten ergibt 400: das ist die alte Form")
		void itemsAsPlainStrings() {
			expect(ErrorCodes.BLOCK_CONTENT_INVALID, BlockType.GALLERY,
					gallery(MAPPER.createArrayNode().add(FILE_ID).add(OTHER_FILE_ID)));
		}

		@ParameterizedTest
		@ValueSource(ints = { 2, 3 })
		@DisplayName("columns 2 und 3 sind gueltig")
		void allowedColumns(int columns) {
			ObjectNode attrs = MAPPER.createObjectNode().put("columns", columns);
			attrs.set("items", items(item(FILE_ID, "Erstes Bild")));
			assertThatCode(() -> service.validate(BlockType.GALLERY,
					node("galleryBlock", attrs), 0)).doesNotThrowAnyException();
		}

		@Test
		@DisplayName("Fehlende columns ist gueltig: der Server ergaenzt nichts")
		void columnsMayBeAbsent() {
			assertThatCode(() -> service.validate(BlockType.GALLERY,
					gallery(items(item(FILE_ID, "Erstes Bild"))), 0))
					.doesNotThrowAnyException();
		}

		@ParameterizedTest
		@ValueSource(ints = { 1, 4 })
		@DisplayName("columns 1 und 4 ergeben 400")
		void forbiddenColumns(int columns) {
			ObjectNode attrs = MAPPER.createObjectNode().put("columns", columns);
			attrs.set("items", items(item(FILE_ID, "Erstes Bild")));
			expect(ErrorCodes.BLOCK_CONTENT_INVALID, BlockType.GALLERY,
					node("galleryBlock", attrs));
		}

		@Test
		@DisplayName("fileIds statt items: 400, und die Meldung nennt items")
		void oldAttributeNameIsRejected() {
			ObjectNode attrs = MAPPER.createObjectNode();
			attrs.set("fileIds", MAPPER.createArrayNode().add(FILE_ID).add(OTHER_FILE_ID));
			assertThatThrownBy(() -> service.validate(BlockType.GALLERY,
					node("galleryBlock", attrs), 0))
					.isInstanceOf(ValidationException.class)
					.hasMessageContaining("items");
		}

		@Test
		@DisplayName("fileIds neben gueltigem items ergibt ebenfalls 400")
		void oldAttributeBesideTheNewOne() {
			ObjectNode attrs = MAPPER.createObjectNode();
			attrs.set("items", items(item(FILE_ID, "Erstes Bild")));
			attrs.set("fileIds", MAPPER.createArrayNode().add(FILE_ID));
			expect(ErrorCodes.BLOCK_CONTENT_INVALID, BlockType.GALLERY,
					node("galleryBlock", attrs));
		}

		private JsonNode gallery(ArrayNode items) {
			ObjectNode attrs = MAPPER.createObjectNode();
			attrs.set("items", items);
			return node("galleryBlock", attrs);
		}

		private ArrayNode items(JsonNode... entries) {
			ArrayNode array = MAPPER.createArrayNode();
			for (JsonNode entry : entries) {
				array.add(entry);
			}
			return array;
		}

		private ObjectNode item(String fileId, String alt) {
			return MAPPER.createObjectNode().put("fileId", fileId).put("alt", alt);
		}
	}

	@Nested
	@DisplayName("VIDEO: genau eine Quelle, und niemals eine URL")
	class Video {

		@Test
		@DisplayName("Nur fileId ist gueltig: das hochgeladene Video")
		void uploadedVideo() {
			assertThatCode(() -> service.validate(BlockType.VIDEO,
					node("videoBlock", MAPPER.createObjectNode()
							.put("fileId", FILE_ID)
							.put("caption", "Demo der Bedienung")), 0))
					.doesNotThrowAnyException();
		}

		@Test
		@DisplayName("Nur provider und videoId sind gueltig: die Einbettung")
		void embeddedVideo() {
			assertThatCode(() -> service.validate(BlockType.VIDEO,
					node("videoBlock", MAPPER.createObjectNode()
							.put("provider", "vimeo")
							.put("videoId", "123456789")), 0))
					.doesNotThrowAnyException();
		}

		@Test
		@DisplayName("Beide Quellen zugleich ergeben 400")
		void bothSources() {
			expect(ErrorCodes.BLOCK_CONTENT_INVALID, BlockType.VIDEO,
					node("videoBlock", MAPPER.createObjectNode()
							.put("fileId", FILE_ID)
							.put("provider", "youtube")
							.put("videoId", "dQw4w9WgXcQ")));
		}

		@Test
		@DisplayName("Keine Quelle ergibt 400")
		void noSource() {
			expect(ErrorCodes.BLOCK_CONTENT_INVALID, BlockType.VIDEO,
					node("videoBlock", MAPPER.createObjectNode().put("caption", "ohne Quelle")));
		}

		@Test
		@DisplayName("fileId ohne UUID-Form ergibt 400")
		void fileIdIsNotAUuid() {
			expect(ErrorCodes.BLOCK_CONTENT_INVALID, BlockType.VIDEO,
					node("videoBlock", MAPPER.createObjectNode().put("fileId", "keine-uuid")));
		}

		@Test
		@DisplayName("Unbekannter Provider ergibt weiterhin 400 EMBED_PROVIDER_NOT_ALLOWED")
		void videoProviderUnknown() {
			expect(ErrorCodes.EMBED_PROVIDER_NOT_ALLOWED, BlockType.VIDEO,
					node("videoBlock", MAPPER.createObjectNode()
							.put("provider", "irgendwo")
							.put("videoId", "12345")));
		}

		@Test
		@DisplayName("figma ist bei VIDEO kein Provider: die Liste ist zweigeteilt")
		void embedOnlyProviderIsRejectedForVideo() {
			expect(ErrorCodes.EMBED_PROVIDER_NOT_ALLOWED, BlockType.VIDEO,
					node("videoBlock", MAPPER.createObjectNode()
							.put("provider", "figma")
							.put("videoId", "12345")));
		}

		@Test
		@DisplayName("videoId mit URL-Metazeichen ergibt 400")
		void videoIdWithUrlMetaCharacters() {
			expect(ErrorCodes.BLOCK_CONTENT_INVALID, BlockType.VIDEO,
					node("videoBlock", MAPPER.createObjectNode()
							.put("provider", "youtube")
							.put("videoId", "abc/../../etc")));
		}

		@Test
		@DisplayName("embedUrl ergibt 400, auch neben gueltiger Einbettung")
		void embedUrlIsForbidden() {
			expect(ErrorCodes.BLOCK_CONTENT_INVALID, BlockType.VIDEO,
					node("videoBlock", MAPPER.createObjectNode()
							.put("provider", "youtube")
							.put("videoId", "dQw4w9WgXcQ")
							.put("embedUrl", "https://www.youtube.com/embed/dQw4w9WgXcQ")));
		}

		@Test
		@DisplayName("src ergibt 400, auch neben gueltigem fileId")
		void srcIsForbidden() {
			expect(ErrorCodes.BLOCK_CONTENT_INVALID, BlockType.VIDEO,
					node("videoBlock", MAPPER.createObjectNode()
							.put("fileId", FILE_ID)
							.put("src", "https://fremde.tld/video.mp4")));
		}
	}

	@Nested
	@DisplayName("AUDIO: nur die hochgeladene Datei, src ist verboten")
	class Audio {

		@Test
		@DisplayName("fileId allein ist gueltig")
		void uploadedAudio() {
			assertThatCode(() -> service.validate(BlockType.AUDIO,
					node("audioBlock", MAPPER.createObjectNode()
							.put("fileId", FILE_ID)
							.put("caption", "Interview")), 0))
					.doesNotThrowAnyException();
		}

		@Test
		@DisplayName("Ohne fileId ergibt 400")
		void withoutFileId() {
			expect(ErrorCodes.BLOCK_CONTENT_INVALID, BlockType.AUDIO,
					node("audioBlock", MAPPER.createObjectNode().put("caption", "ohne Datei")));
		}

		@Test
		@DisplayName("src allein ergibt 400: die freie Fremd-URL entfaellt mit §2.5")
		void srcAlone() {
			expect(ErrorCodes.BLOCK_CONTENT_INVALID, BlockType.AUDIO,
					node("audioBlock", MAPPER.createObjectNode()
							.put("src", "https://fremde.tld/ton.mp3")));
		}

		@Test
		@DisplayName("src neben gueltigem fileId ergibt ebenfalls 400")
		void srcBesideFileId() {
			expect(ErrorCodes.BLOCK_CONTENT_INVALID, BlockType.AUDIO,
					node("audioBlock", MAPPER.createObjectNode()
							.put("fileId", FILE_ID)
							.put("src", "https://fremde.tld/ton.mp3")));
		}
	}

	// ------------------------------------------------------------------
	// 2. Marks (§2.5, Befund C3)
	// ------------------------------------------------------------------

	@Nested
	@DisplayName("Marks: zehn und keines mehr")
	class Marks {

		@ParameterizedTest
		@ValueSource(strings = { "bold", "italic", "underline", "strike", "code",
				"superscript", "subscript" })
		@DisplayName("Die sieben Marks ohne Attribute sind an einem TEXT-Knoten gueltig")
		void marksWithoutAttributes(String markType) {
			assertThatCode(() -> service.validate(BlockType.TEXT,
					paragraphWithMark(MAPPER.createObjectNode().put("type", markType)), 0))
					.doesNotThrowAnyException();
		}

		@Test
		@DisplayName("link mit http-Adresse ist gueltig")
		void linkWithHref() {
			assertThatCode(() -> service.validate(BlockType.TEXT,
					paragraphWithMark(link("https://www.hs-bremen.de")), 0))
					.doesNotThrowAnyException();
		}

		@Test
		@DisplayName("textStyle und highlight mit Rollenfarbe sind gueltig")
		void colorMarks() {
			assertThatCode(() -> service.validate(BlockType.TEXT,
					paragraphWithMark(colored("textStyle", "blue")), 0))
					.doesNotThrowAnyException();
			assertThatCode(() -> service.validate(BlockType.TEXT,
					paragraphWithMark(colored("highlight", "amber")), 0))
					.doesNotThrowAnyException();
		}

		@Test
		@DisplayName("Ein unbekanntes Mark ergibt 400 und nennt seinen Namen")
		void unknownMark() {
			assertThatThrownBy(() -> service.validate(BlockType.TEXT,
					paragraphWithMark(MAPPER.createObjectNode().put("type", "blink")), 0))
					.isInstanceOf(ValidationException.class)
					.hasMessageContaining("blink");
			expect(ErrorCodes.BLOCK_CONTENT_INVALID, BlockType.TEXT,
					paragraphWithMark(MAPPER.createObjectNode().put("type", "blink")));
		}

		@Test
		@DisplayName("Ein Mark ohne type ergibt 400")
		void markWithoutType() {
			expect(ErrorCodes.BLOCK_CONTENT_INVALID, BlockType.TEXT,
					paragraphWithMark(MAPPER.createObjectNode().put("href", "https://a.example")));
		}

		@Test
		@DisplayName("Ein Mark in einem IMAGE-Block ergibt 400: §2.5 kennt sie nur in fuenf Typen")
		void marksOutsideTextBlocks() {
			ObjectNode attrs = MAPPER.createObjectNode()
					.put("fileId", FILE_ID)
					.put("alt", "Aufbau");
			ObjectNode content = (ObjectNode) node("imageBlock", attrs);
			content.set("marks", MAPPER.createArrayNode()
					.add(MAPPER.createObjectNode().put("type", "bold")));
			expect(ErrorCodes.BLOCK_CONTENT_INVALID, BlockType.IMAGE, content);
		}

		@Test
		@DisplayName("Ein marks, das kein Array ist, ergibt 400")
		void marksIsNotAnArray() {
			ObjectNode content = (ObjectNode) node("paragraph",
					MAPPER.createObjectNode().put("textAlign", "left"));
			content.set("marks", MAPPER.createObjectNode().put("type", "bold"));
			expect(ErrorCodes.BLOCK_CONTENT_INVALID, BlockType.TEXT, content);
		}

		@Test
		@DisplayName("Ein Eintrag in marks, der kein Objekt ist, ergibt 400")
		void markEntryIsNotAnObject() {
			ObjectNode content = (ObjectNode) node("paragraph",
					MAPPER.createObjectNode().put("textAlign", "left"));
			content.set("marks", MAPPER.createArrayNode().add("bold"));
			expect(ErrorCodes.BLOCK_CONTENT_INVALID, BlockType.TEXT, content);
		}

		@Test
		@DisplayName("In TABLE sind Marks dagegen zulaessig")
		void marksInsideTable() {
			assertThatCode(() -> service.validate(BlockType.TABLE,
					tableWithMark(link("https://www.hs-bremen.de")), 0))
					.doesNotThrowAnyException();
		}
	}

	@Nested
	@DisplayName("Der Angriffsfall: link.href wird auf das Schema gefiltert")
	class LinkHref {

		@ParameterizedTest
		@ValueSource(strings = {
				"javascript:alert(document.cookie)",
				"JaVaScRiPt:alert(1)",
				"\tjavascript:alert(1)",
				"java\tscript:alert(1)",
				"data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==" })
		@DisplayName("Skript- und Daten-Schemata ergeben 400, in jeder Schreibweise")
		void hostileSchemes(String href) {
			expect(ErrorCodes.BLOCK_CONTENT_INVALID, BlockType.TEXT,
					paragraphWithMark(link(href)));
		}

		@ParameterizedTest
		@ValueSource(strings = {
				"http://beispiel.example/beitrag",
				"https://www.hs-bremen.de/fk4",
				"mailto:studiengangsleitung@hs-bremen.de" })
		@DisplayName("http, https und mailto sind gueltig")
		void allowedSchemes(String href) {
			assertThatCode(() -> service.validate(BlockType.TEXT,
					paragraphWithMark(link(href)), 0)).doesNotThrowAnyException();
		}

		@ParameterizedTest
		@ValueSource(strings = { "/relativ", "//fremde.tld/x", "" })
		@DisplayName("Ohne Schema, protokollrelativ und leer ergeben je 400")
		void withoutScheme(String href) {
			expect(ErrorCodes.BLOCK_CONTENT_INVALID, BlockType.TEXT,
					paragraphWithMark(link(href)));
		}

		@Test
		@DisplayName("Ein link-Mark ohne href ergibt 400")
		void missingHref() {
			expect(ErrorCodes.BLOCK_CONTENT_INVALID, BlockType.TEXT,
					paragraphWithMark(MAPPER.createObjectNode().put("type", "link")));
		}
	}

	@Nested
	@DisplayName("Farben sind Rollennamen, keine Farbwerte")
	class Colors {

		@ParameterizedTest
		@ValueSource(strings = { "textStyle", "highlight" })
		@DisplayName("Ein Hex-Wert ergibt 400")
		void hexValue(String markType) {
			expect(ErrorCodes.BLOCK_CONTENT_INVALID, BlockType.TEXT,
					paragraphWithMark(colored(markType, "#ff0000")));
		}

		@ParameterizedTest
		@ValueSource(strings = { "textStyle", "highlight" })
		@DisplayName("Eine CSS-Funktion ergibt 400")
		void cssFunction(String markType) {
			expect(ErrorCodes.BLOCK_CONTENT_INVALID, BlockType.TEXT,
					paragraphWithMark(colored(markType, "rgb(255, 0, 0)")));
		}

		@ParameterizedTest
		@ValueSource(strings = { "textStyle", "highlight" })
		@DisplayName("Ein Farbwort ausserhalb der neun Rollen ergibt 400")
		void unknownRole(String markType) {
			/* Bewusst nicht "purple": das ist seit v63 eine der neun Rollen.
			   Der Fall braucht ein Wort, das keine ist, sonst prueft er ab
			   der naechsten Palettenerweiterung stillschweigend nichts mehr. */
			expect(ErrorCodes.BLOCK_CONTENT_INVALID, BlockType.TEXT,
					paragraphWithMark(colored(markType, "teal")));
		}

		@ParameterizedTest
		@ValueSource(strings = { "textStyle", "highlight" })
		@DisplayName("Fehlendes color ergibt 400: keine Farbe heisst, das Mark fehlt")
		void missingColor(String markType) {
			expect(ErrorCodes.BLOCK_CONTENT_INVALID, BlockType.TEXT,
					paragraphWithMark(MAPPER.createObjectNode().put("type", markType)));
		}

		@ParameterizedTest
		@ValueSource(strings = { "neutral", "blue", "green", "amber", "red",
				"brown", "orange", "purple", "pink" })
		@DisplayName("Die neun Rollennamen sind gueltig")
		void allNineRoles(String role) {
			assertThatCode(() -> service.validate(BlockType.TEXT,
					paragraphWithMark(colored("textStyle", role)), 0))
					.doesNotThrowAnyException();
		}
	}

	@Nested
	@DisplayName("Der Durchlauf findet Marks in jeder Tiefe")
	class Traversal {

		@Test
		@DisplayName("Ein Skript-Link tief in einer Liste ergibt 400")
		void deeplyNestedHostileLink() {
			JsonNode text = withMarks(MAPPER.createObjectNode().put("type", "text")
					.put("text", "hier klicken"), link("javascript:alert(1)"));
			JsonNode paragraph = withContent(MAPPER.createObjectNode().put("type", "paragraph"),
					text);
			JsonNode listItem = withContent(MAPPER.createObjectNode().put("type", "listItem"),
					paragraph);
			JsonNode list = withContent(MAPPER.createObjectNode().put("type", "bulletList"),
					listItem);
			expect(ErrorCodes.BLOCK_CONTENT_INVALID, BlockType.LIST, list);
		}

		@Test
		@DisplayName("Derselbe Baum mit https ist gueltig")
		void deeplyNestedSafeLink() {
			JsonNode text = withMarks(MAPPER.createObjectNode().put("type", "text")
					.put("text", "hier klicken"), link("https://www.hs-bremen.de"));
			JsonNode paragraph = withContent(MAPPER.createObjectNode().put("type", "paragraph"),
					text);
			JsonNode listItem = withContent(MAPPER.createObjectNode().put("type", "listItem"),
					paragraph);
			JsonNode list = withContent(MAPPER.createObjectNode().put("type", "bulletList"),
					listItem);
			assertThatCode(() -> service.validate(BlockType.LIST, list, 0))
					.doesNotThrowAnyException();
		}

		@Test
		@DisplayName("Verschachtelung jenseits von 20 Ebenen ergibt 400")
		void beyondTheDepthLimit() {
			ObjectNode deepest = MAPPER.createObjectNode().put("type", "paragraph");
			JsonNode current = deepest;
			for (int i = 0; i < 25; i++) {
				current = withContent(MAPPER.createObjectNode().put("type", "blockquote"),
						current);
			}
			expect(ErrorCodes.BLOCK_CONTENT_INVALID, BlockType.QUOTE, current);
		}

		/**
		 * Genau an der Grenze und genau darueber, nicht irgendwo darunter: eine
		 * um eins verrechnete Tiefenzaehlung faellt nur hier auf. Der
		 * Wurzelknoten zaehlt als Ebene 1, {@code nested} Nachkommen ergeben
		 * also die Tiefe {@code nested + 1}.
		 */
		@Test
		@DisplayName("Tiefe 20 laeuft durch, Tiefe 21 ergibt 400")
		void exactlyAtTheDepthLimit() {
			assertThatCode(() -> service.validate(BlockType.QUOTE, nested(19), 0))
					.doesNotThrowAnyException();
			expect(ErrorCodes.BLOCK_CONTENT_INVALID, BlockType.QUOTE, nested(20));
		}

		/** Ein Baum mit {@code levels} Nachkommen unter dem Wurzelknoten. */
		private JsonNode nested(int levels) {
			JsonNode current = MAPPER.createObjectNode().put("type", "paragraph");
			for (int i = 0; i < levels - 1; i++) {
				current = withContent(MAPPER.createObjectNode().put("type", "blockquote"),
						current);
			}
			return withContent(MAPPER.createObjectNode().put("type", "blockquote"), current);
		}
	}

	// ------------------------------------------------------------------
	// Bestehende Faelle
	// ------------------------------------------------------------------

	@Nested
	@DisplayName("400 BLOCK_CONTENT_INVALID")
	class ContentInvalid {

		@Test
		@DisplayName("content.type passt nicht zum type")
		void nodeTypeMismatch() {
			expect(ErrorCodes.BLOCK_CONTENT_INVALID,
					BlockType.TEXT, VALID_CONTENT.get(BlockType.HEADING));
		}

		@Test
		@DisplayName("EMBED ohne embedUrl: das fehlende Pflichtfeld schlaegt vor der Allowlist zu")
		void embedWithoutUrl() {
			expect(ErrorCodes.BLOCK_CONTENT_INVALID, BlockType.EMBED,
					node("embedBlock", MAPPER.createObjectNode().put("provider", "figma")));
		}

		@Test
		@DisplayName("content fehlt oder ist kein Objekt")
		void contentMissing() {
			expect(ErrorCodes.BLOCK_CONTENT_INVALID, BlockType.TEXT, null);
			expect(ErrorCodes.BLOCK_CONTENT_INVALID, BlockType.TEXT, MAPPER.createArrayNode());
		}
	}

	@Nested
	@DisplayName("400 EMBED_PROVIDER_NOT_ALLOWED")
	class ProviderNotAllowed {

		@Test
		@DisplayName("EMBED von einem Host ausserhalb der Allowlist")
		void embedProviderUnknown() {
			expect(ErrorCodes.EMBED_PROVIDER_NOT_ALLOWED, BlockType.EMBED,
					node("embedBlock", MAPPER.createObjectNode()
							.put("provider", "irgendwo")
							.put("embedUrl", "https://beliebig.example.org/eingebettet")));
		}

		@Test
		@DisplayName("Erlaubter Providername, aber fremder Host: die Allowlist bleibt zu")
		void embedHostDoesNotMatchProvider() {
			expect(ErrorCodes.EMBED_PROVIDER_NOT_ALLOWED, BlockType.EMBED,
					node("embedBlock", MAPPER.createObjectNode()
							.put("provider", "figma")
							.put("embedUrl", "https://beliebig.example.org/als-figma-getarnt")));
		}
	}

	/**
	 * Die Host-Allowlist aus §2.5 (seit Contract v52 auch dort gefuehrt):
	 * je Provider genau die Hosts, die der Contract nennt. Der Test haelt Code
	 * und Contract zusammen, damit die drei Fassungen aus Befund C15 nicht
	 * wieder auseinanderlaufen.
	 */
	@Nested
	@DisplayName("Provider- und Hostlisten stimmen mit §2.5 ueberein")
	class Allowlists {

		@ParameterizedTest
		@ValueSource(strings = { "https://www.youtube.com/embed/x",
				"https://youtube.com/embed/x", "https://www.youtube-nocookie.com/embed/x" })
		@DisplayName("youtube: drei Hosts")
		void youtubeHosts(String embedUrl) {
			assertThatCode(() -> service.validate(BlockType.EMBED,
					embed("youtube", embedUrl), 0)).doesNotThrowAnyException();
		}

		@Test
		@DisplayName("vimeo, figma und codepen mit je einem Host")
		void singleHostProviders() {
			assertThatCode(() -> service.validate(BlockType.EMBED,
					embed("vimeo", "https://player.vimeo.com/video/1"), 0))
					.doesNotThrowAnyException();
			assertThatCode(() -> service.validate(BlockType.EMBED,
					embed("figma", "https://embed.figma.com/design/o6SECXRMKGOzCfG5xZebPV/Name?embed-host=share"), 0))
					.doesNotThrowAnyException();
			assertThatCode(() -> service.validate(BlockType.EMBED,
					embed("codepen", "https://codepen.io/a/embed/abc"), 0))
					.doesNotThrowAnyException();
			// gist entfaellt mit v64: GitHub bietet fuer Gists keinen
			// einbettbaren Rahmen an, sondern nur ein nachgeladenes Skript.
			expect(ErrorCodes.EMBED_PROVIDER_NOT_ALLOWED, BlockType.EMBED,
					embed("gist", "https://gist.github.com/a/b"));
		}

		@Test
		@DisplayName("Seit v64 zaehlt auch der Pfad: die Zuschauerseite geht nicht mehr durch")
		void pathMustBeAnEmbed() {
			// Der haeufigste Fehlschlag: erlaubter Host, aber eine Seite, die
			// das Einbetten per X-Frame-Options verbietet. Sie wurde
			// angenommen und ergab einen leeren Rahmen ohne jede Meldung.
			expect(ErrorCodes.EMBED_PROVIDER_NOT_ALLOWED, BlockType.EMBED,
					embed("youtube", "https://www.youtube.com/watch?v=dQw4w9WgXcQ"));
			expect(ErrorCodes.EMBED_PROVIDER_NOT_ALLOWED, BlockType.EMBED,
					embed("codepen", "https://codepen.io/a/pen/b"));
			expect(ErrorCodes.EMBED_PROVIDER_NOT_ALLOWED, BlockType.EMBED,
					embed("figma", "https://embed.figma.com/nichts/x"));
			assertThatCode(() -> service.validate(BlockType.EMBED,
					embed("youtube", "https://www.youtube.com/embed/dQw4w9WgXcQ"), 0))
					.doesNotThrowAnyException();
		}

		@Test
		@DisplayName("Der Freigabe-Hash gehoert nur an ein vimeo-Video (v64)")
		void vimeoShareHash() {
			// Ein nicht gelistetes Vimeo-Video ist ohne den Hash nicht
			// abspielbar; an einem youtube-Block waere er eine Angabe ohne
			// Wirkung.
			assertThatCode(() -> service.validate(BlockType.VIDEO,
					node("videoBlock", MAPPER.createObjectNode()
							.put("provider", "vimeo").put("videoId", "1212836492")
							.put("hash", "3ace684330")), 0))
					.doesNotThrowAnyException();
			expect(ErrorCodes.BLOCK_CONTENT_INVALID, BlockType.VIDEO,
					node("videoBlock", MAPPER.createObjectNode()
							.put("provider", "youtube").put("videoId", "dQw4w9WgXcQ")
							.put("hash", "3ace684330")));
			expect(ErrorCodes.BLOCK_CONTENT_INVALID, BlockType.VIDEO,
					node("videoBlock", MAPPER.createObjectNode()
							.put("provider", "vimeo").put("videoId", "1212836492")
							.put("hash", "a/b?c=1")));
		}

		@Test
		@DisplayName("Nur https: eine http-Adresse ergibt EMBED_PROVIDER_NOT_ALLOWED")
		void onlyHttps() {
			expect(ErrorCodes.EMBED_PROVIDER_NOT_ALLOWED, BlockType.EMBED,
					embed("codepen", "http://codepen.io/a/embed/abc"));
		}

		@Test
		@DisplayName("VIDEO kennt nur youtube und vimeo, EMBED alle vier")
		void listIsSplitInTwo() {
			// Die VIDEO-Haelfte: die beiden Videoanbieter gehen durch, die drei
			// uebrigen nicht.
			assertThatCode(() -> service.validate(BlockType.VIDEO,
					node("videoBlock", MAPPER.createObjectNode()
							.put("provider", "youtube").put("videoId", "dQw4w9WgXcQ")), 0))
					.doesNotThrowAnyException();
			assertThatCode(() -> service.validate(BlockType.VIDEO,
					node("videoBlock", MAPPER.createObjectNode()
							.put("provider", "vimeo").put("videoId", "123456789")), 0))
					.doesNotThrowAnyException();
			for (String embedOnly : new String[] { "figma", "codepen" }) {
				expect(ErrorCodes.EMBED_PROVIDER_NOT_ALLOWED, BlockType.VIDEO,
						node("videoBlock", MAPPER.createObjectNode()
								.put("provider", embedOnly).put("videoId", "12345")));
			}

			// Die EMBED-Haelfte: alle vier gehen durch, ein fuenfter nicht.
			for (String[] pair : new String[][] {
					{ "youtube", "https://www.youtube.com/embed/x" },
					{ "vimeo", "https://player.vimeo.com/video/1" },
					{ "figma", "https://embed.figma.com/design/o6SECXRMKGOzCfG5xZebPV/Name?embed-host=share" },
					{ "codepen", "https://codepen.io/a/embed/abc" } }) {
				assertThatCode(() -> service.validate(BlockType.EMBED,
						embed(pair[0], pair[1]), 0)).doesNotThrowAnyException();
			}
			expect(ErrorCodes.EMBED_PROVIDER_NOT_ALLOWED, BlockType.EMBED,
					embed("dailymotion", "https://www.dailymotion.com/embed/x"));
		}

		/**
		 * Schema und Host werden ohne Ruecksicht auf die Schreibweise
		 * verglichen: RFC 3986 erklaert beide fuer schreibweisenunabhaengig,
		 * {@code java.net.URI} normalisiert aber keins von beiden.
		 */
		@Test
		@DisplayName("Grossgeschriebenes Schema und grossgeschriebener Host gehen durch")
		void schemeAndHostAreCaseInsensitive() {
			assertThatCode(() -> service.validate(BlockType.EMBED,
					embed("youtube", "HTTPS://WWW.YOUTUBE.COM/embed/x"), 0))
					.doesNotThrowAnyException();
		}

		private JsonNode embed(String provider, String embedUrl) {
			return node("embedBlock", MAPPER.createObjectNode()
					.put("provider", provider)
					.put("embedUrl", embedUrl)
					.put("height", 480));
		}
	}

	@Test
	@DisplayName("Die Meldung nennt die Position in der Liste")
	void messageNamesThePosition() {
		assertThatThrownBy(() -> service.validate(BlockType.TEXT, MAPPER.createObjectNode(), 7))
				.isInstanceOf(ValidationException.class)
				.hasMessageStartingWith("Block 7:");
	}

	// ------------------------------------------------------------------

	private void expect(String errorCode, BlockType type, JsonNode content) {
		assertThatThrownBy(() -> service.validate(type, content, 0))
				.isInstanceOf(ValidationException.class)
				.extracting(exception -> ((ValidationException) exception).getErrorCode())
				.isEqualTo(errorCode);
	}

	private static JsonNode node(String nodeType, JsonNode attrs) {
		return MAPPER.createObjectNode().put("type", nodeType).set("attrs", attrs);
	}

	/** Ein Absatz mit einem Textknoten, der genau dieses Mark traegt. */
	private static JsonNode paragraphWithMark(JsonNode mark) {
		JsonNode text = withMarks(MAPPER.createObjectNode().put("type", "text")
				.put("text", "Beispiel"), mark);
		return withContent(MAPPER.createObjectNode().put("type", "paragraph"), text);
	}

	/** Eine Tabelle mit Zeile, Zelle, Absatz und Textknoten mit diesem Mark. */
	private static JsonNode tableWithMark(JsonNode mark) {
		JsonNode text = withMarks(MAPPER.createObjectNode().put("type", "text")
				.put("text", "Beispiel"), mark);
		JsonNode paragraph = withContent(MAPPER.createObjectNode().put("type", "paragraph"), text);
		JsonNode cell = withContent(MAPPER.createObjectNode().put("type", "tableCell"), paragraph);
		JsonNode row = withContent(MAPPER.createObjectNode().put("type", "tableRow"), cell);
		return withContent(MAPPER.createObjectNode().put("type", "table"), row);
	}

	private static JsonNode link(String href) {
		ObjectNode mark = MAPPER.createObjectNode().put("type", "link");
		mark.set("attrs", MAPPER.createObjectNode().put("href", href));
		return mark;
	}

	private static JsonNode colored(String markType, String color) {
		ObjectNode mark = MAPPER.createObjectNode().put("type", markType);
		mark.set("attrs", MAPPER.createObjectNode().put("color", color));
		return mark;
	}

	private static JsonNode withMarks(ObjectNode node, JsonNode... marks) {
		ArrayNode array = MAPPER.createArrayNode();
		for (JsonNode mark : marks) {
			array.add(mark);
		}
		node.set("marks", array);
		return node;
	}

	private static JsonNode withContent(ObjectNode node, JsonNode... children) {
		ArrayNode array = MAPPER.createArrayNode();
		for (JsonNode child : children) {
			array.add(child);
		}
		node.set("content", array);
		return node;
	}

	private static Map<BlockType, JsonNode> validContent() {
		Map<BlockType, JsonNode> samples = new EnumMap<>(BlockType.class);

		samples.put(BlockType.HEADING,
				node("heading", MAPPER.createObjectNode().put("level", 2)));
		samples.put(BlockType.TEXT,
				node("paragraph", MAPPER.createObjectNode().put("textAlign", "left")));
		samples.put(BlockType.LIST,
				node("bulletList", MAPPER.createObjectNode()));
		samples.put(BlockType.QUOTE,
				node("blockquote", MAPPER.createObjectNode()));
		samples.put(BlockType.CODE,
				node("codeBlock", MAPPER.createObjectNode().put("language", "java")));
		samples.put(BlockType.FORMULA,
				node("mathBlock", MAPPER.createObjectNode().put("latex", "E = mc^2")));
		samples.put(BlockType.TABLE,
				node("table", MAPPER.createObjectNode()));
		samples.put(BlockType.DIVIDER,
				node("horizontalRule", MAPPER.createObjectNode()));
		samples.put(BlockType.IMAGE,
				node("imageBlock", MAPPER.createObjectNode()
						.put("fileId", FILE_ID)
						.put("alt", "Aufbau der Navigation")
						.put("width", 100)));

		// §2.5 seit Contract v51: Objekte mit fileId und alt, nicht mehr blosse IDs.
		ObjectNode galleryAttrs = MAPPER.createObjectNode();
		galleryAttrs.set("items", MAPPER.createArrayNode()
				.add(MAPPER.createObjectNode().put("fileId", FILE_ID)
						.put("alt", "Startbildschirm"))
				.add(MAPPER.createObjectNode().put("fileId", OTHER_FILE_ID)
						.put("alt", "Detailansicht")));
		galleryAttrs.put("columns", 2);
		samples.put(BlockType.GALLERY, node("galleryBlock", galleryAttrs));

		// Die Einbettung als Beispiel; das hochgeladene Video prueft Video.uploadedVideo.
		samples.put(BlockType.VIDEO,
				node("videoBlock", MAPPER.createObjectNode()
						.put("provider", "youtube")
						.put("videoId", "dQw4w9WgXcQ")
						.put("caption", "Vorstellung des Projekts")));
		samples.put(BlockType.AUDIO,
				node("audioBlock", MAPPER.createObjectNode()
						.put("fileId", "9c4a1f80-5b2d-4e6a-8f31-0d7c2b4e6a19")));
		samples.put(BlockType.DOCUMENT,
				node("documentBlock", MAPPER.createObjectNode()
						.put("fileId", "1a2b3c4d-5e6f-4708-9a0b-1c2d3e4f5061")
						.put("fileName", "Auswertung.pdf")
						.put("size", 204_800)));
		samples.put(BlockType.EMBED,
				node("embedBlock", MAPPER.createObjectNode()
						.put("provider", "figma")
						.put("embedUrl", "https://embed.figma.com/design/o6SECXRMKGOzCfG5xZebPV/Name?embed-host=share")
						.put("height", 480)));

		return Map.copyOf(samples);
	}
}
