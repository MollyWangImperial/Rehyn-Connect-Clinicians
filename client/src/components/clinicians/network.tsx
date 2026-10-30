import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { Building2, Check, Clock, MessageSquare, UserPlus } from "lucide-react";
import { clinicianGroups, professionalTitle, type Clinician, type GroupPlace } from "@/content/clinicians";
import { incomingRequests, people, personOfClinician, sampleGroups, type IncomingRequestId, type PersonId } from "@/content/community-samples";
import { canSee, communityStore, friendList, friendsHref, messagesHref, relationship, useCommunity, type CommunityMemory, type Relationship } from "@/lib/community-store";
import type { Me } from "@/lib/me";

// Rehyn Connect for clinicians: the directory as a professional network (browser comment 11). A colleague's connection
// state is My Network's own (lib/community-store.ts): Connect sends the same invitation My Network lists under Sent,
// Accept answers the same invitation it lists under Invitations, so the directory, the profiles and My Network always
// agree. The people are the example clinicians (content/community-samples.ts maps each to a directory clinician); a
// clinician made on this device has no place in that example network, so they can't be connected in the preview.

/** Where a clinician stands with the signed-in clinician: themselves, outside the example network, or My Network's state. */
export type Connection = "me" | "unavailable" | Relationship;

export function connectionOf(memory: CommunityMemory, clinician: Clinician, me: Pick<Me, "clinician">): { status: Connection; who: PersonId | undefined } {
  if (clinician.id === me.clinician.id) return { status: "me", who: personOfClinician(clinician.id) };
  const who = personOfClinician(clinician.id);
  return who ? { status: relationship(memory, who), who } : { status: "unavailable", who: undefined };
}

/** The directory's connection filter, in the words My Network uses. */
export type ConnectionFilter = "all" | "connected" | "pending" | "invited" | "none";
export const CONNECTION_FILTERS: { id: ConnectionFilter; label: string }[] = [
  { id: "all", label: "Everyone" },
  { id: "connected", label: "Connected" },
  { id: "pending", label: "Pending" },
  { id: "invited", label: "Invited you" },
  { id: "none", label: "Not connected" },
];
export function matchesConnection(status: Connection, filter: ConnectionFilter) {
  if (filter === "all") return true;
  if (filter === "connected") return status === "friend";
  if (filter === "pending") return status === "sent";
  if (filter === "invited") return status === "incoming";
  return status === "none" || status === "unavailable";
}

/** The signed-in clinician's connections, never themselves. */
export const myConnections = (memory: CommunityMemory, me: Pick<Me, "personId">) => friendList(memory).map(entry => entry.who).filter(who => who !== me.personId);

/**
 * Connections the signed-in clinician shares with someone: their connections in a group with that person (as Messages
 * counts them), and those an invitation names (as My Network's Invitations do).
 */
export function mutualOf(memory: CommunityMemory, who: PersonId, me: Pick<Me, "personId">): PersonId[] {
  const theirGroups = sampleGroups.filter(group => group.faces.includes(who));
  const named = incomingRequests.find(request => request.who === who)?.mutual ?? [];
  const inGroups = myConnections(memory, me).filter(other => canSee(memory, other) && theirGroups.some(group => group.faces.includes(other)));
  const list = [...inGroups, ...named.filter(id => relationship(memory, id) === "friend")];
  return list.filter((id, index) => id !== who && id !== me.personId && list.indexOf(id) === index);
}

/** "Hannah Brooks is a mutual connection", "Hannah Brooks and 2 other mutual connections". */
export function mutualText(mutual: PersonId[]) {
  if (mutual.length === 0) return "";
  const first = people[mutual[0]].name;
  if (mutual.length === 1) return `${first} is a mutual connection`;
  if (mutual.length === 2) return `${first} and ${people[mutual[1]].name} are mutual connections`;
  return `${first} and ${mutual.length - 1} other mutual connections`;
}

/** The Library groups two clinicians both work in. */
export const sharedGroups = (clinician: Clinician, other: Clinician): GroupPlace[] => {
  const theirs = clinicianGroups(other).map(place => place.group.id);
  return clinicianGroups(clinician).filter(place => theirs.includes(place.group.id));
};

/** "Royal Lambeth Hospital · London". */
export const workplaceText = (clinician: Clinician) => [clinician.org, clinician.place].filter(Boolean).join(" · ");

/** A clinician's portrait, or their initials when there is none. Decorative: their name is always beside it. */
export function Avatar({ clinician, size = 56 }: { clinician: Clinician; size?: number }) {
  if (clinician.photo) return <img className="cx-avatar cn-avatar" src={clinician.photo} alt="" width={size} height={size} loading="lazy" style={{ width: size, height: size }} />;
  return <span className="cx-avatar cn-avatar" aria-hidden="true" style={{ width: size, height: size, fontSize: Math.round(size * 0.34) }}>{clinician.initials}</span>;
}

/** Small faces for mutual connections. */
export function Faces({ who }: { who: PersonId[] }) {
  return <span className="cn-faces" aria-hidden="true">{who.slice(0, 3).map(id => <img key={id} src={people[id].face} alt="" width={22} height={22} loading="lazy" />)}</span>;
}

