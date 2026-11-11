export type DraftInput = {
  title: string;
  description: string;
  startsAt: string;
  topicIds: number[];
};

export function missingRequired(draft: DraftInput): string[] {
  const missing: string[] = [];
  if (!draft.title.trim()) missing.push("название");
  if (!draft.description.trim()) missing.push("описание");
  if (!draft.startsAt.trim()) missing.push("дата начала");
  if (draft.topicIds.length < 1) missing.push("тематика");
  return missing;
}
