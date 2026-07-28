// In-flight request accounting, so a transition can tell "this screen is
// still loading" from "this screen is already complete".
//
// The content-settle gate (see animStartAnchor) makes a cold navigation enter
// with its content already there, which is what makes a cold flight feel like
// a cached one — measured on the glass, and confirmed on device. But waiting
// for content that is never coming would tax every WARM navigation with the
// full timeout, and a warm entry is exactly the case that is already perfect.
// The distinction cannot be read from the DOM (a skeleton and a sparse screen
// look alike) and the consumer must not have to declare it, so the library
// counts the requests itself.
//
// The instrumentation is deliberately minimal: it increments and decrements a
// counter around the platform's two request paths and never inspects, buffers,
// or alters anything. Both wrappers delegate immediately and preserve
// rejection, so a failed request settles the counter exactly like a successful
// one. Installed once, lazily, and only in a browser.

let pending = 0;
let installed = false;

const settle = () => {
  pending = Math.max(0, pending - 1);
};

const install = () => {
  if (installed || typeof window === "undefined") return;
  installed = true;

  if (typeof window.fetch === "function") {
    const original = window.fetch.bind(window);
    window.fetch = (...args: Parameters<typeof fetch>) => {
      pending += 1;
      let result: Promise<Response>;
      try {
        result = original(...args);
      } catch (error) {
        settle();
        throw error;
      }
      return result.then(
        (response) => {
          settle();
          return response;
        },
        (error) => {
          settle();
          throw error;
        }
      );
    };
  }

  if (typeof XMLHttpRequest === "function") {
    const originalSend = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.send = function send(
      this: XMLHttpRequest,
      ...args: Parameters<XMLHttpRequest["send"]>
    ) {
      pending += 1;
      let settled = false;
      const once = () => {
        if (settled) return;
        settled = true;
        settle();
      };
      this.addEventListener("loadend", once);
      try {
        return originalSend.apply(this, args);
      } catch (error) {
        once();
        throw error;
      }
    };
  }
};

// Whether anything is currently in flight. Installs the accounting on first
// use, so an app that never asks never pays for it.
export const hasPendingRequests = (): boolean => {
  install();
  return pending > 0;
};

// Test seam: the counter's current value.
export const pendingRequestCount = (): number => pending;
