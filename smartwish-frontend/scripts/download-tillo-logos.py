r"""
Download all brand logos from the Tillo web UI (Partner Hub) using your existing Chrome profile.

Why this script exists:
- Tillo's /brands API does not include logo URLs.
- The reliable approach is "Manual Asset Management": download logos from the Tillo UI and host locally.

What it does:
- Opens the brands list page in Chrome (using your logged-in profile)
- Auto-scrolls until all brands are loaded
- Extracts brand slug (from /brands/<slug> links) + image src from each card
- Downloads each logo using an authenticated requests session (cookies copied from Selenium)
- Saves into: smartwish-frontend/public/tillo-logos/<slug>.(png|jpg|svg|webp)

Run (PowerShell):
  cd D:\Projects\Smartwish\Code\Smartwish\smartwish-frontend
  python scripts\download-tillo-logos.py

Optional env vars:
  $env:TILLO_BRANDS_URL = "https://app.tillo.io/brands"
  $env:CHROME_PROFILE_DIR = "Default"
  $env:CHROME_USER_DATA_DIR = "C:\\Users\\makar\\AppData\\Local\\Google\\Chrome\\User Data"
"""

import os
import re
import time
from pathlib import Path
from urllib.parse import urlparse
from datetime import datetime

import requests
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException


def slug_from_href(href: str) -> str | None:
    if not href:
        return None
    try:
        p = urlparse(href).path or ""
        parts = [x for x in p.split("/") if x]
        if not parts:
            return None
        return parts[-1]
    except Exception:
        return None


def normalize_slug(s: str) -> str:
    s = (s or "").lower().strip()
    s = re.sub(r"-+(us|usa|uk|ca|au|eu|url)$", "", s)  # common suffixes
    s = re.sub(r"[^a-z0-9-]+", "-", s)
    s = re.sub(r"-+", "-", s).strip("-")
    return s or "unknown"


def scroll_to_load_all(driver, max_rounds: int = 120, pause_s: float = 0.65) -> None:
    last_height = driver.execute_script("return document.body.scrollHeight")
    stable_rounds = 0
    for _ in range(max_rounds):
        driver.execute_script("window.scrollTo(0, document.body.scrollHeight);")
        time.sleep(pause_s)
        new_height = driver.execute_script("return document.body.scrollHeight")
        if new_height == last_height:
            stable_rounds += 1
            if stable_rounds >= 3:
                break
        else:
            stable_rounds = 0
            last_height = new_height
    driver.execute_script("window.scrollTo(0, 0);")


def copy_selenium_cookies_to_requests(driver, session: requests.Session) -> None:
    for c in driver.get_cookies():
        try:
            session.cookies.set(c["name"], c["value"], domain=c.get("domain"), path=c.get("path", "/"))
        except Exception:
            session.cookies.set(c.get("name"), c.get("value"))


def guess_ext(content_type: str, url: str) -> str:
    ct = (content_type or "").lower()
    u = (url or "").lower()
    if "image/svg" in ct or u.endswith(".svg"):
        return ".svg"
    if "image/png" in ct or u.endswith(".png"):
        return ".png"
    if "image/jpeg" in ct or "image/jpg" in ct or u.endswith((".jpg", ".jpeg")):
        return ".jpg"
    if "image/webp" in ct or u.endswith(".webp"):
        return ".webp"
    return ".png"


