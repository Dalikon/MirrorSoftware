/** @type {import('jest').Config} */
module.exports = {
	preset: "ts-jest",
	testEnvironment: "node",
	rootDir: ".",
	roots: ["<rootDir>/js", "<rootDir>/modules"],
	setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
	testMatch: ["**/__tests__/**/*.test.ts"],
	// TS "NodeNext" resolution requires source imports to end in ".js"
	// (e.g. `from "./authService.js"`), but ts-jest never emits real .js
	// files — only "authService.ts" exists on disk. Without this mapping
	// every relative import resolves to a file that doesn't exist.
	moduleNameMapper: {
		"^(\\.{1,2}/.*)\\.js$": "$1",
	},
	transform: {
		"^.+\\.ts$": ["ts-jest", { tsconfig: "tsconfig.test.json" }],
	},
	clearMocks: true,
};
