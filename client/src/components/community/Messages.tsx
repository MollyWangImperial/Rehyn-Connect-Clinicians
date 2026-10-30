import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { Link, useSearch } from "wouter";
import { newConversation, people, type PersonId } from "@/content/community-samples";
import { canSee, clockLabel, communityHref, communityStore, friendsHref, leadsHere, messagesHref, shortWhen, useCommunity, type NoteDraft, type OpenSafetyMenu } from "@/lib/community-store";
import { useMe } from "@/lib/me";
import { myGroups } from "./group-model";
import { useMediaQuery, usePinnedToEnd } from "./hooks";
import { BackIcon, BellIcon, BellOffIcon, CloseIcon, FlagIcon, LockIcon, GlobeIcon, PauseCircleIcon, PenIcon, SearchIcon } from "./icons";
import MessageComposer from "./MessageComposer";
import { allChats, chatById, colleagueProfile, connectionsToMessage, dayLabel, groupReplies, groupsWith, mutualConnections, sendDirect, useChatVisit, type Chat, type ChatLine, type DirectChat, type GroupChat } from "./messages-model";
import { Cover, Face, MyFace } from "./parts";

// Messages: professional conversations with connections in My Network and with the clinician's clinical groups, in
// three columns like a messaging workspace: the conversation list, the open thread, and the colleague's (or group's)
// profile. On a narrow screen the list and the thread take turns. The colleagues' words are examples; what the
// clinician writes stays on this device. The first time Messages opens, a notice says the Rehyn team can read what is
// sent here (it is shown by the Messages window, MessagesDock, which is on every page).

type Filter = "all" | "unread" | "groups";
const FILTERS: { id: Filter; label: string }[] = [{ id: "all", label: "All" }, { id: "unread", label: "Unread" }, { id: "groups", label: "Groups" }];
/** Lines from the same sender this close together share one name and time. */
const RUN_MS = 10 * 60_000;

/* --------------------------------------------------------- shared pieces */

/** A colleague's portrait, with the green dot of someone online. */
export function OnlineFace({ who, size, online }: { who: PersonId; size: number; online: boolean }) {
  return (
    <span className="cm-dm-face" style={{ width: size, height: size }}>
      <Face who={who} size={size} />
      {online && <span className="cm-dm-online" aria-hidden="true" />}
    </span>
  );
}

/** "Hannah Brooks is typing", while a colleague writes back. */
function TypingLine({ who }: { who: PersonId }) {
  return (
    <p className="cm-dm-typing">
      <Face who={who} size={24} />
      <span className="cm-dm-typing-dots" aria-hidden="true"><i /><i /><i /></span>
      <span>{`${people[who].name} is typing`}</span>
    </p>
  );
}

/**
 * A thread, a day at a time: each run of lines from one sender is headed by their portrait, name and time, the way
 * a professional messaging tool shows it. Each line still says who wrote it and when, for a screen reader.
 * `onRemove` takes back one of the clinician's own lines; `showTitles` names each colleague's role (in groups).
 */
