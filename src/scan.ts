import { App, CachedMetadata, ReferenceCache, TFile, resolveSubpath } from 'obsidian';
import { Edit, blockId, isBlockSubpath, rewriteLink, safeDecode, splitLink, suggestHeading, targetHeading } from './links';

export interface BrokenLink {
	/** The note that contains the link. */
	source: TFile;
	/** The note the link points at. */
	target: TFile;
	/** 0-based line of the link in the source note. */
	line: number;
	/** The link exactly as written, e.g. "[[Note#Old heading|alias]]". */
	original: string;
	/** True for block references ("#^id"), false for headings. */
	isBlock: boolean;
	/** The heading or block id the link asks for. */
	wanted: string;
	/** The closest existing heading, or null when there is none to suggest. */
	suggestion: string | null;
	/** The edit that applies the suggestion, or null when it can't be fixed automatically. */
	edit: Edit | null;
}

const MARKDOWN_EXTENSION = 'md';

function referencesOf(cache: CachedMetadata): ReferenceCache[] {
	return [...(cache.links ?? []), ...(cache.embeds ?? [])];
}

function checkReference(app: App, source: TFile, ref: ReferenceCache): BrokenLink | null {
	// Markdown links may keep %20-style escapes; decode so "#Old%20part" matches the heading "Old part".
	const { path, subpath } = splitLink(safeDecode(ref.link));
	if (subpath === '' || subpath === '#') return null;
	const target = path === '' ? source : app.metadataCache.getFirstLinkpathDest(path, source.path);
	// Missing notes are already shown by Obsidian, and images or PDFs use "#" for other things.
	if (!target || target.extension !== MARKDOWN_EXTENSION) return null;
	const targetCache = app.metadataCache.getFileCache(target);
	if (!targetCache || resolveSubpath(targetCache, subpath) !== null) return null;

	const isBlock = isBlockSubpath(subpath);
	const wanted = isBlock ? blockId(subpath) : targetHeading(subpath);
	const headings = (targetCache.headings ?? []).map((h) => h.heading);
	const suggestion = isBlock ? null : suggestHeading(wanted, headings);
	const replacement = suggestion === null ? null : rewriteLink(ref.original, ref.link, suggestion);
	const edit =
		replacement === null
			? null
			: { start: ref.position.start.offset, end: ref.position.end.offset, expected: ref.original, replacement };

	return { source, target, line: ref.position.start.line, original: ref.original, isBlock, wanted, suggestion, edit };
}

/** Find heading and block links that no longer resolve, in the given notes. */
export function findBrokenLinks(app: App, files: readonly TFile[]): BrokenLink[] {
	return files.flatMap((source) => {
		const cache = app.metadataCache.getFileCache(source);
		if (!cache) return [];
		return referencesOf(cache)
			.map((ref) => checkReference(app, source, ref))
			.filter((broken): broken is BrokenLink => broken !== null);
	});
}
