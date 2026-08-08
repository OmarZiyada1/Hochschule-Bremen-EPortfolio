#!/usr/bin/env python3
"""Werkzeug fuer die Confluence-Seite „Datenmodell & API-Contract" (Space BEH).

Warum es dieses Skript gibt: die Contract-Seite hat ein Storage-Format von rund
270.000 Zeichen. Das MCP-Werkzeug `updateConfluencePage` verlangt den gesamten
Seiteninhalt als Aufrufparameter, also muesste der komplette Text durch das
Kontextfenster des Modells laufen. Das scheitert zuverlaessig, und genau deshalb
blieb eine Versionserhoehung frueher am Menschen haengen.

Hier laeuft der grosse Text ausschliesslich ueber die Platte: `pull` legt eine
Arbeitskopie an, `show`/`find` geben nur den benoetigten Ausschnitt aus,
`replace`/`set-section`/`history-add` aendern gezielt, `push` schreibt die ganze
Datei per REST-API zurueck. Das Modell sieht nie mehr als den Abschnitt, den es
tatsaechlich bearbeitet.

Zugangsdaten kommen aus `.env.atlassian` im Wurzelverzeichnis
(ATLASSIAN_BASE_URL, ATLASSIAN_EMAIL, ATLASSIAN_API_TOKEN). Echte
Umgebungsvariablen haben Vorrang. Das Token wird nie ausgegeben.

Nur Standardbibliothek, damit keine neue Abhaengigkeit entsteht (CLAUDE.md,
Backend-Regel 9).
"""

from __future__ import annotations

import argparse
import base64
import difflib
import html
import html.entities
import json
import os
import re
import sys
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ElementTree
from datetime import datetime, timezone
from pathlib import Path

CONTRACT_PAGE_ID = "36732929"
OPEN_QUESTIONS_PAGE_ID = "1802249"
XML_PREDEFINED = {"amp", "lt", "gt", "quot", "apos"}
EM_DASH = "—"
HEADING_PATTERN = re.compile(r"<h([2-6])\b[^>]*>(.*?)</h\1>", re.S)
ENTITY_PATTERN = re.compile(r"&([a-zA-Z][a-zA-Z0-9]*);")
BLOCK_TAGS = "h1|h2|h3|h4|h5|h6|p|tr|td|th|li|blockquote|table|tbody|ul|ol|hr|ac:structured-macro"
BLOCK_BOUNDARY = re.compile(r"(?=<(?:%s)\b)" % BLOCK_TAGS)


# ---------------------------------------------------------------- Grundlagen


def die(message: str) -> "NoReturn":  # type: ignore[valid-type]
	print("FEHLER: " + message, file=sys.stderr)
	raise SystemExit(1)


def repo_root() -> Path:
	"""<root>/.claude/skills/api-contract-sync/contract.py -> <root>."""
	return Path(__file__).resolve().parents[3]


def load_credentials(env_file: Path | None) -> tuple[str, str, str]:
	path = env_file or (repo_root() / ".env.atlassian")
	values: dict[str, str] = {}
	if path.is_file():
		for line in path.read_text(encoding="utf-8").splitlines():
			line = line.strip()
			if not line or line.startswith("#") or "=" not in line:
				continue
			key, _, value = line.partition("=")
			values[key.strip()] = value.strip().strip('"').strip("'")
	base_url = os.environ.get("ATLASSIAN_BASE_URL") or values.get("ATLASSIAN_BASE_URL", "")
	email = os.environ.get("ATLASSIAN_EMAIL") or values.get("ATLASSIAN_EMAIL", "")
	token = os.environ.get("ATLASSIAN_API_TOKEN") or values.get("ATLASSIAN_API_TOKEN", "")
	missing = [
		name
		for name, value in (
			("ATLASSIAN_BASE_URL", base_url),
			("ATLASSIAN_EMAIL", email),
			("ATLASSIAN_API_TOKEN", token),
		)
		if not value
	]
	if missing:
		die(
			"%s fehlt. Erwartet in %s (Vorlage: .env.example)." % (", ".join(missing), path)
		)
	return base_url.rstrip("/"), email, token


