import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from "react";
import { useLocation } from "wouter";
import { ExternalLink, Plus } from "lucide-react";
import CommunityDialog from "@/components/community/dialog";
import { librarySections, type ContentType } from "@/content/library";
import { useRole } from "@/lib/clinician-portal";
import { CONTENT_TYPES, conditionHref, contentTitle, findCondition, kindLabel, type ConditionPlace } from "@/lib/library";
import {
  canContributeToLibrary,
  contributionDate,
  contributionsFor,
  contributionStore,
  CONTRIBUTION_KINDS,
  CONTRIBUTION_LIMITS,
  EMPTY_DRAFT,
  isWebAddress,
  useContributions,
  type ContributionDraft,
  type ContributionErrors,
  type ContributionField,
  type LibraryContribution,
} from "@/lib/library-contributions";
import { prefersStill } from "@/lib/library-local";
import { useMe } from "@/lib/me";
import "@/pages/community.css";
import "@/pages/library-contributions.css";

// "Add to library" (browser comment 15): a clinician places a piece of content on a condition's page, choosing the
// Library group, the condition and the part of the page (the category) it goes under. It is saved with who added it
// and when (lib/library-contributions.ts) and shown on that page, in that part, labelled as a clinician contribution.
// In this preview it is kept on this device only: there is no review or publishing step yet, and the UI says so.

/** What each part of a condition page is for, as the form explains it (the page's own lines, shortened). */
const CATEGORY_HINT: Record<ContentType, string> = {
  understand: "the condition, its causes and the tests used to diagnose it",
  recover: "recovery, treatment and everyday activities",
  liveWell: "practical support for everyday life",
  watch: "films, talks and audio",
};

const DEVICE_NOTE = "In this preview it's kept on this device only. There's no review or publishing step yet, so patients and other clinicians won't see it.";

/** The contribution the page should bring into view once it is on screen (set when the form saves). */
let justAdded: string | null = null;

/** The bar at the top of every Library page with the "Add to library" button; only those allowed to contribute get it. */
export default function AddToLibraryBar() {
  const role = useRole();
  const [location] = useLocation();
  const [open, setOpen] = useState(false);
  if (!canContributeToLibrary(role)) return null;
  // On a condition's page the form starts on that condition.
  const [first, second] = location.split("/").filter(Boolean).map(decodeURIComponent);
  const here = second ? findCondition(first, second) : undefined;
  return <div className="lib-contrib-bar" role="region" aria-label="Clinician tools">
    <p className="lib-contrib-bar-words"><span className="cx-kicker">For clinicians</span><span>Add guidance, a resource or a film to a condition's page.</span></p>
    <button type="button" className="cx-btn cx-btn-primary" aria-haspopup="dialog" onClick={() => setOpen(true)}><Plus size={16} aria-hidden="true" />Add to library</button>
    {open && <AddToLibraryForm here={here} onClose={() => setOpen(false)} />}
  </div>;
}

