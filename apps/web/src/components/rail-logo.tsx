import { cn } from "@/lib/utils";

export function RailLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" fill="none" className={cn("h-5 w-5", className)} aria-label="Lumen logo">
      <path d="M24 5a19 19 0 1 0 19 19" stroke="currentColor" strokeWidth="6" strokeLinecap="round" />
      <path d="M24 15a9 9 0 1 0 9 9" stroke="currentColor" strokeWidth="6" strokeLinecap="round" opacity=".62" />
      <circle cx="24" cy="24" r="3.5" fill="currentColor" />
    </svg>
  );
}
