/**
 * Progress, resume and self-entered marks --- all of it in the browser.
 *
 * A static course site has no student accounts, and inventing one would put a
 * login between a reader and a syllabus that is deliberately public. So the
 * record of what you have worked through lives in your own browser: nothing
 * is sent anywhere, and clearing it is a button, not a support ticket.
 */
const DONE_KEY = "slop3268:done";
const LAST_KEY = "slop3268:last";
const MARKS_KEY = "slop3268:marks";

type DoneMap = Record<string, boolean>;
type MarkMap = Record<string, number>;
interface LastSeen {
  id: string;
  href: string;
  title: string;
}

function readMap<T extends object>(key: string): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : ({} as T);
  } catch {
    return {} as T;
  }
}

function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* private mode, blocked storage: progress is a convenience, not a contract */
  }
}

function readLast(): LastSeen | null {
  try {
    const raw = localStorage.getItem(LAST_KEY);
    return raw ? (JSON.parse(raw) as LastSeen) : null;
  } catch {
    return null;
  }
}

const bands = [
  { code: "HD", min: 80 },
  { code: "D", min: 70 },
  { code: "CR", min: 60 },
  { code: "P", min: 50 },
  { code: "N", min: 0 },
];

function bandFor(mark: number): string {
  return bands.find((band) => mark >= band.min)?.code ?? "N";
}

function paint(): void {
  const done = readMap<DoneMap>(DONE_KEY);
  const marks = readMap<MarkMap>(MARKS_KEY);

  for (const node of document.querySelectorAll<HTMLElement>("[data-item]")) {
    const id = node.dataset.item ?? "";
    node.dataset.done = done[id] ? "true" : "false";
  }

  // Toggles carry their own label, so the button says what pressing it does.
  for (const toggle of document.querySelectorAll<HTMLButtonElement>("[data-complete-toggle]")) {
    const id = toggle.dataset.completeToggle ?? "";
    const isDone = Boolean(done[id]);
    toggle.setAttribute("aria-pressed", String(isDone));
    toggle.textContent = isDone ? "Completed" : "Mark as complete";
  }

  // Course-wide counters. The denominator is published in the markup, so the
  // number reads the same before and after the script runs.
  for (const meter of document.querySelectorAll<HTMLElement>("[data-progress]")) {
    const ids = (meter.dataset.progress ?? "").split(",").filter(Boolean);
    const complete = ids.filter((id) => done[id]).length;
    const pct = ids.length === 0 ? 0 : Math.round((complete / ids.length) * 100);
    const bar = meter.querySelector<HTMLElement>("[data-progress-bar]");
    if (bar) {
      bar.style.setProperty("--pct", pct + "%");
      bar.setAttribute("aria-valuenow", String(pct));
      bar.setAttribute("aria-valuetext", complete + " of " + ids.length + " items complete");
    }
    const label = meter.querySelector<HTMLElement>("[data-progress-label]");
    if (label) label.textContent = complete + " of " + ids.length + " done";
  }

  // Resume: the last thing you opened, or the first thing you have not ticked.
  for (const resume of document.querySelectorAll<HTMLAnchorElement>("[data-resume]")) {
    let spine: { id: string; href: string; title: string; kind: string }[] = [];
    try {
      spine = JSON.parse(resume.dataset.resume || "[]");
    } catch {
      spine = [];
    }
    const last = readLast();
    const unfinished = spine.filter((item) => !done[item.id]);
    const target =
      (last ? unfinished.find((item) => item.id === last.id) : undefined) ??
      unfinished[0] ??
      spine[spine.length - 1];
    if (!target) continue;
    resume.href = target.href;
    const label = resume.querySelector<HTMLElement>("[data-resume-label]");
    if (label) label.textContent = target.kind + " · " + target.title;
    const card = resume.closest("[data-resume-card]");
    const lede = card?.querySelector<HTMLElement>("[data-resume-lede]");
    if (lede) {
      lede.textContent =
        unfinished.length === 0
          ? "Every item is ticked. Go back over the one you argued with:"
          : last && !done[last.id]
            ? "Pick up where you left off"
            : "Next up";
    }
  }

  paintGrades(marks);
}

