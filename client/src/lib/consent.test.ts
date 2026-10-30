import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Router } from "wouter";
import { SettingsContext } from "@/components/settings-context";
import { LEGAL_VERSION } from "@/content/legal-content";
import Join from "@/pages/Join";
import { RegistrationGate } from "@/App";
import { ageOn, agreedTo, canShare, CONSENT_KEY, createConsentStore, HEALTH_CONSENT_TEXT, HEALTH_CONSENT_VERSION, isRegistered, isUnder18, NO_CONSENTS, readConsents, type Consents } from "./consent";

// The Join page reads the consents through useConsents. On the server nothing has been agreed (a new joiner), and the
// form behind the first step only opens after a tap, which a server render can't make. The one form a server render can
// show is the one someone sees coming back after the Terms changed, so a test can stand in those consents here.
const shownConsents = vi.hoisted(() => ({ value: null as unknown }));
vi.mock("./consent", async importOriginal => {
  const real = await importOriginal<typeof import("./consent")>();
  return { ...real, useConsents: () => (shownConsents.value as Consents | null) ?? real.useConsents() };
});
afterEach(() => { shownConsents.value = null; });

function storage(initial?: string) {
  const values = new Map<string, string>();
  if (initial !== undefined) values.set(CONSENT_KEY, initial);
  return { values, getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); }, removeItem: (key: string) => { values.delete(key); } };
}
const words = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/&#x27;/g, "'").replace(/&amp;/g, "&").replace(/\s+/g, " ");
const BORN = "1961-03-09";

describe("joining needs all three agreements", () => {
  it("is not registered until the Terms, the Privacy Notice and a date of birth are given; sharing needs the health consent too", () => {
    const disk = storage();
    const store = createConsentStore(() => disk);
    expect(isRegistered(store.load())).toBe(false);
    store.register(BORN, true, 1_760_000_000_000);
    const saved = readConsents(disk.values.get(CONSENT_KEY) ?? null);
    expect(saved.terms).toEqual({ version: LEGAL_VERSION, at: 1_760_000_000_000 });
    expect(saved.privacy).toEqual({ version: LEGAL_VERSION, at: 1_760_000_000_000 });
    expect(saved.health).toEqual({ version: HEALTH_CONSENT_VERSION, at: 1_760_000_000_000 });
    expect(saved.dateOfBirth).toBe(BORN);
    expect(isRegistered(store.load())).toBe(true);
    expect(canShare(store.load())).toBe(true);
  });

  it("keeps the account but stops sharing after the health information consent is withdrawn, and lets it be given again", () => {
    const disk = storage();
    const store = createConsentStore(() => disk);
    store.register(BORN, true, 1000);
    store.withdrawHealth(2000);
    expect(store.load().healthWithdrawnAt).toBe(2000);
    expect(agreedTo(store.load())).toEqual({ terms: true, privacy: true, health: false });
    expect(isRegistered(store.load())).toBe(true);
    expect(canShare(store.load())).toBe(false);
    store.giveHealth(3000);
    expect(canShare(store.load())).toBe(true);
  });

  it("writes every change to the audit log with its time, the state and the wording's version", () => {
    const disk = storage();
    const store = createConsentStore(() => disk);
    store.register(BORN, true, 1000);
    store.setUpdates(true, 2000);
    store.withdrawHealth(3000);
    expect(store.load().audit).toEqual([
      { at: 1000, what: "terms_and_privacy", state: "agreed", wording: LEGAL_VERSION, legal: LEGAL_VERSION },
      { at: 1000, what: "health_information", state: "given", wording: HEALTH_CONSENT_VERSION, legal: LEGAL_VERSION },
      { at: 2000, what: "updates_about_rehyn", state: "on", wording: undefined, legal: LEGAL_VERSION },
      { at: 3000, what: "health_information", state: "withdrawn", wording: HEALTH_CONSENT_VERSION, legal: LEGAL_VERSION },
    ]);
  });

  it("works out ages from the date of birth, for the 13+ rule and the under-18 protections", () => {
    const today = new Date(2026, 9, 15);
    expect(ageOn("2013-10-15", today)).toBe(13);
    expect(ageOn("2013-10-16", today)).toBe(12);
    expect(ageOn("2008-10-16", today)).toBe(17);
    expect(ageOn("2027-01-01", today)).toBeNull();
    expect(ageOn("2008-02-30", today)).toBeNull();
    expect(isUnder18({ ...NO_CONSENTS, dateOfBirth: "2008-10-16" }, today)).toBe(true);
    expect(isUnder18({ ...NO_CONSENTS, dateOfBirth: "2008-10-15" }, today)).toBe(false);
  });

  it("asks again when a document changes version, and reads damaged storage as nothing agreed", () => {
    const old = JSON.stringify({ terms: { version: "0.9", at: 5 }, privacy: { version: LEGAL_VERSION, at: 5 }, health: { version: HEALTH_CONSENT_VERSION, at: 5 }, dateOfBirth: BORN });
    expect(isRegistered(readConsents(old))).toBe(false);
    expect(readConsents("not json")).toEqual(NO_CONSENTS);
    expect(readConsents(JSON.stringify({ terms: { version: LEGAL_VERSION, at: "yesterday" } })).terms).toBeNull();
    expect(readConsents(JSON.stringify({ dateOfBirth: "yesterday" })).dateOfBirth).toBeNull();
  });

  it("still lets the person in for this visit when the browser won't save", () => {
    const store = createConsentStore(() => { throw new Error("blocked"); });
    store.register(BORN, true, 1000);
    expect(isRegistered(store.load())).toBe(true);
  });
});

