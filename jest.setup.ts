// Some code under test logs expected warnings as part of normal operation
// (e.g. AuthService.ensureAccounts() warning on first run). Those are
// correct behavior, not test failures, but they clutter `jest` output.
// Muting console.warn here — scoped to each test via beforeEach/afterEach,
// not removed globally — keeps the terminal readable without silencing
// warnings a test actually wants to assert on (spy on console.warn
// directly in that test and it still works; this only sets a default).
beforeEach(() => {
	jest.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
	jest.restoreAllMocks();
});
