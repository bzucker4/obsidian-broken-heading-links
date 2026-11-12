import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
	applyEdits,
	blockId,
	headingForLink,
	isBlockSubpath,
	MIN_SUGGESTION_SCORE,
	replaceAt,
	rewriteLink,
	safeDecode,
	similarity,
	splitLink,
	suggestHeading,
	targetHeading,
} from '../src/links';

/** Similarity a one-letter typo in a long heading should clear easily. */
const NEAR_MATCH = 0.9;

/** Build an edit that targets the first occurrence of `original` in `data`. */
const editFor = (data: string, original: string, replacement: string, expected = original) => {
	const start = data.indexOf(original);
	return { start, end: start + original.length, expected, replacement };
};

test('splitLink separates note path and subpath', () => {
	assert.deepEqual(splitLink('Note#Heading'), { path: 'Note', subpath: '#Heading' });
	assert.deepEqual(splitLink('#Heading'), { path: '', subpath: '#Heading' });
	assert.deepEqual(splitLink('folder/Note'), { path: 'folder/Note', subpath: '' });
	assert.deepEqual(splitLink('Note#H1#H2'), { path: 'Note', subpath: '#H1#H2' });
});

test('block subpaths are detected and their id extracted', () => {
	assert.equal(isBlockSubpath('#^abc123'), true);
	assert.equal(isBlockSubpath('#Heading'), false);
	assert.equal(blockId('#^abc123'), 'abc123');
});

test('targetHeading returns the last heading segment', () => {
	assert.equal(targetHeading('#Setup'), 'Setup');
	assert.equal(targetHeading('#Guide#Install steps'), 'Install steps');
	assert.equal(targetHeading('#'), '');
});

test('headingForLink replaces characters links cannot contain', () => {
	assert.equal(headingForLink('Q&A: setup | tips'), 'Q&A setup tips');
	assert.equal(headingForLink('Step #2 [draft]'), 'Step 2 draft');
	assert.equal(headingForLink('Plain heading'), 'Plain heading');
});

test('similarity ignores case and unsafe characters', () => {
	assert.equal(similarity('Install', 'install'), 1);
	assert.equal(similarity('Setup: guide', 'Setup guide'), 1);
	assert.ok(similarity('Instalation', 'Installation') > NEAR_MATCH);
	assert.ok(similarity('Pricing', 'Changelog') < MIN_SUGGESTION_SCORE);
});

test('suggestHeading picks the closest heading above the threshold', () => {
	const headings = ['Overview', 'Installation steps', 'Configuration', 'FAQ: common issues'];
	assert.equal(suggestHeading('Instalation step', headings), 'Installation steps');
	assert.equal(suggestHeading('faq common issue', headings), 'FAQ common issues');
	assert.equal(suggestHeading('Pricing tiers', headings), null);
	assert.equal(suggestHeading('Anything', []), null);
});

test('rewriteLink keeps the note, alias and embed marker in wikilinks', () => {
	assert.equal(rewriteLink('[[Note#Old heading]]', 'Note#Old heading', 'New heading'), '[[Note#New heading]]');
	assert.equal(rewriteLink('[[Note#Old|see here]]', 'Note#Old', 'New'), '[[Note#New|see here]]');
	assert.equal(rewriteLink('![[Note#Old]]', 'Note#Old', 'New'), '![[Note#New]]');
	assert.equal(rewriteLink('[[#Old]]', '#Old', 'New'), '[[#New]]');
	assert.equal(rewriteLink('[[Note#A#B]]', 'Note#A#B', 'C'), '[[Note#C]]');
});

test('rewriteLink encodes spaces in markdown links', () => {
	assert.equal(
		rewriteLink('[read this](Notes/Guide.md#Old%20part)', 'Notes/Guide.md#Old part', 'New part'),
		'[read this](Notes/Guide.md#New%20part)',
	);
	assert.equal(rewriteLink('[x](#Old)', '#Old', 'New'), '[x](#New)');
});

test('rewriteLink returns null when the link text is not where expected', () => {
	assert.equal(rewriteLink('[[Something else]]', 'Note#Old', 'New'), null);
	assert.equal(rewriteLink('not a markdown link', 'Note#Old', 'New'), null);
});

test('replaceAt only replaces text that still matches', () => {
	const { start, end } = editFor('see [[A#x]] now', '[[A#x]]', '');
	assert.equal(replaceAt('see [[A#x]] now', start, end, '[[A#x]]', '[[A#y]]'), 'see [[A#y]] now');
	assert.equal(replaceAt('see [[A#z]] now', start, end, '[[A#x]]', '[[A#y]]'), null);
});

test('applyEdits applies several edits in one pass and skips stale ones', () => {
	const data = '[[A#x]] and [[B#y]] and [[C#z]]';
	const edits = [
		editFor(data, '[[A#x]]', '[[A#xx]]'),
		editFor(data, '[[B#y]]', '[[B#yy]]'),
		editFor(data, '[[C#z]]', '[[C#zz]]', '[[C#WRONG]]'),
	];
	const result = applyEdits(data, edits);
	assert.equal(result.text, '[[A#xx]] and [[B#yy]] and [[C#z]]');
	assert.equal(result.applied, edits.length - 1);
});

test('safeDecode decodes escapes and leaves invalid text alone', () => {
	assert.equal(safeDecode('Guide.md#Old%20part'), 'Guide.md#Old part');
	assert.equal(safeDecode('100% done'), '100% done');
});
