/**
 * Live-camera capture primitives (getUserMedia lifecycle + frame capture).
 *
 * IMPORTANT SCOPE: this powers the in-app live camera on real browser surfaces
 * (desktop webcams, Android Chrome, iOS Safari/PWA tabs). It is deliberately NOT
 * used inside the native iOS Capacitor (WKWebView) shell: there, getUserMedia and
 * the file-input "Take Photo" reach the same in-process AVCaptureSession and are
 * subject to an iOS TCC privacy SIGABRT if the app binary lacks
 * NSCameraUsageDescription — a native abort no JS try/catch can contain. On that
 * surface we keep the native file picker (see PhotoCaptureField). Everything here
 * is JS-catchable and maps failures to friendly, recoverable messages.
 *
 * The module is framework-agnostic and free of module-load side effects (no
 * `navigator`/`window` access at import time) so it unit-tests in a Node
 * environment with lightweight fakes.
 */

export type FacingMode = "environment" | "user";

export type CameraErrorKind =
  | "denied" // user/OS refused permission
  | "not-found" // no camera on the device
  | "in-use" // hardware held by another app
  | "overconstrained" // requested constraints unsatisfiable
  | "unsupported" // getUserMedia not available
  | "insecure" // not a secure (HTTPS) context
  | "no-frame" // video had zero dimensions at capture time
  | "capture-failed" // canvas/toBlob failed
  | "stopped" // session was closed mid-start
  | "unknown";

/** Friendly, recoverable, non-technical copy for each failure kind. */
export const CAMERA_MESSAGES: Record<CameraErrorKind, string> = {
  denied:
    "Camera access was denied. Allow the camera in your browser settings, or choose a photo instead.",
  "not-found": "No camera was found on this device. You can choose a photo instead.",
  "in-use": "Your camera is being used by another app. Close it and try again.",
  overconstrained:
    "This camera couldn't meet the requested settings. Try again, or choose a photo instead.",
  unsupported: "Live camera isn't available in this browser. You can choose a photo instead.",
  insecure: "Live camera needs a secure (HTTPS) connection. You can choose a photo instead.",
  "no-frame": "The camera wasn't ready yet. Please try again.",
  "capture-failed": "The photo couldn't be captured. Please try again.",
  stopped: "The camera was closed. Please reopen it.",
  unknown: "The camera stopped unexpectedly. Please reopen it, or choose a photo instead.",
};

/** Error whose kind carries a user-safe message. Never leaks a stack to the UI. */
export class CameraError extends Error {
  readonly kind: CameraErrorKind;
  constructor(kind: CameraErrorKind, message?: string) {
    super(message ?? CAMERA_MESSAGES[kind]);
    this.name = "CameraError";
    this.kind = kind;
  }
}

/** A `getUserMedia`-shaped function, injected so the logic is testable. */
export type StreamGetter = (constraints: MediaStreamConstraints) => Promise<MediaStream>;

/** Map a raw getUserMedia rejection to a stable, user-facing kind. */
export function classifyCameraErrorKind(err: unknown): CameraErrorKind {
  if (err instanceof CameraError) return err.kind;
  const name =
    typeof err === "object" && err !== null && "name" in err
      ? String((err as { name: unknown }).name)
      : "";
  switch (name) {
    case "NotAllowedError":
    case "PermissionDeniedError":
    case "SecurityError":
      return "denied";
    case "NotFoundError":
    case "DevicesNotFoundError":
      return "not-found";
    case "NotReadableError":
    case "TrackStartError":
    case "AbortError":
      return "in-use";
    case "OverconstrainedError":
    case "ConstraintNotSatisfiedError":
      return "overconstrained";
    case "TypeError":
      // getUserMedia throws TypeError when called with empty/undefined constraints
      // or when the API surface is missing.
      return "unsupported";
    default:
      return "unknown";
  }
}

export function classifyCameraError(err: unknown): CameraError {
  if (err instanceof CameraError) return err;
  return new CameraError(classifyCameraErrorKind(err));
}

/**
 * Ordered constraint sets, from "nice rear camera" to "any camera at all".
 * Never uses `{ exact: ... }` (which throws OverconstrainedError on devices that
 * lack the requested camera) — `ideal` degrades gracefully. Audio is always off:
 * we only want a still frame, and requesting audio would pull in the microphone
 * permission unnecessarily.
 */
