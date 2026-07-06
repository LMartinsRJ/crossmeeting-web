import { z } from 'zod'

const AttendeeSchema = z.object({
  name: z.string().optional(),
  email: z.string().optional(),
})

const EnhancementSchema = z.object({
  title: z.string().optional(),
  summary: z.string().optional(),
  keyPoints: z.array(z.string()).default([]),
  actionItems: z.array(z.object({
    text: z.string(),
    assignee: z.string().optional(),
    dueDate: z.string().optional(),
    priority: z.string().optional(),
    context: z.string().optional(),
  })).default([]),
  decisions: z.array(z.string()).default([]),
})

export type Attendee = z.infer<typeof AttendeeSchema>
export type Enhancement = z.infer<typeof EnhancementSchema>

export function parseAttendees(raw: unknown): Attendee[] {
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw
    const result = z.array(AttendeeSchema).safeParse(parsed)
    return result.success ? result.data : []
  } catch {
    return []
  }
}

export function parseEnhancement(raw: unknown): Enhancement | null {
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw
    const result = EnhancementSchema.safeParse(parsed)
    return result.success ? result.data : null
  } catch {
    return null
  }
}

export function parseEnhancementSummary(raw: unknown): string | null {
  return parseEnhancement(raw)?.summary ?? null
}
