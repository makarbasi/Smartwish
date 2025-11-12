"""
AI-powered metadata generation for greeting card PNGs in two subfolders under
Designs\RightHalves:

Subfolders:
- ChristmasCardBundle (Christmas cards)
- FallGreetingCardBundlePDF (Thanksgiving/Fall cards)

For each PNG, produces a record with Title and Occasion (a descriptive string
optimized for semantic search). This version uses AI Vision (OpenAI) to analyze
each image and generate titles and descriptions. Heuristics are only used as a
last-resort fallback on individual failures; an AI API key is REQUIRED.

Outputs:
- Creates JSON files next to each subfolder, e.g.:
  Designs\RightHalves\ChristmasCardBundle.json
  Designs\RightHalves\FallGreetingCardBundlePDF.json

Usage:
    setx OPENAI_API_KEY "<your_key>"   (PowerShell: $Env:OPENAI_API_KEY = "<your_key>")
    pip install pillow openai
    python scripts/generate_card_metadata.py
    python scripts/generate_card_metadata.py --root "C:\\Users\\makar\\OneDrive\\OLD\\E-Learning\\projects\\SmartWish\\Designs\\RightHalves"

Notes:
- Requires a valid OpenAI API key in OPENAI_API_KEY. Uses GPT-4o family.
"""

from __future__ import annotations

import json
import os
import re
import sys
from dataclasses import dataclass
import base64
from pathlib import Path
from typing import Iterable, List, Optional, Tuple

try:
    from PIL import Image
except ImportError:
    print("Pillow not installed. Install with: pip install pillow", file=sys.stderr)
    raise

# OpenAI Vision
try:
    from openai import OpenAI  # type: ignore
    OPENAI_IMPORTED = True
except Exception:
    OPENAI_IMPORTED = False


DEFAULT_ROOT = Path(
    r"C:\\Users\\makar\\OneDrive\\OLD\\E-Learning\\projects\\SmartWish\\Designs\\RightHalves"
)
SUBFOLDERS = ["ChristmasCardBundle", "FallGreetingCardBundlePDF"]


@dataclass
class ImageAnalysis:
    title: str
    occasion: str


def clamp(v: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, v))


def rgb_to_hsv(r: int, g: int, b: int) -> Tuple[float, float, float]:
    # r,g,b in [0,255] -> h in [0,360), s,v in [0,1]
    import colorsys
    h, s, v = colorsys.rgb_to_hsv(r / 255.0, g / 255.0, b / 255.0)
    return (h * 360.0, s, v)


def dominant_colors(img: Image.Image, k: int = 8) -> List[Tuple[int, int, int, int]]:
    # Keep a simple color palette utility for fallback if AI returns nothing.
    thumb = img.convert("RGB")
    thumb = thumb.resize((256, 256), Image.LANCZOS)
    pal = thumb.quantize(colors=k, method=Image.MEDIANCUT)
    palette_img = pal.convert("RGBA")
    colors = palette_img.getcolors(256 * 256) or []
    colors.sort(key=lambda x: x[0], reverse=True)
    rgba = [(c[1][0], c[1][1], c[1][2], 255) for c in colors]
    return rgba


def avg_brightness(img: Image.Image) -> float:
    # returns average V in HSV across a small sample
    small = img.convert("RGB").resize((128, 128), Image.LANCZOS)
    pixels = list(small.getdata())
    vs = [rgb_to_hsv(r, g, b)[2] for (r, g, b) in pixels]
    return sum(vs) / len(vs)


def avg_saturation(img: Image.Image) -> float:
    small = img.convert("RGB").resize((128, 128), Image.LANCZOS)
    pixels = list(small.getdata())
    ss = [rgb_to_hsv(r, g, b)[1] for (r, g, b) in pixels]
    return sum(ss) / len(ss)


def extract_text(img: Image.Image) -> str:
    # OCR removed from default flow; AI handles text recognition. Kept as a stub.
    return ""


def clean_text(s: str) -> str:
    s = s.strip()
    s = re.sub(r"\s+", " ", s)
    return s


def guess_christmas_title(img: Image.Image, text: str, colors: List[Tuple[int, int, int, int]],
                          brightness: float, saturation: float) -> str:
    # Fallback heuristic only; AI generates titles by default.
    t = text.lower()
    if "merry" in t and "christmas" in t:
        return "Merry Christmas"
    return "Warm Christmas Wishes"


def guess_fall_title(img: Image.Image, text: str, colors: List[Tuple[int, int, int, int]],
                     brightness: float, saturation: float) -> str:
    # Fallback heuristic only; AI generates titles by default.
    t = text.lower()
    if "thanksgiving" in t:
        return "Happy Thanksgiving"
    return "Warm Autumn Wishes"


def build_occasion_description(kind: str, colors: List[Tuple[int, int, int, int]],
                               brightness: float, saturation: float, text: str) -> str:
    # Fallback descriptive string; AI will normally provide a richer description.
    palette_summary = "seasonal palette"
    mood = []
    mood.append("bright" if brightness > 0.6 else "dim")
    mood.append("vivid" if saturation > 0.45 else "muted")
    return (
        f"{kind} card; {', '.join(mood)} tones and festive motifs. "
        f"Keywords: {kind.lower()}, seasonal, greeting."
    )


