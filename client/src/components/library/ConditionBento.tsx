import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { Link } from "wouter";
import type { LibraryItem, LibraryStory } from "@/content/library";
import { conditionKey, contentTitle, findStory, itemHref, itemMeta, sectionHref, storyHref, type ConditionPlace } from "@/lib/library";
import { libraryStore, type LibraryState } from "@/lib/library-store";
import { paletteFor, themeOf, themeVars, tileLooks, watchBackgrounds, type ThemePalette } from "@/lib/library-theme";
import { FeedbackButton } from "./FeedbackButton";
import { GoalCards } from "./GoalCards";
import { BookmarkIcon, Crumbs, Faces, jumpTo } from "./parts";

// Version 2 of a condition page ("A · Bento, continued from the Brain page"): a dark header with
// blood flowing through branching arteries and one branch stopped by a clot, a floating bar of the
// page's parts, the Understand pieces as a bento (choose a small tile to move it into the large one),
// the outside resources as a strip, symbol cards for Explore, Live well and Watch & listen, then the
// page's own trusted sources and stories. Every written condition page uses it.


// ---- Symbols ------------------------------------------------------------------------------------

const c = (x: number, y: number, r: number) => `M${x - r} ${y} a${r} ${r} 0 1 0 ${2 * r} 0 a${r} ${r} 0 1 0 ${-2 * r} 0`;
const e = (x: number, y: number, rx: number, ry: number) => `M${x - rx} ${y} a${rx} ${ry} 0 1 0 ${2 * rx} 0 a${rx} ${ry} 0 1 0 ${-2 * rx} 0`;

/** `d` is drawn in the tile's colour, `alt` in coral, `dot` filled coral. */
type Sym = { d: string; alt?: string; dot?: string };
const SYM: Record<string, Sym> = {
  brain: { d: "M100 45 C75 28, 42 44, 44 80 C32 96, 36 128, 56 138 C60 164, 90 170, 100 152 M100 45 C125 28, 158 44, 156 80 C168 96, 164 128, 144 138 C140 164, 110 170, 100 152 M20 186 C50 170, 66 150, 84 132 C96 120, 110 112, 128 100", dot: c(128, 100, 10) },
  heart: { d: "M100 170 C40 130, 20 90, 40 60 C60 30, 95 40, 100 66 C105 40, 140 30, 160 60 C180 90, 160 130, 100 170 Z", alt: "M46 104 H78 L90 82 L104 130 L116 92 L124 104 H154" },
  types: { d: "M30 30 H170 M30 58 H170 M30 86 H86 M114 86 H170 M30 114 H170 M30 142 H170 M30 170 H170", alt: "M100 116 q-8 14 0 24 q8 -10 0 -24", dot: `${c(100, 44, 10)} ${c(100, 156, 6)}` },
  scan: { d: `${c(100, 100, 70)} ${c(100, 100, 42)} M20 100 H44 M156 100 H180 M100 20 V44 M100 156 V180`, alt: "M58 100 H142", dot: c(100, 100, 8) },
  arm: { d: "M20 120 C50 110, 70 100, 92 104 L130 112 M130 112 C140 104, 152 106, 156 116 M130 112 C136 124, 150 126, 156 116 M128 140 H172 L178 180 H122 Z M140 140 a10 10 0 0 1 20 0", alt: "M24 92 q-10 -12 0 -24 M44 86 q-10 -12 0 -24" },
  rewire: { d: `M40 60 L90 40 L120 80 M100 140 L120 80 ${c(40, 60, 9)} ${c(90, 40, 9)} ${c(120, 80, 9)} ${c(100, 140, 9)} ${c(170, 150, 9)}`, alt: "M120 80 C150 100, 168 120, 170 141" },
  hand: { d: "M70 112 V58 a9 9 0 0 1 18 0 V104 M88 100 V44 a9 9 0 0 1 18 0 V100 M106 100 V50 a9 9 0 0 1 18 0 V104 M124 106 V70 a9 9 0 0 1 18 0 V140 C142 162, 132 176, 112 176 H92 C78 176, 70 166, 64 156 L40 120 a9 9 0 0 1 14 -10 L70 128 Z" },
  calendar: { d: "M36 48 H164 V170 H36 Z M36 80 H164 M70 32 V60 M130 32 V60 M60 104 H76 M92 104 H108 M124 104 H140 M60 136 H76 M92 136 H108", alt: "M120 134 l10 10 l22 -24" },
  steps: { d: `${e(64, 150, 14, 24)} ${e(104, 104, 14, 24)} ${e(144, 58, 14, 24)}` },
  words: { d: "M42 40 H130 a12 12 0 0 1 12 12 V96 a12 12 0 0 1 -12 12 H72 L50 128 V108 H42 a12 12 0 0 1 -12 -12 V52 a12 12 0 0 1 12 -12 Z M150 120 H160 a12 12 0 0 1 12 12 V160 a12 12 0 0 1 -12 12 H154 V188 L136 172 H96 a12 12 0 0 1 -12 -12 V140", alt: "M62 74 h1 M86 74 h1 M110 74 h1" },
  battery: { d: "M36 70 H152 V140 H36 Z M152 92 H166 V118 H152", alt: "M54 86 V124 M76 86 V124" },
  wheel: { d: `${c(100, 100, 66)} ${c(100, 100, 16)} M100 116 V166 M85 106 L40 118 M115 106 L160 118` },
  shield: { d: "M100 28 L160 50 V100 C160 140, 132 166, 100 178 C68 166, 40 140, 40 100 V50 Z", alt: "M78 120 L120 78 a14 14 0 0 1 20 20 L98 140 a14 14 0 0 1 -20 -20 Z M99 99 L119 119" },
  work: { d: "M34 70 H166 V162 H34 Z M78 70 V50 H122 V70 M34 108 H166", alt: "M92 108 V122 H108 V108" },
  mood: { d: "M50 166 H140 a28 28 0 0 0 0 -56 a36 36 0 0 0 -68 6 a24 24 0 0 0 -22 50 Z", alt: `${c(130, 70, 24)} M130 26 V34 M166 42 L160 48 M176 72 H168` },
  cup: { d: "M46 72 H148 L138 172 H56 Z M148 92 H160 a20 20 0 0 1 0 40 H144", alt: "M80 54 q-10 -14 0 -28 M106 54 q-10 -14 0 -28" },
  care: { d: "M20 122 C40 152, 70 168, 100 168 C130 168, 160 152, 180 122 M20 122 L42 110 L70 142 M180 122 L158 110 L130 142", alt: "M100 120 C80 104, 62 92, 62 74 a19 19 0 0 1 38 -8 a19 19 0 0 1 38 8 C138 92, 120 104, 100 120 Z" },
  page: { d: "M56 30 H124 L150 56 V170 H56 Z M124 30 V56 H150 M76 92 H130 M76 116 H130 M76 140 H112" },
};

