"use client";

import * as React from "react";
import { Capacitor } from "@capacitor/core";
import { Camera, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CameraCaptureDialog } from "@/components/ui/camera-capture-dialog";
import { getBrowserStreamGetter } from "@/lib/camera";

interface PhotoCaptureFieldProps {
  /** Receives the chosen image, whether captured live or picked from the device. */
  onFile: (file: File) => void;
  disabled?: boolean;
  busy?: boolean;
  label: string;
  busyLabel?: string;
  icon?: React.ReactNode;
  variant?: React.ComponentProps<typeof Button>["variant"];
  size?: React.ComponentProps<typeof Button>["size"];
  className?: string;
  fileName?: string;
  maxDim?: number;
}

/**
 * One button that yields an image. On browser surfaces with a secure-context
 * getUserMedia (desktop webcams, Android Chrome, iOS Safari/PWA tabs) it opens an
 * in-app live camera. On the native iOS Capacitor (WKWebView) shell it instead
 * opens the OS file picker (which offers "Take Photo"/library) — getUserMedia and
 * the file-input camera share the same native TCC crash surface there, so we do
 * NOT route through the live-preview dialog on that platform. The OS picker's
 * "Take Photo" is safe once the shipped binary carries NSCameraUsageDescription.
 * The plain file/library upload path is always preserved.
 */
export function PhotoCaptureField({
  onFile,
  disabled,
  busy,
  label,
  busyLabel,
  icon,
  variant = "secondary",
  size,
  className,
  fileName,
  maxDim,
}: PhotoCaptureFieldProps) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [cameraOpen, setCameraOpen] = React.useState(false);

  function openLibraryPicker() {
    inputRef.current?.click();
  }

  // Evaluated on click only (always client-side, so navigator/Capacitor are
  // available and there is no SSR/hydration concern): use the in-app live camera
  // on browser surfaces with a secure-context getUserMedia, but fall back to the
  // OS picker inside the native iOS shell, where getUserMedia shares the same
  // native TCC crash surface as the file-input camera.
  function canUseInAppCamera(): boolean {
    try {
      if (Capacitor.isNativePlatform()) return false;
    } catch {
      /* Capacitor web shim never throws, but stay defensive */
    }
    return getBrowserStreamGetter() !== null;
  }

  function onPrimaryClick() {
    if (canUseInAppCamera()) setCameraOpen(true);
    else openLibraryPicker();
  }

  function onInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-picking the same file
    if (file) onFile(file);
  }

  return (
    <>
      {/* No `capture` attribute: the OS picker offers Photo Library + Take Photo,
          and forcing capture would auto-open the camera (a crash risk on stale iOS
          builds). */}
      <input ref={inputRef} type="file" accept="image/*" hidden onChange={onInputChange} />
      <Button
        type="button"
        variant={variant}
        size={size}
        className={className}
        disabled={disabled || busy}
        onClick={onPrimaryClick}
      >
        {busy ? <Loader2 className="animate-spin" aria-hidden /> : (icon ?? <Camera aria-hidden />)}
        {busy ? (busyLabel ?? label) : label}
      </Button>
      {/* Rendered inertly (open=false → nothing) until the camera path is chosen;
          on the native iOS shell it is simply never opened. */}
      <CameraCaptureDialog
        open={cameraOpen}
        onOpenChange={setCameraOpen}
        onCapture={onFile}
        onUseUploadInstead={openLibraryPicker}
        fileName={fileName}
        maxDim={maxDim}
      />
    </>
  );
}
