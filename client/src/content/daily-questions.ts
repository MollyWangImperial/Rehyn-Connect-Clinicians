// The Daily question at the top of My community's feed ("Live thread"): one question a day from Rehyn, the same for
// everyone, with the community's answers coming in under it and the person's own answer pinned beneath. Each
// question has a key phrase (underlined on the card), a few starters to begin an answer from, and the answers of the
// example people in My community (as everywhere in this preview, they are examples), some with a tag for the kind of
// answer. The meeting memo suggested taking the first prompt of the day from Krillion (krillion.me); its prompts
// load inside the game and are its own catalogue, so they would need its makers' permission (or a feed from them).
// With one, `dailyQuestion` is the single place to swap in that source.
//
// The questions are for people in recovery talking to others who have been there, not general small talk: each one
// asks about living with recovery (tips, the unseen parts, hard and good days, the people who help, what is coming
// back) and is open, so an answer is a short story or a tip that others can reply to, never a yes, a no or one word.
// The starters are the beginnings of sentences ("Nobody warned me…"), not ready-made answers.

import type { PersonId } from "./community-samples";

/** One example answer: who, what they said, the kind of answer (with its colour) if the question sorts them, and hearts. */
export type DailyAnswer = { who: PersonId; text: string; tag?: { label: string; colour: string }; hearts: number };

export type DailyQuestionSpec = {
  /** What the question is about: "Pass it on", "Tips", "Then and now", "Hard days", "Ask the group" and so on. */
  kind: string;
  /** The question in three parts: before the key phrase, the key phrase, after it. */
  pre: string;
  key: string;
  post: string;
  /** In the answer box before the person writes ("I wish I'd known…"). */
  placeholder: string;
  /** Beginnings of answers, with one tap (they fill the box to carry on from; nothing is sent until Send). */
  starters: string[];
  answers: DailyAnswer[];
};

const tag = (label: string, colour: string) => ({ label, colour });
const KITCHEN = tag("Kitchen", "#E8836B"), DRESSING = tag("Dressing", "#B9B4E0"), GETTING_ABOUT = tag("Getting about", "#9DBFA6");
const MEMORY = tag("Memory", "#F2C44D"), WORDS = tag("Words", "#7FB4DB"), BATHROOM = tag("Bathroom", "#7FB4DB"), DAILY_LIFE = tag("Daily life", "#F2C44D");