function AddToLibraryForm({ here, onClose }: { here?: ConditionPlace; onClose: () => void }) {
  const me = useMe();
  const [location, navigate] = useLocation();
  const base = useId();
  const id = (field: string) => `${base}-${field}`;
  const [draft, setDraft] = useState<ContributionDraft>(() => ({ ...EMPTY_DRAFT, groupId: here?.group.id ?? "", conditionId: here?.condition.id ?? "" }));
  const [errors, setErrors] = useState<ContributionErrors>({});
  const [saveError, setSaveError] = useState("");
  const [tried, setTried] = useState(false);
  const saveRef = useRef<HTMLParagraphElement>(null);

  const group = librarySections.flatMap(section => section.groups).find(entry => entry.id === draft.groupId);
  const condition = findCondition(draft.groupId, draft.conditionId)?.condition;
  const set = (field: ContributionField, value: string) => {
    setDraft(previous => {
      const next = { ...previous, [field]: value };
      // A new group starts its condition again unless the chosen one is in it.
      if (field === "groupId" && !findCondition(value, previous.conditionId)) next.conditionId = "";
      return next;
    });
    if (errors[field]) setErrors(previous => ({ ...previous, [field]: undefined }));
    setSaveError("");
  };

  const ORDER: ContributionField[] = ["groupId", "conditionId", "category", "kind", "title", "summary", "body", "url"];
  const submit = (event: FormEvent) => {
    event.preventDefault();
    setTried(true);
    const author = { clinicianId: me.clinician.id, name: me.name, title: me.title, photo: me.photo, initials: me.initials };
    const result = contributionStore.add(draft, author);
    if ("errors" in result) {
      setErrors(result.errors);
      const firstWrong = ORDER.find(field => result.errors[field]);
      if (firstWrong) document.getElementById(id(firstWrong))?.focus();
      return;
    }
    if (!result.ok) {
      setSaveError(result.error);
      saveRef.current?.focus();
      return;
    }
    // Saved: close, and open the chosen page at the new piece (or bring it into view if this is that page).
    const { contribution } = result;
    const href = conditionHref(contribution.groupId, contribution.conditionId);
    justAdded = contribution.id;
    onClose();
    if (location !== href) navigate(`${href}#contribution-${contribution.id}`);
  };

  const count = Object.values(errors).filter(Boolean).length;
  const describe = (field: ContributionField, hint?: string) => [hint, errors[field] ? id(`${field}-error`) : null].filter(Boolean).join(" ") || undefined;
  const fieldError = (field: ContributionField) => errors[field] ? <p id={id(`${field}-error`)} className="lib-contrib-error">{errors[field]}</p> : null;
  const counter = (value: string, max: number) => <span className={`lib-contrib-count${value.trim().length > max ? " is-over" : ""}`}>{value.trim().length} / {max}</span>;

  return <div className="cm-layer"><CommunityDialog kind="sheet" labelledBy={id("heading")} onClose={onClose} className="lib-contrib-dialog">
    <div className="lib-contrib-dialog-head">
      <div>
        <p className="cx-kicker">Clinician contribution</p>
        <h2 id={id("heading")}>Add to the Library</h2>
        <p className="lib-contrib-dialog-note">Choose where it goes, then add the content. {DEVICE_NOTE}</p>
      </div>
      <button type="button" className="cx-btn cx-btn-quiet lib-contrib-close" onClick={onClose} aria-label="Close without adding">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true" focusable="false"><path d="M6 6l12 12M18 6 6 18" /></svg>
      </button>
    </div>

    <form className="lib-contrib-form" onSubmit={submit} noValidate>
      {tried && count > 0 && <p className="lib-contrib-summary-error" role="alert">{count === 1 ? "One thing needs fixing" : `${count} things need fixing`} before this can be added. Each one is marked below.</p>}

      <fieldset>
        <legend>Where it goes</legend>
        <div className="lib-contrib-field">
          <label htmlFor={id("groupId")}>Group <span className="lib-contrib-req">required</span></label>
          <select id={id("groupId")} value={draft.groupId} onChange={event => set("groupId", event.target.value)} aria-invalid={Boolean(errors.groupId)} aria-describedby={describe("groupId")} required data-autofocus={here ? undefined : true}>
            <option value="">Choose a group</option>
            {librarySections.map(section => <optgroup key={section.id} label={section.title}>
              {section.groups.map(entry => <option key={entry.id} value={entry.id}>{entry.title}</option>)}
            </optgroup>)}
          </select>
          {fieldError("groupId")}
        </div>
        <div className="lib-contrib-field">
          <label htmlFor={id("conditionId")}>Medical condition <span className="lib-contrib-req">required</span></label>
          <select id={id("conditionId")} value={draft.conditionId} onChange={event => set("conditionId", event.target.value)} aria-invalid={Boolean(errors.conditionId)} aria-describedby={describe("conditionId", group ? undefined : id("conditionId-hint"))} required>
            <option value="">{group ? "Choose a condition" : "Choose a group first"}</option>
            {group?.conditions.map(entry => <option key={entry.id} value={entry.id}>{entry.title}</option>)}
          </select>
          {!group && <p id={id("conditionId-hint")} className="lib-contrib-hint">The conditions listed are the ones in the chosen group.</p>}
          {fieldError("conditionId")}
        </div>
        <div className="lib-contrib-field">
          <label htmlFor={id("category")}>Category <span className="lib-contrib-req">required</span></label>
          <select id={id("category")} value={draft.category} onChange={event => set("category", event.target.value)} aria-invalid={Boolean(errors.category)} aria-describedby={describe("category", id("category-hint"))} required data-autofocus={here ? true : undefined}>
            <option value="">Choose a category</option>
            {CONTENT_TYPES.map(type => <option key={type} value={type}>{contentTitle(type, condition)}: {CATEGORY_HINT[type]}</option>)}
          </select>
          <p id={id("category-hint")} className="lib-contrib-hint">The part of the condition's page it is listed under.</p>
          {fieldError("category")}
        </div>
      </fieldset>

      <fieldset>
        <legend>The content</legend>
        <div className="lib-contrib-field">
          <label htmlFor={id("kind")}>Type</label>
          <select id={id("kind")} value={draft.kind} onChange={event => set("kind", event.target.value)} aria-invalid={Boolean(errors.kind)} aria-describedby={describe("kind")}>
            {CONTRIBUTION_KINDS.map(kind => <option key={kind} value={kind}>{kindLabel(kind)}</option>)}
          </select>
          {fieldError("kind")}
        </div>
        <div className="lib-contrib-field">
          <div className="lib-contrib-label-row"><label htmlFor={id("title")}>Title <span className="lib-contrib-req">required</span></label>{counter(draft.title, CONTRIBUTION_LIMITS.title.max)}</div>
          <input id={id("title")} type="text" value={draft.title} onChange={event => set("title", event.target.value)} aria-invalid={Boolean(errors.title)} aria-describedby={describe("title")} autoComplete="off" required />
          {fieldError("title")}
        </div>
        <div className="lib-contrib-field">
          <div className="lib-contrib-label-row"><label htmlFor={id("summary")}>Summary <span className="lib-contrib-req">required</span></label>{counter(draft.summary, CONTRIBUTION_LIMITS.summary.max)}</div>
          <textarea id={id("summary")} rows={3} value={draft.summary} onChange={event => set("summary", event.target.value)} aria-invalid={Boolean(errors.summary)} aria-describedby={describe("summary", id("summary-hint"))} required />
          <p id={id("summary-hint")} className="lib-contrib-hint">One or two plain sentences, shown on the card.</p>
          {fieldError("summary")}
        </div>
        <div className="lib-contrib-field">
          <div className="lib-contrib-label-row"><label htmlFor={id("body")}>Full text <span className="lib-contrib-opt">optional</span></label>{counter(draft.body, CONTRIBUTION_LIMITS.body.max)}</div>
          <textarea id={id("body")} rows={6} value={draft.body} onChange={event => set("body", event.target.value)} aria-invalid={Boolean(errors.body)} aria-describedby={describe("body", id("body-hint"))} />
          <p id={id("body-hint")} className="lib-contrib-hint">Readers open it from the card. Leave a blank line between paragraphs.</p>
          {fieldError("body")}
        </div>
        <div className="lib-contrib-field">
          <label htmlFor={id("url")}>Link <span className="lib-contrib-opt">optional</span></label>
          <input id={id("url")} type="url" inputMode="url" placeholder="https://" value={draft.url} onChange={event => set("url", event.target.value)} aria-invalid={Boolean(errors.url)} aria-describedby={describe("url", id("url-hint"))} autoComplete="off" />
          <p id={id("url-hint")} className="lib-contrib-hint">A trusted page, film or leaflet elsewhere. It opens in a new tab.</p>
          {fieldError("url")}
        </div>
      </fieldset>

      <div className="lib-contrib-as">
        <Avatar author={me} size={32} />
        <span>Shown as added by <b>{me.name}</b>, {me.title}{me.demo ? " (example profile)" : ""}, with today's date.</span>
      </div>
      {saveError && <p ref={saveRef} className="lib-contrib-save-error" role="alert" tabIndex={-1}>{saveError}</p>}
      <div className="lib-contrib-actions">
        <button type="button" className="cx-btn cx-btn-quiet" onClick={onClose}>Cancel</button>
        <button type="submit" className="cx-btn cx-btn-primary">Add to library</button>
      </div>
    </form>
  </CommunityDialog></div>;
}

