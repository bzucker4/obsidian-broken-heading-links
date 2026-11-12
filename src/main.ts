import { Plugin, TFile } from 'obsidian';
import { ResultsModal } from './results-modal';
import { findBrokenLinks } from './scan';

export default class BrokenHeadingLinksPlugin extends Plugin {
	onload(): void {
		this.addCommand({
			id: 'check-vault',
			name: 'Check vault',
			callback: () => this.check(this.app.vault.getMarkdownFiles(), 'your vault'),
		});

		this.addCommand({
			id: 'check-current-note',
			name: 'Check current note',
			checkCallback: (checking) => {
				const file = this.app.workspace.getActiveFile();
				if (!file || file.extension !== 'md') return false;
				if (!checking) this.check([file], file.basename);
				return true;
			},
		});

		this.addRibbonIcon('unlink', 'Check vault for broken heading links', () =>
			this.check(this.app.vault.getMarkdownFiles(), 'your vault'),
		);
	}

	private check(files: TFile[], scopeLabel: string): void {
		void new ResultsModal(this.app, findBrokenLinks(this.app, files), scopeLabel).open();
	}
}
