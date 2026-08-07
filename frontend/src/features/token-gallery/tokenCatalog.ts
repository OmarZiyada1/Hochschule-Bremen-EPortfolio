/**
 * Katalog der Tokenschicht fuer die Pruefflaeche und die Tests.
 *
 * Die Namen muessen eins zu eins mit den Figma-Collections uebereinstimmen,
 * gespiegelt auf der Confluence-Seite "Foundation" (Stand 07.08.2026:
 * 36 Primitives, 54 Semantic-Rollen, 6 Radien). Ein neuer oder entfernter
 * Token wird hier nachgezogen; die Tests zaehlen nach.
 */

export type SemanticTokenGroup = {
	/** Schluesselbestandteil fuer i18n: tokenGallery.group.<id> */
	id: string;
	tokens: string[];
};

export const semanticTokenGroups: SemanticTokenGroup[] = [
	{
		id: "surfaceText",
		tokens: [
			"background",
			"foreground",
			"card",
			"card-foreground",
			"popover",
			"popover-foreground",
			"muted",
			"muted-foreground",
			"text-disabled",
			"text-placeholder",
		],
	},
	{
		id: "interaction",
		tokens: [
			"primary",
			"primary-foreground",
			"primary-hover",
			"secondary",
			"secondary-foreground",
			"accent",
			"accent-foreground",
			"destructive",
			"destructive-foreground",
			"destructive-hover",
			"border",
			"input",
			"ring",
			"ring-offset",
		],
	},
	{
		id: "sidebar",
		tokens: [
			"sidebar",
			"sidebar-foreground",
			"sidebar-accent",
			"sidebar-border",
		],
	},
	{
		id: "status",
		tokens: [
			"status-draft-bg",
			"status-draft-fg",
			"status-submitted-bg",
			"status-submitted-fg",
			"status-approved-bg",
			"status-approved-fg",
			"status-published-bg",
			"status-published-fg",
			"status-revision-bg",
			"status-revision-fg",
		],
	},
	{
		id: "role",
		tokens: [
			"role-student-bg",
			"role-student-fg",
			"role-editor-bg",
			"role-editor-fg",
			"role-admin-bg",
			"role-admin-fg",
		],
	},
	{
		id: "badgeNeutral",
		tokens: ["badge-neutral-bg", "badge-neutral-fg"],
	},
	{
		id: "brandSurface",
		tokens: [
			"surface-brand",
			"surface-brand-foreground",
			"surface-highlight",
			"surface-brand-muted",
		],
	},
	{
		id: "feedback",
		tokens: ["warning", "warning-foreground", "success", "success-foreground"],
	},
];

export const allSemanticTokenNames: string[] = semanticTokenGroups.flatMap(
	(group) => group.tokens,
);

export const radiusTokenNames: string[] = [
	"radius-none",
	"radius-selection",
	"radius-control",
	"radius-card",
	"radius-modal",
	"radius-pill",
];

export type TypeRole = {
	className: string;
	/** Beispieltext: Fliesstext oder Zahlenreihe (Numeral-Rollen). */
	sampleKind: "paragraph" | "numbers";
};

export const typeRoles: TypeRole[] = [
	{ className: "type-display", sampleKind: "paragraph" },
	{ className: "type-title", sampleKind: "paragraph" },
	{ className: "type-h1", sampleKind: "paragraph" },
	{ className: "type-h2", sampleKind: "paragraph" },
	{ className: "type-h3", sampleKind: "paragraph" },
	{ className: "type-num-rank", sampleKind: "numbers" },
	{ className: "type-num-stat", sampleKind: "numbers" },
	{ className: "type-body-lg", sampleKind: "paragraph" },
	{ className: "type-body", sampleKind: "paragraph" },
	{ className: "type-body-sm", sampleKind: "paragraph" },
	{ className: "type-caption", sampleKind: "paragraph" },
	{ className: "type-overline", sampleKind: "paragraph" },
];
