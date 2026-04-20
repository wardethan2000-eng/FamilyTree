export interface GedcomIndividual {
  xref: string;
  displayName: string;
  birthDateText: string | null;
  deathDateText: string | null;
  birthPlace: string | null;
  deathPlace: string | null;
  isDeceased: boolean;
}

export interface GedcomFamily {
  xref: string;
  husbandXref: string | null;
  wifeXref: string | null;
  childXrefs: string[];
  marriageDateText: string | null;
}

export interface ParsedGedcom {
  individuals: Map<string, GedcomIndividual>;
  families: Map<string, GedcomFamily>;
}

interface GedcomLine {
  level: number;
  xref: string | null;
  tag: string;
  value: string;
}

function parseLine(raw: string): GedcomLine | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  // Format: level [@xref@] TAG [value]
  const match = trimmed.match(/^(\d+)\s+(?:(@[^@]+@)\s+)?(\w+)(?:\s+(.*))?$/);
  if (!match || !match[1] || !match[3]) return null;
  return {
    level: parseInt(match[1], 10),
    xref: match[2] ?? null,
    tag: match[3].toUpperCase(),
    value: match[4]?.trim() ?? "",
  };
}

function normalizeName(raw: string): string {
  // GEDCOM names use slashes around the surname: "Given /Surname/ Suffix"
  return raw
    .replace(/\//g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeXref(raw: string): string {
  // Ensure consistent format: @I1@ not @i1@
  return raw.toUpperCase();
}

export function parseGedcom(content: string): ParsedGedcom {
  const lines = content.split(/\r?\n/);
  const individuals = new Map<string, GedcomIndividual>();
  const families = new Map<string, GedcomFamily>();

  type RecordType = "INDI" | "FAM";
  let currentType: RecordType | null = null;
  let currentXref: string | null = null;

  // Individual accumulator
  let indiName: string | null = null;
  let indiBirthDate: string | null = null;
  let indiBirthPlace: string | null = null;
  let indiDeathDate: string | null = null;
  let indiDeathPlace: string | null = null;
  let indiIsDeceased = false;

  // Family accumulator
  let famHusband: string | null = null;
  let famWife: string | null = null;
  let famChildren: string[] = [];
  let famMarriageDate: string | null = null;

  // Sub-record context flags
  let inBirt = false;
  let inDeat = false;
  let inMarr = false;

  function commitRecord() {
    if (!currentXref) return;

    if (currentType === "INDI") {
      individuals.set(currentXref, {
        xref: currentXref,
        displayName: indiName ?? "Unknown",
        birthDateText: indiBirthDate,
        deathDateText: indiDeathDate,
        birthPlace: indiBirthPlace,
        deathPlace: indiDeathPlace,
        isDeceased: indiIsDeceased,
      });
    } else if (currentType === "FAM") {
      families.set(currentXref, {
        xref: currentXref,
        husbandXref: famHusband,
        wifeXref: famWife,
        childXrefs: famChildren,
        marriageDateText: famMarriageDate,
      });
    }
  }

  function resetAccumulators() {
    currentType = null;
    currentXref = null;
    indiName = null;
    indiBirthDate = null;
    indiBirthPlace = null;
    indiDeathDate = null;
    indiDeathPlace = null;
    indiIsDeceased = false;
    famHusband = null;
    famWife = null;
    famChildren = [];
    famMarriageDate = null;
    inBirt = false;
    inDeat = false;
    inMarr = false;
  }

  for (const rawLine of lines) {
    const parsed = parseLine(rawLine);
    if (!parsed) continue;

    if (parsed.level === 0) {
      commitRecord();
      resetAccumulators();

      if (parsed.xref) {
        const xref = normalizeXref(parsed.xref);
        if (parsed.tag === "INDI") {
          currentType = "INDI";
          currentXref = xref;
        } else if (parsed.tag === "FAM") {
          currentType = "FAM";
          currentXref = xref;
        }
      }
      continue;
    }

    if (!currentType) continue;

    if (currentType === "INDI") {
      if (parsed.level === 1) {
        inBirt = parsed.tag === "BIRT";
        inDeat = parsed.tag === "DEAT";
        inMarr = false;

        if (parsed.tag === "NAME" && !indiName && parsed.value) {
          indiName = normalizeName(parsed.value);
        }
        if (parsed.tag === "DEAT") {
          indiIsDeceased = true;
        }
      } else if (parsed.level === 2) {
        if (inBirt) {
          if (parsed.tag === "DATE" && parsed.value) indiBirthDate = parsed.value;
          if (parsed.tag === "PLAC" && parsed.value) indiBirthPlace = parsed.value;
        } else if (inDeat) {
          if (parsed.tag === "DATE" && parsed.value) indiDeathDate = parsed.value;
          if (parsed.tag === "PLAC" && parsed.value) indiDeathPlace = parsed.value;
        }
      }
    } else if (currentType === "FAM") {
      if (parsed.level === 1) {
        inMarr = parsed.tag === "MARR";
        inBirt = false;
        inDeat = false;

        if (parsed.tag === "HUSB" && parsed.value) {
          famHusband = normalizeXref(parsed.value);
        } else if (parsed.tag === "WIFE" && parsed.value) {
          famWife = normalizeXref(parsed.value);
        } else if (parsed.tag === "CHIL" && parsed.value) {
          famChildren.push(normalizeXref(parsed.value));
        }
      } else if (parsed.level === 2 && inMarr) {
        if (parsed.tag === "DATE" && parsed.value) famMarriageDate = parsed.value;
      }
    }
  }

  // Commit the last record
  commitRecord();

  return { individuals, families };
}