export function ChatLog({ lines, onRemove, showTitles = false, empty, typing = null, faceSize = 36 }: { lines: ChatLine[]; onRemove: (id: string) => void; showTitles?: boolean; empty: string; typing?: PersonId | null; faceSize?: number }) {
  const me = useMe();
  const now = Date.now();
  const rows: ReactNode[] = [];
  let day = "";
  let previous: ChatLine | null = null;
  lines.forEach(line => {
    const label = dayLabel(line.at, now);
    const newDay = label !== day;
    if (newDay) {
      day = label;
      rows.push(<li key={`day-${label}`} className="cm-dm-day"><span>{label}</span></li>);
    }
    const sender = line.kind === "mine" ? "me" : line.who;
    const before: ChatLine | null = previous;
    const continues = !newDay && !!before && (before.kind === "mine" ? "me" : before.who) === sender && line.at - before.at < RUN_MS;
    previous = line;
    const name = line.kind === "mine" ? me.name : people[line.who].name;
    const time = clockLabel(line.at);
    const head = continues ? <span className="cm-sr">{`${name}, ${time}: `}</span> : (
      <div className="cm-dm-line-head">
        {line.kind === "mine" ? <MyFace size={faceSize} /> : <Face who={line.who} size={faceSize} />}
        <p className="cm-dm-line-who">
          {line.kind === "mine"
            ? <b>{name}</b>
            : <Link className="cm-dm-name-link" href={colleagueProfile(line.who).profileHref}>{name}</Link>}
          {line.kind === "theirs" && showTitles && <span className="cm-dm-line-title">{people[line.who].title}</span>}
          <span className="cm-dm-line-time"><span className="cm-sr">, </span>{time}</span>
          <span className="cm-sr">: </span>
        </p>
      </div>
    );
    rows.push(
      <li key={line.id} className={`cm-dm-line ${continues ? "is-run" : ""} ${line.kind === "mine" ? "is-mine" : ""}`}>
        {head}
        <div className="cm-dm-text">
          {line.kind === "mine" && line.note.photo && <img src={line.note.photo} alt="Image you sent" />}
          {line.kind === "mine" ? line.note.text && <p>{line.note.text}</p> : <p>{line.text}</p>}
          {line.kind === "mine" && line.removable && (
            <button type="button" className="cm-dm-remove" onClick={() => onRemove(line.id)}>Remove<span className="cm-sr"> your message</span></button>
          )}
        </div>
      </li>,
    );
  });
  return (
    <>
      <ol className="cm-dm-lines">
        {rows.length === 0 && <li className="cm-dm-log-note">{empty}</li>}
        {rows}
      </ol>
      {typing && <TypingLine who={typing} />}
    </>
  );
}

/** A conversation with a colleague (the Messages page and the small window both show it this way). */
export function DirectLines({ chat, typing, compact = false }: { chat: DirectChat; typing: boolean; compact?: boolean }) {
  return <ChatLog lines={chat.lines} typing={typing ? chat.id : null} faceSize={compact ? 32 : 36} empty={`No messages yet. Start the conversation with ${chat.name}.`} onRemove={id => communityStore.removeDirect(chat.id, id)} />;
}

/** The writing box for a colleague, with suggested replies. `compact` is the small window's. */
export function DirectComposer({ chat, compact = false }: { chat: DirectChat; compact?: boolean }) {
  const memory = useCommunity();
  const [status, setStatus] = useState("");
  const quick = chat.conversation?.quickReplies ?? newConversation.quickReplies;
  const off = memory.settings.messagesFrom === "noOne";
  const send = (draft: NoteDraft) => {
    const note = sendDirect(memory, chat.id, draft);
    if (note) setStatus(`Sent to ${chat.name}: ${note.text || "an image"}`);
  };
  return (
    <div className="cm-dm-foot">
      {off && (
        <p className="cm-dm-off">
          <PauseCircleIcon size={16} />
          <span>Messages to you are off, so colleagues can't reply. <Link className="cm-dm-link" href={communityHref("settings", null, { section: "profile" })}>Change who can message you</Link></span>
        </p>
      )}
      <MessageComposer label={`Write a message to ${chat.name}`} placeholder="Write a message…" onSend={send} suggestions={quick} compact={compact} />
      <p className="cm-sr" role="status">{status}</p>
    </div>
  );
}

/* --------------------------------------------------------------- the list */

function ChatRow({ chat, on }: { chat: Chat; on: boolean }) {
  const search = useSearch();
  const href = messagesHref(chat.id);
  const unread = chat.unread > 0;
  return (
    <li>
      <Link className={`cm-dm-row ${on ? "is-on" : ""} ${unread ? "is-unread" : ""}`} href={href} replace={leadsHere(href, search)} aria-current={on ? "page" : undefined}>
        {chat.kind === "direct" ? <OnlineFace who={chat.id} size={48} online={chat.online} /> : <Cover cover={chat.group.cover} className="cm-dm-cover" />}
        <span className="cm-dm-row-text">
          <span className="cm-dm-row-top"><b>{chat.name}</b><span className="cm-dm-when">{shortWhen(chat.lastAt)}</span></span>
          <span className="cm-dm-row-sub">{chat.kind === "direct" ? chat.title : `Group · ${chat.group.members} members`}</span>
          <span className="cm-dm-row-bottom">
            <span className="cm-dm-snippet">{chat.snippet}</span>
            {unread && <span className="cm-dm-badge" aria-hidden="true">{chat.unread}</span>}
            {chat.kind === "direct" && chat.muted && <BellOffIcon size={14} className="cm-dm-muted-mark" />}
          </span>
        </span>
        <span className="cm-sr">{`${unread ? `, ${chat.unread} unread` : ""}${chat.kind === "direct" && chat.muted ? ", notifications muted" : ""}`}</span>
      </Link>
    </li>
  );
}

