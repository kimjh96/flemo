/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,
  env: {
    // Always inlined as a literal, which is the point: an UNDEFINED
    // NEXT_PUBLIC_* is left as a live `process.env` lookup in the bundle, so
    // the playground's `enabled` check could not be folded and the flight
    // recorder shipped to every visitor anyway. With a default here both
    // branches are statically known and the dev-only import is eliminated.
    // The e2e build sets it to "1" (see playwright.config.ts).
    NEXT_PUBLIC_FLEMO_DEVTOOLS: process.env.NEXT_PUBLIC_FLEMO_DEVTOOLS ?? "0"
  }
};

export default config;
