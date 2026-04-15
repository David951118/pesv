import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { uploadFileToS3 } from "./uploadToS3";

type Listener = (ev?: unknown) => void;

class MockXHR {
  static instances: MockXHR[] = [];
  public method = "";
  public url = "";
  public headers: Record<string, string> = {};
  public sent: unknown = null;
  public status = 200;
  public upload = {
    listeners: {} as Record<string, Listener>,
    addEventListener(evt: string, cb: Listener) {
      this.listeners[evt] = cb;
    },
  };
  public listeners: Record<string, Listener> = {};

  constructor() {
    MockXHR.instances.push(this);
  }
  open(method: string, url: string) {
    this.method = method;
    this.url = url;
  }
  setRequestHeader(k: string, v: string) {
    this.headers[k] = v;
  }
  addEventListener(evt: string, cb: Listener) {
    this.listeners[evt] = cb;
  }
  send(body: unknown) {
    this.sent = body;
  }
  // helpers
  triggerProgress(loaded: number, total: number) {
    this.upload.listeners["progress"]?.({ lengthComputable: true, loaded, total });
  }
  triggerLoad(status = 200) {
    this.status = status;
    this.listeners["load"]?.();
  }
  triggerError() {
    this.listeners["error"]?.();
  }
  triggerAbort() {
    this.listeners["abort"]?.();
  }
}

describe("uploadFileToS3", () => {
  let originalXHR: typeof XMLHttpRequest;

  beforeEach(() => {
    MockXHR.instances = [];
    originalXHR = globalThis.XMLHttpRequest;
    // @ts-expect-error test mock
    globalThis.XMLHttpRequest = MockXHR;
  });

  afterEach(() => {
    globalThis.XMLHttpRequest = originalXHR;
  });

  it("opens a PUT request to the provided URL and sets content-type", async () => {
    const file = new File(["hello"], "hello.txt", { type: "text/plain" });
    const p = uploadFileToS3("https://example.com/upload", file);
    const xhr = MockXHR.instances[0];
    expect(xhr.method).toBe("PUT");
    expect(xhr.url).toBe("https://example.com/upload");
    expect(xhr.headers["Content-Type"]).toBe("text/plain");
    expect(xhr.sent).toBe(file);
    xhr.triggerLoad(200);
    await expect(p).resolves.toBeUndefined();
  });

  it("resolves on success (2xx)", async () => {
    const file = new File(["x"], "a.bin");
    const p = uploadFileToS3("https://x", file);
    MockXHR.instances[0].triggerLoad(204);
    await expect(p).resolves.toBeUndefined();
  });

  it("rejects on non-2xx status", async () => {
    const file = new File(["x"], "a.bin");
    const p = uploadFileToS3("https://x", file);
    MockXHR.instances[0].triggerLoad(500);
    await expect(p).rejects.toThrow(/500/);
  });

  it("rejects on network error", async () => {
    const file = new File(["x"], "a.bin");
    const p = uploadFileToS3("https://x", file);
    MockXHR.instances[0].triggerError();
    await expect(p).rejects.toThrow(/red/);
  });

  it("rejects on abort", async () => {
    const file = new File(["x"], "a.bin");
    const p = uploadFileToS3("https://x", file);
    MockXHR.instances[0].triggerAbort();
    await expect(p).rejects.toThrow(/cancelada/);
  });

  it("reports progress with percent", async () => {
    const file = new File(["x"], "a.bin");
    const onProgress = vi.fn();
    const p = uploadFileToS3("https://x", file, onProgress);
    const xhr = MockXHR.instances[0];
    xhr.triggerProgress(50, 200);
    expect(onProgress).toHaveBeenCalledWith({ loaded: 50, total: 200, percent: 25 });
    xhr.triggerLoad(200);
    await p;
  });
});
