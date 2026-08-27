import { describe, expect, it } from "vitest";
import { getPanelPresentation } from "./panelPresentation";

describe("panel presentation", () => {
  it("keeps an open panel interactive and hides its rail trigger", () => {
    expect(getPanelPresentation(true)).toEqual({ panelStateClass: "is-open", railStateClass: "is-hidden", ariaHidden: false, inert: false });
  });

  it("makes a closed panel inert and exposes its rail trigger", () => {
    expect(getPanelPresentation(false)).toEqual({ panelStateClass: "is-closed", railStateClass: "", ariaHidden: true, inert: true });
  });
});
