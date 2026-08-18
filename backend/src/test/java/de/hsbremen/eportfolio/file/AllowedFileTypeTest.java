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
	@DisplayName("Nur die neun MIME-Typen aus §3.15 werden aufgeloest")
	void mimeTypeAllowlist() {
		assertThat(AllowedFileType.fromMimeType("image/png")).contains(AllowedFileType.PNG);
		assertThat(AllowedFileType.fromMimeType("image/jpeg")).contains(AllowedFileType.JPEG);
		assertThat(AllowedFileType.fromMimeType("image/webp")).contains(AllowedFileType.WEBP);
		assertThat(AllowedFileType.fromMimeType("audio/mpeg")).contains(AllowedFileType.MP3);
		assertThat(AllowedFileType.fromMimeType("audio/wav")).contains(AllowedFileType.WAV);
		assertThat(AllowedFileType.fromMimeType("audio/ogg")).contains(AllowedFileType.OGG);
		assertThat(AllowedFileType.fromMimeType("application/pdf")).contains(AllowedFileType.PDF);
		assertThat(AllowedFileType.fromMimeType("video/mp4")).contains(AllowedFileType.MP4);
		assertThat(AllowedFileType.fromMimeType("video/webm")).contains(AllowedFileType.WEBM);

		assertThat(AllowedFileType.fromMimeType("text/plain")).isEmpty();
		// Matroska traegt denselben EBML-Kopf wie WebM und scheitert deshalb
		// bereits an der ersten Stufe, dem gemeldeten Content-Type (§3.15).
		assertThat(AllowedFileType.fromMimeType("video/x-matroska")).isEmpty();
		assertThat(AllowedFileType.fromMimeType("video/quicktime")).isEmpty();
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

	/**
	 * MP4 wird an der ftyp-Box in den Bytes 4 bis 7 erkannt, nicht an der
	 * Boxlaenge davor: die ist kein Kennzeichen des Formats und variiert
	 * (§3.15, Contract v53).
	 */
	@Test
	@DisplayName("MP4: ftyp in den Bytes 4 bis 7, unabhaengig von der Boxlaenge davor")
	void mp4FileTypeBox() {
		byte[] otherLength = new byte[] {
				0x00, 0x00, 0x00, 0x18, 'f', 't', 'y', 'p', 'm', 'p', '4', '2' };
		assertThat(AllowedFileType.MP4.matchesSignature(otherLength)).isTrue();

		byte[] withoutFtyp = new byte[] {
				0x00, 0x00, 0x00, 0x20, 'm', 'o', 'o', 'v', 'i', 's', 'o', 'm' };
		assertThat(AllowedFileType.MP4.matchesSignature(withoutFtyp)).isFalse();
	}

	@Test
	@DisplayName("WebM: der EBML-Kopf in den Bytes 0 bis 3, ein abweichender Anfang nicht")
	void webmEbmlHeader() {
		byte[] ebml = new byte[] {
				(byte) 0x1A, 0x45, (byte) 0xDF, (byte) 0xA3, 0x01, 0x02, 0x03, 0x04 };
		assertThat(AllowedFileType.WEBM.matchesSignature(ebml)).isTrue();

		byte[] different = new byte[] {
				(byte) 0x1A, 0x45, (byte) 0xDF, 0x00, 0x01, 0x02, 0x03, 0x04 };
		assertThat(AllowedFileType.WEBM.matchesSignature(different)).isFalse();
	}

	@Test
	@DisplayName("HEADER_LENGTH bleibt 12: die beiden Videosignaturen brauchen nicht mehr")
	void headerLengthStaysTwelve() {
		assertThat(AllowedFileType.HEADER_LENGTH).isEqualTo(12);
	}

	@Test
	@DisplayName("Limits nach §3.15: Bilder 10 MB, Audio und PDF 25 MB, Video 200 MB")
	void limits() {
		long tenMib = 10L * 1024 * 1024;
		long twentyFiveMib = 25L * 1024 * 1024;
		long twoHundredMib = 200L * 1024 * 1024;

		assertThat(AllowedFileType.PNG.maxBytes()).isEqualTo(tenMib);
		assertThat(AllowedFileType.JPEG.maxBytes()).isEqualTo(tenMib);
		assertThat(AllowedFileType.WEBP.maxBytes()).isEqualTo(tenMib);
		assertThat(AllowedFileType.MP3.maxBytes()).isEqualTo(twentyFiveMib);
		assertThat(AllowedFileType.WAV.maxBytes()).isEqualTo(twentyFiveMib);
		assertThat(AllowedFileType.OGG.maxBytes()).isEqualTo(twentyFiveMib);
		assertThat(AllowedFileType.PDF.maxBytes()).isEqualTo(twentyFiveMib);
		assertThat(AllowedFileType.MP4.maxBytes()).isEqualTo(twoHundredMib);
		assertThat(AllowedFileType.WEBM.maxBytes()).isEqualTo(twoHundredMib);
	}
}
