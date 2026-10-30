import { afterEach, describe, expect, it, vi } from "vitest";
import {
  alertHref,
  alertList,
  alertsQuiet,
  blankCommunityMemory,
  blockedList,
  blockedSince,
  canSee,
  circleSeatsTaken,
  cleanGroupName,
  clockLabel,
  cleanHiddenWord,
  COMMUNITY_KEY,
  commentKey,
  communityHref,
  communityViewFromQuery,
  createCommunityStore,
  daysAgoLabel,
  defaultCommunitySettings,
  firstName,
  friendList,
  friendsHref,
  hiddenPostList,
  hiddenWordIn,
  hourLabel,
  inQuietHours,
  isBlocked,
  leadsHere,
  listNames,
  messagesHref,
  mutedList,
  onBreak,
  parseCommunityMemory,
  pendingRequestCount,
  placeOf,
  postVisibility,
  preparePostPhoto,
  relationship,
  requestList,
  sentList,
  shortWhen,
  timeAgo,
  unreadCount,
  unseenAlertCount,
  viewHref,
} from "./community-store";
import { communityAlerts, feedPosts, inviteFriends, sampleGroups } from "@/content/community-samples";
import { DEFAULT_PICTURE_LOOK } from "@/content/community-pictures";
import { battleOf, withShot, type BattleshipsSave } from "@/components/community/games/battleships-rules";

afterEach(() => { vi.unstubAllGlobals(); });

function memoryStorage(initial?: string) {
  const values = new Map<string, string>();
  if (initial !== undefined) values.set(COMMUNITY_KEY, initial);
  return {
    values,
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
  };
}
const saved = (storage: ReturnType<typeof memoryStorage>) => JSON.parse(storage.values.get(COMMUNITY_KEY) ?? "null");
const NOW = Date.UTC(2026, 9, 6, 10, 0);

describe("comments under every post, and their likes", () => {
  it("takes comments under the example posts, the person's own posts and the Daily question, and keeps them", () => {
    const storage = memoryStorage();
    const store = createCommunityStore(() => storage);
    const post = store.addPost({ text: "Walked to the post box today." }, NOW)!;
    expect(store.addReply(post.id, { text: "And back again!" }, NOW)).not.toBeNull();
    expect(store.addReply("daily-2026-10-12", { text: "Que Sera, Sera" }, NOW)).not.toBeNull();
    expect(store.addReply(feedPosts[1].id, { text: "Lovely!" }, NOW)).not.toBeNull();
    expect(store.addReply("not-a-post", { text: "Hello" }, NOW)).toBeNull();
    const again = createCommunityStore(() => storage).load();
    expect(again.replies[post.id].map(reply => reply.text)).toEqual(["And back again!"]);
    expect(again.replies["daily-2026-10-12"].map(reply => reply.text)).toEqual(["Que Sera, Sera"]);
    expect(Object.keys(again.replies)).toHaveLength(3);
  });

  it("likes or dislikes a comment, one at a time, and the same choice again takes it back", () => {
    const storage = memoryStorage();
    const store = createCommunityStore(() => storage);
    const key = commentKey("p-hannah", "c2");
    store.voteComment(key, "like");
    expect(store.load().commentVotes).toEqual({ [key]: "like" });
    store.voteComment(key, "dislike");
    expect(store.load().commentVotes).toEqual({ [key]: "dislike" });
    expect(createCommunityStore(() => storage).load().commentVotes).toEqual({ [key]: "dislike" });
    store.voteComment(key, "dislike");
    expect(store.load().commentVotes).toEqual({});
    store.voteComment("no slash", "like");
    store.voteComment(commentKey("p-hannah", "c1"), "love" as never);
    expect(store.load().commentVotes).toEqual({});
  });

  it("removes a post's comments and their likes with it, and a comment's like with the comment", () => {
    const store = createCommunityStore(() => memoryStorage());
    const post = store.addPost({ text: "Tea in the garden." }, NOW)!;
    const reply = store.addReply(post.id, { text: "Lovely." }, NOW)!;
    store.voteComment(commentKey(post.id, reply.id), "like");
    const other = store.addReply(feedPosts[1].id, { text: "Well done!" }, NOW)!;
    store.voteComment(commentKey(feedPosts[1].id, other.id), "like");
    store.removePost(post.id);
    expect(store.load().replies[post.id]).toBeUndefined();
    expect(Object.keys(store.load().commentVotes)).toEqual([commentKey(feedPosts[1].id, other.id)]);
    store.removeReply(feedPosts[1].id, other.id);
    expect(store.load().commentVotes).toEqual({});
  });

  it("reads back only known comments and likes, and the Daily questions' answers for the latest days", () => {
    const days = Array.from({ length: 20 }, (_, i) => `daily-2026-09-${String(i + 1).padStart(2, "0")}`);
    const note = (id: string) => [{ id, text: "Hello", createdAt: NOW }];
    const memory = parseCommunityMemory(JSON.stringify({
      replies: { ...Object.fromEntries(days.map(day => [day, note("reply-a")])), "made-up": note("reply-b"), "p-hannah": note("reply-c") },
      commentVotes: { "p-hannah/c1": "like", "p-ruth/reply-x": "dislike", "bad key": "like", "p-grace/c0": "meh" },
    }));
    const daily = Object.keys(memory.replies).filter(key => key.startsWith("daily-")).sort();
    expect(daily).toHaveLength(14);
    expect(daily[0]).toBe("daily-2026-09-07");
    expect(memory.replies["made-up"]).toBeUndefined();
    expect(memory.replies["p-hannah"]).toHaveLength(1);
    expect(memory.commentVotes).toEqual({ "p-hannah/c1": "like", "p-ruth/reply-x": "dislike" });
  });
});

