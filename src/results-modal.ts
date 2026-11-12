import { App, Modal, Notice, Setting, TFile } from 'obsidian';
import { applyEdits } from './links';
import { BrokenLink } from './scan';

/** Lists broken heading and block links, with buttons to open or fix each one. */
export class ResultsModal extends Modal {
	private remaining: BrokenLink[];

	constructor(app: App, broken: BrokenLink[], private readonly scopeLabel: string) {
		super(app);
		this.remaining = broken;
	}

	onOpen(): void {
		this.titleEl.setText('Broken heading links');
		this.render();
	}

	onClose(): void {
		this.contentEl.empty();
	}

	private render(): void {
		const { contentEl } = this;
		contentEl.empty();

		if (this.remaining.length === 0) {
			contentEl.createEl('p', { text: `No broken heading or block links in ${this.scopeLabel}.` });
			return;
		}

		const fixable = this.remaining.filter((b) => b.edit !== null);
		const summary = new Setting(contentEl).setName(
			`${this.remaining.length} broken link${this.remaining.length === 1 ? '' : 's'} in ${this.scopeLabel}`,
		);
		summary.setDesc(`${fixable.length} can be fixed automatically.`);
		if (fixable.length > 0) {
			summary.addButton((btn) =>
				btn
					.setButtonText(`Fix all ${fixable.length}`)
					.setCta()
					.onClick(() => void this.fix(fixable)),
			);
		}

		this.remaining.forEach((broken) => this.renderRow(contentEl, broken));
	}

	private renderRow(parent: HTMLElement, broken: BrokenLink): void {
		const what = broken.isBlock ? `block ^${broken.wanted}` : `heading "${broken.wanted}"`;
		const fix = broken.suggestion === null ? 'No similar heading found.' : `Suggested: #${broken.suggestion}`;
		const row = new Setting(parent)
			.setName(`${broken.source.basename}, line ${broken.line + 1}`)
			.setDesc(`${broken.original}: ${broken.target.basename} has no ${what}. ${fix}`);
		row.addButton((btn) => btn.setButtonText('Open').onClick(() => void this.openLink(broken)));
		if (broken.edit !== null) {
			row.addButton((btn) =>
				btn
					.setButtonText('Fix')
					.setCta()
					.onClick(() => void this.fix([broken])),
			);
		}
	}

	private async openLink(broken: BrokenLink): Promise<void> {
		this.close();
		await this.app.workspace.getLeaf(false).openFile(broken.source, { eState: { line: broken.line } });
	}

	/** Apply the suggested fixes, one file write per note, and drop the fixed links from the list. */
	private async fix(items: readonly BrokenLink[]): Promise<void> {
		const byFile = items.reduce((map, item) => map.set(item.source, [...(map.get(item.source) ?? []), item]), new Map<TFile, BrokenLink[]>());
		const results = await Promise.all(
			[...byFile.entries()].map(async ([file, links]) => {
				const edits = links.flatMap((l) => (l.edit === null ? [] : [l.edit]));
				let applied = 0;
				await this.app.vault.process(file, (data) => {
					const result = applyEdits(data, edits);
					applied = result.applied;
					return result.text;
				});
				return { links, applied };
			}),
		);
		const fixedCount = results.reduce((sum, r) => sum + r.applied, 0);
		const skipped = items.length - fixedCount;
		// Only drop links from files where every edit applied; otherwise the user should rescan.
		const done = new Set(results.filter((r) => r.applied === r.links.length).flatMap((r) => r.links));
		this.remaining = this.remaining.filter((b) => !done.has(b));
		new Notice(
			skipped === 0
				? `Fixed ${fixedCount} link${fixedCount === 1 ? '' : 's'}.`
				: `Fixed ${fixedCount}. ${skipped} changed since the scan, so run the check again.`,
		);
		this.render();
	}
}
