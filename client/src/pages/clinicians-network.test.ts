import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Route, Router } from "wouter";
import { SettingsContext } from "@/components/settings-context";
import { connectionOf, matchesConnection, mutualOf } from "@/components/clinicians/network";
import Clinicians from "@/pages/Clinicians";
import { CLINICIANS, findClinician } from "@/content/clinicians";
import { communityStore, friendList, relationship, sentList } from "@/lib/community-store";
import { DEMO_CLINICIAN_ID, meFrom } from "@/lib/me";

// Browser comment 11: the Clinicians page as a professional network directory. A clinician finds a colleague, views
// their profile and sends a connection request, and the state agrees with My Network (the same community store).
// Comment 21: the signed-in clinician's own profile address shows it as theirs.

function draw(address: string) {
  const [path, search = ""] = address.split("?");
  const hook = () => [path, () => {}] as [string, (to: string) => void];
  const html = renderToStaticMarkup(createElement(SettingsContext.Provider, { value: () => {} },
    createElement(Router, { hook, searchHook: () => search }, createElement(Route, { path: "/clinicians", nest: true }, createElement(Clinicians))))).replace(/ data-loc="[^"]*"/g, "");
  return { html, text: html.replace(/<[^>]+>/g, " ").replace(/&#x27;/g, "'").replace(/\s+/g, " ") };
}
const states = (html: string) => [...html.matchAll(/data-connection="(\w+)"/g)].map(match => match[1]);

describe("the directory of colleagues", () => {
  it("lists every other clinician with networking copy and no patient booking", () => {
    const { html, text } = draw("/clinicians");
    expect(text).toContain("Professional network");
    expect(text).toContain("Find colleagues");
    expect(text).toContain(`${CLINICIANS.length - 1} clinicians`);
    for (const person of CLINICIANS) {
      if (person.id === DEMO_CLINICIAN_ID) expect(html).not.toContain(`href="/clinicians/${person.id}"`);
      else expect(html).toContain(`href="/clinicians/${person.id}"`);
    }
    expect(text).not.toMatch(/per consultation|Book a consultation|Need someone urgently|Talk to a clinician/);
    expect(html).not.toContain('href="/clinicians/urgent"');
    for (const filter of ["Condition expertise", "Profession", "Connection", "Not connected", "Location"]) expect(text).toContain(filter);
    expect(text).toContain("demo profiles");
  });

  it("shows My Network's state on each colleague: connected, pending, invited or Connect", () => {
    const { html, text } = draw("/clinicians");
    const shown = states(html);
    expect(shown.filter(state => state === "friend")).toHaveLength(4);
    expect(shown.filter(state => state === "sent")).toHaveLength(1);
    expect(shown.filter(state => state === "incoming")).toHaveLength(2);
    expect(shown.filter(state => state === "none")).toHaveLength(CLINICIANS.length - 1 - 7);
    expect(text).toContain("Connected with Dr Kwame Mensah");
    expect(text).toContain("your invitation to Dr Tomás Leal is waiting for an answer");
    expect(text).toContain("Accept Ruth Calloway's invitation");
    expect(text).toContain("Connect with Sophie Adair");
    // My network beside the heading opens its Invitations while some are waiting.
    expect(html).toContain('href="/community?panel=friends"');
  });

  it("opens already narrowed to a condition area from its address", () => {
    const rhythm = CLINICIANS.filter(person => person.id !== DEMO_CLINICIAN_ID && person.conditions.some(([groupId]) => groupId === "heart-rhythm"));
    const { html, text } = draw("/clinicians?area=heart-lungs&group=heart-rhythm");
    expect(text).toContain(`${rhythm.length} ${rhythm.length === 1 ? "clinician" : "clinicians"}`);
    expect(html).toContain('aria-label="Remove filter Heart rhythm"');
  });
});

describe("a colleague's profile", () => {
  it("is a demo profile with Connect, condition expertise and no booking", () => {
    const { html, text } = draw("/clinicians/sophie-adair");
    expect(text).toContain("Sophie Adair");
    expect(text).toContain("Leicester Nutrition and Dietetics");
    expect(text).toContain("Demo profile");
    expect(text).toContain("Connect with Sophie Adair");
    expect(text).toContain("Condition expertise");
    expect(html).toContain('href="/library/diabetes/type-2"');
    expect(html).not.toContain('id="book"');
    expect(text).not.toMatch(/£\d|per consultation|Book a consultation/);
    expect(text).not.toContain("This is your profile");
  });

  it("is the signed-in clinician's own at their address: no Connect, a link to edit it in the portal", () => {
    const { html, text } = draw(`/clinicians/${DEMO_CLINICIAN_ID}`);
    expect(text).toContain("This is your profile");
    expect(text).toContain("demo profile");
    expect(html).toContain('href="/clinicians/portal/profile"');
    expect(text).not.toContain("Connect with Dr Amara Osei");
    expect(text).toMatch(/\d+ connections/);
  });

  it("says so when the clinician isn't there, and keeps the portal and meeting rooms working", () => {
    expect(draw("/clinicians/nobody").text).toContain("We couldn't find that clinician");
    expect(draw("/clinicians/portal").text).toContain("Clinician portal");
    expect(draw("/clinicians/meet/abcdefghijklmnop").text).toContain("isn't on this device");
  });
});

describe("connecting", () => {
  const me = meFrom(findClinician(DEMO_CLINICIAN_ID)!, null);

  it("sends a request My Network lists under Sent, and withdraws it", () => {
    const sophie = findClinician("sophie-adair")!;
    expect(connectionOf(communityStore.load(), sophie, me)).toEqual({ status: "none", who: "sophie" });
    communityStore.requestFriend("sophie");
    expect(connectionOf(communityStore.load(), sophie, me).status).toBe("sent");
    expect(sentList(communityStore.load()).some(entry => entry.who === "sophie")).toBe(true);
    expect(matchesConnection("sent", "pending")).toBe(true);
    communityStore.cancelRequest("sophie");
    expect(relationship(communityStore.load(), "sophie")).toBe("none");
  });

  it("accepts an invitation into My Network's connections", () => {
    const ruth = findClinician("ruth-calloway")!;
    expect(connectionOf(communityStore.load(), ruth, me).status).toBe("incoming");
    communityStore.acceptRequest("ruth");
    expect(connectionOf(communityStore.load(), ruth, me).status).toBe("friend");
    expect(friendList(communityStore.load()).some(entry => entry.who === "ruth")).toBe(true);
    communityStore.undoAnswer("ruth");
  });

  it("is never offered with yourself, and counts mutual connections from My Network", () => {
    expect(connectionOf(communityStore.load(), me.clinician, me).status).toBe("me");
    expect(mutualOf(communityStore.load(), "ruth", me)).toEqual(expect.arrayContaining(["hannah", "grace"]));
    expect(mutualOf(communityStore.load(), "ruth", me)).not.toContain(me.personId);
  });
});