describe("My community addresses", () => {
  it("reads each view from the query string and builds links back to it", () => {
    expect(communityViewFromQuery("")).toEqual({ space: "feed", group: null });
    // The clinician edition has no lounge or poker night: their old addresses open the feed.
    expect(communityViewFromQuery("space=lounge")).toEqual({ space: "feed", group: null });
    expect(communityViewFromQuery("space=poker")).toEqual({ space: "feed", group: null });
    expect(communityViewFromQuery("space=events")).toEqual({ space: "events", group: null });
    expect(communityViewFromQuery("space=circle")).toEqual({ space: "circle", group: null });
    expect(communityViewFromQuery("space=groups&group=walk")).toEqual({ space: "groups", group: "walk" });
    expect(communityViewFromQuery("space=start&group=walk")).toEqual({ space: "start", group: null });
    expect(communityViewFromQuery("space=somewhere")).toEqual({ space: "feed", group: null });
    expect(communityViewFromQuery("space=groups&group=../../etc")).toEqual({ space: "groups", group: null });
    expect(communityHref()).toBe("/community");
    expect(communityHref("feed")).toBe("/community");
    expect(communityHref("lounge")).toBe("/community");
    expect(communityHref("poker")).toBe("/community");
    expect(communityHref("events")).toBe("/community?space=events");
    expect(communityHref("groups", "garden")).toBe("/community?space=groups&group=garden");
    expect(communityHref("groups", "<script>")).toBe("/community?space=groups");
    expect(communityHref("start", "garden")).toBe("/community?space=start");
    expect(communityViewFromQuery(communityHref("groups", "mine-abc").split("?")[1])).toEqual({ space: "groups", group: "mine-abc" });
  });

  it("has addresses for settings, safety and the Friends drawer over any view", () => {
    expect(communityViewFromQuery("space=settings")).toEqual({ space: "settings", group: null });
    expect(communityViewFromQuery("space=safety")).toEqual({ space: "safety", group: null });
    expect(communityHref("settings")).toBe("/community?space=settings");
    expect(communityHref("safety")).toBe("/community?space=safety");

    expect(communityViewFromQuery("panel=friends")).toEqual({ space: "feed", group: null, panel: "friends", tab: "requests" });
    expect(communityViewFromQuery("space=events&panel=friends&tab=sent")).toEqual({ space: "events", group: null, panel: "friends", tab: "sent" });
    expect(communityViewFromQuery("space=lounge&panel=friends&tab=sent")).toEqual({ space: "feed", group: null, panel: "friends", tab: "sent" });
    expect(communityViewFromQuery("space=groups&group=walk&panel=friends&tab=blocked")).toEqual({ space: "groups", group: "walk", panel: "friends", tab: "blocked" });
    expect(communityViewFromQuery("panel=friends&tab=enemies")).toMatchObject({ panel: "friends", tab: "requests" });
    expect(communityViewFromQuery("panel=secrets&tab=sent")).toEqual({ space: "feed", group: null });

    expect(communityHref(null, null, { panel: "friends" })).toBe("/community?panel=friends");
    expect(communityHref("events", null, { panel: "friends", tab: "sent" })).toBe("/community?space=events&panel=friends&tab=sent");
    expect(communityHref("lounge", null, { panel: "friends", tab: "sent" })).toBe("/community?panel=friends&tab=sent");
    expect(communityHref("groups", "walk", { panel: "friends", tab: "requests" })).toBe("/community?space=groups&group=walk&panel=friends");
    expect(communityHref("settings", null, { panel: null, tab: "sent" })).toBe("/community?space=settings");
    expect(friendsHref()).toBe("/community?panel=friends");
    expect(friendsHref("blocked", { space: "safety", group: null })).toBe("/community?space=safety&panel=friends&tab=blocked");

    const view = communityViewFromQuery("space=groups&group=garden&panel=friends&tab=friends");
    expect(placeOf(view)).toEqual({ space: "groups", group: "garden" });
    expect(communityViewFromQuery(friendsHref(view.tab, placeOf(view)).split("?")[1])).toEqual(view);
  });

  it("names a section of Community settings, and only there", () => {
    expect(communityViewFromQuery("space=settings&section=quiet")).toEqual({ space: "settings", group: null, section: "quiet" });
    expect(communityViewFromQuery("space=settings&section=secrets")).toEqual({ space: "settings", group: null });
    expect(communityViewFromQuery("space=safety&section=quiet")).toEqual({ space: "safety", group: null });
    expect(communityViewFromQuery("section=see")).toEqual({ space: "feed", group: null });
    expect(communityHref("settings", null, { section: "quiet" })).toBe("/community?space=settings&section=quiet");
    expect(communityHref("settings", null, { section: "friends", panel: "friends", tab: "sent" })).toBe("/community?space=settings&section=friends&panel=friends&tab=sent");
    expect(communityHref("safety", null, { section: "quiet" })).toBe("/community?space=safety");
    for (const query of ["space=settings&section=see", "space=settings&section=friends&panel=friends&tab=sent", "space=groups&group=walk&panel=friends", "", "space=events"]) {
      expect(viewHref(communityViewFromQuery(query))).toBe(query ? `/community?${query}` : "/community");
    }
    expect(viewHref(communityViewFromQuery("space=lounge"))).toBe("/community");
  });

  it("knows when a link leads to the view already showing", () => {
    expect(leadsHere("/community", "")).toBe(true);
    expect(leadsHere("/community", "space=events")).toBe(false);
    // An old lounge address shows the feed, so a link to the feed leads there.
    expect(leadsHere("/community", "space=lounge")).toBe(true);
    expect(leadsHere("/community?space=settings&section=quiet", "space=settings")).toBe(true);
    expect(leadsHere("/community?space=settings", "space=settings&section=see")).toBe(true);
    expect(leadsHere("/community?space=settings&section=friends", "space=settings&panel=friends")).toBe(false);
    expect(leadsHere("/community?space=groups&group=walk", "space=groups&group=walk")).toBe(true);
    expect(leadsHere("/community?space=groups&group=garden", "space=groups&group=walk")).toBe(false);
    expect(leadsHere("/community?panel=friends&tab=sent", "panel=friends&tab=sent")).toBe(true);
    expect(leadsHere("/community?panel=friends&tab=sent", "panel=friends")).toBe(false);
    expect(leadsHere("/alira", "")).toBe(false);
    expect(leadsHere("/community-art/face.svg", "")).toBe(false);
  });

  it("sends each alert to the right place", () => {
    const over = { space: "events" as const, group: null };
    const href = (id: string) => alertHref(communityAlerts.find(alert => alert.id === id)!, over);
    expect(href("a-ruth")).toBe("/community?space=events&panel=friends");
    expect(href("a-michael")).toBe("/community?space=events&panel=friends");
    expect(alertHref(communityAlerts.find(alert => alert.id === "a-ruth")!, { space: "lounge", group: null })).toBe("/community?panel=friends");
    expect(href("a-garden")).toBe("/community?space=groups&group=garden");
    expect(href("a-circle")).toBe("/community?space=circle");
  });
});