/** "New message": the clinician's connections, to write to one of them. */
function NewMessage({ id, onClose }: { id: string; onClose: (focusBack: boolean) => void }) {
  const memory = useCommunity();
  const [to, setTo] = useState("");
  const field = useRef<HTMLInputElement>(null);
  useEffect(() => { field.current?.focus(); }, []);
  const words = to.trim().toLowerCase();
  const connections = connectionsToMessage(memory).filter(who => !words || `${people[who].name} ${people[who].title}`.toLowerCase().includes(words));
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => { if (event.key === "Escape") { event.preventDefault(); onClose(true); } };
  return (
    <div className="cm-dm-new" id={id} role="group" aria-label="New message" onKeyDown={onKeyDown}>
      <div className="cm-dm-new-head">
        <p>New message</p>
        <button type="button" className="cm-dm-icon" aria-label="Close new message" onClick={() => onClose(true)}><CloseIcon size={16} /></button>
      </div>
      <label className="cm-dm-to">
        <span>To</span>
        <input ref={field} type="search" value={to} maxLength={40} placeholder="Type a name or specialty" autoComplete="off" spellCheck={false} onChange={event => setTo(event.target.value)} />
      </label>
      {connections.length ? (
        <ul>
          {connections.map(who => (
            <li key={who}>
              <Link className="cm-dm-new-row" href={messagesHref(who)} onClick={() => onClose(false)}>
                <Face who={who} size={36} />
                <span className="cm-dm-new-text"><b>{people[who].name}</b><span>{people[who].title}</span></span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="cm-dm-empty">
          {words ? "No connections match." : "No connections yet."}{" "}
          <Link className="cm-dm-link" href={friendsHref(null, { space: "messages", group: null })} onClick={() => onClose(false)}>Find colleagues in My Network</Link>
        </p>
      )}
    </div>
  );
}

/* -------------------------------------------------- who it is with */

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return <div className="cm-dm-fact"><dt>{label}</dt><dd>{children}</dd></div>;
}

function PersonPanel({ chat, onPersonMenu }: { chat: DirectChat; onPersonMenu: OpenSafetyMenu }) {
  const memory = useCommunity();
  const titleId = useId();
  const who = chat.id;
  const profile = colleagueProfile(who);
  const shared = groupsWith(who);
  const groups = myGroups(memory).filter(group => shared.includes(group.id));
  const mutual = mutualConnections(memory, who);
  const conversation = chat.conversation;
  return (
    <aside className="cm-dm-side" aria-labelledby={titleId}>
      <div className="cm-dm-card">
        <OnlineFace who={who} size={72} online={chat.online} />
        <h3 id={titleId} className="cm-dm-side-name">{chat.name}</h3>
        <p className="cm-dm-side-title">{profile.title}</p>
        {profile.workplace && <p className="cm-dm-side-line">{profile.workplace}</p>}
        <p className="cm-dm-side-state">
          {chat.connection === "Connect"
            ? <Link className="cx-pill is-accent cm-dm-connect" href={profile.profileHref}>Connect<span className="cm-sr">{` with ${chat.name}`}</span></Link>
            : <span className={`cx-pill ${chat.connection === "Connected" ? "is-accent" : ""}`}>{chat.connection}</span>}
          {chat.status && <span>{chat.status}</span>}
        </p>
        <Link className="cx-btn cm-dm-side-cta" href={profile.profileHref}>View profile</Link>
      </div>
      <section className="cm-dm-section" aria-label={`About ${chat.name}`}>
        <h4 className="cm-dm-label">About</h4>
        <p className="cm-dm-about">{profile.summary}</p>
      </section>
      {profile.interests.length > 0 && (
        <section className="cm-dm-section">
          <h4 className="cm-dm-label">Clinical interests</h4>
          <ul className="cm-dm-tags">{profile.interests.map(item => <li key={item} className="cx-pill">{item}</li>)}</ul>
        </section>
      )}
      <section className="cm-dm-section">
        <h4 className="cm-dm-label">Details</h4>
        <dl className="cm-dm-facts">
          {profile.years > 0 && <Fact label="Experience">{`${profile.years} years`}</Fact>}
          {profile.languages.length > 0 && <Fact label="Languages">{profile.languages.join(", ")}</Fact>}
          {conversation && <Fact label="Member since">{conversation.memberSince}</Fact>}
          {conversation && chat.connection === "Connected" && <Fact label="Connected since">{conversation.friendsSince}</Fact>}
        </dl>
      </section>
      {groups.length > 0 && (
        <section className="cm-dm-section">
          <h4 className="cm-dm-label">Shared groups</h4>
          <ul className="cm-dm-links">
            {groups.map(group => <li key={group.id}><Link className="cm-dm-link-row" href={communityHref("groups", group.id)}><Cover cover={group.cover} className="cm-dm-mini-cover" /><span>{group.name}</span></Link></li>)}
          </ul>
        </section>
      )}
      {mutual.length > 0 && (
        <section className="cm-dm-section">
          <h4 className="cm-dm-label">{`Mutual connections · ${mutual.length}`}</h4>
          <ul className="cm-dm-links">
            {mutual.map(other => <li key={other}><Link className="cm-dm-link-row" href={colleagueProfile(other).profileHref}><Face who={other} size={28} /><span>{people[other].name}</span></Link></li>)}
          </ul>
        </section>
      )}
      <div className="cm-dm-side-actions">
        <button type="button" className={`cx-btn cm-dm-side-button ${chat.muted ? "is-on" : ""}`} aria-pressed={chat.muted} onClick={() => communityStore.toggleChatMuted(who)}>
          {chat.muted ? <BellOffIcon size={16} /> : <BellIcon size={16} />}<span>{chat.muted ? "Notifications muted" : "Mute notifications"}</span>
        </button>
        <button type="button" className="cx-btn cx-btn-quiet cm-dm-side-button is-danger" aria-haspopup="dialog" onClick={event => onPersonMenu({ who, postId: null }, event.currentTarget)}>
          <FlagIcon size={16} /><span>Block or report<span className="cm-sr">{` ${chat.name}`}</span></span>
        </button>
      </div>
    </aside>
  );
}

function GroupPanel({ chat }: { chat: GroupChat }) {
  const memory = useCommunity();
  const titleId = useId();
  const group = chat.group;
  const faces = group.faces.filter(who => canSee(memory, who));
  const isPrivate = group.visibility === "private";
  return (
    <aside className="cm-dm-side" aria-labelledby={titleId}>
      <div className="cm-dm-card">
        <Cover cover={group.cover} className="cm-dm-side-cover" />
        <h3 id={titleId} className="cm-dm-side-name">{group.name}</h3>
        <p className="cm-dm-side-title">
          {isPrivate ? <LockIcon size={13} /> : <GlobeIcon size={13} />}
          <span>{`${isPrivate ? "Private" : "Public"} group · ${group.members} members`}</span>
        </p>
        {group.online > 0 && <p className="cm-dm-side-line">{`${group.online} active now`}</p>}
        <Link className="cx-btn cm-dm-side-cta" href={communityHref("groups", group.id)}>Open the group page</Link>
      </div>
      <section className="cm-dm-section">
        <h4 className="cm-dm-label">About</h4>
        <p className="cm-dm-about">{group.about}</p>
      </section>
      {faces.length > 0 && (
        <section className="cm-dm-section">
          <h4 className="cm-dm-label">Members you know</h4>
          <ul className="cm-dm-links">
            {faces.map(who => (
              <li key={who}>
                <Link className="cm-dm-link-row" href={colleagueProfile(who).profileHref}>
                  <Face who={who} size={28} />
                  <span className="cm-dm-new-text"><b>{people[who].name}</b><span>{people[who].title}</span></span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </aside>
  );
}

/* -------------------------------------------------------- conversations */

function GroupConversation({ chat, headingProps, back }: { chat: GroupChat; headingProps: Record<string, unknown>; back: ReactNode }) {
  const group = chat.group;
  const [status, setStatus] = useState("");
  const { box, onScroll } = usePinnedToEnd<HTMLDivElement>(`${group.id}:${chat.lines.length}`, true);
  const send = (draft: NoteDraft) => {
    const note = communityStore.addMessage(group.id, draft);
    if (note) setStatus(`Sent to ${group.name}: ${note.text || "an image"}`);
  };
  return (
    <section className="cm-dm-main" aria-label={`Messages in ${group.name}`}>
      <header className="cm-dm-head">
        {back}
        <Cover cover={group.cover} className="cm-dm-head-cover" />
        <div className="cm-dm-head-text">
          <h2 {...headingProps}>{group.name}</h2>
          <p>{group.online > 0 ? `${group.members} members · ${group.online} active now` : `${group.members} members`}</p>
        </div>
        <Link className="cx-btn cm-dm-head-action" href={communityHref("groups", group.id)}>Group page</Link>
      </header>
      <div className="cm-dm-log" ref={box} onScroll={onScroll} role="log" aria-live="off" aria-label={`Messages in ${group.name}`} tabIndex={0}>
        <ChatLog lines={chat.lines} showTitles empty="No messages in this group yet. Start the discussion." onRemove={id => communityStore.removeMessage(group.id, id)} />
      </div>
      <div className="cm-dm-foot">
        <MessageComposer label={`Write a message to ${group.name}`} placeholder={`Message ${group.name}`} onSend={send} suggestions={groupReplies} />
        <p className="cm-sr" role="status">{status}</p>
      </div>
    </section>
  );
}

function DirectConversation({ chat, headingProps, back, active }: { chat: DirectChat; headingProps: Record<string, unknown>; back: ReactNode; active: boolean }) {
  const visit = useChatVisit();
  const typing = visit.typing === chat.id;
  const { box, onScroll } = usePinnedToEnd<HTMLDivElement>(`${chat.id}:${chat.lines.length}:${typing}`, active);
  return (
    <section className="cm-dm-main" aria-label={`Messages with ${chat.name}`}>
      <header className="cm-dm-head">
        {back}
        <OnlineFace who={chat.id} size={40} online={chat.online} />
        <div className="cm-dm-head-text">
          <h2 {...headingProps}>{chat.name}</h2>
          <p>{[chat.title, chat.status].filter(Boolean).join(" · ")}</p>
        </div>
        <Link className="cx-btn cm-dm-head-action" href={chat.profileHref}>View profile<span className="cm-sr">{` of ${chat.name}`}</span></Link>
      </header>
      <div className="cm-dm-log" ref={box} onScroll={onScroll} role="log" aria-live="off" aria-label={`Messages with ${chat.name}`} tabIndex={0}>
        <DirectLines chat={chat} typing={typing} />
      </div>
      <DirectComposer chat={chat} />
    </section>
  );
}

/* ------------------------------------------------------------------- view */

/**
 * The Messages tab. `chat` is the conversation the address names; on a wide screen the newest one
 * opens when it names none. Opening a conversation reads what was waiting in it. `onPersonMenu`
 * opens the hide, block or report sheet ("Block or report").
 */
export default function MessagesView({ active, chat: requested, onPersonMenu }: { active: boolean; chat: string | null; onPersonMenu: OpenSafetyMenu }) {
  const memory = useCommunity();
  const visit = useChatVisit();
  const single = useMediaQuery("(max-width: 1020px)");
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [picking, setPicking] = useState(false);
  const newButton = useRef<HTMLButtonElement>(null);
  const newId = useId();
  const chats = allChats(memory, visit);
  const named = chatById(memory, requested, visit);
  const selected = named ?? (single ? null : chats[0] ?? null);
  const words = query.trim().toLowerCase();
  const listed = chats.filter(chat => (filter === "all" || (filter === "unread" ? chat.unread > 0 : chat.kind === "group"))
    && (!words || chat.name.toLowerCase().includes(words) || chat.snippet.toLowerCase().includes(words) || (chat.kind === "direct" && chat.title.toLowerCase().includes(words))));
  const showChat = !!selected && (!single || !!named);
  const unreadCount = chats.filter(chat => chat.unread > 0).length;

  // Opening a conversation reads it: the colleague's unread lines, or the group's badge.
  useEffect(() => {
    if (!active || !showChat || !selected || selected.unread === 0) return;
    if (selected.kind === "direct") communityStore.markChatRead(selected.id);
    else communityStore.markRead(selected.id);
  }, [active, showChat, selected?.kind, selected?.id, selected?.unread]);

  const closeNew = (focusBack: boolean) => { setPicking(false); if (focusBack) window.requestAnimationFrame(() => newButton.current?.focus()); };

  // The view's heading, where the focus goes as the view opens: the conversation's name when only it shows.
  const heading = { tabIndex: -1, ...(single && showChat ? { "data-view-heading": true } : {}) };
  const back = single ? <Link className="cm-dm-back" href={messagesHref()} aria-label="All messages"><BackIcon size={18} /></Link> : null;
  const empty = filter === "unread" ? "No unread conversations." : filter === "groups" ? "No group conversations yet." : "No conversations yet.";

  return (
    <div className={`cm-dm cm-card ${single ? "is-single" : ""} ${showChat ? "has-chat" : ""}`}>
      <section className="cm-dm-list" aria-labelledby="cm-dm-title">
        <div className="cm-dm-list-head">
          <h2 id="cm-dm-title" tabIndex={-1} {...(single && showChat ? {} : { "data-view-heading": true })}>Messages</h2>
          <button ref={newButton} type="button" className="cx-btn cm-dm-new-button" aria-expanded={picking} aria-controls={picking ? newId : undefined} onClick={() => setPicking(!picking)}>
            <PenIcon size={15} /><span>New</span><span className="cm-sr"> message</span>
          </button>
        </div>
        {picking && <NewMessage id={newId} onClose={closeNew} />}
        <div className="cm-dm-tools-row">
          <label className="cm-dm-search">
            <SearchIcon size={16} />
            <span className="cm-sr">Search messages</span>
            <input type="search" value={query} maxLength={40} placeholder="Search messages" autoComplete="off" spellCheck={false} onChange={event => setQuery(event.target.value)}
              onKeyDown={event => { if (event.key === "Escape" && query) { event.preventDefault(); setQuery(""); } }} />
          </label>
          <div className="cm-segments cm-dm-filters" role="group" aria-label="Show">
            {FILTERS.map(item => (
              <button key={item.id} type="button" className="cm-segment" aria-pressed={filter === item.id} onClick={() => setFilter(item.id)}>
                {item.label}{item.id === "unread" && unreadCount > 0 && <span className="cm-dm-filter-count">{unreadCount}</span>}
              </button>
            ))}
          </div>
        </div>
        <p className="cm-sr" role="status">{words ? `${listed.length} ${listed.length === 1 ? "conversation" : "conversations"} found` : ""}</p>
        <ul className="cm-dm-rows" aria-label="Conversations">
          {listed.map(chat => <ChatRow key={chat.id} chat={chat} on={showChat && chat.id === selected?.id} />)}
        </ul>
        {listed.length === 0 && <p className="cm-dm-empty">{words ? `Nothing matches “${query.trim()}”.` : empty}</p>}
      </section>

      {showChat && selected && (selected.kind === "direct"
        ? <DirectConversation key={selected.id} chat={selected} headingProps={heading} back={back} active={active} />
        : <GroupConversation key={selected.id} chat={selected} headingProps={heading} back={back} />)}
      {showChat && selected && (selected.kind === "direct" ? <PersonPanel chat={selected} onPersonMenu={onPersonMenu} /> : <GroupPanel chat={selected} />)}
      {!showChat && !single && (
        <div className="cm-dm-none">
          <p><b>Select a conversation</b></p>
          <p>Or start a new message with a connection from My Network.</p>
        </div>
      )}
    </div>
  );
}
