import { ValidationError } from "@/domain/errors";

export class LeadScore {
  readonly value: number;

  private constructor(value: number) {
    this.value = value;
  }

  static create(raw: number): LeadScore {
    const value = Math.round(raw);
    if (value < 0 || value > 100) {
      throw new ValidationError(`LeadScore must be 0–100, got ${raw}`);
    }
    return new LeadScore(value);
  }

  // Returns true when score is above the configurable threshold (default 75).
  // Leads above threshold are not worth contacting — skip them.
  shouldSkip(threshold = 75): boolean {
    return this.value > threshold;
  }

  // Scores 0–55: business has significant digital gaps → immediate outreach
  isImmediateOutreach(): boolean {
    return this.value <= 55;
  }

  // Scores 56–75: some presence but room to improve → offer a free audit
  isAuditOffer(): boolean {
    return this.value > 55 && this.value <= 75;
  }

  toString(): string {
    return String(this.value);
  }
}