type Look = { sym: string; ink: string; tint: string; text: string };
const LOOKS: Record<string, Look> = {
  "what-happens": { sym: "brain", ink: "#4A3F9C", tint: "#EEEBFA", text: "#2F2770" },
  "why-me": { sym: "heart", ink: "#A8402B", tint: "#FBEDE7", text: "#7E2F1F" },
  types: { sym: "types", ink: "#1F6476", tint: "#E4F1F4", text: "#164E5C" },
  scans: { sym: "scan", ink: "#34509E", tint: "#E7ECFB", text: "#233A78" },
  "heavy-side": { sym: "arm", ink: "#8A5A12", tint: "#FBF0DC", text: "#6B450C" },
  rewiring: { sym: "rewire", ink: "#4A3F9C", tint: "#EEEBFA", text: "#2F2770" },
  "arm-hand": { sym: "hand", ink: "#2F6851", tint: "#E8F3EC", text: "#1F4A3A" },
  "first-three-months": { sym: "calendar", ink: "#8A5A12", tint: "#FBF0DC", text: "#6B450C" },
  walking: { sym: "steps", ink: "#34509E", tint: "#E7ECFB", text: "#233A78" },
  words: { sym: "words", ink: "#6A3E9E", tint: "#F1E9FB", text: "#4E2C7A" },
  fatigue: { sym: "battery", ink: "#A8402B", tint: "#FBEDE7", text: "#7E2F1F" },
  driving: { sym: "wheel", ink: "#34509E", tint: "#E7ECFB", text: "#233A78" },
  prevention: { sym: "shield", ink: "#2F6851", tint: "#E8F3EC", text: "#1F4A3A" },
  work: { sym: "work", ink: "#8A5A12", tint: "#FBF0DC", text: "#6B450C" },
  mood: { sym: "mood", ink: "#2F4FA3", tint: "#E6ECF8", text: "#233A78" },
  swallowing: { sym: "cup", ink: "#A8402B", tint: "#FBEDE7", text: "#7E2F1F" },
  carers: { sym: "care", ink: "#6A3E9E", tint: "#F1E9FB", text: "#4E2C7A" },
  // Haemorrhagic stroke's own pieces.
  "two-kinds": { sym: "types", ink: "#1F6476", tint: "#E4F1F4", text: "#164E5C" },
  surgery: { sym: "scan", ink: "#34509E", tint: "#E7ECFB", text: "#233A78" },
  headaches: { sym: "brain", ink: "#A8402B", tint: "#FBEDE7", text: "#7E2F1F" },
  "blood-pressure": { sym: "heart", ink: "#2F6851", tint: "#E8F3EC", text: "#1F4A3A" },
  "blood-thinners": { sym: "shield", ink: "#8A5A12", tint: "#FBF0DC", text: "#6B450C" },
  // TIA's own pieces.
  "what-happened": { sym: "brain", ink: "#4A3F9C", tint: "#EEEBFA", text: "#2F2770" },
  warning: { sym: "calendar", ink: "#A8402B", tint: "#FBEDE7", text: "#7E2F1F" },
  tests: { sym: "scan", ink: "#1F6476", tint: "#E4F1F4", text: "#164E5C" },
  "not-a-tia": { sym: "words", ink: "#34509E", tint: "#E7ECFB", text: "#233A78" },
  tablets: { sym: "shield", ink: "#2F6851", tint: "#E8F3EC", text: "#1F4A3A" },
  carotid: { sym: "rewire", ink: "#A8402B", tint: "#FBEDE7", text: "#7E2F1F" },
  "af-check": { sym: "heart", ink: "#34509E", tint: "#E7ECFB", text: "#233A78" },
  prevent: { sym: "shield", ink: "#2F6851", tint: "#E8F3EC", text: "#1F4A3A" },
  worry: { sym: "mood", ink: "#2F4FA3", tint: "#E6ECF8", text: "#233A78" },
  fast: { sym: "page", ink: "#A8402B", tint: "#FBEDE7", text: "#7E2F1F" },
  // Stroke under 50's own pieces.
  "why-young": { sym: "heart", ink: "#6A3E9E", tint: "#F1E9FB", text: "#4E2C7A" },
  "too-young": { sym: "words", ink: "#A8402B", tint: "#FBEDE7", text: "#7E2F1F" },
  "recovery-shape": { sym: "rewire", ink: "#2F6851", tint: "#E8F3EC", text: "#1F4A3A" },
  hidden: { sym: "battery", ink: "#2F4FA3", tint: "#E6ECF8", text: "#233A78" },
  fitness: { sym: "steps", ink: "#8A5A12", tint: "#FBF0DC", text: "#6B450C" },
  money: { sym: "page", ink: "#4A3F9C", tint: "#EEEBFA", text: "#2F2770" },
  children: { sym: "care", ink: "#8A5A12", tint: "#FBF0DC", text: "#6B450C" },
  relationships: { sym: "care", ink: "#A8402B", tint: "#FBEDE7", text: "#7E2F1F" },
};
const LOOK_CYCLE: Look[] = [LOOKS["what-happens"], LOOKS["why-me"], LOOKS.types, LOOKS.scans, LOOKS["heavy-side"]];
const THEME_SYMS: Record<string, string> = { "what-happens": "brain", diagnosis: "scan", stages: "steps", "not-just-memory": "words", steps: "steps", "thinking-not-memory": "rewire", fluctuations: "battery", hallucinations: "mood", "forgetting-words": "words", "what-mci-is": "brain", tests: "scan", "other-causes": "heart",
  dopamine: "brain", "unexpected-symptoms": "mood", "tremor-types": "hand", "morning-shaking": "calendar", "what-it-is": "brain", "not-parkinsons": "types", families: "care", "worse-days": "battery", types: "types", "sensory-trick": "hand" };
/** A tile's look: on a light-themed page, the palette's family; on the stroke pages, its own colour. */
const lookFor = (item: LibraryItem, index: number, palette?: ThemePalette, heart = false): Look => {
  if (!palette) return LOOKS[item.id] ?? { ...LOOK_CYCLE[index % LOOK_CYCLE.length], sym: "page" };
  const sym = THEME_SYMS[item.id] ?? LOOKS[item.id]?.sym ?? "page";
  // The Heart & lungs pages show a heart where a brain page would show a brain.
  return { ...tileLooks(palette)[index % 4], sym: heart && sym === "brain" ? "heart" : sym };
};

function SymbolArt({ name, colour, accent, width, className }: { name: string; colour: string; accent: string; width: number; className: string }) {
  const sym = SYM[name] ?? SYM.page;
  return <svg className={className} aria-hidden="true" focusable="false" viewBox="0 0 200 200" fill="none" stroke={colour} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round">
    <path d={sym.d} />
    {sym.alt && <path d={sym.alt} stroke={accent} />}
    {sym.dot && <path d={sym.dot} fill={accent} stroke="none" />}
  </svg>;
}

// ---- The header -------------------------------------------------------------------------------

const BREATH_GROUPS = ["long-term-lung", "sleep-breathing"];

function Hero({ place, state }: { place: ConditionPlace; state: LibraryState }) {
  const { section, group, condition } = place;
  const key = conditionKey(place);
  const saved = state.saved.includes(key);
  const theme = themeOf(group.id);
  const stroke = !paletteFor(place);
  return <header className="lib-v2-hero">
    {theme === "movement" ? <MovementArt /> : BREATH_GROUPS.includes(group.id) ? <BreathArt /> : group.id === "diabetes" ? <GlucoseArt /> : group.id === "thyroid" ? <ThyroidArt /> : group.id === "arthritis" ? <JointArt /> : group.id === "bone-health" ? <BoneArt /> : group.id === "back-neck" ? <SpineHeroArt /> : group.id === "joint-replacement" || group.id === "injuries" ? <JointArt /> : group.id === "muscles" ? <SettleArt /> : group.id === "feet-tendons" ? <PathArt />
      : ["common-cancers", "blood-cancers", "womens-cancers", "mens-cancers", "digestive-cancers", "other-cancers", "rarer-cancers"].includes(group.id) ? <RibbonArt /> : group.id === "after-treatment" || group.id === "advanced-cancer" ? <SunriseArt /> : group.id === "depression" ? <CloudArt /> : group.id === "anxiety" ? <SettleArt /> : group.id === "sleep" ? <MoonArt /> : group.id === "bipolar-psychosis" ? <SettleArt /> : group.id === "stress-grief" ? <CloudArt /> : group.id === "eating-disorders" ? <SunriseArt />
      : group.id === "cholesterol" ? <ArteryArt /> : group.id === "weight" ? <PathArt /> : group.id === "gout-vitamins" ? <SunArt />
      : group.id === "kidneys" || group.id === "bladder" ? <KidneyArt /> : group.id === "stomach" || group.id === "ibd" ? <GutArt /> : group.id === "liver" ? <LiverArt /> : group.id === "gut" ? <GutArt /> : section.id === "heart-lungs" ? <PulseArt /> : !stroke ? <MemoryArt /> : <svg className="lib-v2-hero-art" aria-hidden="true" focusable="false" viewBox="0 0 1280 440" preserveAspectRatio="xMidYMid slice">
      <g fill="none" stroke="#3E3390" strokeWidth="16" strokeLinecap="round" opacity=".9">
        <path d="M-20 330 C200 310, 320 250, 480 240 S760 210, 900 150 S1120 90, 1300 70" />
        <path d="M480 240 C560 290, 700 320, 860 330 S1120 350, 1300 360" />
        <path d="M900 150 C960 200, 1060 230, 1180 240" />
        <path d="M700 220 C740 160, 820 120, 900 100 S1040 70, 1100 40" />
        <path d="M300 300 C360 360, 440 400, 560 420" />
      </g>
      <g fill="none" stroke="#E07A5F" strokeWidth="5" strokeLinecap="round">
        <path className="lib-v2-flow" d="M-20 330 C200 310, 320 250, 480 240 S760 210, 900 150 S1120 90, 1300 70" />
        <path className="lib-v2-flow is-slow" d="M480 240 C560 290, 700 320, 860 330 S1120 350, 1300 360" />
        <path className="lib-v2-flow" d="M900 150 C960 200, 1040 222, 1150 236" />
        <path className="lib-v2-flow is-slow" d="M700 220 C740 160, 820 120, 900 100 S1040 70, 1100 40" />
        <path className="lib-v2-flow is-slow" d="M300 300 C360 360, 440 400, 560 420" />
      </g>
      {/* Stroke pages only. Ischaemic: a clot stops the branch. Haemorrhagic: the branch leaks, and the
          bleed spreads. TIA: the clot forms, then clears. */}
      {stroke && <circle className="lib-v2-ring" cx="1166" cy="238" r="10" fill="none" stroke="#F2B8A5" strokeWidth="2" />}
      {stroke && (place.condition.id === "haemorrhagic"
        ? <g fill="#9E2A2A"><ellipse className="lib-v2-bleed" cx="1166" cy="252" rx="46" ry="28" opacity=".85" /><circle cx="1150" cy="290" r="6" opacity=".7" /><circle cx="1190" cy="296" r="4" opacity=".6" /></g>
        : <circle className={`lib-v2-clot${place.condition.id === "tia" ? " is-passing" : ""}`} cx="1166" cy="238" r="11" fill="#7A2A1C" />)}
    </svg>}
    <div className="lib-v2-hero-inner">
      <div className="lib-v2-hero-top">
        <Crumbs trail={[{ label: "Library", href: "/" }, { label: section.title, href: sectionHref(section) }, { label: group.title, href: `${sectionHref(section)}#group-${group.id}` }, { label: condition.title }]} />
      </div>
      <div className="lib-v2-hero-row">
        <div className="lib-v2-hero-words">
          <h1>{condition.title}</h1>
          {condition.summary && <p>{condition.summary}</p>}
          {condition.facts && <ul className="lib-v2-facts" role="list">{condition.facts.map(fact => <li key={fact}>{fact}</li>)}</ul>}
        </div>
        <button type="button" className="lib-v2-save" aria-pressed={saved} onClick={() => libraryStore.toggleSaved(key)}><BookmarkIcon filled={saved} />{saved ? "Saved to my pages" : "Save to my pages"}</button>
      </div>
    </div>
  </header>;
}