describe("loading what was saved", () => {
  it("starts afresh from missing, broken or unexpected data", () => {
    for (const raw of [null, "", "{broken", "null", "42", "\"text\"", "[]"]) expect(parseCommunityMemory(raw)).toEqual(blankCommunityMemory());
    const store = createCommunityStore(() => memoryStorage("{not json"));
    expect(store.load()).toEqual(blankCommunityMemory());
  });

  it("rebuilds only the fields and values it knows", () => {
    const post = feedPosts[0].id;
    const memory = parseCommunityMemory(JSON.stringify({
      extra: "ignored",
      reactions: [`${post}:love`, `${post}:love`, `${post}:shout`, "p-nobody:love", `${post}:love:again`, 7],
      hearts: ["lounge:l1", "group:garden:g2", "javascript:alert(1)", { key: "lounge:l2" }],
      friends: ["hannah", "zak", "__proto__"],
      waves: "tomas",
      vote: "whisky",
      seated: "yes",
      reminders: ["film-2026-10-08", "words", "midnight-2026-10-08"],
      joined: ["knit", "garden"],
      read: ["garden", "knit"],
      challenges: ["walk", "mine-gone", "book"],
      started: [
        { id: "mine-one", name: "  Tea   and  cake  ", theme: "chatting", friends: ["ruth", "tomas", "ruth"], open: true, createdAt: NOW, hello: "Please introduce yourself and your service." },
        { id: "mine-two", name: "", theme: "skydiving", friends: [], createdAt: NOW },
        { id: "not-mine", name: "Taken", theme: "books", friends: [], createdAt: NOW },
        { id: "mine-three", name: "x".repeat(90), theme: "books", friends: "everyone", createdAt: "yesterday" },
        { id: "mine-four", name: "Readers", theme: "books", friends: [], createdAt: NOW, hello: "Buy now!" },
      ],
      posts: [
        { id: "post-a", text: "  Tomatoes!  ", createdAt: NOW, photo: "https://example.com/spy.png", voice: true, feeling: "proud", win: true, owner: "someone" },
        { id: "post-b", text: "", createdAt: NOW, photo: null },
        { id: "post-c", text: "No date" },
        { id: "POST D", text: "Bad id", createdAt: NOW },
        { id: "post-e", text: "Feeling odd", createdAt: NOW, feeling: "giddy", voice: "yes" },
      ],
      replies: { [post]: [{ id: "reply-1", text: "Lovely", createdAt: NOW }, { id: "reply-1", text: "Twice", createdAt: NOW }], "p-nobody": [{ id: "reply-2", text: "Hi", createdAt: NOW }] },
      messages: { garden: [{ id: "note-1", text: "Hello", createdAt: NOW, voice: true }], "mine-one": [{ id: "note-2", text: "", createdAt: NOW, photo: "data:image/svg+xml;base64,PHN2Zz4=" }], unknown: [{ id: "note-3", text: "Hi", createdAt: NOW }] },
    }));

    expect(memory).not.toHaveProperty("extra");
    expect(memory.reactions).toEqual([`${post}:love`]);
    expect(memory.hearts).toEqual(["lounge:l1", "group:garden:g2"]);
    expect(memory.friends).toEqual(["hannah"]);
    expect(memory.waves).toEqual([]);
    expect(memory.vote).toBeNull();
    expect(memory.seated).toBe(false);
    expect(memory.reminders).toEqual(["film-2026-10-08"]);
    expect(memory.joined).toEqual(["knit"]);
    expect(memory.read).toEqual(["garden"]);
    expect(memory.started.map(group => group.id)).toEqual(["mine-one", "mine-four"]);
    // Saved before conditions and privacy: it sits in Stroke, and "anyone can ask to join" became public (so no games).
    expect(memory.started[0]).toEqual({ id: "mine-one", name: "Tea and cake", theme: "chatting", friends: ["ruth"], createdAt: NOW, hello: "Please introduce yourself and your service.", conditionId: "stroke", visibility: "public", games: false });
    expect(memory.started[1].hello).toBeNull();
    expect(memory.challenges).toEqual(["walk", "book"]);
    expect(memory.posts).toEqual([
      { id: "post-a", text: "Tomatoes!", createdAt: NOW, photo: null, voice: true, feeling: "proud", win: true },
      { id: "post-e", text: "Feeling odd", createdAt: NOW, photo: null, voice: false, feeling: null, win: false },
    ]);
    expect(memory.replies).toEqual({ [post]: [{ id: "reply-1", text: "Lovely", createdAt: NOW, photo: null, voice: false }] });
    expect(memory.messages).toEqual({ garden: [{ id: "note-1", text: "Hello", createdAt: NOW, photo: null, voice: true }] });
  });

  it("keeps a group name readable and short", () => {
    expect(cleanGroupName("  Morning   walkers ")).toBe("Morning walkers");
    expect(cleanGroupName("   ")).toBe("Your group");
    expect(cleanGroupName(undefined)).toBe("Your group");
    expect(cleanGroupName("y".repeat(80))).toHaveLength(40);
  });
});

describe("when the browser blocks storage", () => {
  it("still works for the visit when reading and writing both fail", () => {
    const blocked = { getItem: () => { throw new Error("SecurityError"); }, setItem: () => { throw new Error("SecurityError"); } };
    const store = createCommunityStore(() => blocked);
    expect(store.load()).toEqual(blankCommunityMemory());
    store.toggleReaction(feedPosts[1].id, "withyou");
    store.vote("tea");
    store.takeSeat();
    const group = store.startGroup({ name: "Night owls", theme: "chatting", friends: ["grace"], open: false }, NOW);
    expect(store.load().reactions).toEqual([`${feedPosts[1].id}:withyou`]);
    expect(store.load().vote).toBe("tea");
    expect(store.load().seated).toBe(true);
    expect(store.load().started[0]).toMatchObject({ id: group.id, name: "Night owls" });
  });

  it("works without any storage, and when even reaching storage throws", () => {
    const none = createCommunityStore(() => null);
    none.toggleJoined("knit");
    expect(none.load().joined).toEqual(["knit"]);
    const throwing = createCommunityStore(() => { throw new Error("denied"); });
    expect(throwing.load()).toEqual(blankCommunityMemory());
    throwing.toggleFriend("kwame");
    expect(throwing.load().friends).toEqual(["kwame"]);
  });

  it("keeps what was done when storage is full", () => {
    const storage = memoryStorage(JSON.stringify({ friends: ["ruth"] }));
    const store = createCommunityStore(() => ({ getItem: storage.getItem, setItem: () => { throw new Error("QuotaExceededError"); } }));
    store.toggleFriend("grace");
    expect(store.load().friends).toEqual(["ruth", "grace"]);
  });

  it("says whether the last change reached storage, so Settings never claims a save that failed", () => {
    let full = false;
    const storage = memoryStorage(JSON.stringify({ friends: ["ruth"] }));
    const store = createCommunityStore(() => ({ getItem: storage.getItem, setItem: (key: string, value: string) => { if (full) throw new Error("QuotaExceededError"); storage.setItem(key, value); } }));
    store.updateSettings({ textSize: "bigger" });
    expect(store.lastSaveKept()).toBe(true);
    full = true;
    store.updateSettings({ textSize: "smaller" });
    // The old record is still in storage, but this change isn't: it lasts for the visit only.
    expect(store.lastSaveKept()).toBe(false);
    expect(store.load().settings.textSize).toBe("smaller");
    expect(saved(storage).settings.textSize).toBe("bigger");
    full = false;
    store.updateSettings({ textSize: "normal" });
    expect(store.lastSaveKept()).toBe(true);
    expect(createCommunityStore(() => null).lastSaveKept()).toBe(true);
    const none = createCommunityStore(() => null);
    none.updateSettings({ gentleMode: false });
    expect(none.lastSaveKept()).toBe(false);
  });
});

describe("reactions", () => {
  it("switch on with one tap and off with another, and are remembered", () => {
    const storage = memoryStorage();
    const store = createCommunityStore(() => storage);
    const heard = vi.fn();
    store.subscribe(heard);
    const post = feedPosts[0].id;

    store.toggleReaction(post, "love");
    store.toggleReaction(post, "welldone");
    expect(store.hasReaction(post, "love")).toBe(true);
    expect(saved(storage).reactions).toEqual([`${post}:love`, `${post}:welldone`]);
    expect(createCommunityStore(() => storage).load().reactions).toEqual([`${post}:love`, `${post}:welldone`]);

    store.toggleReaction(post, "love");
    expect(store.hasReaction(post, "love")).toBe(false);
    expect(saved(storage).reactions).toEqual([`${post}:welldone`]);
    expect(heard).toHaveBeenCalledTimes(3);
  });

  it("ignores posts it doesn't know and keeps the same snapshot when nothing changes", () => {
    const store = createCommunityStore(() => memoryStorage());
    const before = store.load();
    expect(store.toggleReaction("p-nobody", "love")).toBe(before);
    expect(store.load()).toBe(before);
    expect(store.toggleHeart("not a key")).toBe(before);
    store.toggleHeart("lounge:l1");
    expect(store.load().hearts).toEqual(["lounge:l1"]);
    store.toggleHeart("lounge:l1");
    expect(store.load().hearts).toEqual([]);
  });

  it("keeps waves and the poll vote, and a wave can't be taken back", () => {
    const storage = memoryStorage();
    const store = createCommunityStore(() => storage);
    store.wave("priya");
    store.wave("priya");
    store.vote("coffee");
    store.vote("not-a-drink");
    expect(saved(storage)).toMatchObject({ waves: ["priya"], vote: "coffee" });
  });
});