function paintGrades(marks: MarkMap): void {
  const table = document.querySelector<HTMLElement>("[data-grades]");
  if (!table) return;

  let earned = 0;
  let gradedWeight = 0;

  for (const row of table.querySelectorAll<HTMLElement>("[data-grade-row]")) {
    const id = row.dataset.gradeRow ?? "";
    const weight = Number(row.dataset.weight ?? 0);
    const input = row.querySelector<HTMLInputElement>("input[data-mark]");
    const mark = marks[id];
    if (input && document.activeElement !== input) input.value = mark == null ? "" : String(mark);

    const bandCell = row.querySelector<HTMLElement>("[data-band]");
    const contribCell = row.querySelector<HTMLElement>("[data-contribution]");
    if (mark == null) {
      if (bandCell) bandCell.textContent = "not marked";
      if (contribCell) contribCell.textContent = "—";
      row.dataset.graded = "false";
      continue;
    }
    row.dataset.graded = "true";
    const contribution = (mark * weight) / 100;
    earned += contribution;
    gradedWeight += weight;
    if (bandCell) bandCell.textContent = bandFor(mark);
    if (contribCell) contribCell.textContent = contribution.toFixed(1) + " of " + weight;
  }

  const running = gradedWeight === 0 ? null : (earned / gradedWeight) * 100;
  const runningCell = table.querySelector<HTMLElement>("[data-running]");
  if (runningCell) {
    runningCell.textContent =
      running == null
        ? "no marks entered"
        : running.toFixed(1) + " (" + bandFor(running) + ")";
  }
  const carriedCell = table.querySelector<HTMLElement>("[data-carried]");
  if (carriedCell) {
    carriedCell.textContent =
      gradedWeight === 0 ? "—" : earned.toFixed(1) + " of " + gradedWeight;
  }

  const note = document.querySelector<HTMLElement>("[data-grade-note]");
  if (!note) return;
  if (running == null) {
    note.textContent =
      "Enter a mark and this page does the arithmetic the cover sheet leaves out.";
    return;
  }
  const remaining = 100 - gradedWeight;
  if (remaining === 0) {
    note.textContent =
      "All three marked: " + earned.toFixed(1) + " overall, a " + bandFor(earned) + ".";
    return;
  }
  const needed = ((50 - earned) / remaining) * 100;
  note.textContent =
    needed <= 0
      ? "A pass is already secured on the " + gradedWeight + "% marked so far."
      : "You need " +
        Math.ceil(needed) +
        "% across the remaining " +
        remaining +
        "% to pass overall.";
}

/** Bring the rail's current item into view without scrolling the page with it. */
function revealCurrentInRail(): void {
  const rail = document.querySelector<HTMLElement>(".course-rail");
  const current = rail?.querySelector<HTMLElement>('a[aria-current="page"]');
  if (!rail || !current) return;
  const offset = current.offsetTop - rail.clientHeight / 2 + current.offsetHeight / 2;
  rail.scrollTop = Math.max(0, offset);
}

function bind(): void {
  const article = document.querySelector<HTMLElement>("[data-item-id]");
  if (article?.dataset.itemId) {
    write(LAST_KEY, {
      id: article.dataset.itemId,
      href: location.pathname,
      title: article.dataset.itemTitle ?? document.title,
    });
  }

  for (const toggle of document.querySelectorAll<HTMLButtonElement>("[data-complete-toggle]")) {
    toggle.hidden = false;
    toggle.addEventListener("click", () => {
      const id = toggle.dataset.completeToggle ?? "";
      const done = readMap<DoneMap>(DONE_KEY);
      if (done[id]) delete done[id];
      else done[id] = true;
      write(DONE_KEY, done);
      paint();
    });
  }

  for (const reset of document.querySelectorAll<HTMLButtonElement>("[data-reset-progress]")) {
    reset.hidden = false;
    reset.addEventListener("click", () => {
      write(DONE_KEY, {});
      write(MARKS_KEY, {});
      try {
        localStorage.removeItem(LAST_KEY);
      } catch {
        /* nothing to clear */
      }
      paint();
    });
  }

  for (const input of document.querySelectorAll<HTMLInputElement>("input[data-mark]")) {
    input.addEventListener("input", () => {
      const id = input.dataset.mark ?? "";
      const marks = readMap<MarkMap>(MARKS_KEY);
      const value = input.value.trim();
      if (value === "") delete marks[id];
      else marks[id] = Math.max(0, Math.min(100, Number(value)));
      write(MARKS_KEY, marks);
      paint();
    });
  }

  paint();
  revealCurrentInRail();
}

bind();
document.addEventListener("astro:page-load", bind);