def api(method: str, url: str, email: str, token: str, payload: dict | None = None) -> dict:
	data = json.dumps(payload).encode("utf-8") if payload is not None else None
	request = urllib.request.Request(url, data=data, method=method)
	credential = base64.b64encode(("%s:%s" % (email, token)).encode("utf-8")).decode("ascii")
	request.add_header("Authorization", "Basic " + credential)
	request.add_header("Accept", "application/json")
	if data is not None:
		request.add_header("Content-Type", "application/json")
	try:
		with urllib.request.urlopen(request, timeout=120) as response:
			raw = response.read().decode("utf-8")
	except urllib.error.HTTPError as error:
		body = error.read().decode("utf-8", "replace")[:1000]
		die("HTTP %s bei %s %s\n%s" % (error.code, method, url, body))
	except urllib.error.URLError as error:
		die("Netzwerkfehler bei %s %s: %s" % (method, url, error.reason))
	return json.loads(raw) if raw else {}


def cache_dir(page_id: str, override: str | None) -> Path:
	base = Path(override) if override else repo_root() / ".contract-cache"
	return base / page_id


def read_cache(page_id: str, override: str | None) -> tuple[Path, dict, str, str]:
	directory = cache_dir(page_id, override)
	meta_file = directory / "meta.json"
	if not meta_file.is_file():
		die("Keine Arbeitskopie fuer Seite %s. Zuerst `pull` ausfuehren." % page_id)
	meta = json.loads(meta_file.read_text(encoding="utf-8"))
	remote = (directory / "remote.xhtml").read_text(encoding="utf-8")
	working = (directory / "working.xhtml").read_text(encoding="utf-8")
	return directory, meta, remote, working


def write_working(directory: Path, body: str) -> None:
	(directory / "working.xhtml").write_text(body, encoding="utf-8", newline="")


# --------------------------------------------------------- Struktur und Text


def strip_tags(fragment: str) -> str:
	return re.sub(r"<[^>]+>", "", fragment)


def headings(body: str) -> list[dict]:
	found: list[dict] = []
	for match in HEADING_PATTERN.finditer(body):
		text = html.unescape(strip_tags(match.group(2))).strip()
		number = re.match(r"([0-9]+(?:\.[0-9]+)*)\.?(?:\s|$)", text)
		found.append(
			{
				"level": int(match.group(1)),
				"text": text,
				"number": number.group(1) if number else None,
				"start": match.start(),
				"body_start": match.end(),
			}
		)
	for index, heading in enumerate(found):
		end = len(body)
		for later in found[index + 1 :]:
			if later["level"] <= heading["level"]:
				end = later["start"]
				break
		heading["end"] = end
	return found


def find_section(body: str, wanted: str) -> dict:
	wanted = wanted.strip().lstrip("§").rstrip(".")
	candidates = [h for h in headings(body) if h["number"] == wanted]
	if not candidates:
		by_text = [h for h in headings(body) if wanted.lower() in h["text"].lower()]
		if len(by_text) == 1:
			return by_text[0]
		if not by_text:
			die("Abschnitt %s nicht gefunden. `outline` zeigt die vorhandenen." % wanted)
		die(
			"Abschnitt %s ist nicht eindeutig: %s"
			% (wanted, ", ".join(h["text"] for h in by_text))
		)
	if len(candidates) > 1:
		die("Abschnittsnummer %s kommt mehrfach vor. Das ist selbst ein Befund." % wanted)
	return candidates[0]


def unknown_entities(body: str) -> list[str]:
	names = {name for name in ENTITY_PATTERN.findall(body) if name not in XML_PREDEFINED}
	return sorted(name for name in names if (name + ";") not in html.entities.html5)


def wellformed_error(body: str) -> str | None:
	def replace(match: re.Match) -> str:
		name = match.group(1)
		if name in XML_PREDEFINED:
			return match.group(0)
		return html.entities.html5.get(name + ";", match.group(0))

	probe = ENTITY_PATTERN.sub(replace, body)
	document = (
		'<root xmlns:ac="urn:probe:ac" xmlns:ri="urn:probe:ri" xmlns:at="urn:probe:at">'
		+ probe
		+ "</root>"
	)
	try:
		ElementTree.fromstring(document)
	except ElementTree.ParseError as error:
		line, column = error.position
		snippet = ""
		lines = document.splitlines() or [document]
		if line - 1 < len(lines):
			snippet = lines[line - 1][max(0, column - 120) : column + 120]
		return "%s\n  Umgebung: ...%s..." % (error, snippet)
	return None


