import { getPublishedCollection } from "astro-course-university/content";
import { sessionLabels } from "../site-config";

/**
 * The twelve weeks, assembled as modules.
 *
 * Nothing new is authored here: a module is just the week's lecture, its
 * seminar (when the week has one) and any assessment that falls due in it,
 * gathered under one heading so a student can see a week as a unit of work
 * rather than three separate indexes to cross-reference by hand.
 */
export type ItemKind = "lecture" | "seminar" | "assessment";

export interface ModuleItem {
  /** Stable progress key: the same id the course graph uses. */
  id: string;
  kind: ItemKind;
  kindLabel: string;
  title: string;
  description: string;
  href: string;
  date: Date;
  /** Weight, for assessments only. */
  weight?: number;
}

export interface CourseModule {
  week: number;
  /** The week's lecture title — the thing the week is actually about. */
  title: string;
  description: string;
  date: Date;
  items: ModuleItem[];
}

const firstLine = (value: unknown): string =>
  String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();

export async function getCourseModules(): Promise<CourseModule[]> {
  const [lectures, sessions, assessments] = await Promise.all([
    getPublishedCollection("lectures"),
    getPublishedCollection("sessions"),
    getPublishedCollection("assessments"),
  ]);

  const weeks = new Map<number, CourseModule>();
  const moduleFor = (week: number): CourseModule => {
    let entry = weeks.get(week);
    if (!entry) {
      entry = { week, title: `Week ${week}`, description: "", date: new Date(0), items: [] };
      weeks.set(week, entry);
    }
    return entry;
  };

  for (const lecture of lectures) {
    const week = moduleFor(lecture.data.week);
    week.title = lecture.data.title;
    week.description = firstLine(lecture.data.description);
    week.date = lecture.data.date;
    week.items.push({
      id: `lectures/${lecture.id}`,
      kind: "lecture",
      kindLabel: "Lecture",
      title: lecture.data.title,
      description: firstLine(lecture.data.description),
      href: `/lectures/${lecture.id}/`,
      date: lecture.data.date,
    });
  }

  for (const session of sessions) {
    moduleFor(session.data.week).items.push({
      id: `sessions/${session.id}`,
      kind: "seminar",
      kindLabel: sessionLabels.singular,
      title: session.data.title,
      description: firstLine(session.data.description),
      href: `/sessions/${session.id}/`,
      date: session.data.date,
    });
  }

  for (const assessment of assessments) {
    moduleFor(assessment.data.week).items.push({
      id: `assessments/${assessment.id}`,
      kind: "assessment",
      kindLabel: "Assessment",
      title: assessment.data.title,
      description: firstLine(assessment.data.description),
      href: `/assessments/${assessment.id}/`,
      date: assessment.data.due,
      weight: assessment.data.weight,
    });
  }

  const order: Record<ItemKind, number> = { lecture: 0, seminar: 1, assessment: 2 };
  return [...weeks.values()]
    .sort((a, b) => a.week - b.week)
    .map((week) => ({
      ...week,
      items: week.items.sort(
        (a, b) => a.date.getTime() - b.date.getTime() || order[a.kind] - order[b.kind],
      ),
    }));
}

/** Every module item, flattened in teaching order — the course as one spine. */
export function flattenModules(modules: CourseModule[]): ModuleItem[] {
  return modules.flatMap((module) => module.items);
}
