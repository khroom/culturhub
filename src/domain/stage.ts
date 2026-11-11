export const STAGE_ORDER = [
  "хотим провести",
  "ждём разрешения",
  "точно будет",
  "уже прошло",
] as const;

export type ForwardStage = (typeof STAGE_ORDER)[number];
export type Stage = ForwardStage | "отменено";

export function isStage(value: string): value is Stage {
  return value === "отменено" || (STAGE_ORDER as readonly string[]).includes(value);
}

export function isTerminal(stage: Stage): stage is "уже прошло" | "отменено" {
  return stage === "уже прошло" || stage === "отменено";
}

export function canEdit(stage: Stage): boolean {
  return !isTerminal(stage);
}

export function canAttend(stage: Stage): boolean {
  return !isTerminal(stage);
}

export function canMessage(stage: Stage): boolean {
  return !isTerminal(stage);
}

export function visibleInCatalog(stage: Stage): boolean {
  return stage !== "отменено";
}

export function nextStage(stage: Stage): ForwardStage | null {
  if (isTerminal(stage)) return null;
  const index = STAGE_ORDER.indexOf(stage);
  const next = STAGE_ORDER[index + 1];
  return next ?? null;
}

export function allowedMoves(stage: Stage): Stage[] {
  const next = nextStage(stage);
  if (!next) return [];
  return [next, "отменено"];
}
