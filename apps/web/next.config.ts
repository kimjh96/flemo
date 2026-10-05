/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,
  // Doc pages that moved. The old addresses were published (README, llms.txt,
  // links elsewhere), so they keep working as permanent redirects.
  async redirects() {
    return [
      {
        source: "/docs/composition",
        destination: "/docs/putting-it-together",
        permanent: true
      },
      {
        source: "/:lang(en|ko)/docs/composition",
        destination: "/:lang/docs/putting-it-together",
        permanent: true
      }
    ];
  }
};

export default config;