describe("groups", () => {
  it("joins and leaves suggested groups", () => {
    const storage = memoryStorage();
    const store = createCommunityStore(() => storage);
    store.toggleJoined("knit");
    store.toggleJoined("book");
    expect(store.load().joined).toEqual(["knit", "book"]);
    store.toggleJoined("knit");
    expect(createCommunityStore(() => storage).load().joined).toEqual(["book"]);
  });

  it("clears unread badges and remembers the weekly challenge", () => {
    const store = createCommunityStore(() => memoryStorage());
    const waiting = sampleGroups.reduce((sum, group) => sum + group.unread, 0);
    expect(unreadCount(store.load())).toBe(waiting);
    store.markRead("garden");
    store.markRead("garden");
    store.markRead("mine-unknown");
    expect(store.load().read).toEqual(["garden"]);
    expect(unreadCount(store.load())).toBe(waiting - 3);
    store.toggleChallenge("walk");
    expect(store.load().challenges).toEqual(["walk"]);
    store.toggleChallenge("walk");
    expect(store.load().challenges).toEqual([]);
  });

  it("starts a group, says hello in it, changes who is invited, and closes it", () => {
    const storage = memoryStorage();
    const store = createCommunityStore(() => storage);
    const group = store.startGroup({ name: "  Green   fingers  ", theme: "gardening", friends: ["hannah", "tomas" as never, "ruth"], open: true }, NOW);
    expect(group).toMatchObject({ name: "Green fingers", theme: "gardening", friends: ["hannah", "ruth"], visibility: "public", games: false, conditionId: "stroke", createdAt: NOW, hello: null });
    expect(group.id).toMatch(/^mine-[a-z0-9-]+$/);
    expect(communityViewFromQuery(communityHref("groups", group.id).split("?")[1]).group).toBe(group.id);

    const second = store.startGroup({ name: "", theme: "books", friends: [], open: false }, NOW + 1000);
    expect(second.name).toBe("Your group");
    expect(second.id).not.toBe(group.id);
    expect(store.load().started.map(item => item.id)).toEqual([second.id, group.id]);

    store.setGroupHello(group.id, "Welcome, everyone.");
    store.setGroupHello(second.id, "Something else");
    store.toggleGroupFriend(group.id, "grace");
    store.toggleGroupFriend(group.id, "hannah");
    expect(store.addMessage(group.id, { text: "First!" }, NOW + 2000)).toMatchObject({ text: "First!", voice: false, photo: null });
    store.toggleChallenge(group.id);

    const reloaded = createCommunityStore(() => storage).load();
    expect(reloaded.started.find(item => item.id === group.id)).toMatchObject({ hello: "Welcome, everyone.", friends: ["ruth", "grace"] });
    expect(reloaded.started.find(item => item.id === second.id)?.hello).toBeNull();
    expect(reloaded.messages[group.id]).toHaveLength(1);
    expect(reloaded.challenges).toEqual([group.id]);
    expect(inviteFriends).toContain("grace");

    store.closeGroup(group.id);
    const after = createCommunityStore(() => storage).load();
    expect(after.started.map(item => item.id)).toEqual([second.id]);
    expect(after.messages[group.id]).toBeUndefined();
    expect(after.challenges).toEqual([]);
  });

  it("only keeps messages for groups the person is in", () => {
    const store = createCommunityStore(() => memoryStorage());
    expect(store.addMessage("mine-missing", { text: "Hello?" })).toBeNull();
    expect(store.addMessage("garden", { text: "   " })).toBeNull();
    const voice = store.addMessage("garden", { text: "Say it for me", voice: true }, NOW);
    expect(voice).toMatchObject({ text: "Say it for me", voice: true });
    store.removeMessage("garden", voice!.id);
    expect(store.load().messages).toEqual({});
  });
});

describe("what the person writes", () => {
  it("keeps posts on this device, newest first, and lets them go", () => {
    const storage = memoryStorage();
    const store = createCommunityStore(() => storage);
    expect(store.addPost({ text: "   " })).toBeNull();
    expect(store.addPost({ text: "", photo: "https://example.com/a.png" })).toBeNull();
    const first = store.addPost({ text: "A walk to the gate.", win: true, feeling: "proud" }, NOW);
    const second = store.addPost({ text: "", voice: true, photo: "data:image/jpeg;base64,YQ==" }, NOW + 1);
    expect(first).toMatchObject({ win: true, feeling: "proud", voice: false, photo: null });
    expect(second).toMatchObject({ text: "", voice: false, photo: "data:image/jpeg;base64,YQ==" });
    expect(saved(storage).posts.map((post: { id: string }) => post.id)).toEqual([second!.id, first!.id]);
    store.removePost(first!.id);
    expect(createCommunityStore(() => storage).load().posts.map(post => post.id)).toEqual([second!.id]);
  });

  it("keeps replies under the example posts only", () => {
    const store = createCommunityStore(() => memoryStorage());
    const post = feedPosts[1].id;
    expect(store.addReply("p-nobody", { text: "Hi" })).toBeNull();
    const reply = store.addReply(post, { text: "  You're not alone.  " }, NOW);
    expect(reply?.text).toBe("You're not alone.");
    expect(store.load().replies[post]).toHaveLength(1);
    store.removeReply(post, reply!.id);
    expect(store.load().replies).toEqual({});
  });

  it("remembers the seat in the circle and reminders", () => {
    const storage = memoryStorage();
    const store = createCommunityStore(() => storage);
    expect(store.justSeated(NOW)).toBe(false);
    store.takeSeat();
    expect(store.justSeated()).toBe(true);
    store.toggleReminder("books-2026-10-10");
    store.toggleReminder("never");
    store.toggleReminder("words");
    expect(createCommunityStore(() => storage).load()).toMatchObject({ seated: true, reminders: ["books-2026-10-10"] });
  });
});

describe("small helpers", () => {
  it("says when, and lists names, in plain English", () => {
    expect(timeAgo(NOW, NOW + 20_000)).toBe("Just now");
    expect(timeAgo(NOW, NOW + 60_000)).toBe("1 minute ago");
    expect(timeAgo(NOW, NOW + 5 * 60_000)).toBe("5 minutes ago");
    expect(timeAgo(NOW, NOW + 3 * 3_600_000)).toBe("3 hours ago");
    expect(timeAgo(NOW, NOW + 30 * 3_600_000)).toBe("Yesterday");
    expect(timeAgo(NOW, NOW + 5 * 86_400_000)).toMatch(/^\d{1,2} October$/);
    expect(listNames([])).toBe("");
    expect(listNames(["Margaret"])).toBe("Margaret");
    expect(listNames(["Margaret", "Joan"])).toBe("Margaret and Joan");
    expect(listNames(["Margaret", "Joan", "Anne"])).toBe("Margaret, Joan and Anne");
    expect(firstName("  Zak Ahmed ")).toBe("Zak");
    expect(firstName("")).toBe("there");
  });
});

