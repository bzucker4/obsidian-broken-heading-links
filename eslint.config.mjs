import { defineConfig, globalIgnores } from 'eslint/config';
import obsidianmd from 'eslint-plugin-obsidianmd';

export default defineConfig([
	globalIgnores(['main.js', 'node_modules/', 'esbuild.config.mjs', 'version-bump.mjs']),
	...obsidianmd.configs.recommended,
	{
		languageOptions: {
			parserOptions: {
				projectService: {
					allowDefaultProject: ['eslint.config.*'],
				},
			},
		},
	},
	{
		// Unit tests run in Node, not in Obsidian, and node:test returns promises by design.
		files: ['tests/**/*.ts'],
		rules: {
			'obsidianmd/no-nodejs-modules': 'off',
			'@typescript-eslint/no-floating-promises': 'off',
		},
	},
]);
