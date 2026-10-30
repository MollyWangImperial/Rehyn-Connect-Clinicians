import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { Link, useSearch } from "wouter";
import { conditions, defaultInvites, GROUP_NAME_LIMIT, groupHellos, inviteFriends, people, startThemes, type ConditionId, type GroupVisibility, type PersonId, type StartThemeId } from "@/content/community-samples";
import { communityHref, communityStore, communityViewFromQuery, isBlocked, listNames, useCommunity, type CommunityMemory, type StartedGroup } from "@/lib/community-store";
import { conditionOf, coverForTheme, homeCondition } from "./group-model";
import { ConditionIcon, PrivacyPill } from "./Groups";
import { ArrowIcon, BellIcon, CheckIcon, EyeIcon, GlobeIcon, LockIcon, ShieldIcon, ThemeIcon, UsersIcon } from "./icons";
import { Cover, Face, MyFace } from "./parts";

const helloLabels = ["Welcome everyone", "Ask for introductions", "Ask about current work"];
const nameOf = (who: PersonId) => people[who].name;
/** Blocked people are out of sight in My community, so they are never offered, ticked or shown here. */
const unblocked = (memory: CommunityMemory, list: PersonId[]) => list.filter(who => !isBlocked(memory, who));
// The clinician edition has no games (comment 7): no games theme, switch or game table, and new groups start without games.
const kinds = startThemes.filter(theme => theme.id !== "games");
const firstTheme = kinds[0];
const colleagues = (count: number) => `${count} ${count === 1 ? "colleague" : "colleagues"}`;

/**
 * Start a professional group inside a condition network, in five steps: which condition, what kind of group, a name, who
 * can see it (private to begin with) and which colleagues to invite.
 */
