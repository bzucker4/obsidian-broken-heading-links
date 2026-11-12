# Broken Heading Links

Obsidian tells you when a link points to a note that doesn't exist. It doesn't tell you when a link points to a **heading or block** that's gone, like `[[Project plan#Timeline]]` after you renamed "Timeline" to "Schedule". This plugin finds those links and fixes them.

## Features

- Scans your whole vault, or just the current note, for heading links (`[[Note#Heading]]`, `![[Note#Heading]]`, `[text](Note.md#Heading)`) and block links (`[[Note#^abc123]]`) that no longer resolve.
- Suggests the closest existing heading in the target note, so typos and small renames are caught.
- **Fix** rewrites the link to the suggested heading, keeping the note path, alias and embed marker. **Fix all** does every fixable link at once.
- **Open** jumps to the line with the broken link.
- Never edits a line that changed since the scan. Run the check again and it picks up the new text.

Links to missing notes, images and PDFs are skipped, since Obsidian already handles those.

## Usage

Run **Broken Heading Links: Check vault** or **Broken Heading Links: Check current note** from the command palette, or click the ribbon icon.

## Installation

### Manual

Copy `main.js` and `manifest.json` into `<your vault>/.obsidian/plugins/broken-heading-links/`, then enable the plugin in Settings → Community plugins.

### Development

```bash
npm install
npm test        # unit tests for link parsing, suggestions and rewriting
npm run lint    # ESLint with eslint-plugin-obsidianmd
npm run build   # type-check and build main.js
```

## Releases

Publishing a GitHub release tagged with the version in `manifest.json` (for example `1.0.0`) runs the Release workflow. It lints, tests and builds the plugin, attests build provenance for `main.js`, and attaches `main.js` and `manifest.json` to the release.

## Privacy

Everything runs locally. The plugin makes no network requests.

## License

0BSD
