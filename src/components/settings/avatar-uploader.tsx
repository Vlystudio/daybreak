"use client";

import { useState, useTransition, type ReactNode } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PhotoCaptureField } from "@/components/ui/photo-capture-field";
import { uploadAvatar, removeAvatar } from "@/actions/settings";
import { reencodeImageFile } from "@/lib/image-reencode";

export function AvatarUploader({
  avatarUrl,
  fallback,
}: {
  avatarUrl: string | null;
  fallback: ReactNode;
}) {
  const [busy, setBusy] = useState(false);
  const [, startTransition] = useTransition();

  async function handleFile(file: File) {
    setBusy(true);
    try {
      const dataUrl = await reencodeImageFile(file, { squareSize: 256, quality: 0.82 });
      const result = await uploadAvatar({ imageDataUrl: dataUrl });
      if (result.ok) toast.success("Picture updated.");
      else toast.error(result.error);
    } catch {
      toast.error("Couldn't read that image.");
    } finally {
      setBusy(false);
    }
  }

  function remove() {
    startTransition(async () => {
      const result = await removeAvatar();
      if (!result.ok) toast.error(result.error);
    });
  }

  return (
    <div className="flex items-center gap-4">
      <span className="relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white/50">
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatarUrl} alt="Your profile picture" className="h-full w-full object-cover" />
        ) : (
          fallback
        )}
        {busy && (
          <span className="absolute inset-0 flex items-center justify-center bg-black/30">
            <Loader2 className="h-5 w-5 animate-spin text-white" aria-hidden />
          </span>
        )}
      </span>
      <div className="flex flex-col gap-1.5">
        <PhotoCaptureField
          onFile={handleFile}
          busy={busy}
          label={avatarUrl ? "Change photo" : "Upload photo"}
          variant="secondary"
          size="sm"
          fileName="avatar.jpg"
        />
        {avatarUrl && (
          <Button
            size="sm"
            variant="ghost"
            disabled={busy}
            onClick={remove}
            className="text-muted-foreground"
          >
            <Trash2 aria-hidden />
            Remove
          </Button>
        )}
      </div>
    </div>
  );
}