export default function StartGroupView(_props: { name: string }) {
  const memory = useCommunity();
  const asked = communityViewFromQuery(useSearch()).cond ?? null;
  const [cond, setCond] = useState<ConditionId>(asked ?? homeCondition(memory));
  const [theme, setTheme] = useState<StartThemeId>(firstTheme.id);
  const [groupName, setGroupName] = useState(firstTheme.names[0]);
  const [visibility, setVisibility] = useState<GroupVisibility>("private");
  const [chosen, setChosen] = useState<PersonId[]>(defaultInvites);
  const pickable = unblocked(memory, inviteFriends);
  // Someone blocked since they were ticked drops out of the group too.
  const friends = unblocked(memory, chosen);
  const [createdId, setCreatedId] = useState<string | null>(null);
  const createdHeading = useRef<HTMLHeadingElement>(null);
  const firstChoice = useRef<HTMLInputElement>(null);
  const condField = useId();
  const themeField = useId();
  const nameId = useId();
  const seeField = useId();

  useEffect(() => { if (asked) setCond(asked); }, [asked]);

  const look = kinds.find(item => item.id === theme) ?? firstTheme;
  const shownName = groupName.trim() === "" ? "Your group" : groupName.trim();
  const created: StartedGroup | null = createdId ? memory.started.find(group => group.id === createdId) ?? null : null;

  useEffect(() => { if (createdId && !created) setCreatedId(null); }, [createdId, created]);

  const pickTheme = (next: StartThemeId) => {
    // A name typed by hand is kept. One of the old kind's suggestions follows the new kind.
    if (groupName.trim() === "" || look.names.includes(groupName)) setGroupName(kinds.find(item => item.id === next)?.names[0] ?? groupName);
    setTheme(next);
  };
  const toggleFriend = (who: PersonId) => setChosen(list => (list.includes(who) ? list.filter(other => other !== who) : inviteFriends.filter(other => other === who || list.includes(other))));
  const start = (event: FormEvent) => {
    event.preventDefault();
    const group = communityStore.startGroup({ name: shownName, theme, friends, visibility, conditionId: cond, games: false });
    setCreatedId(group.id);
    window.requestAnimationFrame(() => createdHeading.current?.focus());
  };
  const startAnother = () => {
    setCreatedId(null);
    setTheme(firstTheme.id);
    setGroupName(firstTheme.names[0]);
    setChosen(defaultInvites);
    setVisibility("private");
    window.requestAnimationFrame(() => firstChoice.current?.focus());
  };

  // What the preview and "What happens next" show: the new group once it is made, else the form.
  const where = conditionOf(created?.conditionId ?? cond);
  const isPrivate = (created?.visibility ?? visibility) === "private";
  const coming = created ? unblocked(memory, created.friends) : friends;
  const going = coming.map(nameOf);
  const memberLine = coming.length === 0 ? "Just you for now" : `You and ${colleagues(coming.length)}`;
  const doneLine = `${isPrivate ? `It is private: only ${going.length ? listNames(going) : "colleagues you invite"} can find it. ` : `Clinicians in the ${where.name} network can now find it and join. `}It sits inside ${where.name}.`;
  const next = [
    { icon: <BellIcon size={16} />, key: "invite", text: going.length ? `${listNames(going)} ${going.length === 1 ? "gets" : "get"} an invitation in Messages.` : "Invite colleagues now or later from the group." },
    { icon: <EyeIcon size={16} />, key: "see", text: isPrivate ? `Only members can see it. It never shows up in search or in ${where.name}.` : `It shows up inside ${where.name} for clinicians to find and join.` },
    { icon: <UsersIcon size={16} />, key: "network", text: `Members see the ${where.name} network's relevant expertise: ${where.expertise}.` },
  ];

  return (
    <div className="cm-start">
      <div className="cm-start-main">
        {!created ? (
          <form className="cm-card cm-start-form" onSubmit={start}>
            <fieldset className="cm-step">
              <legend className="cm-step-title"><span className="cm-step-num" aria-hidden="true">1</span><span>Which condition network is it in?</span></legend>
              <div className="cm-cond-picks">
                {conditions.map((item, index) => (
                  <label key={item.id} className={`cm-cond-pick ${cond === item.id ? "is-on" : ""}`}>
                    <input ref={index === 0 ? firstChoice : undefined} className="cm-sr" type="radio" name={condField} value={item.id} checked={cond === item.id} onChange={() => setCond(item.id)} />
                    <ConditionIcon id={item.id} size={16} />
                    <span>{item.name}</span>
                  </label>
                ))}
              </div>
            </fieldset>

            <fieldset className="cm-step">
              <legend className="cm-step-title"><span className="cm-step-num" aria-hidden="true">2</span><span>What kind of group is it?</span></legend>
              <div className="cm-themes">
                {kinds.map(item => (
                  <label key={item.id} className={`cm-theme ${theme === item.id ? "is-on" : ""}`}>
                    <input className="cm-sr" type="radio" name={themeField} value={item.id} checked={theme === item.id} onChange={() => pickTheme(item.id)} />
                    {item.id !== "games" && <ThemeIcon theme={item.id} size={20} />}
                    <span>{item.label}</span>
                  </label>
                ))}
              </div>
            </fieldset>

            <div className="cm-step">
              <div className="cm-step-title"><span className="cm-step-num" aria-hidden="true">3</span><label htmlFor={nameId}>Give it a name</label></div>
              <input id={nameId} className="cm-name-input" type="text" value={groupName} maxLength={GROUP_NAME_LIMIT} autoComplete="off" onChange={event => setGroupName(event.target.value)} />
              <div className="cm-name-ideas" role="group" aria-label="Name ideas">
                <span>Suggestions:</span>
                {look.names.map(idea => (
                  <button key={idea} type="button" className={`cm-name-idea ${groupName === idea ? "is-on" : ""}`} aria-pressed={groupName === idea} onClick={() => setGroupName(idea)}>{idea}</button>
                ))}
              </div>
            </div>

            <fieldset className="cm-step">
              <legend className="cm-step-title"><span className="cm-step-num" aria-hidden="true">4</span><span>Who can see it?</span></legend>
              <div className="cm-see-picks">
                <label className={`cm-see-pick ${visibility === "private" ? "is-on" : ""}`}>
                  <input className="cm-sr" type="radio" name={seeField} checked={visibility === "private"} onChange={() => setVisibility("private")} />
                  <span className="cm-see-icon is-private"><LockIcon size={18} /></span>
                  <span className="cm-see-text">
                    <b>Private <span className="cm-default-badge">Default</span></b>
                    <span>Hidden from everyone else. Only colleagues you invite can find and read it.</span>
                  </span>
                </label>
                <label className={`cm-see-pick ${visibility === "public" ? "is-on" : ""}`}>
                  <input className="cm-sr" type="radio" name={seeField} checked={visibility === "public"} onChange={() => setVisibility("public")} />
                  <span className="cm-see-icon is-public"><GlobeIcon size={18} /></span>
                  <span className="cm-see-text">
                    <b>Public</b>
                    <span>{`Any clinician in the ${conditionOf(cond).name} network can find it and join. Suits wider professional discussion.`}</span>
                  </span>
                </label>
              </div>
            </fieldset>

            <fieldset className="cm-step">
              <legend className="cm-step-title"><span className="cm-step-num" aria-hidden="true">5</span><span>Invite colleagues</span><span className="cm-step-aside">From your connections</span></legend>
              <div className="cm-friend-picks">
                {pickable.map(who => {
                  const on = friends.includes(who);
                  return (
                    <label key={who} className={`cm-friend-pick ${on ? "is-on" : ""}`}>
                      <input className="cm-sr" type="checkbox" checked={on} onChange={() => toggleFriend(who)} />
                      <span className="cm-friend-face"><Face who={who} size={44} /><span className="cm-friend-check" aria-hidden="true"><CheckIcon size={11} /></span></span>
                      <span className="cm-friend-words"><b>{nameOf(who)}</b><span>{people[who].title}</span></span>
                    </label>
                  );
                })}
              </div>
            </fieldset>

            <button type="submit" className="cx-btn cx-btn-primary cm-start-button">{`Create ${shownName}`} <ArrowIcon size={18} strokeWidth={2} /></button>
          </form>
        ) : (
          <section className="cm-card cm-created" aria-labelledby="cm-created-title">
            <span className={`cm-created-icon ${isPrivate ? "is-private" : "is-public"}`} aria-hidden="true">{isPrivate ? <LockIcon size={26} /> : <GlobeIcon size={26} />}</span>
            <h2 id="cm-created-title" ref={createdHeading} tabIndex={-1}><span>{created.name}</span> has been created</h2>
            <p className="cm-created-line">{doneLine}</p>
            <div className="cm-created-actions">
              <Link className="cx-btn cx-btn-primary" href={communityHref("groups", created.id)}>Go to the group <ArrowIcon size={18} strokeWidth={2} /></Link>
              <button type="button" className="cx-btn" onClick={startAnother}>Start another</button>
            </div>
            <p className="cm-created-hello-title">Post a first message</p>
            <div className="cm-hello-choices">
              {groupHellos.map((hello, index) => (
                <button key={hello} type="button" className="cm-quick cm-quick-chip" aria-pressed={created.hello === hello} onClick={() => communityStore.setGroupHello(created.id, hello)}>{helloLabels[index] ?? hello}</button>
              ))}
            </div>
            {created.hello && (
              <div key={created.hello} className="cm-hello-sent">
                <p className="cm-hello-bubble">{created.hello}</p>
              </div>
            )}
          </section>
        )}
      </div>

      <aside className="cm-start-side" aria-labelledby="cm-preview-title">
        <h2 className="cm-preview-title" id="cm-preview-title">Preview</h2>
        <div className="cm-preview-card">
          <div className="cm-preview-cover-wrap">
            <Cover cover={coverForTheme(created?.theme ?? theme)} className="cm-preview-cover" iconSize={36} />
            <span className="cm-preview-in"><ConditionIcon id={where.id} size={14} />{`In ${where.name}`}</span>
          </div>
          <div className="cm-preview-body">
            <div>
              <p className="cm-preview-name">{created?.name ?? shownName}</p>
              <p className="cm-preview-meta"><PrivacyPill visibility={isPrivate ? "private" : "public"} /><span>{`${look.label} · started by you`}</span></p>
            </div>
            <div className="cm-preview-members">
              <span className="cm-face-stack" aria-hidden="true">
                <MyFace size={30} />
                {coming.map(who => <Face key={who} who={who} size={30} />)}
              </span>
              <span>{memberLine}</span>
            </div>
          </div>
        </div>
        <section className="cm-card cm-next-card" aria-labelledby="cm-next-title">
          <h3 className="cm-side-title" id="cm-next-title">What happens next</h3>
          <ul>
            {next.map(item => <li key={item.key}><span className="cm-next-icon" aria-hidden="true">{item.icon}</span><span>{item.text}</span></li>)}
          </ul>
        </section>
        <p className="cm-preview-safe"><ShieldIcon size={18} /><span>You can switch between private and public, add or remove colleagues, or close the group at any time.</span></p>
      </aside>
    </div>
  );
}