def pretty_lines(body: str) -> list[str]:
	return BLOCK_BOUNDARY.sub("\n", body).strip().splitlines()


def contract_version(body: str) -> str | None:
	"""Die fachliche Contract-Version ist die letzte Zeile der Tabelle in §10."""
	try:
		section = find_section(body, "10")
	except SystemExit:
		return None
	versions = re.findall(r"<td\b[^>]*>\s*<p\b[^>]*>\s*(v\d+)\s*</p>", body[section["start"] : section["end"]])
	return versions[-1] if versions else None


# -------------------------------------------------------------------- Befehle


def cmd_pull(args: argparse.Namespace) -> None:
	base_url, email, token = load_credentials(args.env_file)
	url = "%s/wiki/api/v2/pages/%s?body-format=storage" % (base_url, args.page)
	page = api("GET", url, email, token)
	body = page["body"]["storage"]["value"]
	directory = cache_dir(args.page, args.cache)
	working_file = directory / "working.xhtml"
	if working_file.is_file() and not args.force:
		old_remote = (directory / "remote.xhtml").read_text(encoding="utf-8")
		if working_file.read_text(encoding="utf-8") != old_remote:
			die(
				"Die Arbeitskopie %s enthaelt ungespeicherte Aenderungen. Erst `push`, "
				"oder `pull --force` zum Verwerfen." % working_file
			)
	directory.mkdir(parents=True, exist_ok=True)
	(directory / "remote.xhtml").write_text(body, encoding="utf-8", newline="")
	write_working(directory, body)
	meta = {
		"pageId": str(page["id"]),
		"title": page["title"],
		"spaceId": page.get("spaceId"),
		"pageVersion": page["version"]["number"],
		"versionMessage": page["version"].get("message", ""),
		"baseUrl": base_url,
		"pulledAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
	}
	(directory / "meta.json").write_text(
		json.dumps(meta, indent=2, ensure_ascii=False), encoding="utf-8"
	)
	print("Seite:            %s (ID %s)" % (meta["title"], meta["pageId"]))
	print("Seitenversion:    %s" % meta["pageVersion"])
	print("Versionskommentar: %s" % (meta["versionMessage"] or "(keiner)"))
	print("Contract-Version: %s (letzte Zeile der Tabelle in §10)" % (contract_version(body) or "nicht erkannt"))
	print("Groesse:          %d Zeichen" % len(body))
	print("Arbeitskopie:     %s" % working_file)


def cmd_outline(args: argparse.Namespace) -> None:
	_, _, _, working = read_cache(args.page, args.cache)
	for heading in headings(working):
		if heading["level"] > args.depth + 1:
			continue
		indent = "  " * (heading["level"] - 2)
		print(
			"%-6s %s%s   [%d Zeichen, Offset %d]"
			% (
				heading["number"] or "-",
				indent,
				heading["text"],
				heading["end"] - heading["start"],
				heading["start"],
			)
		)


def cmd_show(args: argparse.Namespace) -> None:
	_, _, _, working = read_cache(args.page, args.cache)
	section = find_section(working, args.section)
	fragment = working[section["start"] : section["end"]]
	if args.body_only:
		fragment = working[section["body_start"] : section["end"]]
	if args.plain:
		fragment = html.unescape(re.sub(r"<[^>]+>", " ", fragment))
		fragment = re.sub(r"[ \t]{2,}", " ", fragment)
	print(
		"# %s  (Offset %d..%d, %d Zeichen)"
		% (section["text"], section["start"], section["end"], section["end"] - section["start"])
	)
	if len(fragment) > args.max and not args.full:
		print(fragment[: args.max])
		print(
			"\n... gekuerzt bei %d von %d Zeichen. Mit --full oder einem tieferen "
			"Abschnitt vollstaendig lesen." % (args.max, len(fragment))
		)
	else:
		print(fragment)


