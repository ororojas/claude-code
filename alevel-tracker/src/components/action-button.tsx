"use client";

import { useTransition } from "react";
import { Loader2 } from "lucide-react";

/** A button that runs a server action, with an optional confirm prompt. */
export function ActionButton({
  action,
  confirm,
  className = "btn-ghost",
  children,
  label,
}: {
  action: () => Promise<void>;
  confirm?: string;
  className?: string;
  children: React.ReactNode;
  label?: string;
}) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      className={className}
      aria-label={label}
      disabled={pending}
      onClick={() => {
        if (confirm && !window.confirm(confirm)) return;
        startTransition(() => action());
      }}
    >
      {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
      {children}
    </button>
  );
}
