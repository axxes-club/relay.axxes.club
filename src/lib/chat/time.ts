import { differenceInCalendarDays, format, isToday, isYesterday } from "date-fns"

/** "4:05 PM", "Yesterday", "Tue", "Sep 12" — the way an inbox reads at a glance. */
export function listTime(value: string | Date | null | undefined) {
  if (!value) return ""
  const d = new Date(value)
  if (isToday(d)) return format(d, "h:mm a")
  if (isYesterday(d)) return "Yesterday"
  if (differenceInCalendarDays(new Date(), d) < 7) return format(d, "EEE")
  return format(d, d.getFullYear() === new Date().getFullYear() ? "MMM d" : "MMM d, yyyy")
}

/** Day divider label inside a thread. */
export function dayLabel(value: string | Date) {
  const d = new Date(value)
  if (isToday(d)) return "Today"
  if (isYesterday(d)) return "Yesterday"
  if (differenceInCalendarDays(new Date(), d) < 7) return format(d, "EEEE")
  return format(d, d.getFullYear() === new Date().getFullYear() ? "EEEE, MMMM d" : "MMMM d, yyyy")
}

export function messageTime(value: string | Date) {
  return format(new Date(value), "h:mm a")
}

export function fullTime(value: string | Date) {
  return format(new Date(value), "EEEE, MMMM d, yyyy 'at' h:mm a")
}

export function dayKey(value: string | Date) {
  return format(new Date(value), "yyyy-MM-dd")
}