/**
 * The header of a light-themed page: a soft network of connections, in the page's own colours (the
 * --t-… variables). Some points glow and fade, some links come and go, and the rest hold steady.
 */
function MemoryArt() {
  const nodes = [[760, 120], [860, 70], [930, 170], [1040, 110], [1120, 210], [1010, 260], [880, 300], [1180, 90], [1230, 300], [700, 260], [820, 210], [1100, 350]];
  const links = [[0, 1], [1, 3], [0, 10], [10, 2], [2, 3], [3, 7], [3, 4], [4, 5], [5, 2], [5, 6], [6, 9], [9, 10], [4, 8], [5, 11], [8, 11], [7, 4]];
  return <svg className="lib-v2-hero-art" aria-hidden="true" focusable="false" viewBox="0 0 1280 440" preserveAspectRatio="xMidYMid slice">
    <g style={{ stroke: "var(--t-soft)" }} strokeWidth="3" strokeLinecap="round" opacity=".7">
      {links.map(([a, b], index) => <line key={index} className={index % 4 === 1 ? "lib-v2-link is-fading" : "lib-v2-link"} style={{ animationDelay: `${-index * 0.7}s` }} x1={nodes[a][0]} y1={nodes[a][1]} x2={nodes[b][0]} y2={nodes[b][1]} />)}
    </g>
    {nodes.map(([x, y], index) => <g key={index}>
      <circle cx={x} cy={y} r={index % 3 === 0 ? 14 : 9} style={{ fill: "var(--t-soft)" }} opacity=".45" />
      <circle className="lib-v2-node" style={{ animationDelay: `${-index * 0.9}s`, fill: "var(--t-ink)" }} cx={x} cy={y} r={index % 3 === 0 ? 7 : 5} />
    </g>)}
  </svg>;
}

/**
 * The Parkinson's & movement header: lines that waver like a tremor on the left, and settle into
 * smooth, steady waves towards the right.
 */
function MovementArt() {
  const line = (y: number, wobble: number) => {
    let d = `M560 ${y}`;
    for (let x = 560; x < 1300; x += 20) {
      const settle = Math.max(0, 1 - (x - 560) / 420);
      d += ` Q${x + 10} ${y + (((x / 20) % 2) ? wobble : -wobble) * settle + Math.sin(x / 90) * 10} ${x + 20} ${y + Math.sin((x + 20) / 90) * 10}`;
    }
    return d;
  };
  return <svg className="lib-v2-hero-art" aria-hidden="true" focusable="false" viewBox="0 0 1280 440" preserveAspectRatio="xMidYMid slice">
    <g fill="none" strokeLinecap="round" strokeLinejoin="round">
      {[110, 190, 270, 350].map((y, index) => <path key={y} className={index % 2 ? "lib-v2-wave is-slow" : "lib-v2-wave"} d={line(y, 14 - index * 2)} stroke={index === 1 ? "#34509E" : "#A9BBE8"} strokeWidth={index === 1 ? 5 : 3} opacity={index === 1 ? 0.75 : 0.8} />)}
    </g>
    <circle className="lib-v2-node" cx="1180" cy="190" r="7" fill="#34509E" />
  </svg>;
}

/** The heart groups' header: a heartbeat trace that draws itself across, again and again. */
function PulseArt() {
  const beats = Array.from({ length: 4 }, (_, index) => {
    const x = 560 + index * 190;
    return `L${x + 90} 220 L${x + 104} 196 L${x + 118} 250 L${x + 132} 120 L${x + 148} 290 L${x + 162} 220`;
  }).join(" ");
  return <svg className="lib-v2-hero-art" aria-hidden="true" focusable="false" viewBox="0 0 1280 440" preserveAspectRatio="xMidYMid slice">
    <path d={`M540 220 ${beats} L1320 220`} fill="none" style={{ stroke: "var(--t-soft)" }} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" opacity=".45" />
    <path className="lib-v2-trace" pathLength={100} d={`M540 220 ${beats} L1320 220`} fill="none" style={{ stroke: "var(--t-ink)" }} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>;
}

/** The diabetes pages' header: a blood-sugar line that rises after meals and settles back into a target band. */
function GlucoseArt() {
  const line = "M540 250 C580 250, 600 160, 640 160 S700 240, 740 236 S800 130, 840 132 S900 230, 950 228 S1010 170, 1050 172 S1110 226, 1160 224 S1240 200, 1300 204";
  return <svg className="lib-v2-hero-art" aria-hidden="true" focusable="false" viewBox="0 0 1280 440" preserveAspectRatio="xMidYMid slice">
    <rect x="540" y="180" width="760" height="80" rx="12" style={{ fill: "var(--t-soft)" }} opacity=".18" />
    <path d={line} fill="none" style={{ stroke: "var(--t-soft)" }} strokeWidth="3" opacity=".45" />
    <path className="lib-v2-trace" pathLength={100} d={line} fill="none" style={{ stroke: "var(--t-ink)" }} strokeWidth="5" strokeLinecap="round" />
  </svg>;
}

