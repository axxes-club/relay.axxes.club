import { getInboxData } from "@/lib/actions/messaging"
import { InboxShell } from "@/components/chat/inbox-shell"

export const dynamic = "force-dynamic"

/**
 * The messaging shell: the conversation list and the open thread, side by side on
 * a desktop and one at a time on a phone. Loaded once on the server so the first
 * paint already has every conversation, titled from your point of view.
 */
export default async function InboxLayout({ children }: { children: React.ReactNode }) {
  const { me, conversations } = await getInboxData()
  return <InboxShell me={me} initial={conversations}>{children}</InboxShell>
}