describe("the Join page", () => {
  const html = () => renderToStaticMarkup(createElement(SettingsContext.Provider, { value: () => {} }, createElement(Router, { ssrPath: "/community" }, createElement(Join, { startAs: "clinician" }))));
  const page = () => words(html());
  // Someone who agreed to an older version of the Terms, and nothing else yet: the agreements form opens straight away.
  const comingBack = (): Consents => ({ ...NO_CONSENTS, terms: { version: "0.9", at: 5 } });

  it("first offers joining with your own details or exploring with the demo profile, not a patient or clinician choice", () => {
    const text = page();
    expect(text).toContain("Join Rehyn: Connect for clinicians");
    expect(text).toContain("Join with your own details");
    expect(text).toContain("Your name, profession and registration number. Rehyn checks your registration.");
    expect(text).toContain("Explore with the demo profile: Dr Amara Osei");
    // The patient edition's role choice, and its "first name" form, aren't here.
    expect(text).not.toMatch(/I'm a clinician|living with a condition|patient \(or carer\)/);
    expect(text).not.toContain("Your first name");
    expect(text).toContain("If you think someone is having a stroke, call 999");
  });

  it("asks for a name, a date of birth and three separate agreements, the health information consent word for word", () => {
    shownConsents.value = comingBack();
    const text = page();
    expect(text).toContain("Welcome back");
    expect(text).toContain("Your name");
    expect(text).toContain("Your date of birth");
    expect(text).toContain("Rehyn Connect is for people aged 13 or over");
    for (const title of ["Terms of Use", "Privacy Notice", "Health information consent"]) expect(text).toContain(title);
    expect(text).toContain("I have read and agree to the Terms of Use.");
    expect(text).toContain("I have read the Privacy Notice");
    expect(text).toContain(HEALTH_CONSENT_TEXT);
    for (const link of ["Read the Terms of Use", "Read the Privacy Notice", "How we use your information"]) expect(text).toContain(link);
    // A clinician coming back isn't asked for their profession and registration again.
    for (const field of ["Your profession", "Your role", "Your registration number"]) expect(text).not.toContain(field);
  });

  it("starts with nothing ticked and the button waiting", () => {
    shownConsents.value = comingBack();
    const markup = html();
    expect((markup.match(/type="checkbox"/g) ?? []).length).toBe(3);
    expect(markup).not.toMatch(/type="checkbox"[^>]*checked/);
    expect(markup).toMatch(/type="date"/);
    expect(markup).toMatch(/<button[^>]*type="submit"[^>]*aria-disabled="true"/);
    expect(words(markup)).toContain("Continue");
  });

  it("stands in front of every page until the person has joined, but never in front of Warning signs", () => {
    const gate = (path: string) => words(renderToStaticMarkup(createElement(SettingsContext.Provider, { value: () => {} },
      createElement(Router, { ssrPath: path }, createElement(RegistrationGate, null, createElement("p", null, "The page itself"))))));
    // On the server nothing has been agreed yet (the store's server snapshot is empty).
    expect(gate("/community")).toContain("Join Rehyn: Connect");
    expect(gate("/community")).not.toContain("The page itself");
    expect(gate("/fast-check")).toContain("The page itself");
  });
});
