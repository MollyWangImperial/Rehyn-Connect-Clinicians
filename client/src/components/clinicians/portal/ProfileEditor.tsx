import { useEffect, useRef, useState } from "react";
import { ChevronDown, ShieldCheck, X } from "lucide-react";
import {
  PRICE_MAX, PRICE_MIN, PRICE_REQUEST_MAX, PRICE_REQUEST_MIN, REGISTER, REHYN_SHARE, URGENT_FEE, clinicianShare, groupPlace, poundsText, shareText,
  urgentPrice, type Clinician,
} from "@/content/clinicians";
import { librarySections } from "@/content/library";
import { cancelPriceRequest, profileGaps, registerText, requestPriceChange, updateClinician, usePriceRequests } from "@/lib/clinician-portal";
import ClinicianCard from "../ClinicianCard";

// Profile & pricing in the clinician portal: what patients see (name, role, experience, about, how you help, languages,
// the Library conditions you work with), your price, your registration, and whether you're listed. The card on the
// right is how the directory shows you, as you type.

const LEVELS = ["Consultant", "Senior", "Specialist"];

/** "Multiple sclerosis" → "multiple sclerosis", but "Parkinson's disease" and "COPD" stay as they are. */
const inSentence = (text: string) => {
  const first = text.split(/\s+/)[0] ?? "";
  return first.includes("'") || first.includes("’") || first.length < 2 || first[1] !== first[1].toLowerCase() ? text : text[0].toLowerCase() + text.slice(1);
};

// The parts of the About template the clinician picks, one or more of each; the rest comes from the fields above it.
const WHO = ["adults", "older people", "young people", "carers"];
const FOCUS = ["movement", "balance", "strength", "pain", "tiredness", "mood", "memory", "speech", "diet", "medicines", "sleep", "returning to work"];

type Picks = { conditions: string[]; who: string[]; focus: string[] };

/** "a", "a and b", "a, b and c". */
const listText = (items: string[]) => (items.length < 2 ? items.join("") : `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`);

/** Languages to choose from: English, Welsh and BSL, then those most spoken in the UK. */
const LANGUAGES = ["English", "Welsh", "British Sign Language", "Polish", "Romanian", "Punjabi", "Urdu", "Bengali", "Gujarati", "Hindi", "Tamil", "Arabic", "Portuguese", "Spanish", "Italian", "French", "Turkish", "Somali", "Cantonese", "Mandarin"];

const titleOf = (person: Pick<Clinician, "level" | "role">) => {
  const role = person.role.trim() || "clinician";
  return role.toLowerCase().startsWith(person.level.toLowerCase()) ? inSentence(role) : `${person.level.toLowerCase()} ${inSentence(role)}`;
};
const yearsOf = (years: number) => (years > 0 ? `${years} year${years === 1 ? "'s" : "s'"}` : "");

/** The About text from the template: "I'm a senior physiotherapist with 11 years' experience, specialising in
 *  stroke and MS. I help adults and carers with balance and pain." */
export function aboutFromTemplate(person: Pick<Clinician, "level" | "role" | "years">, picks: Picks): string {
  const title = titleOf(person);
  const years = yearsOf(person.years);
  const specialising = picks.conditions.length ? `, specialising in ${listText(picks.conditions.map(inSentence))}` : "";
  const help = `I help ${picks.who.length ? listText(picks.who) : "people"}${picks.focus.length ? ` with ${listText(picks.focus)}` : ""}.`;
  return `I'm ${/^[aeiou]/i.test(title) ? "an" : "a"} ${title}${years ? ` with ${years} experience` : ""}${specialising}. ${help}`;
}

/** One gap in the template: the words chosen so far, and the choices, any number of them. */
function Gap({ label, choices, chosen, onToggle, empty }: { label: string; choices: string[]; chosen: string[]; onToggle: (item: string) => void; empty?: string }) {
  return (
    <div className="pt-gap" role="group" aria-label={label}>
      <span className="pt-gap-label">{label}</span>
      {choices.length ? <div className="pt-gap-choices">{choices.map(item => <button key={item} type="button" aria-pressed={chosen.includes(item)} onClick={() => onToggle(item)}>{item}</button>)}</div> : <span className="cl-small">{empty}</span>}
    </div>
  );
}

