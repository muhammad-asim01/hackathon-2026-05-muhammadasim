import { describe, it, expect } from "vitest";
import { EmailWordCount } from "./EmailWordCount";

describe("EmailWordCount", () => {
  describe("fromText()", () => {
    it("counts words separated by spaces", () => {
      expect(EmailWordCount.fromText("Hello world").count).toBe(2);
    });

    it("handles multiple spaces and newlines", () => {
      expect(EmailWordCount.fromText("Hello  world\nfoo\tbar").count).toBe(4);
    });

    it("returns 0 for empty or whitespace-only text", () => {
      expect(EmailWordCount.fromText("").count).toBe(0);
      expect(EmailWordCount.fromText("   ").count).toBe(0);
    });

    it("counts a 180-word body correctly", () => {
      const body = Array(180).fill("word").join(" ");
      expect(EmailWordCount.fromText(body).count).toBe(180);
    });
  });

  describe("isWithinLimit()", () => {
    it("returns true when count equals the limit", () => {
      const wc = EmailWordCount.fromText(Array(180).fill("w").join(" "));
      expect(wc.isWithinLimit(180)).toBe(true);
    });

    it("returns true when count is below the limit", () => {
      const wc = EmailWordCount.fromText("short email");
      expect(wc.isWithinLimit(180)).toBe(true);
    });

    it("returns false when count exceeds the limit", () => {
      const wc = EmailWordCount.fromText(Array(181).fill("w").join(" "));
      expect(wc.isWithinLimit(180)).toBe(false);
    });
  });

  describe("overshootBy()", () => {
    it("returns 0 when within limit", () => {
      const wc = EmailWordCount.fromText("hello world");
      expect(wc.overshootBy(180)).toBe(0);
    });

    it("returns the overshoot amount", () => {
      const wc = EmailWordCount.fromText(Array(195).fill("w").join(" "));
      expect(wc.overshootBy(180)).toBe(15);
    });
  });

  describe("toString()", () => {
    it("returns the count as a string", () => {
      expect(EmailWordCount.fromText("one two three").toString()).toBe("3");
    });
  });
});