export function buildConstraintChain(facing: FacingMode = "environment"): MediaStreamConstraints[] {
  return [
    {
      video: { facingMode: { ideal: facing }, width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: false,
    },
    { video: { facingMode: facing }, audio: false },
    { video: true, audio: false },
  ];
}

/**
 * Try each constraint set in order. Relaxing constraints can't fix a denied
 * permission or busy hardware, so those stop the walk immediately; every other
 * failure falls through to the next, more permissive set.
 */
export async function acquireCameraStream(
  getStream: StreamGetter,
  chain: MediaStreamConstraints[] = buildConstraintChain()
): Promise<MediaStream> {
  if (!chain.length) throw new CameraError("unsupported");
  let lastErr: unknown = new CameraError("unsupported");
  for (const constraints of chain) {
    try {
      return await getStream(constraints);
    } catch (err) {
      lastErr = err;
      const kind = classifyCameraErrorKind(err);
      if (kind === "denied" || kind === "in-use") throw classifyCameraError(err);
      // otherwise: not-found / overconstrained / unknown → try the next set
    }
  }
  throw classifyCameraError(lastErr);
}

/** Stop every track and release the hardware. Safe to call with null / twice. */
export function stopStream(stream: MediaStream | null | undefined): void {
  if (!stream) return;
  for (const track of stream.getTracks()) {
    try {
      track.stop();
    } catch {
      // already stopped — nothing to do
    }
  }
}

// --- Frame capture --------------------------------------------------------

/** Minimal structural view of an <video> element (what capture reads). */
export interface FrameSource {
  readonly videoWidth: number;
  readonly videoHeight: number;
}

export interface FrameContext {
  drawImage(image: CanvasImageSource, dx: number, dy: number, dw: number, dh: number): void;
}

/** Minimal structural view of a <canvas> element (what capture writes). */
export interface FrameCanvas {
  width: number;
  height: number;
  getContext(contextId: "2d"): FrameContext | null;
  toBlob(callback: (blob: Blob | null) => void, type?: string, quality?: number): void;
}

/** Compute the capture canvas size, bounding the longest edge to `maxDim`. */
export function computeCaptureSize(
  videoWidth: number,
  videoHeight: number,
  maxDim: number
): { width: number; height: number } {
  const scale = Math.min(1, maxDim / Math.max(videoWidth, videoHeight));
  return {
    width: Math.max(1, Math.round(videoWidth * scale)),
    height: Math.max(1, Math.round(videoHeight * scale)),
  };
}

export interface CaptureOptions {
  /** Longest-edge cap in px — keeps mobile memory bounded. Default 1280. */
  maxDim?: number;
  /** JPEG quality 0–1. Default 0.85. */
  quality?: number;
  /** Output MIME. Default image/jpeg. */
  mimeType?: string;
}

/**
 * Draw the current video frame to a canvas and encode it once as a Blob.
 * Rejects (never throws synchronously) with a CameraError when the video isn't
 * ready (zero dimensions) or encoding fails — callers surface the message and
 * offer a retry. Uses canvas.toBlob rather than a giant base64 toDataURL string
 * to keep peak memory low on phones.
 */
export function captureStill(
  source: FrameSource,
  canvas: FrameCanvas,
  { maxDim = 1280, quality = 0.85, mimeType = "image/jpeg" }: CaptureOptions = {}
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const vw = source.videoWidth;
    const vh = source.videoHeight;
    if (!vw || !vh || vw < 1 || vh < 1) {
      reject(new CameraError("no-frame"));
      return;
    }
    const { width, height } = computeCaptureSize(vw, vh, maxDim);
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      reject(new CameraError("capture-failed"));
      return;
    }
    try {
      ctx.drawImage(source as unknown as CanvasImageSource, 0, 0, width, height);
    } catch {
      reject(new CameraError("capture-failed"));
      return;
    }
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new CameraError("capture-failed"));
      },
      mimeType,
      quality
    );
  });
}

// --- Session lifecycle ----------------------------------------------------

export type CameraState = "idle" | "starting" | "active" | "stopped";

/**
 * Owns exactly one media stream across a camera dialog's life. Guards the two
 * lifecycle hazards that make camera code leak or crash:
 *
 *  1. Duplicate starts — React Strict Mode mounts effects twice and users can
 *     double-tap. `start()` de-dupes: concurrent/repeat calls share one
 *     getUserMedia and one stream (no second AV session, no leak).
 *  2. Close-during-start — if `stop()` runs while getUserMedia is still in
 *     flight, the stream that arrives afterwards is stopped immediately instead
 *     of being retained and leaking the camera light.
 *
 * `stop()` is idempotent and terminal.
 */
export class CameraSession {
  private readonly getStream: StreamGetter;
  private stream: MediaStream | null = null;
  private startPromise: Promise<MediaStream> | null = null;
  private closed = false;
  state: CameraState = "idle";

  constructor(getStream: StreamGetter) {
    this.getStream = getStream;
  }

  /** Acquire (or reuse) the stream. Rejects with a CameraError on failure. */
  start(facing: FacingMode = "environment"): Promise<MediaStream> {
    if (this.closed) return Promise.reject(new CameraError("stopped"));
    if (this.stream) return Promise.resolve(this.stream);
    if (this.startPromise) return this.startPromise;

    this.state = "starting";
    this.startPromise = (async () => {
      try {
        const stream = await acquireCameraStream(this.getStream, buildConstraintChain(facing));
        if (this.closed) {
          // Closed while we were awaiting — don't retain a leaked stream.
          stopStream(stream);
          throw new CameraError("stopped");
        }
        this.stream = stream;
        this.state = "active";
        return stream;
      } finally {
        this.startPromise = null;
      }
    })();
    return this.startPromise;
  }

  /** Release the camera. Idempotent and terminal. */
  stop(): void {
    this.closed = true;
    this.state = "stopped";
    stopStream(this.stream);
    this.stream = null;
  }

  getActiveStream(): MediaStream | null {
    return this.stream;
  }

  isClosed(): boolean {
    return this.closed;
  }
}

/**
 * Resolve a bound getUserMedia if the browser can do live capture in a secure
 * context. Returns null when unavailable — callers then fall back to the native
 * file picker. Guards every browser global for SSR/Node safety.
 */
export function getBrowserStreamGetter(): StreamGetter | null {
  if (typeof navigator === "undefined") return null;
  const md = navigator.mediaDevices;
  if (!md || typeof md.getUserMedia !== "function") return null;
  if (typeof window !== "undefined" && window.isSecureContext === false) return null;
  return (constraints) => md.getUserMedia(constraints);
}
