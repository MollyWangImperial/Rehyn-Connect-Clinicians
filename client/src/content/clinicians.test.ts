import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Route, Router } from "wouter";
import { SettingsContext } from "@/components/settings-context";
import Clinicians from "@/pages/Clinicians";
import { clinicianHref } from "@/components/clinicians/SpeakToClinician";
import { findCondition } from "@/lib/library";
import { DEMO_CLINICIAN_ID } from "@/lib/me";
import {
  CLINICAL_AREAS, CLINICIANS, PRICE_MAX, PRICE_MIN, SEEN_BY, WEEKLY_SESSIONS, clinicalAreaFromQuery, clinicalAreasOf, directoryFilters, findClinician, freeSoon, freeTimes, nextFree, nextWeeklySessions, sessionOpen, upcomingSessions,
} from "./clinicians";
import { librarySections } from "./library";

/** Text as React writes it into the page's markup. */
const escaped = (text: string) => text.replace(/&/g, "&amp;").replace(/'/g, "&#x27;");
/** The clinicians the directory lists: everyone but the signed-in (demo) clinician and anyone unlisted. */
const colleagues = CLINICIANS.filter(person => person.listed !== false && person.id !== DEMO_CLINICIAN_ID);

/** Draws the Clinicians tab at an address ("/clinicians" is the directory) inside its nested route, as the app does. */
function draw(address: string) {
  const [path, search = ""] = address.split("?");
  const hook = () => [path, () => {}] as [string, (to: string) => void];
  // A <Redirect> rendered on the server records where it leads here.
  const ssrContext: { redirectTo?: string } = {};
  const html = renderToStaticMarkup(createElement(SettingsContext.Provider, { value: () => {} },
    createElement(Router, { hook, searchHook: () => search, ssrContext }, createElement(Route, { path: "/clinicians", nest: true }, createElement(Clinicians))))).replace(/ data-loc="[^"]*"/g, "");
  return { html, text: html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " "), redirectTo: ssrContext.redirectTo };
}

const RESERVED = ["by-condition", "consultations", "urgent", "portal", "meet"];
// Monday 26 October 2026, 9am.
const MONDAY = new Date(2026, 9, 26, 9);

