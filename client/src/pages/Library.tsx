import { useEffect, type ReactNode } from "react";
import { Link, Route, Switch, useLocation } from "wouter";
import RecoveryShell from "@/components/RecoveryShell";
import AddToLibraryBar from "@/components/library/AddToLibrary";
import ConditionPage from "@/components/library/ConditionPage";
import ItemPage from "@/components/library/ItemPage";
import LibraryFront from "@/components/library/LibraryFront";
import SectionPage from "@/components/library/SectionPage";
import SpeakToClinician from "@/components/clinicians/SpeakToClinician";
import { LetterPage, StoriesPage, StoryPage } from "@/components/library/Stories";
import { findCondition, findItem, findLetter, findSection, findStory } from "@/lib/library";
import { todayLabel } from "./Welcome";
import "./library.css";

// The Library: plain-words guides, videos, trusted links and stories, by condition. It is a nested
// route under /library, so the paths below are relative to it:
//   /                                   the front page
//   /stories, /stories/:id              every story, and one story in chapters
//   /letters/:id                        one letter
//   /:section                           one section, e.g. /brain-nervous-system
//   /:group/:condition                  one condition, e.g. /stroke/ischaemic
//   /:group/:condition/:item            one piece on that condition
// The data is in content/library.ts.

function Missing() {
  return <div className="lib-page">
    <div className="lib-wrap lib-block lib-missing">
      <h1 className="lib-h1">We couldn't find that page</h1>
      <p className="lib-sub">It may have moved, or it may not be written yet.</p>
      <Link href="/" className="lib-button">Back to the Library</Link>
    </div>
  </div>;
}

/** A new page starts at the top, or at the part its address names (#chapter-week-9). */
function useScrollOnArrival() {
  const [location] = useLocation();
  useEffect(() => {
    // The new page is already on screen when this runs, so its parts can be found by id.
    const hash = window.location.hash.slice(1);
    const target = hash ? document.getElementById(decodeURIComponent(hash)) : null;
    if (target) target.scrollIntoView({ block: "start" });
    else window.scrollTo(0, 0);
  }, [location]);
}

const or = (found: unknown, page: ReactNode) => (found ? page : <Missing />);

export default function Library() {
  useScrollOnArrival();
  return <RecoveryShell active="Library" dateLabel={todayLabel()} className="library-shell" panel={false}>
    {/* For clinicians only: add content to a condition's page (browser comment 15). */}
    <AddToLibraryBar />
    <Switch>
      <Route path="/"><LibraryFront /></Route>
      <Route path="/stories"><StoriesPage /></Route>
      <Route path="/stories/:storyId">{params => { const story = findStory(params.storyId); return or(story, story && <StoryPage key={story.id} story={story} />); }}</Route>
      <Route path="/letters/:letterId">{params => { const letter = findLetter(params.letterId); return or(letter, letter && <LetterPage key={letter.id} letter={letter} />); }}</Route>
      <Route path="/:sectionId">{params => { const section = findSection(params.sectionId); return or(section, section && <SectionPage key={section.id} section={section} />); }}</Route>
      <Route path="/:groupId/:conditionId">{params => { const place = findCondition(params.groupId, params.conditionId); return or(place, place && <ConditionPage key={`${place.group.id}/${place.condition.id}`} place={place} />); }}</Route>
      <Route path="/:groupId/:conditionId/:itemId">{params => { const place = findItem(params.groupId, params.conditionId, params.itemId); return or(place, place && <ItemPage key={`${place.group.id}/${place.condition.id}/${place.item.id}`} place={place} />); }}</Route>
      <Route><Missing /></Route>
    </Switch>
    {/* On every Library page: a way to talk to a clinician about what you're reading. */}
    <SpeakToClinician />
  </RecoveryShell>;
}
