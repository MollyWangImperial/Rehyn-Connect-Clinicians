// The signed-in clinician of Rehyn Connect for clinicians: one identity for the sidebar, the feed composer, the profile,
// My Consultations and the group weekly sessions (comment 21). It is the clinician the portal is being used as (an
// example chosen in the portal), else the clinician who joined on this device, else the demo profile the preview starts
// with. There are no accounts yet, so this is kept on this device like everything else (lib/clinician-portal.ts).

import { findClinician, professionalTitle, type Clinician } from "@/content/clinicians";
import { personOfClinician, type PersonId } from "@/content/community-samples";
import { useClinicians, useOwnClinician } from "./clinician-portal";
import { usePortalClinician } from "./consultations";

/** The demo profile: an example clinician, labelled as one wherever their profile is shown. */
export const DEMO_CLINICIAN_ID = "amara-osei";

export type Me = {
  clinician: Clinician;
  /** "Dr Amara Osei". */
  name: string;
  /** "Amara", for "Start a post, Amara". */
  first: string;
  /** "Consultant stroke physician". */
  title: string;
  /** Their portrait, or null for their initials. */
  photo: string | null;
  initials: string;
  /** Their profile page. */
  profileHref: string;
  /** Their place in the example network, so they are never suggested to themselves. */
  personId: PersonId | undefined;
  /** An example profile rather than the clinician's own. */
  demo: boolean;
};

export function meFrom(clinician: Clinician, ownId: string | null): Me {
  return {
    clinician, name: clinician.name, first: clinician.first, title: professionalTitle(clinician), photo: clinician.photo ?? null,
    initials: clinician.initials, profileHref: `/clinicians/${clinician.id}`, personId: personOfClinician(clinician.id), demo: clinician.id !== ownId,
  };
}

/** Which clinician is signed in, from the same stores the portal uses. */
export function meId(picked: string | null, ownId: string | null, everyone: Clinician[]): string {
  if (picked && everyone.some(item => item.id === picked)) return picked;
  if (ownId && everyone.some(item => item.id === ownId)) return ownId;
  return DEMO_CLINICIAN_ID;
}

export function useMe(): Me {
  const everyone = useClinicians();
  const own = useOwnClinician();
  const picked = usePortalClinician();
  const id = meId(picked, own?.id ?? null, everyone);
  const clinician = everyone.find(item => item.id === id) ?? findClinician(DEMO_CLINICIAN_ID)!;
  return meFrom(clinician, own?.id ?? null);
}
