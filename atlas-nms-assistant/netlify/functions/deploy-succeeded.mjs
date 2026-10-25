/* ============================================================
   IndexNow ping (2026-10-25)

   Netlify runs this by itself after every successful deploy (the file
   name "deploy-succeeded" is a Netlify event). It reads this site's own
   sitemap.xml and tells Bing (and the other IndexNow engines: Yandex,
   Naver, Seznam...) that those pages changed, so they get re-crawled
   straight away instead of whenever the crawler next drops by.
   Bing's index also feeds DuckDuckGo, Copilot and ChatGPT search.
   Google doesn't use IndexNow -- it reads the <lastmod> dates in
   sitemap.xml, which the build command in netlify.toml sets to the
   deploy date.

   The key is public by design: it must also sit in /33e3ba5d7898ed6ffe768aa9f8c4fad0.txt
   at the site root so the engines can check we own the site.
   Same key on all six nomansskyhub.app sites.
   ============================================================ */

const KEY = "33e3ba5d7898ed6ffe768aa9f8c4fad0";

export const handler = async (event) => {
  let ctx = "";
  try { ctx = (JSON.parse(event.body || "{}").payload || {}).context || ""; } catch (e) {}
  if (ctx && ctx !== "production") return { statusCode: 200, body: "skipped (" + ctx + ")" };

  const site = String(process.env.URL || "").replace(/\/+$/, "");
  if (!site) return { statusCode: 200, body: "no site URL" };
  const host = new URL(site).host;

  let urls = [];
  try {
    const res = await fetch(site + "/sitemap.xml", { headers: { "Cache-Control": "no-cache" } });
    const xml = await res.text();
    urls = [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)]
      .map((m) => m[1])
      .filter((u) => { try { return new URL(u).host === host; } catch (e) { return false; } });
  } catch (e) {}
  if (!urls.length) urls = [site + "/"];

  try {
    const r = await fetch("https://api.indexnow.org/indexnow", {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({ host, key: KEY, keyLocation: site + "/" + KEY + ".txt", urlList: urls }),
    });
    console.log("IndexNow", r.status, urls.length + " URLs", urls.join(" "));
    return { statusCode: 200, body: "IndexNow " + r.status + " for " + urls.length + " URLs" };
  } catch (e) {
    console.log("IndexNow failed", String(e));
    return { statusCode: 200, body: "IndexNow failed" };
  }
};
