import { useEffect, useState, type ReactNode } from "react";
import { Link } from "wouter";
import { DEFAULT_SOURCES, LIBRARY_NOTE, STORIES_NOTE, type ConditionContent, type LibraryItem, type LibraryStory, type StoryLink, type VideoStory } from "@/content/library";
import { useReadAloud } from "@/lib/alira-read-aloud";
import {
  conditionHref,
  conditionKey,
  findCondition,
  findLetter,
  findStory,
  isReadable,
  itemHref,
  itemKey,
  numberWord,
  sectionHref,
  storiesFor,
  storyHref,
  STORIES_HREF,
  type ConditionPlace,
} from "@/lib/library";
import { useContributions } from "@/lib/library-contributions";
import { libraryStore, useLibraryState, type LibraryState } from "@/lib/library-store";
import {
  ArrowIcon,
  BackIcon,
  BookmarkIcon,
  ChevronIcon,
  Crumbs,
  Envelope,
  Faces,
  HeadphonesIcon,
  Initial,
  jumpTo,
  MetaLine,
  PauseIcon,
  PlayIcon,
  SourceCard,
  SourceRow,
  useLines,
} from "./parts";
import { contributedParts, ContributionsByCategory } from "./AddToLibrary";
import AskClinicians from "./AskClinicians";
import { ConditionBento } from "./ConditionBento";
import "@/pages/library-condition-v2.css";

// One condition's page, built from its data. Every condition with content uses the same layout
// (ConditionBento.tsx): Understand as a bento, Explore (or Treat & manage), Live well, Watch & listen,
// Trusted sources, Stories and Ask your doctor. A story-led page (`storyLayout: "opening"`) opens with
// its story (placement A) and closes with a letter (E). A condition without content yet says so plainly
// and points to trusted sources.

// ------------------------------------------------------------------------------------------------
// The pieces.

type CardProps = { place: ConditionPlace; item: LibraryItem; state: LibraryState };
const isRead = (state: LibraryState, place: ConditionPlace, item: LibraryItem) => state.read.includes(itemKey({ ...place, item }));

/** Under a piece: its type (and, on Watch & listen, its length). No "Coming soon" tags on this page (review). */
function Meta({ place, item, state, minutes = false }: CardProps & { minutes?: boolean }) {
  return <span className="lib-meta-row">
    <MetaLine item={item} read={isRead(state, place, item)} readable={isReadable(item)} minutes={minutes} />
  </span>;
}

/** The link on a card: a genuine resource elsewhere opens in a new tab; a piece of ours opens its page. */
function PieceLink({ place, item, className, children }: { place: ConditionPlace; item: LibraryItem; className: string; children: ReactNode }) {
  if (item.url) return <a href={item.url} target="_blank" rel="noopener noreferrer" className={className}>{children}</a>;
  return <Link href={itemHref({ ...place, item })} className={className}>{children}</Link>;
}

/** Understand: a text card. A "they felt this too" prompt (placement D) can sit on it. */
function TextCard({ place, item, state }: CardProps) {
  const felt = item.feltToo;
  const stories = felt ? felt.storyIds.map(id => findStory(id)).filter((story): story is LibraryStory => Boolean(story)) : [];
  return <li className={`lib-card lib-text-card${item.url ? " is-external" : ""}`}>
    <PieceLink place={place} item={item} className="lib-stretch"><strong>{item.title}</strong></PieceLink>
    {item.blurb && <span className="lib-card-text">{item.blurb}</span>}
    {felt && stories.length > 0 && <Link href={storyHref(felt.storyIds[0], felt.chapter)} className="lib-felt">
      <Faces stories={stories} size={22} /><span className="lib-felt-long">{felt.label} →</span><span className="lib-felt-short">{felt.shortLabel}</span>
    </Link>}
    <Meta place={place} item={item} state={state} />
    <ChevronIcon />
  </li>;
}