def ai_annotate_image_openai(img_path: Path, kind: str) -> Optional[ImageAnalysis]:
    if not OPENAI_IMPORTED:
        raise RuntimeError("OpenAI library not installed. Run: pip install openai")
    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        raise RuntimeError("OPENAI_API_KEY is not set. Please set your OpenAI API key.")

    client = OpenAI(api_key=api_key)

    # Encode image as data URL for GPT-4o vision
    mime = "image/png" if img_path.suffix.lower() == ".png" else "image/jpeg"
    with open(img_path, "rb") as f:
        b64 = base64.b64encode(f.read()).decode("ascii")
    data_url = f"data:{mime};base64,{b64}"

    system_prompt = (
        "You are an expert greeting card metadata annotator. Given an image, "
        "return STRICT JSON with keys: title (<=40 chars, concise, natural), "
        "occasion (1–2 sentences describing the card type and scene, optimized for semantic search). "
        f"The card is for: {kind}. Do not include any extra text, comments, or markdown."
    )

    user_text = (
        f"Analyze this {kind} greeting card image and produce JSON with keys 'title' and 'occasion'. "
        "Title should be short and meaningful. Occasion should describe motifs, mood, and seasonal context, "
        "including helpful keywords for retrieval (e.g., colors, symbols, holiday terms)."
    )

    try:
        resp = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": system_prompt},
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": user_text},
                        {"type": "image_url", "image_url": {"url": data_url}},
                    ],
                },
            ],
            temperature=0.2,
            max_tokens=300,
        )
        content = resp.choices[0].message.content or ""
        # Attempt to parse JSON strictly; if model returns extra text, extract first JSON object.
        import json as pyjson
        def try_parse_json(s: str):
            s = s.strip()
            # Find first {...}
            start = s.find("{")
            end = s.rfind("}")
            if start != -1 and end != -1 and end > start:
                return pyjson.loads(s[start : end + 1])
            return pyjson.loads(s)
        data = try_parse_json(content)
        title = clean_text(str(data.get("title", "")).strip())
        occasion = clean_text(str(data.get("occasion", "")).strip())
        if title and occasion:
            return ImageAnalysis(title=title, occasion=occasion)
        return None
    except Exception as exc:
        # If AI fails for this image, return None to allow fallback
        return None


def analyze_image(img_path: Path, kind: str) -> ImageAnalysis:
    # Primary path: AI annotation
    ai = ai_annotate_image_openai(img_path, kind)
    if ai:
        return ai

    # Fallback: simple heuristics (should be rare)
    img = Image.open(img_path)
    colors = dominant_colors(img, k=8)
    brightness = avg_brightness(img)
    saturation = avg_saturation(img)
    text = extract_text(img)

    if kind == "Christmas":
        title = guess_christmas_title(img, text, colors, brightness, saturation)
    else:
        title = guess_fall_title(img, text, colors, brightness, saturation)

    occasion_desc = build_occasion_description(kind, colors, brightness, saturation, text)
    return ImageAnalysis(title=title, occasion=occasion_desc)


def collect_pngs(folder: Path) -> List[Path]:
    return sorted(p for p in folder.glob("*.png") if p.is_file())


def generate_json_for_folder(root: Path, subfolder: str) -> Path:
    folder = root / subfolder
    if not folder.exists() or not folder.is_dir():
        raise FileNotFoundError(f"Subfolder not found: {folder}")

    # Determine kind from folder name
    kind = "Christmas" if "christmas" in subfolder.lower() else "Thanksgiving/Fall"

    items = []
    for img_path in collect_pngs(folder):
        analysis = analyze_image(img_path, kind)
        items.append({
            "file": img_path.name,
            "Title": analysis.title,
            "Occasion": analysis.occasion,
        })

    out_path = root / f"{subfolder}.json"
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(items, f, ensure_ascii=False, indent=2)
    return out_path


def main(argv: Optional[List[str]] = None):
    import argparse
    parser = argparse.ArgumentParser(description="Generate metadata JSONs for greeting card PNGs.")
    parser.add_argument("--root", type=Path, default=DEFAULT_ROOT, help="Root path of Designs\\RightHalves")
    args = parser.parse_args(argv)

    root = args.root
    if not root.exists() or not root.is_dir():
        print(f"Root path not found or not a directory: {root}", file=sys.stderr)
        sys.exit(1)

    # Require OpenAI API key to ensure AI usage for sure
    if not OPENAI_IMPORTED:
        print("OpenAI library not installed. Please run: pip install openai", file=sys.stderr)
        sys.exit(1)
    if not os.environ.get("OPENAI_API_KEY"):
        print("OPENAI_API_KEY is not set. Please configure your OpenAI API key.", file=sys.stderr)
        sys.exit(1)

    produced = []
    for sf in SUBFOLDERS:
        try:
            out = generate_json_for_folder(root, sf)
            produced.append(out)
            print(f"✔ Generated: {out}")
        except Exception as exc:
            print(f"✖ Error processing {sf}: {exc}", file=sys.stderr)

    if produced:
        print("Done. JSON files:")
        for p in produced:
            print(f" - {p}")


if __name__ == "__main__":
    main()