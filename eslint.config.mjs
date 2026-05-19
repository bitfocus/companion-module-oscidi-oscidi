import { generateEslintConfig } from '@companion-module/tools/eslint/config.mjs'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const tsconfigRootDir = dirname(fileURLToPath(import.meta.url))
const config = await generateEslintConfig({
	enableTypescript: true,
})

config.push({
	files: ['**/*.ts'],
	languageOptions: {
		parserOptions: {
			project: ['./tsconfig.json'],
			tsconfigRootDir,
		},
	},
})

export default config
