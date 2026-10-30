import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { Link } from "wouter";
import type { PersonId } from "@/content/community-samples";
import { alertsQuiet, communityStore, messagesHref, shortWhen, useCommunity, type CommunitySpace } from "@/lib/community-store";
import CommunityDialog from "./dialog";
import { usePinnedToEnd } from "./hooks";
import { BackIcon, ChevronDownIcon, ChevronUpIcon } from "./icons";
import { DirectComposer, DirectLines, OnlineFace } from "./Messages";
import { chatById, directChats, markMessagesNoticeRead, messagesNotice, messagesNoticeDue, noticeStorage, useChatVisit } from "./messages-model";
import { MyFace } from "./parts";

/**
 * The small Messages window docked at the bottom right of every page, as in a professional network: closed, a
 * compact tab with the clinician's portrait, "Messages" and how many conversations are waiting. Opened, it is a
 * small thread (or the list of conversations), so a reply needs no trip to the Messages page. It stays out of the
 * way on Messages itself and while a group is being started; during quiet time it shows no count. It only reads the
 * community store, so it works on any page; `space` is the network view showing, when there is one. It also shows
 * the first-open notice (see MessagesNotice below).
 */
export default function MessagesDock({ space = null }: { space?: CommunitySpace | null }) {
  const memory = useCommunity();
  const visit = useChatVisit();
  const [open, setOpen] = useState(false);
  const [chatId, setChatId] = useState<PersonId | null>(null);
  const bar = useRef<HTMLButtonElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const panelId = useId();
  const chats = directChats(memory, visit);
  // Conversations waiting to be read, as the Messages tab counts them.
  const waiting = chats.filter(chat => chat.unread > 0 && !chat.muted);
  const unread = waiting.length;
  const found = chatId ? chatById(memory, chatId, visit) : null;
  const chat = found?.kind === "direct" ? found : null;
  const typing = !!chat && visit.typing === chat.id;
  const onMessages = space === "messages";
  const away = onMessages || space === "start";
  const { box, onScroll } = usePinnedToEnd<HTMLDivElement>(`${chat?.id ?? ""}:${chat?.lines.length ?? 0}:${typing}`, open && !!chat);

  useEffect(() => { if (away) setOpen(false); }, [away]);
  // A conversation open in the window is being read.
  useEffect(() => { if (open && chat && chat.unread > 0) communityStore.markChatRead(chat.id); }, [open, chat?.id, chat?.unread]);
  // Whatever the window shows next, its heading takes the focus, so a keyboard carries on from there.
  useEffect(() => { if (open) window.requestAnimationFrame(() => heading.current?.focus()); }, [open, chatId]);

  // The notice: the first time messages are opened on this device, on the Messages page or here.
  const notice = <MessagesNotice shown={onMessages || open} fallbackFocus={() => heading.current ?? document.querySelector<HTMLElement>('[data-space="messages"] [data-view-heading]')} />;

  if (away) return notice;
  const quiet = alertsQuiet(memory.settings);

  const expand = () => { setChatId(waiting[0]?.id ?? null); setOpen(true); };
  const collapse = () => { setOpen(false); window.requestAnimationFrame(() => bar.current?.focus()); };
  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => { if (event.key === "Escape") { event.preventDefault(); collapse(); } };

  if (!open) {
    const state = quiet ? "Quiet time: your messages wait here" : unread > 0 ? `${unread} unread` : "No new messages";
    return (
      <button ref={bar} type="button" className="cm-dock-bar cm-rise" aria-expanded={false} aria-controls={panelId} onClick={expand}>
        <span className="cm-dock-faces" aria-hidden="true"><MyFace size={28} /></span>
        <b className="cm-dock-title">Messages</b>
        {unread > 0 && !quiet ? <span className="cm-dock-count" aria-hidden="true">{unread}</span> : null}
        <span className="cm-sr">{`, ${state}`}</span>
        <ChevronUpIcon size={16} className="cm-dock-chevron" />
      </button>
    );
  }

  return (
    <section id={panelId} className="cm-dock-panel" aria-label="Messages" onKeyDown={onKeyDown}>
      <header className="cm-dock-head">
        {chat ? (
          <>
            <button type="button" className="cm-dock-round" aria-label="All conversations" onClick={() => setChatId(null)}><BackIcon size={16} /></button>
            <OnlineFace who={chat.id} size={32} online={chat.online} />
            <div className="cm-dock-who"><h2 ref={heading} tabIndex={-1}>{chat.name}</h2><p>{chat.title}</p></div>
          </>
        ) : (
          <>
            <span className="cm-dock-faces" aria-hidden="true"><MyFace size={32} /></span>
            <div className="cm-dock-who"><h2 ref={heading} tabIndex={-1}>Messages</h2><p>{unread > 0 ? `${unread} unread` : "All caught up"}</p></div>
          </>
        )}
        <button type="button" className="cm-dock-round" aria-label="Close messages" aria-expanded={true} onClick={collapse}><ChevronDownIcon size={16} /></button>
      </header>
      {chat ? (
        <>
          <div className="cm-dock-log" ref={box} onScroll={onScroll} role="log" aria-live="off" aria-label={`Messages with ${chat.name}`} tabIndex={0}>
            <DirectLines chat={chat} typing={typing} compact />
          </div>
          <DirectComposer chat={chat} compact />
        </>
      ) : (
        <div className="cm-dock-body">
          <ul className="cm-dock-list" aria-label="Conversations">
            {chats.map(item => (
              <li key={item.id}>
                <button type="button" className={`cm-dock-row ${item.unread > 0 ? "is-unread" : ""}`} onClick={() => setChatId(item.id)}>
                  <OnlineFace who={item.id} size={40} online={item.online} />
                  <span className="cm-dm-row-text">
                    <span className="cm-dm-row-top"><b>{item.name}</b><span className="cm-dm-when">{shortWhen(item.lastAt)}</span></span>
                    <span className="cm-dm-row-bottom">
                      <span className="cm-dm-snippet">{item.snippet}</span>
                      {item.unread > 0 && <span className="cm-dm-badge" aria-hidden="true">{item.unread}</span>}
                    </span>
                  </span>
                  <span className="cm-sr">{item.unread > 0 ? `, ${item.unread} unread` : ""}</span>
                </button>
              </li>
            ))}
          </ul>
          {chats.length === 0 && <p className="cm-dm-empty">No conversations yet.</p>}
          <Link className="cx-btn cm-dock-all" href={messagesHref()} onClick={() => setOpen(false)}>Open Messages</Link>
        </div>
      )}
      {notice}
    </section>
  );
}