function SectionHead({ id, title, note, story, action }: { id: string; title: string; note?: string; story?: StoryLink; action?: ReactNode }) {
  const person = story && findStory(story.storyId);
  return <div className="lib-part-head">
    <h2 id={`h-${id}`} className="lib-h2">{title}</h2>
    {note && <span className="lib-sub">{note}</span>}
    {story && person && <Link href={storyHref(story.storyId, story.chapter)} className="lib-story-pill"><Initial story={person} size={26} />{story.label} →</Link>}
    {action}
  </div>;
}

// ------------------------------------------------------------------------------------------------
// The story placements.

/** A: the story opens the page; the facts follow, with a way straight to them. */
function OpeningStory({ storyId, quote }: { storyId: string; quote: string }) {
  const story = findStory(storyId);
  const lines = useLines(story ? [quote, ...story.chapters.flatMap(chapter => [`${chapter.label}. ${chapter.title}.`, ...chapter.paragraphs])] : []);
  const reading = useReadAloud(lines, true);
  if (!story) return null;
  const first = story.chapters[0];
  return <section id="story" className="lib-opening" aria-label={`${story.name}'s story opens this page`}>
    <div className="lib-opening-art" aria-hidden="true">
      <span className="lib-opening-letter">{story.name.slice(0, 1)}</span>
      <span className="lib-opening-sun" /><span className="lib-opening-moon" />
      <span className="lib-opening-chapter">{first.label} of {story.chapters.length}</span>
    </div>
    <div className="lib-opening-words">
      <span className="lib-opening-kicker">Before the facts, a person</span>
      <p className="lib-opening-quote">“{quote}”</p>
      <span className="lib-opening-who"><Initial story={{ name: story.name, tint: { tint: "#FFFEFA", ink: story.tint.ink } }} size={40} /><span><b>{story.name}, {story.age}</b> · {story.detail.toLowerCase()} · {story.pronoun} story, in {numberWord(story.chapters.length).toLowerCase()} short chapters</span></span>
      <div className="lib-opening-actions">
        <Link href={storyHref(story.id, first.id)} className="lib-opening-go">Start {first.label.toLowerCase()} · {first.minutes} min<ArrowIcon /></Link>
        <button type="button" className="lib-opening-listen" onClick={reading.toggle} aria-pressed={reading.playing}>{reading.playing ? <PauseIcon size={16} /> : <HeadphonesIcon />}{reading.playing ? "Pause" : reading.index > 0 ? "Carry on listening" : "Listen instead"}</button>
        <a href="#facts" onClick={jumpTo("facts")} className="lib-opening-skip">Skip to the facts ↓</a>
      </div>
      <p className="lib-sr" role="status">{reading.note}</p>
      <ol aria-label="Chapters" className="lib-opening-chapters">
        {story.chapters.map((chapter, index) => <li key={chapter.id}><Link href={storyHref(story.id, chapter.id)} className={index === 0 ? "is-first" : undefined}>{index + 1} · {chapter.title}</Link></li>)}
      </ol>
    </div>
  </section>;
}

/** E: a letter at the foot of the page. It waits in "For you" on the front page until it is opened. */
function LetterBand({ letterId, state }: { letterId: string; state: LibraryState }) {
  const letter = findLetter(letterId);
  if (!letter) return null;
  const opened = state.letters.includes(letter.id);
  return <section className="lib-letter-band" aria-labelledby="lib-letter">
    <div className="lib-letter-art"><Envelope opened={opened} /></div>
    <div className="lib-letter-words">
      <span className="lib-kicker is-coral">Before you go · a letter</span>
      <h2 id="lib-letter" className="lib-h2">{letter.title}</h2>
      <p className="lib-letter-opening">“{letter.opening}”</p>
      <div className="lib-letter-actions">
        <Link href={`/letters/${letter.id}`} className="lib-button is-coral">{opened ? "Read the letter again" : "Open the letter"} · {letter.minutes} min</Link>
        <span>{opened ? "You've opened this letter. It stays here whenever you want it." : letter.teaser}</span>
      </div>
    </div>
  </section>;
}

// ------------------------------------------------------------------------------------------------
// The side rail and the shared closing parts.

