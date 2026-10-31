import { useEffect, useId, useState, type ReactNode } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { conditions, groupQuickReplies, inviteFriends, people, startConditions, suggestedGroups, type ConditionId, type GroupMessage, type GroupVisibility, type PersonId, type JoinableGroupId } from "@/content/community-samples";
import { canSee, communityHref, communityStore, communityViewFromQuery, inCondition, isBlocked, listNames, useCommunity, type NoteDraft, type OwnNote } from "@/lib/community-store";
import { conditionOf, homeCondition, lastLine, myGroups, visibleSubgroupCount, visibleSubgroups, type GroupModel, type SubgroupCard } from "./group-model";
import { usePinnedToEnd } from "./hooks";
import { CheckIcon, ChevronDownIcon, ClockIcon, GlobeIcon, LockIcon, NextIcon, PlusIcon, PulseIcon, UsersIcon } from "./icons";
import { ChatInput, Cover, Face, LiveDot, MyFace, MyMessage, toneClass, TypingRow } from "./parts";

// Groups for clinicians (comments 14 and 22): medical condition networks, each with the professional groups inside it.
// Games are not part of the clinician edition (comment 7): nothing here surfaces them, and a `&game=` address is ignored.

const nameOf = (who: PersonId) => people[who].name;

/* --------------------------------------------------------------- small parts */

const conditionPaths: Record<ConditionId, ReactNode> = {
  stroke: <path d="M3 12h4l2.5-6 4 12 2.5-6h5" />,
  parkinsons: <path d="M7 11V6a1.5 1.5 0 0 1 3 0v4m0-5.5a1.5 1.5 0 0 1 3 0V10m0-4a1.5 1.5 0 0 1 3 0v5m0-2.5a1.5 1.5 0 0 1 3 0V14a7 7 0 0 1-7 7h-1a6 6 0 0 1-5-2.7L3.6 14a1.5 1.5 0 0 1 2.5-1.6L7 13.5" />,
  ms: <><path d="M12 3v18M4.2 7.5l15.6 9M19.8 7.5l-15.6 9" /><circle cx="12" cy="12" r="2.2" /></>,
  brain: <><path d="M9.5 3a3 3 0 0 0-3 3 3 3 0 0 0-2 5 3 3 0 0 0 2 5 3 3 0 0 0 3 3 2.5 2.5 0 0 0 2.5-2.5V5.5A2.5 2.5 0 0 0 9.5 3z" /><path d="M14.5 3a3 3 0 0 1 3 3 3 3 0 0 1 2 5 3 3 0 0 1-2 5 3 3 0 0 1-3 3 2.5 2.5 0 0 1-2.5-2.5V5.5A2.5 2.5 0 0 1 14.5 3z" /></>,
  spine: <><rect x="8.5" y="2.5" width="7" height="4.2" rx="1.6" /><rect x="8.5" y="9.9" width="7" height="4.2" rx="1.6" /><rect x="8.5" y="17.3" width="7" height="4.2" rx="1.6" /><path d="M12 6.7v3.2M12 14.1v3.2" /></>,
  joint: <><path d="M8 2.5v8a4 4 0 0 0 8 0v-8" /><path d="M10 21.5v-5.5M14 21.5v-5.5" /><circle cx="12" cy="11" r="1.4" /></>,
};

