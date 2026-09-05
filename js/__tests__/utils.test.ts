/**
 * @jest-environment jsdom
 */
import { formatTime, sleep, resetDOM } from "../utils.js";

jest.mock("../clientState.js", () => ({
	getFreshRegions: jest.fn().mockReturnValue("<div class='region'></div>"),
}));

describe("formatTime", () => {
	it("returns a string matching DD.MM. HH:MM:SS", () => {
		const ts = new Date(2024, 0, 5, 14, 30, 7).getTime();
		expect(formatTime(ts)).toMatch(/^\d{2}\.\d{2}\. \d{2}:\d{2}:\d{2}$/);
	});

	it("zero-pads all components", () => {
		const ts = new Date(2024, 0, 1, 9, 5, 3).getTime(); // Jan 1 09:05:03
		const [datePart, timePart] = formatTime(ts).split(" ");
		expect(datePart).toBe("01.01.");
		expect(timePart).toBe("09:05:03");
	});

	it("formats December 31 correctly", () => {
		const ts = new Date(2024, 11, 31, 23, 59, 59).getTime();
		const formatted = formatTime(ts);
		expect(formatted).toContain("31.12.");
		expect(formatted).toContain("23:59:59");
	});
});

describe("sleep", () => {
	it("returns a Promise", () => {
		const p = sleep(0);
		expect(p).toBeInstanceOf(Promise);
		return p;
	});

	it("resolves after approximately the given ms", async () => {
		const start = Date.now();
		await sleep(50);
		expect(Date.now() - start).toBeGreaterThanOrEqual(40);
	});
});

describe("resetDOM", () => {
	it("sets innerHTML of #all-regions to the fresh regions HTML", () => {
		document.body.innerHTML = '<div id="all-regions"><p>old content</p></div>';
		resetDOM();
		expect(document.getElementById("all-regions")?.innerHTML).toBe('<div class="region"></div>');
	});

	it("does nothing when #all-regions does not exist", () => {
		document.body.innerHTML = "";
		expect(() => resetDOM()).not.toThrow();
	});
});