/** A side-rail heading that is a button: the panel's body shows only once it is opened. */
function RailToggle({ id, title, note, open, onToggle }: { id: string; title: string; note: string; open: boolean; onToggle: () => void }) {
  return <h2 id={`${id}-title`}>
    <button type="button" className="lib-rail-toggle" aria-expanded={open} aria-controls={`${id}-body`} onClick={onToggle}>
      <span className="lib-rail-toggle-words">{title}<small>{note}</small></span>
      <svg className="lib-rail-chevron" aria-hidden="true" focusable="false" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 8l5 5 5-5" /></svg>
    </button>
  </h2>;
}

function AskDoctor({ place, questions, state }: { place: ConditionPlace; questions: string[]; state: LibraryState }) {
  const [open, setOpen] = useState(false);
  const key = conditionKey(place);
  const ticked = state.asks[key] ?? [];
  const note = `${questions.length} question${questions.length === 1 ? "" : "s"} to ask${ticked.length ? ` · ${ticked.length} ticked` : ""}`;
  return <section id="ask" className={`lib-ask-doctor${open ? " is-open" : ""}`} aria-labelledby="lib-ask-title">
    <RailToggle id="lib-ask" title="Tips" note={note} open={open} onToggle={() => setOpen(was => !was)} />
    <div id="lib-ask-body" className="lib-rail-body" hidden={!open}>
      <p>Questions some people find it useful to ask their care team. Tick any you'd like to keep; they're saved on this device{ticked.length ? ` (${ticked.length} ticked)` : ""}.</p>
      <div className="lib-ask-list">
        {questions.map((question, index) => <label key={question}>
          <input type="checkbox" checked={ticked.includes(index)} onChange={() => libraryStore.toggleAsk(key, index)} />
          <span>{question}</span>
        </label>)}
      </div>
    </div>
  </section>;
}

function Related({ content }: { content: ConditionContent }) {
  const [open, setOpen] = useState(false);
  const related = content.related.map(link => ({ link, place: findCondition(link.groupId, link.conditionId) })).filter(entry => entry.place);
  if (!related.length) return null;
  return <section className={`lib-related${open ? " is-open" : ""}`} aria-labelledby="lib-related-title">
    <RailToggle id="lib-related" title="Often read alongside" note={`${related.length} related page${related.length === 1 ? "" : "s"}`} open={open} onToggle={() => setOpen(was => !was)} />
    <div id="lib-related-body" className="lib-rail-body" hidden={!open}>
      {related.map(({ link, place }) => <Link key={conditionKey(place!)} href={conditionHref(place!.group.id, place!.condition.id)}>
        {link.label ?? place!.condition.title}<span style={{ color: place!.section.hue.ink }}>{place!.section.short}</span>
      </Link>)}
    </div>
  </section>;
}

function StoriesPanel({ place }: { place: ConditionPlace }) {
  const videos = place.condition.content?.videoStories;
  if (videos?.length) return <VideoStoriesPanel place={place} videos={videos} />;
  const stories = storiesFor(place.condition);
  if (!stories.length) return null;
  return <section id="stories" className="lib-stories-panel" aria-labelledby="h-stories">
    <div className="lib-row-head">
      <div>
        <span className="lib-kicker is-coral">Stories · {lowerTitle(place.condition.title)}</span>
        <h2 id="h-stories" className="lib-h2">{numberWord(stories.length)} {stories.length === 1 ? "person" : "people"}, told in their own words</h2>
      </div>
      <span className="lib-film-note">{STORIES_NOTE}</span>
    </div>
    <ul role="list">
      {stories.map(story => <li key={story.id}>
        <Link href={storyHref(story.id)} className="lib-story-row">
          <Initial story={story} size={40} />
          <span className="lib-story-row-words"><strong>{story.name}, {story.age} · “{story.title}”</strong><span>{story.detail} · {story.when}</span></span>
          <span className="lib-list-time">{story.minutes} min</span>
        </Link>
      </li>)}
    </ul>
    <Link href={STORIES_HREF} className="lib-pill-link is-coral">More stories<ArrowIcon /></Link>
  </section>;
}

