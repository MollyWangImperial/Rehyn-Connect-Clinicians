import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link, Redirect, Route, Switch, useLocation, useSearch } from "wouter";
import { ArrowRight, Search, SlidersHorizontal, X } from "lucide-react";
import RecoveryShell from "@/components/RecoveryShell";
import ClinicianPortal from "@/components/clinicians/ClinicianPortal";
import { TAB_PATH, panelId, type ClinicianPage } from "@/components/clinicians/ClinicianTabs";
import ColleagueProfile from "@/components/clinicians/ColleagueProfile";
import MeetPage from "@/components/clinicians/MeetPage";
import { UrgentStart, UrgentStatus } from "@/components/clinicians/Urgent";
import { CONNECTION_FILTERS, ColleagueRow, connectionFilterOf, connectionOf, matchesConnection, mutualOf, sharedGroups, type ConnectionFilter } from "@/components/clinicians/network";
import { hueStyle } from "@/components/clinicians/parts";
import {
  CLINICAL_AREAS, CLINICIAN_TYPES, clinicalAreaFromQuery, clinicalAreasOf, clinicianGroups, directoryHref, groupPlace, professionalTitle, type Clinician, type ClinicianType,
} from "@/content/clinicians";
import { personOfClinician } from "@/content/community-samples";
import { librarySections } from "@/content/library";
import { useClinicians } from "@/lib/clinician-portal";
import { friendsHref, useCommunity } from "@/lib/community-store";
import { useMe } from "@/lib/me";
import { todayLabel } from "./Welcome";
import "./clinicians.css";

// The Clinicians tab of Rehyn Connect for clinicians: a professional network directory for finding and connecting with
// other doctors and clinicians (browser comment 11), a little like LinkedIn's. It is a nested route, like the Library,
// so the paths below are relative to /clinicians. Finding colleagues, My consultations and the weekly group sessions
// are the tab's three parts: one page with a row of tabs under the heading (ClinicianHub, ClinicianTabs) and the
// clinician's My network numbers beside it, the chosen part showing beneath the tabs:
//   /                     find colleagues: search, condition expertise (the Library's sections and groups), filters
//                         (connection, profession, location) and results; ?area=…&group=… opens it already narrowed
//   /consultations        the same page with My consultations showing
//   /sessions             the same page with the weekly group sessions showing
//   /by-condition         browse by condition area (artboard 2)
//   /urgent, /urgent/:id  an urgent consultation (the patient edition's; no longer offered from the directory)
//   /portal               the clinician portal (a preview: try it as one of the example clinicians)
//   /meet/:room           the meeting room, for a consultation or a group session
//   /:id                  a clinician's profile, with Connect (components/clinicians/ColleagueProfile.tsx); the
//                         signed-in clinician's own shows as theirs, with a link to edit it in the portal
// Connections are My Network's (lib/community-store.ts, components/clinicians/network.tsx), so the two always agree.
// Patients' booking (prices, Book a consultation, urgent requests) isn't offered from the directory or the profiles.
// The people are demo profiles (content/clinicians.ts), and what is done here stays on this device; the page says so.

// ------------------------------------------------------------------------------------------------ the directory

type Sort = "relevant" | "name" | "experience";

const surname = (name: string) => name.replace(/^Dr\.? /, "");

/**
 * Find colleagues: search by name, title, workplace or condition; narrow by clinical expertise (CLINICAL_AREAS, from
 * each profile's conditions and specialty), profession, location and where they stand with you in My Network. The signed-in clinician isn't listed
 * (their own profile is the sidebar's "View your profile"), nor is anyone they have blocked.
 */
