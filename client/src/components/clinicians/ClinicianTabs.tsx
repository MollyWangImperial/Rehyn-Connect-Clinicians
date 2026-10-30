import { Link } from "wouter";
import { CalendarCheck, Search, Users } from "lucide-react";
import { isOpen, useConsultations } from "@/lib/consultations";

// The Clinicians tab's three parts, as a row of tabs under the heading (design canvas "Rehyn Clinicians Tab", layout C):
// finding colleagues in the directory first, then My consultations and the weekly group sessions. Each tab shows its part on
// the same page, beneath the tabs (pages/Clinicians.tsx, ClinicianHub); the address changes too, so Back and links work.

export type ClinicianPage = "find" | "consultations" | "sessions";

export const TAB_PATH: Record<ClinicianPage, string> = { find: "/", consultations: "/consultations", sessions: "/sessions" };
export const panelId = (page: ClinicianPage) => `cl-panel-${page}`;

export default function ClinicianTabs({ active }: { active: ClinicianPage }) {
  const open = useConsultations().filter(isOpen).length;
  const tab = (page: ClinicianPage) => ({
    href: TAB_PATH[page],
    className: "cl-tab",
    "aria-current": page === active ? ("page" as const) : undefined,
    "aria-controls": panelId(page),
  });
  return (
    <div className="cl-tabs-row">
      <nav className="cl-tabs" aria-label="Clinicians">
        <Link {...tab("find")}><Search size={18} aria-hidden="true" />Find colleagues</Link>
        <Link {...tab("consultations")}><CalendarCheck size={18} aria-hidden="true" />My consultations{open > 0 && <span className="cl-tab-count">{open}<span className="cl-sr"> open</span></span>}</Link>
        <Link {...tab("sessions")}><Users size={18} aria-hidden="true" />Weekly group sessions</Link>
      </nav>
    </div>
  );
}