/**
 * Connect, and what it becomes: Pending (with Withdraw), Accept or Ignore for an invitation, Connected (with Message).
 * `primary`: the main action is a filled button (a profile's top card) rather than an outlined one (a row in a list).
 */
export function ConnectControls({ clinician, me, primary = false }: { clinician: Clinician; me: Pick<Me, "clinician">; primary?: boolean }) {
  const memory = useCommunity();
  const { status, who } = connectionOf(memory, clinician, me);
  const [said, setSaid] = useState("");
  const box = useRef<HTMLDivElement>(null);
  const moved = useRef(false);
  // The control pressed is replaced by the next state's, so the focus moves on to that one rather than being lost.
  useEffect(() => {
    if (!moved.current) return;
    moved.current = false;
    box.current?.querySelector<HTMLElement>("button, a")?.focus();
  }, [status]);
  const act = (run: () => void, words: string) => { moved.current = true; run(); setSaid(words); };
  const name = clinician.name;
  const main = `cx-btn ${primary ? "cx-btn-primary" : "cn-btn-outline"}`;

  let body;
  if (status === "me") body = <span className="cx-pill is-accent">You</span>;
  else if (status === "unavailable") {
    body = <p className="cn-connect-note">Connecting isn't available with this profile in the preview: it was made on this device, outside the example network.</p>;
  } else if (status === "blocked") {
    body = <><span className="cx-pill">Blocked</span><Link href={`~${friendsHref("blocked")}`} className="cn-link">Manage in My network</Link></>;
  } else if (status === "friend") {
    body = (
      <>
        <span className="cn-state is-connected"><Check size={16} aria-hidden="true" />Connected<span className="cl-sr"> with {name}</span></span>
        {who && <Link href={`~${messagesHref(who)}`} className="cx-btn cn-btn-outline"><MessageSquare size={16} aria-hidden="true" />Message<span className="cl-sr"> {name}</span></Link>}
      </>
    );
  } else if (status === "sent") {
    body = (
      <>
        <span className="cn-state is-pending"><Clock size={16} aria-hidden="true" />Pending<span className="cl-sr">: your invitation to {name} is waiting for an answer</span></span>
        <button type="button" className="cx-btn cx-btn-quiet" onClick={() => who && act(() => communityStore.cancelRequest(who), `Invitation to ${name} withdrawn.`)}>Withdraw<span className="cl-sr"> your invitation to {name}</span></button>
      </>
    );
  } else if (status === "incoming") {
    const asked = who as IncomingRequestId;
    body = (
      <>
        <button type="button" className={main} onClick={() => act(() => communityStore.acceptRequest(asked), `You and ${name} are now connected.`)}>Accept<span className="cl-sr"> {name}'s invitation to connect</span></button>
        <button type="button" className="cx-btn cx-btn-quiet" onClick={() => act(() => communityStore.declineRequest(asked), `${name}'s invitation ignored.`)}>Ignore<span className="cl-sr"> {name}'s invitation</span></button>
      </>
    );
  } else {
    body = (
      <button type="button" className={main} onClick={() => who && act(() => communityStore.requestFriend(who), `Invitation sent to ${name}. It shows under Sent in My network.`)}>
        <UserPlus size={16} aria-hidden="true" />Connect<span className="cl-sr"> with {name}</span>
      </button>
    );
  }
  return (
    <div className="cn-connect" ref={box} data-connection={status}>
      {status === "incoming" && <span className="cn-state">Wants to connect</span>}
      {body}
      <span className="cl-sr" role="status">{said}</span>
    </div>
  );
}

/** A colleague in the directory's results: who they are, where they work, their condition expertise, mutual connections. */
export function ColleagueRow({ clinician, me, memory }: { clinician: Clinician; me: Me; memory: CommunityMemory }) {
  const who = personOfClinician(clinician.id);
  const mutual = who ? mutualOf(memory, who, me) : [];
  const groups = clinicianGroups(clinician);
  const shared = sharedGroups(clinician, me.clinician);
  const href = `/${clinician.id}`;
  return (
    <li className="cn-row">
      <Link href={href} className="cn-row-face" tabIndex={-1} aria-hidden="true"><Avatar clinician={clinician} size={64} /></Link>
      <div className="cn-row-text">
        <h3 className="cn-row-name"><Link href={href}>{clinician.name}</Link></h3>
        <p className="cn-row-title">{professionalTitle(clinician)}</p>
        {workplaceText(clinician) && <p className="cn-row-where"><Building2 size={14} aria-hidden="true" />{workplaceText(clinician)}</p>}
        {groups.length > 0 && (
          <ul className="cn-tags" aria-label="Condition expertise">
            {groups.slice(0, 4).map(place => <li key={place.group.id}>{place.group.title}</li>)}
            {groups.length > 4 && <li>+{groups.length - 4} more</li>}
          </ul>
        )}
        {mutual.length > 0 ? <p className="cn-mutual"><Faces who={mutual} />{mutualText(mutual)}</p>
          : shared.length > 0 && <p className="cn-mutual">Also works in {shared.slice(0, 2).map(place => place.group.title).join(" and ")}</p>}
      </div>
      <div className="cn-row-actions"><ConnectControls clinician={clinician} me={me} /></div>
    </li>
  );
}
