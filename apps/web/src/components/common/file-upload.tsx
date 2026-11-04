"use client";
import { Upload } from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { api, ApiClientError } from "@/lib/api";

export interface UploadedFile {
  id: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  scanStatus: string;
  purpose: string;
}

export function FileUpload({ purpose, accept = "application/pdf", label = "PDF hochladen", onUploaded }: { purpose: string; accept?: string; label?: string; onUploaded: (f: UploadedFile) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  return (
    <>
      <input
        ref={input}
        type="file"
        accept={accept}
        className="sr-only"
        aria-label={label || "Datei anhängen"}
        tabIndex={-1}
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (!file) return;
          if (file.size > 5 * 1024 * 1024) return toast("Datei ist größer als 5 MB.", "error");
          const form = new FormData();
          form.set("file", file);
          form.set("purpose", purpose);
          setBusy(true);
          try {
            onUploaded(await api<UploadedFile>("/files", { form }));
            toast("Datei hochgeladen");
          } catch (err) {
            toast(err instanceof ApiClientError ? err.message : "Upload fehlgeschlagen", "error");
          } finally {
            setBusy(false);
          }
        }}
      />
      <Button type="button" variant="secondary" size={label ? "sm" : "icon"} loading={busy} aria-label={label ? undefined : "Datei anhängen"} onClick={() => input.current?.click()}>
        <Upload className="size-4" aria-hidden /> {label}
      </Button>
    </>
  );
}
