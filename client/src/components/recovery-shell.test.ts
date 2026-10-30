import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { Route, Router } from "wouter";
import { SettingsContext } from "@/components/settings-context";
import RecoveryShell from "./RecoveryShell";
import { siteTabFor } from "./SiteTabs";

// Every page has the tabs at the top right and your profile panel down the left. They are drawn
// inside nested routes too (the Library lives under /library), and their links must still lead to
// the real pages: on the live site, a relative link from the Library once opened /library/community.

/**
 * Draws the shell at an address and returns the markup and its links. A Library address is drawn
 * inside the Library's nested route, without the panel, as the Library page does.
 */
function draw(path: string) {
  const hook = () => [path, () => {}] as [string, (to: string) => void];
  const library = path.startsWith("/library");
  const shell = createElement(RecoveryShell, { active: library ? "Library" : "My Community", dateLabel: "WEDNESDAY, 14 OCTOBER", panel: !library, children: createElement("p", null, "A page") });
  const html = renderToStaticMarkup(createElement(SettingsContext.Provider, { value: () => {} },
    createElement(Router, { hook, searchHook: () => "" }, library ? createElement(Route, { path: "/library", nest: true }, shell) : shell))).replace(/ data-loc="[^"]*"/g, "");
  const hrefs = [...html.matchAll(/href="([^"]*)"/g)].map(match => match[1].replace(/&amp;/g, "&"));
  return { html, hrefs, text: html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ") };
}

describe("the shell: tabs at the top right, your panel on the left", () => {
  it("has the Feed, the Library, Clinicians and the network's spaces as tabs, leading to the real pages from the Library too", () => {
    for (const path of ["/library", "/library/stroke/ischaemic"]) {
      const { html, hrefs, text } = draw(path);
      // No lounge and no poker night in the clinician edition, on any day.
      const tabHrefs = (html.match(/<a\b[^>]*>/g) ?? []).filter(tag => tag.includes('class="site-tab ')).map(tag => tag.match(/href="([^"]*)"/)![1].replace(/&amp;/g, "&"));
      expect(tabHrefs).toEqual([
        "/community", "/library", "/clinicians", "/community?space=circle", "/community?space=groups", "/community?space=messages",
      ]);
      for (const label of ["Feed", "Library", "Clinicians", "Group weekly sessions", "Groups", "Messages"]) expect(text, label).toContain(label);
      for (const gone of ["Lounge", "Poker", "Sunday circle"]) expect(text, gone).not.toContain(gone);
      expect(hrefs.some(href => href.includes("space=lounge") || href.includes("space=poker"))).toBe(false);
      // The brand says which edition this is.
      expect(text).toContain("Rehyn : Connect for clinicians");
      expect(html).toContain('aria-label="Rehyn: Connect for clinicians, go to the Feed"');
      const active = (html.match(/<a\b[^>]*>/g) ?? []).filter(tag => tag.includes('class="site-tab is-active"'));
      expect(active).toHaveLength(1);
      expect(active[0]).toContain('href="/library"');
      expect(active[0]).toContain('aria-current="page"');
      // Nothing in the shell points inside the Library's base by mistake.
      expect(hrefs.filter(href => href.startsWith("/library/community") || href.startsWith("/library/care-team"))).toEqual([]);
    }
  });

  it("shows the signed-in clinician, My Network, professional events, consultations and two of your groups on the left (the Library card is in the feed's right lane); the care team only when switched on", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 9, 17, 12, 0));
    const drawn = draw("/community");
    vi.useRealTimers();
    const { html, text, hrefs } = drawn;
    for (const words of ["Dr Amara Osei", "Consultant stroke physician", "View your profile", "My Network", "2 invitations waiting", "My professional events", "My consultations", "Your groups", "See all", "Stroke Rehabilitation Network", "Parkinson&#x27;s Clinical Network", "Start a group"]) {
      expect(text, words).toContain(words);
    }
    for (const gone of ["The library", "Look up a topic", "Open the library"]) expect(text, gone).not.toContain(gone);
    for (const href of ["/clinicians/amara-osei", "/community?panel=friends", "/community?space=events", "/clinicians/portal/consultations", "/community?space=groups&group=garden", "/community?space=groups&group=walk", "/community?space=groups", "/community?space=start"]) {
      expect(hrefs, href).toContain(href);
    }
    // "View your profile" is a link to the clinician's own page in the directory.
    const profileLink = html.match(/<a\b[^>]*>View your profile<\/a>/)?.[0] ?? "";
    expect(profileLink).toContain('class="site-me-link"');
    expect(profileLink).toContain('href="/clinicians/amara-osei"');
    // Saved, Alerts and Game are patient features: no rows for them, and Alerts can't be reached from here.
    for (const gone of ["Saved", "Alerts", "Game", "Friends", "My events"]) expect(text, gone).not.toContain(gone);
    expect(html).not.toContain('data-cm-tool="alerts"');
    expect(html).not.toContain("site-foot");
    for (const gone of ["House rules", "Privacy"]) expect(text).not.toContain(gone);
    // Review comments: no date above the profile, no reading minutes, two groups, no care team for members.
    expect(text).not.toMatch(/OCTOBER|· \d+ min/);
    expect((text.match(/site-group-name/g) ?? []).length).toBe(0);
    expect(hrefs.filter(href => href.startsWith("/community?space=groups&group=")).length).toBe(2);
    expect(hrefs).not.toContain("/care-team");
    expect(text).not.toContain("Lounge safety");
  });

  it("draws no panel on the Library, Groups and Messages, and only Settings in the top bar", () => {
    const { html, text } = draw("/library/stroke/ischaemic");
    expect(html).not.toContain('id="site-panel"');
    expect(html).not.toContain("site-menu");
    expect(text).toContain("Settings");
    for (const gone of ["Use larger text", "Toggle stronger contrast", "'s profile"]) expect(html).not.toContain(gone);
  });

  it("no longer has a Home page, My Time, Journey or Warning signs in it", () => {
    const { text, hrefs } = draw("/library");
    for (const gone of ["Warning signs", "My Time", "Journey"]) expect(text).not.toContain(gone);
    expect(hrefs.some(href => href.startsWith("/fast-check") || href === "/my-time" || href === "/journey" || href === "/")).toBe(false);
  });

  it("has a plain Group weekly sessions tab, with no Sunday circle peek or seat to take", () => {
    const { html, text } = draw("/library");
    const circleTab = (html.match(/<a\b[^>]*>/g) ?? []).find(tag => tag.includes('href="/community?space=circle"') && tag.includes('class="site-tab '));
    expect(circleTab).toBeTruthy();
    expect(circleTab).not.toContain("aria-describedby");
    expect(html).not.toContain("cm-peek");
    expect(text).not.toContain("Hosted by Alira");
    expect(html).not.toContain('class="cm-btn cm-btn-gold cm-btn-wide"');
  });
});

describe("which tab an address belongs to", () => {
  it.each([
    ["/community", "", "feed"],
    // The lounge and poker night are not spaces any more: their old addresses open the feed.
    ["/community", "?space=lounge", "feed"],
    ["/community", "?space=poker", "feed"],
    // Professional events are reached from the panel, not a tab.
    ["/community", "?space=events", null],
    ["/community", "?space=circle&tab=mine", "circle"],
    ["/community", "?space=start", "groups"],
    ["/community", "?space=groups&group=garden&game=new", "groups"],
    ["/community", "?space=messages&chat=grace", "messages"],
    ["/community", "?space=friends", null],
    ["/community", "?space=safety", null],
    ["/library", "", "library"],
    ["/library/stroke/ischaemic", "", "library"],
    ["/clinicians", "", "clinicians"],
    ["/clinicians/amara-osei", "", "clinicians"],
    ["/care-team", "", null],
  ])("%s%s is %s", (pathname, search, tab) => {
    expect(siteTabFor(pathname, search)).toBe(tab);
  });
});
