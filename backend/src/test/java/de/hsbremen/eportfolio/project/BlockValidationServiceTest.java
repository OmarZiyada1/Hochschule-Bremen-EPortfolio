package de.hsbremen.eportfolio.project;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import de.hsbremen.eportfolio.common.enums.BlockType;
import de.hsbremen.eportfolio.common.error.ErrorCodes;
import de.hsbremen.eportfolio.common.error.ValidationException;
import java.util.EnumMap;
import java.util.Map;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;

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
 */
class BlockValidationServiceTest {

	private static final ObjectMapper MAPPER = new ObjectMapper();

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
		@DisplayName("HEADING ausserhalb der Ebenen 1 bis 3")
		void headingLevelOutOfRange() {
			expect(ErrorCodes.BLOCK_CONTENT_INVALID, BlockType.HEADING,
					node("heading", MAPPER.createObjectNode().put("level", 4)));
		}

		@Test
		@DisplayName("IMAGE ohne fileId")
		void imageWithoutFileId() {
			expect(ErrorCodes.BLOCK_CONTENT_INVALID, BlockType.IMAGE,
					node("imageBlock", MAPPER.createObjectNode().put("alt", "ohne Datei")));
		}

		@Test
		@DisplayName("VIDEO mit erlaubtem Provider, aber unbrauchbarer videoId")
		void videoIdWithUrlMetaCharacters() {
			expect(ErrorCodes.BLOCK_CONTENT_INVALID, BlockType.VIDEO,
					node("videoBlock", MAPPER.createObjectNode()
							.put("provider", "youtube")
							.put("videoId", "abc/../../etc")));
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

		@Test
		@DisplayName("VIDEO mit einem Provider ausserhalb von youtube und vimeo")
		void videoProviderUnknown() {
			expect(ErrorCodes.EMBED_PROVIDER_NOT_ALLOWED, BlockType.VIDEO,
					node("videoBlock", MAPPER.createObjectNode()
							.put("provider", "irgendwo")
							.put("videoId", "12345")));
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
						.put("fileId", "3f1c9a52-0c1e-4a1f-9a3e-2f1d5c7b8e10")
						.put("alt", "Aufbau der Navigation")));
		samples.put(BlockType.GALLERY,
				node("galleryBlock", MAPPER.createObjectNode()
						.set("fileIds", MAPPER.createArrayNode()
								.add("3f1c9a52-0c1e-4a1f-9a3e-2f1d5c7b8e10")
								.add("7b2e4d61-9a8c-4f02-8d55-6c0b3a9e1d24"))));
		samples.put(BlockType.VIDEO,
				node("videoBlock", MAPPER.createObjectNode()
						.put("provider", "youtube")
						.put("videoId", "dQw4w9WgXcQ")));
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
						.put("embedUrl", "https://www.figma.com/embed?embed_host=share")
						.put("height", 480)));

		return Map.copyOf(samples);
	}
}
