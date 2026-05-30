# @flemo/react-layout

## 0.1.7

### Patch Changes

- Updated dependencies ([`4caa94d`](https://github.com/kimjh96/flemo/commit/4caa94d698eff23ef72bd72ce353f585a4942056), [`4caa94d`](https://github.com/kimjh96/flemo/commit/4caa94d698eff23ef72bd72ce353f585a4942056), [`6df7e4f`](https://github.com/kimjh96/flemo/commit/6df7e4fd5c3446771fbc9602d703273e75615af6), [`156a6f3`](https://github.com/kimjh96/flemo/commit/156a6f3f71c8b81128a9fc6efce8075bc9579bef)):
  - @flemo/core@1.2.0
  - @flemo/react@1.1.0

## 0.1.6

### Patch Changes

- Updated dependencies ([`dd05e27`](https://github.com/kimjh96/flemo/commit/dd05e276b7ae2358eb03ac4f2b322725cfb81a79), [`dd05e27`](https://github.com/kimjh96/flemo/commit/dd05e276b7ae2358eb03ac4f2b322725cfb81a79)):
  - @flemo/core@1.1.2
  - @flemo/react@1.0.6

## 0.1.5

### Patch Changes

- Updated dependencies ([`ac42b4b`](https://github.com/kimjh96/flemo/commit/ac42b4bb7fc7f26d471804a34bafbe80a34d0c93), [`ac42b4b`](https://github.com/kimjh96/flemo/commit/ac42b4bb7fc7f26d471804a34bafbe80a34d0c93)):
  - @flemo/core@1.1.1
  - @flemo/react@1.0.5

## 0.1.4

### Patch Changes

- Updated dependencies ([`a103461`](https://github.com/kimjh96/flemo/commit/a1034612ca3b2c2d564d9e1d8c7991e36a985ac2)):
  - @flemo/core@1.1.0
  - @flemo/react@1.0.4

## 0.1.3

### Patch Changes

- [`5b5eb2f`](https://github.com/kimjh96/flemo/commit/5b5eb2ffb7a940e7b0f4bc38babbbd72234ba937) Migrate the canonical site URL from `flemo-web.vercel.app` to `flemo.dev`. Updates `homepage` in the three published packages' `package.json` (so npm shows the new domain), the docs landing's `metadataBase` (so OG / canonical tags resolve under `flemo.dev`), and the `@flemo/react` README links. The old Vercel preview URL stays accessible but `flemo.dev` is the home from this release onward.
- Updated dependencies ([`5b5eb2f`](https://github.com/kimjh96/flemo/commit/5b5eb2ffb7a940e7b0f4bc38babbbd72234ba937), [`077cf72`](https://github.com/kimjh96/flemo/commit/077cf727bc41db8d6954b4aee331783ea035daba)):
  - @flemo/core@1.0.2
  - @flemo/react@1.0.3

## 0.1.2

### Patch Changes

- Updated dependencies ([`3e883cc`](https://github.com/kimjh96/flemo/commit/3e883cc9798f30de180ea35efaed4e32523cd350), [`3e883cc`](https://github.com/kimjh96/flemo/commit/3e883cc9798f30de180ea35efaed4e32523cd350)):
  - @flemo/react@1.0.2

## 0.1.1

### Patch Changes

- Updated dependencies ([`a6a3550`](https://github.com/kimjh96/flemo/commit/a6a35501ba640ed1cfa72e202fc4ef53cf487704), [`9e0384c`](https://github.com/kimjh96/flemo/commit/9e0384c6cbe34cfec71d541fa0f52319b647f2eb), [`f3e8ac9`](https://github.com/kimjh96/flemo/commit/f3e8ac9dd909fabc11621f6bd29449c286fb3bda), [`04a03d9`](https://github.com/kimjh96/flemo/commit/04a03d985d5517d87d570ea8b696dbaee3ef334e)):
  - @flemo/core@1.0.1
  - @flemo/react@1.0.1

## 0.1.0

### Minor Changes

- [`819fa1f`](https://github.com/kimjh96/flemo/commit/819fa1f0ee75ff1540b79b811ff6953eeff3bc20) - Initial release of `@flemo/react-layout` — `LayoutScreen` + `LayoutConfig` for shared-element morphs via `layoutId`. Moved out of `@flemo/react` so apps that don't use layoutId no longer carry the motion peer dependency. Install when you want a list item to morph into its detail view: `pnpm add @flemo/react-layout motion`. The components themselves are unchanged; only the import path moves: `import { LayoutScreen, LayoutConfig } from "@flemo/react-layout"`. Phase 3 will eventually replace motion with a native FLIP implementation here, dropping the motion peer dep entirely.

### Patch Changes

- Updated dependencies [[`1aef7de`](https://github.com/kimjh96/flemo/commit/1aef7de948d0a9edce6b48419558e468226c9eb4), [`3c79a56`](https://github.com/kimjh96/flemo/commit/3c79a56b2b87563162be0fa56782a5216ca55d58), [`7940122`](https://github.com/kimjh96/flemo/commit/79401229827beb0ce974ba2dee049b309081ca44), [`7940122`](https://github.com/kimjh96/flemo/commit/79401229827beb0ce974ba2dee049b309081ca44), [`7b3a038`](https://github.com/kimjh96/flemo/commit/7b3a038214a314fa3b7facfefe4cb8d30a851335), [`3a727cb`](https://github.com/kimjh96/flemo/commit/3a727cb2bf589147a1a7759a7a1f9e99b28d7926), [`58c930b`](https://github.com/kimjh96/flemo/commit/58c930bfcd30874f072d2567d255d2e283fe08f6), [`266008e`](https://github.com/kimjh96/flemo/commit/266008e65efa3f3c1357389a67c193cdff0df616), [`3c79a56`](https://github.com/kimjh96/flemo/commit/3c79a56b2b87563162be0fa56782a5216ca55d58), [`3c79a56`](https://github.com/kimjh96/flemo/commit/3c79a56b2b87563162be0fa56782a5216ca55d58)]:
  - @flemo/react@1.0.0
  - @flemo/core@1.0.0
