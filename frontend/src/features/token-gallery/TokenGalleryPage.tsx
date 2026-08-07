import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { ThemeToggle } from "@/components/common/ThemeToggle";
import { useTheme } from "@/lib/theme";

import {
	radiusTokenNames,
	semanticTokenGroups,
	typeRoles,
} from "./tokenCatalog";

const allTokenNames = [
	...semanticTokenGroups.flatMap((group) => group.tokens),
	...radiusTokenNames,
];

/**
 * Smoke-Test-Seite der Tokenschicht (KAN-6, Abschnitt 7): jedes
 * Semantic-Token als Farbfeld mit Name und aufgeloestem Wert, dazu die
 * Radius-Stufen und die Schriftrollen mit umbrechendem Text. Diese Seite
 * ist die Abnahmegrundlage des Tickets und bleibt danach als Pruefflaeche
 * bestehen: jede Aenderung an der Tokenschicht ist hier sofort sichtbar.
 */
export default function TokenGalleryPage() {
	const { t } = useTranslation();
	const theme = useTheme();
	const [resolvedValues, setResolvedValues] = useState<Record<string, string>>(
		{},
	);

	useEffect(() => {
		/* Liest den je Modus aufgeloesten Wert (das Hex der Primitive) aus
		   dem CSSOM, damit die Pruefflaeche Alias und Ergebnis nebeneinander
		   zeigt. */
		const styles = getComputedStyle(document.documentElement);
		const next: Record<string, string> = {};
		for (const name of allTokenNames) {
			next[name] = styles.getPropertyValue(`--${name}`).trim();
		}
		setResolvedValues(next);
	}, [theme]);

	return (
		<main className="mx-auto max-w-5xl px-4 py-8">
			<header className="mb-10 flex items-start justify-between gap-4">
				<div>
					<h1 className="type-h1 text-foreground">{t("tokenGallery.title")}</h1>
					<p className="type-body mt-2 max-w-prose text-muted-foreground">
						{t("tokenGallery.intro")}
					</p>
				</div>
				<ThemeToggle />
			</header>

			<section aria-labelledby="section-semantic" className="mb-12">
				<h2 id="section-semantic" className="type-h2 text-foreground">
					{t("tokenGallery.section.semantic")}
				</h2>
				{semanticTokenGroups.map((group) => (
					<div key={group.id} className="mt-6">
						<h3 className="type-h3 text-foreground">
							{t(`tokenGallery.group.${group.id}`)}
						</h3>
						<ul className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
							{group.tokens.map((name) => (
								<li
									key={name}
									className="flex items-center gap-3 rounded-card border border-border bg-card p-3"
								>
									<span
										aria-hidden="true"
										className="h-10 w-10 shrink-0 rounded-control border border-border"
										style={{ backgroundColor: `var(--${name})` }}
									/>
									<span className="flex min-w-0 flex-col">
										<code className="type-body-sm break-all text-card-foreground">
											{name}
										</code>
										<span className="type-caption text-muted-foreground">
											{resolvedValues[name]}
										</span>
									</span>
								</li>
							))}
						</ul>
					</div>
				))}
				<div className="mt-8">
					<button
						type="button"
						className="rounded-control bg-primary px-4 py-2 font-semibold text-primary-foreground hover:bg-primary-hover"
					>
						{t("tokenGallery.primaryButtonSample")}
					</button>
				</div>
			</section>

			<section aria-labelledby="section-radius" className="mb-12">
				<h2 id="section-radius" className="type-h2 text-foreground">
					{t("tokenGallery.section.radius")}
				</h2>
				<ul className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
					{radiusTokenNames.map((name) => (
						<li key={name} className="flex flex-col items-start gap-2">
							<span
								aria-hidden="true"
								className="block h-16 w-full border-2 border-primary bg-accent"
								style={{ borderRadius: `var(--${name})` }}
							/>
							<code className="type-body-sm text-foreground">{name}</code>
							<span className="type-caption text-muted-foreground">
								{resolvedValues[name]}
							</span>
						</li>
					))}
				</ul>
			</section>

			<section aria-labelledby="section-typography">
				<h2 id="section-typography" className="type-h2 text-foreground">
					{t("tokenGallery.section.typography")}
				</h2>
				<div className="mt-4 flex flex-col gap-8">
					{typeRoles.map((role) => (
						<div key={role.className}>
							<code className="type-caption text-muted-foreground">
								.{role.className}
							</code>
							<p className={`${role.className} mt-1 text-foreground`}>
								{t(
									role.sampleKind === "numbers"
										? "tokenGallery.sample.numbers"
										: "tokenGallery.sample.paragraph",
								)}
							</p>
						</div>
					))}
				</div>
			</section>
		</main>
	);
}
