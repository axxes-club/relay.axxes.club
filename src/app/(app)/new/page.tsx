import { getTeamMembersForMessaging } from "@/lib/actions/messaging"
import { NewConversationForm } from "./new-conversation-form"

export const dynamic = "force-dynamic"
export default async function NewConversationPage() {
  const members = await getTeamMembersForMessaging()
  return <section className="max-w-xl"><h1 className="text-2xl font-semibold">New conversation</h1><p className="mt-2 text-sm text-muted">Choose people from your organization.</p><NewConversationForm members={members} /></section>
}