def main() -> None:
    repo_root = Path(__file__).resolve().parents[2]  # .../smartwish-frontend/scripts/ -> repo root
    output_dir = repo_root / "smartwish-frontend" / "public" / "tillo-logos"
    output_dir.mkdir(parents=True, exist_ok=True)

    brands_url = os.environ.get("TILLO_BRANDS_URL", "https://app.tillo.io/brands")
    # IMPORTANT:
    # Using your *real* Chrome profile often crashes/locks (DevToolsActivePort) if Chrome is open.
    # Default to a dedicated Selenium profile folder inside the repo.
    default_selenium_profile = repo_root / "smartwish-frontend" / ".selenium-chrome-user-data"
    chrome_user_data_dir = os.environ.get("CHROME_USER_DATA_DIR", str(default_selenium_profile))
    chrome_profile_dir = os.environ.get("CHROME_PROFILE_DIR", "Default")

    chrome_options = Options()
    # If the profile appears locked, auto-fallback to a fresh profile dir to avoid Chrome startup crashes.
    cud_path = Path(chrome_user_data_dir)
    lock_markers = [
        cud_path / "lockfile",
        cud_path / "SingletonLock",
        cud_path / "SingletonCookie",
        cud_path / "SingletonSocket",
        cud_path / chrome_profile_dir / "LOCK",
    ]
    if any(p.exists() for p in lock_markers):
        suffix = datetime.now().strftime("%Y%m%d-%H%M%S")
        fresh = repo_root / "smartwish-frontend" / f".selenium-chrome-user-data-{suffix}"
        fresh.mkdir(parents=True, exist_ok=True)
        print("[WARN] Chrome profile appears locked; switching to a fresh Selenium profile:")
        print(f"       {fresh}")
        chrome_user_data_dir = str(fresh)
        cud_path = fresh

    chrome_options.add_argument(f"--user-data-dir={chrome_user_data_dir}")
    chrome_options.add_argument(f"--profile-directory={chrome_profile_dir}")
    chrome_options.add_argument("--no-sandbox")
    chrome_options.add_argument("--disable-dev-shm-usage")
    chrome_options.add_argument("--disable-gpu")
    chrome_options.add_argument("--remote-debugging-port=0")
    chrome_options.add_argument("--window-size=1400,900")
    chrome_options.add_argument("--disable-extensions")
    chrome_options.add_argument("--no-first-run")
    chrome_options.add_argument("--no-default-browser-check")

    print(f"Brands URL: {brands_url}")
    print(f"Output dir: {output_dir}")
    print(f"Chrome user-data-dir: {chrome_user_data_dir}")
    print("Note: If this is the first run, a Chrome window will open. Log into Tillo in that window.")

    driver = webdriver.Chrome(options=chrome_options)
    try:
        driver.get(brands_url)
        WebDriverWait(driver, 30).until(EC.presence_of_element_located((By.TAG_NAME, "body")))
        time.sleep(2.0)

        # If not logged in yet, the page will likely be a login page and contain 0 brand links.
        # Wait (up to 10 minutes) for the user to finish logging in and the brand list to appear.
        print(f"Current URL: {driver.current_url}")
        print("Waiting for brand list to appear (you may need to log in)...")

        def has_brand_links(drv) -> bool:
            try:
                return len(drv.find_elements(By.CSS_SELECTOR, "a[href*='/brands/']")) > 0
            except Exception:
                return False

        try:
            WebDriverWait(driver, 600, poll_frequency=2.0).until(lambda d: has_brand_links(d))
        except TimeoutException:
            print("[ERR] Timed out waiting for brand list. Are you logged in?")
            print(f"Current URL: {driver.current_url}")
            print("Tip: run again, and complete login in the Chrome window.")
            return

        print("Brand list detected. Scrolling to load all brands...")

        scroll_to_load_all(driver)

        links = driver.find_elements(By.CSS_SELECTOR, "a[href*='/brands/']")
        print(f"Found {len(links)} brand links (pre-dedup)")

        seen: set[str] = set()
        brands: list[dict] = []

        for link in links:
            href = link.get_attribute("href") or ""
            slug = slug_from_href(href)
            if not slug:
                continue
            slug = normalize_slug(slug)
            if slug in seen:
                continue

            # Try img inside link
            img_src = None
            name = (link.text or "").strip()
            try:
                img = link.find_element(By.CSS_SELECTOR, "img")
                img_src = img.get_attribute("src")
                if not name:
                    name = (img.get_attribute("alt") or "").strip()
            except Exception:
                pass

            # Fallback: search in a parent card
            if not img_src or not name:
                try:
                    parent = link.find_element(By.XPATH, "./ancestor::*[self::div or self::li][1]")
                    if not img_src:
                        img = parent.find_element(By.CSS_SELECTOR, "img")
                        img_src = img.get_attribute("src")
                    if not name:
                        name = (parent.text or "").strip().split("\n")[0].strip()
                except Exception:
                    pass

            if not img_src:
                continue

            seen.add(slug)
            brands.append({"slug": slug, "name": name or slug, "src": img_src})

        print(f"Extracted {len(brands)} unique brand logos")

        session = requests.Session()
        session.headers.update(
            {
                "User-Agent": (
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome Safari/537.36"
                ),
                "Accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
                "Referer": "https://app.tillo.io/",
            }
        )
        copy_selenium_cookies_to_requests(driver, session)

        downloaded = 0
        for i, b in enumerate(brands, start=1):
            slug = b["slug"]
            src = b["src"]

            try:
                r = session.get(src, timeout=30)
                if r.status_code != 200:
                    print(f"[WARN] [{i}/{len(brands)}] {slug}: HTTP {r.status_code}")
                    continue

                ext = guess_ext(r.headers.get("content-type", ""), src)
                out_path = output_dir / f"{slug}{ext}"
                out_path.write_bytes(r.content)
                downloaded += 1
                print(f"[OK]   [{i}/{len(brands)}] {slug}{ext}")
            except Exception as e:
                print(f"[ERR]  [{i}/{len(brands)}] {slug}: {e}")

        print(f"\nDone. Downloaded {downloaded}/{len(brands)} logos into:\n  {output_dir}")
        print("Next: redeploy frontend so these files are served from /tillo-logos/<slug>.(png|svg)")
    finally:
        driver.quit()


if __name__ == "__main__":
    main()


