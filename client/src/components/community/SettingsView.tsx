import { Fragment, useEffect, useId, useLayoutEffect, useRef, useState, type FormEvent, type KeyboardEvent, type ReactNode } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { pictureWords } from "@/content/community-pictures";
import { members, people, settingsChoices, type MemberId } from "@/content/community-samples";
import { communityHref, communityStore, communityViewFromQuery, daysAgoLabel, friendList, friendsHref, hourLabel, LIMITS, useCommunity, viewHref, type CommunityMemory, type CommunitySettings } from "@/lib/community-store";
import { profileInitial, useProfile } from "@/lib/profile";
import { blockedRows, friendsVisit, useFriendsVisit, type BlockedRow } from "./friends-visit";
import { myGroups } from "./group-model";
import { useLater } from "./hooks";
import { CheckIcon, ChevronDownIcon, CloseIcon, EyeIcon, LockIcon, MinusIcon, MoonIcon, NextIcon, PlusIcon, ShieldIcon, SpeakerIcon } from "./icons";
import { Face, MemberFace, MyFace } from "./parts";
import ProfileCard from "./ProfileCard";
import { unblockQuestion } from "./safety-model";
import {
  breakHint,
  breakNow,
  cardLine,
  cardNote,
  hiddenWordProblem,
  nextSuggestedWord,
  privacyMeaning,
  quietEdges,
  quietHint,
  sampleLine,
  settingsSummaries,
  settingsTarget,
  stepQuietFrom,
  townHint,
  typedWord,
  type SettingsPanel,
  type SettingsSection,
} from "./settings-model";

// F5: Community settings, with a live preview of the person's card. "Your profile" comes first and
// is the one place the person's profile is edited: the picture (Change picture opens "Choose your
// picture") and the name, town and words on the card, kept with Save changes; under it, Your
// privacy (who sees their posts, who can message them, who can ask to be friends, the town and
// the online dot) and Blocked (with a way to unblock). The other settings sit in three sections
// that open one at a time. Each change is kept on this device as it is made, takes effect across
// My community straight away (the feed, the chats and the toolbar read the same settings) and
// shows "Saved" for a moment.

export type SettingsViewProps = {
  /** The person's first name. */
  name: string;
  /**
   * The section the address names, when a link is about one setting ("Quiet time: Change" in
   * Alerts, "View your profile" in the account menu): it opens, comes into view and takes the
   * focus.
   */
  section?: SettingsSection | null;
  /** Opens "Choose your picture" (outside the page, over everything), from the Change picture button. */
  onChangePicture?: (opener: HTMLElement) => void;
  /** Inside Settings → Your profile: the window names the page, so the page's own title is left out. */
  embedded?: boolean;
};

/** Runs a change through the store. True when something changed, and so was saved. */
type Save = (change: () => unknown) => boolean;
type Flag = "showTown" | "showOnline" | "gentleMode" | "showHeartCounts" | "readAloud" | "writeOutVoiceNotes";
/** The cards a link can name: the panels, and Your profile. */
type Target = SettingsPanel | "profile";

/**
 * Scrolls just enough to show a section that has opened: its heading always, then as much of what
 * is inside as fits. Its scroll margins (in the CSS) keep it clear of a phone's top and bottom bars.
 */
function bringIntoView(card: HTMLElement) {
  if (typeof window === "undefined") return;
  const box = card.getBoundingClientRect();
  const style = window.getComputedStyle(card);
  const top = parseFloat(style.scrollMarginTop) || 0;
  const bottom = window.innerHeight - (parseFloat(style.scrollMarginBottom) || 0);
  const by = box.top < top ? box.top - top : box.bottom > bottom ? Math.min(box.bottom - bottom, box.top - top) : 0;
  if (Math.abs(by) >= 1) window.scrollBy({ top: by });
}

/* --------------------------------------------------------------- pieces */

