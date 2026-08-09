package de.hsbremen.eportfolio.file;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;

/**
 * Die Allowlist aus §3.15 als Unit-Test: MIME-Zuordnung, Signaturen und
 * Limits, ohne Spring-Kontext und ohne Speicher.
 */
class AllowedFileTypeTest {

	@Test
	@DisplayName("Nur die sieben MIME-Typen aus §3.15 werden aufgeloest")
	void mimeTypeAllowlist() {
		assertThat(AllowedFileType.fromMimeType("image/png")).contains(AllowedFileType.PNG);
		assertThat(AllowedFileType.fromMimeType("image/jpeg")).contains(AllowedFileType.JPEG);
		assertThat(AllowedFileType.fromMimeType("image/webp")).contains(AllowedFileType.WEBP);
		assertThat(AllowedFileType.fromMimeType("audio/mpeg")).contains(AllowedFileType.MP3);
		assertThat(AllowedFileType.fromMimeType("audio/wav")).contains(AllowedFileType.WAV);
		assertThat(AllowedFileType.fromMimeType("audio/ogg")).contains(AllowedFileType.OGG);
		assertThat(AllowedFileType.fromMimeType("application/pdf")).contains(AllowedFileType.PDF);

		assertThat(AllowedFileType.fromMimeType("text/plain")).isEmpty();
		assertThat(AllowedFileType.fromMimeType("video/mp4")).isEmpty();
		assertThat(AllowedFileType.fromMimeType("image/gif")).isEmpty();
		assertThat(AllowedFileType.fromMimeType("application/zip")).isEmpty();
		assertThat(AllowedFileType.fromMimeType(null)).isEmpty();
		assertThat(AllowedFileType.fromMimeType("")).isEmpty();
	}

	@Test
	@DisplayName("Schreibweise und Parameter des Content-Type sind egal")
	void mimeTypeNormalisation() {
		assertThat(AllowedFileType.fromMimeType("IMAGE/PNG")).contains(AllowedFileType.PNG);
		assertThat(AllowedFileType.fromMimeType(" image/png ; charset=utf-8"))
				.contains(AllowedFileType.PNG);
	}

	/**
	 * Jedes Beispiel passt genau zu seinem eigenen Typ. Das prueft beide
	 * Richtungen auf einmal: die Signatur wird erkannt, und kein umbenanntes
	 * Exemplar eines anderen Typs rutscht durch (§3.15).
	 */
	@ParameterizedTest
	@EnumSource(AllowedFileType.class)
	@DisplayName("Signatur passt genau zum eigenen Typ")
	void signatureMatrix(AllowedFileType declared) {
		for (AllowedFileType actual : AllowedFileType.values()) {
			assertThat(declared.matchesSignature(TestFiles.sample(actual)))
					.as("%s gegen Inhalt von %s", declared, actual)
					.isEqualTo(declared == actual);
		}
	}

	@Test
	@DisplayName("MP3 erkennt auch den Frame-Sync ohne ID3-Tag")
	void mp3FrameSync() {
		byte[] bare = new byte[] { (byte) 0xFF, (byte) 0xFB, (byte) 0x90, 0x00 };
		assertThat(AllowedFileType.MP3.matchesSignature(bare)).isTrue();
	}

	@ParameterizedTest
	@EnumSource(AllowedFileType.class)
	@DisplayName("Leere und zu kurze Dateien tragen keine gueltige Signatur")
	void tooShortHead(AllowedFileType type) {
		assertThat(type.matchesSignature(new byte[0])).isFalse();
		assertThat(type.matchesSignature(new byte[] { 'R' })).isFalse();
	}

	@Test
	@DisplayName("Limits nach §3.15: Bilder 10 MB, Audio und PDF 25 MB")
	void limits() {
		long tenMib = 10L * 1024 * 1024;
		long twentyFiveMib = 25L * 1024 * 1024;

		assertThat(AllowedFileType.PNG.maxBytes()).isEqualTo(tenMib);
		assertThat(AllowedFileType.JPEG.maxBytes()).isEqualTo(tenMib);
		assertThat(AllowedFileType.WEBP.maxBytes()).isEqualTo(tenMib);
		assertThat(AllowedFileType.MP3.maxBytes()).isEqualTo(twentyFiveMib);
		assertThat(AllowedFileType.WAV.maxBytes()).isEqualTo(twentyFiveMib);
		assertThat(AllowedFileType.OGG.maxBytes()).isEqualTo(twentyFiveMib);
		assertThat(AllowedFileType.PDF.maxBytes()).isEqualTo(twentyFiveMib);
	}
}