/** The thyroid pages' header: the butterfly-shaped gland, glowing softly in time. */
function ThyroidArt() {
  return <svg className="lib-v2-hero-art" aria-hidden="true" focusable="false" viewBox="0 0 1280 440" preserveAspectRatio="xMidYMid slice">
    <g transform="translate(940 220)" fill="none" strokeLinejoin="round">
      {/* The windpipe, with its rings, behind the gland. */}
      <path d="M-34 -230 V230 M34 -230 V230" style={{ stroke: "var(--t-soft)" }} strokeWidth="4" opacity=".55" />
      {[-180, -130, -80, -30, 20, 70, 120, 170].map(y => <path key={y} d={`M-34 ${y} Q0 ${y + 10} 34 ${y}`} style={{ stroke: "var(--t-soft)" }} strokeWidth="3" opacity=".45" />)}
      {/* Two tall lobes joined low down by the isthmus. */}
      <path d="M-30 70 C-60 100, -120 96, -130 30 C-140 -40, -110 -130, -80 -130 C-56 -130, -46 -80, -40 -20 C-36 20, -34 50, -30 70 Z" style={{ stroke: "var(--t-ink)", fill: "var(--t-soft)" }} strokeWidth="5" fillOpacity=".3" className="lib-v2-breathe is-slow" />
      <path d="M30 70 C60 100, 120 96, 130 30 C140 -40, 110 -130, 80 -130 C56 -130, 46 -80, 40 -20 C36 20, 34 50, 30 70 Z" style={{ stroke: "var(--t-ink)", fill: "var(--t-soft)" }} strokeWidth="5" fillOpacity=".3" className="lib-v2-breathe is-slow" />
      <path d="M-34 44 C-12 58, 12 58, 34 44 L34 74 C12 86, -12 86, -34 74 Z" style={{ stroke: "var(--t-ink)", fill: "var(--t-soft)" }} strokeWidth="4" fillOpacity=".3" />
    </g>
  </svg>;
}

/** The arthritis pages' header: a knee joint that bends gently, its lining glowing softly. */
function JointArt() {
  return <svg className="lib-v2-hero-art" aria-hidden="true" focusable="false" viewBox="0 0 1280 440" preserveAspectRatio="xMidYMid slice">
    <g transform="translate(960 220)" fill="none" strokeLinecap="round" strokeLinejoin="round">
      <path d="M-40 -230 V-40 C-40 -10, -20 4, 0 4 C20 4, 40 -10, 40 -40 V-230" style={{ stroke: "var(--t-ink)", fill: "var(--t-soft)" }} strokeWidth="5" fillOpacity=".2" />
      <g className="lib-v2-sway"><path d="M-40 230 V60 C-40 30, -20 18, 0 18 C20 18, 40 30, 40 60 V230" style={{ stroke: "var(--t-ink)", fill: "var(--t-soft)" }} strokeWidth="5" fillOpacity=".2" /></g>
      <ellipse cx="0" cy="11" rx="70" ry="22" className="lib-v2-breathe is-slow" style={{ stroke: "var(--t-soft)" }} strokeWidth="4" strokeDasharray="6 8" />
    </g>
  </svg>;
}

/** The bone health pages' header: a long bone with its honeycomb inside, slowly filling. */
function BoneArt() {
  const dots = Array.from({ length: 22 }, (_, index) => [880 + (index % 11) * 22, 205 + Math.floor(index / 11) * 26]);
  return <svg className="lib-v2-hero-art" aria-hidden="true" focusable="false" viewBox="0 0 1280 440" preserveAspectRatio="xMidYMid slice"><g transform="translate(-20 90)">
    <path d="M760 190 a36 36 0 1 1 46 -22 H1150 a36 36 0 1 1 46 22 a36 36 0 1 1 -46 22 H806 a36 36 0 1 1 -46 -22 Z" style={{ stroke: "var(--t-ink)", fill: "var(--t-soft)" }} strokeWidth="5" fillOpacity=".18" />
    {dots.map(([x, y], index) => <circle key={index} className="lib-v2-node" cx={x} cy={y} r="5" style={{ fill: "var(--t-ink)", animationDelay: `${-index * 0.3}s` }} opacity=".5" />)}
  </g></svg>;
}

/** The back pages' header: a spine of vertebrae, swaying gently as if walking. */
function SpineHeroArt() {
  return <svg className="lib-v2-hero-art" aria-hidden="true" focusable="false" viewBox="0 0 1280 440" preserveAspectRatio="xMidYMid slice">
    <g className="lib-v2-sway">
      {Array.from({ length: 12 }, (_, index) => {
        const y = 20 + index * 35; const x = 960 + Math.sin(index / 2.4) * 46;
        return <rect key={index} x={x - 46} y={y} width="92" height="26" rx="11" style={{ stroke: "var(--t-ink)", fill: "var(--t-soft)" }} strokeWidth="4" fillOpacity={index % 3 === 1 ? 0.5 : 0.2} />;
      })}
    </g>
  </svg>;
}

const ART_PROPS = { className: "lib-v2-hero-art", "aria-hidden": true, focusable: false, viewBox: "0 0 1280 440", preserveAspectRatio: "xMidYMid slice" } as const;
const INKED = { stroke: "var(--t-ink)", fill: "var(--t-soft)" };

/** The cancer pages' header: a looped ribbon, with soft rings widening behind it. */
function RibbonArt() {
  return <svg {...ART_PROPS}>
    <g fill="none" style={{ stroke: "var(--t-soft)" }} strokeWidth="3" opacity=".5">
      {[110, 170, 230].map((r, index) => <circle key={r} className={`lib-v2-breathe${index === 1 ? " is-slow" : ""}`} cx="960" cy="200" r={r} style={{ animationDelay: `${-index * 1.4}s` }} />)}
    </g>
    <g transform="translate(960 190)" fill="none" strokeLinecap="round" strokeLinejoin="round" style={{ stroke: "var(--t-ink)" }} strokeWidth="14">
      <path d="M0 -10 C-60 -80, -40 -150, 0 -150 C40 -150, 60 -80, 0 -10 L-70 150" />
      <path d="M0 -10 L70 150" />
    </g>
  </svg>;
}

/** Life after treatment: a low sun rising slowly over the horizon. */
function SunriseArt() {
  return <svg {...ART_PROPS}>
    <path d="M560 330 H1320" style={{ stroke: "var(--t-soft)" }} strokeWidth="4" />
    <g className="lib-v2-breathe is-slow"><path d="M840 330 A120 120 0 0 1 1080 330 Z" style={INKED} strokeWidth="5" fillOpacity=".3" /></g>
    {[[960, 150], [840, 190], [1080, 190], [770, 270], [1150, 270]].map(([x, y], index) => <circle key={index} className="lib-v2-node" cx={x} cy={y} r="7" style={{ fill: "var(--t-ink)", animationDelay: `${-index * 0.8}s` }} />)}
  </svg>;
}

/** The depression pages' header: a heavy cloud with light breaking through at its edge. */
function CloudArt() {
  return <svg {...ART_PROPS}>
    <g className="lib-v2-breathe is-slow" transform="translate(940 200)"><path d="M-190 60 a70 70 0 0 1 40 -126 a96 96 0 0 1 180 -20 a70 70 0 0 1 110 146 Z" style={INKED} strokeWidth="5" fillOpacity=".25" strokeLinejoin="round" /></g>
    <circle cx="1130" cy="100" r="34" style={{ fill: "var(--t-soft)" }} opacity=".55" />
    {[[1130, 40], [1196, 100], [1176, 52]].map(([x, y], index) => <circle key={index} className="lib-v2-node" cx={x} cy={y} r="6" style={{ fill: "var(--t-ink)", animationDelay: `${-index * 1.1}s` }} />)}
  </svg>;
}

/** The anxiety pages' header: choppy lines on the left that settle into calm water on the right. */
function SettleArt() {
  const line = (y: number, chop: number) => {
    let d = `M560 ${y}`;
    for (let x = 560; x < 1300; x += 24) {
      const settle = Math.max(0, 1 - (x - 560) / 460);
      d += ` Q${x + 12} ${y + (((x / 24) % 2) ? chop : -chop) * settle + Math.sin(x / 110) * 12} ${x + 24} ${y + Math.sin((x + 24) / 110) * 12}`;
    }
    return d;
  };
  return <svg {...ART_PROPS}>
    <g fill="none" strokeLinecap="round" strokeLinejoin="round">
      {[130, 210, 290, 370].map((y, index) => <path key={y} className={index % 2 ? "lib-v2-wave is-slow" : "lib-v2-wave"} d={line(y, 22 - index * 3)} style={{ stroke: index === 1 ? "var(--t-ink)" : "var(--t-soft)" }} strokeWidth={index === 1 ? 5 : 3} opacity=".75" />)}
    </g>
  </svg>;
}

/** The sleep pages' header: a crescent moon, gently glowing, and stars coming and going. */
function MoonArt() {
  const stars = [[760, 90], [860, 210], [1180, 80], [1220, 300], [800, 330], [1080, 370], [700, 200]];
  return <svg {...ART_PROPS}>
    <g className="lib-v2-breathe is-slow"><path d="M1000 120 A110 110 0 1 0 1096 288 A88 88 0 1 1 1000 120 Z" style={INKED} strokeWidth="5" fillOpacity=".3" /></g>
    {stars.map(([x, y], index) => <circle key={index} className="lib-v2-node" cx={x} cy={y} r={index % 2 ? 5 : 7} style={{ fill: "var(--t-ink)", animationDelay: `${-index * 0.9}s` }} />)}
  </svg>;
}

