import { useId, useRef, useState, type FormEvent } from "react";
import { pictureWords } from "@/content/community-pictures";
import { communityStore, LIMITS, useCommunity } from "@/lib/community-store";
import { profileInitial, profileName, profileStore, useProfile } from "@/lib/profile";
import { CameraIcon } from "./icons";
import { MyFace } from "./parts";

type Draft = { name: string; town: string; about: string };
const tidy = (value: string) => value.replace(/\s+/g, " ").trim();

/**
 * "Your profile", at the top of Community settings and the one place the profile is edited: the person's picture
 * with Change picture (which opens "Choose your picture"), then the name people see, their town and a few words
 * about them, kept together with Save changes. The name and the town are the person's Rehyn profile, so the rest
 * of the app uses them too; the words are for My community only. Your privacy and Blocked sit under it.
 */
export default function ProfileCard({ onChangePicture, onSaved }: { onChangePicture?: (opener: HTMLElement) => void; onSaved: (kept: boolean) => void }) {
  const profile = useProfile();
  const settings = useCommunity().settings;
  const stored: Draft = { name: profileName(profile), town: profile.city, about: settings.about };
  // Null until the person changes something; then the form keeps their words until they save or cancel.
  const [draft, setDraft] = useState<Draft | null>(null);
  const shown = draft ?? stored;
  const [problem, setProblem] = useState("");
  const titleId = useId();
  const nameId = useId();
  const nameHintId = useId();
  const townId = useId();
  const townHintId = useId();
  const aboutId = useId();
  const aboutHintId = useId();
  const problemId = useId();
  const nameField = useRef<HTMLInputElement>(null);

  const edit = (key: keyof Draft, value: string) => { setDraft({ ...shown, [key]: value }); setProblem(""); };
  const cancel = () => { setDraft(null); setProblem(""); };
  const save = (event: FormEvent) => {
    event.preventDefault();
    if (!draft) { onSaved(true); return; }
    const name = tidy(draft.name);
    if (!name) { setProblem("Write the name you'd like people to see."); nameField.current?.focus(); return; }
    if (!profileStore.save({ ...profile, preferredName: name === profile.name ? "" : name, city: tidy(draft.town) })) {
      setProblem("Your name and town couldn't be saved in this browser. Your words are still here to try again.");
      return;
    }
    communityStore.updateSettings({ about: draft.about });
    setDraft(null);
    onSaved(communityStore.lastSaveKept());
  };

  return (
    <section className="cm-card cm-pic-profile" aria-labelledby={titleId}>
      {/* A link to the section ("View your profile") puts the focus here. */}
      <h3 className="cm-pic-profile-title" id={titleId} tabIndex={-1} data-set-heading>Your profile</h3>
      <div className="cm-pic-profile-body">
        <div className="cm-pic-picture">
          <span className="cm-pic-avatar"><MyFace size={160} /></span>
          <p className="cm-sr">{`${pictureWords(settings.picture, settings.look, profileInitial(profile), !!profile.photo)}.`}</p>
          <button type="button" className="cm-btn cm-btn-green cm-pic-change" aria-haspopup="dialog" onClick={event => onChangePicture?.(event.currentTarget)}>
            <CameraIcon size={22} />Change picture
          </button>
          <p className="cm-pic-picture-hint">Your picture on your posts, in groups and in messages.</p>
        </div>

        <form className="cm-pic-form" onSubmit={save} noValidate>
          <div className="cm-pic-field">
            <label htmlFor={nameId}>Display name</label>
            <input
              ref={nameField}
              id={nameId}
              type="text"
              value={shown.name}
              maxLength={80}
              autoComplete="nickname"
              aria-invalid={problem && !tidy(shown.name) ? true : undefined}
              aria-describedby={[nameHintId, problem ? problemId : ""].filter(Boolean).join(" ")}
              onChange={event => edit("name", event.target.value)}
            />
            <p className="cm-pic-field-hint" id={nameHintId}>The name you go by. Alira uses it too.</p>
          </div>
          <div className="cm-pic-field">
            <label htmlFor={townId}>Town</label>
            <input id={townId} type="text" value={shown.town} maxLength={80} autoComplete="address-level2" aria-describedby={townHintId} onChange={event => edit("town", event.target.value)} />
            <p className="cm-pic-field-hint" id={townHintId}>{settings.showTown ? "On your card, under your name." : "Hidden from your card while Show my town is off."}</p>
          </div>
          <div className="cm-pic-field">
            <label htmlFor={aboutId}>About</label>
            <textarea id={aboutId} value={shown.about} maxLength={LIMITS.about} rows={3} placeholder="A few words about you: what you enjoy, or what you're proud of." aria-describedby={aboutHintId} onChange={event => edit("about", event.target.value)} />
            <p className="cm-pic-field-hint" id={aboutHintId}>On your card, for My community only.</p>
          </div>
          {problem && <p className="cm-problem" id={problemId} role="alert">{problem}</p>}
          <div className="cm-pic-actions">
            <button type="button" className="cm-btn cm-btn-quiet cm-pic-button" onClick={cancel}>Cancel</button>
            <button type="submit" className="cm-btn cm-btn-green cm-pic-button">Save changes</button>
          </div>
        </form>
      </div>
    </section>
  );
}