describe("friends", () => {
  it("starts with four connections, two requests waiting, one sent and Gary blocked", () => {
    const memory = blankCommunityMemory();
    expect(friendList(memory).map(friend => friend.who)).toEqual(["kwame", "hannah", "grace", "imani"]);
    expect(requestList(memory).map(entry => [entry.request.who, entry.answer])).toEqual([["ruth", null], ["michael", null]]);
    expect(pendingRequestCount(memory)).toBe(2);
    expect(sentList(memory, NOW)).toEqual([{ who: "tomas", at: NOW - 2 * 86_400_000, beforeVisit: true }]);
    expect(relationship(memory, "kwame")).toBe("friend");
    expect(relationship(memory, "ruth")).toBe("incoming");
    expect(relationship(memory, "tomas")).toBe("sent");
    expect(relationship(memory, "priya")).toBe("none");
    expect(relationship(memory, "gary")).toBe("blocked");
  });

  it("accepts, declines and takes an answer back, and the Friends badge agrees", () => {
    const storage = memoryStorage();
    const store = createCommunityStore(() => storage);
    store.acceptRequest("ruth");
    store.declineRequest("michael");
    let memory = createCommunityStore(() => storage).load();
    expect(memory.answers).toEqual({ ruth: "accepted", michael: "declined" });
    expect(pendingRequestCount(memory)).toBe(0);
    expect(friendList(memory).map(friend => friend.who)).toEqual(["kwame", "hannah", "grace", "imani", "ruth"]);
    expect(friendList(memory)[4]).toMatchObject({ isNew: true, status: "New connection" });
    expect(relationship(memory, "michael")).toBe("none");
    store.undoAnswer("michael");
    memory = store.load();
    expect(relationship(memory, "michael")).toBe("incoming");
    expect(pendingRequestCount(memory)).toBe(1);
    // A wave to a new friend is the same wave as anywhere else.
    store.wave("ruth");
    expect(store.load().waves).toEqual(["ruth"]);
  });

  it("sends and cancels requests, so the Add friend buttons and the Sent tab agree", () => {
    const storage = memoryStorage();
    const store = createCommunityStore(() => storage);
    store.requestFriend("priya", NOW);
    store.requestFriend("kwame", NOW);
    expect(relationship(store.load(), "priya")).toBe("sent");
    expect(store.load().friends).toEqual(["priya"]);
    expect(sentList(store.load(), NOW + 1000).map(entry => entry.who)).toEqual(["priya", "tomas"]);

    store.cancelRequest("tomas");
    store.cancelRequest("priya");
    store.cancelRequest("kwame");
    let memory = createCommunityStore(() => storage).load();
    expect(memory.cancelled).toEqual(["tomas"]);
    expect(memory.friends).toEqual([]);
    expect(memory.sentAt).toEqual({});
    expect(sentList(memory)).toEqual([]);

    // Undo in the Sent tab sends it again.
    store.requestFriend("tomas", NOW);
    memory = store.load();
    expect(memory.cancelled).toEqual([]);
    expect(sentList(memory, NOW).map(entry => entry.who)).toEqual(["tomas"]);

    // Asking someone who is already asking says yes, even after "Not now".
    store.declineRequest("ruth");
    store.requestFriend("ruth", NOW);
    expect(relationship(store.load(), "ruth")).toBe("friend");
  });

  it("keeps the low-level toggle working, with the time it was sent", () => {
    const store = createCommunityStore(() => memoryStorage());
    store.toggleFriend("joseph", NOW);
    expect(store.load()).toMatchObject({ friends: ["joseph"], sentAt: { joseph: NOW } });
    store.toggleFriend("joseph", NOW);
    expect(store.load().friends).toEqual([]);
    expect(store.load().sentAt).toEqual({});
  });
});

describe("blocking, hiding and reporting", () => {
  it("unblocks Gary, who was blocked to begin with, and remembers it", () => {
    const storage = memoryStorage();
    const store = createCommunityStore(() => storage);
    expect(blockedList(store.load(), NOW)).toEqual([{ who: "gary", at: NOW - 3 * 86_400_000 }]);
    expect(blockedSince(store.load(), "gary", NOW)).toBe(NOW - 3 * 86_400_000);
    store.unblock("gary");
    expect(saved(storage).blocks).toEqual({ gary: 0 });
    const reloaded = createCommunityStore(() => storage).load();
    expect(isBlocked(reloaded, "gary")).toBe(false);
    expect(blockedList(reloaded)).toEqual([]);
    expect(postVisibility(reloaded, feedPosts[0])).toEqual({ shown: true });
    store.block("gary", NOW);
    expect(store.load().blocks).toEqual({ gary: NOW });
    expect(blockedSince(store.load(), "gary")).toBe(NOW);
  });

  it("blocks and unblocks anyone, hiding them from friends and requests", () => {
    const store = createCommunityStore(() => memoryStorage());
    store.block("hannah", NOW);
    store.block("ruth", NOW + 1);
    store.block("hannah", NOW + 5);
    let memory = store.load();
    expect(blockedList(memory, NOW).map(entry => entry.who)).toEqual(["ruth", "hannah", "gary"]);
    expect(relationship(memory, "hannah")).toBe("blocked");
    expect(friendList(memory).map(friend => friend.who)).toEqual(["kwame", "grace", "imani"]);
    expect(pendingRequestCount(memory)).toBe(1);
    expect(canSee(memory, "hannah")).toBe(false);
    store.acceptRequest("ruth");
    expect(store.load().answers).toEqual({});
    store.unblock("hannah");
    memory = store.load();
    expect(memory.blocks).toEqual({ ruth: NOW + 1 });
    expect(relationship(memory, "hannah")).toBe("friend");
  });

  it("hides someone's posts, or a single post, and shows them again", () => {
    const storage = memoryStorage();
    const store = createCommunityStore(() => storage);
    const hannah = feedPosts.find(post => post.who === "hannah")!;
    const tomas = feedPosts.find(post => post.who === "tomas")!;
    store.mute("hannah", NOW);
    store.hidePost(tomas.id, NOW + 1);
    store.hidePost("p-nobody", NOW);
    let memory = createCommunityStore(() => storage).load();
    expect(mutedList(memory)).toEqual([{ who: "hannah", at: NOW }]);
    expect(hiddenPostList(memory)).toEqual([{ postId: tomas.id, at: NOW + 1 }]);
    expect(postVisibility(memory, hannah)).toEqual({ shown: false, why: "muted", at: NOW, word: null });
    expect(postVisibility(memory, tomas)).toEqual({ shown: false, why: "post", at: NOW + 1, word: null });
    expect(canSee(memory, "hannah")).toBe(false);
    expect(relationship(memory, "hannah")).toBe("friend");
    store.unmute("hannah");
    store.unhidePost(tomas.id);
    memory = store.load();
    expect(memory.muted).toEqual({});
    expect(memory.hiddenPosts).toEqual({});
    expect(postVisibility(memory, hannah)).toEqual({ shown: true });
  });

  it("hides posts that mention a hidden word, at the start of a word", () => {
    expect(hiddenWordIn("Back at the hospital today", ["hospital", "falls"])).toBe("hospital");
    expect(hiddenWordIn("Hospitals are busy", ["hospital"])).toBe("hospital");
    expect(hiddenWordIn("He FALLS asleep", ["falls"])).toBe("falls");
    expect(hiddenWordIn("A secure handrail", ["cure"])).toBeNull();
    expect(hiddenWordIn("Cured!", ["cure"])).toBe("cure");
    expect(hiddenWordIn("Nothing here", [])).toBeNull();
    // The clinician edition starts with no hidden words, so every example clinician's post shows.
    const tomas = feedPosts.find(post => post.who === "tomas")!;
    expect(postVisibility(blankCommunityMemory(), tomas)).toEqual({ shown: true });
    const hiding = blankCommunityMemory();
    hiding.settings.hiddenWords = ["anticoagulation"];
    expect(postVisibility(hiding, tomas)).toEqual({ shown: false, why: "words", at: 0, word: "anticoagulation" });
  });

  it("keeps reports on this device, blocking too when asked", () => {
    const storage = memoryStorage();
    const store = createCommunityStore(() => storage);
    expect(store.report({ who: "nobody" as never, reason: "money" })).toBeNull();
    expect(store.report({ who: "kwame", reason: "shouting" as never })).toBeNull();
    const first = store.report({ who: "priya", postId: "p-priya", reason: "unkind", note: "  Not   kind  " }, NOW);
    const second = store.report({ who: "gary", postId: "p-unknown", reason: "health", alsoBlock: true }, NOW + 1);
    expect(first).toMatchObject({ who: "priya", postId: "p-priya", reason: "unkind", note: "Not kind", alsoBlock: false, createdAt: NOW });
    expect(second).toMatchObject({ who: "gary", postId: null, alsoBlock: true });
    const memory = createCommunityStore(() => storage).load();
    expect(memory.reports.map(report => report.id)).toEqual([second!.id, first!.id]);
    expect(isBlocked(memory, "priya")).toBe(false);
    store.report({ who: "joseph", reason: "other", alsoBlock: true }, NOW + 2);
    expect(isBlocked(store.load(), "joseph")).toBe(true);
    expect(store.load().hiddenPosts).toEqual({});
    store.removeReport(first!.id);
    expect(store.load().reports.map(report => report.id)).not.toContain(first!.id);
  });
});

