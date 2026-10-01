"use client"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { createConversation } from "@/lib/actions/messaging"

type Member = { id: string; name: string; email: string }
export function NewConversationForm({ members }: { members: Member[] }) {
  const router = useRouter()
  const [error, setError] = useState("")
  const [pending, setPending] = useState(false)
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const participantIds = form.getAll("participant").map(String)
    if (!participantIds.length) { setError("Choose at least one person."); return }
    setPending(true); setError("")
    try {
      const conversation = await createConversation({ participantIds, name: String(form.get("name") || ""), type: participantIds.length > 1 ? "group" : "direct" })
      router.push(`/inbox/${conversation.id}`); router.refresh()
    } catch { setError("Could not create the conversation. Please try again."); setPending(false) }
  }
  if (!members.length) return <p className="mt-6 text-muted">No other members are available in this organization.</p>
  return <form onSubmit={submit} className="mt-6 space-y-4">
    <fieldset disabled={pending} className="space-y-3"><legend className="mb-2 text-sm font-medium">People</legend>
      {members.map(member => <label key={member.id} className="flex items-center gap-3 rounded-lg border border-line p-3"><input name="participant" type="checkbox" value={member.id} /><span><span className="block font-medium">{member.name}</span><span className="text-xs text-muted">{member.email}</span></span></label>)}
      <label className="block text-sm">Group name (optional)<input name="name" className="input mt-2" maxLength={120} /></label>
    </fieldset>
    {error && <p role="alert" className="text-sm text-danger">{error}</p>}
    <button type="submit" disabled={pending} className="btn-primary">{pending ? "Creating…" : "Create conversation"}</button>
  </form>
}
