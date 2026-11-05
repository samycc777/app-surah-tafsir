#!/usr/bin/env python3
"""Screenshot + smoke test of the built PWA against a local static server."""
import sys

from playwright.sync_api import sync_playwright

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8788"
OUT = "shots"


def main():
    errors = []
    with sync_playwright() as p:
        b = p.chromium.launch()
        ctx = b.new_context(
            viewport={"width": 390, "height": 844}, device_scale_factor=2,
            is_mobile=True, has_touch=True, locale="ar", timezone_id="Africa/Cairo",
        )
        page = ctx.new_page()
        page.on("console", lambda m: errors.append(f"console {m.type}: {m.text}") if m.type == "error" else None)
        page.on("pageerror", lambda e: errors.append(f"pageerror: {e}"))

        page.goto(f"{BASE}/", wait_until="networkidle")
        page.screenshot(path=f"{OUT}/home.png")

        # surah 1 — the mushaf page and its tafsir sheet
        page.goto(f"{BASE}/surah/1/", wait_until="networkidle")
        page.wait_for_selector(".m-line", timeout=15000)
        page.screenshot(path=f"{OUT}/surah1.png")
        page.click('.m-line .w[data-v="1:2"]')
        page.wait_for_timeout(500)
        page.screenshot(path=f"{OUT}/sheet1.png")
        print("sheet title:", page.inner_text("#taf-sub"))
        print("note visible:", page.is_visible("#taf-note"))

        # surah 2 — a full 15-line page (Baqarah 1–5 starts page 2)
        page.goto(f"{BASE}/surah/2/", wait_until="networkidle")
        page.wait_for_selector(".m-line", timeout=15000)
        page.screenshot(path=f"{OUT}/surah2.png")
        print("s2 head:", page.inner_text("#m-start"), "| page", page.inner_text("#m-page-no"))

        # surah 40 — fully vocalised, no note; save the first ayah
        page.goto(f"{BASE}/surah/40/", wait_until="networkidle")
        page.wait_for_selector(".m-line", timeout=15000)
        page.click('.m-line .w[data-v="40:1"]')
        page.wait_for_timeout(500)
        page.screenshot(path=f"{OUT}/sheet40.png")
        print("40 note visible:", page.is_visible("#taf-note"))
        page.click("#taf-bookmark")
        page.wait_for_timeout(300)

        # harakat off
        page.click("#taf .sheet-head [data-close]")
        page.wait_for_timeout(200)
        page.click("#open-settings")
        page.wait_for_timeout(300)
        page.screenshot(path=f"{OUT}/settings.png")
        page.click("#set-harakat")
        page.wait_for_timeout(300)
        page.screenshot(path=f"{OUT}/settings-off.png")
        page.click("#settings [data-close]")
        page.wait_for_timeout(200)

        # search
        page.goto(f"{BASE}/search/?q=الرحمن", wait_until="networkidle")
        page.wait_for_timeout(1200)
        page.screenshot(path=f"{OUT}/search.png")
        print("search status:", page.inner_text("#status"))

        # saved (bookmark flow)
        page.goto(f"{BASE}/saved/", wait_until="networkidle")
        page.screenshot(path=f"{OUT}/saved.png")

        # desktop
        dctx = b.new_context(
            viewport={"width": 1280, "height": 900}, device_scale_factor=1,
            locale="ar", timezone_id="Africa/Cairo",
        )
        dpage = dctx.new_page()
        dpage.on("console", lambda m: errors.append(f"desktop console {m.type}: {m.text}") if m.type == "error" else None)
        dpage.goto(f"{BASE}/", wait_until="networkidle")
        dpage.screenshot(path=f"{OUT}/desktop.png")

        print("ERRORS:", errors or "none")
        b.close()


if __name__ == "__main__":
    main()