/** The kidney pages' header: two kidneys, breathing softly, with the flow down to the bladder. */
function KidneyArt() {
  return <svg {...ART_PROPS}>
    <g transform="translate(960 190)" strokeWidth="5" strokeLinejoin="round">
      <g className="lib-v2-breathe is-slow">
        <path d="M-60 -130 C-170 -130, -190 -10, -170 50 C-150 110, -80 120, -64 70 C-52 30, -96 10, -84 -40 C-76 -80, -20 -130, -60 -130 Z" style={INKED} fillOpacity=".3" />
        <path d="M60 -130 C170 -130, 190 -10, 170 50 C150 110, 80 120, 64 70 C52 30, 96 10, 84 -40 C76 -80, 20 -130, 60 -130 Z" style={INKED} fillOpacity=".3" />
      </g>
      <path className="lib-v2-flow is-slow" d="M-72 40 C-50 120, -20 180, -16 260 M72 40 C50 120, 20 180, 16 260" fill="none" style={{ stroke: "var(--t-soft)" }} strokeLinecap="round" />
    </g>
  </svg>;
}

/** The liver pages' header: the liver, with spots of fat fading away as it recovers. */
function LiverArt() {
  const spots = [[860, 170], [920, 220], [990, 160], [1060, 200], [900, 280], [970, 260], [1130, 170], [1040, 270]];
  return <svg {...ART_PROPS}>
    <path d="M740 180 C780 100, 1000 80, 1200 110 C1230 116, 1230 150, 1200 170 C1110 240, 990 310, 900 330 C800 350, 720 280, 740 180 Z" style={INKED} strokeWidth="5" fillOpacity=".25" strokeLinejoin="round" />
    {spots.map(([x, y], index) => <circle key={index} className="lib-v2-node" cx={x} cy={y} r={index % 3 ? 9 : 13} style={{ fill: "var(--t-ink)", animationDelay: `${-index * 0.7}s` }} opacity=".5" />)}
  </svg>;
}

/** The gut pages' header: a looping gut, with movement travelling along it. */
function GutArt() {
  const loop = "M880 150 H1170 C1220 150, 1220 210, 1170 210 H920 C870 210, 870 270, 920 270 H1170 C1220 270, 1220 330, 1170 330 H980";
  return <svg {...ART_PROPS}>
    <path d={loop} fill="none" style={{ stroke: "var(--t-soft)" }} strokeWidth="22" strokeLinecap="round" strokeLinejoin="round" opacity=".3" />
    <path className="lib-v2-trace" pathLength={100} d={loop} fill="none" style={{ stroke: "var(--t-ink)" }} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>;
}

/** The cholesterol pages' header: an artery with fatty patches along its wall, and blood flowing through. */
function ArteryArt() {
  return <svg {...ART_PROPS}>
    <path d="M560 150 H1320 M560 290 H1320" style={{ stroke: "var(--t-ink)" }} strokeWidth="6" fill="none" />
    {[[700, 160], [880, 280], [1060, 160], [1220, 280]].map(([x, y], index) => <ellipse key={index} cx={x} cy={y} rx="46" ry="16" style={{ fill: "var(--t-soft)" }} opacity=".55" />)}
    <path className="lib-v2-flow is-slow" d="M560 220 C700 200, 820 240, 960 220 S1200 200, 1320 220" fill="none" style={{ stroke: "var(--t-soft)" }} strokeWidth="5" strokeLinecap="round" />
  </svg>;
}

/** The weight pages' header: a gentle downward path that levels out, step by step. */
function PathArt() {
  const line = "M560 140 C660 150, 720 190, 820 210 S980 250, 1080 262 S1240 272, 1320 272";
  return <svg {...ART_PROPS}>
    <path d={line} fill="none" style={{ stroke: "var(--t-soft)" }} strokeWidth="3" opacity=".5" />
    <path className="lib-v2-trace" pathLength={100} d={line} fill="none" style={{ stroke: "var(--t-ink)" }} strokeWidth="5" strokeLinecap="round" />
    {[[820, 210], [1080, 262]].map(([x, y], index) => <circle key={index} className="lib-v2-node" cx={x} cy={y} r="8" style={{ fill: "var(--t-ink)", animationDelay: `${-index}s` }} />)}
  </svg>;
}

/** The gout and vitamin D pages' header: a warm sun, slowly glowing, over soft rays. */
function SunArt() {
  return <svg {...ART_PROPS}>
    <g className="lib-v2-breathe is-slow"><circle cx="980" cy="200" r="90" style={INKED} strokeWidth="5" fillOpacity=".3" /></g>
    {Array.from({ length: 12 }, (_, index) => { const angle = (index / 12) * Math.PI * 2; return <line key={index} className="lib-v2-node" style={{ stroke: "var(--t-ink)", animationDelay: `${-index * 0.4}s` }} strokeWidth="5" strokeLinecap="round" x1={980 + 120 * Math.cos(angle)} y1={200 + 120 * Math.sin(angle)} x2={980 + 150 * Math.cos(angle)} y2={200 + 150 * Math.sin(angle)} />; })}
  </svg>;
}

/** The breathing groups' header: soft waves that rise and fall slowly, like a breath. */
function BreathArt() {
  return <svg className="lib-v2-hero-art" aria-hidden="true" focusable="false" viewBox="0 0 1280 440" preserveAspectRatio="xMidYMid slice">
    <g fill="none" strokeLinecap="round">
      {[150, 220, 290].map((y, index) => <path key={y} className={`lib-v2-breathe${index === 1 ? " is-slow" : ""}`} d={`M560 ${y} C640 ${y - 60}, 720 ${y - 60}, 800 ${y} S960 ${y + 60}, 1040 ${y} S1200 ${y - 60}, 1300 ${y}`}
        style={{ stroke: index === 1 ? "var(--t-ink)" : "var(--t-soft)", animationDelay: `${-index * 1.2}s` }} strokeWidth={index === 1 ? 5 : 3} opacity={index === 1 ? 0.7 : 0.6} />)}
    </g>
  </svg>;
}

// ---- The bar of the page's parts --------------------------------------------------------------

type Part = { id: string; label: string; story?: boolean };
function PartsBar({ parts }: { parts: Part[] }) {
  const [active, setActive] = useState(parts[0]?.id);
  const key = parts.map(part => part.id).join(",");
  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const seen = new Map<string, boolean>();
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => seen.set(entry.target.id, entry.isIntersecting));
      const first = parts.find(part => seen.get(part.id));
      if (first) setActive(first.id);
    }, { rootMargin: "-20% 0px -65% 0px" });
    parts.forEach(part => { const node = document.getElementById(part.id); if (node) observer.observe(node); });
    return () => observer.disconnect();
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  return <nav aria-label="On this page" className="lib-v2-parts">
    <div className="lib-v2-parts-inner">
      {parts.map(part => <a key={part.id} href={`#${part.id}`} onClick={jumpTo(part.id)} className={`${active === part.id ? "is-active" : ""}${part.story ? " is-story" : ""}`} aria-current={active === part.id ? "true" : undefined}>{part.label}</a>)}
    </div>
  </nav>;
}

// ---- Understand as a bento --------------------------------------------------------------------

