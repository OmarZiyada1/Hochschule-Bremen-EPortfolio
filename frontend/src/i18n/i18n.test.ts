import { describe, expect, it } from "vitest";

import de from "./de.json";
import en from "./en.json";

/**
 * Beide Sprachdateien pflegen denselben Schluesselbaum (KAN-6, Abschnitt 6).
 * Ein Schluessel nur in de.json fiele im englischen Betrieb als roher
 * Schluesselname auf; dieser Test macht ihn schon im Testlauf sichtbar.
 */
function collectKeys(node: unknown, prefix: string): string[] {
	if (typeof node !== "object" || node === null) {
		return [prefix];
	}
	return Object.entries(node).flatMap(([key, value]) =>
		collectKeys(value, prefix === "" ? key : `${prefix}.${key}`),
	);
}

describe("i18n", () => {
	it("de.json und en.json pflegen dieselben Schluessel", () => {
		expect(collectKeys(en, "").sort()).toEqual(collectKeys(de, "").sort());
	});
});
