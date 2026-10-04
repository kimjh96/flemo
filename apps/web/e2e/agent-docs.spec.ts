import { expect, test } from "@playwright/test";

test.describe("agent documentation", () => {
  test("serves a compact llms.txt discovery map", async ({ request }) => {
    const response = await request.get("/llms.txt");
    const body = await response.text();

    expect(response.ok()).toBe(true);
    expect(response.headers()["content-type"]).toContain("text/plain");
    expect(body).toContain("# flemo");
    expect(body).toContain("Complete machine-readable documentation");
    expect(body).toContain("English documentation");
    expect(body).toContain("한국어 문서");
    expect(body.length).toBeLessThan(20_000);
  });

  test("renders the complete EN and KO docs from typed content", async ({ request }) => {
    const response = await request.get("/llms-full.txt");
    const body = await response.text();

    expect(response.ok()).toBe(true);
    expect(body).toContain("# flemo complete documentation");
    expect(body).toContain("## English: Core");
    expect(body).toContain("### [Putting it together](https://flemo.dev/en/docs/composition)");
    expect(body).toContain("## 한국어: Core");
    expect(body).toContain("### [Putting it together](https://flemo.dev/ko/docs/composition)");
    expect(body).toContain("A Part with no swipe hooks follows the same POPPING progress");
    expect(body).toContain(
      "The menu opens from the panel but should cover the whole app, header included."
    );
    expect(body).toContain("스와이프 훅이 없는 Part는 화면과 같은 POPPING 진행도를 따라 움직이고");
    expect(body).toContain("메뉴는 패널에서 열지만 헤더를 포함한 앱 전체를 덮어야 해요.");
  });
});