function Understand({ place, items, outside }: { place: ConditionPlace; items: LibraryItem[]; outside: LibraryItem[] }) {
  const [active, setActive] = useState(items[0]?.id ?? "");
  const [moves, setMoves] = useState(0);
  const [said, setSaid] = useState("");
  const main = items.find(item => item.id === active) ?? items[0];
  if (!main) return null;
  const palette = paletteFor(place);
  const heart = place.section.id === "heart-lungs";
  const look = lookFor(main, items.indexOf(main), palette, heart);
  const rest = items.filter(item => item.id !== main.id);
  const felt = main.feltToo;
  const feltStories = felt ? felt.storyIds.map(id => findStory(id)).filter((story): story is LibraryStory => Boolean(story)) : [];
  const entering = moves > 0 ? " is-entering" : "";
  const show = (item: LibraryItem) => {
    setActive(item.id);
    setMoves(count => count + 1);
    setSaid(`Showing ${item.title}`);
    requestAnimationFrame(() => document.getElementById("lib-v2-feature-title")?.focus({ preventScroll: true }));
  };

  return <>
    <p className="lib-sr" aria-live="polite">{said}</p>
    <div className="lib-v2-bento">
      <article key={`${main.id}-${moves}`} className={`lib-v2-tile is-feature${entering}`} style={{ background: look.ink }} aria-labelledby="lib-v2-feature-title">
        <SymbolArt name={look.sym} colour="#FFFFFF" accent="#F2B8A5" width={5} className="lib-v2-sym" />
        <div className="lib-v2-tags">
          <span>{itemMeta(main)}</span>
        </div>
        <h3 id="lib-v2-feature-title" tabIndex={-1}>{main.title}</h3>
        {main.blurb && <p>{main.blurb}</p>}
        {felt && feltStories.length > 0 && <Link href={storyHref(felt.storyIds[0], felt.chapter)} className="lib-v2-felt"><Faces stories={feltStories} size={22} />{felt.label} →</Link>}
        <Link href={itemHref({ ...place, item: main })} className="lib-v2-read" style={{ color: look.ink }}>Read the answer <span aria-hidden="true">→</span></Link>
      </article>

      {rest.map((item, index) => {
        const tile = lookFor(item, items.indexOf(item), palette, heart);
        return <article key={`${item.id}-${moves}`} className={`lib-v2-tile is-small${entering}`} style={{ background: tile.tint, color: tile.text, animationDelay: `${index * 0.05}s` } as CSSProperties}>
          <button type="button" className="lib-v2-pick" onClick={() => show(item)} aria-label={`Show ${item.title} in the large tile`} />
          <SymbolArt name={tile.sym} colour={tile.ink} accent="#D9674A" width={7} className="lib-v2-sym" />
          <span className="lib-v2-small-meta">{itemMeta(item)}</span>
          <h3>{item.title}</h3>
          <span className="lib-v2-more" aria-hidden="true">Tap to open it here →</span>
        </article>;
      })}

      {outside.length > 0 && <a href="#outside" onClick={jumpTo("outside")} className="lib-v2-tile is-count">
        <span className="lib-v2-count">{outside.length}</span>
        <h3>Checked resources from trusted places</h3>
        <span className="lib-v2-count-note">{outside.map(item => item.publisher).filter((publisher, at, all): publisher is string => Boolean(publisher) && all.indexOf(publisher) === at).slice(0, 3).join(", ")} and more.</span>
        <span className="lib-v2-more">See them below →</span>
      </a>}
    </div>

    {outside.length > 0 && <ul id="outside" className="lib-v2-strip" role="list" aria-label="Checked resources from trusted places">
      {outside.map(item => <li key={item.id}>
        <a href={item.url} target="_blank" rel="noopener noreferrer" className="lib-v2-src">
          <span className="lib-v2-src-kind">{[contentKind(item), item.date].filter(Boolean).join(" · ")}<span aria-hidden="true">↗</span></span>
          <b>{item.title}</b>
          <span className="lib-v2-src-by">{item.publisher}</span>
          <span className="lib-sr">(opens in a new tab)</span>
        </a>
      </li>)}
    </ul>}
  </>;
}

const contentKind = (item: LibraryItem) => itemMeta(item, true, false).split(" · ")[0];

// ---- Live well, Watch & listen (Explore is GoalCards.tsx) -------------------------------------

// Live well: one row per piece, with a small icon, a line saying what is in it, and a tag or an
// arrow. The carers' page is the dark row. The lines and tags are this page's own.

const LW_ICON: Record<string, ReactNode> = {
  driving: <path d="M5 16V11l2-4.5h10L19 11v5M5 16h14M5 16v2M19 16v2M5 11h14M8 13.5h.01M16 13.5h.01" />,
  prevention: <><path d="M12 3l7.5 4.25v8.5L12 20l-7.5-4.25v-8.5Z" /><path d="M12 8.5v7M8.5 12h7" /></>,
  work: <><rect x="4" y="7.5" width="16" height="11" rx="2" /><path d="M9 7.5V6a1.5 1.5 0 0 1 1.5-1.5h3A1.5 1.5 0 0 1 15 6v1.5" /></>,
  mood: <path d="M4 14c2.2-4 4.4-4 6.4 0s4.2 4 6.4 0c.9-1.6 1.9-2.4 3.2-2.4" />,
  swallowing: <><path d="M4.5 10h15l-1.6 8.2a1.5 1.5 0 0 1-1.5 1.3H7.6a1.5 1.5 0 0 1-1.5-1.3Z" /><path d="M9 10l3-5.5 3 5.5M10 14v2.5M14 14v2.5" /></>,
  carers: <><circle cx="9" cy="8.5" r="2.8" /><circle cx="16.5" cy="9.5" r="2.2" /><path d="M3.5 19c.6-3.2 2.8-5 5.5-5s4.9 1.8 5.5 5M14.5 14.4c.6-.3 1.3-.4 2-.4 2.2 0 3.7 1.6 4 4.5" /></>,
  "blood-pressure": <><path d="M4 18a8 8 0 0 1 16 0" /><path d="M12 18l4-5" /></>,
  "blood-thinners": <><rect x="4" y="9" width="16" height="7" rx="3.5" /><path d="M12 9v7" /></>,
  prevent: <><path d="M12 3l7.5 4.25v8.5L12 20l-7.5-4.25v-8.5Z" /><path d="M12 8.5v7M8.5 12h7" /></>,
  worry: <path d="M4 14c2.2-4 4.4-4 6.4 0s4.2 4 6.4 0c.9-1.6 1.9-2.4 3.2-2.4" />,
  fast: <><circle cx="12" cy="12" r="8" /><path d="M12 7.5V12l3 2" /></>,
  money: <><rect x="3.5" y="7" width="17" height="11" rx="2" /><circle cx="12" cy="12.5" r="2.5" /><path d="M6.5 10v5M17.5 10v5" /></>,
  children: <><circle cx="9" cy="7.5" r="2.8" /><circle cx="16.5" cy="11" r="2" /><path d="M3.5 19.5c.5-3.6 2.6-5.5 5.5-5.5s5 1.9 5.5 5.5M14 19.5c.3-2.4 1.3-3.8 2.5-3.8s2.2 1.4 2.5 3.8" /></>,
  relationships: <path d="M12 19s-7-4.3-7-9.2A3.8 3.8 0 0 1 12 7.6a3.8 3.8 0 0 1 7 2.2C19 14.7 12 19 12 19Z" />,
  // Dementia & memory's own.
  "telling-people": <><path d="M4 6.5h11a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2H9l-4 3v-3H4" /><path d="M20 10v6l-2 1.5" /></>,
  planning: <><circle cx="8" cy="12" r="3.5" /><path d="M11.5 12H20M17 12v3M19.5 12v2" /></>,
  "good-days": <><circle cx="12" cy="12" r="4" /><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4" /></>,
  home: <><path d="M4 11 12 4l8 7v9H4Z" /><path d="M10 20v-5h4v5" /></>,
  responding: <><path d="M4 6h16v9H9l-5 4Z" /><path d="M8 10.5h8" /></>,
  sleep: <path d="M16 4a7 7 0 1 0 4 12 6 6 0 1 1-4-12Z" />,
  // Parkinson's & movement's own.
  freezing: <><path d="M7 19c-2 0-3-1.5-3-3s1-2.5 3-2.5 3 1 3 2.5-1 3-3 3Z" /><path d="M16 11c-2 0-3-1.5-3-3s1-2.5 3-2.5 3 1 3 2.5-1 3-3 3Z" /><path d="M4 21h16" /></>,
  falls: <><path d="M4 20h16" /><path d="M7 20V9h10v11" /><path d="M12 9V4" /></>,
  "driving-work": <path d="M5 16V11l2-4.5h10L19 11v5M5 16h14M5 16v2M19 16v2M5 11h14" />,
  "out-and-about": <><circle cx="12" cy="12" r="7" /><path d="M5 12h14M12 5v14" /></>,
  alcohol: <><path d="M8 4h8l-1 7a3 3 0 0 1-6 0Z" /><path d="M12 14v6M9 20h6" /></>,
  voice: <><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></>,
  pain: <path d="M13 3 6 13h5l-1 8 7-10h-5Z" />,
  // Heart & lungs' own.
  "alcohol-weight": <><path d="M8 4h8l-1 7a3 3 0 0 1-6 0Z" /><path d="M12 14v6M9 20h6" /></>,
  "alcohol-caffeine": <><path d="M5 9h11v5a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5Z" /><path d="M16 11h2a2 2 0 0 1 0 4h-2M9 4v2M12 4v2" /></>,
  "missed-dose": <><rect x="4" y="9" width="16" height="7" rx="3.5" /><path d="M12 9v7" /></>,
  "white-coat": <><path d="M6 4v5a4 4 0 0 0 8 0V4" /><path d="M10 13v3a4 4 0 0 0 8 0v-2" /><circle cx="18" cy="12" r="2" /></>,
  "stress-sleep": <path d="M16 4a7 7 0 1 0 4 12 6 6 0 1 1-4-12Z" />,
  bleeding: <path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11Z" />,
  exercise: <><circle cx="14" cy="5" r="2" /><path d="M10 21l2-6 3 2v4M7 12l3-3 4 1 3 3M12 15l-2-5" /></>,
  food: <><circle cx="12" cy="13" r="7" /><path d="M12 9v4l3 2" /></>,
  sex: <path d="M12 19s-7-4.3-7-9.2A3.8 3.8 0 0 1 12 7.6a3.8 3.8 0 0 1 7 2.2C19 14.7 12 19 12 19Z" />,
  smoking: <><rect x="3" y="12" width="14" height="4" rx="1" /><path d="M17 12v4M20 12v4M18 4c0 2 2 2 2 4" /></>,
  "smoking-vaping": <><rect x="3" y="12" width="14" height="4" rx="1" /><path d="M17 12v4M20 12v4M18 4c0 2 2 2 2 4" /></>,
  "food-smoking": <><circle cx="12" cy="13" r="7" /><path d="M8 13h8" /></>,
  "cold-meals": <path d="M12 3v18M4.5 7.5l15 9M19.5 7.5l-15 9M9 4.5l3 2 3-2M9 19.5l3-2 3 2" />,
  breathing: <path d="M3 9h11a3 3 0 1 0-3-3M3 15h15a3 3 0 1 1-3 3M3 12h8" />,
  vaccines: <><path d="M18 3l3 3M15 6l3 3M6 18l-3 3M8 10l6 6M16 8l-8 8-3-3 8-8Z" /></>,
  energy: <><rect x="3" y="8" width="16" height="9" rx="2" /><path d="M21 11v3M6 11v3M9 11v3" /></>,
  "hay-fever": <><circle cx="12" cy="10" r="2.5" /><path d="M12 4.5a3 3 0 0 1 0 3M12 12.5a3 3 0 0 1 0 3M6.5 10a3 3 0 0 1 3 0M14.5 10a3 3 0 0 1 3 0M12 15v6" /></>,
  travel: <path d="M3 13l18-6-4 12-4-5-4 3v-4Z" />,
  partner: <><circle cx="9" cy="8.5" r="2.8" /><circle cx="16" cy="8.5" r="2.8" /><path d="M3.5 19c.6-3.2 2.8-5 5.5-5s4.9 1.8 5.5 5M12 15c.9-.7 2.2-1 4-1 2.7 0 4.9 1.8 5.5 5" /></>,
};

