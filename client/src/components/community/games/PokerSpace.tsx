import { useId, useState } from "react";
import type { PersonId } from "@/content/community-samples";
import { canSee, useCommunity } from "@/lib/community-store";
import { ME, POKER_GAMES, pokerGame, pokerNight, pokerNightOn, TABLE_SIZE, usePokerNight } from "@/lib/poker-night";
import { useLater, usePinnedToEnd } from "../hooks";
import { ChipsOnly, GAME_SUIT, PokerFace, playerName, SuitGlyph, useTonightsTables } from "./PokerParts";
import PokerTable from "./PokerTable";

// The Poker night page (/community?space=poker, board 6): "Tonight's tables" grouped by game, with
// the person's own table picked out, their table's chat with quick phrases, and the table itself.
// Only Texas Hold'em can be played in this preview; anybody seated at another game gets a Hold'em
// table to practise at, and so does anybody who hasn't picked yet. Chips only.

/** What people at the table say as the evening starts (examples). */
const OPENERS: Record<string, string> = {
  hannah: "Evening all! Lucky cardigan is on.",
  kwame: "Biscuit is supervising from the sofa.",
  priya: "Tea made, cards ready.",
  joseph: "Go easy on me, I'm new to this.",
  grace: "Hello everyone, good luck tonight!",
};
const PHRASES: { label: string; tone: string; reply: string }[] = [
  { label: "Nice hand!", tone: "gold", reply: "Beginner's luck, I tell you." },
  { label: "Good luck!", tone: "mint", reply: "And to you!" },
  { label: "Back soon", tone: "rust", reply: "We will keep your seat warm." },
];
type Line = { key: number; who: string; text: string };

function TableChat({ title, seats }: { title: string; seats: string[] }) {
  const later = useLater();
  const others = seats.filter(id => id !== ME);
  const [lines, setLines] = useState<Line[]>(() => others.slice(0, 2).map((who, key) => ({ key, who, text: OPENERS[who] ?? "Evening, everyone!" })));
  const [count, setCount] = useState(2);
  const headId = useId();
  const { box, onScroll } = usePinnedToEnd<HTMLDivElement>(lines.length, true);
  const say = (index: number) => {
    const phrase = PHRASES[index];
    const who = others[(count + index) % Math.max(1, others.length)];
    setLines(list => [...list, { key: count, who: ME, text: phrase.label }].slice(-6));
    setCount(n => n + 2);
    if (who) later(() => setLines(list => [...list, { key: count + 1, who, text: phrase.reply }].slice(-6)), 1400);
  };
  return (
    <section className="cm-card pk-chat" aria-labelledby={headId}>
      <div className="pk-chat-head"><h3 id={headId}>{`${title} chat`}</h3><span>{`${seats.length} here`}</span></div>
      <div ref={box} onScroll={onScroll} className="pk-chat-lines" role="log" aria-live="polite">
        {lines.map(line => (
          <div key={line.key} className={`pk-chat-line ${line.who === ME ? "is-me" : ""}`}>
            <PokerFace id={line.who} size={28} />
            <p className="pk-chat-bubble"><strong>{playerName(line.who)}</strong>{` ${line.text}`}</p>
          </div>
        ))}
      </div>
      <div className="pk-phrases">
        {PHRASES.map((phrase, i) => <button key={phrase.label} type="button" className={`pk-phrase is-${phrase.tone}`} onClick={() => say(i)}>{phrase.label}</button>)}
      </div>
    </section>
  );
}

export default function PokerSpace({ active }: { active: boolean }) {
  const memory = useCommunity();
  const poker = usePokerNight();
  const { tables, mine } = useTonightsTables();
  const headId = useId();
  const on = pokerNightOn(poker);
  const seated = poker.status === "seated" && !!mine;
  const atHoldem = seated && mine?.game === "holdem";
  const practice = [ME, ...(["hannah", "kwame", "priya", "joseph"] as PersonId[]).filter(id => canSee(memory, id))];
  const seats = atHoldem && mine ? mine.players : practice;
  const tableLabel = atHoldem && mine ? `Table ${mine.number}` : "Practice table";
  const note = seated && !atHoldem
    ? `Only Hold'em can be played in this preview. Your ${pokerGame(poker.pick).name} table, ${mine ? `Table ${mine.number}` : ""}, opens with the real game.`
    : !seated ? "A practice table while you choose. Everyone has 1,000 chips." : undefined;

  return (
    <div className="pk-space">
      <div className="pk-side">
        <section className="cm-card pk-tables" aria-labelledby={headId}>
          <div className="pk-tables-intro">
            <h2 className="pk-side-title" id={headId} tabIndex={-1} data-view-heading>Tonight's tables</h2>
            <p>Seated by the game each person picked. Friends sit together where we can.</p>
          </div>
          {!on && <p className="pk-tables-note">Poker night is on Fridays at 7 pm. Until then, the table here is for practice.</p>}
          {poker.status === "none" && (
            <div className="pk-tables-note">
              <span>You haven't picked a game yet.</span>
              <button type="button" className="pk-btn pk-btn-deep pk-btn-small" onClick={pokerNight.open}>Pick a game</button>
            </div>
          )}
          {poker.status === "skipped" && (
            <div className="pk-tables-note">
              <span>You're skipping this week.</span>
              <button type="button" className="pk-btn pk-btn-deep pk-btn-small" onClick={() => { pokerNight.change(); pokerNight.open(); }}>Changed my mind</button>
            </div>
          )}
          {POKER_GAMES.map(game => {
            const here = tables.filter(table => table.game === game.id);
            if (!here.length) return null;
            const playing = here.reduce((sum, table) => sum + table.players.length, 0);
            return (
              <div key={game.id} className="pk-game-tables">
                <h3 className="pk-game-tables-head"><SuitGlyph suit={GAME_SUIT[game.id]} size={16} /><span>{game.name}</span><span className="pk-playing">{`${playing} playing`}</span></h3>
                <ul>
                  {here.map(table => {
                    const yours = table.players.includes(ME);
                    return (
                      <li key={table.number} className={`pk-table-row ${yours ? "is-yours" : ""}`}>
                        <span className="pk-table-row-name">{`Table ${table.number}`}</span>
                        <span className="pk-stack" aria-hidden="true">{table.players.slice(0, 3).map(id => <PokerFace key={id} id={id} size={26} />)}</span>
                        <span className="pk-table-row-count">{`${table.players.length} of ${TABLE_SIZE}`}<span className="cm-sr">{`: ${table.players.map(playerName).join(", ")}`}</span></span>
                        {yours && <span className="pk-here">You're here</span>}
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
          <ChipsOnly className="is-light" />
        </section>
        <TableChat key={seats.join(",")} title={tableLabel} seats={seats} />
      </div>

      <div className="pk-main">
        <PokerTable key={seats.join(",")} seats={seats} label={`${tableLabel} · Texas Hold'em`} note={note} active={active} bigCards={poker.bigCards} />
      </div>
    </div>
  );
}
