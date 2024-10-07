import { defineConfig } from '@vscode/test-cli';
import { fileURLToPath } from "url";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Coverageのexclude設定が効かない問題があり、__dirnameを使っているのはその対応のため
// see: https://github.com/microsoft/vscode-test-cli/issues/40
export default defineConfig({
	tests: [{
		files: 'out/test/**/*.test.js',
	}],
	coverage: {
		reporter: ["html", "json-summary"],
		exclude: [
			`${__dirname}/out/openapi/**/*.js`,
			`${__dirname}/out/test/**/*.js`,
		],
	},
});