/** The line under a section's name. The dots are for the eye; a screen reader hears commas. */
function Summary({ parts }: { parts: string[] }) {
  return (
    <span className="cm-set-summary">
      {parts.map((part, index) => (
        <Fragment key={index}>
          {index > 0 && <><span aria-hidden="true"> · </span><span className="cm-sr">, </span></>}
          {part}
        </Fragment>
      ))}
    </span>
  );
}

/** One of the three sections: a heading that opens and closes it, and what is inside. */
function Section({ id, title, tone, icon, summary, open, onToggle, cardRef, children }: {
  id: SettingsPanel;
  title: string;
  tone: "mint" | "lilac" | "amber";
  icon: ReactNode;
  summary: string[];
  open: boolean;
  onToggle: (id: SettingsPanel) => void;
  cardRef: (card: HTMLDivElement | null) => void;
  children: ReactNode;
}) {
  const titleId = useId();
  const panelId = useId();
  return (
    <div ref={cardRef} className="cm-card cm-set-section">
      <h3 className="cm-set-section-head">
        <button type="button" className="cm-set-toggle" aria-expanded={open} aria-controls={panelId} onClick={() => onToggle(id)}>
          <span className={`cm-set-icon cm-set-icon-${tone}`} aria-hidden="true">{icon}</span>
          <span className="cm-set-toggle-text">
            <span className="cm-set-toggle-title" id={titleId}>{title}</span>
            <Summary parts={summary} />
          </span>
          <span className="cm-set-chev" aria-hidden="true"><ChevronDownIcon size={22} /></span>
        </button>
      </h3>
      <div className="cm-set-panel" id={panelId} role="region" aria-labelledby={titleId} hidden={!open}>
        {children}
      </div>
    </div>
  );
}

/** A setting that is on or off. `extra` sits under the hint (an action, never part of the description). */
function SwitchRow({ label, hint, on, onFlip, extra }: { label: string; hint: string; on: boolean; onFlip: () => void; extra?: ReactNode }) {
  const labelId = useId();
  const hintId = useId();
  return (
    <div className="cm-set-row">
      <span className="cm-set-label">
        <span className="cm-set-name" id={labelId}>{label}</span>
        <span className="cm-set-hint" id={hintId}>{hint}</span>
        {extra}
      </span>
      <button type="button" role="switch" className="cm-switch" aria-checked={on} aria-labelledby={labelId} aria-describedby={hintId} onClick={onFlip}><span /></button>
    </div>
  );
}

/** A choice of two or three, side by side. The one chosen is pressed. */
function Choice<T extends string>({ label, options, value, onPick, hint, note, spaced = false }: {
  label: string;
  options: { id: T; label: string }[];
  value: T;
  onPick: (id: T) => void;
  /** Said between the name and the choices. */
  hint?: string;
  /** Said under the choices, about the one chosen, with an optional action. */
  note?: { text: string; action?: ReactNode } | null;
  spaced?: boolean;
}) {
  const labelId = useId();
  const hintId = useId();
  const noteId = useId();
  const described = [hint ? hintId : "", note ? noteId : ""].filter(Boolean).join(" ") || undefined;
  return (
    <div className={`cm-set-choice${spaced ? " is-spaced" : ""}`}>
      <span className="cm-set-name" id={labelId}>{label}</span>
      {hint && <span className="cm-set-hint" id={hintId}>{hint}</span>}
      <div className="cm-segments" role="group" aria-labelledby={labelId} aria-describedby={described}>
        {options.map(option => (
          <button key={option.id} type="button" className="cm-segment" aria-pressed={value === option.id} onClick={() => onPick(option.id)}>{option.label}</button>
        ))}
      </div>
      {note && <div className="cm-set-note"><span className="cm-set-hint" id={noteId}>{note.text}</span>{note.action}</div>}
    </div>
  );
}

