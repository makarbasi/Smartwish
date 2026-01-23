import json
import time
import os
import requests
import hashlib
from urllib.parse import urlparse
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from webdriver_manager.chrome import ChromeDriverManager
from selenium.webdriver.common.by import By
from datetime import datetime

# --- CONFIGURATION ---
IMAGE_DIR = "images"
OUTPUT_FILE = "event_data.js"

# Eventbrite specific URLs for your categories
CATEGORY_URLS = {
    "Popular in San Diego": "https://www.eventbrite.com/d/ca--san-diego/events/",
    "This Weekend": "https://www.eventbrite.com/d/ca--san-diego/events--this-weekend/",
    "Music events": "https://www.eventbrite.com/d/ca--san-diego/music--events/",
    "Food & Drink events": "https://www.eventbrite.com/d/ca--san-diego/food-and-drink--events/",
    "Health & Wellness events": "https://www.eventbrite.com/d/ca--san-diego/health--events/"
}

def setup_driver():
    """Setup Headless Chrome"""
    chrome_options = Options()
    chrome_options.add_argument("--headless=new") 
    chrome_options.add_argument("--window-size=1920,1080")
    chrome_options.add_argument("--disable-blink-features=AutomationControlled")
    chrome_options.add_argument("--disable-gpu")
    chrome_options.add_argument("--no-sandbox")
    chrome_options.add_argument("--disable-dev-shm-usage")
    chrome_options.add_argument("user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36")
    
    try:
        # Try with ChromeDriverManager first
        driver = webdriver.Chrome(service=Service(ChromeDriverManager().install()), options=chrome_options)
        return driver
    except Exception as e:
        print(f"⚠️ ChromeDriverManager failed: {e}")
        print("Trying direct Chrome initialization...")
        try:
            # Try without explicit service (uses system PATH)
            driver = webdriver.Chrome(options=chrome_options)
            return driver
        except Exception as e2:
            print(f"❌ Direct initialization failed: {e2}")
            print("\nTroubleshooting:")
            print("1. Make sure Chrome browser is installed")
            print("2. Clear webdriver cache: del /s /q %USERPROFILE%\\.wdm")
            print("3. Update packages: pip install --upgrade selenium webdriver-manager")
            raise

def download_image(img_url):
    """Downloads image to local folder and returns local path"""
    if not img_url: return ""
    
    try:
        os.makedirs(IMAGE_DIR, exist_ok=True)
        
        # Create unique filename hash
        hash_name = hashlib.md5(img_url.encode()).hexdigest()[:10]
        filename = f"{hash_name}.jpg"
        file_path = os.path.join(IMAGE_DIR, filename)
        
        # Don't download if exists
        if os.path.exists(file_path):
            return file_path
            
        # Download
        response = requests.get(img_url, timeout=10)
        if response.status_code == 200:
            with open(file_path, 'wb') as f:
                f.write(response.content)
            return file_path
    except Exception as e:
        print(f"      ⚠️ Image download failed: {e}")
    return ""

def parse_date(date_text):
    """Parses Eventbrite date text to object"""
    # Defaults
    d = {"month": "UP", "day": "NEXT", "time": "See Details", "is_after_8pm": False}
    
    if not date_text: return d

    try:
        # Example text: "Sat, Oct 28, 7:00 PM"
        parts = date_text.split(',')
        if len(parts) >= 2:
            # Extract Month/Day
            date_part = parts[1].strip() # "Oct 28"
            d_obj = datetime.strptime(date_part, "%b %d")
            d['month'] = d_obj.strftime("%b").upper()
            d['day'] = str(d_obj.day)
            
            # Extract Time if exists
            if len(parts) >= 3:
                time_part = parts[2].strip() # "7:00 PM"
                d['time'] = time_part
                
                # Check for "After 8pm" logic
                # Convert time_part to object to check hour
                try:
                    # Remove "+ 2 more" junk if present
                    clean_time = time_part.split('+')[0].strip()
                    t_obj = datetime.strptime(clean_time, "%I:%M %p")
                    if t_obj.hour >= 20: # 20 is 8 PM
                        d['is_after_8pm'] = True
                except: pass
    except:
        pass # Keep defaults
        
    return d

def scrape_categories():
    driver = setup_driver()
    final_data = {cat: [] for cat in CATEGORY_URLS.keys()}
    final_data["After 8pm"] = [] # Manually populated
    
    print("🚀 Starting Multi-Category Scraper...")

    try:
        for category_name, url in CATEGORY_URLS.items():
            print(f"\n📂 Scraping Category: {category_name}...")
            driver.get(url)
            time.sleep(4) # Let JS load
            
            # Scroll to load more
            driver.execute_script("window.scrollTo(0, document.body.scrollHeight/2);")
            time.sleep(2)
            
            # Find cards (Eventbrite structure changes, checking common selectors)
            # We target the clickable link containers
            cards = driver.find_elements(By.CSS_SELECTOR, "section.event-card-details, div.event-card__data, a[href*='/e/']")
            
            count = 0
            for card in cards:
                if count >= 8: break # Limit 8 events per category to keep file size down
                
                try:
                    # Logic to get details depending on container type
                    # This is a general fallback approach using text parsing
                    text = card.text.split('\n')
                    if len(text) < 2: continue
                    
                    # Heuristics
                    title = next((t for t in text if len(t) > 10), "Event")
                    date_text = next((t for t in text if " PM" in t or " AM" in t), "")
                    location = next((t for t in text if "San Diego" in t or "CA" in t), "San Diego")
                    price = next((t for t in text if "$" in t or "Free" in t), "See Details")
                    
                    # Get Link
                    try:
                        link_elem = card.find_element(By.XPATH, ".//ancestor-or-self::a")
                        link = link_elem.get_attribute('href')
                    except:
                        try:
                            link = card.find_element(By.TAG_NAME, "a").get_attribute("href")
                        except: link = ""

                    # Get Image (Try to find high quality)
                    img_src = ""
                    try:
                        # Try finding image in parent container
                        parent = card.find_element(By.XPATH, "./../../..")
                        img_elem = parent.find_element(By.TAG_NAME, "img")
                        img_src = img_elem.get_attribute("src")
                    except: pass
                    
                    # CLEAN DATA
                    date_obj = parse_date(date_text)
                    
                    # DOWNLOAD IMAGE
                    local_img_path = ""
                    if img_src:
                        local_img_path = download_image(img_src)
                    
                    # Build Event Object
                    event_obj = {
                        "title": title,
                        "date": date_obj,
                        "location": location,
                        "price": price,
                        "image": local_img_path, # Local Path
                        "url": link
                    }

                    # Add to current category
                    # Check for duplicates by title
                    exists = any(e['title'] == title for e in final_data[category_name])
                    if not exists and local_img_path: # Only add if image downloaded
                        final_data[category_name].append(event_obj)
                        print(f"   ✅ Added: {title[:30]}...")
                        count += 1
                        
                        # SPECIAL LOGIC: Check for "After 8pm"
                        if date_obj.get('is_after_8pm'):
                            # Avoid duplicates in After 8pm
                            if not any(e['title'] == title for e in final_data["After 8pm"]):
                                final_data["After 8pm"].append(event_obj)
                                print("      🌙 Added to 'After 8pm'")

                except Exception as e:
                    continue

    except Exception as e:
        print(f"❌ Error: {e}")
    finally:
        driver.quit()
        
        # Save Data
        js_content = f"const REAL_EVENT_DATA = {json.dumps(final_data, indent=4)};"
        with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
            f.write(js_content)
        print("\n🎉 Done! Saved to event_data.js")

if __name__ == "__main__":
    scrape_categories()