/** The sign for each condition, drawn in the current ink. */
export function ConditionIcon({ id, size = 22 }: { id: ConditionId; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{conditionPaths[id]}</svg>;
}

/** "Private" with a lock, or "Public" with a globe. */
export function PrivacyPill({ visibility, className = "" }: { visibility: GroupVisibility; className?: string }) {
  return visibility === "private"
    ? <span className={`cm-privacy-pill is-private ${className}`}><LockIcon size={13} strokeWidth={2.2} />Private</span>
    : <span className={`cm-privacy-pill is-public ${className}`}><GlobeIcon size={13} strokeWidth={2} />Public</span>;
}

/** "Member", in the accent: the one colour that marks membership. */
const MemberTag = ({ label = "Member" }: { label?: string }) => <span className="cm-member-tag"><CheckIcon size={12} strokeWidth={2.4} />{label}</span>;

/** "This month: share one audit" becomes "Share one audit", under a plain "This month" label. */
const focusWords = (text: string) => { const words = text.replace(/^This (?:week|month):\s*/i, ""); return words.charAt(0).toUpperCase() + words.slice(1); };

const groupCount = (count: number) => `${count} ${count === 1 ? "group" : "groups"}`;

/* --------------------------------------------------------- groups by condition */

type Filter = "all" | "mine" | "public";
const FILTERS: { id: Filter; label: string }[] = [{ id: "all", label: "All" }, { id: "mine", label: "Your groups" }, { id: "public", label: "Public" }];

/** One professional group's card inside a condition: what it is for, who is in it, and where the clinician stands. */
function GroupCard({ group, onToggle }: { group: SubgroupCard; onToggle: (group: SubgroupCard) => void }) {
  const soon = group.activity.kind === "soon";
  return (
    <li className={`cm-sub-card ${group.member ? "is-member" : ""}`}>
      <div className="cm-sub-top">
        <Cover cover={group.cover} className="cm-sub-cover" iconSize={26} />
        <div className="cm-sub-text">
          <b>{group.name}</b>
          <span className="cm-sub-tags"><PrivacyPill visibility={group.visibility} />{group.member && <MemberTag />}</span>
        </div>
      </div>
      <p className="cm-sub-about">{group.about}</p>
      <span className="cm-sub-members">
        <span className="cm-face-stack" aria-hidden="true">{group.faces.slice(0, 3).map(who => <Face key={who} who={who} size={22} />)}</span>
        {`${group.members} clinicians`}
      </span>
      <div className="cm-sub-foot">
        <span className={`cm-sub-act is-${group.activity.kind}`}>
          {soon ? <ClockIcon size={14} strokeWidth={2} /> : <PulseIcon size={14} strokeWidth={2} />}
          <span>{group.activity.text}</span>
        </span>
        <span className="cm-sub-buttons">
          {group.member && !group.own && <button type="button" className="cm-sub-leave" onClick={() => onToggle(group)}>Leave<span className="cm-sr">{` ${group.name}`}</span></button>}
          {group.member
            ? <Link className="cm-sub-open" href={communityHref("groups", group.id)}>Open<span className="cm-sr">{` ${group.name}`}</span></Link>
            : <button type="button" className="cm-sub-join" onClick={() => onToggle(group)}>Join<span className="cm-sr">{` ${group.name}`}</span></button>}
        </span>
      </div>
    </li>
  );
}

/**
 * The Groups tab: the condition networks, then the professional groups inside the one chosen, with its purpose and the
 * expertise found there. Private groups show only to the clinicians in them; everyone else never sees them here.
 */
function ConditionGroups({ chosen }: { chosen: ConditionId | null }) {
  const memory = useCommunity();
  const cond = conditionOf(chosen ?? homeCondition(memory));
  const member = inCondition(memory, cond.id);
  const [filter, setFilter] = useState<Filter>("all");
  const [status, setStatus] = useState("");
  useEffect(() => { setFilter("all"); }, [cond.id]);

  const all = visibleSubgroups(memory, cond.id);
  const shown = all.filter(group => (filter === "mine" ? group.member : filter === "public" ? group.visibility === "public" : true));
  const yours = myGroups(memory);
  const toggle = (group: SubgroupCard) => {
    communityStore.toggleJoined(group.id as JoinableGroupId);
    setStatus(group.member ? `You left ${group.name}.` : `You joined ${group.name}. It is now in Your groups.`);
  };
  const toggleNetwork = () => {
    communityStore.toggleCondition(cond.id);
    setStatus(member ? `You left the ${cond.name} network.` : `You joined the ${cond.name} network.`);
  };

  return (
    <div className="cm-conds">
      <div className="cm-conds-head">
        <h2 className="cm-conds-title" tabIndex={-1} data-view-heading>Explore Clinical Communities</h2>
        <p className="cm-conds-intro">Join communities of healthcare professionals working across shared clinical interests, specialties, and conditions.</p>
      </div>

      <nav className="cm-cond-tiles" aria-label="Conditions">
        {conditions.map(item => {
          const on = item.id === cond.id;
          const inIt = inCondition(memory, item.id);
          return (
            <Link key={item.id} className={`cm-cond-tile ${on ? "is-on" : ""} ${inIt ? "is-member" : ""}`} href={communityHref("groups", null, { cond: item.id })} replace aria-current={on ? "true" : undefined}>
              <span className="cm-cond-tile-top">
                <span className="cm-cond-icon"><ConditionIcon id={item.id} size={20} /></span>
                {inIt && <span className="cm-cond-in"><CheckIcon size={12} strokeWidth={2.4} />Member</span>}
              </span>
              <span className="cm-cond-name"><b>{item.name}</b><span>{item.members}</span><span>{groupCount(visibleSubgroupCount(memory, item.id))}</span></span>
            </Link>
          );
        })}
      </nav>

      <div className="cm-conds-body">
        <section className="cm-card cm-inside" aria-labelledby="cm-inside-title">
          <div className="cm-network">
            <div className="cm-network-text">
              <h3 className="cm-inside-title" id="cm-inside-title">{cond.name}</h3>
              <p className="cm-network-purpose">{cond.purpose}</p>
            </div>
            <div className="cm-network-state">
              {member ? (
                <>
                  <MemberTag label={`Member of the ${cond.name} network`} />
                  {!startConditions.includes(cond.id) && <button type="button" className="cm-text-button" onClick={toggleNetwork}>Leave network<span className="cm-sr">{` ${cond.name}`}</span></button>}
                </>
              ) : (
                <>
                  <p>Join the network to start groups here. Public groups can also be joined on their own.</p>
                  <button type="button" className="cx-btn cx-btn-primary" onClick={toggleNetwork}>{`Join ${cond.name} network`}</button>
                </>
              )}
            </div>
          </div>

          <div className="cm-inside-head">
            <h4 className="cm-inside-sub">{`Groups in ${cond.name}`}</h4>
            <div className="cm-segments cm-inside-filter" role="group" aria-label="Show">
              {FILTERS.map(item => <button key={item.id} type="button" className="cm-segment" aria-pressed={filter === item.id} onClick={() => setFilter(item.id)}>{item.label}</button>)}
            </div>
          </div>

          {shown.length > 0 ? (
            <ul className="cm-sub-grid">
              {shown.map(group => <GroupCard key={group.id} group={group} onToggle={toggle} />)}
            </ul>
          ) : (
            <div className="cm-sub-empty">
              <span className="cm-sub-empty-icon"><UsersIcon size={24} /></span>
              <p className="cm-sub-empty-title">{filter === "mine" ? `You are not in any ${cond.name} groups yet` : "No groups to show"}</p>
              <p>Join one of the public groups, or start a group for your service or specialty.</p>
              <Link className="cx-btn cx-btn-primary" href={communityHref("start", null, { cond: cond.id })}><PlusIcon size={16} />Start a group</Link>
            </div>
          )}
          <p className="cm-sr" role="status">{status}</p>
        </section>

        <div className="cm-conds-after">
          <section className="cm-card cm-side-card cm-your-groups" aria-labelledby="cm-your-groups-title">
            <h3 className="cm-side-title" id="cm-your-groups-title">Your groups</h3>
            <ul>
              {yours.map(group => (
                <li key={group.id}>
                  <Link className="cm-your-group" href={communityHref("groups", group.id)}>
                    <Cover cover={group.cover} className="cm-cover-thumb" />
                    <span className="cm-group-text">
                      <b>{group.name}{group.visibility === "private" && <span className="cm-lock" aria-label="Private"><LockIcon size={13} strokeWidth={2.2} /></span>}</b>
                      <span>{`${conditionOf(group.conditionId).name} · ${group.meta}`}</span>
                    </span>
                    <NextIcon size={16} />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
          <section className="cm-card cm-start-small" aria-labelledby="cm-start-small-title">
            <p className="cm-overline">{`In ${cond.name}`}</p>
            <h3 id="cm-start-small-title">Start a group</h3>
            <p>Set up a case discussion, journal club or service improvement group. It is private to start with, and you can open it to the network later.</p>
            <Link className="cx-btn cx-btn-primary cm-start-go" href={communityHref("start", null, { cond: cond.id })}><PlusIcon size={16} />Start a group</Link>
          </section>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------- the group page */

type LogLine =
  | { kind: "theirs"; at: number; message: GroupMessage }
  | { kind: "mine"; at: number; note: OwnNote }
  | { kind: "hello"; at: number; text: string }
  | { kind: "event"; at: number; text: string };

/** A colleague's message: their name and role, then what they said. No hearts or counts in the clinician edition. */
function ColleagueMessage({ message }: { message: GroupMessage }) {
  const person = people[message.who];
  return (
    <li className="cm-msg cm-msg-in">
      <Face who={message.who} size={36} />
      <div className="cm-msg-body">
        <p className="cm-msg-name">{person.name}{person.title && <span>{` · ${person.title}`}</span>}</p>
        <div className={`cm-bubble ${message.photo ? "has-photo" : ""}`}>
          {message.photo && <img src={message.photo.src} alt={message.photo.alt} style={{ backgroundColor: message.photo.tint }} loading="lazy" />}
          <p>{message.text}</p>
        </div>
      </div>
    </li>
  );
}

/**
 * "Invite colleagues": the example connections who could be invited (never anyone blocked). Nothing is sent anywhere.
 */
function InvitePanel({ group, id, invited, onToggle }: { group: GroupModel; id: string; invited: PersonId[]; onToggle: (who: PersonId) => void }) {
  const memory = useCommunity();
  const candidates = (group.kind === "started" ? inviteFriends : inviteFriends.filter(who => !group.faces.includes(who))).filter(who => !isBlocked(memory, who));
  return (
    <div className="cm-invite-panel" id={id}>
      <p className="cm-invite-note">These are example connections, so nothing is sent.</p>
      {candidates.length ? (
        <ul>
          {candidates.map(who => {
            const on = invited.includes(who);
            return (
              <li key={who}>
                <Face who={who} size={32} />
                <span className="cm-group-text"><b className="cm-invite-name">{nameOf(who)}</b><span>{people[who].title}</span></span>
                <button type="button" className={`cm-remind ${on ? "is-on" : ""}`} onClick={() => onToggle(who)}>
                  {on ? "Invited" : "Invite"}<span className="cm-sr">{` ${nameOf(who)}`}</span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : <p className="cm-invite-note">All your connections here are already in this group.</p>}
    </div>
  );
}

/**
 * A group's page: a clinical expertise network. Switch groups, clear unread badges, see the month's focus and who is in
 * it, and discuss. Messages from people the clinician has blocked or hidden are left out.
 */
function GroupPage({ active, requested }: { active: boolean; requested: string }) {
  const memory = useCommunity();
  const shown = (who: PersonId) => canSee(memory, who);
  // Blocked people are out of sight: not in the face stacks, the invites or the names.
  const inSight = (who: PersonId) => !isBlocked(memory, who);
  const [, navigate] = useLocation();
  const groups = myGroups(memory);
  const selected = groups.find(group => group.id === requested) ?? groups.find(group => group.id === "garden") ?? groups[0];
  const cond = conditionOf(selected.conditionId);
  const [delivered, setDelivered] = useState<Record<string, number>>({});
  const [typing, setTyping] = useState<{ group: string; who: PersonId } | null>(null);
  const [invites, setInvites] = useState<Record<string, PersonId[]>>({});
  const [inviting, setInviting] = useState(false);
  const [closing, setClosing] = useState(false);
  const [sentNote, setSentNote] = useState("");
  const panelId = useId();

  const own = memory.messages[selected.id] ?? [];
  const deliveredAt = delivered[selected.id];
  const log: LogLine[] = [
    ...(selected.event ? [{ kind: "event" as const, at: -1, text: selected.event }] : []),
    ...selected.messages.filter(message => shown(message.who)).map(message => ({ kind: "theirs" as const, at: 0, message })),
    ...(selected.started?.hello ? [{ kind: "hello" as const, at: selected.started.createdAt, text: selected.started.hello }] : []),
    ...own.map(note => ({ kind: "mine" as const, at: note.createdAt, note })),
    ...(deliveredAt !== undefined && selected.incoming && shown(selected.incoming.who) ? [{ kind: "theirs" as const, at: deliveredAt, message: selected.incoming }] : []),
  ].sort((a, b) => a.at - b.at);
  const writing = typing && typing.group === selected.id && shown(typing.who) ? typing.who : null;
  const { box, onScroll } = usePinnedToEnd<HTMLDivElement>(`${selected.id}:${log.length}:${writing ?? ""}`, active);

  // Opening a group clears its unread badge.
  useEffect(() => { if (active && selected.unread > 0) communityStore.markRead(selected.id); }, [active, selected.id, selected.unread]);
  useEffect(() => { setInviting(false); setClosing(false); }, [selected.id]);
  // While a group is open, one more message arrives: first "is writing", then the message.
  useEffect(() => {
    const incoming = selected.incoming;
    if (!active || !incoming || delivered[selected.id] !== undefined) return;
    const timer = window.setTimeout(() => {
      if (typing?.group !== selected.id) setTyping({ group: selected.id, who: incoming.who });
      else { setTyping(null); setDelivered(list => ({ ...list, [selected.id]: Date.now() })); }
    }, 2400);
    return () => window.clearTimeout(timer);
  }, [active, selected.id, selected.incoming, typing, delivered]);

  const send = (draft: NoteDraft) => {
    const note = communityStore.addMessage(selected.id, draft);
    if (note) setSentNote(`Sent: ${note.text || "your photo"}`);
  };
  const started = selected.started;
  const invited = (started ? started.friends : invites[selected.id] ?? []).filter(inSight);
  const toggleInvite = (who: PersonId) => {
    if (started) communityStore.toggleGroupFriend(started.id, who);
    else setInvites(list => {
      const current = list[selected.id] ?? [];
      return { ...list, [selected.id]: current.includes(who) ? current.filter(other => other !== who) : [...current, who] };
    });
  };
  const close = () => {
    if (!started) return;
    communityStore.closeGroup(started.id);
    navigate(communityHref("groups"), { replace: true });
  };
  // A group joined here can be left from its page; the clinician's own networks and the groups they started stay.
  const leave = () => {
    if (selected.kind !== "joined") return;
    communityStore.toggleJoined(selected.id as JoinableGroupId);
    navigate(communityHref("groups", null, { cond: cond.id }), { replace: true });
  };
  const colleagues = selected.faces.filter(inSight);

  const inCond = groups.filter(group => group.conditionId === cond.id).sort((a, b) => Number(b.visibility === "private") - Number(a.visibility === "private"));
  const others = conditions.filter(item => item.id !== cond.id);
  const side = (
    <div className="cm-side">
      <section className="cm-card cm-side-card cm-group-list" aria-labelledby="cm-group-list-title">
        <Link className="cm-cond-chip" href={communityHref("groups", null, { cond: cond.id })}><ConditionIcon id={cond.id} size={14} />{`${cond.name} network`}<ChevronDownIcon size={14} /></Link>
        <h3 className="cm-side-title" id="cm-group-list-title">Your groups</h3>
        <Link className="cm-everyone" href={communityHref("groups", null, { cond: cond.id })}>
          <span className="cm-everyone-icon"><ConditionIcon id={cond.id} size={18} /></span>
          <span className="cm-group-text"><b>{`All ${cond.name} groups`}</b><span>{`${cond.members} · condition network`}</span></span>
        </Link>
        <ul className="cm-nested">
          {inCond.map(group => {
            const on = group.id === selected.id;
            const unread = on ? 0 : group.unread;
            const soon = group.activity.kind === "soon";
            return (
              <li key={group.id}>
                <Link className={`cm-group-pick ${on ? "is-on" : ""}`} href={communityHref("groups", group.id)} aria-current={on ? "page" : undefined}>
                  <span className="cm-cover-wrap">
                    <Cover cover={group.cover} className="cm-cover-thumb" />
                    {group.active && <span className="cm-cover-live" aria-hidden="true" />}
                  </span>
                  <span className="cm-group-text">
                    <b>{group.name}{group.visibility === "private" && <span className="cm-lock" aria-label="Private"><LockIcon size={13} strokeWidth={2.2} /></span>}</b>
                    <span>{soon ? group.activity.text : lastLine(group, memory, delivered[group.id] ?? null, nameOf, shown)}</span>
                  </span>
                  {unread > 0 && <span className="cm-badge"><span aria-hidden="true">{unread}</span><span className="cm-sr">{`, ${unread} unread`}</span></span>}
                </Link>
              </li>
            );
          })}
        </ul>
        <Link className="cm-start-link" href={communityHref("start", null, { cond: cond.id })}><PlusIcon size={16} /><span>{`Start a group in ${cond.name}`}</span></Link>
      </section>

      <section className="cm-card cm-side-card cm-other-conds" aria-labelledby="cm-other-title">
        <h3 className="cm-overline" id="cm-other-title">Other conditions</h3>
        <ul>
          {others.slice(0, 3).map(item => (
            <li key={item.id}>
              <Link className="cm-other-cond" href={communityHref("groups", null, { cond: item.id })}>
                <ConditionIcon id={item.id} size={18} />
                <span>{item.name}</span>
                {inCondition(memory, item.id) && <MemberTag />}
                <NextIcon size={16} />
              </Link>
            </li>
          ))}
        </ul>
        <Link className="cm-see-all" href={communityHref("groups", null, { cond: cond.id })}>See all conditions</Link>
      </section>

      <section className="cm-card cm-side-card" aria-labelledby="cm-suggest-title">
        <h3 className="cm-overline" id="cm-suggest-title">Suggested groups</h3>
        <ul className="cm-suggestions">
          {suggestedGroups.filter(group => group.visibility === "public").map(group => {
            const on = (memory.joined as string[]).includes(group.id);
            return (
              <li key={group.id}>
                <Cover cover={group.cover} className="cm-cover-thumb" />
                <span className="cm-group-text">
                  <b>{group.name}</b>
                  {on ? <Link className="cm-inline-link" href={communityHref("groups", group.id)}>Open group</Link> : <span>{group.why}</span>}
                </span>
                <button type="button" className={`cm-join ${on ? "is-on" : ""}`} aria-pressed={on} onClick={() => communityStore.toggleJoined(group.id as JoinableGroupId)}>
                  {on ? "Joined" : "Join"}<span className="cm-sr">{on ? ` ${group.name}, press to leave` : ` ${group.name}`}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );

  return (
    <div className="cm-layout cm-groups">
      {side}
      <section className="cm-card cm-chat cm-group" aria-labelledby="cm-group-title">
        <header className="cm-group-head">
          <Cover cover={selected.cover} className="cm-group-tile" iconSize={28} />
          <div className="cm-group-titles">
            <p className="cm-overline cm-group-cond"><ConditionIcon id={cond.id} size={14} />{`${cond.name} · professional group`}</p>
            <h2 id="cm-group-title" tabIndex={-1} data-view-heading>{selected.name}</h2>
            <p className="cm-group-meta">
              <PrivacyPill visibility={selected.visibility} />
              <span>{selected.meta}</span>
              {selected.online > 0 && <><LiveDot tone="green" className="cm-meta-dot" /><span className="cm-online">{selected.online} online</span></>}
            </p>
          </div>
          <span className="cm-group-actions">
            <button type="button" className={`cm-invite ${!started && invited.length ? "is-on" : ""}`} aria-expanded={inviting} aria-controls={inviting ? panelId : undefined} onClick={() => setInviting(!inviting)}>
              {!started && invited.length ? `${invited.length} invited` : "Invite colleagues"}
            </button>
            <span className="cm-joined-pill"><CheckIcon size={14} strokeWidth={2.4} />{started ? "Started by you" : "Member"}</span>
            {selected.kind === "joined" && <button type="button" className="cm-text-button" onClick={leave}>Leave group<span className="cm-sr">{` ${selected.name}`}</span></button>}
          </span>
        </header>
        <p className="cm-group-about">{selected.about}</p>
        <dl className="cm-group-facts">
          <div><dt>Relevant expertise</dt><dd>{cond.expertise}</dd></div>
          <div><dt>This month</dt><dd>{focusWords(selected.challenge.text)}</dd></div>
        </dl>
        {(colleagues.length > 0 || started) && (
          <div className="cm-group-people">
            <p className="cm-overline">In this group</p>
            <ul>
              {started && <li className="cm-group-person"><MyFace size={30} /><span className="cm-group-text"><b>You</b><span>Started this group</span></span></li>}
              {colleagues.slice(0, 4).map(who => (
                <li key={who}>
                  <Link className="cm-group-person" href={`/clinicians/${people[who].clinicianId}`}>
                    <Face who={who} size={30} />
                    <span className="cm-group-text"><b>{nameOf(who)}</b><span>{people[who].title}</span></span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
        {inviting && <InvitePanel group={selected} id={panelId} invited={invited} onToggle={toggleInvite} />}
        {started && (
          <div className="cm-started-bar">
            {closing ? (
              <span className="cm-confirm" role="group" aria-label={`Close ${started.name}?`}>
                <span>{`Close ${started.name}? It will be removed from this device.`}</span>
                <button type="button" className="cx-btn cm-btn-danger" onClick={close}>Close it</button>
                <button type="button" className="cx-btn cx-btn-quiet" onClick={() => setClosing(false)}>Keep it</button>
              </span>
            ) : (
              <>
                <span>{invited.length ? `You started this group with ${listNames(invited.map(nameOf))}.` : "You started this group."}</span>
                <span className="cm-started-tools">
                  <button type="button" className="cm-text-button" onClick={() => communityStore.setGroupVisibility(started.id, started.visibility === "private" ? "public" : "private")}>
                    {started.visibility === "private" ? "Make it public" : "Make it private"}<span className="cm-sr">{started.visibility === "private" ? `. Anyone in ${cond.name} could find it` : ". Only people you invite could find it"}</span>
                  </button>
                  <button type="button" className="cm-text-button" onClick={() => setClosing(true)}>Close group</button>
                </span>
              </>
            )}
          </div>
        )}
        <div className="cm-chat-log" ref={box} onScroll={onScroll} role="log" aria-live="off" aria-label={`Messages in ${selected.name}`} tabIndex={0}>
          <div className="cm-chat-fade" aria-hidden="true" />
          <ol className="cm-messages">
            {log.length > 0 && <li className="cm-today" aria-hidden="true"><span>Today</span></li>}
            {log.length === 0 && <li className="cm-log-note">No messages yet. Start the discussion.</li>}
            {log.map((line, index) => line.kind === "event"
              ? <li key={`event-${index}`} className="cm-event"><ClockIcon size={14} strokeWidth={2} /><span>{line.text}</span></li>
              : line.kind === "theirs"
                ? <ColleagueMessage key={line.message.id} message={line.message} />
                : line.kind === "hello"
                  ? <MyMessage key="hello" note={{ text: line.text, photo: null, voice: false }} onRemove={() => started && communityStore.setGroupHello(started.id, null)} />
                  : <MyMessage key={line.note.id} note={line.note} onRemove={() => communityStore.removeMessage(selected.id, line.note.id)} />)}
          </ol>
          {writing && <TypingRow who={writing} />}
        </div>
        <div className="cm-chat-foot">
          <div className="cm-quick-row" role="group" aria-label="Quick replies">
            {groupQuickReplies.map(reply => <button key={reply.label} type="button" className={`cm-quick ${toneClass(reply.tone)}`} onClick={() => send({ text: reply.text })}>{reply.label}</button>)}
          </div>
          <ChatInput label="Message the group" placeholder="Message the group" onSend={send} allowPhoto sendText="Send" />
          <p className="cm-sr" role="status">{sentNote}</p>
        </div>
      </section>
    </div>
  );
}

/**
 * The Groups tab. With no group named it shows the groups by condition (`&cond=` picks the condition); with one, that
 * group's page. A `&game=` address from the patient edition is ignored: the clinician edition has no games.
 */
export default function GroupsView({ active, requested }: { active: boolean; requested: string | null }) {
  const view = communityViewFromQuery(useSearch());
  if (!requested) return <ConditionGroups chosen={view.cond ?? null} />;
  return <GroupPage active={active} requested={requested} />;
}
