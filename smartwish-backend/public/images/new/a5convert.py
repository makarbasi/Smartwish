import os
from PIL import Image

# Set your image folder path
input_folder = "./"
output_folder = os.path.join(input_folder, "resized")
os.makedirs(output_folder, exist_ok=True)

# Target dimensions
target_width = 1650
target_height = 2550

# Loop through all image files
for filename in os.listdir(input_folder):
    if filename.lower().endswith((".png", ".jpg", ".jpeg")):
        img_path = os.path.join(input_folder, filename)
        try:
            with Image.open(img_path) as img:
                resized = img.resize((target_width, target_height), Image.Resampling.LANCZOS)
                output_path = os.path.join(output_folder, filename)
                resized.save(output_path)
                print(f"Resized and saved: {output_path}")
        except Exception as e:
            print(f"Failed to process {filename}: {e}")
