import { useId, useRef, useState, type FormEvent, type MouseEvent } from "react";
import { Link, useLocation } from "wouter";
import { ArrowLeft, Check, Stethoscope, UserRound } from "lucide-react";
import { CLINICIAN_TYPES, REGISTER, findClinician, professionalTitle, type ClinicianType } from "@/content/clinicians";
import { joinAsClinician, setRole, useRole, type Role } from "@/lib/clinician-portal";
import { setPortalClinician } from "@/lib/consultations";
import { DEMO_CLINICIAN_ID } from "@/lib/me";
import "@/components/join-role.css";
import { useSettings, type SettingsView } from "@/components/AccountSettings";
import HeartRateMark from "@/components/HeartRateMark";
import { ageOn, agreedTo, consentStore, HEALTH_CONSENT_TEXT, MIN_AGE, useConsents } from "@/lib/consent";
import { fastCheckPath } from "@/lib/fast-check";
import { profileName, profileStore, useProfile } from "@/lib/profile";
import "@/components/consent.css";

type Box = "terms" | "privacy" | "health";

/** One thing to agree to: its name, the words ticked, and a way to read the document first. */
function ConsentBox({ title, text, note, checked, onChange, read, problem }: {
  title: string; text: string; note?: string; checked: boolean; onChange: (on: boolean) => void;
  read: { label: string; open: (event: MouseEvent<HTMLButtonElement>) => void }; problem: boolean;
}) {
  const id = useId();
  return (
    <div className={`join-box ${checked ? "is-on" : ""} ${problem ? "is-missing" : ""}`}>
      <h2 className="join-box-title">{title}</h2>
      <div className="join-box-row">
        <input id={id} type="checkbox" checked={checked} onChange={event => onChange(event.target.checked)} aria-invalid={problem || undefined} />
        <label htmlFor={id}>{text}</label>
      </div>
      {note && <p className="join-box-note">{note}</p>}
      <button type="button" className="consent-link" onClick={read.open}>{read.label}</button>
    </div>
  );
}

/** How a clinician joins: with their own details, or by exploring the preview as the demo clinician. */
type JoinWay = "own" | "demo";

/** The first step in Rehyn Connect for clinicians (the patient edition asks patient or clinician here instead). */
function ChooseWay({ choose }: { choose: (way: JoinWay) => void }) {
  const demo = findClinician(DEMO_CLINICIAN_ID);
  return (
    <main className="join-page">
      <div className="join-card">
        <p className="join-brand"><span className="join-brand-mark"><HeartRateMark size={22} /></span><span>Rehyn<em>: Connect</em> <small className="join-edition">for clinicians</small></span></p>
        <h1 className="join-title">Join Rehyn: <em className="join-connect">Connect</em> for clinicians</h1>
        <p className="join-lede">A professional network for clinicians: connect with colleagues, join condition groups, share to the Library and run your consultations and group sessions with patients.</p>
        <div className="join-roles" role="group" aria-label="How would you like to join?">
          <button type="button" className="join-role is-clinician" onClick={() => choose("own")}>
            <span className="join-role-icon" aria-hidden="true"><Stethoscope size={26} /></span>
            <span className="join-role-text"><strong>Join with your own details</strong>Your name, profession and registration number. Rehyn checks your registration.</span>
          </button>
          {demo && (
            <button type="button" className="join-role" onClick={() => choose("demo")}>
              <span className="join-role-icon" aria-hidden="true"><UserRound size={26} /></span>
              <span className="join-role-text"><strong>{`Explore with the demo profile: ${demo.name}`}</strong>{`${professionalTitle(demo)}. An example clinician with groups, patients and sessions, to see how everything works.`}</span>
            </button>
          )}
        </div>
        <p className="join-safety">Rehyn is not an emergency service. If you think someone is having a stroke, call 999. <Link href={fastCheckPath("/")}>See the warning signs</Link></p>
      </div>
    </main>
  );
}

/**
 * Joining Rehyn: Connect (and coming back after withdrawing a consent). Someone new first says whether they are a
 * patient (or carer) or a clinician; a clinician also gives their profession, role and registration number, which
 * starts their profile in the clinician portal. Then the name other members see and three separate agreements: the
 * Terms of Use, the Privacy Notice and the health information consent (the same documents for both, for now). Nothing
 * else opens until all three are ticked. The documents open in Settings to read first.
 */
