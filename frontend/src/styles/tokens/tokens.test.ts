import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
	allSemanticTokenNames,
	radiusTokenNames,
} from "@/features/token-gallery/tokenCatalog";

/* Primitives nach Foundation, Abschnitt 2 (Stand 07.08.2026). Die Namen
   stehen bewusst nur hier im Test und nicht im Anwendungscode: eine
   Komponente bindet nie an eine Primitive. */
const primitiveTokenNames = [
	"blau-100",
	"blau-200",
	"blau-300",
	"blau-400",
	"blau-600",
	"blau-700",
	"blau-800",
	"blau-900",
	"blau-950",
	"neutral-50",
	"neutral-100",
	"neutral-200",
	"neutral-300",
	"neutral-400",
	"neutral-600",
	"neutral-700",
	"neutral-800",
	"neutral-900",
	"neutral-950",
	"rot-100",
	"rot-400",
	"rot-600",
	"rot-700",
	"rot-800",
	"rot-950",
	"bernstein-100",
	"bernstein-400",
	"bernstein-700",
	"bernstein-800",
	"bernstein-950",
	"gruen-100",
	"gruen-400",
	"gruen-700",
	"gruen-800",
	"gruen-950",
	"basis-weiss",
];

/* Die Dateien werden ueber das Dateisystem gelesen, nicht als ?raw-Import:
   Vitest laesst CSS-Module im Testlauf bewusst leer. */
const tokensDir = dirname(fileURLToPath(import.meta.url));
const tokensCss = readFileSync(join(tokensDir, "tokens.css"), "utf-8");
const typographyCss = readFileSync(
	join(tokensDir, "typography-tokens.css"),
	"utf-8",
);

/**
 * Strukturelle Absicherung der Tokenschicht gegen die Definition of Done
 * von KAN-6: Zaehlungen und Referenzen laufen gegen den Quelltext der
 * CSS-Dateien, damit ein verwaister oder umbenannter Token den Testlauf
 * bricht statt still zu verschwinden.
 */

function countMatches(haystack: string, needle: string): number {
	return haystack.split(needle).length - 1;
}

describe("tokens.css", () => {
	it("definiert alle 54 Semantic-Rollen je einmal in hell und dunkel", () => {
		expect(allSemanticTokenNames).toHaveLength(54);
		for (const name of allSemanticTokenNames) {
			expect(countMatches(tokensCss, `--${name}:`), name).toBe(2);
		}
	});

	it("bindet alle 54 Semantic-Rollen an Tailwind an", () => {
		for (const name of allSemanticTokenNames) {
			expect(tokensCss, name).toContain(`--color-${name}: var(--${name});`);
		}
	});

	it("definiert genau 36 Primitives und keinen Hex-Wert daneben", () => {
		expect(primitiveTokenNames).toHaveLength(36);
		const hexValues = tokensCss.match(/#[0-9a-f]{3,8}\b/gi) ?? [];
		expect(hexValues).toHaveLength(36);
		for (const name of primitiveTokenNames) {
			expect(countMatches(tokensCss, `--${name}: #`), name).toBe(1);
		}
	});

	it("referenziert jede Primitive aus mindestens einer Semantic-Rolle", () => {
		for (const name of primitiveTokenNames) {
			expect(
				countMatches(tokensCss, `var(--${name})`),
				name,
			).toBeGreaterThanOrEqual(1);
		}
	});

	it("definiert die sechs Radius-Stufen", () => {
		expect(radiusTokenNames).toHaveLength(6);
		for (const name of radiusTokenNames) {
			expect(
				countMatches(tokensCss, `--${name}:`),
				name,
			).toBeGreaterThanOrEqual(1);
		}
	});
});

describe("typography-tokens.css", () => {
	it("haelt die sechs fluiden Groessen als clamp()-Formeln", () => {
		const fluidSizes = [
			"--fs-display",
			"--fs-title",
			"--fs-num-rank",
			"--fs-num-stat",
			"--fs-h1",
			"--fs-h2",
		];
		for (const name of fluidSizes) {
			expect(typographyCss, name).toContain(`${name}: clamp(`);
		}
	});

	it("bildet Numeral/Rank als normal ab, nicht als gemessene Metrik", () => {
		expect(typographyCss).toContain("--lh-num-rank: normal");
	});

	it("haelt den Display-Zwischenstand als fluiden Laengenwert", () => {
		expect(typographyCss).toContain("--lh-display: clamp(");
	});
});
