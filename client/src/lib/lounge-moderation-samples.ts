import { members, type MemberId } from "@/content/community-samples";

// The example lounge-safety record the preview starts with, so the care team's page has something
// to look at: four held photos (one of them the person's own), a post two reports from removal, two
// posts already removed, and a member whose upload attempts were blocked.

/** Who wrote something in the lounge: the person using the app, someone in My community, or another lounge member. */
export type LoungeAuthor = "you" | MemberId | "rob" | "kev";
export const LOUNGE_AUTHORS: LoungeAuthor[] = ["you", ...(Object.keys(members) as MemberId[]), "rob", "kev"];

/** Lounge members who are not in My community's examples: their initial on a soft colour. */
export const otherAuthors: Record<"rob" | "kev", { name: string; initial: string; tint: string; ink: string }> = {
  rob: { name: "Rob", initial: "R", tint: "#E4E8DF", ink: "#596A62" },
  kev: { name: "Kev", initial: "K", tint: "#EADFD3", ink: "#6B4E2E" },
};

const svg = (body: string) => `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 120">${body}</svg>`)}`;

/** Flat drawings standing in for the example members' photos. Stored as "art:<name>" with each post. */
export const sampleArt: Record<string, { src: string; alt: string }> = {
  splint: {
    alt: "A wrist splint on a table",
    src: svg('<rect width="160" height="120" fill="#e8eee9"/><rect y="80" width="160" height="40" fill="#d2d9cf"/><path d="M20 70C30 40 70 38 95 50L140 50Q150 60 140 70L95 76C70 88 30 86 20 70Z" fill="#d9b99b"/><rect x="88" y="42" width="62" height="40" rx="8" fill="#a5b8aa"/><rect x="96" y="50" width="46" height="6" rx="3" fill="#eff1eb"/><rect x="96" y="66" width="46" height="6" rx="3" fill="#eff1eb"/>'),
  },
  lunch: {
    alt: "A group around a table at lunch",
    src: svg('<rect width="160" height="120" fill="#f6efdf"/><rect y="84" width="160" height="36" fill="#d9b99b"/><circle cx="40" cy="52" r="14" fill="#739c8c"/><circle cx="80" cy="46" r="14" fill="#a9816e"/><circle cx="120" cy="54" r="14" fill="#54776a"/><rect x="24" y="66" width="32" height="22" rx="6" fill="#739c8c"/><rect x="64" y="60" width="32" height="28" rx="6" fill="#a9816e"/><rect x="104" y="68" width="32" height="20" rx="6" fill="#54776a"/><rect x="52" y="96" width="56" height="10" rx="2" fill="#fffefa"/>'),
  },
  glasses: {
    alt: "Three glasses on a table",
    src: svg('<rect width="160" height="120" fill="#e8eee9"/><rect y="86" width="160" height="34" fill="#a9816e"/><rect x="40" y="40" width="22" height="46" rx="4" fill="#fffefa"/><rect x="42" y="58" width="18" height="26" rx="3" fill="#d8b36a"/><rect x="74" y="34" width="22" height="52" rx="4" fill="#fffefa"/><rect x="76" y="52" width="18" height="32" rx="3" fill="#a84232"/><rect x="108" y="46" width="20" height="40" rx="4" fill="#fffefa"/><rect x="110" y="62" width="16" height="22" rx="3" fill="#d8b36a"/>'),
  },
  hand: {
    alt: "A hand resting on a knee, with a healing scar",
    src: svg('<rect width="160" height="120" fill="#dcecf4"/><rect y="78" width="160" height="42" fill="#7d9bb0"/><path d="M30 64Q60 44 100 50L134 52Q144 60 134 68L100 72Q60 82 30 64Z" fill="#e2bfa0"/><path d="M58 58L92 60" stroke="#b5664a" stroke-width="3" stroke-linecap="round" stroke-dasharray="4 3"/>'),
  },
};

const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;

/** The sample record, timed from `now` (the first time the preview opens the lounge's safety record). */
export function sampleModeration(now: number) {
  const at = (minutesAgo: number) => now - minutesAgo * MINUTE;
  const held = (id: string, author: LoungeAuthor, text: string, art: string, minutesAgo: number, score: number, labels: string[]) => ({
    id, author, text, photo: `art:${art}`, voice: false, to: null, createdAt: at(minutesAgo), status: "pending_review" as const,
    check: { verdict: "unsure" as const, score, labels, source: "model" as const }, reviewedAt: null,
  });
  return {
    posts: [
      held("seed-zak", "you", "New wrist splint arrived today. Feels odd, but the nurse says that's normal.", "splint", 38, 0.54, ["Possible medical image", "Skin / bandage", "No faces"]),
      held("seed-priya", "priya", "Lunch with the Tuesday walking group. Best bit of the week.", "lunch", 62, 0.47, ["Other people's faces", "Text in image (menu)"]),
      held("seed-kwame", "kwame", "Six months today. Allowed myself a small one.", "glasses", 121, 0.61, ["Alcohol"]),
      held("seed-michael", "michael", "Scar's healing well. Six weeks on.", "hand", 150, 0.42, ["Wound / skin"]),
      { id: "seed-rob", author: "rob" as const, text: "If you feel dizzy just double your blood thinners for a few days. Worked for me, doctors fuss too much.", photo: null, voice: false, to: null, createdAt: at(4), status: "live" as const, check: null, reviewedAt: null },
      { id: "seed-gary", author: "gary" as const, text: "Anyone want to buy my spare mobility aids? Message me, cash only.", photo: null, voice: false, to: null, createdAt: at(12), status: "live" as const, check: null, reviewedAt: null },
      { id: "seed-kev", author: "kev" as const, text: "This supplement fixed my arm in a week. Link in my profile.", photo: null, voice: false, to: null, createdAt: now - 3 * DAY, status: "live" as const, check: null, reviewedAt: null },
    ],
    reports: [
      { id: "r-rob-1", postId: "seed-rob", author: "rob" as const, excerpt: "If you feel dizzy just double your blood thinners for a few days…", reporter: "member-grace", reason: "medical" as const, createdAt: at(3) },
      { id: "r-rob-2", postId: "seed-rob", author: "rob" as const, excerpt: "If you feel dizzy just double your blood thinners for a few days…", reporter: "member-tomas", reason: "medical" as const, createdAt: at(2) },
      ...["member-ruth", "member-joseph", "member-hannah"].map((reporter, index) => ({ id: `r-gary-${index + 1}`, postId: "seed-gary", author: "gary" as const, excerpt: "Anyone want to buy my spare mobility aids? Message me, cash only.", reporter, reason: "spam" as const, createdAt: at(11 - index) })),
      ...["member-grace", "member-kwame", "member-priya"].map((reporter, index) => ({ id: `r-kev-${index + 1}`, postId: "seed-kev", author: "kev" as const, excerpt: "This supplement fixed my arm in a week. Link in my profile.", reporter, reason: index === 0 ? "medical" as const : "spam" as const, createdAt: now - 3 * DAY + index * 20 * MINUTE })),
    ],
    removals: {
      "seed-gary": { at: at(9), by: "reports" as const, author: "gary" as const, excerpt: "Anyone want to buy my spare mobility aids? Message me, cash only." },
      "seed-kev": { at: now - 3 * DAY + 41 * MINUTE, by: "reports" as const, author: "kev" as const, excerpt: "This supplement fixed my arm in a week. Link in my profile." },
    },
    blocked: [
      { id: "b-kev-1", author: "kev" as const, at: now - 2 * DAY, score: 0.93, labels: ["Sexual or nude content"], appealed: false },
      { id: "b-kev-2", author: "kev" as const, at: now - 2 * DAY + 6 * MINUTE, score: 0.88, labels: ["Sexual or nude content"], appealed: false },
      { id: "b-rob-1", author: "rob" as const, at: now - DAY, score: 0.81, labels: ["Illegal drugs"], appealed: false },
    ],
    log: [
      { id: "log-seed-1", at: now - 3 * DAY + 41 * MINUTE, text: "Kev's post was removed automatically after 3 reports." },
      { id: "log-seed-2", at: now - 2 * DAY + 6 * MINUTE, text: "Blocked a second photo from Kev. Repeated attempts are listed under Blocked uploads." },
      { id: "log-seed-3", at: now - DAY, text: "Blocked a photo from Rob (illegal drugs, 0.81)." },
      { id: "log-seed-4", at: at(150), text: "Held a photo from Li Wei for a person to check (0.42)." },
      { id: "log-seed-5", at: at(121), text: "Held a photo from David for a person to check (0.61)." },
      { id: "log-seed-6", at: at(62), text: "Held a photo from Priya for a person to check (0.47)." },
      { id: "log-seed-7", at: at(38), text: "Held a photo from {you} for a person to check (0.54)." },
      { id: "log-seed-8", at: at(9), text: "Gary's post was removed automatically after 3 reports. The care team was told." },
      { id: "log-seed-9", at: at(2), text: "Rob's post has 2 of 3 reports." },
    ],
    /** Photos the check has looked at, before this preview's own. */
    tally: { passed: 121, held: 4, blocked: 3 },
  };
}