function Avatar({ author, size }: { author: { name: string; photo: string | null; initials: string }; size: number }) {
  const style = { width: size, height: size, fontSize: Math.round(size * 0.38) };
  return author.photo
    ? <img className="cx-avatar" src={author.photo} alt="" width={size} height={size} style={style} />
    : <span className="cx-avatar" aria-hidden="true" style={style}>{author.initials}</span>;
}

/** One contribution on a condition's page, labelled with who added it and when. */
function ContributionCard({ item, own }: { item: LibraryContribution; own: boolean }) {
  const ref = useRef<HTMLElement>(null);
  const [error, setError] = useState("");
  const headingId = `contribution-${item.id}-title`;
  useEffect(() => {
    if (justAdded !== item.id || !ref.current) return;
    justAdded = null;
    ref.current.scrollIntoView({ block: "center", behavior: prefersStill() ? "auto" : "smooth" });
    ref.current.focus({ preventScroll: true });
  }, [item.id]);
  const link = item.url && isWebAddress(item.url) ? item.url : null;
  const host = link ? new URL(link).hostname.replace(/^www\./, "") : "";
  const remove = () => setError(contributionStore.remove(item.id) ?? "");
  return <li>
    <article ref={ref} id={`contribution-${item.id}`} className="cx-card lib-contrib-card" aria-labelledby={headingId} tabIndex={-1}>
      <div className="lib-contrib-tags"><span className="cx-pill is-accent">Clinician contribution</span><span className="cx-pill">{kindLabel(item.kind)}</span></div>
      <h3 id={headingId}>{item.title}</h3>
      <p className="lib-contrib-text">{item.summary}</p>
      {item.body && <details className="lib-contrib-more">
        <summary>Read the full text</summary>
        {item.body.split(/\n\s*\n/).map((paragraph, index) => <p key={index}>{paragraph}</p>)}
      </details>}
      {link && <a className="lib-contrib-link" href={link} target="_blank" rel="noopener noreferrer">Open on {host}<ExternalLink size={14} aria-hidden="true" /><span className="lib-sr"> (opens in a new tab)</span></a>}
      <div className="lib-contrib-by">
        <Avatar author={item.author} size={32} />
        <span className="lib-contrib-by-words"><b>{item.author.name}</b><span>{item.author.title}</span></span>
        <span className="lib-contrib-when">Added <time dateTime={new Date(item.createdAt).toISOString()}>{contributionDate(item.createdAt)}</time> · on this device</span>
        {own && <button type="button" className="cx-btn cx-btn-quiet lib-contrib-remove" onClick={remove}>Remove<span className="lib-sr"> “{item.title}”</span></button>}
      </div>
      {error && <p className="lib-contrib-save-error" role="alert">{error}</p>}
    </article>
  </li>;
}