/** A short fill-in About text: one sentence, with the gaps that set a clinician apart chosen from short options. */
function AboutTemplate({ draft, onUse }: { draft: Clinician; onUse: (text: string) => void }) {
  const conditions = draft.conditions.map(([g, c]) => groupPlace(g)?.group.conditions.find(item => item.id === c)?.title).filter((title): title is string => !!title);
  const [picks, setPicks] = useState<Picks>({ conditions: conditions.slice(0, 2), who: [WHO[0]], focus: [] });
  // Keep the order of the choices, whatever order they were tapped in.
  const toggle = (key: keyof Picks, order: string[]) => (item: string) => setPicks(current => {
    const next = current[key].includes(item) ? current[key].filter(entry => entry !== item) : [...current[key], item];
    return { ...current, [key]: order.filter(entry => next.includes(entry)) };
  });
  const picked = { ...picks, conditions: picks.conditions.filter(item => conditions.includes(item)) };
  const blank = <span className="pt-template-blank">…</span>;
  const title = titleOf(draft);
  const years = yearsOf(draft.years);
  return (
    <div className="pt-template" role="group" aria-labelledby="pf-template">
      <p className="cl-label" id="pf-template">Start from a template · tap one or more in each gap</p>
      <p className="pt-template-text">
        I'm {/^[aeiou]/i.test(title) ? "an" : "a"} <span className="pt-template-filled">{title}</span>
        {years && <> with <span className="pt-template-filled">{years}</span> experience</>}
        {conditions.length > 0 && <>, specialising in {picked.conditions.length ? <span className="pt-template-filled">{listText(picked.conditions.map(inSentence))}</span> : blank}</>}.
        {" "}I help {picked.who.length ? <span className="pt-template-filled">{listText(picked.who)}</span> : blank} with {picked.focus.length ? <span className="pt-template-filled">{listText(picked.focus)}</span> : blank}.
      </p>
      <Gap label="Specialising in" choices={conditions} chosen={picked.conditions} onToggle={toggle("conditions", conditions)} empty="Add the conditions you work with below, then choose them here." />
      <Gap label="I help" choices={WHO} chosen={picked.who} onToggle={toggle("who", WHO)} />
      <Gap label="With" choices={FOCUS} chosen={picked.focus} onToggle={toggle("focus", FOCUS)} />
      <button type="button" className="cl-btn is-light" disabled={!picked.focus.length} onClick={() => onUse(aboutFromTemplate(draft, picked))}>{draft.about.trim() ? "Replace my text with this" : "Use this text"}</button>
    </div>
  );
}

/**
 * Pricing: your current price, Rehyn's share of it, the urgent fee, and
 * a request to change your price. A new price only takes effect once Rehyn's administrator approves it.
 */
