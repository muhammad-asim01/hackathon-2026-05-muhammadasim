import { describe, it, expect } from "vitest";
import { LeadScore } from "./LeadScore";
import { ValidationError } from "@/domain/errors";

describe("LeadScore", () => {
  describe("create()", () => {
    it("accepts values 0–100", () => {
      expect(LeadScore.create(0).value).toBe(0);
      expect(LeadScore.create(50).value).toBe(50);
      expect(LeadScore.create(100).value).toBe(100);
    });

    it("rounds floating-point input", () => {
      expect(LeadScore.create(42.6).value).toBe(43);
      expect(LeadScore.create(42.4).value).toBe(42);
    });

    it("throws ValidationError below 0", () => {
      expect(() => LeadScore.create(-1)).toThrow(ValidationError);
    });

    it("throws ValidationError above 100", () => {
      expect(() => LeadScore.create(101)).toThrow(ValidationError);
    });
  });

  describe("shouldSkip()", () => {
    it("returns true when value exceeds default threshold (75)", () => {
      expect(LeadScore.create(76).shouldSkip()).toBe(true);
      expect(LeadScore.create(100).shouldSkip()).toBe(true);
    });

    it("returns false at or below default threshold", () => {
      expect(LeadScore.create(75).shouldSkip()).toBe(false);
      expect(LeadScore.create(0).shouldSkip()).toBe(false);
    });

    it("respects a custom threshold", () => {
      expect(LeadScore.create(60).shouldSkip(55)).toBe(true);
      expect(LeadScore.create(55).shouldSkip(55)).toBe(false);
    });
  });

  describe("isImmediateOutreach()", () => {
    it("returns true for scores ≤ 55", () => {
      expect(LeadScore.create(0).isImmediateOutreach()).toBe(true);
      expect(LeadScore.create(55).isImmediateOutreach()).toBe(true);
    });

    it("returns false for scores > 55", () => {
      expect(LeadScore.create(56).isImmediateOutreach()).toBe(false);
    });
  });

  describe("isAuditOffer()", () => {
    it("returns true for scores 56–75", () => {
      expect(LeadScore.create(56).isAuditOffer()).toBe(true);
      expect(LeadScore.create(75).isAuditOffer()).toBe(true);
    });

    it("returns false outside 56–75", () => {
      expect(LeadScore.create(55).isAuditOffer()).toBe(false);
      expect(LeadScore.create(76).isAuditOffer()).toBe(false);
    });
  });

  describe("toString()", () => {
    it("returns the string value", () => {
      expect(LeadScore.create(42).toString()).toBe("42");
    });
  });
});
