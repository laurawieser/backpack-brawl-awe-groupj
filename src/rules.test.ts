import { expect, it, vi } from "vitest";
import { RULES, STATUS_HELP } from "./rules";

vi.mock("./battle", async (importOriginal) => ({
  ...await importOriginal<typeof import("./battle")>(),
  BURN_DAMAGE_PER_STACK: 7,
}));

it("uses the configured Burn damage in both the tooltip and the rules panel", () => {
  expect(STATUS_HELP.burn).toContain("7 damage per stack");
  expect(RULES.flatMap((section) => section.rules)).toContain(STATUS_HELP.burn);
});