describe("alerts", () => {
  it("counts new alerts until they are seen, or dealt with", () => {
    const store = createCommunityStore(() => memoryStorage());
    expect(unseenAlertCount(store.load())).toBe(4);
    store.markAlertsSeen(["a-circle"]);
    expect(unseenAlertCount(store.load())).toBe(3);
    store.acceptRequest("ruth");
    store.markRead("garden");
    expect(alertList(store.load()).filter(entry => entry.isNew).map(entry => entry.alert.id)).toEqual(["a-michael"]);
    store.markAlertsSeen();
    expect(unseenAlertCount(store.load())).toBe(0);
    expect(store.load().seenAlerts).toEqual(["a-circle", "a-ruth", "a-garden", "a-michael"]);
  });

  it("treats the circle alert as done once the seat is taken", () => {
    const store = createCommunityStore(() => memoryStorage());
    store.takeSeat();
    expect(alertList(store.load()).find(entry => entry.alert.id === "a-circle")?.isNew).toBe(false);
  });
});

describe("community settings", () => {
  it("starts with the designed defaults", () => {
    expect(blankCommunityMemory().settings).toEqual({
      showTown: true, showOnline: true, picture: "drawn", look: DEFAULT_PICTURE_LOOK, about: "", requestsFrom: "everyone", messagesFrom: "friends", postsSeenBy: "friends",
      gentleMode: true, showHeartCounts: true, hiddenWords: [], readAloud: false, writeOutVoiceNotes: true,
      textSize: "normal", quietFrom: 21, quietUntil: 8, breakChoice: "none", breakUntil: null,
    });
  });

  it("keeps the picture chosen with its look, and the words about the person, checking each", () => {
    const storage = memoryStorage();
    const store = createCommunityStore(() => storage);
    const portrait = { hair: "black", hairStyle: "cropped", skin: "deep", top: "teal", bg: "peach", glasses: true } as const;
    store.updateSettings({ picture: "portrait", look: { ...DEFAULT_PICTURE_LOOK, portrait }, about: "  Gardener,   grandmother   and proud owner of tomatoes. " });
    const kept = createCommunityStore(() => storage).load().settings;
    expect(kept.picture).toBe("portrait");
    expect(kept.look.portrait).toEqual(portrait);
    expect(kept.about).toBe("Gardener, grandmother and proud owner of tomatoes.");
    // Anything not allowed keeps what was there, field by field; the words are cut at 160 characters.
    store.updateSettings({ picture: "selfie" as never, look: { ...kept.look, monogram: "neon" as never, emblem: "cup", portrait: { ...portrait, skin: "blue" as never } } as never, about: "x".repeat(400) });
    const checked = createCommunityStore(() => storage).load().settings;
    expect(checked.picture).toBe("portrait");
    expect(checked.look).toEqual({ ...DEFAULT_PICTURE_LOOK, portrait });
    expect(checked.about).toHaveLength(160);
    for (const picture of ["photo", "initial", "emblem", "illustrated", "drawn"] as const) {
      store.updateSettings({ picture });
      expect(createCommunityStore(() => storage).load().settings.picture).toBe(picture);
    }
  });

  it("checks every change and remembers it", () => {
    const storage = memoryStorage();
    const store = createCommunityStore(() => storage);
    store.updateSettings({ gentleMode: false, textSize: "bigger", picture: "initial", quietFrom: 22 });
    store.updateSettings({ textSize: "huge" as never, quietFrom: 3, requestsFrom: "noOne", showOnline: "yes" as never });
    const settings = createCommunityStore(() => storage).load().settings;
    expect(settings).toMatchObject({ gentleMode: false, textSize: "bigger", picture: "initial", quietFrom: 22, requestsFrom: "noOne", showOnline: true });
    // Who can see my posts: one of Everyone, Friends or Only me, and nothing else.
    store.updateSettings({ postsSeenBy: "everyone" });
    store.updateSettings({ postsSeenBy: "strangers" as never });
    expect(createCommunityStore(() => storage).load().settings.postsSeenBy).toBe("everyone");
    store.updateSettings({ postsSeenBy: "onlyMe" });
    expect(createCommunityStore(() => storage).load().settings.postsSeenBy).toBe("onlyMe");
    const before = store.load();
    expect(store.updateSettings({ textSize: "bigger" })).toBe(before);
    store.resetSettings();
    expect(store.load().settings).toEqual(defaultCommunitySettings());
  });

  it("adds and removes hidden words, cleanly", () => {
    const store = createCommunityStore(() => memoryStorage());
    expect(cleanHiddenWord("  Money  Talk ")).toBe("money talk");
    expect(cleanHiddenWord("<b>")).toBe("");
    expect(store.addHiddenWord("Cure")).toBe(true);
    expect(store.addHiddenWord("cure")).toBe(false);
    expect(store.addHiddenWord("   ")).toBe(false);
    expect(store.addHiddenWord("Sponsored")).toBe(true);
    expect(store.load().settings.hiddenWords).toEqual(["cure", "sponsored"]);
    store.removeHiddenWord("cure");
    expect(store.load().settings.hiddenWords).toEqual(["sponsored"]);
    for (let i = 0; i < 30; i++) store.addHiddenWord(`word${i}`);
    expect(store.load().settings.hiddenWords).toHaveLength(20);
  });

  it("takes a break of a day or a week, and ends it", () => {
    const store = createCommunityStore(() => memoryStorage());
    store.takeBreak("day", NOW);
    expect(store.load().settings).toMatchObject({ breakChoice: "day", breakUntil: NOW + 86_400_000 });
    expect(onBreak(store.load().settings, NOW + 1000)).toBe(true);
    expect(onBreak(store.load().settings, NOW + 2 * 86_400_000)).toBe(false);
    store.takeBreak("week", NOW);
    expect(store.load().settings.breakUntil).toBe(NOW + 7 * 86_400_000);
    store.takeBreak("none", NOW);
    expect(store.load().settings).toMatchObject({ breakChoice: "none", breakUntil: null });
  });

  it("knows quiet time, from the evening until 8 am", () => {
    const settings = defaultCommunitySettings();
    const at = (hour: number) => new Date(2026, 9, 6, hour, 30);
    expect(inQuietHours(settings, at(12))).toBe(false);
    expect(inQuietHours(settings, at(20))).toBe(false);
    expect(inQuietHours(settings, at(21))).toBe(true);
    expect(inQuietHours(settings, at(2))).toBe(true);
    expect(inQuietHours(settings, at(8))).toBe(false);
    expect(alertsQuiet(settings, at(12))).toBe(false);
    expect(alertsQuiet({ ...settings, breakChoice: "day", breakUntil: at(12).getTime() + 1000 }, at(12))).toBe(true);
    expect(hourLabel(21)).toBe("9 pm");
    expect(hourLabel(8)).toBe("8 am");
    expect(hourLabel(12)).toBe("12 pm");
    expect(hourLabel(0)).toBe("12 am");
  });
});