function ContributionList({ items }: { items: LibraryContribution[] }) {
  const me = useMe();
  const role = useRole();
  const mine = (item: LibraryContribution) => canContributeToLibrary(role) && item.author.clinicianId === me.clinician.id;
  return <ul className="lib-contrib-list" role="list">{items.map(item => <ContributionCard key={item.id} item={item} own={mine(item)} />)}</ul>;
}

/** For each part of a condition's page that has contributions, the list to show at the end of that part. */
export function contributedParts(place: ConditionPlace, list: LibraryContribution[]): Partial<Record<ContentType, ReactNode>> {
  const parts: Partial<Record<ContentType, ReactNode>> = {};
  for (const type of CONTENT_TYPES) {
    const items = contributionsFor(list, place.group.id, place.condition.id, type);
    if (items.length) parts[type] = <div className="lib-contrib-part"><p className="cx-kicker">From clinicians · kept on this device</p><ContributionList items={items} /></div>;
  }
  return parts;
}

/** On a page that is still being written: every contribution, under the part it was added to. */
export function ContributionsByCategory({ place }: { place: ConditionPlace }) {
  const list = useContributions();
  const parts = CONTENT_TYPES.map(type => ({ type, items: contributionsFor(list, place.group.id, place.condition.id, type) })).filter(part => part.items.length);
  if (!parts.length) return null;
  return <section className="lib-part lib-contrib-section" aria-labelledby="h-contributions">
    <h2 id="h-contributions" className="lib-h2">From clinicians</h2>
    <p className="lib-sub">Added by clinicians and kept on this device. They haven't been reviewed or published yet.</p>
    {parts.map(({ type, items }) => <div key={type} className="lib-contrib-part">
      <h3 className="lib-contrib-part-title">{contentTitle(type, place.condition)}</h3>
      <ContributionList items={items} />
    </div>)}
  </section>;
}