/** "Quiet at night": the hour quiet time starts, an hour earlier or later at a time. It ends at 8 am. */
function QuietTime({ settings, now, onStep }: { settings: CommunitySettings; now: number; onStep: (by: -1 | 1) => void }) {
  const labelId = useId();
  const hintId = useId();
  const { earliest, latest } = quietEdges(settings.quietFrom);
  return (
    <div className="cm-set-quiet">
      <span className="cm-set-label">
        <span className="cm-set-name" id={labelId}>Quiet at night</span>
        <span className="cm-set-hint" id={hintId}>{quietHint(settings, new Date(now))}</span>
      </span>
      {/* aria-disabled rather than disabled, so the focus stays on a button that has reached its end. */}
      <div className="cm-set-stepper" role="group" aria-labelledby={labelId} aria-describedby={hintId}>
        <button type="button" className="cm-set-stepper-button" aria-label="Earlier start" aria-disabled={earliest} onClick={() => { if (!earliest) onStep(-1); }}><MinusIcon size={20} /></button>
        <output className="cm-set-hour" aria-live="polite">{hourLabel(settings.quietFrom)}</output>
        <button type="button" className="cm-set-stepper-button" aria-label="Later start" aria-disabled={latest} onClick={() => { if (!latest) onStep(1); }}><PlusIcon size={20} /></button>
        <span className="cm-set-to">to</span>
        <span className="cm-set-hour cm-set-hour-end">{hourLabel(settings.quietUntil)}</span>
      </div>
    </div>
  );
}

/** Where the focus goes once the words have changed: a chip, or one of the add buttons. */
type FocusAfter = { word: string } | { to: "suggest" | "own" | "last" };

/**
 * "Hide posts that mention": a chip for each word (pressing it stops hiding the word), one tap to
 * add a suggested word, and a box for the person's own. Posts with these words wait behind a note
 * in the feed.
 */