describe("loading friends, safety and settings", () => {
  it("rebuilds only what it knows", () => {
    const memory = parseCommunityMemory(JSON.stringify({
      friends: ["priya", "joseph"],
      answers: { ruth: "accepted", michael: "maybe", hannah: "accepted" },
      cancelled: ["tomas", "priya", 7],
      sentAt: { priya: NOW, joseph: "now", kwame: NOW },
      blocks: { gary: 0, hannah: NOW, kwame: 0, nobody: NOW, grace: -4 },
      muted: { joseph: NOW, tomas: 0, "__proto__": NOW },
      hiddenPosts: { "p-tomas": NOW, "p-nobody": NOW },
      reports: [
        { id: "report-a", who: "gary", postId: "p-gary", reason: "health", note: "x".repeat(900), alsoBlock: true, createdAt: NOW },
        { id: "report-a", who: "gary", reason: "health", createdAt: NOW },
        { id: "report-b", who: "zak", reason: "health", createdAt: NOW },
        { id: "report-c", who: "grace", reason: "rude", createdAt: NOW },
        { id: "not-a-report", who: "grace", reason: "other", createdAt: NOW },
        { id: "report-d", who: "grace", postId: "elsewhere", reason: "other", createdAt: NOW },
      ],
      seenAlerts: ["a-ruth", "a-nothing", "a-ruth"],
      settings: { showTown: false, picture: "cartoon", hiddenWords: ["Falls", "<script>", "falls", 3, "hip op"], textSize: "smaller", quietFrom: 25, quietUntil: 7, breakChoice: "week", breakUntil: NOW, readAloud: "true" },
    }));
    expect(memory.answers).toEqual({ ruth: "accepted" });
    expect(memory.cancelled).toEqual(["tomas"]);
    expect(memory.sentAt).toEqual({ priya: NOW });
    expect(memory.blocks).toEqual({ gary: 0, hannah: NOW });
    expect(memory.muted).toEqual({ joseph: NOW });
    expect(memory.hiddenPosts).toEqual({ "p-tomas": NOW });
    expect(memory.reports.map(report => report.id)).toEqual(["report-a", "report-d"]);
    expect(memory.reports[0].note).toHaveLength(400);
    expect(memory.reports[1].postId).toBeNull();
    expect(memory.seenAlerts).toEqual(["a-ruth"]);
    expect(memory.settings).toEqual({
      ...defaultCommunitySettings(),
      showTown: false, hiddenWords: ["falls", "hip op"], textSize: "smaller", quietUntil: 7, breakChoice: "week", breakUntil: NOW,
    });
    expect(parseCommunityMemory(JSON.stringify({ settings: { hiddenWords: [] } })).settings.hiddenWords).toEqual([]);
    expect(parseCommunityMemory(JSON.stringify({ settings: { breakChoice: "day" } })).settings).toMatchObject({ breakChoice: "none", breakUntil: null });
  });

  it("says how long ago, in days", () => {
    const noon = new Date(2026, 9, 6, 12).getTime();
    expect(daysAgoLabel(noon - 3_600_000, noon)).toBe("today");
    expect(daysAgoLabel(noon - 86_400_000, noon)).toBe("yesterday");
    expect(daysAgoLabel(noon - 3 * 86_400_000, noon)).toBe("3 days ago");
    expect(daysAgoLabel(noon - 30 * 86_400_000, noon)).toMatch(/^on \d{1,2} September$/);
  });
});

describe("photos chosen for a post", () => {
  it("refuses other kinds of file before opening them", async () => {
    const decode = vi.fn();
    vi.stubGlobal("createImageBitmap", decode);
    await expect(preparePostPhoto({ type: "image/svg+xml", size: 100 } as File)).rejects.toThrow("JPG, PNG or WebP");
    await expect(preparePostPhoto({ type: "image/png", size: 20 * 1024 * 1024 } as File)).rejects.toThrow("12 MB");
    expect(decode).not.toHaveBeenCalled();
  });

  it("shrinks the photo on the device, keeping its shape, and lets go of the original", async () => {
    const bitmap = { width: 1440, height: 960, close: vi.fn() };
    const context = { fillStyle: "", fillRect: vi.fn(), drawImage: vi.fn() };
    const canvas = { width: 0, height: 0, getContext: () => context, toDataURL: vi.fn(() => "data:image/jpeg;base64,YWJj") };
    vi.stubGlobal("createImageBitmap", vi.fn().mockResolvedValue(bitmap));
    vi.stubGlobal("document", { createElement: () => canvas });
    expect(await preparePostPhoto({ type: "image/jpeg", size: 100 } as File)).toBe("data:image/jpeg;base64,YWJj");
    expect(canvas.width).toBe(720);
    expect(canvas.height).toBe(480);
    expect(context.drawImage).toHaveBeenCalledWith(bitmap, 0, 0, 720, 480);
    expect(canvas.toDataURL).toHaveBeenCalledWith("image/jpeg", 0.8);
    expect(bitmap.close).toHaveBeenCalledOnce();
  });

  it("explains when a photo can't be opened", async () => {
    vi.stubGlobal("createImageBitmap", vi.fn().mockRejectedValue(new Error("decode")));
    await expect(preparePostPhoto({ type: "image/webp", size: 100 } as File)).rejects.toThrow("couldn't be opened");
  });
});