def cmd_find(args: argparse.Namespace) -> None:
	_, _, _, working = read_cache(args.page, args.cache)
	pattern = re.compile(args.pattern, 0 if args.case_sensitive else re.IGNORECASE)
	structure = headings(working)
	count = 0
	for match in pattern.finditer(working):
		count += 1
		if count > args.limit:
			print("... weitere Treffer unterdrueckt (--limit erhoehen)")
			break
		section = "-"
		for heading in structure:
			if heading["start"] <= match.start() < heading["end"]:
				section = heading["number"] or heading["text"][:24]
		context = working[max(0, match.start() - args.context) : match.end() + args.context]
		if args.plain:
			context = html.unescape(re.sub(r"<[^>]+>", " ", context))
			context = re.sub(r"\s{2,}", " ", context)
		print("§%s @%d: %s" % (section, match.start(), context))
		print()
	if count == 0:
		print("Kein Treffer fuer %r" % args.pattern)
	else:
		print("Treffer gesamt: %d" % count)


def _fragment(text: str | None, file: str | None, label: str) -> str:
	if (text is None) == (file is None):
		die("Genau eines von --%s / --%s-file angeben." % (label, label))
	if file is not None:
		return Path(file).read_text(encoding="utf-8")
	return text or ""


def cmd_replace(args: argparse.Namespace) -> None:
	directory, _, _, working = read_cache(args.page, args.cache)
	old = _fragment(args.old, args.old_file, "old")
	new = _fragment(args.new, args.new_file, "new")
	if not old:
		die("Der zu ersetzende Text darf nicht leer sein.")
	occurrences = working.count(old)
	if occurrences == 0:
		die(
			"Der zu ersetzende Text kommt nicht vor. Storage-Format beachten: "
			"Umlaute stehen als &auml; usw., § als &sect;. Mit `find` pruefen."
		)
	if occurrences != args.count and not args.all:
		die(
			"Der Text kommt %d mal vor, erwartet waren %d. Mit mehr Kontext eindeutig "
			"machen oder --count/--all setzen." % (occurrences, args.count)
		)
	updated = working.replace(old, new) if args.all else working.replace(old, new, args.count)
	write_working(directory, updated)
	print("Ersetzt: %d Vorkommen, %+d Zeichen." % (occurrences if args.all else args.count, len(updated) - len(working)))
	print("Naechster Schritt: `check`, dann `diff`, dann `push`.")


def cmd_set_section(args: argparse.Namespace) -> None:
	directory, _, _, working = read_cache(args.page, args.cache)
	section = find_section(working, args.section)
	replacement = Path(args.file).read_text(encoding="utf-8")
	start = section["body_start"] if args.body_only else section["start"]
	updated = working[:start] + replacement + working[section["end"] :]
	write_working(directory, updated)
	print(
		"Abschnitt %s ersetzt: %d -> %d Zeichen."
		% (section["text"], section["end"] - start, len(replacement))
	)
	print("Naechster Schritt: `check`, dann `diff`, dann `push`.")


def cmd_set_body(args: argparse.Namespace) -> None:
	directory, _, _, working = read_cache(args.page, args.cache)
	replacement = Path(args.file).read_text(encoding="utf-8")
	write_working(directory, replacement)
	print("Gesamter Seitenkoerper ersetzt: %d -> %d Zeichen." % (len(working), len(replacement)))
	print("Achtung: `diff` genau lesen, hier faellt am schnellsten Text unter den Tisch.")


def cmd_history_add(args: argparse.Namespace) -> None:
	directory, _, _, working = read_cache(args.page, args.cache)
	section = find_section(working, args.section)
	fragment = working[section["start"] : section["end"]]
	existing = re.findall(r"<td\b[^>]*>\s*<p\b[^>]*>\s*(v\d+)\s*</p>", fragment)
	if args.version in existing:
		die("%s steht bereits in der Aenderungshistorie." % args.version)
	text = _fragment(args.text, args.text_file, "text")
	if EM_DASH in text or EM_DASH in args.sections:
		die("Gedankenstrich %s im neuen Text. Schreibstil-Regel in CLAUDE.md." % EM_DASH)
	closing = fragment.rfind("</tbody>")
	if closing == -1:
		die("In Abschnitt %s wurde keine Tabelle gefunden." % section["text"])
	row = "<tr><td><p>%s </p></td><td><p>%s </p></td><td><p>%s</p></td></tr>" % (
		args.version,
		args.sections,
		text,
	)
	insert_at = section["start"] + closing
	updated = working[:insert_at] + row + working[insert_at:]
	write_working(directory, updated)
	print("Zeile fuer %s in §%s ergaenzt (nach %s)." % (args.version, section["number"], existing[-1] if existing else "-"))
	print("Naechster Schritt: `check`, dann `diff`, dann `push --message \"%s: ... (KAN-<nr>)\"`." % args.version)


