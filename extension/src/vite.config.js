import { crx } from "@crxjs/vite-plugin";
import { defineConfig } from "vite";
import { promises as fs } from "fs";
import * as path from "path";
import * as url from "url";
import stdLib from "node-stdlib-browser";

const __filename = url.fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import { __root } from "../../config";
import manifest from "./manifest.json";
import { version } from "../package.json";

async function tsup(options) {
	// WORKAROUND: `tsup` gives the entry straight to `globby` and `globby` doesn't get along with Windows paths.
	options.entry = [options.entry[0].replace(/\\+/gu, "/")];

	return (await import("tsup")).build({
		//"esbuildOptions": esbuildOptions,
		//"esbuildPlugins": [],
		"format": "esm",
		"treeshake": true,
		...options
	});
}

const cacheDirectory = path.join(__dirname, "..", ".cache");

export default defineConfig({
	"build": {
		"emptyOutDir": true,
		"minify": false,
		"outDir": "../dist",
		"rollupOptions": {
			"input": {
				"sidepanel": path.join(__dirname, "pages", "sidepanel", "index.html")
			},
			"output": {
				"entryFileNames": "[name].js"
				//"preserveModules": true
			},
			"external": function(id, parentId, isResolved) {
				return id.startsWith("react") || Object.keys(stdLib).includes(id);
			},
			"plugins": [
				{
					"name": "vite-plugin-node-polyfills",
					"load": async function(id) {
						if (id.startsWith(__dirname.replace(/\\+/gu, "/")) && /\.(jsx|tsx)$/u.test(id)) {
							await tsup({
								"entry": [id],
								"outDir": cacheDirectory
							});

							const compiledOutputPath = path.join(cacheDirectory, path.basename(id, path.extname(id)) + ".js");

							const code = await fs.readFile(compiledOutputPath, { "encoding": "utf8" });

							return {
								"code": code
							};
						}
					}
				}
			]
		},
		"target": "ESNext",
		"watch": {
			"include": path.join(__root, "**", "*").replace(/\\+/gu, "/")
		}
	},
	"plugins": [
		crx({
			"manifest": {
				"name": "Sidepanel",
				"version": version,
				...manifest
			}
		})
	]
});
