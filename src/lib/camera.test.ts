import { describe, it, expect, vi } from "vitest";
import {
  CameraError,
  CameraSession,
  acquireCameraStream,
  buildConstraintChain,
  captureStill,
  classifyCameraError,
  classifyCameraErrorKind,
  computeCaptureSize,
  getBrowserStreamGetter,
  stopStream,
  type FrameCanvas,
  type StreamGetter,
} from "@/lib/camera";

/** A fake MediaStreamTrack.stop() spy + a stream that exposes it. */
function fakeStream() {
  const track = { stop: vi.fn() };
  const stream = { getTracks: () => [track] } as unknown as MediaStream;
  return { stream, track };
}

/** A DOMException-like object with just the `.name` getUserMedia rejects with. */
function domError(name: string) {
  return Object.assign(new Error(name), { name });
}

describe("classifyCameraErrorKind", () => {
  it("maps permission errors to 'denied'", () => {
    expect(classifyCameraErrorKind(domError("NotAllowedError"))).toBe("denied");
    expect(classifyCameraErrorKind(domError("SecurityError"))).toBe("denied");
  });
  it("maps hardware errors to 'in-use'", () => {
    expect(classifyCameraErrorKind(domError("NotReadableError"))).toBe("in-use");
    expect(classifyCameraErrorKind(domError("AbortError"))).toBe("in-use");
  });
  it("maps missing devices and constraints", () => {
    expect(classifyCameraErrorKind(domError("NotFoundError"))).toBe("not-found");
    expect(classifyCameraErrorKind(domError("OverconstrainedError"))).toBe("overconstrained");
  });
  it("passes through an existing CameraError kind", () => {
    expect(classifyCameraErrorKind(new CameraError("no-frame"))).toBe("no-frame");
  });
  it("falls back to 'unknown' for unrecognized errors", () => {
    expect(classifyCameraErrorKind(domError("WeirdError"))).toBe("unknown");
    expect(classifyCameraErrorKind("not even an error")).toBe("unknown");
  });
  it("classifyCameraError never leaks a raw error to the UI", () => {
    const e = classifyCameraError(domError("NotAllowedError"));
    expect(e).toBeInstanceOf(CameraError);
    expect(e.kind).toBe("denied");
    expect(e.message).toMatch(/denied/i);
  });
});

describe("buildConstraintChain", () => {
  it("never uses exact constraints and always ends with a generic fallback", () => {
    const chain = buildConstraintChain("environment");
    expect(chain.length).toBeGreaterThanOrEqual(2);
    expect(JSON.stringify(chain)).not.toContain("exact");
    expect(chain[chain.length - 1]).toEqual({ video: true, audio: false });
  });
  it("never requests audio (avoids the microphone permission)", () => {
    for (const c of buildConstraintChain("user")) expect(c.audio).toBe(false);
  });
});

describe("acquireCameraStream", () => {
  it("resolves with the first stream when the preferred constraints succeed", async () => {
    const { stream } = fakeStream();
    const get: StreamGetter = vi.fn().mockResolvedValue(stream);
    await expect(acquireCameraStream(get)).resolves.toBe(stream);
    expect(get).toHaveBeenCalledTimes(1);
  });

  it("falls back to the next constraint set when the preferred one is overconstrained", async () => {
    const { stream } = fakeStream();
    const get = vi
      .fn()
      .mockRejectedValueOnce(domError("OverconstrainedError"))
      .mockResolvedValueOnce(stream);
    await expect(acquireCameraStream(get)).resolves.toBe(stream);
    expect(get).toHaveBeenCalledTimes(2);
  });

  it("stops immediately (no fallback) on NotAllowedError — relaxing can't fix denial", async () => {
    const get = vi.fn().mockRejectedValue(domError("NotAllowedError"));
    await expect(acquireCameraStream(get)).rejects.toMatchObject({ kind: "denied" });
    expect(get).toHaveBeenCalledTimes(1);
  });

  it("stops immediately on NotReadableError (hardware busy)", async () => {
    const get = vi.fn().mockRejectedValue(domError("NotReadableError"));
    await expect(acquireCameraStream(get)).rejects.toMatchObject({ kind: "in-use" });
    expect(get).toHaveBeenCalledTimes(1);
  });

  it("throws the classified last error when every constraint set fails", async () => {
    const get = vi.fn().mockRejectedValue(domError("NotFoundError"));
    await expect(acquireCameraStream(get)).rejects.toMatchObject({ kind: "not-found" });
    expect(get).toHaveBeenCalledTimes(buildConstraintChain().length);
  });

  it("reports 'unsupported' when given an empty chain", async () => {
    await expect(acquireCameraStream(vi.fn(), [])).rejects.toMatchObject({ kind: "unsupported" });
  });
});

describe("stopStream", () => {
  it("stops every track", () => {
    const { stream, track } = fakeStream();
    stopStream(stream);
    expect(track.stop).toHaveBeenCalledTimes(1);
  });
  it("is safe with null and when called twice", () => {
    const { stream, track } = fakeStream();
    expect(() => stopStream(null)).not.toThrow();
    stopStream(stream);
    stopStream(stream);
    expect(track.stop).toHaveBeenCalledTimes(2);
  });
  it("swallows a track.stop() that throws", () => {
    const track = {
      stop: vi.fn(() => {
        throw new Error("already ended");
      }),
    };
    const stream = { getTracks: () => [track] } as unknown as MediaStream;
    expect(() => stopStream(stream)).not.toThrow();
  });
});

