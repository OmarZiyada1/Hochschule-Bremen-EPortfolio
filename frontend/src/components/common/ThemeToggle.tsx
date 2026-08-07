import { Moon, Sun } from "lucide-react";
import { useTranslation } from "react-i18next";

import { setTheme, useTheme } from "@/lib/theme";

/**
 * Schalter zwischen hellem und dunklem Farbschema (KAN-6, Abschnitt 4).
 * Wechselt nur die Klasse "dark" an <html>; die Farben selbst kommen
 * vollstaendig aus der Semantic-Ebene der Tokenschicht.
 */
export function ThemeToggle() {
	const { t } = useTranslation();
	const theme = useTheme();
	const isDark = theme === "dark";

	return (
		<button
			type="button"
			onClick={() => setTheme(isDark ? "light" : "dark")}
			aria-label={t(
				isDark ? "common.theme.switchToLight" : "common.theme.switchToDark",
			)}
			className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-control border border-border bg-card text-card-foreground hover:bg-muted"
		>
			{isDark ? (
				<Sun aria-hidden="true" className="h-5 w-5" />
			) : (
				<Moon aria-hidden="true" className="h-5 w-5" />
			)}
		</button>
	);
}