export const DAILY_QUESTIONS: readonly DailyQuestionSpec[] = [
  {
    kind: "Pass it on", pre: "What do you wish someone had told you in your ", key: "first week home", post: "?", placeholder: "I wish I'd known…",
    starters: ["I wish I'd known…", "Nobody warned me…", "It's normal to…"],
    answers: [
      { who: "grace", text: "That tiredness is part of healing, not laziness.", hearts: 11 },
      { who: "kwame", text: "Take the help. Pride doesn't do the washing up.", hearts: 8 },
      { who: "hannah", text: "That crying at the telly is normal now. It is.", hearts: 9 },
      { who: "joseph", text: "Buy a rocker knife before you need one.", hearts: 5 },
      { who: "ruth", text: "Progress isn't a straight line. Bad days pass.", hearts: 12 },
      { who: "michael", text: "Write down your questions before appointments.", hearts: 6 },
      { who: "priya", text: "Your family is scared too. Talk to them.", hearts: 10 },
      { who: "tomas", text: "Still in it. Reading all of these twice.", hearts: 14 },
    ],
  },
  {
    kind: "Tips", pre: "What's a small ", key: "trick", post: " that makes a hard task easier for you?", placeholder: "My trick is…",
    starters: ["My trick is…", "In the kitchen, I…", "Getting dressed, I…"],
    answers: [
      { who: "joseph", text: "A damp cloth under the bowl stops it sliding.", tag: KITCHEN, hearts: 9 },
      { who: "ruth", text: "Sit on the bed to dress, bad arm in first.", tag: DRESSING, hearts: 7 },
      { who: "hannah", text: "Pills in a weekly box, filled on Sundays.", tag: MEMORY, hearts: 4 },
      { who: "kwame", text: "Biscuit's lead on my good wrist, never the other.", tag: GETTING_ABOUT, hearts: 6 },
      { who: "priya", text: "Elastic laces. Never tying shoes again!", tag: DRESSING, hearts: 10 },
      { who: "michael", text: "A list on the fridge, ticked off with a smile.", tag: MEMORY, hearts: 3 },
      { who: "grace", text: "Stairs: up with the good, down with the bad.", tag: GETTING_ABOUT, hearts: 8 },
      { who: "tomas", text: "Picture cards for words I can't find yet.", tag: WORDS, hearts: 7 },
    ],
  },
  {
    kind: "Then and now", pre: "What can you do now that felt ", key: "out of reach", post: " a few months ago?", placeholder: "A few months ago I couldn't…",
    starters: ["A few months ago I couldn't…", "Now I can…", "I'm nearly able to…"],
    answers: [
      { who: "ruth", text: "Kneel in the garden and get back up.", hearts: 8 },
      { who: "joseph", text: "Chop an onion. Slowly, but chopped.", hearts: 7 },
      { who: "priya", text: "Sing a whole verse without losing words.", hearts: 9 },
      { who: "kwame", text: "Walk Biscuit round the block, no stick.", hearts: 6 },
      { who: "hannah", text: "Hold my granddaughter on my lap.", hearts: 12 },
      { who: "michael", text: "Follow a TV programme from start to end.", hearts: 4 },
      { who: "grace", text: "Drive to the shops, with my doctor's okay.", hearts: 5 },
      { who: "tomas", text: "Ask me in a few months. I'll have a list.", hearts: 13 },
    ],
  },
  {
    kind: "Unseen", pre: "What's one part of your recovery that other people ", key: "can't see", post: "?", placeholder: "What people don't see is…",
    starters: ["What people don't see is…", "I look fine, but…", "The hardest bit is…"],
    answers: [
      { who: "grace", text: "The tiredness. One outing means a day in bed.", hearts: 13 },
      { who: "priya", text: "How hard I'm working to find each word.", hearts: 9 },
      { who: "kwame", text: "The worry every time I get a headache.", hearts: 7 },
      { who: "hannah", text: "That I plan every trip around the loo.", hearts: 6 },
      { who: "michael", text: "Noise. Busy places wear me out fast.", hearts: 8 },
      { who: "joseph", text: "My arm feels like it belongs to someone else.", hearts: 5 },
      { who: "ruth", text: "How long it takes me just to get ready.", hearts: 6 },
      { who: "tomas", text: "In my head the words are all there.", hearts: 15 },
    ],
  },
  {
    kind: "Good days", pre: "What does a ", key: "good day", post: " look like for you now?", placeholder: "A good day is…",
    starters: ["A good day is…", "These days it's…", "It starts with…"],
    answers: [
      { who: "hannah", text: "Tomatoes watered, phone call, nap. Perfect.", hearts: 7 },
      { who: "kwame", text: "A walk, a pasty, and nobody fussing.", hearts: 6 },
      { who: "ruth", text: "Physio done before ten and the sun out.", hearts: 4 },
      { who: "joseph", text: "Cooking one proper meal from scratch.", hearts: 5 },
      { who: "priya", text: "Choir, and the words all turn up.", hearts: 8 },
      { who: "michael", text: "Grandson after school, a song in the kitchen.", hearts: 6 },
      { who: "grace", text: "Smaller than before, but more of them.", hearts: 11 },
      { who: "tomas", text: "When I say a whole sentence first time.", hearts: 9 },
    ],
  },
  {
    kind: "Hard days", pre: "What helps you get through a day when the ", key: "tiredness", post: " wins?", placeholder: "On those days I…",
    starters: ["On those days I…", "I've learned to…", "What helps is…"],
    answers: [
      { who: "grace", text: "I plan one thing only and let the rest go.", hearts: 10 },
      { who: "joseph", text: "Soup in the freezer for exactly these days.", hearts: 8 },
      { who: "michael", text: "Lie down with music, eyes closed, no guilt.", hearts: 6 },
      { who: "kwame", text: "Biscuit gets the garden instead of the walk.", hearts: 7 },
      { who: "ruth", text: "I tell my daughter. Then I stop pretending.", hearts: 9 },
      { who: "hannah", text: "A blanket, the radio, and lowered standards.", hearts: 12 },
      { who: "priya", text: "Ten minutes of rest before I need it.", hearts: 5 },
      { who: "tomas", text: "Sleep. And reading here, very slowly.", hearts: 6 },
    ],
  },
  {
    kind: "Your people", pre: "Who's in your ", key: "corner", post: ", and what do they do that really helps?", placeholder: "In my corner is…",
    starters: ["In my corner is…", "What really helps is when…", "I don't say it enough, but…"],
    answers: [
      { who: "tomas", text: "My wife. She waits, never finishes my words.", hearts: 14 },
      { who: "hannah", text: "My neighbour, who brings the bins in unasked.", hearts: 6 },
      { who: "kwame", text: "Biscuit. He doesn't care how slow I walk.", hearts: 11 },
      { who: "priya", text: "My sister. Daily calls, even when I'm grumpy.", hearts: 7 },
      { who: "ruth", text: "The garden gang. They save me the easy jobs.", hearts: 5 },
      { who: "joseph", text: "My brother. He laughs with me, not at me.", hearts: 6 },
      { who: "michael", text: "My daughter. She sorts the forms and the post.", hearts: 4 },
      { who: "grace", text: "Everyone here, honestly. You get it.", hearts: 9 },
    ],
  },
  {
    kind: "The way back", pre: "What did you ", key: "love doing", post: " before, and how are you finding your way back?", placeholder: "I used to love…",
    starters: ["I used to love…", "Now I'm trying…", "A different way to…"],
    answers: [
      { who: "joseph", text: "Cooking. Now one-handed, and still good.", hearts: 9 },
      { who: "ruth", text: "Gardening. Raised beds mean no kneeling.", hearts: 6 },
      { who: "priya", text: "Singing. Choir helps the words come back.", hearts: 8 },
      { who: "kwame", text: "Long walks. Building up a lamp post at a time.", hearts: 7 },
      { who: "michael", text: "Calligraphy. Bigger brush, slower strokes.", hearts: 5 },
      { who: "hannah", text: "Knitting. Chunky needles for now.", hearts: 4 },
      { who: "grace", text: "Swimming. Back in the slow lane on Fridays.", hearts: 6 },
      { who: "tomas", text: "Reading the paper. Now one article a day.", hearts: 8 },
    ],
  },
  {
    kind: "Honestly", pre: "When someone asks ", key: "how you are", post: ", what do you really say?", placeholder: "Usually I say…",
    starters: ["Usually I say…", "What I want to say is…", "It depends who's asking…"],
    answers: [
      { who: "grace", text: "'Fine.' Here I say the truth.", hearts: 12 },
      { who: "kwame", text: "'Getting there.' It's true most days.", hearts: 6 },
      { who: "hannah", text: "Depends if they've got ten minutes.", hearts: 9 },
      { who: "priya", text: "'Better than yesterday.' Short and honest.", hearts: 7 },
      { who: "joseph", text: "'Still here, still cooking.'", hearts: 8 },
      { who: "ruth", text: "To the doctor, everything. To others, fine.", hearts: 5 },
      { who: "michael", text: "I say I'm tired. People don't expect that.", hearts: 6 },
      { who: "tomas", text: "'Okay.' It's the word that comes easiest.", hearts: 10 },
    ],
  },
  {
    kind: "Kit", pre: "What's a bit of ", key: "kit", post: " you'd recommend to others here, and why?", placeholder: "I'd recommend…",
    starters: ["I'd recommend…", "It changed…", "Cheap, but…"],
    answers: [
      { who: "joseph", text: "A spike board. Butter toast with one hand.", tag: KITCHEN, hearts: 9 },
      { who: "ruth", text: "A perching stool by the sink. Saves my legs.", tag: KITCHEN, hearts: 5 },
      { who: "hannah", text: "A grab rail by the bath. Worth every penny.", tag: BATHROOM, hearts: 7 },
      { who: "kwame", text: "A walking stick with a seat. Rests on walks.", tag: GETTING_ABOUT, hearts: 6 },
      { who: "priya", text: "A voice recorder for appointment notes.", tag: DAILY_LIFE, hearts: 8 },
      { who: "grace", text: "A shower stool. I stopped dreading mornings.", tag: BATHROOM, hearts: 10 },
      { who: "michael", text: "A big-button phone, so calls are easy.", tag: DAILY_LIFE, hearts: 3 },
      { who: "tomas", text: "A notebook in my pocket for missing words.", tag: WORDS, hearts: 6 },
    ],
  },
  {
    kind: "Milestones", pre: "What moment this week made you feel you're ", key: "getting there", post: "?", placeholder: "This week I…",
    starters: ["This week I…", "I noticed…", "Someone said…"],
    answers: [
      { who: "ruth", text: "Buttoned my cardigan with both hands.", hearts: 11 },
      { who: "kwame", text: "Walked to the gate and back, twice.", hearts: 7 },
      { who: "hannah", text: "Made my own tea without spilling.", hearts: 9 },
      { who: "priya", text: "Phoned my sister and found every word.", hearts: 12 },
      { who: "tomas", text: "Wrote my name. It looked like mine.", hearts: 14 },
      { who: "joseph", text: "Did my exercises four days running.", hearts: 6 },
      { who: "grace", text: "Got up the stairs without stopping.", hearts: 8 },
      { who: "michael", text: "My grandson said my laugh is back.", hearts: 10 },
    ],
  },
  {
    kind: "Letting go", pre: "What's a ", key: "worry", post: " you've put down, and what helped you let it go?", placeholder: "I used to worry…",
    starters: ["I used to worry…", "What helped was…", "I'm still working on…"],
    answers: [
      { who: "grace", text: "Being a burden. My kids said they want to help.", hearts: 11 },
      { who: "kwame", text: "Going out alone. Short trips built it up.", hearts: 7 },
      { who: "hannah", text: "Another stroke. Talking risks with my nurse helped.", hearts: 9 },
      { who: "priya", text: "Sounding silly. Choir laughs with me.", hearts: 6 },
      { who: "joseph", text: "Never cooking again. One recipe at a time.", hearts: 8 },
      { who: "ruth", text: "Falling. Physio taught me how to get up.", hearts: 7 },
      { who: "michael", text: "Work. My boss agreed a slow return.", hearts: 5 },
      { who: "tomas", text: "Still carrying it. Reading this helps.", hearts: 10 },
    ],
  },
  {
    kind: "Ask the group", pre: "What would you love to ask people here who've ", key: "been there", post: "?", placeholder: "I'd love to know…",
    starters: ["I'd love to know…", "Does anyone else…", "How did you…"],
    answers: [
      { who: "tomas", text: "When did the words start coming back for you?", hearts: 13 },
      { who: "grace", text: "How did you tell work you needed more time?", hearts: 7 },
      { who: "joseph", text: "Best one-handed way to peel a potato?", hearts: 9 },
      { who: "ruth", text: "Does anyone else feel worse when it's cold?", hearts: 8 },
      { who: "kwame", text: "How long before you trusted your balance?", hearts: 6 },
      { who: "hannah", text: "How do you explain fatigue to grandchildren?", hearts: 7 },
      { who: "priya", text: "Does anyone else get tired from talking?", hearts: 10 },
      { who: "michael", text: "What helped you sleep in the first months?", hearts: 5 },
    ],
  },
  {
    kind: "Old skills", pre: "What did your old ", key: "job or hobby", post: " teach you that helps you now?", placeholder: "It taught me…",
    starters: ["It taught me…", "In my old job…", "Turns out…"],
    answers: [
      { who: "joseph", text: "Chef. Prep everything first, then cook.", hearts: 8 },
      { who: "ruth", text: "Nursing. Small steps, written down.", hearts: 6 },
      { who: "hannah", text: "Teaching. Praise the effort, not the result.", hearts: 10 },
      { who: "kwame", text: "Fishing. Patience, and a flask of tea.", hearts: 7 },
      { who: "priya", text: "Choir. Breathing first, then the words.", hearts: 5 },
      { who: "michael", text: "Accounting. Track it, and the trend shows.", hearts: 4 },
      { who: "grace", text: "Running. You don't sprint a marathon.", hearts: 9 },
      { who: "tomas", text: "Building. Strong foundations take time.", hearts: 8 },
    ],
  },
];

export type DailyQuestion = DailyQuestionSpec & {
  /** "daily-2026-10-12": the day's question, where the person's answer is kept. */
  id: string;
  /** The whole question, as one line. */
  question: string;
  /** "Monday 12 October". */
  dateLabel: string;
};

const pad = (value: number) => String(value).padStart(2, "0");
const DAY_MS = 86_400_000;
/** The day the questions start going round from: the first-week-home question on Monday 12 October 2026. */
const FIRST_DAY = Date.UTC(2026, 9, 12);

/** The day's question, by the calendar day on this device: it changes at midnight, and is the same all day. */
export function dailyQuestion(now = new Date()): DailyQuestion {
  const day = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const count = DAILY_QUESTIONS.length;
  const spec = DAILY_QUESTIONS[(((Math.round((day - FIRST_DAY) / DAY_MS)) % count) + count) % count];
  return {
    ...spec,
    id: `daily-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`,
    question: `${spec.pre}${spec.key}${spec.post}`,
    dateLabel: now.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" }),
  };
}

/** A Daily question's post id ("daily-2026-10-12"). */
export const isDailyPostId = (id: string) => /^daily-\d{4}-\d{2}-\d{2}$/.test(id);
