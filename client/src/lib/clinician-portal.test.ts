import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Router } from "wouter";
import { SettingsContext } from "@/components/settings-context";
import { scheduleFromWeek, summariseWeek, weekFromSchedule } from "@/components/clinicians/portal/Schedule";
import Join from "@/pages/Join";
import { aboutFromTemplate } from "@/components/clinicians/portal/ProfileEditor";
import { CLINICIANS, alertable, findClinician, freeTimes, sessionGroupIds, sessionPriceText, works } from "@/content/clinicians";
import { combine, getOwnClinician, getRole, joinAsClinician, logOut, newOwnClinician, profileGaps, registerText } from "./clinician-portal";
import { accept, busyTimes, expire, finish, hasExpired, pickSuggested, request, suggest } from "./consultations";
import { DEMO_CLINICIAN_ID, meId } from "./me";

// Monday 26 October 2026, 9am.
const MONDAY = new Date(2026, 9, 26, 9);
const HOUR = 3_600_000;

describe("joining", () => {
  it("first offers joining with your own details or exploring as the demo clinician, never a patient or clinician choice", () => {
    const html = renderToStaticMarkup(createElement(SettingsContext.Provider, { value: () => {} },
      createElement(Router, { hook: () => ["/", () => {}] as [string, (to: string) => void], searchHook: () => "" }, createElement(Join))));
    expect(html).toContain("Join with your own details");
    expect(html).toContain(`Explore with the demo profile: ${findClinician(DEMO_CLINICIAN_ID)!.name}`);
    expect(html).toContain("Explore with the demo profile: Dr Amara Osei");
    // Everyone joining this edition is a clinician: the patient edition's role choice is gone.
    expect(html).not.toContain("I&#x27;m a clinician");
    expect(html).not.toContain("living with a condition");
    expect(html).not.toMatch(/patient \(or carer\)/i);
  });

  it("signs in as the demo clinician until someone joins with their own details or picks another in the portal", () => {
    expect(meId(null, null, CLINICIANS)).toBe(DEMO_CLINICIAN_ID);
    expect(meId("ruth-calloway", null, CLINICIANS)).toBe("ruth-calloway");
    expect(meId("nobody", null, CLINICIANS)).toBe(DEMO_CLINICIAN_ID);
    const own = newOwnClinician({ name: "Dr Jo Baker", role: "Stroke physician", type: "doctor", registration: "1234567" });
    expect(meId(null, own.id, [...CLINICIANS, own])).toBe(own.id);
  });
});

describe("a clinician's own profile", () => {
  const own = newOwnClinician({ name: "Dr Jo Baker", role: "Stroke physician", type: "doctor", registration: "1234567" });

  it("starts from what they typed, waiting for the registration check, with usual weekday hours", () => {
    expect(own).toMatchObject({ name: "Dr Jo Baker", first: "Jo", initials: "JB", type: "doctor", own: true, verified: false, registration: "1234567", listed: true });
    expect(own.id).toMatch(/^me-[a-z]{8}$/);
    expect(registerText(own)).toBe("GMC registration check pending");
    expect(registerText(CLINICIANS[0])).toBe("Registered with the GMC");
    expect(profileGaps(own)).toEqual(["a few words about you", "the conditions you work with"]);
    // No made-up bookings for a clinician of your own: every weekday hour is free.
    expect(freeTimes(own, MONDAY).filter(time => time.getDay() === 1).map(time => time.getHours())).toEqual([11, 12, 13, 14, 15, 16]);
  });

  it("joins the examples, with changes from the portal applied to whoever they're for", () => {
    const list = combine(CLINICIANS, own, { "amara-osei": { price: 99 }, [own.id]: { price: 70 } });
    expect(list).toHaveLength(CLINICIANS.length + 1);
    expect(list.find(person => person.id === "amara-osei")!.price).toBe(99);
    expect(list.find(person => person.id === own.id)!.price).toBe(70);
    // The examples themselves are untouched.
    expect(findClinician("amara-osei")!.price).toBe(85);
  });
});

describe("logging out", () => {
  it("forgets the role and a clinician's own profile, so someone can join again", () => {
    const own = joinAsClinician({ name: "Sam Lee", role: "Physiotherapist", type: "physio", registration: "PH12345" });
    expect(getRole()).toBe("clinician");
    expect(findClinician(own.id)).toBeTruthy();
    logOut();
    expect(getRole()).toBeNull();
    expect(getOwnClinician()).toBeNull();
    expect(findClinician(own.id)).toBeUndefined();
    expect(findClinician("amara-osei")).toBeTruthy();
  });
});

