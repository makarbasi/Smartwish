import json
from PIL import Image, ImageDraw, ImageFont
import textwrap
import os
import glob

# Base paths
series_dir = r"C:\Users\makar\OneDrive\OLD\E-Learning\projects\SmartWish\Designs\Series1_original\Series"
blank_template = r"C:\Users\makar\OneDrive\OLD\E-Learning\projects\SmartWish\Code\Smartwish\scripts\blank.png"

# Find all inside notes JSON files
json_files = glob.glob(os.path.join(series_dir, "**", "*_inside_notes.json"), recursive=True)

print(f"Found {len(json_files)} JSON files to process:\n")
for f in json_files:
    print(f"  - {os.path.relpath(f, series_dir)}")
print()

# Load blank template to get dimensions
template = Image.open(blank_template)
img_width, img_height = template.size

print(f"Template dimensions: {img_width}x{img_height}\n")

# Font options - try these in order
font_options = [
    "georgia.ttf",
    "georgiab.ttf",
    "times.ttf",
    "timesbd.ttf",
    "C:\\Windows\\Fonts\\georgia.ttf",
    "C:\\Windows\\Fonts\\times.ttf",
    "C:\\Windows\\Fonts\\calibri.ttf",
]

# Find available font
selected_font = None
base_font_size = int(img_height * 0.035)

for font_path in font_options:
    try:
        selected_font = ImageFont.truetype(font_path, base_font_size)
        print(f"Using font: {font_path}\n")
        break
    except:
        continue

if selected_font is None:
    print("Using default font\n")
    selected_font = ImageFont.load_default()

# Process each JSON file
total_images = 0
for json_file in json_files:
    # Get output directory (same as JSON file location)
    output_dir = os.path.dirname(json_file)
    json_filename = os.path.basename(json_file)
    
    print(f"{'='*70}")
    print(f"Processing: {json_filename}")
    print(f"Output dir: {output_dir}")
    print(f"{'='*70}")
    
    # Read JSON file
    with open(json_file, 'r', encoding='utf-8') as f:
        cards_data = json.load(f)
    
    print(f"Found {len(cards_data)} cards to generate\n")
    
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
        
        # Text wrapping - use 88% of image width for text
        max_text_width = int(img_width * 0.88)
        
        # Word wrap the text
        avg_char_width = selected_font.getbbox('A')[2]
        chars_per_line = max_text_width // avg_char_width
        wrapped_text = textwrap.fill(inside_note, width=chars_per_line)
        
        # Get text bounding box to calculate centering
        bbox = draw.textbbox((0, 0), wrapped_text, font=selected_font)
        text_width = bbox[2] - bbox[0]
        text_height = bbox[3] - bbox[1]
        
        # Calculate position - centered horizontally with margin from top
        x = (img_width - text_width) // 2
        y = int(img_height * 0.15)  # 15% from top
        
        # Draw text in pure black with spacing between lines
        line_spacing = int(base_font_size * 0.4)
        draw.text((x, y), wrapped_text, fill='#000000', font=selected_font, align='center', spacing=line_spacing)
        
        # Save the image - convert to RGB if saving as JPEG
        file_ext = os.path.splitext(output_path)[1].lower()
        if file_ext in ['.jpg', '.jpeg']:
            # Convert RGBA to RGB for JPEG
            if img.mode == 'RGBA':
                rgb_img = Image.new('RGB', img.size, (255, 255, 255))
                rgb_img.paste(img, mask=img.split()[3] if len(img.split()) == 4 else None)
                rgb_img.save(output_path, 'JPEG', quality=95)
            else:
                img.save(output_path, 'JPEG', quality=95)
        else:
            img.save(output_path)
        
        print(f"  [{idx}/{len(cards_data)}] {output_filename}")
        total_images += 1
    
    print()

print(f"{'='*70}")
print(f"✅ All done! Generated {total_images} images across {len(json_files)} series!")
print(f"{'='*70}")