def cmd_check(args: argparse.Namespace) -> None:
	_, meta, remote, working = read_cache(args.page, args.cache)
	problems: list[str] = []
	unknown = unknown_entities(working)
	if unknown:
		problems.append(
			"Unbekannte Entities, Confluence lehnt sie ab: %s" % ", ".join("&%s;" % n for n in unknown)
		)
	error = wellformed_error(working)
	if error:
		problems.append("Storage-Format nicht wohlgeformt:\n  " + error)
	added_dashes = working.count(EM_DASH) - remote.count(EM_DASH)
	if added_dashes > 0:
		problems.append(
			"%d neue Gedankenstriche %s. Schreibstil-Regel in CLAUDE.md." % (added_dashes, EM_DASH)
		)
	removed = len(remote) - len(working)
	if removed > args.shrink_limit:
		problems.append(
			"Die Arbeitskopie ist um %d Zeichen kuerzer als das Original. Bestehender "
			"Inhalt wird nicht geloescht, nur ergaenzt (Skill api-contract-sync). "
			"Mit --shrink-limit erlauben, wenn die Kuerzung gewollt ist." % removed
		)
	print("Seite %s, Seitenversion %s" % (meta["pageId"], meta["pageVersion"]))
	print("Contract-Version lokal: %s (Original: %s)" % (contract_version(working), contract_version(remote)))
	print("Groesse: %d -> %d Zeichen (%+d)" % (len(remote), len(working), len(working) - len(remote)))
	if problems:
		for problem in problems:
			print("\nBEFUND: " + problem)
		raise SystemExit(1)
	print("\nIn Ordnung: wohlgeformt, Entities bekannt, kein neuer Gedankenstrich, nichts weggefallen.")


def cmd_diff(args: argparse.Namespace) -> None:
	_, _, remote, working = read_cache(args.page, args.cache)
	if remote == working:
		print("Keine Aenderung gegenueber der gezogenen Fassung.")
		return
	before, after = pretty_lines(remote), pretty_lines(working)
	if args.plain:
		clean = lambda lines: [re.sub(r"\s{2,}", " ", html.unescape(re.sub(r"<[^>]+>", " ", l))).strip() for l in lines]
		before, after = clean(before), clean(after)
	printed = 0
	for line in difflib.unified_diff(before, after, "remote", "working", n=args.context, lineterm=""):
		print(line[: args.width] + (" ..." if len(line) > args.width else ""))
		printed += 1
		if printed >= args.limit:
			print("... Diff gekuerzt (--limit erhoehen)")
			break


def cmd_push(args: argparse.Namespace) -> None:
	directory, meta, remote, working = read_cache(args.page, args.cache)
	if working == remote and not args.allow_empty:
		die("Keine Aenderung gegenueber der gezogenen Fassung, es gibt nichts zu speichern.")
	if unknown_entities(working) or wellformed_error(working):
		die("`check` schlaegt fehl. Erst dort alles gruen bekommen, dann pushen.")
	if str(args.page) == CONTRACT_PAGE_ID and not re.match(r"^v\d+: .+ \(KAN-\d+\)$", args.message):
		die(
			"Versionskommentar muss `v<N>: <Kurzfassung> (KAN-<nr>)` lauten "
			"(Skill api-contract-sync). Bekommen: %r" % args.message
		)
	base_url, email, token = load_credentials(args.env_file)
	url = "%s/wiki/api/v2/pages/%s" % (base_url, args.page)
	current = api("GET", url + "?body-format=storage", email, token)
	if current["version"]["number"] != meta["pageVersion"] and not args.force:
		die(
			"Die Seite steht inzwischen auf Version %s, gezogen wurde Version %s. "
			"Jemand anders hat gespeichert. Erst `pull`, Aenderung neu setzen, dann `push`."
			% (current["version"]["number"], meta["pageVersion"])
		)
	next_version = current["version"]["number"] + 1
	if args.dry_run:
		print("Probelauf: PUT %s" % url)
		print("Neue Seitenversion: %d" % next_version)
		print("Versionskommentar:  %s" % args.message)
		print("Koerper:            %d Zeichen (%+d)" % (len(working), len(working) - len(remote)))
		return
	payload = {
		"id": str(args.page),
		"status": "current",
		"title": current["title"],
		"body": {"representation": "storage", "value": working},
		"version": {"number": next_version, "message": args.message},
	}
	result = api("PUT", url, email, token, payload)
	(directory / "remote.xhtml").write_text(working, encoding="utf-8", newline="")
	meta["pageVersion"] = result["version"]["number"]
	meta["versionMessage"] = result["version"].get("message", args.message)
	meta["pulledAt"] = datetime.now(timezone.utc).isoformat(timespec="seconds")
	(directory / "meta.json").write_text(
		json.dumps(meta, indent=2, ensure_ascii=False), encoding="utf-8"
	)
	print("Gespeichert. Neue Seitenversion: %s" % result["version"]["number"])
	print("Versionskommentar: %s" % meta["versionMessage"])
	print("%s/wiki/spaces/BEH/pages/%s" % (base_url, args.page))


