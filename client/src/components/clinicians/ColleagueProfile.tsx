import { Link } from "wouter";
import { ArrowLeft, Briefcase, Building2, Globe, MapPin, Pencil, ShieldCheck, Users } from "lucide-react";
import { clinicianGroups, experienceText, professionalTitle, type Clinician } from "@/content/clinicians";
import { people, personOfClinician } from "@/content/community-samples";
import { registerText, useClinicians } from "@/lib/clinician-portal";
import { friendsHref, pendingRequestCount, useCommunity } from "@/lib/community-store";
import { useMe } from "@/lib/me";
import { Avatar, ConnectControls, Faces, connectionOf, mutualOf, mutualText, myConnections, sharedGroups, workplaceText } from "./network";

// A clinician's profile in Rehyn Connect for clinicians: what a colleague sees (browser comment 11), with Connect and
// its states from My Network. Patients' booking (prices, times, urgent requests) isn't offered here: this edition is for
// clinicians finding and connecting with each other. The signed-in clinician's own profile (the sidebar's "View your
// profile", comment 21) shows as theirs, with a link to edit it in the clinician portal rather than a Connect button.

export default function ColleagueProfile({ clinician }: { clinician: Clinician }) {
  const me = useMe();
  const memory = useCommunity();
  const everyone = useClinicians();
  const mine = clinician.id === me.clinician.id;
  const { status, who } = connectionOf(memory, clinician, me);
  const mutual = who && !mine ? mutualOf(memory, who, me) : [];
  const groups = clinicianGroups(clinician);
  const shared = mine ? [] : sharedGroups(clinician, me.clinician);
  const connections = myConnections(memory, me);
  const invitations = pendingRequestCount(memory);
  const pending = clinician.own && !clinician.verified;
  const workplace = workplaceText(clinician);
  // Colleagues who work in the same Library groups: "People in the same field".
  const similar = everyone
    .filter(other => other.listed !== false && other.id !== clinician.id && other.id !== me.clinician.id && personOfClinician(other.id))
    .map(other => ({ other, overlap: sharedGroups(other, clinician).length }))
    .filter(entry => entry.overlap > 0)
    .sort((a, b) => b.overlap - a.overlap || a.other.name.localeCompare(b.other.name))
    .slice(0, 4)
    .map(entry => entry.other);

  return (
    <div className="cl-page cn-page">
      <Link href="/" className="cn-back"><ArrowLeft size={18} aria-hidden="true" />Back to the directory</Link>

      {mine && (
        <section className="cn-own" aria-label="Your profile">
          <p><strong>This is your profile.</strong> {me.demo
            ? <>You're using the preview as {clinician.name}, a demo profile: the details are examples. </>
            : <>This is how colleagues see you in the directory. </>}
            Edit it in the clinician portal.</p>
          <Link href="/portal/profile" className="cx-btn cx-btn-primary"><Pencil size={16} aria-hidden="true" />Edit your profile</Link>
        </section>
      )}

      <div className="cn-profile">
        <div className="cn-profile-main">
          <section className="cx-card cn-top" aria-labelledby="cn-name">
            <div className="cn-cover" aria-hidden="true" />
            <div className="cn-top-body">
              <div className="cn-top-face"><Avatar clinician={clinician} size={120} /></div>
              <div className="cn-top-row">
                <div className="cn-top-text">
                  <h1 className="cn-name" id="cn-name" data-page-heading>{clinician.name}</h1>
                  <p className="cn-headline">{professionalTitle(clinician)}</p>
                  <p className="cn-meta">
                    {clinician.org && <span><Building2 size={15} aria-hidden="true" />{clinician.org}</span>}
                    {clinician.place && <span><MapPin size={15} aria-hidden="true" />{clinician.place}</span>}
                  </p>
                  <div className="cn-pills">
                    <span className={`cx-pill ${pending ? "" : "is-live"}`}><ShieldCheck size={13} aria-hidden="true" />{registerText(clinician)}</span>
                  </div>
                  {mine ? (
                    <p className="cn-mutual"><Link href={`~${friendsHref("friends")}`} className="cn-link">{connections.length} {connections.length === 1 ? "connection" : "connections"}</Link>
                      {invitations > 0 && <> · <Link href={`~${friendsHref("requests")}`} className="cn-link">{invitations} {invitations === 1 ? "invitation" : "invitations"} waiting</Link></>}</p>
                  ) : mutual.length > 0 && <p className="cn-mutual"><Faces who={mutual} />{mutualText(mutual)}</p>}
                </div>
              </div>
              {!mine && <div className="cn-top-actions"><ConnectControls clinician={clinician} me={me} primary /></div>}
              {status === "friend" && <p className="cn-footnote">You're connected. {clinician.first} is listed under Connections in <Link href={`~${friendsHref("friends")}`} className="cn-link">My network</Link>.</p>}
              {status === "sent" && <p className="cn-footnote">Your invitation is waiting under Sent in <Link href={`~${friendsHref("sent")}`} className="cn-link">My network</Link>.</p>}
            </div>
          </section>

          {(clinician.summary || clinician.about) && (
            <section className="cx-card cn-section" aria-labelledby="cn-about">
              <h2 className="cn-h2" id="cn-about">About</h2>
              <p className="cn-body">{clinician.summary ?? clinician.about}</p>
            </section>
          )}

          <section className="cx-card cn-section" aria-labelledby="cn-experience">
            <h2 className="cn-h2" id="cn-experience">Experience</h2>
            <div className="cn-exp">
              <span className="cn-exp-icon" aria-hidden="true"><Briefcase size={20} /></span>
              <div className="cn-exp-text">
                <p className="cn-exp-role">{professionalTitle(clinician)}</p>
                {workplace && <p className="cn-exp-where">{workplace}</p>}
                <p className="cn-exp-where">{experienceText(clinician)}</p>
              </div>
            </div>
          </section>

          <section className="cx-card cn-section" aria-labelledby="cn-expertise">
            <h2 className="cn-h2" id="cn-expertise">Condition expertise</h2>
            {groups.length === 0 ? <p className="cn-body">{mine ? "Add the conditions you work with in the clinician portal, so colleagues can find you." : "No conditions listed yet."}</p> : (
              <div className="cn-expertise">
                {groups.map(place => {
                  const conditions = clinician.conditions
                    .filter(([groupId]) => groupId === place.group.id)
                    .map(([, conditionId]) => place.group.conditions.find(item => item.id === conditionId))
                    .filter((item): item is NonNullable<typeof item> => Boolean(item));
                  return (
                    <div key={place.group.id} className="cn-expertise-group">
                      <h3>{place.group.title} <span>· {place.section.title}</span></h3>
                      <div className="cn-chips">
                        {conditions.map(condition => <Link key={condition.id} href={`~/library/${place.group.id}/${condition.id}`} className="cn-chip-link">{condition.title}</Link>)}
                      </div>
                    </div>
                  );
                })}
                <p className="cn-footnote">Each condition opens its page in the Library.</p>
              </div>
            )}
          </section>

          <section className="cx-card cn-section" aria-labelledby="cn-details">
            <h2 className="cn-h2" id="cn-details">Registration and languages</h2>
            <ul className="cn-details">
              <li><ShieldCheck size={16} aria-hidden="true" />{registerText(clinician)}</li>
              <li><Globe size={16} aria-hidden="true" />{clinician.languages.join(", ")}</li>
            </ul>
          </section>
        </div>

        <aside className="cn-profile-side" aria-label="People">
          {mutual.length > 0 && (
            <section className="cx-card cn-section" aria-labelledby="cn-mutual">
              <h2 className="cn-h2" id="cn-mutual">Mutual connections</h2>
              <ul className="cn-people">
                {mutual.map(id => (
                  <li key={id} className="cn-person">
                    <img className="cx-avatar" src={people[id].face} alt="" width={40} height={40} loading="lazy" />
                    <div className="cn-person-text"><Link href={`/${people[id].clinicianId}`}>{people[id].name}</Link><span>{people[id].title}</span></div>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {shared.length > 0 && (
            <section className="cx-card cn-section" aria-labelledby="cn-shared">
              <h2 className="cn-h2" id="cn-shared">You both work in</h2>
              <div className="cn-chips">{shared.map(place => <span key={place.group.id} className="cx-pill">{place.group.title}</span>)}</div>
            </section>
          )}
          {similar.length > 0 && (
            <section className="cx-card cn-section" aria-labelledby="cn-similar">
              <h2 className="cn-h2" id="cn-similar"><Users size={18} aria-hidden="true" />{mine ? "Colleagues in your field" : "People in the same field"}</h2>
              <ul className="cn-people">
                {similar.map(other => (
                  <li key={other.id} className="cn-person">
                    <Avatar clinician={other} size={48} />
                    <div className="cn-person-text">
                      <Link href={`/${other.id}`}>{other.name}</Link><span>{professionalTitle(other)}</span>
                      <ConnectControls clinician={other} me={me} />
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}
          <p className="cn-footnote">{clinician.own ? "" : "Demo profile: an example clinician while the network is being set up. "}Connections and invitations stay on this device, and are the same here and in My network.</p>
        </aside>
      </div>
    </div>
  );
}