/* ----------------------------------------------------------- the notice */

/**
 * "Before you message": shown once on this device, the first time messages are opened (the Messages
 * page, or the window). A proper dialog: the focus starts on its one button, Escape closes it, and
 * the focus goes back where it was. Closing it, however it is closed, counts as reading it, and
 * the device remembers (`rehyn.messages-notice.v1`); where it can't, the notice shows again next time.
 */
export function MessagesNotice({ shown, fallbackFocus }: { shown: boolean; fallbackFocus?: () => HTMLElement | null | undefined }) {
  const [due, setDue] = useState(() => messagesNoticeDue(noticeStorage()));
  const titleId = useId();
  const textId = useId();
  if (!shown || !due) return null;
  const close = () => { markMessagesNoticeRead(noticeStorage()); setDue(false); };
  return (
    <CommunityDialog kind="sheet" labelledBy={titleId} onClose={close} className="cm-dock-notice" fallbackFocus={fallbackFocus}>
      <div className="cm-dialog-head">
        <div className="cm-dialog-titles">
          <h2 id={titleId} className="cm-dialog-title cm-dialog-title-small">{messagesNotice.title}</h2>
          <p id={textId}>{messagesNotice.text}</p>
        </div>
      </div>
      <button type="button" className="cx-btn cx-btn-primary cm-dock-notice-ok" data-autofocus aria-describedby={textId} onClick={close}>{messagesNotice.button}</button>
    </CommunityDialog>
  );
}