type LiveWellLine = { line?: string; tag?: string; dark?: boolean };
const LW_LINES: Record<string, LiveWellLine> = {
  driving: { line: "DVLA, your doctor, and the form", tag: "Try this week" },
  prevention: { line: "the one most people save", tag: "Most saved" },
  work: { line: "phased returns and what to say" },
  mood: { line: "read by many carers too" },
  carers: { line: "share it with them", dark: true },
  "blood-pressure": { line: "why it matters most after a bleed" },
  "blood-thinners": { line: "a decision to make with your team" },
  // TIA's own lines, keyed by page where an id is shared.
  prevent: { line: "the tablets and the habits together" },
  "tia/driving": { line: "at least a month off, longer for lorries and buses" },
  worry: { line: "the risk goes down over time, and support is there" },
  fast: { line: "the four signs, and when to call 999", dark: true },
  // Stroke under 50's own lines.
  "under-50/work": { line: "a phased return, and your rights" },
  money: { line: "sick pay, ESA, PIP and the mortgage" },
  children: { line: "the truth, at their level" },
  relationships: { line: "talking, intimacy and the people around you", dark: true },
  // Dementia & memory's own lines.
  "telling-people": { line: "when you're ready, and how they can help" },
  planning: { line: "a lasting power of attorney, made early" },
  "alzheimers/driving": { line: "tell DVLA, then wait for the letter" },
  "vascular/driving": { line: "tell DVLA, then wait for the letter" },
  "good-days": { line: "still you: what helps in the early years" },
  home: { line: "lighting, floors, signs and clocks" },
  "lewy-body/home": { line: "glare, mirrors and patterns" },
  responding: { line: "reassure, don't argue" },
  "mild-cognitive-impairment/worry": { line: "relief, uncertainty, and support" },
  "mild-cognitive-impairment/telling-people": { line: "whether, and how, to tell people" },
  "mild-cognitive-impairment/sleep": { line: "seven to nine hours, and why it matters" },
  // Parkinson's & movement's own lines.
  freezing: { line: "stop, think, plan, do" },
  "parkinsons-disease/sleep": { line: "a regular wake-up time and short naps" },
  falls: { line: "clear the clutter, light the stairs" },
  "driving-work": { line: "DVLA, insurance and your rights at work" },
  "parkinsons-disease/carers": { line: "a carer's assessment, nurses and a helpline", dark: true },
  "out-and-about": { line: "eating out, signatures and alert cards" },
  alcohol: { line: "a short dip, then a rebound" },
  "essential-tremor/voice": { line: "injections and speech therapy" },
  "essential-tremor/telling-people": { line: "your choice, and when to tell DVLA", dark: true },
  pain: { line: "positioning, therapies and treatment" },
  "dystonia/work": { line: "adjustments, Access to Work and DVLA" },
  "dystonia/mood": { line: "stress, anxiety and support" },
  "dystonia/telling-people": { line: "a few clear words", dark: true },
  "alzheimers/carers": { line: "a carer's assessment, and helplines", dark: true },
  "vascular/carers": { line: "a carer's assessment, and helplines", dark: true },
  "lewy-body/carers": { line: "a carer's assessment, and helplines", dark: true },
  // Heart & lungs' own lines.
  "high-blood-pressure/alcohol-weight": { line: "14 units a week, and a little weight off" },
  "high-blood-pressure/missed-dose": { line: "never double up; check the leaflet", dark: true },
  "high-blood-pressure/white-coat": { line: "home and 24-hour readings" },
  "high-blood-pressure/stress-sleep": { line: "short rises, and the night-time dip" },
  "atrial-fibrillation/alcohol-caffeine": { line: "alcohol, caffeine and other triggers" },
  "atrial-fibrillation/bleeding": { line: "alert cards, dentists and bleeding checks", dark: true },
  "atrial-fibrillation/exercise": { line: "build it up gradually" },
  "atrial-fibrillation/worry": { line: "talking it through helps" },
  "heart-attack/driving-work": { line: "when to drive, work and fly again" },
  "heart-attack/food": { line: "Mediterranean, not a strict diet" },
  "heart-attack/sex": { line: "usually after about 4 weeks" },
  "heart-attack/mood": { line: "fear and low mood are common" },
  "heart-attack/smoking": { line: "free NHS support to stop", dark: true },
  "angina/cold-meals": { line: "cold, big meals and stress" },
  "angina/driving-work": { line: "car drivers needn't tell DVLA" },
  "angina/food-smoking": { line: "salt, alcohol and smoking" },
  "angina/worry": { line: "a warning, not a life sentence", dark: true },
  "copd/breathing": { line: "pursed lips, positions and a fan" },
  "copd/smoking": { line: "never too late, even now" },
  "copd/vaccines": { line: "flu before the end of October" },
  "copd/energy": { line: "rests between tasks" },
  "copd/mood": { line: "breathlessness, anxiety and support", dark: true },
  "asthma/exercise": { line: "breathing harder is normal" },
  "asthma/home": { line: "damp, dust mites and pets" },
  "asthma/smoking-vaping": { line: "smoke-free airways" },
  "asthma/hay-fever": { line: "start treatment early", dark: true },
  "sleep-apnoea/driving": { line: "when to tell DVLA" },
  "sleep-apnoea/travel": { line: "CPAP in your hand luggage" },
  "sleep-apnoea/partner": { line: "they may notice it first", dark: true },
  "sleep-apnoea/energy": { line: "feeling more refreshed" },
};
function LiveWell({ place, items }: { place: ConditionPlace; items: LibraryItem[] }) {
  return <ul className="lib-v2-lwell-list" role="list">
      {items.map((item, index) => {
        // A line keyed by the piece alone was written for these groups' pages; elsewhere only a page's own line shows.
        const shared = ["stroke", "dementia", "parkinsons"].includes(place.group.id);
        const lines = LW_LINES[`${place.condition.id}/${item.id}`] ?? (shared ? LW_LINES[item.id] : undefined) ?? {};
        const icon = LW_ICON[item.id];
        return <li key={item.id}>
          <Link href={itemHref({ ...place, item })} className={`lib-v2-lwell-row${lines.dark ? " is-dark" : ""}`}>
            <span className="lib-v2-lwell-ico" aria-hidden="true">
              {icon
                ? <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" focusable="false">{icon}</svg>
                : <SymbolArt name={lookFor(item, index, paletteFor(place)).sym} colour="currentColor" accent="currentColor" width={12} className="lib-v2-lwell-sym" />}
            </span>
            <span className="lib-v2-lwell-words">
              <b>{item.title}</b>
              <span>{[item.minutes ? `${item.minutes} min` : null, lines.line].filter(Boolean).join(" · ")}</span>
            </span>
            {lines.tag ? <span className="lib-v2-lwell-tag">{lines.tag}</span> : <span className="lib-v2-lwell-go" aria-hidden="true">→</span>}
          </Link>
        </li>;
      })}
  </ul>;
}

