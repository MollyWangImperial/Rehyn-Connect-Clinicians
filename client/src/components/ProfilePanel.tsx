import { useId } from "react";
import { Link } from "wouter";
import { CalendarDays, LayoutDashboard, Plus, ShieldCheck, Stethoscope, UsersRound } from "lucide-react";
import { administrativeControlsEnabled } from "@/lib/administrative-controls";
import { CARE_TEAM_PATH, useCareTeamEnabled, useCareTeamWaiting } from "@/lib/care-team";
import { communityHref, friendList, pendingRequestCount, useCommunity } from "@/lib/community-store";
import { useMe } from "@/lib/me";
import { joinedEvents, useEventChoices } from "@/content/professional-events";
import { useMyConsultations } from "./community/ConsultationsCard";
import AccountResetControls from "./AccountResetControls";
import { MyFace } from "./community/parts";
import { myGroups } from "./community/group-model";

/** "SR" for Stroke Rehabilitation Network: the tile beside a group's name. */
const initials = (name: string) => name.split(/\s+/).filter(word => /^[A-Z]/.test(word)).slice(0, 2).map(word => word[0]!).join("");

/**
 * The left of every page in Rehyn Connect for clinicians: the signed-in clinician (the same profile as the feed's
 * composer and the weekly sessions, comment 21), then My Network (comment 5), My professional events (comment 4) and
 * My consultations, and their condition groups (comments 8 and 16). Saved, Alerts and Game are patient features and
 * have no row here (comments 1, 6 and 7). Everything is a link that starts with "~", so it works from the Library's
 * nested pages too.
 */
export default function ProfilePanel({ careTeam = false, onNavigate }: { careTeam?: boolean; onNavigate?: () => void }) {
  const me = useMe();
  const memory = useCommunity();
  const waiting = useCareTeamWaiting();
  const staff = useCareTeamEnabled();
  const searchId = useId();

  const connections = friendList(memory).length;
  const invitations = pendingRequestCount(memory);
  const events = joinedEvents(Date.now(), useEventChoices()).length;
  const consultations = useMyConsultations().length;
  const groups = myGroups(memory);

  const link = (href: string) => ({ href: `~${href}`, onClick: onNavigate });

  return (
    <div className="site-panel-inner">
      <section className="site-me" aria-label="You">
        <div className="site-me-row">
          <MyFace size={52} className="site-me-face" />
          <span className="site-me-words">
            <b>{me.name}</b>
            <Link className="site-me-link" {...link(me.profileHref)}>View your profile</Link>
            {/* The live number of connections, opening My Network at Connections (invitations keep their own badge below). */}
            <Link className="site-me-connections" {...link(communityHref("feed", null, { panel: "friends", tab: "friends" }))}>
              {connections} {connections === 1 ? "connection" : "connections"}
            </Link>
          </span>
        </div>
        <ul className="site-rows">
          <li>
            <Link className="site-row" {...link(communityHref("feed", null, { panel: "friends" }))}>
              <span className="site-row-icon"><UsersRound size={17} /></span><span className="site-row-label">My Network</span>
              {invitations > 0 ? <span className="site-row-badge">{invitations}<span className="cm-sr"> invitations waiting</span></span> : <span className="site-row-note">{connections}<span className="cm-sr"> connections</span></span>}
            </Link>
          </li>
          <li>
            {/* Peer events joined with other clinicians: not patient consultations or weekly patient sessions. */}
            <Link className="site-row" {...link(communityHref("events"))}>
              <span className="site-row-icon"><CalendarDays size={17} /></span><span className="site-row-label">My professional events</span>
              <span className="site-row-note">{events || ""}{events > 0 && <span className="cm-sr"> coming up</span>}</span>
            </Link>
          </li>
          <li>
            {/* Appointments with patients, kept in the clinician portal. */}
            <Link className="site-row" {...link("/clinicians/portal/consultations")}>
              <span className="site-row-icon"><Stethoscope size={17} /></span><span className="site-row-label">My consultations</span>
              <span className="site-row-note">{consultations || ""}{consultations > 0 && <span className="cm-sr"> upcoming</span>}</span>
            </Link>
          </li>
        </ul>
        {/* The clinician's own portal: requests, schedule, consultations, group sessions, earnings and profile. */}
        <Link className="cx-btn cx-btn-primary site-portal-btn" {...link("/clinicians/portal")}>
          <LayoutDashboard size={16} aria-hidden="true" />Open your portal
        </Link>
      </section>

      <section className="site-groups" aria-labelledby={`${searchId}-groups`}>
        <div className="site-caption-row">
          <p className="site-caption" id={`${searchId}-groups`}>Your groups</p>
          <Link className="site-see-all" {...link(communityHref("groups"))}>See all<span className="cm-sr"> your groups</span></Link>
        </div>
        <ul>
          {groups.slice(0, 2).map(group => (
            <li key={group.id}>
              <Link className="site-group" {...link(communityHref("groups", group.id))}>
                <span className="site-group-tile" aria-hidden="true">{initials(group.name)}</span>
                <span className="site-group-name">{group.name}</span>
                {group.unread > 0 && <span className="site-group-dot"><span className="cm-sr">, new messages</span></span>}
              </Link>
            </li>
          ))}
          <li>
            <Link className="site-group is-more" {...link(communityHref("start"))}><span className="site-group-tile" aria-hidden="true"><Plus size={16} /></span><span className="site-group-name">Start a group</span></Link>
          </li>
        </ul>
      </section>

      {/* The care team's space shows only when this device is set as the care team's (lib/care-team.ts). */}
      {staff && (
        <section className="site-staff" aria-labelledby={`${searchId}-staff`}>
          <p className="site-caption" id={`${searchId}-staff`}>Care team</p>
          <Link className={`site-row site-staff-link ${careTeam ? "is-active" : ""}`} aria-current={careTeam ? "page" : undefined} {...link(CARE_TEAM_PATH)}>
            <span className="site-row-icon"><ShieldCheck size={17} /></span><span className="site-row-label">Safety reviews</span>
            {waiting > 0 && <span className="site-row-badge">{waiting}<span className="cm-sr"> waiting for review</span></span>}
          </Link>
          {administrativeControlsEnabled() && <AccountResetControls />}
        </section>
      )}

    </div>
  );
}
