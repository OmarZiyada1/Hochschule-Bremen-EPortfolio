import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import de from "@/i18n/de.json";

import HomePage from "./HomePage";

describe("HomePage", () => {
	it("zeigt den Projektnamen als Ueberschrift", () => {
		render(
			<MemoryRouter>
				<HomePage />
			</MemoryRouter>,
		);

		expect(
			screen.getByRole("heading", { level: 1, name: de.common.app.title }),
		).toBeInTheDocument();
		expect(screen.getByText(de.home.setupNotice)).toBeInTheDocument();
	});
});
