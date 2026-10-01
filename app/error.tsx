"use client";

import { ErrorState } from "@/components/ui/States";

/** Route-level error boundary. Technical details stay in server logs. */
export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="container">
      <ErrorState title="Something went wrong on our side." onRetry={reset} />
    </div>
  );
}
