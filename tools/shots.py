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

        # surah 1 (partial harakat) — open the tafsir sheet
        page.goto(f"{BASE}/surah/1/", wait_until="networkidle")
        page.screenshot(path=f"{OUT}/surah1.png")
        page.click('.ay[data-v="2"]')
        page.wait_for_timeout(400)
        page.screenshot(path=f"{OUT}/sheet1.png")
        print("sheet title:", page.inner_text("#taf-sub"))
        print("note visible:", page.is_visible("#taf-note"))

        # surah 40 (fully vocalised) — no note
        page.goto(f"{BASE}/surah/40/", wait_until="networkidle")
        page.click('.ay[data-v="1"]')
        page.wait_for_timeout(400)
        page.screenshot(path=f"{OUT}/sheet40.png")
        print("40 note visible:", page.is_visible("#taf-note"))

        # harakat off
        page.keyboard.press("Escape")
        page.wait_for_timeout(300)
        page.click("#open-settings")
        page.wait_for_timeout(300)
        page.screenshot(path=f"{OUT}/settings.png")
        page.click("#set-harakat")
        page.wait_for_timeout(300)
        page.screenshot(path=f"{OUT}/settings-off.png")

        # search
        page.goto(f"{BASE}/search/?q=الرحمن", wait_until="networkidle")
        page.wait_for_timeout(1200)
        page.screenshot(path=f"{OUT}/search.png")
        print("search status:", page.inner_text("#status"))

        # saved (bookmark flow)
        page.goto(f"{BASE}/surah/40/", wait_until="networkidle")
        page.click('.ay[data-v="2"]')
        page.wait_for_timeout(300)
        page.click("#taf-bookmark")
        page.goto(f"{BASE}/saved/", wait_until="networkidle")
        page.screenshot(path=f"{OUT}/saved.png")

        print("ERRORS:", errors or "none")
        b.close()


if __name__ == "__main__":
    main()