function HiddenWords({ words, save }: { words: string[]; save: Save }) {
  const labelId = useId();
  const formId = useId();
  const fieldId = useId();
  const problemId = useId();
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");
  const [problem, setProblem] = useState("");
  const chips = useRef(new Map<string, HTMLButtonElement>());
  const suggestButton = useRef<HTMLButtonElement>(null);
  const ownButton = useRef<HTMLButtonElement>(null);
  const field = useRef<HTMLInputElement>(null);
  const focusAfter = useRef<FocusAfter | null>(null);
  const suggestion = nextSuggestedWord(words);
  const full = words.length >= LIMITS.hiddenWords;

  // A chip or button that was pressed can go with the change. The focus moves on to the next chip,
  // or an add button, instead of being lost.
  useLayoutEffect(() => {
    const want = focusAfter.current;
    if (!want) return;
    focusAfter.current = null;
    const last = chips.current.get(words[words.length - 1]);
    const target = "word" in want ? chips.current.get(want.word)
      : want.to === "suggest" ? suggestButton.current ?? ownButton.current
      : want.to === "own" ? ownButton.current
      : last;
    (target ?? ownButton.current ?? last)?.focus();
  }, [words]);

  useEffect(() => { if (adding) field.current?.focus(); }, [adding]);

  const remove = (word: string) => {
    const at = words.indexOf(word);
    const next = words[at + 1] ?? words[at - 1];
    focusAfter.current = next !== undefined ? { word: next } : { to: "suggest" };
    if (!save(() => communityStore.removeHiddenWord(word))) focusAfter.current = null;
  };
  const addSuggested = () => {
    if (!suggestion) return;
    const after = [...words, suggestion];
    focusAfter.current = after.length >= LIMITS.hiddenWords ? { to: "last" } : nextSuggestedWord(after) ? null : { to: "own" };
    if (!save(() => communityStore.addHiddenWord(suggestion))) focusAfter.current = null;
  };
  const closeForm = () => {
    setAdding(false);
    setDraft("");
    setProblem("");
    ownButton.current?.focus();
  };
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const why = hiddenWordProblem(draft, words);
    if (why) { setProblem(why); field.current?.focus(); return; }
    focusAfter.current = words.length + 1 >= LIMITS.hiddenWords ? { to: "last" } : { to: "own" };
    if (!save(() => communityStore.addHiddenWord(typedWord(draft)))) {
      focusAfter.current = null;
      setProblem("That word couldn't be added. Try another one.");
      field.current?.focus();
      return;
    }
    setAdding(false);
    setDraft("");
    setProblem("");
  };
  const onFieldKey = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Escape") return;
    event.preventDefault();
    closeForm();
  };

  return (
    <div className="cm-set-choice">
      <span className="cm-set-name" id={labelId}>Hide posts that mention</span>
      <div className="cm-set-words" role="group" aria-labelledby={labelId}>
        {words.map(word => (
          <button key={word} ref={button => { if (button) chips.current.set(word, button); else chips.current.delete(word); }} type="button" className="cm-set-word cm-pop" aria-label={`Stop hiding ${word}`} onClick={() => remove(word)}>
            <span>{word}</span><CloseIcon size={16} strokeWidth={2.2} />
          </button>
        ))}
        {!full && suggestion && (
          <button ref={suggestButton} type="button" className="cm-set-add" onClick={addSuggested}><PlusIcon size={16} /><span>{`Add “${suggestion}”`}</span></button>
        )}
        {(!full || adding) && (
          <button ref={ownButton} type="button" className="cm-set-add" aria-expanded={adding} aria-controls={adding ? formId : undefined} onClick={() => (adding ? closeForm() : setAdding(true))}>
            <PlusIcon size={16} /><span>Add a word</span>
          </button>
        )}
      </div>
      {full && <p className="cm-set-hint">{`You're hiding ${LIMITS.hiddenWords} words, the most you can. Remove one to add another.`}</p>}
      {adding && (
        <form className="cm-set-word-form" id={formId} onSubmit={submit} noValidate>
          <label className="cm-set-name" htmlFor={fieldId}>A word or short phrase to hide</label>
          <div className="cm-set-word-row">
            <input
              ref={field}
              id={fieldId}
              type="text"
              value={draft}
              maxLength={LIMITS.hiddenWord}
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              enterKeyHint="done"
              aria-invalid={problem ? true : undefined}
              aria-describedby={problem ? problemId : undefined}
              onChange={event => { setDraft(event.target.value); setProblem(""); }}
              onKeyDown={onFieldKey}
            />
            <button type="submit" className="cm-btn cm-btn-green cm-btn-small">Add</button>
            <button type="button" className="cm-text-button" onClick={closeForm}>Cancel</button>
          </div>
          {problem && <p className="cm-problem" id={problemId} role="alert">{problem}</p>}
        </form>
      )}
    </div>
  );
}

/* ---------------------------------------------------------- your profile */

/**
 * "Your privacy", under the profile card: who sees the person's posts, who can message them, who
 * can ask to be friends, and whether the card shows their town and the online dot. The same
 * settings the feed, the chats and the Friends drawer read.
 */
function PrivacyCard({ settings, town, update, flip }: { settings: CommunitySettings; town: string; update: (patch: Partial<CommunitySettings>) => void; flip: (flag: Flag) => () => void }) {
  const titleId = useId();
  return (
    <section className="cm-card cm-set-privacy" aria-labelledby={titleId}>
      <h3 className="cm-set-card-title" id={titleId}>Your privacy</h3>
      <Choice label="Who sees my posts by default" options={settingsChoices.postsSeenBy} value={settings.postsSeenBy} onPick={postsSeenBy => update({ postsSeenBy })} note={{ text: privacyMeaning.postsSeenBy[settings.postsSeenBy] }} />
      <Choice spaced label="Who can message me" options={settingsChoices.messagesFrom} value={settings.messagesFrom} onPick={messagesFrom => update({ messagesFrom })} note={{ text: privacyMeaning.messagesFrom[settings.messagesFrom] }} />
      <Choice spaced label="Who can ask to be friends" options={settingsChoices.requestsFrom} value={settings.requestsFrom} onPick={requestsFrom => update({ requestsFrom })} note={{ text: privacyMeaning.requestsFrom[settings.requestsFrom] }} />
      <SwitchRow label="Show my town" hint={townHint(town)} on={settings.showTown} onFlip={flip("showTown")} />
      <SwitchRow label="Show when I'm online" hint="A green dot appears on your picture" on={settings.showOnline} onFlip={flip("showOnline")} />
      <Link className="cm-set-link" href={friendsHref("requests", { space: "settings", group: null })}>See requests you have sent and received<NextIcon size={18} /></Link>
    </section>
  );
}

