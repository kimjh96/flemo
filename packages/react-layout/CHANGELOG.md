# @flemo/react-layout

## 0.1.49

### Patch Changes

- Updated dependencies ([`db0985b`](https://github.com/kimjh96/flemo/commit/db0985b6d5e81bf5a2cd0e24bba97b0176cd2844), [`d30a03f`](https://github.com/kimjh96/flemo/commit/d30a03fb860a3850c2925c9f67dad5615a7d50ac)):
  - @flemo/core@1.28.0
  - @flemo/react@1.12.5

## 0.1.48

### Patch Changes

- Updated dependencies ([`034a295`](https://github.com/kimjh96/flemo/commit/034a295aae17d2cb2a872b07666d6d570cec6753)):
  - @flemo/core@1.27.1
  - @flemo/react@1.12.4

## 0.1.47

### Patch Changes

- Updated dependencies ([`cbb258d`](https://github.com/kimjh96/flemo/commit/cbb258da2b94456d3c7d31db6ab1bbada0ceb764), [`fb4bb71`](https://github.com/kimjh96/flemo/commit/fb4bb71074f697435acfe8609b4073e2e2c4adc0), [`e89b3e7`](https://github.com/kimjh96/flemo/commit/e89b3e776722ea972250c5fe4af91083ba33a643), [`c0232a9`](https://github.com/kimjh96/flemo/commit/c0232a940c614b6442b63b8abf61ba8d86a94adf), [`b786a0b`](https://github.com/kimjh96/flemo/commit/b786a0b9a5fa81b19ab38b6f77e0d7149eca5d81)):
  - @flemo/core@1.27.0
  - @flemo/react@1.12.3

## 0.1.46

### Patch Changes

- Updated dependencies ([`6b1bb93`](https://github.com/kimjh96/flemo/commit/6b1bb93383221c29ba0d630123ca60a7b8f16d30), [`d6dab7f`](https://github.com/kimjh96/flemo/commit/d6dab7f398024dd3f9cae885aba9dfa73b48dda6), [`9d706dc`](https://github.com/kimjh96/flemo/commit/9d706dcda42aacc4d15262dd76fbe7821a52d541), [`9685d02`](https://github.com/kimjh96/flemo/commit/9685d020fea2e6f87ee7893a6b3d616cd8cc26bd)):
  - @flemo/core@1.26.0
  - @flemo/react@1.12.2

## 0.1.45

### Patch Changes

- Updated dependencies ([`445e116`](https://github.com/kimjh96/flemo/commit/445e1163cf3b53d31b3b3cd0e19856bcd237aa9e)):
  - @flemo/core@1.25.1
  - @flemo/react@1.12.1

## 0.1.44

### Patch Changes

- Updated dependencies ([`fb09af3`](https://github.com/kimjh96/flemo/commit/fb09af3b9c8b153ccfb12190ce55c460a67ef3b9), [`55d4fc5`](https://github.com/kimjh96/flemo/commit/55d4fc57ae4ab0d585a1887a6952026f769390a9)):
  - @flemo/react@1.12.0

## 0.1.43

### Patch Changes

- Updated dependencies ([`c2aa749`](https://github.com/kimjh96/flemo/commit/c2aa749a4064ebe68f22bc2ad4e7f8f88c0d41bb)):
  - @flemo/core@1.25.0
  - @flemo/react@1.11.1

## 0.1.42

### Patch Changes

- [`f6463d9`](https://github.com/kimjh96/flemo/commit/f6463d97d08c722b036ee4f436112d016460f45b) `LayoutScreen` now composes `Screen` instead of re-implementing the freeze predicate. The hand-rolled copy froze this package in time: the predicate moved into core, the direct prev screen's freeze became deferred past the convergence (a measured ~0.2 dropped frames per flight), and `flemo:freeze=shallow` became URL-armable — and a `LayoutScreen` consumer received none of it. The transparent background and the `AnimatePresence` wrapper are unchanged.
- Updated dependencies ([`30c2a54`](https://github.com/kimjh96/flemo/commit/30c2a5428e3561aa0d43295df852031c02975e39), [`9b16d8f`](https://github.com/kimjh96/flemo/commit/9b16d8fcd5b267b0e8865001c8db505be56814cf), [`707442e`](https://github.com/kimjh96/flemo/commit/707442e1ec67612f016aba93685750dc21a32541), [`cec6ab6`](https://github.com/kimjh96/flemo/commit/cec6ab66d6334fe8203ea304fe496ff6849fa559), [`0473551`](https://github.com/kimjh96/flemo/commit/0473551b5911d203ae7984ba53623baa6268396b), [`fca7692`](https://github.com/kimjh96/flemo/commit/fca7692bfccdb9d3e5a9cd89ecdb97d99640ad80), [`de35c13`](https://github.com/kimjh96/flemo/commit/de35c13ae4639ef42627b213f74f6387d5ce3745), [`b495c99`](https://github.com/kimjh96/flemo/commit/b495c99651e2eb73f720d2f802525b538a782c95), [`20744c0`](https://github.com/kimjh96/flemo/commit/20744c0f2ed1bcfd8d50a5c4b6c9fb52bc7d9226), [`945eaba`](https://github.com/kimjh96/flemo/commit/945eabace0200a7693271e9433e28da62f2e848a), [`88c5cff`](https://github.com/kimjh96/flemo/commit/88c5cff30f3edd580b4a52513e287aa1c082882f), [`14923eb`](https://github.com/kimjh96/flemo/commit/14923eb8d7f6c9c3574d8c95db606ff190b2ca54), [`de35c13`](https://github.com/kimjh96/flemo/commit/de35c13ae4639ef42627b213f74f6387d5ce3745), [`b6c62f6`](https://github.com/kimjh96/flemo/commit/b6c62f67569a5cb5901e7de7ad9536eeefb0a3e9), [`2be1e05`](https://github.com/kimjh96/flemo/commit/2be1e05a6d18883830edeaffbe5db7d724ebb204), [`6d6dae8`](https://github.com/kimjh96/flemo/commit/6d6dae8f98b159d3faa5b0b57a637288fffc6c53), [`6d3cc23`](https://github.com/kimjh96/flemo/commit/6d3cc238755a1a7d2d25edbf9113ea7c27fc571e), [`707442e`](https://github.com/kimjh96/flemo/commit/707442e1ec67612f016aba93685750dc21a32541), [`707442e`](https://github.com/kimjh96/flemo/commit/707442e1ec67612f016aba93685750dc21a32541), [`bfd077a`](https://github.com/kimjh96/flemo/commit/bfd077a0b67181da88f73d46ccadcff73b7ff65d), [`b6c62f6`](https://github.com/kimjh96/flemo/commit/b6c62f67569a5cb5901e7de7ad9536eeefb0a3e9)):
  - @flemo/core@1.24.0
  - @flemo/react@1.11.0

## 0.1.41

### Patch Changes

- Updated dependencies ([`490b0e4`](https://github.com/kimjh96/flemo/commit/490b0e420429b828011c7092c549f52258beae80)):
  - @flemo/core@1.23.0
  - @flemo/react@1.10.0

## 0.1.40

### Patch Changes

- Updated dependencies ([`c0a878d`](https://github.com/kimjh96/flemo/commit/c0a878d936c2f9057fbd4f9817710ff58402d86e), [`c0a878d`](https://github.com/kimjh96/flemo/commit/c0a878d936c2f9057fbd4f9817710ff58402d86e), [`c0a878d`](https://github.com/kimjh96/flemo/commit/c0a878d936c2f9057fbd4f9817710ff58402d86e), [`c0a878d`](https://github.com/kimjh96/flemo/commit/c0a878d936c2f9057fbd4f9817710ff58402d86e), [`0c721b8`](https://github.com/kimjh96/flemo/commit/0c721b8c27bea2d895f855a1a8384ccc42a87c97), [`c0a878d`](https://github.com/kimjh96/flemo/commit/c0a878d936c2f9057fbd4f9817710ff58402d86e)):
  - @flemo/core@1.22.1
  - @flemo/react@1.9.0

## 0.1.39

### Patch Changes

- Updated dependencies ([`9a98052`](https://github.com/kimjh96/flemo/commit/9a98052e826200d9ed98c213c95f847e774e4bc0), [`9a98052`](https://github.com/kimjh96/flemo/commit/9a98052e826200d9ed98c213c95f847e774e4bc0), [`9a98052`](https://github.com/kimjh96/flemo/commit/9a98052e826200d9ed98c213c95f847e774e4bc0), [`9a98052`](https://github.com/kimjh96/flemo/commit/9a98052e826200d9ed98c213c95f847e774e4bc0), [`9a98052`](https://github.com/kimjh96/flemo/commit/9a98052e826200d9ed98c213c95f847e774e4bc0)):
  - @flemo/core@1.22.0
  - @flemo/react@1.8.2

## 0.1.38

### Patch Changes

- Updated dependencies ([`b85b941`](https://github.com/kimjh96/flemo/commit/b85b9417bdf0aa65ab2f2ebafe157e75f419464e), [`b85b941`](https://github.com/kimjh96/flemo/commit/b85b9417bdf0aa65ab2f2ebafe157e75f419464e), [`b85b941`](https://github.com/kimjh96/flemo/commit/b85b9417bdf0aa65ab2f2ebafe157e75f419464e)):
  - @flemo/core@1.21.1
  - @flemo/react@1.8.1

## 0.1.37

### Patch Changes

- Updated dependencies ([`372c03c`](https://github.com/kimjh96/flemo/commit/372c03cadb82160e58bd2d70750543c00acb766f), [`372c03c`](https://github.com/kimjh96/flemo/commit/372c03cadb82160e58bd2d70750543c00acb766f), [`372c03c`](https://github.com/kimjh96/flemo/commit/372c03cadb82160e58bd2d70750543c00acb766f), [`372c03c`](https://github.com/kimjh96/flemo/commit/372c03cadb82160e58bd2d70750543c00acb766f), [`372c03c`](https://github.com/kimjh96/flemo/commit/372c03cadb82160e58bd2d70750543c00acb766f), [`372c03c`](https://github.com/kimjh96/flemo/commit/372c03cadb82160e58bd2d70750543c00acb766f), [`372c03c`](https://github.com/kimjh96/flemo/commit/372c03cadb82160e58bd2d70750543c00acb766f)):
  - @flemo/core@1.21.0
  - @flemo/react@1.8.0

## 0.1.36

### Patch Changes

- Updated dependencies ([`46aec20`](https://github.com/kimjh96/flemo/commit/46aec20c5f4d88a0db769dab9e998ba7c663fed6), [`46aec20`](https://github.com/kimjh96/flemo/commit/46aec20c5f4d88a0db769dab9e998ba7c663fed6), [`46aec20`](https://github.com/kimjh96/flemo/commit/46aec20c5f4d88a0db769dab9e998ba7c663fed6), [`46aec20`](https://github.com/kimjh96/flemo/commit/46aec20c5f4d88a0db769dab9e998ba7c663fed6), [`46aec20`](https://github.com/kimjh96/flemo/commit/46aec20c5f4d88a0db769dab9e998ba7c663fed6), [`46aec20`](https://github.com/kimjh96/flemo/commit/46aec20c5f4d88a0db769dab9e998ba7c663fed6), [`46aec20`](https://github.com/kimjh96/flemo/commit/46aec20c5f4d88a0db769dab9e998ba7c663fed6)):
  - @flemo/core@1.20.0
  - @flemo/react@1.7.2

## 0.1.35

### Patch Changes

- Updated dependencies ([`d979a33`](https://github.com/kimjh96/flemo/commit/d979a33db7642e70bb3687cd12593b789c7dcc39)):
  - @flemo/react@1.7.1
  - @flemo/core@1.19.1

## 0.1.34

### Patch Changes

- Updated dependencies ([`b7096b0`](https://github.com/kimjh96/flemo/commit/b7096b04e4d181389db5f2af7bd9c6f76688e3a8), [`b7096b0`](https://github.com/kimjh96/flemo/commit/b7096b04e4d181389db5f2af7bd9c6f76688e3a8), [`b7096b0`](https://github.com/kimjh96/flemo/commit/b7096b04e4d181389db5f2af7bd9c6f76688e3a8)):
  - @flemo/react@1.7.0
  - @flemo/core@1.19.0

## 0.1.33

### Patch Changes

- Updated dependencies ([`c2ddae3`](https://github.com/kimjh96/flemo/commit/c2ddae3e4ea6ade5cc5ee2c9651c152bb2f2232d)):
  - @flemo/core@1.18.1
  - @flemo/react@1.6.9

## 0.1.32

### Patch Changes

- Updated dependencies ([`4214525`](https://github.com/kimjh96/flemo/commit/4214525eba426cf29c3f00adeb404126c9cd6b67)):
  - @flemo/core@1.18.0
  - @flemo/react@1.6.8

## 0.1.31

### Patch Changes

- Updated dependencies ([`980af25`](https://github.com/kimjh96/flemo/commit/980af254371f322d1a7bdbbc657d449e6be464ed)):
  - @flemo/core@1.17.0
  - @flemo/react@1.6.7

## 0.1.30

### Patch Changes

- Updated dependencies ([`15ab16b`](https://github.com/kimjh96/flemo/commit/15ab16b5c2dc0e8b015f965c8871358a9fc26532)):
  - @flemo/core@1.16.1
  - @flemo/react@1.6.6

## 0.1.29

### Patch Changes

- Updated dependencies ([`39bc7ea`](https://github.com/kimjh96/flemo/commit/39bc7eab906cb785a50405be7ea7438f0e6c4293)):
  - @flemo/core@1.16.0
  - @flemo/react@1.6.5

## 0.1.28

### Patch Changes

- Updated dependencies ([`1a21cfc`](https://github.com/kimjh96/flemo/commit/1a21cfc94a8a01fba0e920fa179e67e4d0d84448)):
  - @flemo/core@1.15.0
  - @flemo/react@1.6.4

## 0.1.27

### Patch Changes

- Updated dependencies ([`8236d28`](https://github.com/kimjh96/flemo/commit/8236d28865712207b02b5b701bbb9aab6f6405af)):
  - @flemo/core@1.14.0
  - @flemo/react@1.6.3

## 0.1.26

### Patch Changes

- Updated dependencies ([`8c084ba`](https://github.com/kimjh96/flemo/commit/8c084ba038f9e8f445844f9e108bcf15faa3c713), [`8c084ba`](https://github.com/kimjh96/flemo/commit/8c084ba038f9e8f445844f9e108bcf15faa3c713), [`8c084ba`](https://github.com/kimjh96/flemo/commit/8c084ba038f9e8f445844f9e108bcf15faa3c713), [`8c084ba`](https://github.com/kimjh96/flemo/commit/8c084ba038f9e8f445844f9e108bcf15faa3c713)):
  - @flemo/core@1.13.0
  - @flemo/react@1.6.2

## 0.1.25

### Patch Changes

- Updated dependencies ([`1d2edf0`](https://github.com/kimjh96/flemo/commit/1d2edf012f5030fa8c834a59c9c49ee500d8a30f)):
  - @flemo/core@1.12.1
  - @flemo/react@1.6.1

## 0.1.24

### Patch Changes

- Updated dependencies ([`2553ce0`](https://github.com/kimjh96/flemo/commit/2553ce036c6656ee89317ebec6d6c83c8d28050c)):
  - @flemo/react@1.6.0

## 0.1.23

### Patch Changes

- Updated dependencies ([`51c9eac`](https://github.com/kimjh96/flemo/commit/51c9eacf9afcf68dcc1731e3d7fee5b443e7d9e6)):
  - @flemo/core@1.12.0
  - @flemo/react@1.5.8

## 0.1.22

### Patch Changes

- Updated dependencies ([`bce265d`](https://github.com/kimjh96/flemo/commit/bce265d3e4b50823d3f557872e052ced5b4a72fe)):
  - @flemo/core@1.11.0
  - @flemo/react@1.5.7

## 0.1.21

### Patch Changes

- Updated dependencies ([`3580635`](https://github.com/kimjh96/flemo/commit/3580635dabf45d9ce23743ff17440750e4bc9ffe)):
  - @flemo/core@1.10.1
  - @flemo/react@1.5.6

## 0.1.20

### Patch Changes

- Updated dependencies ([`5b17d4b`](https://github.com/kimjh96/flemo/commit/5b17d4bae35a7d765ba141009a773c63c59d7586)):
  - @flemo/core@1.10.0
  - @flemo/react@1.5.5

## 0.1.19

### Patch Changes

- Updated dependencies ([`40d8584`](https://github.com/kimjh96/flemo/commit/40d8584c75291b96b10a3cda59c93d40acc3209c)):
  - @flemo/core@1.9.0
  - @flemo/react@1.5.4

## 0.1.18

### Patch Changes

- Updated dependencies ([`4e54577`](https://github.com/kimjh96/flemo/commit/4e545777a41fa1dac7b23aba193cc85f3cf73c7f)):
  - @flemo/core@1.8.0
  - @flemo/react@1.5.3

## 0.1.17

### Patch Changes

- Updated dependencies ([`deed72d`](https://github.com/kimjh96/flemo/commit/deed72d2765caefa970a99315b195a0751c83e19), [`deed72d`](https://github.com/kimjh96/flemo/commit/deed72d2765caefa970a99315b195a0751c83e19)):
  - @flemo/core@1.7.0
  - @flemo/react@1.5.2

## 0.1.16

### Patch Changes

- Updated dependencies ([`7513f82`](https://github.com/kimjh96/flemo/commit/7513f82eac7788d7c49ba57efd248a60b4d906f2)):
  - @flemo/core@1.6.1
  - @flemo/react@1.5.1

## 0.1.15

### Patch Changes

- Updated dependencies ([`f04a8d1`](https://github.com/kimjh96/flemo/commit/f04a8d17c587d7ab930e548a45497d63fa85bf95), [`35f29e9`](https://github.com/kimjh96/flemo/commit/35f29e99902362c2ade3c9652af7442829ea0a13), [`9937291`](https://github.com/kimjh96/flemo/commit/993729187939f96122381cd740343a7a8878efc1), [`32a5c6e`](https://github.com/kimjh96/flemo/commit/32a5c6e2d94c16bda0af5d9b90989abf8c213912), [`32a5c6e`](https://github.com/kimjh96/flemo/commit/32a5c6e2d94c16bda0af5d9b90989abf8c213912), [`32a5c6e`](https://github.com/kimjh96/flemo/commit/32a5c6e2d94c16bda0af5d9b90989abf8c213912), [`32a5c6e`](https://github.com/kimjh96/flemo/commit/32a5c6e2d94c16bda0af5d9b90989abf8c213912), [`32a5c6e`](https://github.com/kimjh96/flemo/commit/32a5c6e2d94c16bda0af5d9b90989abf8c213912), [`32a5c6e`](https://github.com/kimjh96/flemo/commit/32a5c6e2d94c16bda0af5d9b90989abf8c213912), [`32a5c6e`](https://github.com/kimjh96/flemo/commit/32a5c6e2d94c16bda0af5d9b90989abf8c213912), [`32a5c6e`](https://github.com/kimjh96/flemo/commit/32a5c6e2d94c16bda0af5d9b90989abf8c213912), [`32a5c6e`](https://github.com/kimjh96/flemo/commit/32a5c6e2d94c16bda0af5d9b90989abf8c213912), [`f9f0214`](https://github.com/kimjh96/flemo/commit/f9f02140b091903ffa9f7a64494a5c1d8d56b084)):
  - @flemo/react@1.5.0
  - @flemo/core@1.6.0

## 0.1.14

### Patch Changes

- Updated dependencies ([`e316444`](https://github.com/kimjh96/flemo/commit/e316444d3327df09569cd4568eb697878da85bff)):
  - @flemo/react@1.4.2

## 0.1.13

### Patch Changes

- Updated dependencies ([`080024f`](https://github.com/kimjh96/flemo/commit/080024f7daa158c4ed36ba25d516eaaa04908aa5)):
  - @flemo/react@1.4.1

## 0.1.12

### Patch Changes

- Updated dependencies ([`002c317`](https://github.com/kimjh96/flemo/commit/002c317647017b0c11dd4a3243fab830e2a535b1)):
  - @flemo/core@1.5.0
  - @flemo/react@1.4.0

## 0.1.11

### Patch Changes

- Updated dependencies ([`05cc7eb`](https://github.com/kimjh96/flemo/commit/05cc7eba37ede2ca088c1ea73116a9b99388f7f6)):
  - @flemo/react@1.3.2

## 0.1.10

### Patch Changes

- Updated dependencies ([`343ea33`](https://github.com/kimjh96/flemo/commit/343ea3331ed5ac3f087fdf8fb0ed0a9ebf4c1062)):
  - @flemo/react@1.3.1

## 0.1.9

### Patch Changes

- [`cf01904`](https://github.com/kimjh96/flemo/commit/cf01904fb806408db03cba65ceb4026201d3b551) Roll up Renovate dependency updates. Bump runtime and peer ranges: `react`/`react-dom` to `^19.2.7`, `motion` to `^12.40.0`, `path-to-regexp` to `^8.4.2`, `zustand` to `^5.0.14`. Also refreshes web app and toolchain deps (next, fumadocs, tailwindcss, eslint, typescript, vite) with no API changes.

- [`475540c`](https://github.com/kimjh96/flemo/commit/475540cfbbf78614b4227fc798c0f4d3987852d6) Make the navigation stores request-scoped so screens render during SSR. The
  history/navigate/transition/screen stores are no longer module-level singletons
  shared across every SSR request; the Router now creates one bundle per mount,
  seeds it from `initPath`, and provides it via context. Because the seed is the
  store's initial state, zustand hands it to React as the server snapshot, so the
  screen stack paints on the server (previously the root was empty until the
  client mounted) and each concurrent request keeps its own stack.

  The public API (`Router`, `Route`, `useNavigate`, `useParams`, `useScreen`,
  `Screen`, `LayoutScreen`) is unchanged. Internally, `@flemo/core` now exposes the
  stores as `createHistoryStore` / `createNavigateStore` / `createTransitionStore`
  factories instead of singleton hooks.

- Updated dependencies ([`cf01904`](https://github.com/kimjh96/flemo/commit/cf01904fb806408db03cba65ceb4026201d3b551), [`475540c`](https://github.com/kimjh96/flemo/commit/475540cfbbf78614b4227fc798c0f4d3987852d6)):
  - @flemo/core@1.4.0
  - @flemo/react@1.3.0

## 0.1.8

### Patch Changes

- Updated dependencies ([`0e7e44b`](https://github.com/kimjh96/flemo/commit/0e7e44b227c8b9eec20309aa416b33beba712d7f)):
  - @flemo/core@1.3.0
  - @flemo/react@1.2.0

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
