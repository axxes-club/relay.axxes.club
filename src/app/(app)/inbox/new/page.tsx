import { getTeamMembersForMessaging } from "@/lib/actions/messaging"
import { NewMessage } from "@/components/chat/new-message"

export const dynamic = "force-dynamic"

export default async function NewMessagePage() {
  // Members without a user record (or an email) can't be messaged; leave them out.
  const members = (await getTeamMembersForMessaging()).filter((m) => m.email && m.name !== "Unknown")
  return <NewMessage members={members} />
}