/** Real people's stories on YouTube, credited to the channel that published each one. */
function VideoStoriesPanel({ place, videos }: { place: ConditionPlace; videos: VideoStory[] }) {
  return <section id="stories" className="lib-stories-panel" aria-labelledby="h-stories">
    <div className="lib-row-head">
      <div>
        <span className="lib-kicker is-coral">Stories · {lowerTitle(place.condition.title)}</span>
        <h2 id="h-stories" className="lib-h2">{numberWord(videos.length)} {videos.length === 1 ? "person" : "people"}, in their own words</h2>
      </div>
      <span className="lib-film-note">Personal experiences shared on YouTube by the channels named. {place.group.id === "stroke" ? "Everyone's stroke and recovery is different." : "Everyone's experience is different."}</span>
    </div>
    <ul role="list">
      {videos.map(video => <li key={video.id}>
        <a href={video.url} target="_blank" rel="noopener noreferrer" className="lib-story-row">
          <span className="lib-initial lib-video-initial" aria-hidden="true"><PlayIcon size={16} /></span>
          <span className="lib-story-row-words"><strong>{video.person} · “{video.title}”</strong><span>{video.about} On YouTube · {video.channel}</span></span>
          <span className="lib-list-time">{video.duration}</span>
          <span className="lib-sr"> (opens YouTube in a new tab)</span>
        </a>
      </li>)}
    </ul>
  </section>;
}

// ------------------------------------------------------------------------------------------------

/** The title, its line and the facts; the only action is Save (the read-aloud button was removed in review). */
function ConditionHeader({ place, full, state, switcher }: { place: ConditionPlace; full: boolean; state: LibraryState; switcher?: ReactNode }) {
  const { condition, group } = place;
  const saved = state.saved.includes(conditionKey(place));
  const save = () => libraryStore.toggleSaved(conditionKey(place));
  return <div id="facts" className="lib-condition-head">
    <div className="lib-condition-words">
      <h1>{condition.title}</h1>
      <p>{condition.summary ?? group.blurb}</p>
      {full && condition.facts && <ul className="lib-facts" role="list">{condition.facts.map(fact => <li key={fact}>{fact}</li>)}</ul>}
    </div>
    <div className="lib-condition-actions">
      {switcher}
      <button type="button" className="lib-save lib-wide-only" aria-pressed={saved} onClick={save}><BookmarkIcon filled={saved} />{saved ? "Saved to my pages" : "Save to my pages"}</button>
    </div>
  </div>;
}

/** A title in running text: lower case, except an abbreviation such as COPD. */
const lowerTitle = (title: string) => /^[A-Z]{2,}\b/.test(title) ? title : title.toLowerCase();

/** The line under each part's heading: the page's own, or a plain default. */
const PURPOSE = {
  understand: (title: string) => `Understand ${lowerTitle(title)}, its causes and the tests used to diagnose it.`,
  recover: () => "General information about recovery and everyday activities, to read alongside your care team's advice.",
  liveWell: () => "Find practical support for everyday life.",
  watch: () => "Short films, talks and audio to watch or listen to at your own pace.",
  sources: () => "Find reliable information and guidance from trusted health organisations.",
};