function PricingCard({ me }: { me: Clinician }) {
  const request = usePriceRequests().find(item => item.clinicianId === me.id);
  const waiting = request?.status === "waiting" ? request : undefined;
  const [asking, setAsking] = useState(false);
  const [price, setPrice] = useState(me.price);
  const [reason, setReason] = useState("");
  const inRange = price >= PRICE_MIN && price <= PRICE_MAX;
  const allowed = price >= PRICE_REQUEST_MIN && price <= PRICE_REQUEST_MAX && price !== me.price;
  const send = () => { if (!allowed) return; requestPriceChange(me, price, reason); setAsking(false); setReason(""); };
  const urgent = urgentPrice(me);
  return (
    <section className="pt-card" aria-labelledby="pf-price">
      <h2 className="cl-h2" id="pf-price">Pricing</h2>
      <div className="pt-price-now">
        <p><span className="cl-label">A 30-minute consultation</span><strong>{poundsText(me.price)}</strong></p>
        {!waiting && !asking && <button type="button" className="cl-btn is-light" onClick={() => { setAsking(true); setPrice(me.price); }}>Request a price change</button>}
      </div>
      <ul className="pt-price-lines">
        <li>Rehyn takes {shareText(REHYN_SHARE)} of each booking, so you're paid {poundsText(clinicianShare(me.price))} for every {poundsText(me.price)} consultation.</li>
        <li>Urgent bookings cost patients £{URGENT_FEE} extra ({poundsText(urgent)} in total). You're paid {poundsText(clinicianShare(urgent))} for these.</li>
      </ul>

      {waiting ? (
        <div className="pt-price-request is-waiting" role="status">
          <p><strong>Waiting for approval: {poundsText(waiting.to)}</strong> Requested {new Date(waiting.at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}. Your price stays {poundsText(me.price)} until Rehyn's administrator approves it.</p>
          <button type="button" className="cl-btn is-light" onClick={() => cancelPriceRequest(me.id)}>Withdraw request</button>
        </div>
      ) : asking ? (
        <div className="pt-price-request">
          <label className="cl-field pt-price-field"><span className="cl-label">New price for 30 minutes</span>
            <span className="pt-price-input"><strong aria-hidden="true">£</strong><input type="number" min={PRICE_REQUEST_MIN} max={PRICE_REQUEST_MAX} value={price} onChange={event => setPrice(Number(event.target.value) || 0)} aria-label="New price in pounds" /></span></label>
          {price > 0 && <p className="cl-small">You would receive {poundsText(clinicianShare(price))} of each consultation.{!inRange && price >= PRICE_REQUEST_MIN && price <= PRICE_REQUEST_MAX ? ` This is outside the usual £${PRICE_MIN} to £${PRICE_MAX}, so say why below.` : ""}</p>}
          {(price < PRICE_REQUEST_MIN || price > PRICE_REQUEST_MAX) && <p className="cl-small pt-price-warn" role="status">A price can be from £{PRICE_REQUEST_MIN} to £{PRICE_REQUEST_MAX}.</p>}
          <label className="cl-field"><span className="cl-label">Reason for the change {inRange ? "(optional)" : ""}</span>
            <textarea className="pt-textarea" rows={2} maxLength={300} value={reason} placeholder="For example: more years of experience, or a new qualification." onChange={event => setReason(event.target.value)} /></label>
          <div className="pt-price-actions">
            <button type="button" className="cl-request" disabled={!allowed || (!inRange && !reason.trim())} onClick={send}>Send request for approval</button>
            <button type="button" className="cl-btn is-light" onClick={() => { setAsking(false); setPrice(me.price); }}>Cancel</button>
          </div>
        </div>
      ) : request?.status === "approved" ? <p className="cl-sent" role="status"><strong>Approved.</strong> Your price is now {poundsText(request.to)}.</p>
        : request?.status === "declined" ? <p className="cl-notice" role="status">Your request for {poundsText(request.to)} wasn't approved. Your price stays {poundsText(me.price)}.</p>
        : null}    </section>
  );
}

export default function PortalProfile({ me }: { me: Clinician }) {
  const [draft, setDraft] = useState<Clinician>(me);
  const [languages, setLanguages] = useState<string[]>(me.languages);
  const [otherLanguage, setOtherLanguage] = useState("");
  const languageMenu = useRef<HTMLDetailsElement>(null);
  // The languages menu closes when you click or tap anywhere outside it.
  useEffect(() => {
    const close = (event: PointerEvent) => { const menu = languageMenu.current; if (menu?.open && !menu.contains(event.target as Node)) menu.open = false; };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, []);
  const languageChoices = [...LANGUAGES, ...languages.filter(item => !LANGUAGES.includes(item))];
  const toggleLanguage = (language: string) => { setLanguages(current => (current.includes(language) ? current.filter(item => item !== language) : [...current, language])); setSaved(false); };
  const addOtherLanguage = () => {
    const language = otherLanguage.trim().replace(/^./, letter => letter.toUpperCase()).slice(0, 40);
    if (language && !languages.some(item => item.toLowerCase() === language.toLowerCase())) { setLanguages(current => [...current, language]); setSaved(false); }
    setOtherLanguage("");
  };
  const [sectionId, setSectionId] = useState(groupPlace(me.conditions[0]?.[0] ?? "")?.section.id ?? librarySections[0].id);
  const section = librarySections.find(item => item.id === sectionId) ?? librarySections[0];
  const [groupId, setGroupId] = useState(section.groups[0]?.id ?? "");
  const group = section.groups.find(item => item.id === groupId) ?? section.groups[0];
  const [saved, setSaved] = useState(false);
  const set = (patch: Partial<Clinician>) => { setDraft(current => ({ ...current, ...patch })); setSaved(false); };
  const preview: Clinician = {
    ...draft,
    languages: languageChoices.filter(item => languages.includes(item)),
    initials: draft.name.replace(/^Dr\.? /i, "").split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]!.toUpperCase()).join("") || draft.initials,
  };
  const has = (g: string, c: string) => draft.conditions.some(([gid, cid]) => gid === g && cid === c);
  const toggleCondition = (g: string, c: string) => set({ conditions: has(g, c) ? draft.conditions.filter(([gid, cid]) => !(gid === g && cid === c)) : [...draft.conditions, [g, c]] });
  // Only the profile's own fields: hours, alerts and listing are changed elsewhere and kept as they are.
  const save = () => {
    const name = preview.name.trim() || me.name;
    updateClinician(me.id, {
      name, first: name.replace(/^Dr\.? /i, "").split(/\s+/)[0] || me.first, initials: preview.initials, role: preview.role.trim() || me.role,
      level: preview.level, years: preview.years, about: preview.about.trim(), languages: preview.languages.length ? preview.languages : me.languages,
      conditions: preview.conditions,
    });
    setSaved(true);
  };
  const gaps = profileGaps(preview);

  return (
    <div className="pt-page">
      <div className="pt-head">
        <div>
          <p className="cl-kicker">What patients see</p>
          <h1 className="cl-h1" data-page-heading>Profile &amp; pricing</h1>
        </div>
        <div className="pt-head-actions">
          <button type="button" className="cl-request" onClick={save}>Save changes</button>
        </div>
      </div>
      {saved && <p className="cl-sent" role="status"><strong>Saved.</strong> Your profile is updated in the directory on this device. A change of price is a request, below.</p>}
      {!me.own && <p className="cl-preview">Preview: {me.name} is an example clinician. Changes you make are kept on this device only.</p>}

      <div className="pt-cols">
        <div className="pt-stack pt-wide">
          <section className="pt-card" aria-labelledby="pf-about">
            <h2 className="cl-h2" id="pf-about">About you</h2>
            <div className="pt-fields">
              <label className="cl-field"><span className="cl-label">Name patients see</span><input className="cl-text" value={draft.name} maxLength={80} onChange={event => set({ name: event.target.value })} /></label>
              <label className="cl-field"><span className="cl-label">Your role</span><input className="cl-text" value={draft.role} maxLength={80} onChange={event => set({ role: event.target.value })} /></label>
              <label className="cl-field"><span className="cl-label">Level</span>
                <select className="cl-text" value={draft.level} onChange={event => set({ level: event.target.value })}>{LEVELS.map(level => <option key={level}>{level}</option>)}</select></label>
              <label className="cl-field"><span className="cl-label">Years of experience</span><input className="cl-text" type="number" min={0} max={60} value={draft.years} onChange={event => set({ years: Math.max(0, Number(event.target.value) || 0) })} /></label>
            </div>
            <div className={`pt-register ${me.own && !me.verified ? "is-pending" : ""}`}>
              <ShieldCheck size={22} aria-hidden="true" />
              <span><strong>{registerText(me)}</strong>{me.own ? ` · ${REGISTER[me.type]} number ${me.registration || "not given"}. We check it before patients beyond this device can book you, and again every month.` : " · checked by Rehyn."}</span>
            </div>
            <AboutTemplate draft={draft} onUse={about => set({ about })} />
            <label className="cl-field"><span className="cl-label">About you, in plain words</span>
              <textarea className="pt-textarea" rows={4} value={draft.about} maxLength={600} placeholder="Who you look after, and what a first consultation with you is like. Start from the template above, or write your own." onChange={event => set({ about: event.target.value })} /></label>
            <div className="cl-field">
              <span className="cl-label" id="pf-languages">Languages you can consult in</span>
              <details className="pt-multi" ref={languageMenu} onKeyDown={event => { if (event.key === "Escape" && languageMenu.current?.open) { languageMenu.current.open = false; languageMenu.current.querySelector("summary")?.focus(); } }}>
                <summary aria-labelledby="pf-languages pf-languages-chosen"><span id="pf-languages-chosen">{preview.languages.length ? preview.languages.join(", ") : "Choose languages"}</span><ChevronDown size={18} aria-hidden="true" /></summary>
                <div className="pt-multi-menu">
                  <div className="pt-multi-list" role="group" aria-labelledby="pf-languages">
                    {languageChoices.map(language => (
                      <label key={language} className="cl-check"><input type="checkbox" checked={languages.includes(language)} onChange={() => toggleLanguage(language)} />{language}</label>
                    ))}
                  </div>
                  <span className="pt-other-language">
                    <input className="cl-text" value={otherLanguage} maxLength={40} placeholder="Another language" aria-label="Another language" onChange={event => setOtherLanguage(event.target.value)} onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); addOtherLanguage(); } }} />
                    <button type="button" className="cl-btn is-light" disabled={!otherLanguage.trim()} onClick={addOtherLanguage}>Add</button>
                  </span>
                </div>
              </details>
            </div>
          </section>

          <section className="pt-card" aria-labelledby="pf-cond">
            <h2 className="cl-h2" id="pf-cond">Conditions you work with</h2>
            <p className="cl-small">From the Library, so patients reading about a condition can find you.</p>
            {draft.conditions.length > 0 && (
              <div className="cl-chips">
                {draft.conditions.map(([g, c]) => {
                  const place = groupPlace(g);
                  const condition = place?.group.conditions.find(item => item.id === c);
                  if (!place || !condition) return null;
                  return <button key={`${g}/${c}`} type="button" className="cl-chip is-link pt-chip-remove" onClick={() => toggleCondition(g, c)} aria-label={`Remove ${condition.title}`}>{condition.title}<X size={14} aria-hidden="true" /></button>;
                })}
              </div>
            )}
            <div className="cl-form-row">
              <label className="cl-field"><span className="cl-label">Library section</span>
                <select className="cl-text" value={section.id} onChange={event => { setSectionId(event.target.value); setGroupId(librarySections.find(item => item.id === event.target.value)?.groups[0]?.id ?? ""); }}>
                  {librarySections.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}
                </select></label>
              <label className="cl-field"><span className="cl-label">Group</span>
                <select className="cl-text" value={group?.id} onChange={event => setGroupId(event.target.value)}>
                  {section.groups.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}
                </select></label>
            </div>
            {group && (
              <div className="pt-pick">
                {group.conditions.map(condition => (
                  <button key={condition.id} type="button" aria-pressed={has(group.id, condition.id)} onClick={() => toggleCondition(group.id, condition.id)}>{condition.title}</button>
                ))}
              </div>
            )}
          </section>

          <PricingCard me={me} />
        </div>

        <aside className="pt-stack" aria-label="How patients see you">
          <p className="cl-label">How patients see you</p>
          <ClinicianCard clinician={preview} now={new Date()} preview />
          {gaps.length > 0 && <p className="cl-notice">Still to add: {gaps.join(", ")}.</p>}
          <div className="pt-card is-dark">
            <strong>{draft.listed === false ? "Your listing is paused" : "Listed in the directory"}</strong>
            <p className="cl-small">{draft.listed === false ? "Patients can't find or book you, and you won't get urgent alerts. Consultations already booked stay booked." : "Patients find you by the conditions you work with. Pause any time; booked consultations stay booked."}</p>
            <button type="button" className="cl-btn is-light" onClick={() => { const listed = draft.listed === false; set({ listed }); updateClinician(me.id, { listed }); }}>{draft.listed === false ? "List me again" : "Pause my listing"}</button>
          </div>
        </aside>
      </div>
    </div>
  );
}