def cmd_verify(args: argparse.Namespace) -> None:
	directory, meta, _, working = read_cache(args.page, args.cache)
	base_url, email, token = load_credentials(args.env_file)
	url = "%s/wiki/api/v2/pages/%s?body-format=storage" % (base_url, args.page)
	page = api("GET", url, email, token)
	live = page["body"]["storage"]["value"]
	print("Seitenversion online: %s (lokal vermerkt: %s)" % (page["version"]["number"], meta["pageVersion"]))
	print("Versionskommentar:    %s" % page["version"].get("message", "(keiner)"))
	print("Contract-Version:     %s" % contract_version(live))
	if live == working:
		print("Online-Fassung und Arbeitskopie sind identisch.")
		return
	print(
		"Unterschied: online %d Zeichen, Arbeitskopie %d Zeichen. Confluence "
		"normalisiert beim Speichern (local-id-Attribute), deshalb ist ein kleiner "
		"Unterschied normal. Mit `pull --force` die normalisierte Fassung holen."
		% (len(live), len(working))
	)
	(directory / "remote.xhtml").write_text(live, encoding="utf-8", newline="")


def cmd_status(args: argparse.Namespace) -> None:
	directory = cache_dir(args.page, args.cache)
	if not (directory / "meta.json").is_file():
		print("Keine Arbeitskopie fuer Seite %s. `pull` ausfuehren." % args.page)
		return
	_, meta, remote, working = read_cache(args.page, args.cache)
	print("Seite:            %s (ID %s)" % (meta["title"], meta["pageId"]))
	print("Gezogen:          %s, Seitenversion %s" % (meta["pulledAt"], meta["pageVersion"]))
	print("Contract-Version: %s" % contract_version(working))
	print(
		"Arbeitskopie:     %s (%+d Zeichen)"
		% ("geaendert" if working != remote else "unveraendert", len(working) - len(remote))
	)


# ----------------------------------------------------------------- Verdrahtung


