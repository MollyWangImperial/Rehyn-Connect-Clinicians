import { describe, expect, it } from "vitest";
import { connectionFilterOf, matchesConnection, CONNECTION_FILTERS } from "@/components/clinicians/network";
import { CLINICAL_AREAS, CLINICIANS, clinicalAreaFromQuery, clinicalAreasOf } from "./clinicians";

const areasOf = (id: string) => clinicalAreasOf(CLINICIANS.find(item => item.id === id)!).map(area => area.id);

describe("the directory's clinical areas", () => {
  it("uses professional clinical terms, not the Library's patient sections", () => {
    expect(CLINICAL_AREAS.map(area => area.label)).toEqual([
      "Neurology", "Stroke care and rehabilitation", "Cardiology", "Respiratory medicine", "Endocrinology and diabetes",
      "Musculoskeletal medicine and rehabilitation", "Oncology and cancer rehabilitation", "Mental health", "Nephrology", "Gastroenterology and hepatology",
    ]);
    for (const patientWords of ["Brain & nervous system", "Heart & lungs", "Mind & mood"]) expect(CLINICAL_AREAS.map(area => area.label)).not.toContain(patientWords);
  });

  it("places each clinician by the conditions on their profile and their specialty, in several areas where they work in several", () => {
    expect(areasOf("tomas-leal")).toEqual(["cardiology"]);
    expect(areasOf("michael-chau")).toEqual(["endocrinology"]);
    expect(areasOf("arjun-mehta")).toEqual(["neurology", "stroke"]);
    expect(areasOf("elena-rossi")).toEqual(["nephrology", "gastro"]);
    // A specialty alone places someone too: the stroke nurse is in stroke care whatever conditions they list.
    expect(clinicalAreasOf({ conditions: [], role: "Stroke nurse specialist" }).map(area => area.id)).toEqual(["stroke"]);
    // Areas of practice, not qualifications: a physio who sees Parkinson's is in Neurology, and nothing calls them a neurologist.
    expect(areasOf("priya-raman")).toContain("neurology");
  });

  it("reads the area from the address, and from an older link's Library group", () => {
    expect(clinicalAreaFromQuery("expertise=cardiology")).toBe("cardiology");
    expect(clinicalAreaFromQuery("area=heart-lungs&group=heart-rhythm")).toBe("cardiology");
    expect(clinicalAreaFromQuery("expertise=astrology")).toBe("all");
    expect(clinicalAreaFromQuery("")).toBe("all");
  });
});

describe("the directory's connection filter", () => {
  it("has no Not connected choice; an old one falls back to Everyone, which still lists everyone", () => {
    expect(CONNECTION_FILTERS.map(item => item.label)).toEqual(["Everyone", "Connected", "Pending", "Invited you"]);
    expect(connectionFilterOf("none")).toBe("all");
    expect(connectionFilterOf("pending")).toBe("pending");
    expect(matchesConnection("none", "all")).toBe(true);
    expect(matchesConnection("none", "connected")).toBe(false);
  });
});
