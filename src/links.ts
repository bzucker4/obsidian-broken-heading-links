// Pure helpers for heading and block links. No Obsidian imports, so they can be unit tested in Node.

/** Characters Obsidian does not allow inside a heading link; it treats them as spaces. */
const LINK_UNSAFE_CHARS = new Set(['#', '|', '^', ':', '%', '[', ']', '\\']);

/** Minimum similarity (0 to 1) for a heading to be offered as the fix. */
export const MIN_SUGGESTION_SCORE = 0.5;

export interface SplitLink {
	/** The note part, empty for a link to the same note ("#Heading"). */
	path: string;
	/** Everything from the first "#", or "" when there is none. */
	subpath: string;
}

/** Split "Note#Heading" into its note path and "#Heading" subpath, like Obsidian's parseLinktext. */
export function splitLink(link: string): SplitLink {
	const hash = link.indexOf('#');
	return hash < 0 ? { path: link, subpath: '' } : { path: link.slice(0, hash), subpath: link.slice(hash) };
}

/** Decode %20-style escapes from markdown links; text that isn't valid encoding is returned unchanged. */
export function safeDecode(text: string): string {
	try {
		return decodeURIComponent(text);
	} catch {
		return text;
	}
}

/** How a block reference subpath starts, as in "#^abc123". */
const BLOCK_PREFIX = '#^';

/** True for block references such as "#^abc123". */
export const isBlockSubpath = (subpath: string): boolean => subpath.startsWith(BLOCK_PREFIX);

/** The block id in a block reference subpath: "abc123" for "#^abc123". */
export const blockId = (subpath: string): string => subpath.slice(BLOCK_PREFIX.length);

/** The heading a subpath points at: the last segment of "#H1#H2", or "" if none. */
export const targetHeading = (subpath: string): string =>
	subpath
		.split('#')
		.filter((part) => part.trim() !== '')
		.pop()
		?.trim() ?? '';

/** Collapse runs of whitespace to single spaces and trim. */
const collapseSpaces = (text: string): string =>
	text
		.split(' ')
		.filter((part) => part !== '')
		.join(' ');

/** Heading text as it can appear inside a link: unsafe characters become spaces. */
export const headingForLink = (heading: string): string =>
	collapseSpaces([...heading].map((ch) => (LINK_UNSAFE_CHARS.has(ch) || ch.trim() === '' ? ' ' : ch)).join(''));

const normalize = (text: string): string => headingForLink(text).toLowerCase();

/** Levenshtein edit distance, computed one row at a time. */
function editDistance(a: string, b: string): number {
	const first = Array.from({ length: b.length + 1 }, (_v, j) => j);
	const last = [...a].reduce<number[]>(
		(prev, charA, i) =>
			[...b].reduce<number[]>(
				(row, charB, j) => [...row, Math.min(prev[j + 1] + 1, row[j] + 1, prev[j] + (charA === charB ? 0 : 1))],
				[i + 1],
			),
		first,
	);
	return last[b.length];
}

/** Similarity from 0 (nothing alike) to 1 (identical), ignoring case and link-unsafe characters. */
export function similarity(a: string, b: string): number {
	const x = normalize(a);
	const y = normalize(b);
	const longest = Math.max(x.length, y.length);
	return longest === 0 ? 1 : 1 - editDistance(x, y) / longest;
}

/**
 * The existing heading closest to the one a broken link asks for, in link-safe form,
 * or null when none is similar enough to suggest.
 */
export function suggestHeading(wanted: string, headings: readonly string[], minScore = MIN_SUGGESTION_SCORE): string | null {
	const best = headings
		.map((heading) => ({ heading, score: similarity(wanted, heading) }))
		.reduce<{ heading: string; score: number } | null>((top, cur) => (top === null || cur.score > top.score ? cur : top), null);
	return best !== null && best.score >= minScore ? headingForLink(best.heading) : null;
}

/** The characters between a markdown link's text and its URL. */
const URL_START = '](';

/** True when the link was written as a wikilink ([[...]] or ![[...]]) rather than a markdown link. */
export const isWikilink = (original: string): boolean => original.startsWith('[[') || original.startsWith('![[');

/**
 * Rewrite a link so it points at newHeading, keeping its note path, alias and embed marker.
 * Returns null when the link text can't be rewritten safely.
 */
export function rewriteLink(original: string, link: string, newHeading: string): string | null {
	const { path } = splitLink(link);
	if (isWikilink(original)) {
		const at = original.indexOf(link);
		return at < 0 ? null : original.slice(0, at) + `${path}#${newHeading}` + original.slice(at + link.length);
	}
	// Markdown link: [text](path.md#Heading%20text)
	const open = original.lastIndexOf(URL_START);
	const close = original.lastIndexOf(')');
	if (open < 0 || close < open) return null;
	const url = original.slice(open + URL_START.length, close);
	const hash = url.indexOf('#');
	const urlPath = hash < 0 ? url : url.slice(0, hash);
	const encoded = newHeading.split(' ').join('%20');
	return original.slice(0, open + URL_START.length) + `${urlPath}#${encoded}` + original.slice(close);
}

/** Replace text between two offsets, but only if it still matches what was scanned. */
export function replaceAt(data: string, start: number, end: number, expected: string, replacement: string): string | null {
	return data.slice(start, end) === expected ? data.slice(0, start) + replacement + data.slice(end) : null;
}

export interface Edit {
	start: number;
	end: number;
	expected: string;
	replacement: string;
}

/**
 * Apply several edits to one file. Edits whose text no longer matches are skipped.
 * Returns the new text and how many edits were applied.
 */
export function applyEdits(data: string, edits: readonly Edit[]): { text: string; applied: number } {
	// Apply from the end of the file backwards so earlier offsets stay valid.
	const ordered = [...edits].sort((a, b) => b.start - a.start);
	return ordered.reduce(
		(acc, edit) => {
			const next = replaceAt(acc.text, edit.start, edit.end, edit.expected, edit.replacement);
			return next === null ? acc : { text: next, applied: acc.applied + 1 };
		},
		{ text: data, applied: 0 },
	);
}
