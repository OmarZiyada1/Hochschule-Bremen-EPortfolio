import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import de from "@/i18n/de.json";

import TokenGalleryPage from "./TokenGalleryPage";
import {
	allSemanticTokenNames,
	radiusTokenNames,
	typeRoles,
} from "./tokenCatalog";

describe("TokenGalleryPage", () => {
	it("zeigt alle 54 Semantic-Rollen und alle 6 Radius-Stufen", () => {
		render(<TokenGalleryPage />);

		expect(allSemanticTokenNames).toHaveLength(54);
		for (const name of allSemanticTokenNames) {
			expect(screen.getByText(name)).toBeInTheDocument();
		}

		expect(radiusTokenNames).toHaveLength(6);
		for (const name of radiusTokenNames) {
			expect(screen.getByText(name)).toBeInTheDocument();
		}
	});

	it("zeigt jede Schriftrolle mit Beispieltext", () => {
		render(<TokenGalleryPage />);

		for (const role of typeRoles) {
			expect(screen.getByText(`.${role.className}`)).toBeInTheDocument();
		}
		expect(
			screen.getAllByText(de.tokenGallery.sample.paragraph).length,
		).toBeGreaterThanOrEqual(1);
		expect(
			screen.getAllByText(de.tokenGallery.sample.numbers).length,
		).toBeGreaterThanOrEqual(1);
	});

	it("schaltet zwischen hell und dunkel ohne Neuladen um", async () => {
		const user = userEvent.setup();
		render(<TokenGalleryPage />);

		await user.click(
			screen.getByRole("button", { name: de.common.theme.switchToDark }),
		);
		expect(document.documentElement.classList.contains("dark")).toBe(true);
		expect(window.localStorage.getItem("theme")).toBe("dark");

		await user.click(
			screen.getByRole("button", { name: de.common.theme.switchToLight }),
		);
		expect(document.documentElement.classList.contains("dark")).toBe(false);
		expect(window.localStorage.getItem("theme")).toBe("light");
	});
});