export default function Join({ startAs }: { startAs?: Role } = {}) {
  const openSettings = useSettings();
  const profile = useProfile();
  const consents = useConsents();
  const agreed = agreedTo(consents);
  const [, navigate] = useLocation();
  const savedRole = useRole();
  // Back here only when a document has a new version (withdrawing the health consent keeps the account; it just stops sharing).
  const returning = consents.terms !== null;
  // Everyone joining this edition is a clinician; the only choice is their own details or the demo profile.
  const [way, setWay] = useState<JoinWay | null>(returning ? "own" : null);
  const as: Role = startAs ?? savedRole ?? "clinician";
  const demo = way === "demo";
  const demoClinician = findClinician(DEMO_CLINICIAN_ID);
  const clinician = as === "clinician" && !demo;
  const [profession, setProfession] = useState<ClinicianType | "">("");
  const [jobTitle, setJobTitle] = useState("");
  const [registration, setRegistration] = useState("");
  const professionId = useId();
  const jobId = useId();
  const registrationId = useId();
  const [name, setName] = useState(() => (returning ? profileName(profile) : ""));
  const typedName = demo ? demoClinician?.name ?? "" : name;
  const [born, setBorn] = useState(consents.dateOfBirth ?? "");
  const [ticked, setTicked] = useState<Record<Box, boolean>>({ terms: agreed.terms, privacy: agreed.privacy, health: agreed.health });
  const [tried, setTried] = useState(false);
  const problemBox = useRef<HTMLDivElement>(null);
  const nameId = useId();
  const bornId = useId();
  const age = ageOn(born || null);
  const tooYoung = age !== null && age < MIN_AGE;

  const missing = [
    !typedName.trim() && "your name",
    age === null && "your date of birth",
    clinician && !profession && "your profession",
    clinician && !registration.trim() && "your registration number",
    !ticked.terms && "the Terms of Use",
    !ticked.privacy && "the Privacy Notice",
    !ticked.health && "the health information consent",
  ].filter((item): item is string => Boolean(item));
  const listed = missing.length > 1 ? `${missing.slice(0, -1).join(", ")} and ${missing[missing.length - 1]}` : missing[0];
  const tick = (box: Box) => (on: boolean) => setTicked(current => ({ ...current, [box]: on }));
  const read = (view: SettingsView, label: string, focus?: string) => ({ label, open: (event: MouseEvent<HTMLButtonElement>) => openSettings(event.currentTarget, view, focus) });

  const join = (event: FormEvent) => {
    event.preventDefault();
    if (missing.length) {
      setTried(true);
      requestAnimationFrame(() => problemBox.current?.focus());
      return;
    }
    if (tooYoung) { setTried(true); requestAnimationFrame(() => problemBox.current?.focus()); return; }
    const typed = typedName.trim();
    if (typed !== profileName(profile)) profileStore.save({ ...profile, name: typed, preferredName: "" });
    if (clinician && !returning && profession) joinAsClinician({ name: typed, role: jobTitle, type: profession, registration });
    else if (!returning) { setRole("clinician"); setPortalClinician(demo ? DEMO_CLINICIAN_ID : null); }
    consentStore.register(born, ticked.health);
    // A new clinician starts in their portal, to finish their profile and set their hours; the demo profile starts in the feed.
    if (clinician && !returning) navigate("/clinicians/portal");
    else if (demo) navigate("/community");
  };

  if (!way) return <ChooseWay choose={setWay} />;

  return (
    <main className="join-page">
      <div className="join-card">
        <p className="join-brand"><span className="join-brand-mark"><HeartRateMark size={22} /></span><span>Rehyn<em>: Connect</em></span></p>
        {!returning && <button type="button" className="join-role-back" onClick={() => setWay(null)}><ArrowLeft size={16} aria-hidden="true" />{demo ? "Exploring with the demo profile" : "Joining with your own details"} · change</button>}
        <h1 className="join-title">{returning ? "Welcome back" : demo ? <>Explore as <em className="join-connect">{demoClinician?.name}</em></> : <>Join as a <em className="join-connect">clinician</em></>}</h1>
        <p className="join-lede">{returning
          ? "The Terms of Use or the Privacy Notice have changed since you agreed to them. Please look at these again: all three are needed to use Rehyn: Connect."
          : demo
            ? "You'll see Rehyn Connect for clinicians as this example clinician: their network, groups, consultations and weekly sessions. Everything you do stays on this device."
            : "Connect with colleagues, meet patients by video and host group sessions. We check your registration before patients can book you."}</p>

        {tried && (missing.length > 0 || tooYoung) && (
          <div ref={problemBox} className="join-problem" role="alert" tabIndex={-1}>{tooYoung ? `Rehyn Connect is for people aged ${MIN_AGE} or over, so we can't create an account for you.` : `To join, please add ${listed}.`}</div>
        )}

        <form className="join-form" onSubmit={join} noValidate>
          {!demo && <div className={`join-field ${tried && !name.trim() ? "is-missing" : ""}`}>
            <label htmlFor={nameId}>{clinician ? "Your name" : "Your first name"}</label>
            <p className="join-hint" id={`${nameId}-hint`}>As colleagues and patients will see it, with Dr if you use it.</p>
            <input id={nameId} value={name} onChange={event => setName(event.target.value)} autoComplete={clinician ? "name" : "given-name"} maxLength={80} aria-describedby={`${nameId}-hint`} aria-invalid={(tried && !name.trim()) || undefined} />
          </div>}
          {clinician && !returning && <>
            <div className={`join-field ${tried && !profession ? "is-missing" : ""}`}>
              <label htmlFor={professionId}>Your profession</label>
              <select id={professionId} className="join-select" value={profession} onChange={event => setProfession(event.target.value as ClinicianType)} aria-invalid={(tried && !profession) || undefined}>
                <option value="">Choose…</option>
                {CLINICIAN_TYPES.map(type => <option key={type.id} value={type.id}>{type.label}</option>)}
              </select>
            </div>
            <div className="join-field">
              <label htmlFor={jobId}>Your role</label>
              <p className="join-hint" id={`${jobId}-hint`}>For example: Consultant stroke physician, or Neurological physiotherapist.</p>
              <input id={jobId} value={jobTitle} onChange={event => setJobTitle(event.target.value)} maxLength={80} autoComplete="organization-title" aria-describedby={`${jobId}-hint`} />
            </div>
            <div className={`join-field ${tried && !registration.trim() ? "is-missing" : ""}`}>
              <label htmlFor={registrationId}>{profession ? `Your ${REGISTER[profession]} registration number` : "Your registration number"}</label>
              <p className="join-hint" id={`${registrationId}-hint`}>Doctors are on the GMC register, nurses on the NMC, and therapists, psychologists and dietitians on the HCPC. Rehyn checks it before patients can book you.</p>
              <input id={registrationId} value={registration} onChange={event => setRegistration(event.target.value)} maxLength={20} aria-describedby={`${registrationId}-hint`} aria-invalid={(tried && !registration.trim()) || undefined} />
            </div>
          </>}
          <div className={`join-field ${tried && (age === null || tooYoung) ? "is-missing" : ""}`}>
            <label htmlFor={bornId}>Your date of birth</label>
            <p className="join-hint" id={`${bornId}-hint`}>{`Rehyn Connect is for people aged ${MIN_AGE} or over. Under 18s get extra protections. Your date of birth is never shown to anyone.`}</p>
            <input id={bornId} type="date" value={born} onChange={event => setBorn(event.target.value)} autoComplete="bday" max={new Date().toISOString().slice(0, 10)} aria-describedby={`${bornId}-hint`} aria-invalid={(tried && (age === null || tooYoung)) || undefined} />
          </div>

          <fieldset className="join-consents">
            <legend>Please read and agree to all three</legend>
            <ConsentBox title="Terms of Use" text="I have read and agree to the Terms of Use." note="Version 2.0. Section 6 has the Community Rules."
              checked={ticked.terms} onChange={tick("terms")} read={read("terms", "Read the Terms of Use")} problem={tried && !ticked.terms} />
            <ConsentBox title="Privacy Notice" text="I have read the Privacy Notice, which explains how Rehyn Ltd uses my information."
              checked={ticked.privacy} onChange={tick("privacy")} read={read("privacy", "Read the Privacy Notice")} problem={tried && !ticked.privacy} />
            <ConsentBox title="Health information consent" text={HEALTH_CONSENT_TEXT}
              checked={ticked.health} onChange={tick("health")} read={read("privacy", "How we use your information", "4.")} problem={tried && !ticked.health} />
          </fieldset>

          <button type="submit" className={`join-submit ${missing.length ? "is-waiting" : ""}`} aria-disabled={missing.length > 0}>
            {!missing.length && <Check size={18} aria-hidden="true" />}{demo ? "Explore the demo" : clinician && !returning ? "Join as a clinician" : "Continue"}
          </button>
          <p className="join-safety">Rehyn is not an emergency service. If you think someone is having a stroke, call 999. <Link href={fastCheckPath("/")}>See the warning signs</Link></p>
        </form>
      </div>
    </main>
  );
}
