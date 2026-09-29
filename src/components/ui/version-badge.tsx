"use client";

import { useEffect } from "react";

export function VersionBadge() {
  const version = process.env.NEXT_PUBLIC_APP_VERSION || "0.0.0";

  useEffect(() => {
    console.log(`members.axxes.club v${version}`);
  }, [version]);

  return (
    <div className="fixed bottom-2 right-2 text-xs text-muted-foreground/50 z-50 pointer-events-none select-none">
      v{version}
    </div>
  );
}