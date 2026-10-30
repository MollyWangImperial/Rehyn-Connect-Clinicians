import { describe, expect, it } from "vitest";
import { PERSON_IDS } from "./community-samples";
import { DAILY_QUESTIONS, dailyQuestion, isDailyPostId } from "./daily-questions";

describe("the Daily question", () => {
  it("is the same all day, changes at midnight, and goes round the whole list", () => {
    const morning = dailyQuestion(new Date(2026, 9, 12, 7, 0));
    const evening = dailyQuestion(new Date(2026, 9, 12, 23, 59));
    const tomorrow = dailyQuestion(new Date(2026, 9, 13, 0, 1));
    expect(evening).toEqual(morning);
    expect(morning).toMatchObject({ id: "daily-2026-10-12", dateLabel: "Monday 12 October", question: "What do you wish someone had told you in your first week home?", key: "first week home" });
    expect(tomorrow.id).toBe("daily-2026-10-13");
    expect(tomorrow.question).toBe("What's a small trick that makes a hard task easier for you?");
    const seen = new Set(Array.from({ length: DAILY_QUESTIONS.length }, (_, day) => dailyQuestion(new Date(2026, 9, 12 + day, 12)).question));
    expect(seen.size).toBe(DAILY_QUESTIONS.length);
  });

  it("has a key phrase, starters, a placeholder and eight answers from the community for each question", () => {
    for (const question of DAILY_QUESTIONS) {
      const whole = `${question.pre}${question.key}${question.post}`;
      expect(whole.length).toBeLessThan(80);
      // Open questions, so answers are stories or tips that others can reply to, never a yes, a no or one word.
      expect(whole).toMatch(/^(What|Who|How|When|Where|Why)\b.*\?$/);
      expect(question.key.trim().length).toBeGreaterThan(0);
      expect(question.starters.length).toBeGreaterThanOrEqual(3);
      // Starters are the beginnings of answers, not ready-made ones.
      for (const starter of question.starters) expect(starter).toMatch(/…$/);
      expect(question.placeholder).toMatch(/…$/);
      expect(question.answers).toHaveLength(8);
      // Each of the eight example people answers once, so the window never shows the same person twice in a row.
      expect(new Set(question.answers.map(answer => answer.who)).size).toBe(8);
      for (const answer of question.answers) {
        expect(PERSON_IDS).toContain(answer.who);
        expect(answer.text.length).toBeLessThan(60);
        expect(answer.hearts).toBeGreaterThan(0);
        if (answer.tag) expect(answer.tag.colour).toMatch(/^#[0-9A-F]{6}$/i);
      }
    }
    expect(new Set(DAILY_QUESTIONS.map(question => question.key)).size).toBe(DAILY_QUESTIONS.length);
    expect(isDailyPostId("daily-2026-10-12")).toBe(true);
    expect(isDailyPostId("p-hannah")).toBe(false);
  });
});
