import { describe, expect, it } from "vitest";
import { sanitizeDocumentName } from "./documents";

describe("sanitizeDocumentName", () => {
  it("keeps safe filenames while removing paths and unsupported characters", () => {
    expect(sanitizeDocumentName("report%20final.pdf")).toBe("report final.pdf");
    expect(sanitizeDocumentName("../../private?notes.csv")).toBe("private_notes.csv");
  });
});
