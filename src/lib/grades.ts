/**
 * The ANU letter bands, as a course whose subject is restraint would state
 * them: one row per grade, no commentary. A mark is a number; a grade is the
 * band it falls in, and the site never invents a third thing in between.
 */
export interface GradeBand {
  code: "HD" | "D" | "CR" | "P" | "N";
  name: string;
  min: number;
  max: number;
  /** What the band claims about the work, in the course's own terms. */
  gloss: string;
}

export const gradeBands: GradeBand[] = [
  {
    code: "HD",
    name: "High Distinction",
    min: 80,
    max: 100,
    gloss: "The cut is the argument. Nothing left in the work is doing nothing.",
  },
  {
    code: "D",
    name: "Distinction",
    min: 70,
    max: 79,
    gloss: "A defensible omission, defended — with a little still kept that needn't be.",
  },
  {
    code: "CR",
    name: "Credit",
    min: 60,
    max: 69,
    gloss: "Something was left out, and you can say what. The why is thinner than the what.",
  },
  {
    code: "P",
    name: "Pass",
    min: 50,
    max: 59,
    gloss: "The brief is met. The restraint reads as a constraint obeyed, not a decision made.",
  },
  {
    code: "N",
    name: "Fail",
    min: 0,
    max: 49,
    gloss: "Nothing was risked by leaving anything out, because nothing was left out.",
  },
];

/** The band a mark out of 100 falls in, or null when there is no mark yet. */
export function bandFor(mark: number | null | undefined): GradeBand | null {
  if (mark == null || Number.isNaN(mark)) return null;
  const clamped = Math.max(0, Math.min(100, mark));
  return gradeBands.find((band) => clamped >= band.min && clamped <= band.max) ?? null;
}