describe("messages and the Friends tab", () => {
  it("reads Messages with a conversation, and Friends, from the address and builds links back to them", () => {
    expect(communityViewFromQuery("space=messages&chat=hannah")).toEqual({ space: "messages", group: null, chat: "hannah" });
    expect(communityViewFromQuery("space=messages&chat=bad%20id")).toEqual({ space: "messages", group: null });
    // A chat belongs to Messages only.
    expect(communityViewFromQuery("space=events&chat=hannah")).toEqual({ space: "events", group: null });
    expect(communityViewFromQuery("space=friends")).toEqual({ space: "friends", group: null });
    expect(messagesHref("garden")).toBe("/community?space=messages&chat=garden");
    expect(messagesHref()).toBe("/community?space=messages");
    expect(communityHref("events", null, { chat: "hannah" })).toBe("/community?space=events");
    expect(viewHref(communityViewFromQuery("space=messages&chat=grace&panel=friends"))).toBe("/community?space=messages&chat=grace&panel=friends");
    // The Friends drawer opens over the conversation, and closes back to it.
    const view = communityViewFromQuery("space=messages&chat=grace");
    expect(friendsHref(null, placeOf(view))).toBe("/community?space=messages&chat=grace&panel=friends");
    expect(leadsHere("/community?space=messages&chat=grace", "space=messages&chat=kwame")).toBe(false);
    expect(leadsHere("/community?space=messages&chat=grace", "space=messages&chat=grace")).toBe(true);
  });

  it("keeps the person's messages to friends, what they have read and muted, and only those", () => {
    const storage = memoryStorage();
    const store = createCommunityStore(() => storage);
    expect(store.addDirect("hannah", { text: "  See you   Sunday " }, NOW)?.text).toBe("See you Sunday");
    expect(store.addDirect("hannah", { text: "   " }, NOW)).toBeNull();
    store.markChatRead("kwame");
    store.toggleChatMuted("grace");
    expect(saved(storage)).toMatchObject({ chatsRead: ["kwame"], chatsMuted: ["grace"] });
    const back = parseCommunityMemory(JSON.stringify({ ...saved(storage), direct: { ...saved(storage).direct, gary: [{ id: "dm-x", text: "Hi", createdAt: NOW }] }, chatsRead: ["kwame", "nobody"], chatsMuted: "grace" }));
    expect(back.direct.hannah?.map(note => note.text)).toEqual(["See you Sunday"]);
    expect(back.direct.gary).toBeUndefined();
    expect(back.chatsRead).toEqual(["kwame"]);
    expect(back.chatsMuted).toEqual([]);
    store.toggleChatMuted("grace");
    expect(store.load().chatsMuted).toEqual([]);
  });

  it("gives up the circle seat on Leave quietly, and counts the seats taken", () => {
    const store = createCommunityStore(() => null);
    expect(circleSeatsTaken(store.load())).toBe(9);
    store.takeSeat();
    expect(circleSeatsTaken(store.load())).toBe(10);
    store.leaveSeat();
    expect(store.load().seated).toBe(false);
    store.block("hannah", NOW);
    expect(circleSeatsTaken(store.load())).toBe(8);
  });

  it("dates a line for its conversation row and the bubble under it", () => {
    const at = new Date(2026, 9, 10, 14, 41).getTime();
    expect(clockLabel(at)).toBe("2:41 pm");
    expect(clockLabel(new Date(2026, 9, 10, 0, 5).getTime())).toBe("12:05 am");
    expect(shortWhen(at, at + 12 * 60_000)).toBe("12 min");
    expect(shortWhen(at, at + 20_000)).toBe("Now");
    expect(shortWhen(at, new Date(2026, 9, 11, 9, 0).getTime())).toBe("Yesterday");
    expect(shortWhen(at, new Date(2026, 9, 13, 9, 0).getTime())).toBe("Sat");
  });
});

describe("Battleships in a private group", () => {
  // The person's ships down the right-hand side, the other player's along the top rows.
  const ready: BattleshipsSave = {
    fleet: [
      { id: "carrier", d: "v", r: 0, c: 9 }, { id: "battleship", d: "v", r: 5, c: 9 }, { id: "cruiser", d: "v", r: 0, c: 7 },
      { id: "submarine", d: "v", r: 4, c: 7 }, { id: "destroyer", d: "v", r: 8, c: 7 },
    ],
    theirs: [
      { id: "carrier", d: "h", r: 0, c: 0 }, { id: "battleship", d: "h", r: 1, c: 0 }, { id: "cruiser", d: "h", r: 2, c: 0 },
      { id: "submarine", d: "h", r: 3, c: 0 }, { id: "destroyer", d: "h", r: 4, c: 0 },
    ],
    ready: true, extra: true, first: "you", shots: [], gaveUp: null,
  };
  const played = [[40, "you"], [41, "you"], [99, "you"], [9, "them"]] as const;
  const inPlay = played.reduce((save, [square, side]) => withShot(save, side, square)!, ready);

  it("can be started only in a private group the person is in, with one other player", () => {
    const store = createCommunityStore(() => memoryStorage());
    expect(store.startGame({ groupId: "walk", type: "battleships", players: ["kwame"] }, NOW)).toBeNull();
    expect(store.startGame({ groupId: "tuesday-tea", type: "battleships", players: ["ruth"] }, NOW)).toBeNull();
    expect(store.startGame({ groupId: "garden", type: "battleships", players: ["hannah", "ruth"] }, NOW)).toBeNull();
    expect(store.startGame({ groupId: "garden", type: "battleships", players: [] }, NOW)).toBeNull();
    expect(store.startGame({ groupId: "garden", type: "battleships", players: ["hannah"] }, NOW)).toMatchObject({ groupId: "garden", type: "battleships", players: ["hannah"], state: "lobby" });
  });

  it("keeps the ships and every shot, and reads them back the same", () => {
    const storage = memoryStorage();
    const store = createCommunityStore(() => storage);
    const game = store.startGame({ groupId: "garden", type: "battleships", players: ["hannah"] }, NOW)!;
    store.saveBattleships(game.id, inPlay);
    expect(saved(storage).battleships[game.id].shots).toEqual(played.map(([at, by]) => ({ by, at })));
    const again = createCommunityStore(() => storage).load();
    expect(again.battleships[game.id]).toEqual(inPlay);
    // The hits are worked out again from the ships, so they always match.
    expect(battleOf(again.battleships[game.id]).shots.map(shot => shot.sunk)).toEqual([null, "destroyer", null, null]);
    // Only Battleships games the person started keep ships.
    store.saveBattleships("garden-chess", inPlay);
    store.saveBattleships("game-nowhere", inPlay);
    expect(Object.keys(store.load().battleships)).toEqual([game.id]);
  });

  it("reads records saved before Battleships, and drops broken or stray games without losing the rest", () => {
    const chess = { id: "game-old", groupId: "garden", type: "chess", players: ["hannah"], watch: true, state: "playing", createdAt: NOW };
    const before = parseCommunityMemory(JSON.stringify({ games: [chess], chess: { "game-old": ["e2e4"] } }));
    expect(before.battleships).toEqual({});
    expect(before.games.map(game => game.id)).toEqual(["game-old"]);
    expect(before.chess).toEqual({ "game-old": ["e2e4"] });
    const sea = (id: string) => ({ ...chess, id, type: "battleships" });
    const memory = parseCommunityMemory(JSON.stringify({
      games: [chess, sea("game-a"), sea("game-b"), sea("game-c")],
      chess: { "game-old": ["e2e4"] },
      battleships: {
        "game-a": inPlay,
        // Ships off the board, and shots out of turn.
        "game-b": { ...inPlay, fleet: inPlay.fleet.map(ship => ({ ...ship, r: 8 })) },
        "game-c": { ...inPlay, shots: [{ by: "them", at: 3 }, { by: "you", at: 40 }] },
        // A chess game, and a game that isn't there.
        "game-old": inPlay,
        "game-gone": inPlay,
      },
    }));
    expect(Object.keys(memory.battleships)).toEqual(["game-a", "game-c"]);
    expect(memory.battleships["game-a"]).toEqual(inPlay);
    expect(memory.battleships["game-c"].shots).toEqual([]);
    expect(memory.chess).toEqual({ "game-old": ["e2e4"] });
  });

  it("forgets a group's games, ships and all, when the group is closed", () => {
    const store = createCommunityStore(() => memoryStorage());
    const group = store.startGroup({ name: "Sea dogs", theme: "games", friends: ["grace"] }, NOW);
    const game = store.startGame({ groupId: group.id, type: "battleships", players: ["grace"] }, NOW)!;
    store.saveBattleships(game.id, inPlay);
    expect(store.load().battleships[game.id]).toEqual(inPlay);
    store.closeGroup(group.id);
    expect(store.load().battleships).toEqual({});
    expect(store.load().games).toEqual([]);
  });
});