function Directory() {
  const search = useSearch();
  const [expertise, setExpertise] = useState(() => clinicalAreaFromQuery(search));
  const [types, setTypes] = useState<ClinicianType[]>([]);
  const [connection, setConnection] = useState<ConnectionFilter>(() => connectionFilterOf(new URLSearchParams(search).get("connection")));
  const [place, setPlace] = useState("");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<Sort>("relevant");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const everyone = useClinicians();
  const memory = useCommunity();
  const me = useMe();
  const count = useRef<HTMLHeadingElement>(null);
  const area = CLINICAL_AREAS.find(item => item.id === expertise);
  const toggle = <T,>(list: T[], value: T) => (list.includes(value) ? list.filter(item => item !== value) : [...list, value]);
  const clearAll = () => { setExpertise("all"); setTypes([]); setConnection("all"); setPlace(""); setQuery(""); };

  // Everyone who could be listed, with where they stand with you, before the filters.
  const colleagues = useMemo(() => everyone
    .filter(person => person.listed !== false && person.id !== me.clinician.id)
    .map(person => ({ person, status: connectionOf(memory, person, me).status }))
    .filter(entry => entry.status !== "blocked"), [everyone, memory, me]);
  const places = useMemo(() => colleagues.map(entry => entry.person.place).filter((item, index, list): item is string => !!item && list.indexOf(item) === index).sort(), [colleagues]);
  // Only the clinical areas someone in the directory actually works in.
  const areas = useMemo(() => CLINICAL_AREAS.filter(item => colleagues.some(entry => clinicalAreasOf(entry.person).includes(item))), [colleagues]);

  const results = useMemo(() => {
    const words = query.trim().toLowerCase();
    const score = (person: Clinician) => {
      const who = personOfClinician(person.id);
      return (who ? mutualOf(memory, who, me).length * 2 : 0) + sharedGroups(person, me.clinician).length;
    };
    const rank = (status: string) => (status === "incoming" ? 0 : 1);
    return colleagues.filter(({ person, status }) => {
      const mine = clinicianGroups(person);
      if (area && !clinicalAreasOf(person).includes(area)) return false;
      if (types.length && !types.includes(person.type)) return false;
      if (place && person.place !== place) return false;
      if (!matchesConnection(status, connection)) return false;
      if (words) {
        const conditions = person.conditions.map(([groupId, conditionId]) => groupPlace(groupId)?.group.conditions.find(item => item.id === conditionId)?.title ?? "");
        const type = CLINICIAN_TYPES.find(item => item.id === person.type)?.label ?? "";
        const text = [person.name, professionalTitle(person), type, person.org, person.place, person.summary, ...mine.map(item => item.group.title), ...clinicalAreasOf(person).map(item => item.label), ...conditions, ...person.languages].join(" ").toLowerCase();
        if (!words.split(/\s+/).every(word => text.includes(word))) return false;
      }
      return true;
    }).sort((a, b) => {
      if (sort === "name") return surname(a.person.name).localeCompare(surname(b.person.name));
      if (sort === "experience") return b.person.years - a.person.years || surname(a.person.name).localeCompare(surname(b.person.name));
      return rank(a.status) - rank(b.status) || score(b.person) - score(a.person) || surname(a.person.name).localeCompare(surname(b.person.name));
    }).map(entry => entry.person);
  }, [colleagues, area, types, place, connection, query, sort, memory, me]);

  const countFor = (filter: ConnectionFilter) => colleagues.filter(entry => matchesConnection(entry.status, filter)).length;
  const active: { label: string; remove: () => void }[] = [];
  if (area) active.push({ label: area.label, remove: () => setExpertise("all") });
  for (const id of types) active.push({ label: CLINICIAN_TYPES.find(type => type.id === id)!.label, remove: () => setTypes(toggle(types, id)) });
  if (place) active.push({ label: place, remove: () => setPlace("") });
  if (connection !== "all") active.push({ label: CONNECTION_FILTERS.find(item => item.id === connection)!.label, remove: () => setConnection("all") });

  return (
    <>
      <h2 className="cl-sr">Find colleagues</h2>
      {/* The search: filtering is live; Search takes you to the results. */}
      <form className="cx-card cn-search" aria-label="Search" onSubmit={event => { event.preventDefault(); count.current?.focus(); count.current?.scrollIntoView({ block: "start", behavior: "smooth" }); }}>
        <div className="cn-search-row">
          <label className="cn-search-box">
            <Search size={20} aria-hidden="true" />
            <span className="cl-sr">Search clinicians</span>
            <input type="search" placeholder="Search by name, specialty, workplace or condition" value={query} onChange={event => setQuery(event.target.value)} />
          </label>
          <button type="submit" className="cx-btn cx-btn-primary cn-search-go">Search</button>
        </div>
        {/* Professional clinical areas (not the Library's patient sections). Chips on a wide screen, a list on a phone. */}
        <div className="cn-chiprow cn-areas" role="group" aria-label="Clinical expertise">
          <span className="cn-chiprow-label">Clinical expertise</span>
          <button type="button" className="cn-filter-chip" aria-pressed={!area} onClick={() => setExpertise("all")}>All clinical areas</button>
          {areas.map(item => (
            <button key={item.id} type="button" className="cn-filter-chip" aria-pressed={area?.id === item.id} onClick={() => setExpertise(item.id)}>{item.label}</button>
          ))}
        </div>
        <label className="cn-areas-select">
          <span className="cn-chiprow-label">Clinical expertise</span>
          <select className="cn-select" value={area?.id ?? "all"} onChange={event => setExpertise(event.target.value)}>
            <option value="all">All clinical areas</option>
            {areas.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
          </select>
        </label>
      </form>

      <div className="cn-layout">
        <aside className={`cx-card cn-filters ${filtersOpen ? "is-open" : ""}`} aria-label="Filters">
          {/* On a phone the filters fold away under this button, so the results come first. */}
          <button type="button" className="cn-filters-toggle" aria-expanded={filtersOpen} onClick={() => setFiltersOpen(!filtersOpen)}>
            <SlidersHorizontal size={18} aria-hidden="true" /><span>{filtersOpen ? "Hide filters" : "Filters"}</span>
            {active.length > 0 && <span className="cn-filters-count">{active.length}<span className="cl-sr"> on</span></span>}
          </button>
          <fieldset className="cn-fieldset">
            <legend className="cn-legend">Connection</legend>
            {CONNECTION_FILTERS.map(item => (
              <label key={item.id} className="cn-option">
                <input type="radio" name="cn-connection" checked={connection === item.id} onChange={() => setConnection(item.id)} />{item.label}
                <span className="cn-option-count">{countFor(item.id)}</span>
              </label>
            ))}
          </fieldset>
          <div className="cn-rule" />
          <fieldset className="cn-fieldset">
            <legend className="cn-legend">Profession</legend>
            {CLINICIAN_TYPES.map(type => (
              <label key={type.id} className="cn-option">
                <input type="checkbox" checked={types.includes(type.id)} onChange={() => setTypes(toggle(types, type.id))} />{type.label}
              </label>
            ))}
          </fieldset>
          {places.length > 1 && (
            <>
              <div className="cn-rule" />
              <label className="cn-fieldset">
                <span className="cn-legend">Location</span>
                <select className="cn-select" value={place} onChange={event => setPlace(event.target.value)}>
                  <option value="">Anywhere</option>
                  {places.map(item => <option key={item} value={item}>{item}</option>)}
                </select>
              </label>
            </>
          )}
        </aside>

        <section className="cn-results" aria-label="Results">
          <div className="cn-results-head">
            <h2 ref={count} tabIndex={-1} className="cn-count" aria-live="polite">{results.length} {results.length === 1 ? "clinician" : "clinicians"}{area && <span className="cn-count-for"> in {area.label}</span>}</h2>
            <label className="cn-sort">Sort by
              <select className="cn-select" value={sort} onChange={event => setSort(event.target.value as Sort)}>
                <option value="relevant">Most relevant</option>
                <option value="name">Name A–Z</option>
                <option value="experience">Most experience</option>
              </select>
            </label>
          </div>

          {active.length > 0 && (
            <div className="cn-active">
              {active.map(item => (
                <button key={item.label} type="button" className="cn-active-chip" onClick={item.remove} aria-label={`Remove filter ${item.label}`}>{item.label}<X size={14} aria-hidden="true" /></button>
              ))}
              <button type="button" className="cn-clear" onClick={clearAll}>Clear all</button>
            </div>
          )}

          {results.length === 0 ? (
            <div className="cx-card cn-empty">
              <p className="cn-empty-title">No colleagues match all of these</p>
              <p>Try a different search, or remove a filter.</p>
              <button type="button" className="cx-btn" onClick={clearAll}>Clear filters</button>
            </div>
          ) : (
            <ul className="cx-card cn-list" aria-label="Clinicians">
              {results.map(person => <ColleagueRow key={person.id} clinician={person} me={me} memory={memory} />)}
            </ul>
          )}

          <p className="cn-footnote">These are demo profiles: example clinicians while the network is being set up. Connections, invitations and messages stay on this device, and are the same here and in <Link href={`~${friendsHref("friends")}`} className="cn-link">My network</Link>.</p>
        </section>
      </div>
    </>
  );
}

// ------------------------------------------------------------------------------------- the tab's front: three parts

/** Where the address points among the tab's three parts, if it is one of them. */
export function hubPage(location: string): ClinicianPage | null {
  const path = location.replace(/\/+$/, "") || "/";
  return (Object.keys(TAB_PATH) as ClinicianPage[]).find(page => TAB_PATH[page] === path) ?? null;
}

/**
 * The heading, "Need someone urgently" and the tabs, with the chosen part beneath them on the same page. All three
 * parts stay mounted and only the chosen one shows, so switching tabs keeps the search and filters as they were.
 */
function ClinicianHub({ page }: { page: ClinicianPage }) {
  const panel = (which: ClinicianPage, body: ReactNode) => (
    <div id={panelId(which)} className="cl-tab-panel" hidden={page !== which}>{body}</div>
  );
  return (
    <div className="cl-page cn-page">
      {/* The connection count lives in the sidebar's profile card now (and My Network has its own row there). */}
      <div className="cn-head">
        <div className="cn-head-text">
          <p className="cx-kicker">Connect with healthcare professionals</p>
          <h1 className="cn-h1" data-page-heading>Your Clinical Network</h1>
        </div>
      </div>

      {/* For clinicians the directory stands alone: their consultations and weekly patient sessions have their own
          destinations (the portal and Group weekly sessions), so the patient edition's tabs aren't shown here. */}
      {panel("find", <Directory />)}
    </div>
  );
}

// ------------------------------------------------------------------------------------------ start from a condition

const STEPS = ["Condition area", "Type of clinician", "Clinicians listed"];

/** The Library's sections as cards: the arrow opens the directory at that section, a group chip at that group. The
 *  next two steps happen there, with the type-of-clinician filter and the results. It only lists: nothing here says who
 *  someone should see (that would be advice about their care), so each card counts the clinicians listed for it. */
function ByCondition() {
  const listed = useClinicians().filter(person => person.listed !== false);
  const countFor = (sectionId: string) => listed.filter(person => clinicianGroups(person).some(place => place.section.id === sectionId)).length;
  return (
    <div className="cl-page">
      <p className="cl-kicker"><span aria-hidden="true" />Clinicians · By condition area</p>
      <h1 className="cl-h1" data-page-heading>Browse by condition area<span aria-hidden="true">.</span></h1>
      <p className="cl-lead">Choose a Library section, or a group within it, to see the clinicians who list it among the conditions they work with. You can narrow the list from there.</p>

      <ol className="cl-steps" aria-label="Steps">
        {STEPS.map((step, index) => (
          <li key={step} aria-current={index === 0 ? "step" : undefined}><span>{index + 1}</span>{step}</li>
        ))}
      </ol>

      <div className="cl-areas">
        {librarySections.map(section => (
          <section key={section.id} className="cl-area-card" style={hueStyle(section.hue)} aria-labelledby={`cl-area-${section.id}`}>
            <div className="cl-area-head">
              <div>
                <p className="cl-area-count">{section.groups.length} groups</p>
                <h2 className="cl-area-title" id={`cl-area-${section.id}`}>{section.title}</h2>
              </div>
              <Link href={directoryHref(section.id)} className="cl-area-go" aria-label={`See all clinicians for ${section.title}`}><ArrowRight size={20} aria-hidden="true" /></Link>
            </div>
            <div className="cl-area-chips">
              {section.groups.map(group => <Link key={group.id} href={directoryHref(section.id, group.id)} className="cl-area-chip">{group.title}</Link>)}
            </div>
            <p className="cl-area-who"><strong>{countFor(section.id)} {countFor(section.id) === 1 ? "clinician" : "clinicians"} listed</strong> for this area</p>
          </section>
        ))}
      </div>

      <div className="cl-skip">
        <div className="cl-skip-text">
          <h2 className="cl-h2">Prefer to search?</h2>
          <p>Browse everyone, with search and filters.</p>
        </div>
        <Link href="/" className="cl-request">Browse all clinicians</Link>
      </div>
    </div>
  );
}

// -------------------------------------------------------------------------------------------------- the profile

/** A profile by its address, kept up to date with changes made in the portal on this device. The signed-in clinician's
 *  own address (the sidebar's "View your profile") shows it as theirs. */
function ProfileRoute({ id }: { id: string }) {
  const clinician = useClinicians().find(item => item.id === id);
  return clinician ? <ColleagueProfile key={clinician.id} clinician={clinician} /> : <Missing />;
}

function Missing() {
  return (
    <div className="cl-page cn-page cl-missing">
      <h1 className="cn-h1">We couldn't find that clinician</h1>
      <p className="cn-lead">They may have moved, or the link may be out of date.</p>
      <Link href="/" className="cx-btn cx-btn-primary">Back to the directory</Link>
    </div>
  );
}

/** A new page starts at the top, or at the part its address names (#book). Switching between the tab's three parts
 *  stays where you are, since they share the page. */
function useScrollOnArrival() {
  const [location] = useLocation();
  const last = useRef(location);
  useEffect(() => {
    const before = last.current;
    last.current = location;
    if (before !== location && hubPage(before) && hubPage(location)) return;
    const hash = window.location.hash.slice(1);
    const target = hash ? document.getElementById(hash) : null;
    if (target) target.scrollIntoView({ block: "start" });
    else window.scrollTo(0, 0);
  }, [location]);
}

export default function Clinicians() {
  useScrollOnArrival();
  const [location] = useLocation();
  const page = hubPage(location);
  // The patient edition's My consultations and session listing lead to the clinician's own destinations here.
  if (page === "consultations") return <Redirect to="~/clinicians/portal/consultations" replace />;
  if (page === "sessions") return <Redirect to="~/community?space=circle" replace />;
  return (
    <RecoveryShell active="Clinicians" dateLabel={todayLabel()} className="clinicians-shell" panel={false}>
      {page ? <ClinicianHub page={page} /> : (
      <Switch>
        {/* These come before /:id, so none is taken for a clinician. */}
        <Route path="/by-condition"><ByCondition /></Route>
        <Route path="/urgent"><UrgentStart /></Route>
        <Route path="/urgent/:id">{params => <UrgentStatus id={params.id} />}</Route>
        <Route path="/portal" nest><ClinicianPortal /></Route>
        <Route path="/meet/:room">{params => <MeetPage room={params.room} />}</Route>
        <Route path="/:id">{params => <ProfileRoute id={params.id} />}</Route>
        <Route><Missing /></Route>
      </Switch>
      )}
    </RecoveryShell>
  );
}