/**
 * "Blocked", under Your privacy: the people the person has blocked, each with Unblock (which asks
 * once more). Someone unblocked keeps their row for this visit, with Undo. Nobody is told.
 */
function BlockedCard({ memory }: { memory: CommunityMemory }) {
  const visit = useFriendsVisit();
  // Whose "Unblock?" question is showing.
  const [asking, setAsking] = useState<MemberId | null>(null);
  const [said, setSaid] = useState("");
  const [focusKey, setFocusKey] = useState<string | null>(null);
  const card = useRef<HTMLElement>(null);
  const titleId = useId();
  const rows = blockedRows(memory, visit);
  const blocked = rows.filter(row => !row.unblocked).length;

  // When a row changes into something else (the question shown, someone unblocked), the focus
  // moves to what took its place rather than being lost.
  useLayoutEffect(() => {
    if (focusKey === null) return;
    setFocusKey(null);
    card.current?.querySelector<HTMLElement>(`[data-set-focus="${focusKey}"]`)?.focus();
  }, [focusKey]);

  const keep = (who: MemberId) => { setAsking(null); setFocusKey(`unblock-${who}`); };
  const unblock = (row: BlockedRow) => {
    friendsVisit.unblocked(row.who, row.at);
    communityStore.unblock(row.who);
    setAsking(null);
    setSaid(`${members[row.who].name} is unblocked.`);
    setFocusKey(`reblock-${row.who}`);
  };
  // Undo blocks them again from when they were first blocked.
  const reblock = (row: BlockedRow) => {
    communityStore.block(row.who, row.at);
    friendsVisit.reblocked(row.who);
    setSaid(`${members[row.who].name} is blocked again.`);
    setFocusKey(`unblock-${row.who}`);
  };

  return (
    <section ref={card} className="cm-card cm-set-blocked" aria-labelledby={titleId}>
      <div className="cm-set-card-head">
        <h3 className="cm-set-card-title" id={titleId}>Blocked</h3>
        <span className="cm-set-card-aside">{`${blocked} blocked`}</span>
      </div>
      {rows.length > 0 && (
        <ul className="cm-set-blocked-list">
          {rows.map(row => {
            const name = members[row.who].name;
            const open = asking === row.who && !row.unblocked;
            // While "Unblock?" is showing, Escape answers "Keep blocked".
            const onKeyDown = open ? (event: KeyboardEvent<HTMLLIElement>) => { if (event.key === "Escape") { event.preventDefault(); keep(row.who); } } : undefined;
            return (
              <li key={row.who} onKeyDown={onKeyDown}>
                <div className="cm-set-blocked-row">
                  <MemberFace who={row.who} size={44} />
                  <span className="cm-set-person"><b>{name}</b><span>{row.unblocked ? "Unblocked just now" : `Blocked ${daysAgoLabel(row.at)}`}</span></span>
                  {row.unblocked
                    ? <button type="button" className="cm-set-small" data-set-focus={`reblock-${row.who}`} onClick={() => reblock(row)}>Undo<span className="cm-sr">{`, and block ${name} again`}</span></button>
                    : <button type="button" className="cm-set-small" data-set-focus={`unblock-${row.who}`} aria-expanded={open} onClick={() => { if (open) keep(row.who); else { setAsking(row.who); setFocusKey(`question-${row.who}`); } }}>Unblock<span className="cm-sr">{` ${name}`}</span></button>}
                </div>
                {open && (
                  <div className="cm-set-confirm cm-pop" role="group" aria-label={`Unblock ${name}?`}>
                    <p tabIndex={-1} data-set-focus={`question-${row.who}`}>{unblockQuestion(row.who)}</p>
                    <span className="cm-set-confirm-actions">
                      <button type="button" className="cm-btn cm-btn-green cm-btn-small" onClick={() => unblock(row)}>Yes, unblock<span className="cm-sr">{` ${name}`}</span></button>
                      <button type="button" className="cm-btn cm-btn-quiet cm-btn-small" onClick={() => keep(row.who)}>Keep blocked</button>
                    </span>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
      <p className="cm-set-small-print">{rows.length === 0 ? "You haven't blocked anyone. " : ""}People you block are never told. You can unblock them at any time.</p>
      <p className="cm-sr" role="status">{said}</p>
    </section>
  );
}

/* -------------------------------------------------------------- preview */

/**
 * The person's card as other members would see it if they tapped the person's name. In this preview
 * nobody else sees it: it shows what the choices on the left change. It is a picture of the card
 * (tagged "Your card"), so its "Add friend" and "Message" are flat labels, not buttons.
 */
function CardPreview({ name, settings, town, groups, friends, photo, initial }: { name: string; settings: CommunitySettings; town: string; groups: number; friends: number; photo: boolean; initial: string }) {
  const taking = settings.requestsFrom !== "noOne";
  const friendsOnly = settings.messagesFrom === "friends";
  const noMessages = settings.messagesFrom === "noOne";
  const look = pictureWords(settings.picture, settings.look, initial, photo);
  return (
    <div className="cm-card cm-set-card">
      <span className="cm-set-cover" aria-hidden="true"><span className="cm-set-card-tag">Your card</span></span>
      <div className="cm-set-card-body">
        <span className="cm-set-card-face">
          <MyFace key={`${settings.picture}:${JSON.stringify(settings.look)}:${photo}`} size={84} className="cm-pop" />
          {settings.showOnline && <span className="cm-set-online cm-pop" aria-hidden="true" />}
        </span>
        <p className="cm-sr">{`${look}${settings.showOnline ? ", with a green dot for online" : ""}.`}</p>
        <div className="cm-set-card-who">
          <p className="cm-set-card-name">{name}</p>
          <p className="cm-set-card-line">{cardLine(settings.showTown, town, groups, friends)}</p>
          {settings.about && <p className="cm-set-card-about">{`“${settings.about}”`}</p>}
        </div>
        <p className="cm-set-card-buttons">
          <span className={`cm-set-pill ${taking ? "cm-set-pill-add" : "cm-set-pill-off"}`}>{taking ? "Connect" : "Not taking requests"}</span>
          {noMessages ? <span className="cm-set-pill cm-set-pill-off">Not taking messages</span> : (
            <span className={`cm-set-pill cm-set-pill-message${friendsOnly ? " is-limited" : ""}`}>
              {friendsOnly && <LockIcon size={15} />}Message{friendsOnly && <span className="cm-sr"> (connections only)</span>}
            </span>
          )}
        </p>
        <p className="cm-set-card-note">{cardNote(settings.messagesFrom)}</p>
      </div>
    </div>
  );
}

/** A line of a post at the chosen text size, from someone the person still sees. */
function SamplePost({ memory }: { memory: CommunityMemory }) {
  const titleId = useId();
  const line = sampleLine(memory);
  return (
    <section className="cm-card cm-set-sample" aria-labelledby={titleId}>
      <h3 className="cm-set-sample-title" id={titleId}>Sample post at this size</h3>
      {line.who && <p className="cm-set-sample-who"><Face who={line.who} size={36} /><span>{people[line.who].name}</span></p>}
      <p className="cm-set-sample-text">{line.text}</p>
    </section>
  );
}

/* ----------------------------------------------------------------- page */

export default function SettingsView({ name, section = null, onChangePicture, embedded = false }: SettingsViewProps) {
  const memory = useCommunity();
  const settings = memory.settings;
  const profile = useProfile();
  const later = useLater();
  const [, navigate] = useLocation();
  const search = useSearch();
  const searchNow = useRef(search);
  searchNow.current = search;
  const town = profile.city.trim();
  const target = settingsTarget(section);
  const panelOf = (at: Target | null): SettingsPanel | null => (at && at !== "profile" ? at : null);
  const [open, setOpen] = useState<SettingsPanel | null>(panelOf(target) ?? "see");
  // The section the address named last. A new one opens as it arrives, while the page is drawn,
  // even though the page stays as it was left once it has been visited.
  const [named, setNamed] = useState<SettingsSection | null>(section);
  if (section !== named) {
    setNamed(section);
    const panel = panelOf(target);
    if (panel) setOpen(panel);
  }
  const [saved, setSaved] = useState<{ id: number; kept: boolean } | null>(null);
  const saves = useRef(0);
  const cards = useRef<Partial<Record<Target, HTMLDivElement | null>>>({});
  const reveal = useRef<SettingsPanel | null>(null);
  const previewTitleId = useId();
  const now = Date.now();
  const summary = settingsSummaries(settings, now);

  // Opening a section closes the one that was open, which can pull the new one up out of sight,
  // and a section near the bottom of the screen opens below it. Bring it into view.
  useLayoutEffect(() => {
    const id = reveal.current;
    reveal.current = null;
    const card = id ? cards.current[id] : null;
    if (card) bringIntoView(card);
  }, [open]);

  // A link about one setting ("Quiet time: Change", "View your profile") named its section. Once
  // the page has settled (My community moves to the top of a page it opens), bring that section
  // into view and put the focus on its heading. Then the address goes back to plain settings, so
  // the same link opens the section again later, however the sections have been opened and
  // closed in the meantime.
  useEffect(() => {
    if (!target || typeof window === "undefined") return;
    const frame = window.requestAnimationFrame(() => {
      const card = cards.current[target];
      if (card) {
        bringIntoView(card);
        card.querySelector<HTMLElement>(".cm-set-toggle, [data-set-heading]")?.focus({ preventScroll: true });
      }
      const view = communityViewFromQuery(searchNow.current);
      if (view.space === "settings" && view.section) navigate(viewHref({ ...view, section: undefined }), { replace: true });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [target, navigate]);

  const toggle = (id: SettingsPanel) => {
    const opening = open !== id;
    reveal.current = opening ? id : null;
    setOpen(opening ? id : null);
  };
  const cardRef = (id: Target) => (card: HTMLDivElement | null) => { cards.current[id] = card; };

  /** "Saved" for a moment: `kept` when the change reached the browser's storage; otherwise it lasts this visit. */
  const flash = (kept: boolean) => {
    const id = ++saves.current;
    setSaved({ id, kept });
    later(() => setSaved(current => (current?.id === id ? null : current)), 2000);
  };
  const save: Save = change => {
    const before = communityStore.load();
    change();
    if (communityStore.load() === before) return false;
    flash(communityStore.lastSaveKept());
    return true;
  };

  // A new picture is chosen in "Choose your picture", over the page: say it is saved here too.
  const pictureKey = `${settings.picture}:${JSON.stringify(settings.look)}:${profile.photo.length}`;
  const lastPicture = useRef(pictureKey);
  useEffect(() => {
    if (lastPicture.current === pictureKey) return;
    lastPicture.current = pictureKey;
    flash(communityStore.lastSaveKept());
    // flash only reads refs and setters.
  }, [pictureKey]);
  const update = (patch: Partial<CommunitySettings>) => save(() => communityStore.updateSettings(patch));
  const flip = (flag: Flag) => () => {
    const patch: Partial<CommunitySettings> = {};
    patch[flag] = !settings[flag];
    update(patch);
  };
  const sectionProps = (id: SettingsPanel) => ({ id, summary: summary[id], open: open === id, onToggle: toggle, cardRef: cardRef(id) });

  return (
    <div className={`cm-set-page ${embedded ? "is-embedded" : ""}`}>
      <div className="cm-set-main">
        <div className="cm-set-head">
          {embedded ? <p className="cm-view-intro">Your card, your privacy, and the settings for My community. They save as you go.</p> : (
            <div className="cm-set-titles">
              <h2 className="cm-view-title" tabIndex={-1} data-view-heading>Community settings</h2>
              <p className="cm-view-intro">Only for My community. The settings below save as you go.</p>
            </div>
          )}
          <p className="cm-set-saved-slot" role="status">
            {saved && <span key={saved.id} className="cm-set-saved"><CheckIcon size={18} strokeWidth={2.4} />{saved.kept ? "Saved" : "Saved for this visit"}</span>}
          </p>
        </div>

        {/* Your profile: the one place the profile is edited, with privacy and blocking under it. */}
        <div ref={cardRef("profile")} className="cm-set-profile">
          <ProfileCard onChangePicture={onChangePicture} onSaved={flash} />
          <PrivacyCard settings={settings} town={town} update={update} flip={flip} />
          <BlockedCard memory={memory} />
        </div>

        <Section {...sectionProps("see")} title="What you see" tone="mint" icon={<EyeIcon size={24} />}>
          <SwitchRow label="Gentle mode" hint="Sad or upsetting posts stay covered until you tap them" on={settings.gentleMode} onFlip={flip("gentleMode")} />
          <SwitchRow label="Show numbers of hearts" hint="Turn off to see hearts without the counts" on={settings.showHeartCounts} onFlip={flip("showHeartCounts")} />
          <HiddenWords words={settings.hiddenWords} save={save} />
        </Section>

        <Section {...sectionProps("read")} title="Reading and listening" tone="lilac" icon={<SpeakerIcon size={24} />}>
          <SwitchRow label="Read posts aloud" hint="Posts get a Listen button. Your device's own voice reads them." on={settings.readAloud} onFlip={flip("readAloud")} />
          <SwitchRow label="Write out voice notes" hint="Voice notes show their words underneath" on={settings.writeOutVoiceNotes} onFlip={flip("writeOutVoiceNotes")} />
          <Choice label="Text size in My community" options={settingsChoices.textSize} value={settings.textSize} onPick={textSize => update({ textSize })} />
        </Section>

        <Section {...sectionProps("quiet")} title="Quiet times" tone="amber" icon={<MoonIcon size={24} />}>
          <QuietTime settings={settings} now={now} onStep={by => update({ quietFrom: stepQuietFrom(settings.quietFrom, by) })} />
          <Choice
            spaced
            label="Take a break from My community"
            hint={breakHint(settings, now)}
            options={settingsChoices.breakFor}
            value={breakNow(settings, now)}
            onPick={choice => save(() => communityStore.takeBreak(choice))}
          />
        </Section>
      </div>

      <aside className="cm-set-aside" aria-labelledby={previewTitleId}>
        <h3 className="cm-set-aside-title" id={previewTitleId}>How others would see you</h3>
        <CardPreview name={name} settings={settings} town={town} groups={myGroups(memory).length} friends={friendList(memory).length} photo={!!profile.photo} initial={profileInitial(profile)} />
        <SamplePost memory={memory} />
        <Link className="cm-card cm-set-safety" href={communityHref("safety")}>
          <span className="cm-set-safety-icon" aria-hidden="true"><ShieldIcon size={22} /></span>
          <span className="cm-set-safety-text"><b>Safety and blocking</b><span>Your reports, and the people and posts you've hidden</span></span>
          <NextIcon size={20} />
        </Link>
      </aside>
    </div>
  );
}