describe("the clinicians", () => {
  it("each have a unique address, a price, experience and hours, and work only with conditions that are in the Library", () => {
    expect(new Set(CLINICIANS.map(person => person.id)).size).toBe(CLINICIANS.length);
    for (const person of CLINICIANS) {
      expect(person.id).toMatch(/^[a-z-]+$/);
      expect(RESERVED).not.toContain(person.id);
      expect(person.price).toBeGreaterThanOrEqual(PRICE_MIN);
      expect(person.price).toBeLessThanOrEqual(PRICE_MAX);
      expect(person.years).toBeGreaterThan(0);
      expect(person.hours).toBeGreaterThan(0);
      expect(person.schedule.length).toBeGreaterThan(0);
      for (const [groupId, conditionId] of person.conditions) expect(findCondition(groupId, conditionId), `${person.id}: ${groupId}/${conditionId}`).toBeTruthy();
      expect(person.help.length).toBeGreaterThanOrEqual(3);
    }
  });

  it("are free on the hour within their working hours, from an hour after now, for the next 48 hours", () => {
    for (const person of CLINICIANS) {
      for (const time of freeTimes(person, MONDAY)) {
        expect(time.getMinutes()).toBe(0);
        expect(time.getTime()).toBeGreaterThan(MONDAY.getTime() + 3_600_000 - 1);
        expect(time.getTime()).toBeLessThan(MONDAY.getTime() + 48 * 3_600_000);
        expect(person.schedule.some(hours => hours.days.includes(time.getDay()) && time.getHours() >= hours.from && time.getHours() < hours.to)).toBe(true);
      }
      // The same times each time it is asked.
      expect(freeTimes(person, MONDAY).map(time => time.getTime())).toEqual(freeTimes(person, MONDAY).map(time => time.getTime()));
    }
    // Ruth works every morning, so she is free soon; Grace works only Tuesdays and Thursdays.
    expect(freeSoon(findClinician("ruth-calloway")!, MONDAY)).toBe(true);
    expect(nextFree(findClinician("grace-whitlow")!, MONDAY)!.getDay()).toBe(2);
    // Someone is free soon on a Saturday night too, for urgent requests.
    expect(CLINICIANS.some(person => freeSoon(person, new Date(2026, 9, 31, 22)))).toBe(true);
  });

  it("host weekly group sessions that come round each week, with the room open from ten minutes before", () => {
    const next = nextWeeklySessions(MONDAY);
    expect(next).toHaveLength(WEEKLY_SESSIONS.length);
    for (const session of next) {
      expect(findClinician(session.clinicianId)).toBeTruthy();
      expect(session.start).toBeGreaterThanOrEqual(MONDAY.getTime());
      expect(session.start - MONDAY.getTime()).toBeLessThan(7 * 86_400_000);
      expect(`group-${session.id}`).toMatch(/^[a-z0-9-]{6,64}$/);
    }
    const priya = next.find(session => session.clinicianId === "priya-raman")!;
    expect(new Date(priya.start).toDateString()).toBe(MONDAY.toDateString());
    expect(sessionOpen(priya, priya.start - 11 * 60_000)).toBe(false);
    expect(sessionOpen(priya, priya.start - 9 * 60_000)).toBe(true);
    expect(sessionOpen(priya, priya.start + priya.minutes * 60_000)).toBe(false);
    // A session set up in the portal is listed until it ends, soonest first.
    const created = { id: "s-test", clinicianId: "ruth-calloway", title: "Test", about: "", start: MONDAY.getTime() + 60_000, minutes: 30, spaces: 5, weekly: false };
    expect(upcomingSessions([created], MONDAY)[0].id).toBe("s-test");
    expect(upcomingSessions([created], new Date(MONDAY.getTime() + 40 * 60_000)).some(session => session.id === "s-test")).toBe(false);
  });

  it("are the network's example clinicians, each with a photo, workplace, place and summary", () => {
    for (const person of CLINICIANS) {
      expect(person.photo, person.id).toBe(`/photos/clinicians/${person.id}.jpg`);
      for (const field of ["org", "place", "summary"] as const) expect(person[field], `${person.id}: ${field}`).toBeTruthy();
    }
    // Renamed for this edition, and two added.
    expect(findClinician("michael-chau")?.name).toBe("Dr Michael Chau");
    expect(findClinician("joseph-hartley")?.name).toBe("Joseph Hartley");
    expect(findClinician("meilin-chau")).toBeUndefined();
    expect(findClinician("joseph-adeyemi")).toBeUndefined();
    expect(findClinician("arjun-mehta")?.name).toBe("Dr Arjun Mehta");
    expect(findClinician("imani-clarke")?.name).toBe("Imani Clarke");
    // The demo clinician hosts two weekly sessions.
    expect(WEEKLY_SESSIONS.filter(session => session.clinicianId === "amara-osei")).toHaveLength(2);
  });
});

