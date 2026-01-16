'use client'

import { SessionProvider, useSession, signOut } from "next-auth/react"
import { useEffect } from "react"

function SessionHandler({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession()
  
  useEffect(() => {
    // If session becomes null (due to failed refresh), we're already signed out
    // If session has error indicating refresh failure, sign out explicitly  
    if (status === 'authenticated' && session?.error === "RefreshAccessTokenError") {
      console.log("[AuthProvider] Token refresh failed, signing out")
      signOut({ callbackUrl: "/", redirect: false })
    }
  }, [session, status])

  return <>{children}</>
}

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider refetchInterval={0} refetchOnWindowFocus={false}>
      <SessionHandler>{children}</SessionHandler>
    </SessionProvider>
  )
}