export default function ConditionPage({ place }: { place: ConditionPlace }) {
  const { section, group, condition } = place;
  const content = condition.content;
  const full = Boolean(content && condition.summary);
  const key = conditionKey(place);
  const state = useLibraryState();
  const contributions = useContributions();
  useEffect(() => { libraryStore.visit(key); }, [key]);
  const purpose = (part: keyof typeof PURPOSE) => content?.purpose?.[part] ?? PURPOSE[part](condition.title);
  const footer = content?.footer ?? LIBRARY_NOTE;

  const saved = state.saved.includes(key);
  const mobileBar = <div className="lib-mobilebar">
    <Link href={sectionHref(section)} className="lib-round" aria-label={`Back to ${section.title}`}><BackIcon /></Link>
    <span>Library · {group.title}</span>
    <button type="button" className="lib-round" aria-pressed={saved} aria-label={saved ? "Saved to my pages" : "Save this page"} onClick={() => libraryStore.toggleSaved(key)}><BookmarkIcon size={18} filled={saved} /></button>
  </div>;
  const crumbs = <Crumbs className="lib-wide-flex" trail={[{ label: "Library", href: "/" }, { label: section.title, href: sectionHref(section) }, { label: group.title, href: `${sectionHref(section)}#group-${group.id}` }, { label: condition.title }]} />;

  if (!full || !content) return <PlaceholderCondition place={place} mobileBar={mobileBar} crumbs={crumbs} state={state} />;

  // Every written condition uses the bento layout. A story-led page opens with its story and closes
  // with its letter.
  const storyLed = condition.storyLayout === "opening";
  const hasStories = Boolean(content.videoStories?.length) || storiesFor(condition).length > 0;
  const sourcesPart = <section id="sources" aria-labelledby="h-sources" className="lib-part">
    <div className="lib-part-head is-stacked">
      <h2 id="h-sources" className="lib-h2">Trusted sources</h2>
      <span className="lib-sub">{purpose("sources")}</span>
    </div>
    <ul className="lib-refs" role="list">{content.sources.map(source => <SourceRow key={source.name} source={source} />)}</ul>
  </section>;

  return <ConditionBento place={place} state={state} slots={{
    opening: storyLed && content.opening ? <OpeningStory storyId={content.opening.storyId} quote={content.opening.quote} /> : undefined,
    sources: sourcesPart,
    stories: hasStories ? <StoriesPanel place={place} /> : null,
    clinicians: <AskClinicians topic={{ sectionId: section.id, groupId: group.id, conditionId: condition.id, title: condition.title }} />,
    letter: content.letterId ? <LetterBand letterId={content.letterId} state={state} /> : undefined,
    ask: <AskDoctor place={place} questions={content.askDoctor} state={state} />,
    related: <Related content={content} />,
    footer,
    purpose,
    contributed: contributedParts(place, contributions),
  }} />;
}

/** A condition whose page is still being written: what there is, said plainly. */
function PlaceholderCondition({ place, mobileBar, crumbs, state }: { place: ConditionPlace; mobileBar: ReactNode; crumbs: ReactNode; state: LibraryState }) {
  const { group, condition } = place;
  const items = condition.content?.understand ?? [];
  const sources = condition.content?.sources ?? DEFAULT_SOURCES;
  const siblings = group.conditions.filter(candidate => candidate.id !== condition.id);
  const ready = siblings.filter(candidate => candidate.content?.understand.length && candidate.summary);
  return <div className="lib-page lib-condition is-soon">
    <div className="lib-wrap">
      {mobileBar}
      {crumbs}
      <ConditionHeader place={place} full={false} state={state} />
    </div>
    <div className="lib-wrap lib-condition-body is-single">
      <section className="lib-soon-panel" aria-labelledby="lib-soon-title">
        <h2 id="lib-soon-title" className="lib-h2">We're still writing this page</h2>
        <p>The {condition.title} page will have plain-words guides, short videos and stories, checked before they go up. Until then, these trusted sources are a good place to start.</p>
        <div className="lib-grid lib-sources is-three">{sources.map(source => <SourceCard key={source.name} source={source} />)}</div>
      </section>
      {items.length > 0 && <section className="lib-part" aria-labelledby="h-understand">
        <SectionHead id="understand" title="Understand" />
        <ul className="lib-grid lib-grid-cards is-two" role="list">{items.map(item => <TextCard key={item.id} place={place} item={item} state={state} />)}</ul>
      </section>}
      <ContributionsByCategory place={place} />
      {siblings.length > 0 && <section className="lib-part" aria-labelledby="lib-siblings">
        <h2 id="lib-siblings" className="lib-h2">Also in {group.title}</h2>
        <ul className="lib-condition-pills" role="list">
          {siblings.map(candidate => <li key={candidate.id}><Link href={conditionHref(group.id, candidate.id)} className="lib-condition-pill">{candidate.title}{ready.includes(candidate) ? null : <span className="lib-pill-count">soon</span>}</Link></li>)}
        </ul>
      </section>}
      <AskClinicians topic={{ sectionId: place.section.id, groupId: group.id, conditionId: condition.id, title: condition.title }} />
    </div>
    <footer className="lib-wrap lib-foot"><span>{LIBRARY_NOTE}</span></footer>
  </div>;
}
