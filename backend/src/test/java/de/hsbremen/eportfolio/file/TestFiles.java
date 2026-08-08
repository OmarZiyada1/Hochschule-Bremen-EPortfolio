package de.hsbremen.eportfolio.file;

/**
 * Baut je erlaubtem Typ (§3.15) einen minimalen, signaturgueltigen
 * Dateianfang samt Fuellbytes.
 *
 * <p>An einer Stelle gepflegt, damit Unit-, Adapter- und Integrationstests
 * nicht mit unterschiedlichen Vorstellungen davon laufen, wie eine gueltige
 * Datei dieses Typs aussieht (dasselbe Muster wie
 * {@code BlockValidationServiceTest.VALID_CONTENT}).
 */
public final class TestFiles {

	/** Ein kleines Exemplar des Typs, Signatur plus Fuellbytes. */
	public static byte[] sample(AllowedFileType type) {
		return sample(type, 64);
	}

	/**
	 * Ein Exemplar mit exakter Gesamtlaenge, fuer die Limit-Tests: die
	 * Signatur stimmt, der Rest ist Fuellung.
	 */
	public static byte[] sample(AllowedFileType type, int totalLength) {
		byte[] signature = signature(type);
		byte[] bytes = new byte[Math.max(totalLength, signature.length)];
		System.arraycopy(signature, 0, bytes, 0, signature.length);
		for (int i = signature.length; i < bytes.length; i++) {
			bytes[i] = (byte) (i % 251);
		}
		return bytes;
	}

	private static byte[] signature(AllowedFileType type) {
		return switch (type) {
			case PNG -> new byte[] {
					(byte) 0x89, 'P', 'N', 'G', 0x0D, 0x0A, 0x1A, 0x0A };
			case JPEG -> new byte[] { (byte) 0xFF, (byte) 0xD8, (byte) 0xFF, (byte) 0xE0 };
			case WEBP -> new byte[] {
					'R', 'I', 'F', 'F', 0x24, 0x00, 0x00, 0x00, 'W', 'E', 'B', 'P' };
			case MP3 -> new byte[] { 'I', 'D', '3', 0x03, 0x00, 0x00 };
			case WAV -> new byte[] {
					'R', 'I', 'F', 'F', 0x24, 0x00, 0x00, 0x00, 'W', 'A', 'V', 'E' };
			case OGG -> new byte[] { 'O', 'g', 'g', 'S', 0x00, 0x02 };
			case PDF -> new byte[] { '%', 'P', 'D', 'F', '-', '1', '.', '4' };
		};
	}

	private TestFiles() {
	}
}