const WATCH_BG = ["#231C5C", "#2F2770", "#1F4A5C"];
function WatchArt({ item }: { item: LibraryItem }) {
  if (item.kind === "podcast") return <svg className="lib-v2-wl-art" aria-hidden="true" focusable="false" viewBox="0 0 120 60"><g fill="#F2B8A5">
    {[4, 24, 44, 64, 84].map((x, index) => <rect key={x} className="lib-v2-bar" x={x} y="10" width="10" height="50" rx="5" style={{ animationDelay: `${-index * 0.18}s` }} />)}
  </g></svg>;
  if (item.kind === "audio") return <svg className="lib-v2-wl-art" aria-hidden="true" focusable="false" viewBox="0 0 120 70">
    <circle cx="35" cy="35" r="32" fill="none" stroke="#9FD3DE" strokeOpacity=".35" strokeWidth="2" />
    <circle className="lib-v2-breath" cx="35" cy="35" r="30" fill="#9FD3DE" fillOpacity=".55" />
  </svg>;
  return <svg className="lib-v2-wl-art" aria-hidden="true" focusable="false" viewBox="0 0 200 120" fill="none" stroke="#F2B8A5" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10 10 H190 V110 H10 Z M10 30 H190 M10 90 H190 M40 10 V30 M80 10 V30 M120 10 V30 M160 10 V30 M40 90 V110 M80 90 V110 M120 90 V110 M160 90 V110" />
    <path className="lib-v2-playpulse" d="M88 44 L120 60 L88 76 Z" fill="#F2B8A5" />
  </svg>;
}

function WatchTiles({ place, items }: { place: ConditionPlace; items: LibraryItem[] }) {
  return <ul className="lib-v2-watch" role="list">
    {items.map((item, index) => {
      const kind = contentKind(item);
      const words = <>
        <WatchArt item={item} />
        <span className="lib-v2-wl-kind">{[kind, item.duration ?? (item.minutes ? `${item.minutes} min` : null)].filter(Boolean).join(" · ")}{item.url && <span aria-hidden="true"> ↗</span>}</span>
        <b>{item.title}</b>
        {item.extra && <span className="lib-v2-wl-extra">{item.extra.charAt(0).toUpperCase() + item.extra.slice(1)}</span>}
        {item.publisher && <span className="lib-v2-wl-by">{item.url ? "On YouTube · " : ""}{item.publisher}</span>}
      </>;
      const palette = paletteFor(place);
      const backgrounds = palette ? watchBackgrounds(palette) : WATCH_BG;
      const style = { background: backgrounds[index % backgrounds.length] };
      return <li key={item.id}>
        {item.url
          ? <a href={item.url} target="_blank" rel="noopener noreferrer" className="lib-v2-wl" style={style}>{words}<span className="lib-sr"> (opens YouTube in a new tab)</span></a>
          : <Link href={itemHref({ ...place, item })} className="lib-v2-wl" style={style}>{words}</Link>}
      </li>;
    })}
  </ul>;
}

// ---- The page ---------------------------------------------------------------------------------

/**
 * What the page fills in around the bento: `opening` is a story that opens the page (it sits above
 * Understand), `letter` a letter that closes it; `stories` is left out of the parts bar when empty.
 */
type Slots = {
  opening?: ReactNode; sources: ReactNode; stories: ReactNode; clinicians?: ReactNode; letter?: ReactNode; ask: ReactNode; related: ReactNode; footer: string;
  purpose: (part: "understand" | "recover" | "liveWell" | "watch") => string;
  /** Clinician contributions (AddToLibrary.tsx), shown at the end of the part they were added to; only parts that have some. */
  contributed?: Partial<Record<"understand" | "recover" | "liveWell" | "watch", ReactNode>>;
};

export function ConditionBento({ place, state, slots }: { place: ConditionPlace; state: LibraryState; slots: Slots }) {
  const { condition } = place;
  const content = condition.content!;
  const theme = themeOf(place.group.id);
  const palette = paletteFor(place);
  const ours = content.understand.filter(item => !item.url);
  const outside = content.understand.filter(item => item.url);
  const parts: Part[] = [
    ...(slots.opening ? [{ id: "story", label: "Story", story: true }] : []),
    { id: "understand", label: "Understand" },
    { id: "recover", label: contentTitle("recover", condition) },
    { id: "livewell", label: "Live well" },
    { id: "watch", label: "Watch & listen" },
    { id: "sources", label: "Trusted sources" },
    ...(slots.stories ? [{ id: "stories", label: "Stories", story: true }] : []),
  ].filter(part => part.id !== "watch" || content.watch.length > 0 || Boolean(slots.contributed?.watch));
  const head = (id: string, title: string, note?: string) => <div className="lib-v2-head">
    <h2 id={`h-${id}`}>{title}</h2>
    {note && <span>{note}</span>}
  </div>;

  return <div className={`lib-page lib-condition lib-v2${palette ? " is-light" : ""}${theme ? ` is-${theme}` : ""}`} style={palette ? themeVars(palette) : undefined}>
    <Hero place={place} state={state} />
    <PartsBar parts={parts} />
    <div className="lib-v2-layout">
      <main className="lib-v2-main">
        {slots.opening}
        <section id="understand" aria-labelledby="h-understand" className="lib-v2-part">
          {head("understand", "Understand", slots.purpose("understand"))}
          <Understand place={place} items={ours} outside={outside} />
          {slots.contributed?.understand}
        </section>
        <section id="recover" aria-labelledby="h-recover" className="lib-v2-part">
          {head("recover", contentTitle("recover", condition), slots.purpose("recover"))}
          <GoalCards place={place} items={content.recover} />
          {slots.contributed?.recover}
        </section>
        <section id="livewell" aria-labelledby="h-livewell" className="lib-v2-part">
          {head("livewell", "Live well", slots.purpose("liveWell"))}
          <LiveWell place={place} items={content.liveWell} />
          {slots.contributed?.liveWell}
        </section>
        {(content.watch.length > 0 || slots.contributed?.watch) && <section id="watch" aria-labelledby="h-watch" className="lib-v2-part">
          {head("watch", "Watch & listen", slots.purpose("watch"))}
          {content.watch.length > 0 && <WatchTiles place={place} items={content.watch} />}
          {slots.contributed?.watch}
        </section>}
        {slots.sources}
        {slots.stories}
        {slots.clinicians}
        {slots.letter}
      </main>
      <aside className="lib-v2-aside" aria-label="Alongside this page">
        {slots.ask}
        {slots.related}
      </aside>
    </div>
    <footer className="lib-wrap lib-foot"><span>{slots.footer}</span></footer>
    <FeedbackButton />
  </div>;
}