describe("the Clinicians tab", () => {
  it("is a directory of colleagues with professional clinical areas as filters, and no prices, booking or urgent route", () => {
    const { html, text } = draw("/clinicians");
    expect(text).toContain("Clinical expertise");
    expect(html).toContain("All clinical areas");
    // Only the clinical areas some listed colleague works in, as chips and (for phones) as a list.
    for (const area of CLINICAL_AREAS) {
      const worked = colleagues.some(person => clinicalAreasOf(person).includes(area));
      for (const shape of [`>${escaped(area.label)}</button>`, `>${escaped(area.label)}</option>`]) {
        if (worked) expect(html, area.id).toContain(shape);
        else expect(html, area.id).not.toContain(shape);
      }
    }
    expect(html).toContain(">Neurology</button>");
    expect(html).toContain(">Cardiology</button>");
    expect(html).not.toContain(">Respiratory medicine</button>");
    // The Library's patient-facing sections and groups are no longer the directory's filters.
    expect(html).not.toContain("All areas");
    expect(text).not.toContain("Condition expertise");
    expect(text).not.toMatch(/Within /);
    for (const section of librarySections) {
      expect(html, section.id).not.toContain(`>${escaped(section.title)}</button>`);
      expect(html, section.id).not.toContain(`>${escaped(section.title)}</option>`);
    }
    expect(html).toContain('aria-label="Search"');
    expect(text).toContain("example clinicians while the network is being set up");
    // The patient edition's booking from the directory is gone: no prices, Book buttons or urgent route.
    for (const person of CLINICIANS) expect(text).not.toContain(`£${person.price} per consultation`);
    expect(text).not.toMatch(/£\d/);
    expect(html).not.toContain('aria-label="Book a consultation with');
    expect(text).not.toContain("If something feels urgent, call 999");
    expect(text).not.toMatch(/in person/i);
    for (const href of ["/clinicians/consultations", "/clinicians/sessions", "/clinicians/urgent", "/clinicians/by-condition", "/clinicians/portal"]) expect(html).not.toContain(`href="${href}"`);
    expect(text).not.toContain("Find a clinician");
  });

  /** The parts' panels on the tab's page: [id, hidden]. */
  const panels = (html: string) => [...html.matchAll(/<div id="cl-panel-(\w+)" class="cl-tab-panel"( hidden="")?/g)].map(match => [match[1], !!match[2]]);

  it("has no tabs: the directory stands alone, and the old tab addresses lead to the clinician's own destinations", () => {
    const { html } = draw("/clinicians");
    expect(panels(html)).toEqual([["find", false]]);
    expect(html).not.toContain('class="cl-tab"');
    expect(html.match(/<h1[^>]*>Your Clinical Network</g)).toHaveLength(1);
    expect(html).not.toMatch(/<h1[^>]*>Clinicians/);
    // My consultations is in the portal now.
    const consultations = draw("/clinicians/consultations");
    expect(consultations.redirectTo).toBe("~/clinicians/portal/consultations");
    expect(consultations.html).toBe("");
    expect(draw("/clinicians").redirectTo).toBeUndefined();
  });

  it("sends the old Weekly group sessions tab to Group weekly sessions in the community, which the menu links to", () => {
    const sessions = draw("/clinicians/sessions");
    expect(sessions.redirectTo).toBe("~/community?space=circle");
    expect(sessions.html).toBe("");
    const { html, text } = draw("/clinicians");
    expect(html).toContain('href="/community?space=circle"');
    expect(text).toContain("Group weekly sessions");
    expect(html).not.toContain('class="cl-session"');
  });

  it("browses by condition area with every Library section and group, each opening the directory narrowed to it", () => {
    const { html, text } = draw("/clinicians/by-condition");
    expect(text).toContain("Browse by condition area");
    expect(text).not.toContain("We couldn&#x27;t find that clinician");
    for (const section of librarySections) {
      expect(SEEN_BY[section.id], section.id).toBeTruthy();
      expect(text).toContain(`${section.groups.length} groups`);
      expect(html).toContain(`href="/clinicians/?area=${section.id}"`);
      for (const group of section.groups) expect(html).toContain(`href="/clinicians/?area=${section.id}&amp;group=${group.id}"`);
    }
    expect(html).toContain('href="/clinicians/" class="cl-request">Browse all clinicians');
  });

  it("opens the directory already narrowed by its address, mapping an older Library link to its clinical area and ignoring unknown ones", () => {
    expect(directoryFilters("area=heart-lungs&group=heart-rhythm&group=stroke")).toEqual({ area: "heart-lungs", groups: ["heart-rhythm"] });
    expect(directoryFilters("area=nowhere&group=stroke")).toEqual({ area: "all", groups: [] });
    // The directory reads ?expertise=<clinical area>; an older link's Library group maps to its clinical area, and a
    // section alone (or anything unknown) opens on all clinical areas.
    expect(clinicalAreaFromQuery("expertise=neurology")).toBe("neurology");
    expect(clinicalAreaFromQuery("expertise=nowhere")).toBe("all");
    expect(clinicalAreaFromQuery("area=heart-lungs&group=heart-rhythm")).toBe("cardiology");
    expect(clinicalAreaFromQuery("area=brain-nervous-system&group=stroke")).toBe("stroke");
    expect(clinicalAreaFromQuery("area=heart-lungs")).toBe("all");
    expect(clinicalAreaFromQuery("area=nowhere&group=nowhere")).toBe("all");
    const cardiology = colleagues.filter(person => clinicalAreasOf(person).some(area => area.id === "cardiology"));
    expect(cardiology.map(person => person.name).sort()).toEqual(["Dr Tomás Leal", "Imani Clarke", "Ruth Calloway"]);
    for (const address of ["/clinicians?area=heart-lungs&group=heart-rhythm", "/clinicians?expertise=cardiology"]) {
      const { html, text } = draw(address);
      expect(text, address).toContain(`${cardiology.length} clinicians in Cardiology`);
      expect(html, address).toContain('aria-label="Remove filter Cardiology"');
      expect(html, address).not.toContain('aria-label="Remove filter Heart &amp; lungs"');
      expect(html, address).not.toContain('aria-label="Remove filter Heart rhythm"');
      for (const person of colleagues) {
        if (cardiology.includes(person)) expect(html, person.id).toContain(`href="/clinicians/${person.id}"`);
        else expect(html, person.id).not.toContain(`href="/clinicians/${person.id}"`);
      }
    }
    // A section alone narrows nothing.
    const { text } = draw("/clinicians?area=heart-lungs");
    expect(text).toContain(`${colleagues.length} clinicians`);
    expect(text).not.toContain(" clinicians in ");
  });

  it("opens a colleague's profile with registration, experience and conditions leading to the Library, and no price or booking", () => {
    const { html, text } = draw("/clinicians/ruth-calloway");
    expect(text).toContain("Ruth Calloway");
    expect(text).toContain("Registered with the NMC");
    expect(text).toContain("Specialist cardiac rehabilitation nurse");
    expect(text).toContain("Whitby Cardiac Rehabilitation");
    expect(text).toContain("10 years&#x27; experience");
    expect(html).toContain('href="/library/heart-attack/heart-attack"');
    expect(html).toContain('href="/library/blood-pressure/high-blood-pressure"');
    // The patient edition's price, consultation hours, Book a consultation and urgent route are gone.
    expect(text).not.toMatch(/£\d|consultation hours|Book a consultation|Is it urgent\?/);
    expect(html).not.toContain('id="book"');
    expect(html).not.toContain('href="/clinicians/urgent"');
    expect(text).not.toMatch(/in person/i);
  });

  it("keeps the urgent page, the clinician portal (as the signed-in clinician) and the meeting room, none taken for a clinician", () => {
    // No longer offered from the directory, but its address still works.
    expect(draw("/clinicians/urgent").text).toContain("Alert clinicians now");
    const portal = draw("/clinicians/portal").text;
    expect(portal).toContain("Clinician portal");
    expect(portal).toContain("Using the demo profile of Dr Amara Osei");
    for (const page of ["", "requests", "schedule", "consultations", "sessions", "earnings", "profile"]) {
      const { text } = draw(`/clinicians/portal/${page}`);
      expect(text, page).not.toContain("Try the portal as");
      expect(text, page).toContain("Dr Amara Osei");
    }
    expect(draw("/clinicians/meet/abcdefghijklmnop").text).toContain("isn&#x27;t on this device");
    for (const path of ["/clinicians/urgent", "/clinicians/portal"]) expect(draw(path).text).not.toContain("We couldn&#x27;t find that clinician");
  });

  it("says so when a clinician isn't found, including at the old addresses of renamed clinicians", () => {
    expect(draw("/clinicians/nobody").text).toContain("We couldn&#x27;t find that clinician");
    for (const old of ["meilin-chau", "joseph-adeyemi"]) expect(draw(`/clinicians/${old}`).text).toContain("We couldn&#x27;t find that clinician");
    expect(draw("/clinicians/michael-chau").text).toContain("Dr Michael Chau");
  });
});

describe("Speak to a clinician, on Library pages", () => {
  it("opens the Clinicians tab narrowed to the condition or section being read", () => {
    expect(clinicianHref("/stroke/ischaemic")).toBe("~/clinicians?area=brain-nervous-system&group=stroke");
    expect(clinicianHref("/stroke/ischaemic/fatigue")).toBe("~/clinicians?area=brain-nervous-system&group=stroke");
    expect(clinicianHref("/heart-lungs")).toBe("~/clinicians?area=heart-lungs");
    expect(clinicianHref("/")).toBe("~/clinicians");
    expect(clinicianHref("/stories/li-wei")).toBe("~/clinicians");
  });
});
