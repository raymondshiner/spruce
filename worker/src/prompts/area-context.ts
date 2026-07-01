import { z } from 'zod';

export const AreaContextSchema = z.object({
  areaName: z.string().max(120),
  areaNotes: z.string().max(600),
  siblings: z
    .array(
      z.object({
        title: z.string().max(120),
        vibe: z.string().max(400),
        keyChanges: z.array(z.string().max(300)).max(7),
        visionSummary: z.string().max(300).optional(),
      }),
    )
    .max(4),
});

export type AreaContext = z.infer<typeof AreaContextSchema>;

// Terse prose the model reads as a system message. Never logged.
export function renderAreaContext(ctx: AreaContext): string {
  const lines: string[] = [`This project belongs to the area "${ctx.areaName}".`];
  if (ctx.areaNotes.trim()) lines.push(`Area notes: ${ctx.areaNotes.trim()}`);
  if (ctx.siblings.length) {
    lines.push(
      'Other projects the user is planning in this same area (keep this project cohesive with them; do not duplicate or contradict):',
    );
    for (const s of ctx.siblings) {
      const changes = s.keyChanges.length ? ` — key changes: ${s.keyChanges.join('; ')}` : '';
      lines.push(`- "${s.title}": ${s.vibe}${changes}`);
    }
  }
  return lines.join('\n');
}
