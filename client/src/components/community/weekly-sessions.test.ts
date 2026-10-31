import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Router } from "wouter";
import { nextWeeklySessions, type GroupSession } from "@/content/clinicians";
import SessionsTile from "./SessionsTile";
import WeeklySessionsView from "./WeeklySessions";
import { hostedSessions, sessionStatus, sessionViewHref } from "./weekly-sessions-model";

// Group weekly sessions (comments 13, 18 and 20): the signed-in clinician's patient Q&A sessions, in the feed's card
// and on /community?space=circle. The preview signs in as Dr Amara Osei, who hosts two weekly sessions.

// Wednesday 4 November 2026, midday: Amara's Thursday 18:00 and Monday 19:00 sessions are both coming up.
const WEDNESDAY = new Date(2026, 10, 4, 12, 0);
afterEach(() => { vi.useRealTimers(); });
const at = (date: Date) => { vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(date); };

const draw = (path: string, element: ReturnType<typeof createElement>) =>
  renderToStaticMarkup(createElement(Router, { ssrPath: path.split("?")[0], ssrSearch: path.split("?")[1] ?? "", children: element })).replace(/ data-loc="[^"]*"/g, "");
const words = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/&#x27;/g, "'").replace(/&amp;/g, "&").replace(/\s+/g, " ");

describe("Group weekly sessions", () => {
  it("knows where a sitting stands: upcoming, opens soon, live now, finished", () => {
    const session: GroupSession = { id: "x", clinicianId: "amara-osei", title: "T", about: "A", start: WEDNESDAY.getTime(), minutes: 45, spaces: 10, weekly: false };
    expect(sessionStatus(session, WEDNESDAY.getTime() - 2 * 3_600_000)).toBe("upcoming");
    expect(sessionStatus(session, WEDNESDAY.getTime() - 30 * 60_000)).toBe("soon");
    expect(sessionStatus(session, WEDNESDAY.getTime() + 10 * 60_000)).toBe("live");
    expect(sessionStatus(session, WEDNESDAY.getTime() + 45 * 60_000)).toBe("finished");
  });

  it("lists only the signed-in clinician's sittings, with last week's as finished", () => {
    const { coming, finished } = hostedSessions([], "amara-osei", WEDNESDAY.getTime());
    expect(coming.map(session => session.title)).toEqual(["How do I lower my risk of another stroke?", "Stroke under 50: returning to work and family life"]);
    expect(coming.every(session => session.clinicianId === "amara-osei")).toBe(true);
    expect(finished.length).toBe(2);
    expect(finished.every(session => session.start + session.minutes * 60_000 <= WEDNESDAY.getTime())).toBe(true);
    expect(hostedSessions([], "joseph-hartley", WEDNESDAY.getTime())).toEqual({ coming: [], finished: [] });
  });

  it("shows the feed card with the clinician's own sessions, linking to the session view", () => {
    at(WEDNESDAY);
    const html = draw("/community", createElement(SessionsTile));
    const text = words(html);
    expect(text).toContain("Group weekly sessions");
    expect(text).not.toContain("Ask a clinician this week");
    expect(text).toContain("How do I lower my risk of another stroke?");
    expect(text).toContain("Tomorrow, 18:00–18:45");
    expect(text).not.toContain("How do I walk further without falling?");
    const first = nextWeeklySessions(WEDNESDAY).find(session => session.title.startsWith("How do I lower"))!;
    expect(html).toContain(`href="${sessionViewHref(first).replace("&", "&amp;")}"`);
    expect(html).toContain('href="/community?space=circle"');
  });

  it("shows the session view with no session open until one is picked: heading, counts and the coming sessions", () => {
    at(WEDNESDAY);
    const html = draw("/community?space=circle", createElement(WeeklySessionsView, { active: true }));
    const text = words(html);
    expect(html).toMatch(/<h1[^>]*tabindex="-1"[^>]*data-view-heading[^>]*>Group weekly sessions<\/h1>/);
    expect(text).not.toMatch(/Sunday circle|teacup/i);
    expect(text).not.toContain("Patients send their questions in advance and you answer them live on video");
    // Two counts: what is coming up, and every sitting organised, the finished ones included although they aren't listed.
    expect(text).toContain("Coming up 2");
    expect(text).toContain("Total sessions organized 4");
    for (const gone of ["Live now", "Questions sent in", "Finished in the last week"]) expect(text).not.toContain(gone);
    // Each row: the date block, the time range alone (the full date for screen readers) and the title; no topic, length or places.
    expect(text).toContain("Thursday 5 November, 18:00–18:45");
    expect(html).not.toContain("Thu 5 Nov, 18:00");
    expect(html).not.toContain("ws-row-meta");
    expect(text).not.toContain("45 min · 20 places");
    // No session's details until one is picked.
    expect(html).not.toContain("ws-detail");
    expect(html).toContain('href="/clinicians/portal/sessions"');
  });

  it("opens a picked session's details: no top strip, a short room note, and an empty questions list when none were sent", () => {
    at(WEDNESDAY);
    const session = hostedSessions([], "amara-osei", WEDNESDAY.getTime()).coming[0];
    const html = draw(sessionViewHref(session), createElement(WeeklySessionsView, { active: true }));
    const text = words(html);
    expect(html).toContain("ws-detail");
    expect(html).not.toContain("ws-detail-top");
    for (const label of ["Topics", "Date", "Time", "Duration", "Places"]) expect(text).toContain(label);
    expect(text).toContain("Stroke, Blood pressure");
    expect(text).toContain("The room opens at 17:50.");
    expect(text).not.toContain("10 minutes before the start");
    expect(html).toContain('<ol class="ws-q-list"></ol>');
    for (const gone of ["Example questions (preview)", "Not from real patients", "No questions have reached this preview"]) expect(text).not.toContain(gone);
  });

  it("opens the sitting named in the address, and its host link once the room is open", () => {
    const live = new Date(2026, 10, 5, 18, 5);
    at(live);
    const session = hostedSessions([], "amara-osei", live.getTime()).coming[0];
    const html = draw(sessionViewHref(session), createElement(WeeklySessionsView, { active: true }));
    expect(words(html)).toContain("Live now");
    expect(html).toContain(`href="/clinicians/meet/group-${session.id}?as=clinician"`);
  });
});
