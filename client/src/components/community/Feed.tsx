import { useId, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { Link } from "wouter";
import { feedPosts, feelings, isClinician, isPersonId, members, people, sampleGroups, settingsChoices, type FeelingId, type PersonId, type PostsSeenBy, type SamplePost } from "@/content/community-samples";
import {
  canSee,
  commentKey,
  communityHref,
  communityStore,
  friendList,
  hiddenThisVisit,
  listNames,
  postVisibility,
  preparePostPhoto,
  timeAgo,
  useCommunity,
  type OpenSafetyMenu,
  type OwnPost,
  type PostVisibility,
} from "@/lib/community-store";
import { SharingLocked, useCanShare } from "@/components/SharingLocked";
import { useMe } from "@/lib/me";
import ConsultationsCard from "./ConsultationsCard";
import SessionsTile from "./SessionsTile";
import "./feed-clinician.css";
import { useVoiceNote, voiceSeconds } from "./hooks";
import { ArrowIcon, ChatIcon, CloseIcon, DotsIcon, EyeIcon, EyeOffIcon, GlobeIcon, HeartPulseIcon, LockIcon, MicIcon, PhotoIcon, SmileIcon, SpeakerIcon, StarIcon, StopIcon, ThumbDownIcon, UsersIcon } from "./icons";
import { Face, FriendButton, MemberFace, MyFace, ReactionButton, VoiceNote } from "./parts";
import { postsAudience } from "./settings-model";

const feelingLabel = (id: FeelingId | null) => feelings.find(item => item.id === id)?.label.toLowerCase();

function PostTags({ win, feeling }: { win: boolean; feeling: FeelingId | null }) {
  if (!win && !feeling) return null;
  return (
    <p className="cm-post-tags">
      {win && <span className="cm-tag cm-tag-win"><StarIcon size={16} />Little win</span>}
      {feeling && <span className="cm-tag cm-tag-feeling"><SmileIcon size={16} />{`Feeling ${feelingLabel(feeling)}`}</span>}
    </p>
  );
}

/* --------------------------------------------------------------- composer */

/** Everyone, Friends or Only me, as a small picture. */
function AudienceIcon({ seenBy, size = 16 }: { seenBy: PostsSeenBy; size?: number }) {
  if (seenBy === "everyone") return <GlobeIcon size={size} />;
  if (seenBy === "onlyMe") return <LockIcon size={size} />;
  return <UsersIcon size={size} />;
}

/** The composer's audience choices: Connections first, then All clinicians, then Only me. */
const AUDIENCE_ORDER: PostsSeenBy[] = ["friends", "everyone", "onlyMe"];

/** Who will see this post, said under the choice: "Visible to your 12 friends". */
function audienceLine(seenBy: PostsSeenBy, friends: number): string {
  if (seenBy === "everyone") return "Visible to every verified clinician on Rehyn Connect";
  if (seenBy === "onlyMe") return "Only you will see this";
  return friends === 0 ? "Visible to your connections, once you have some" : `Visible to your ${friends} ${friends === 1 ? "connection" : "connections"}`;
}

/**
 * Who can see the person's posts, chosen right where they write: three choices side by side, each
 * with its picture, the chosen one raised. It is the same choice as "Who can see my posts" in
 * Community settings, so changing it here changes it there too.
 */
function AudiencePicker({ seenBy }: { seenBy: PostsSeenBy }) {
  const name = useId();
  return (
    <div className="cm-audience" role="radiogroup" aria-label="Who can see my posts">
      {AUDIENCE_ORDER.map(id => {
        const label = settingsChoices.postsSeenBy.find(choice => choice.id === id)?.label ?? postsAudience(id).label;
        return (
          <label key={id} className={`cm-audience-option ${seenBy === id ? "is-on" : ""}`}>
            <input className="cm-sr" type="radio" name={name} value={id} checked={seenBy === id} onChange={() => communityStore.updateSettings({ postsSeenBy: id })} />
            <AudienceIcon seenBy={id} size={15} />
            <span>{label}</span>
          </label>
        );
      })}
    </div>
  );
}

/**
 * "What's new with you?" Photo, Voice, Feeling and Little win shape the post, and the picker beside
 * Post says who can see it (Community settings holds the same choice).
 */
function PostComposer({ name }: { name: string }) {
  const memory = useCommunity();
  const canShare = useCanShare();
  const seenBy = memory.settings.postsSeenBy;
  const friendCount = friendList(memory).length;
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [photo, setPhoto] = useState<string | null>(null);
  const [voice, setVoice] = useState(false);
  const [feeling, setFeeling] = useState<FeelingId | null>(null);
  const [choosing, setChoosing] = useState(false);
  const [win, setWin] = useState(false);
  const [problem, setProblem] = useState("");
  const [posted, setPosted] = useState("");
  const picker = useRef<HTMLInputElement>(null);
  const box = useRef<HTMLTextAreaElement>(null);
  const opener = useRef<HTMLButtonElement>(null);
  const feelingsId = useId();
  const hintId = useId();
  const me = useMe();
  const prompt = `Start a post, ${me.first}`;

  const focusBox = () => window.requestAnimationFrame(() => box.current?.focus());
  const expand = () => { setOpen(true); setPosted(""); };
  const reset = () => { setText(""); setPhoto(null); setVoice(false); setFeeling(null); setChoosing(false); setWin(false); setProblem(""); };
  const close = () => { reset(); setOpen(false); window.requestAnimationFrame(() => opener.current?.focus()); };

  const choosePhoto = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    expand();
    try { setPhoto(await preparePostPhoto(file)); setProblem(""); }
    catch (error) { setProblem(error instanceof Error ? error.message : "This photo couldn't be added."); }
  };
  const post = (event: FormEvent) => {
    event.preventDefault();
    const words = text.trim();
    if (voice && !words) { setProblem("Write the words for your voice note first."); box.current?.focus(); return; }
    if (!words && !photo) { setProblem("Write something, or add a photo, before you post."); box.current?.focus(); return; }
    communityStore.addPost({ text: words, photo, voice, feeling, win });
    close();
    setPosted(postsAudience(seenBy).posted);
  };

  if (!canShare) return <section className="cm-card cm-composer cm-rise" aria-label="Write a post"><SharingLocked what="post" /></section>;
  return (
    <section className="cm-card cm-composer cm-rise" aria-label="Write a post">
      <form onSubmit={post}>
        <div className="cm-composer-top">
          <MyFace size={48} />
          {open ? (
            <label className="cm-composer-field">
              <span className="cm-sr">{voice ? `${prompt} Write the words for your voice note.` : prompt}</span>
              <textarea ref={box} value={text} rows={3} maxLength={600} placeholder={voice ? "Write the words for your voice note" : prompt} aria-describedby={voice ? hintId : undefined} onChange={event => { setText(event.target.value); setProblem(""); }} />
            </label>
          ) : (
            <button ref={opener} type="button" className="cm-composer-prompt" onClick={() => { expand(); focusBox(); }}>{prompt}</button>
          )}
        </div>

        {open && (photo || voice || win || feeling || choosing) && (
          <div className="cm-composer-extras">
            {photo && (
              <div className="cm-attached cm-attached-large">
                <img src={photo} alt="The photo you chose" />
                <button type="button" className="cm-icon-button" aria-label="Remove the photo" onClick={() => setPhoto(null)}><CloseIcon size={18} /></button>
              </div>
            )}
            {voice && <p className="cm-hint" id={hintId}><MicIcon size={18} /><span>Recording isn't switched on in this preview. Write your words, and Play will read them aloud on this device, with the words written underneath.</span></p>}
            <PostTags win={win} feeling={feeling} />
            {choosing && (
              <fieldset className="cm-feelings" id={feelingsId}>
                <legend>How are you feeling?</legend>
                <div>
                  {feelings.map(item => (
                    <button key={item.id} type="button" className={`cm-feeling ${feeling === item.id ? "is-on" : ""}`} aria-pressed={feeling === item.id}
                      onClick={() => { setFeeling(feeling === item.id ? null : item.id); setChoosing(false); focusBox(); }}>{item.label}</button>
                  ))}
                </div>
              </fieldset>
            )}
          </div>
        )}

        {/* Clinicians share text and images; the patient edition's Voice, Feeling and Little win have no place here. */}
        <div className="cm-composer-chips">
          <button type="button" className="cm-chip cm-chip-photo" onClick={() => picker.current?.click()}><PhotoIcon /><span>Image</span></button>
          <input ref={picker} className="cm-sr" type="file" accept="image/jpeg,image/png,image/webp" tabIndex={-1} aria-hidden="true" onChange={choosePhoto} />
        </div>

        {problem && <p className="cm-problem" role="alert">{problem}</p>}
        {open && (
          <>
            <div className="cm-composer-foot">
              <AudiencePicker seenBy={seenBy} />
              <span className="cm-composer-actions">
                <button type="button" className="cm-btn cm-btn-quiet" onClick={close}>Cancel</button>
                <button type="submit" className="cm-btn cm-btn-green">Post</button>
              </span>
            </div>
            <p className="cm-audience-line"><AudienceIcon seenBy={seenBy} size={14} /><span>{audienceLine(seenBy, friendCount)}</span></p>
          </>
        )}
      </form>
      <p className="cm-status" role="status">{posted}</p>
    </section>
  );
}

/* ------------------------------------------------------------------ posts */

export function OwnPostCard({ post, name }: { post: OwnPost; name: string }) {
  const [asking, setAsking] = useState(false);
  const headingId = useId();
  const seenBy = useCommunity().settings.postsSeenBy;
  return (
    <article className="cm-card cm-post is-mine cm-msg-in" aria-labelledby={headingId}>
      <header className="cm-post-head">
        <MyFace size={48} />
        <div className="cm-post-who">
          <h3 className="cm-post-name" id={headingId}>{name} <span className="cm-post-in">(you)</span></h3>
          <p className="cm-post-meta">
            {timeAgo(post.createdAt)} ·{" "}
            <span className="cm-post-audience"><AudienceIcon seenBy={seenBy} size={14} /><span><span className="cm-sr">Seen by </span>{postsAudience(seenBy).label}</span></span>
          </p>
        </div>
        {asking ? (
          <span className="cm-confirm" role="group" aria-label="Remove this post?">
            <button type="button" className="cm-btn cm-btn-small cm-btn-rust" onClick={() => communityStore.removePost(post.id)}>Remove it</button>
            <button type="button" className="cm-btn cm-btn-small cm-btn-quiet" onClick={() => setAsking(false)}>Keep</button>
          </span>
        ) : (
          <button type="button" className="cm-text-button" onClick={() => setAsking(true)}>Remove<span className="cm-sr"> your post</span></button>
        )}
      </header>
      <PostTags win={post.win} feeling={post.feeling} />
      {post.voice ? <VoiceNote words={post.text} label="your voice note" wordsClassName="cm-post-text" /> : post.text && <p className="cm-post-text">{post.text}</p>}
      {post.photo && <img className="cm-post-photo is-own" src={post.photo} alt="Your photo" />}
      <CommentSection postId={post.id} label="your post" />
    </article>
  );
}

/* --------------------------------------------------------------- comments */

/** An example comment's likes from other people (a small number of its own, the same every visit). */
function sampleLikes(text: string): number {
  let hash = 0;
  for (const letter of text) hash = (hash * 31 + letter.charCodeAt(0)) >>> 0;
  return 1 + (hash % 7);
}

/**
 * Rehyn's like (a heart with the pulse of the Rehyn mark through it) and a dislike, under each comment. One
 * of the two at a time; the same one again takes it back. `base` is the likes from other people.
 */
function CommentVotes({ voteKey, base, whose }: { voteKey: string; base: number; whose: string }) {
  const memory = useCommunity();
  const mine = memory.commentVotes[voteKey] ?? null;
  const counts = memory.settings.showHeartCounts;
  const likes = base + (mine === "like" ? 1 : 0);
  const dislikes = mine === "dislike" ? 1 : 0;
  const said = (count: number, what: string) => (counts ? `, ${count} ${what}${count === 1 ? "" : "s"}` : "");
  return (
    <span className="cm-votes" role="group" aria-label={`Like or dislike ${whose} comment`}>
      <button type="button" className={`cm-vote cm-vote-like ${mine === "like" ? "is-on" : ""}`} aria-pressed={mine === "like"}
        aria-label={`Like ${whose} comment${said(likes, "like")}`} onClick={() => communityStore.voteComment(voteKey, "like")}>
        <HeartPulseIcon size={19} on={mine === "like"} />{counts && likes > 0 && <span aria-hidden="true">{likes}</span>}
      </button>
      <button type="button" className={`cm-vote cm-vote-dislike ${mine === "dislike" ? "is-on" : ""}`} aria-pressed={mine === "dislike"}
        aria-label={`Dislike ${whose} comment${said(dislikes, "dislike")}`} onClick={() => communityStore.voteComment(voteKey, "dislike")}>
        <ThumbDownIcon size={17} on={mine === "dislike"} />{counts && dislikes > 0 && <span aria-hidden="true">{dislikes}</span>}
      </button>
    </span>
  );
}

/** How many comments a long thread shows before "View all". */
const SHOWN_COMMENTS = 2;

/**
 * A post's comments, always open under it (no "Comment" button to press first): the comments, each with a like
 * and a dislike, the quick replies, and "Write a comment". A long thread shows its latest comments, with
 * "View all" for the rest. `samples` are an example post's comments; the person's own come after them.
 */
function CommentSection({ postId, samples = [], label, quickReplies = [], emptyLine }: {
  postId: string;
  samples?: SamplePost["comments"];
  /** Whose post it is, for a screen reader: "Margaret's post", "your post", "today's question". */
  label: string;
  quickReplies?: string[];
  emptyLine?: string;
}) {
  const memory = useCommunity();
  const replies = memory.replies[postId] ?? [];
  const [text, setText] = useState("");
  const [status, setStatus] = useState("");
  const [all, setAll] = useState(false);
  const listId = useId();
  const canShare = useCanShare();
  const items = [
    ...samples.map((comment, index) => ({ comment, index })).filter(({ comment }) => canSee(memory, comment.who))
      .map(({ comment, index }) => ({ id: `c${index}`, who: comment.who as PersonId | null, text: comment.text, base: sampleLikes(comment.text), mine: false })),
    ...replies.map(reply => ({ id: reply.id, who: null, text: reply.text, base: 0, mine: true })),
  ];
  const tucked = all ? 0 : Math.max(0, items.length - SHOWN_COMMENTS);
  const reply = (words: string) => {
    if (communityStore.addReply(postId, { text: words })) { setText(""); setStatus("Comment added."); }
  };
  return (
    <div className="cm-thread">
      {tucked > 0 && <button type="button" className="cm-view-all" aria-controls={listId} onClick={() => setAll(true)}>View all comments</button>}
      {items.length > 0 ? (
        <ul className="cm-comments" id={listId} aria-label={`Comments on ${label}`}>
          {items.slice(tucked).map(item => {
            const name = item.who ? people[item.who].name : "You";
            return (
              <li key={item.id} className={`cm-comment ${item.mine ? "is-mine cm-msg-in" : ""}`}>
                {item.who ? <Face who={item.who} size={34} /> : <MyFace size={34} />}
                <div className="cm-comment-body">
                  <p><strong>{name}</strong> {item.text}</p>
                  <span className="cm-comment-foot">
                    <CommentVotes voteKey={commentKey(postId, item.id)} base={item.base} whose={item.who ? `${name}'s` : "your"} />
                    {item.mine && <button type="button" className="cm-text-button" onClick={() => communityStore.removeReply(postId, item.id)}>Remove<span className="cm-sr"> your comment</span></button>}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      ) : emptyLine ? <p className="cm-comments-empty">{emptyLine}</p> : null}
      {!canShare ? <SharingLocked what="comment" /> : (<>
      {quickReplies.length > 0 && (
        <div className="cm-quick-row" role="group" aria-label={`Quick comments on ${label}`}>
          {quickReplies.map(words => <button key={words} type="button" className="cm-quick cm-quick-mint" onClick={() => reply(words)}>{words}</button>)}
        </div>
      )}
      <form className="cm-reply" onSubmit={event => { event.preventDefault(); if (text.trim()) reply(text); }}>
        <MyFace size={34} />
        <label className="cm-chat-field">
          <span className="cm-sr">{`Write a comment on ${label}`}</span>
          <input type="text" value={text} maxLength={400} placeholder="Write a comment" autoComplete="off" onChange={event => setText(event.target.value)} />
        </label>
        <button type="submit" className="cm-round cm-round-send cm-round-small" aria-label="Post comment"><ArrowIcon size={20} /></button>
      </form>
      </>)}
      <p className="cm-status" role="status">{status}</p>
    </div>
  );
}

/** "Read posts aloud" in Community settings adds this: the device's own voice reads the post. */
function ListenButton({ text, name }: { text: string; name: string }) {
  const { playing, toggle } = useVoiceNote(text, voiceSeconds(text));
  return (
    <button type="button" className={`cm-listen ${playing ? "is-on" : ""}`} onClick={toggle} aria-label={playing ? `Stop reading ${name}'s post` : `Listen to ${name}'s post`}>
      {playing ? <StopIcon size={16} /> : <SpeakerIcon size={18} />}<span>{playing ? "Stop" : "Listen"}</span>
    </button>
  );
}

/**
 * An example post. `acting` is on while the hide, block or report sheet is open about this post:
 * the post and its ··· button are marked, so it is clear which post the sheet is about.
 */
function SamplePostCard({ post, rise, onMore, acting }: { post: SamplePost; rise: string; onMore: OpenSafetyMenu; acting: boolean }) {
  const memory = useCommunity();
  const replies = memory.replies[post.id] ?? [];
  // Gentle mode covers a sad or upsetting post until it is shown, for this visit.
  const [uncovered, setUncovered] = useState(false);
  const headingId = useId();
  const person = members[post.who];
  const group = post.group ? sampleGroups.find(item => item.id === post.group) : undefined;
  const comments = post.comments.filter(comment => canSee(memory, comment.who));
  const count = comments.length + replies.length;
  const covered = !!post.gentle && memory.settings.gentleMode && !uncovered;
  const quiet = post.reactions.length === 0 && post.quickReplies.length === 0;
  return (
    <article className={`cm-card cm-post ${rise}${acting ? " is-acting" : ""}`} aria-labelledby={headingId}>
      <header className="cm-post-head">
        <MemberFace who={post.who} size={48} />
        <div className="cm-post-who">
          <h3 className="cm-post-name" id={headingId}>
            {isPersonId(post.who) ? <Link className="cm-post-author" href={`~/clinicians/${people[post.who].clinicianId}`}>{person.name}</Link> : person.name}
            {group && <> <span className="cm-post-in">in</span> <Link className="cm-inline-link" href={communityHref("groups", group.id)}>{group.name}</Link></>}
          </h3>
          {isPersonId(post.who) && <p className="cm-post-title">{people[post.who].title}</p>}
          <p className="cm-post-meta">{post.where} · {post.when}</p>
        </div>
        {isPersonId(post.who) && <FriendButton who={post.who} />}
        <button type="button" className="cm-more" aria-label={`More options for ${person.name}'s post`} aria-haspopup="dialog" aria-expanded={acting} onClick={event => onMore({ who: post.who, postId: post.id }, event.currentTarget)}>
          <DotsIcon size={22} />
        </button>
      </header>
      {covered ? (
        <div className="cm-gentle">
          <span className="cm-gentle-icon" aria-hidden="true"><EyeOffIcon size={22} /></span>
          <p>{`${person.name} shares ${post.gentle}. Gentle mode keeps it covered until you choose to read it.`}</p>
          <span className="cm-gentle-actions">
            <button type="button" className="cm-btn cm-btn-outline cm-btn-small" onClick={() => setUncovered(true)}><EyeIcon size={18} />Show the post<span className="cm-sr">{` from ${person.name}`}</span></button>
            <Link className="cm-text-button" href={communityHref("settings", null, { section: "see" })}>Gentle mode settings</Link>
          </span>
        </div>
      ) : (
        <>
          <PostTags win={!!post.win} feeling={null} />
          {post.voice
            ? <VoiceNote words={post.text} seconds={post.voice.seconds} label={`${person.name}'s voice note`} wordsClassName="cm-post-text" />
            : <p className="cm-post-text">{post.text}</p>}
          {memory.settings.readAloud && !post.voice && <ListenButton text={post.text} name={person.name} />}
          {post.photo && <img className="cm-post-photo" src={post.photo.src} alt={post.photo.alt} style={{ backgroundColor: post.photo.tint }} loading="lazy" />}
          {!quiet && (
            <div className="cm-reactions">
              {post.reactions.map(item => <ReactionButton key={item.kind} postId={post.id} kind={item.kind} count={item.count} />)}
              <span className="cm-comment-count"><ChatIcon /><span>{`${count} ${count === 1 ? "comment" : "comments"}`}</span></span>
            </div>
          )}
          <CommentSection postId={post.id} samples={post.comments} label={`${person.name}'s post`} quickReplies={post.quickReplies} />
        </>
      )}
    </article>
  );
}

/** Where a post was, after it was hidden during this visit: what happened, and a way to undo it. */
function HiddenPostNote({ post, why }: { post: SamplePost; why: "blocked" | "muted" | "post" }) {
  const name = members[post.who].name;
  const text = why === "blocked" ? `Post hidden. You blocked ${name}.` : why === "muted" ? `You hid ${name}'s posts.` : `You hid ${name}'s post.`;
  const undo = () => {
    if (why === "blocked") communityStore.unblock(post.who);
    else if (why === "muted") communityStore.unmute(post.who);
    else communityStore.unhidePost(post.id);
  };
  const undoWhat = why === "blocked" ? `, unblock ${name}` : why === "muted" ? `, show ${name}'s posts again` : `, show ${name}'s post again`;
  return (
    <div className="cm-hidden-note cm-pop">
      <span className="cm-hidden-icon" aria-hidden="true"><EyeOffIcon size={20} /></span>
      <p>{text}</p>
      <button type="button" className="cm-text-button" onClick={undo}>Undo<span className="cm-sr">{undoWhat}</span></button>
    </div>
  );
}

/** Posts that mention a word the person chose to hide wait behind this note. */
function HiddenWordsNote({ words, onShow }: { words: string[]; onShow: () => void }) {
  const count = words.length;
  return (
    <div className="cm-words-note">
      <span className="cm-hidden-icon" aria-hidden="true"><EyeOffIcon size={20} /></span>
      <p>{`${count === 1 ? "1 post is" : `${count} posts are`} hidden because ${count === 1 ? "it mentions" : "they mention"} ${listNames(Array.from(new Set(words)).map(word => `“${word}”`))}.`}</p>
      <span className="cm-words-actions">
        <button type="button" className="cm-text-button" onClick={onShow}>Show {count === 1 ? "it" : "them"} this time</button>
        <Link className="cm-text-button" href={communityHref("settings", null, { section: "see" })}>Change your hidden words</Link>
      </span>
    </div>
  );
}

/* ------------------------------------------------------------------- view */

/**
 * F: the feed in the middle, with the Library card and this week's clinician group sessions alongside (the left
 * panel has the person's groups and friends; the lounge and the Sunday circle have their own tabs). Posts
 * from people the person has blocked or hidden, and posts they hid, are left out (with an Undo
 * where one was hidden during this visit); posts mentioning a hidden word wait behind a note.
 * `onMore` opens the hide, block or report sheet from a post's ··· button; `openPostId` is the
 * post that sheet is about while it is open, which is marked.
 */
export default function FeedView({ name, onMore, openPostId = null }: { name: string; here?: number; onMore: OpenSafetyMenu; openPostId?: string | null }) {
  const memory = useCommunity();
  const [showWords, setShowWords] = useState(false);
  // Only clinicians' posts reach the clinician feed (comment 10): the author's role decides, whatever else is in the data.
  const seen = feedPosts.filter(post => isClinician(post.who)).map(post => ({ post, state: postVisibility(memory, post) }));
  const byWords = seen.flatMap(({ state }) => (!state.shown && state.why === "words" && state.word ? [state.word] : []));
  const shown = (state: PostVisibility) => state.shown || (showWords && state.why === "words");
  let rise = 0;
  return (
    <div className="cm-layout">
      <div className="cm-lane">
        <h2 className="cm-sr">Feed</h2>
        <PostComposer name={name} />
        {memory.posts.map(post => <OwnPostCard key={post.id} post={post} name={name} />)}
        {seen.map(({ post, state }) => {
          if (shown(state)) return <SamplePostCard key={post.id} post={post} onMore={onMore} acting={openPostId === post.id} rise={["cm-rise-2", "cm-rise-3", "cm-rise-4"][rise++] ?? "cm-rise-4"} />;
          if (!state.shown && state.why !== "words" && hiddenThisVisit(state.at)) return <HiddenPostNote key={post.id} post={post} why={state.why} />;
          return null;
        })}
        {byWords.length > 0 && !showWords && <HiddenWordsNote words={byWords} onShow={() => setShowWords(true)} />}
      </div>
      <aside className="cm-side" aria-labelledby="cm-side-feed">
        <h2 className="cm-sr" id="cm-side-feed">Your patients</h2>
        {/* My Consultations replaces the Library card (comment 9); the weekly sessions card shows only when the
            clinician runs some (comment 18); the patient edition's guidelines and safety block is not here (comment 19). */}
        <ConsultationsCard />
        <SessionsTile />
      </aside>
    </div>
  );
}
