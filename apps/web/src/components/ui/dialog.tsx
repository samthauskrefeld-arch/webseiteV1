"use client";
import * as D from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";

export function Dialog({ open, onOpenChange, title, description, children, className }: { open: boolean; onOpenChange: (o: boolean) => void; title: string; description?: string; children: React.ReactNode; className?: string }) {
  return (
    <D.Root open={open} onOpenChange={onOpenChange}>
      <D.Portal>
        <D.Overlay className="fixed inset-0 z-50 bg-[#0b1420]/50 backdrop-blur-[2px] data-[state=open]:animate-[fade_200ms_ease-out]" />
        <D.Content className={cn("fixed inset-x-0 bottom-0 z-50 max-h-[92dvh] overflow-y-auto rounded-t-[24px] border border-border bg-surface p-6 pb-[calc(24px+env(safe-area-inset-bottom))] shadow-[var(--shadow-float)] focus:outline-none sm:inset-auto sm:left-1/2 sm:top-1/2 sm:w-[min(560px,calc(100vw-32px))] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-[24px] sm:pb-6 data-[state=open]:animate-[rise_240ms_cubic-bezier(0.22,1,0.36,1)]", className)}>
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <D.Title className="text-xl font-semibold">{title}</D.Title>
              {description ? <D.Description className="mt-1 text-sm text-muted">{description}</D.Description> : <D.Description className="sr-only">{title}</D.Description>}
            </div>
            <D.Close className="-mr-2 -mt-2 grid size-11 place-items-center rounded-full text-muted hover:bg-surface-2" aria-label="Schließen">
              <X className="size-5" />
            </D.Close>
          </div>
          {children}
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}