def build_parser() -> argparse.ArgumentParser:
	parser = argparse.ArgumentParser(
		prog="contract.py",
		description="Confluence-Contract lesen und schreiben, ohne den ganzen Text durch das Kontextfenster zu ziehen.",
	)
	parser.add_argument("--page", default=CONTRACT_PAGE_ID, help="Seiten-ID (Standard: Contract %s)" % CONTRACT_PAGE_ID)
	parser.add_argument("--cache", default=None, help="Ablage der Arbeitskopie (Standard: <repo>/.contract-cache)")
	parser.add_argument("--env-file", default=None, type=Path, help="Standard: <repo>/.env.atlassian")
	sub = parser.add_subparsers(dest="command", required=True)

	p = sub.add_parser("pull", help="Seite holen und Arbeitskopie anlegen")
	p.add_argument("--force", action="store_true", help="ungespeicherte Aenderungen verwerfen")
	p.set_defaults(func=cmd_pull)

	p = sub.add_parser("status", help="Kurzuebersicht ueber die Arbeitskopie")
	p.set_defaults(func=cmd_status)

	p = sub.add_parser("outline", help="Ueberschriften mit Groesse und Offset")
	p.add_argument("--depth", type=int, default=2, help="1 = nur h2, 2 = bis h3 (Standard), 3 = bis h4")
	p.set_defaults(func=cmd_outline)

	p = sub.add_parser("show", help="einen Abschnitt ausgeben, zum Beispiel 6.2")
	p.add_argument("section")
	p.add_argument("--plain", action="store_true", help="Tags entfernen, nur Prosa")
	p.add_argument("--body-only", action="store_true", help="ohne die Ueberschrift selbst")
	p.add_argument("--max", type=int, default=20000, help="Zeichenobergrenze (Standard 20000)")
	p.add_argument("--full", action="store_true", help="Obergrenze aufheben")
	p.set_defaults(func=cmd_show)

	p = sub.add_parser("find", help="regulaeren Ausdruck in der Arbeitskopie suchen")
	p.add_argument("pattern")
	p.add_argument("--context", type=int, default=160)
	p.add_argument("--limit", type=int, default=20)
	p.add_argument("--plain", action="store_true", help="Treffer ohne Tags anzeigen")
	p.add_argument("--case-sensitive", action="store_true")
	p.set_defaults(func=cmd_find)

	p = sub.add_parser("replace", help="eindeutige Textstelle ersetzen")
	p.add_argument("--old")
	p.add_argument("--old-file")
	p.add_argument("--new")
	p.add_argument("--new-file")
	p.add_argument("--count", type=int, default=1, help="erwartete Anzahl Vorkommen (Standard 1)")
	p.add_argument("--all", action="store_true", help="alle Vorkommen ersetzen")
	p.set_defaults(func=cmd_replace)

	p = sub.add_parser("set-section", help="Abschnitt vollstaendig durch eine Datei ersetzen")
	p.add_argument("section")
	p.add_argument("--file", required=True)
	p.add_argument("--body-only", action="store_true", help="Ueberschrift stehen lassen")
	p.set_defaults(func=cmd_set_section)

	p = sub.add_parser("set-body", help="gesamten Seitenkoerper durch eine Datei ersetzen")
	p.add_argument("--file", required=True)
	p.set_defaults(func=cmd_set_body)

	p = sub.add_parser("history-add", help="Zeile in die Aenderungshistorie ergaenzen")
	p.add_argument("--version", required=True, help="zum Beispiel v23")
	p.add_argument("--sections", required=True, help="zum Beispiel '&sect;6.1, &sect;6.2, &sect;8'")
	p.add_argument("--text", help="Aenderung und Grund als Storage-XHTML")
	p.add_argument("--text-file")
	p.add_argument("--section", default="10", help="Abschnitt mit der Historientabelle (Standard 10)")
	p.set_defaults(func=cmd_history_add)

	p = sub.add_parser("check", help="Wohlgeformtheit, Entities, Gedankenstriche, Schrumpfung")
	p.add_argument("--shrink-limit", type=int, default=0, help="erlaubter Zeichenverlust (Standard 0)")
	p.set_defaults(func=cmd_check)

	p = sub.add_parser("diff", help="Arbeitskopie gegen die gezogene Fassung")
	p.add_argument("--plain", action="store_true", help="ohne Tags, nur Prosa")
	p.add_argument("--context", type=int, default=1)
	p.add_argument("--limit", type=int, default=200, help="maximale Diff-Zeilen")
	p.add_argument("--width", type=int, default=400, help="maximale Zeilenbreite")
	p.set_defaults(func=cmd_diff)

	p = sub.add_parser("push", help="Arbeitskopie speichern (neue Seitenversion)")
	p.add_argument("--message", required=True, help="v<N>: <Kurzfassung> (KAN-<nr>)")
	p.add_argument("--dry-run", action="store_true")
	p.add_argument("--force", action="store_true", help="auch speichern, wenn die Seite inzwischen bewegt wurde")
	p.add_argument("--allow-empty", action="store_true")
	p.set_defaults(func=cmd_push)

	p = sub.add_parser("verify", help="nach dem Speichern gegen die Online-Fassung pruefen")
	p.set_defaults(func=cmd_verify)

	return parser


def main() -> None:
	for stream in (sys.stdout, sys.stderr):
		try:
			stream.reconfigure(encoding="utf-8", errors="replace")  # type: ignore[attr-defined]
		except AttributeError:
			pass
	args = build_parser().parse_args()
	args.func(args)


if __name__ == "__main__":
	main()