describe("computeCaptureSize", () => {
  it("passes small images through unscaled", () => {
    expect(computeCaptureSize(640, 480, 1280)).toEqual({ width: 640, height: 480 });
  });
  it("bounds the longest edge to maxDim, preserving aspect ratio", () => {
    expect(computeCaptureSize(4000, 3000, 1280)).toEqual({ width: 1280, height: 960 });
  });
  it("never returns a zero dimension", () => {
    const { width, height } = computeCaptureSize(1, 10000, 100);
    expect(width).toBeGreaterThanOrEqual(1);
    expect(height).toBeGreaterThanOrEqual(1);
  });
});

/** A fake canvas whose toBlob yields the given blob (or null to simulate failure). */
function fakeCanvas(blob: Blob | null) {
  const draw = vi.fn();
  const canvas = {
    width: 0,
    height: 0,
    getContext: () => ({ drawImage: draw }),
    toBlob: (cb: (b: Blob | null) => void) => cb(blob),
  } as unknown as FrameCanvas;
  return { canvas, draw };
}

describe("captureStill", () => {
  it("rejects with 'no-frame' when the video has zero dimensions", async () => {
    const { canvas } = fakeCanvas(new Blob(["x"]));
    await expect(captureStill({ videoWidth: 0, videoHeight: 0 }, canvas)).rejects.toMatchObject({
      kind: "no-frame",
    });
  });

  it("captures a Blob once the video is ready and bounds the canvas to maxDim", async () => {
    const blob = new Blob(["jpeg"], { type: "image/jpeg" });
    const { canvas, draw } = fakeCanvas(blob);
    const result = await captureStill({ videoWidth: 4000, videoHeight: 2000 }, canvas, {
      maxDim: 1000,
    });
    expect(result).toBe(blob);
    expect(canvas.width).toBe(1000);
    expect(canvas.height).toBe(500);
    expect(draw).toHaveBeenCalledTimes(1);
  });

  it("rejects with 'capture-failed' when toBlob yields null", async () => {
    const { canvas } = fakeCanvas(null);
    await expect(captureStill({ videoWidth: 100, videoHeight: 100 }, canvas)).rejects.toMatchObject(
      { kind: "capture-failed" }
    );
  });

  it("rejects with 'capture-failed' when there is no 2D context", async () => {
    const canvas = {
      width: 0,
      height: 0,
      getContext: () => null,
      toBlob: () => {},
    } as unknown as FrameCanvas;
    await expect(captureStill({ videoWidth: 100, videoHeight: 100 }, canvas)).rejects.toMatchObject(
      { kind: "capture-failed" }
    );
  });
});

describe("CameraSession", () => {
  it("acquires a single stream and de-dupes concurrent starts (one getUserMedia)", async () => {
    const { stream } = fakeStream();
    const get: StreamGetter = vi.fn().mockResolvedValue(stream);
    const session = new CameraSession(get);
    const [a, b] = await Promise.all([session.start(), session.start()]);
    expect(a).toBe(stream);
    expect(b).toBe(stream);
    expect(get).toHaveBeenCalledTimes(1);
    expect(session.state).toBe("active");
  });

  it("reuses the active stream on a later start without re-acquiring", async () => {
    const { stream } = fakeStream();
    const get: StreamGetter = vi.fn().mockResolvedValue(stream);
    const session = new CameraSession(get);
    await session.start();
    await session.start();
    expect(get).toHaveBeenCalledTimes(1);
  });

  it("stops all tracks on stop() and is idempotent", async () => {
    const { stream, track } = fakeStream();
    const session = new CameraSession(vi.fn().mockResolvedValue(stream));
    await session.start();
    session.stop();
    session.stop();
    expect(track.stop).toHaveBeenCalledTimes(1);
    expect(session.state).toBe("stopped");
    expect(session.getActiveStream()).toBeNull();
  });

  it("does not leak the stream when closed mid-start", async () => {
    const { stream, track } = fakeStream();
    let resolve!: (s: MediaStream) => void;
    const get: StreamGetter = () => new Promise<MediaStream>((r) => (resolve = r));
    const session = new CameraSession(get);
    const started = session.start();
    session.stop(); // close before getUserMedia resolves
    resolve(stream); // stream arrives after close
    await expect(started).rejects.toMatchObject({ kind: "stopped" });
    expect(track.stop).toHaveBeenCalledTimes(1); // the late stream was released
    expect(session.getActiveStream()).toBeNull();
  });

  it("rejects start() after the session is closed", async () => {
    const session = new CameraSession(vi.fn());
    session.stop();
    await expect(session.start()).rejects.toMatchObject({ kind: "stopped" });
  });

  it("propagates a classified error from a failed acquire", async () => {
    const get = vi.fn().mockRejectedValue(domError("NotAllowedError"));
    const session = new CameraSession(get);
    await expect(session.start()).rejects.toMatchObject({ kind: "denied" });
    expect(session.state).toBe("starting");
  });
});

describe("getBrowserStreamGetter", () => {
  it("returns null when navigator.mediaDevices is unavailable", () => {
    // Node test env has no navigator.mediaDevices.
    expect(getBrowserStreamGetter()).toBeNull();
  });
});
