"use client"

import PusherClient from "pusher-js"

let pusherClient: PusherClient | null = null

export function getPusherClient(): PusherClient {
  if (pusherClient) return pusherClient

  if (
    !process.env.NEXT_PUBLIC_PUSHER_KEY ||
    !process.env.NEXT_PUBLIC_PUSHER_CLUSTER
  ) {
    throw new Error(
      "Missing Pusher client environment variables. Please set NEXT_PUBLIC_PUSHER_KEY and NEXT_PUBLIC_PUSHER_CLUSTER."
    )
  }

  pusherClient = new PusherClient(process.env.NEXT_PUBLIC_PUSHER_KEY, {
    cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER,
    authEndpoint: "/api/v1/pusher/auth",
    auth: {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
    },
  })

  return pusherClient
}

// Re-export event types for client usage
export { PUSHER_EVENTS } from "./server"
