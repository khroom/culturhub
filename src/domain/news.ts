export function goingText(title: string): string {
  return `Вы идёте на «${title}».`;
}

export function notGoingText(title: string): string {
  return `Вы не идёте на «${title}».`;
}

export function stageText(title: string, stage: string): string {
  return `«${title}» перешёл в этап «${stage}».`;
}

export function timeChangeText(title: string, was: string, became: string): string {
  return `Организатор изменил время «${title}»: было ${was}, стало ${became}.`;
}

export function joinedText(name: string, title: string, interests: string): string {
  return `${name} идёт на «${title}». Интересы: ${interests}.`;
}

export function leftText(name: string, title: string): string {
  return `${name} не идёт на «${title}».`;
}

export function stageRecipients(goingUserIds: number[], organizerUserId: number): number[] {
  return unique([organizerUserId, ...goingUserIds]);
}

export function personalRecipient(userId: number): number[] {
  return [userId];
}

function unique(ids: number[]): number[] {
  return [...new Set(ids)];
}
