"use client";

import React, { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { usePathname } from "next/navigation";
import AuthModal from "./AuthModal";

type Props = {
  children: React.ReactNode;
  protectedPaths?: string[]; // paths or prefixes where modal should appear when unauthenticated
};

export default function RequireAuthModal({
  children,
  protectedPaths = [],
}: Props) {
  const { data: session, status } = useSession();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    // Only trigger when session is known and unauthenticated
    if (status === "loading") return;

    const path = pathname || "/";
    const match =
      protectedPaths.length === 0
        ? false
        : protectedPaths.some((p) => path.startsWith(p));

    if (match && !session) {
      setOpen(true);
    } else {
      setOpen(false);
    }
  }, [status, session, pathname, protectedPaths]);

  return (
    <>
      {children}
      <AuthModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}
