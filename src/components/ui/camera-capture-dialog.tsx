"use client";

import * as React from "react";
import { Camera, Check, Loader2, RotateCcw, SwitchCamera, Images, CircleAlert } from "lucide-react";
import {
  CameraSession,
  CAMERA_MESSAGES,
  captureStill,
  classifyCameraError,
  getBrowserStreamGetter,
  type FacingMode,
} from "@/lib/camera";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Status = "starting" | "live" | "captured" | "error";

interface CameraCaptureDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called with the captured still. The dialog closes itself afterwards. */
  onCapture: (file: File) => void;
  /** Escape hatch to the OS file/library picker. */
  onUseUploadInstead?: () => void;
  /** File name for the captured image. */
  fileName?: string;
  /** Longest-edge cap in px for the captured frame. */
  maxDim?: number;
}

/**
 * Live-camera capture modal (getUserMedia + canvas frame grab). Used ONLY on
 * browser surfaces that support getUserMedia in a secure context — never inside
 * the native iOS Capacitor shell (see PhotoCaptureField, which gates this). Every
 * failure here is JS-catchable and rendered as a friendly, recoverable state.
 */
export function CameraCaptureDialog({
  open,
  onOpenChange,
  onCapture,
  onUseUploadInstead,
  fileName = "photo.jpg",
  maxDim = 1280,
}: CameraCaptureDialogProps) {
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const sessionRef = React.useRef<CameraSession | null>(null);
  const capturedUrlRef = React.useRef<string | null>(null);
  const pendingFileRef = React.useRef<File | null>(null);
  const mountedRef = React.useRef(true);
  const facingRef = React.useRef<FacingMode>("environment");

  const [status, setStatus] = React.useState<Status>("starting");
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
  const [ready, setReady] = React.useState(false);
  const [capturing, setCapturing] = React.useState(false);
  const [capturedUrl, setCapturedUrl] = React.useState<string | null>(null);
  const [canSwitch, setCanSwitch] = React.useState(false);

  const revokeCaptured = React.useCallback(() => {
    if (capturedUrlRef.current) {
      URL.revokeObjectURL(capturedUrlRef.current);
      capturedUrlRef.current = null;
    }
    setCapturedUrl(null);
  }, []);

  // Acquire (or re-acquire) the live stream. Tears down any prior session first
  // so switching cameras or retrying never leaks a stream.
  const startCamera = React.useCallback(async (facing: FacingMode) => {
    facingRef.current = facing;
    const getter = getBrowserStreamGetter();
    if (!getter) {
      if (mountedRef.current) {
        setStatus("error");
        setErrorMsg(CAMERA_MESSAGES.unsupported);
      }
      return;
    }
    sessionRef.current?.stop();
    const session = new CameraSession(getter);
    sessionRef.current = session;
    setStatus("starting");
    setErrorMsg(null);
    setReady(false);

    try {
      const stream = await session.start(facing);
      // Bail if this session was superseded (switch/retry) or the dialog closed.
      if (sessionRef.current !== session || session.isClosed()) return;
      const video = videoRef.current;
      if (!video) return;
      video.srcObject = stream;
      try {
        await video.play();
      } catch {
        // Autoplay can reject; muted+playsInline video still renders once metadata
        // loads, so this is non-fatal.
      }
      if (sessionRef.current !== session) return;
      if (mountedRef.current) setStatus("live");
      // Offer camera-switch only when the device actually has more than one.
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const cams = devices.filter((d) => d.kind === "videoinput").length;
        if (mountedRef.current && sessionRef.current === session) setCanSwitch(cams > 1);
      } catch {
        /* device enumeration is best-effort */
      }
    } catch (err) {
      if (sessionRef.current !== session) return;
      const e = classifyCameraError(err);
      if (e.kind === "stopped") return; // benign close race
      if (mountedRef.current) {
        setStatus("error");
        setErrorMsg(e.message);
      }
    }
  }, []);

  // Own the camera for the life of the open dialog. Cleanup on close/unmount/
  // route change stops all tracks and releases object URLs.
  React.useEffect(() => {
    mountedRef.current = true;
    if (!open) return;
    void startCamera(facingRef.current);
    const onVisibility = () => {
      // Releasing the camera when backgrounded avoids iOS reclaiming it and
      // leaving a dead preview; reopening re-acquires.
      if (typeof document !== "undefined" && document.hidden) sessionRef.current?.stop();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      sessionRef.current?.stop();
      sessionRef.current = null;
      revokeCaptured();
    };
    // Only re-run when the dialog opens/closes; camera switching is imperative.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  React.useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  function onLoadedMetadata() {
    const v = videoRef.current;
    if (v && v.videoWidth > 0 && v.videoHeight > 0) setReady(true);
  }

  async function capture() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || capturing) return;
    setCapturing(true);
    try {
      const blob = await captureStill(video, canvas, { maxDim });
      const file = new File([blob], fileName, { type: blob.type || "image/jpeg" });
      // Stop the live stream now that we have the frame; retake re-acquires.
      sessionRef.current?.stop();
      video.srcObject = null;
      const url = URL.createObjectURL(blob);
      capturedUrlRef.current = url;
      pendingFileRef.current = file;
      if (mountedRef.current) {
        setCapturedUrl(url);
        setStatus("captured");
      }
    } catch (err) {
      const e = classifyCameraError(err);
      if (mountedRef.current) {
        setStatus("error");
        setErrorMsg(e.message);
      }
    } finally {
      if (mountedRef.current) setCapturing(false);
    }
  }

  function usePhoto() {
    const file = pendingFileRef.current;
    revokeCaptured();
    pendingFileRef.current = null;
    onOpenChange(false);
    if (file) onCapture(file);
  }

  function retake() {
    revokeCaptured();
    pendingFileRef.current = null;
    void startCamera(facingRef.current);
  }

  function switchCamera() {
    void startCamera(facingRef.current === "environment" ? "user" : "environment");
  }

  function useUpload() {
    onOpenChange(false);
    onUseUploadInstead?.();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md gap-3 p-4">
        <DialogHeader>
          <DialogTitle>Take a photo</DialogTitle>
          <DialogDescription className="sr-only">
            Live camera preview. Capture a photo, or choose one from your device instead.
          </DialogDescription>
        </DialogHeader>

        <CameraErrorBoundary onReset={() => onOpenChange(false)}>
          <div className="relative aspect-[3/4] w-full overflow-hidden rounded-xl bg-black">
            {/* Live preview. Hidden (not unmounted) while reviewing a capture so
                the element and its ref survive a retake. */}
            <video
              ref={videoRef}
              playsInline
              muted
              autoPlay
              onLoadedMetadata={onLoadedMetadata}
              onCanPlay={onLoadedMetadata}
              className={cn(
                "h-full w-full object-cover",
                status === "captured" || status === "error" ? "hidden" : ""
              )}
            />

            {status === "captured" && capturedUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={capturedUrl} alt="Captured photo" className="h-full w-full object-cover" />
            )}

            {status === "starting" && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-white/90">
                <Loader2 className="h-6 w-6 animate-spin" aria-hidden />
                <span className="text-sm">Starting camera…</span>
              </div>
            )}

            {status === "error" && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center">
                <CircleAlert className="h-7 w-7 text-white/90" aria-hidden />
                <p className="text-sm text-white/90" role="alert">
                  {errorMsg ?? CAMERA_MESSAGES.unknown}
                </p>
                <div className="flex flex-wrap justify-center gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => startCamera(facingRef.current)}
                  >
                    <RotateCcw aria-hidden /> Try again
                  </Button>
                  {onUseUploadInstead && (
                    <Button size="sm" variant="ghost" className="text-white" onClick={useUpload}>
                      <Images aria-hidden /> Choose a photo
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>
        </CameraErrorBoundary>

        <canvas ref={canvasRef} className="hidden" aria-hidden />

        {/* Controls */}
        {status === "captured" ? (
          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1" onClick={retake}>
              <RotateCcw aria-hidden /> Retake
            </Button>
            <Button className="flex-1" onClick={usePhoto}>
              <Check aria-hidden /> Use photo
            </Button>
          </div>
        ) : status === "error" ? null : (
          <div className="flex items-center gap-2">
            {onUseUploadInstead && (
              <Button
                variant="ghost"
                size="icon"
                onClick={useUpload}
                aria-label="Choose a photo from your device"
                title="Choose a photo"
              >
                <Images aria-hidden />
              </Button>
            )}
            <Button className="flex-1" onClick={capture} disabled={!ready || capturing}>
              {capturing ? (
                <Loader2 className="animate-spin" aria-hidden />
              ) : (
                <Camera aria-hidden />
              )}
              {capturing ? "Capturing…" : ready ? "Capture" : "Preparing…"}
            </Button>
            {canSwitch && (
              <Button
                variant="ghost"
                size="icon"
                onClick={switchCamera}
                aria-label="Switch camera"
                title="Switch camera"
              >
                <SwitchCamera aria-hidden />
              </Button>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/**
 * Contains any render-time crash inside the camera UI so it can never bubble up
 * and take down the surrounding page. (The native iOS TCC camera crash is NOT
 * catchable here — that is fixed by shipping the Info.plist usage strings — but
 * this guards ordinary React render errors.)
 */
class CameraErrorBoundary extends React.Component<
  { children: React.ReactNode; onReset: () => void },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    console.error("[camera] render error:", error instanceof Error ? error.message : error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex aspect-[3/4] w-full flex-col items-center justify-center gap-3 rounded-xl bg-black p-6 text-center">
          <CircleAlert className="h-7 w-7 text-white/90" aria-hidden />
          <p className="text-sm text-white/90" role="alert">
            The camera ran into a problem. Please close and try again.
          </p>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              this.setState({ hasError: false });
              this.props.onReset();
            }}
          >
            Close
          </Button>
        </div>
      );
    }
    return this.props.children;
  }
}
