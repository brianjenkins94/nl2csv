import { crx } from "@crxjs/vite-plugin";
import { defineConfig } from "vite";
import * as path from "path";
import * as url from "url";

const __filename = url.fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import { __root } from "../../config";
import manifest from "./manifest.json";
import { version } from "../package.json";

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
			}
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
