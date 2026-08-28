import { chromium } from "@playwright/test";
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 678, height: 1366 }, colorScheme: "light" });
await p.goto("http://localhost:3100/playground", { waitUntil: "networkidle" });
await p.waitForTimeout(1700);
await p.locator('[role=radio]:text-is("zoom")').click();
await p.waitForTimeout(500);
await p.locator("[data-playground-stage] button:has-text('Posters')").click();
await p.waitForTimeout(1200);
const r = await p.evaluate(async () => {
  const tr = (el) => {
    const r = document.createRange();
    r.selectNodeContents(el);
    const b = r.getClientRects()[0];
    return b ? `${Math.round(b.x)},${Math.round(b.y)}` : "-";
  };
  const li = [...document.querySelectorAll("[data-playground-stage] ul.grid li")].find((l) =>
    l.textContent.includes("Hue & Cry")
  );
  const cm = [...li.querySelectorAll("*")].find(
    (e) => /₩29,000/.test(e.textContent) && !e.querySelector("*")
  );
  const ct = [...li.querySelectorAll("*")].find(
    (e) => e.textContent.trim() === "Hue & Cry" && !e.querySelector("*")
  );
  const restM = tr(cm),
    restT = tr(ct);
  li.querySelector("button").click();
  await new Promise((r) => requestAnimationFrame(r));
  const layer = document.querySelector("[data-flemo-morph-layer]");
  const fm = [...layer.querySelectorAll("*")].filter(
    (e) => /Sun 17:00 · ₩/.test(e.textContent) && !e.querySelector("*")
  );
  const ft = [...layer.querySelectorAll("*")].filter(
    (e) => e.textContent.trim() === "Hue & Cry" && !e.querySelector("*")
  );
  return { restT, flyT: ft.map(tr).join("|"), restM, flyM: fm.map(tr).join("|") };
});
console.log(JSON.stringify(r));
await b.close();
