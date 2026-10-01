import { redirect } from "next/navigation"

/** Old address: New message now lives inside the inbox. */
export default function NewConversationRedirect() {
  redirect("/inbox/new")
}
