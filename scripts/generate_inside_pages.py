import json
from PIL import Image, ImageDraw, ImageFont
import textwrap
import os

# File paths
json_file = r"C:\Users\makar\OneDrive\OLD\E-Learning\projects\SmartWish\Designs\Series1_original\Series\BirthdayCardsBasic\insidenote.json"
blank_template = r"C:\Users\makar\OneDrive\OLD\E-Learning\projects\SmartWish\Code\Smartwish\scripts\blank.png"
output_dir = r"C:\Users\makar\OneDrive\OLD\E-Learning\projects\SmartWish\Designs\Series1_original\Series\BirthdayCardsBasic"

# Read JSON file
with open(json_file, 'r', encoding='utf-8') as f:
    cards_data = json.load(f)

# Load blank template to get dimensions
template = Image.open(blank_template)
img_width, img_height = template.size

print(f"Template dimensions: {img_width}x{img_height}")
print(f"Processing {len(cards_data)} cards...\n")

# Font options - try these in order
font_options = [
    "georgia.ttf",
    "georgiab.ttf",  # Georgia Bold
    "times.ttf",
    "timesbd.ttf",   # Times New Roman Bold
    "C:\\Windows\\Fonts\\georgia.ttf",
    "C:\\Windows\\Fonts\\times.ttf",
    "C:\\Windows\\Fonts\\calibri.ttf",
]

# Find available font
selected_font = None
base_font_size = int(img_height * 0.035)  # Scale font size to image height

for font_path in font_options:
    try:
        selected_font = ImageFont.truetype(font_path, base_font_size)
        print(f"Using font: {font_path}")
        break
    except:
        continue

if selected_font is None:
    print("Using default font")
    selected_font = ImageFont.load_default()

# Process each card
for idx, card in enumerate(cards_data, 1):
    filename = card['filename']
    inside_note = card['inside_note']
    
    # Create output filename
    output_filename = f"inside_{filename}"
    output_path = os.path.join(output_dir, output_filename)
    
    # Create new image from template
    img = template.copy()
    draw = ImageDraw.Draw(img)
    
    # Text wrapping - use 88% of image width for text (less margin)
    max_text_width = int(img_width * 0.88)  # Increased from 0.75 to 0.88
    
    # Word wrap the text
    avg_char_width = selected_font.getbbox('A')[2]  # Approximate character width
    chars_per_line = max_text_width // avg_char_width
    wrapped_text = textwrap.fill(inside_note, width=chars_per_line)
    
    # Get text bounding box to calculate centering
    bbox = draw.textbbox((0, 0), wrapped_text, font=selected_font)
    text_width = bbox[2] - bbox[0]
    text_height = bbox[3] - bbox[1]
    
    # Calculate position - centered horizontally with margin from top
    x = (img_width - text_width) // 2
    y = int(img_height * 0.15)  # 15% from top - reasonable margin
    
    # Draw text in pure black with spacing between lines
    line_spacing = int(base_font_size * 0.4)  # Add 40% of font size as spacing
    draw.text((x, y), wrapped_text, fill='#000000', font=selected_font, align='center', spacing=line_spacing)
    
    # Save the image
    img.save(output_path)
    print(f"[{idx}/{len(cards_data)}] Generated: {output_filename}")

print(f"\n✅ All {len(cards_data)} images generated successfully!")
print(f"Output directory: {output_dir}")