describe("hours, time off and urgent alerts", () => {
  const ruth = findClinician("ruth-calloway")!;

  it("turns the usual week into hours and back, days with the same times sharing an entry", () => {
    const week = weekFromSchedule([{ days: [1, 3, 5], from: 9, to: 17 }, { days: [6], from: 10, to: 12 }]);
    expect(week[1]).toEqual({ on: true, from: 9, to: 17 });
    expect(week[2]).toEqual({ on: false, from: 9, to: 17 });
    expect(scheduleFromWeek(week)).toEqual([{ days: [1, 3, 5], from: 9, to: 17 }, { days: [6], from: 10, to: 12 }]);
    expect(scheduleFromWeek({ ...week, 1: { on: true, from: 17, to: 9 } })).toEqual([{ days: [3, 5], from: 9, to: 17 }, { days: [6], from: 10, to: 12 }]);
  });

  it("prices a group session as the host set it, free when no price was set, and lists it with one or more groups", () => {
    expect(sessionPriceText({})).toBe("Free");
    expect(sessionPriceText({ price: 0 })).toBe("Free");
    expect(sessionPriceText({ price: 12 })).toBe("£12 a place");
    expect(sessionGroupIds({ groupIds: ["stroke", "dementia"] })).toEqual(["stroke", "dementia"]);
    // A session saved before it could be listed with several groups keeps its one group.
    expect(sessionGroupIds({ groupId: "stroke" })).toEqual(["stroke"]);
    expect(sessionGroupIds({})).toEqual([]);
  });

  it("writes the About text from the template, with the clinician's role, level and years and the words they chose", () => {
    const picks = { conditions: ["Multiple sclerosis", "Ischaemic stroke"], who: ["adults", "carers"], focus: ["balance", "strength", "pain"] };
    expect(aboutFromTemplate({ level: "Senior", role: "Neurological physiotherapist", years: 11 }, picks)).toBe(
      "I'm a senior neurological physiotherapist with 11 years' experience, specialising in multiple sclerosis and ischaemic stroke. I help adults and carers with balance, strength and pain.",
    );
    // The level isn't repeated when the role already says it; names and short forms keep their capitals.
    expect(aboutFromTemplate({ level: "Consultant", role: "Consultant stroke physician", years: 1 }, { ...picks, conditions: ["Parkinson's disease", "COPD"] }))
      .toMatch(/^I'm a consultant stroke physician with 1 year's experience, specialising in Parkinson's disease and COPD\./);
    // Gaps left empty drop out, so the sentence still reads.
    expect(aboutFromTemplate({ level: "Specialist", role: "Occupational therapist", years: 0 }, { conditions: [], who: [], focus: ["memory"] }))
      .toBe("I'm a specialist occupational therapist. I help people with memory.");
  });

  it("sums up the week in a few lines, neighbouring days with the same hours together", () => {
    expect(summariseWeek(weekFromSchedule([{ days: [1, 2, 3, 4, 5], from: 9, to: 17 }]))).toEqual([
      { days: "Mon – Fri", hours: "09:00 – 17:00" },
      { days: "Sat, Sun", hours: "Not working" },
    ]);
    expect(summariseWeek(weekFromSchedule([]))).toEqual([{ days: "Mon – Sun", hours: "Not working" }]);
    expect(summariseWeek(weekFromSchedule([{ days: [1, 3, 5], from: 9, to: 17 }, { days: [6], from: 10, to: 12 }])).map(row => row.days)).toEqual(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]);
  });

  it("keeps time off out of their free times, and alerts only as they chose", () => {
    const tuesday = new Date(2026, 9, 27, 10);
    expect(works(ruth, tuesday)).toBe(true);
    const away = { ...ruth, timeOff: [{ from: new Date(2026, 9, 27).getTime(), to: new Date(2026, 9, 28).getTime(), label: "Away" }] };
    expect(works(away, tuesday)).toBe(false);
    expect(freeTimes(away, MONDAY).some(time => time.getDate() === 27)).toBe(false);
    expect(alertable(ruth, MONDAY)).toBe(true);
    expect(alertable({ ...ruth, urgentAlerts: "never" }, MONDAY)).toBe(false);
    // "Always" reaches them even with no free time at all.
    expect(alertable({ ...ruth, schedule: [], urgentAlerts: "always" }, MONDAY)).toBe(true);
    expect(alertable({ ...ruth, schedule: [] }, MONDAY)).toBe(false);
    // Ruth works mornings: at 11pm she isn't free again today, so "today only" doesn't reach her.
    expect(alertable({ ...ruth, urgentAlerts: "today" }, new Date(2026, 9, 26, 23))).toBe(false);
    expect(alertable({ ...ruth, urgentAlerts: "today" }, new Date(2026, 9, 26, 6))).toBe(true);
  });
});

describe("requests in the portal", () => {
  const amara = findClinician("amara-osei")!;
  const NOW = MONDAY.getTime();

  it("lets the clinician suggest other times, which the patient picks from, with the hold kept meanwhile", () => {
    const sent = request(amara, [NOW + 3 * HOUR], "Driving?", NOW);
    const offered = suggest(sent, [NOW + 50 * HOUR, NOW + 26 * HOUR], NOW + 1);
    expect(offered).toMatchObject({ status: "requested", payment: "held", suggested: [NOW + 26 * HOUR, NOW + 50 * HOUR] });
    expect(pickSuggested(offered, NOW + 4 * HOUR)).toBe(offered);
    expect(pickSuggested(offered, NOW + 26 * HOUR)).toMatchObject({ status: "scheduled", at: NOW + 26 * HOUR });
  });

  it("ends a request whose times have all passed, releasing the hold", () => {
    const sent = request(amara, [NOW + 3 * HOUR], "", NOW);
    expect(hasExpired(sent, NOW + 2 * HOUR)).toBe(false);
    expect(expire(sent, NOW + 3 * HOUR)).toMatchObject({ status: "declined", payment: "released" });
    // A suggested time still to come keeps it open.
    expect(hasExpired(suggest(sent, [NOW + 30 * HOUR]), NOW + 4 * HOUR)).toBe(false);
  });

  it("knows which hours are booked, and keeps the clinician's summary when they finish", () => {
    const booked = accept(request(amara, [NOW + 3 * HOUR], "", NOW), NOW + 3 * HOUR);
    expect(busyTimes([booked], "amara-osei")).toEqual([NOW + 3 * HOUR]);
    expect(freeTimes(amara, MONDAY, 48, [NOW + 3 * HOUR]).some(time => time.getTime() === NOW + 3 * HOUR)).toBe(false);
    const done = finish(booked, [], NOW + 4 * HOUR, { summary: "  Try the pacing plan.  ", followUp: true });
    expect(done).toMatchObject({ status: "done", payment: "paid", summary: "Try the pacing plan.", followUp: true });
    expect(done.steps.at(-1)!.what).toBe("Summary from the clinician");
  });
});
