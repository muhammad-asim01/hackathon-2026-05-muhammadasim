export class EmailWordCount {
  readonly count: number;

  private constructor(count: number) {
    this.count = count;
  }

  static fromText(text: string): EmailWordCount {
    const count = text
      .trim()
      .split(/\s+/)
      .filter((w) => w.length > 0).length;
    return new EmailWordCount(count);
  }

  isWithinLimit(maxWords: number): boolean {
    return this.count <= maxWords;
  }

  overshootBy(maxWords: number): number {
    return Math.max(0, this.count - maxWords);
  }

  toString(): string {
    return String(this.count);
  }
}
