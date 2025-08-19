import os
from PIL import Image, UnidentifiedImageError
import argparse

# Define the target size and format
TARGET_SIZE = (1024, 1024)
TARGET_FORMAT = "JPEG"
TARGET_EXTENSION = ".jpg"
OUTPUT_SUBFOLDER = "converted_jpg_1024" # Name of the subfolder for output

def convert_and_resize_images(input_folder):
    """
    Converts all images in the input_folder to JPG format,
    resizes them to TARGET_SIZE, and saves them in a subfolder.
    """
    if not os.path.isdir(input_folder):
        print(f"Error: Input folder '{input_folder}' not found or is not a directory.")
        return

    # Create the output subfolder path
    output_folder = os.path.join(input_folder, OUTPUT_SUBFOLDER)

    # Create the output subfolder if it doesn't exist
    try:
        os.makedirs(output_folder, exist_ok=True)
        print(f"Output will be saved in: '{output_folder}'")
    except OSError as e:
        print(f"Error creating output directory '{output_folder}': {e}")
        return

    processed_count = 0
    skipped_count = 0

    # List all files in the input directory
    print(f"\nProcessing files in '{input_folder}'...")
    for filename in os.listdir(input_folder):
        input_filepath = os.path.join(input_folder, filename)

        # Skip if it's a directory or the output directory itself
        if os.path.isdir(input_filepath):
            if input_filepath == output_folder:
                print(f"  Skipping output directory itself.")
            else:
                print(f"  Skipping directory: '{filename}'")
            skipped_count += 1
            continue

        # Try to open the file as an image
        try:
            with Image.open(input_filepath) as img:
                print(f"  Processing '{filename}'...")

                # --- Handle Transparency (Convert to RGB) ---
                # JPEG doesn't support transparency (alpha channel).
                # Convert images with alpha channels (like PNGs) to RGB mode.
                # This usually fills transparent areas with white by default.
                if img.mode == 'RGBA' or img.mode == 'P': # P mode might have transparency
                     # Ensure we create a background if converting from RGBA
                     # Create a new image with a white background
                     background = Image.new('RGB', img.size, (255, 255, 255))
                     try:
                         # Paste the image onto the background using the alpha channel as a mask
                         background.paste(img, (0, 0), img.split()[-1]) # Use alpha channel as mask
                         img = background
                     except IndexError:
                         # If no alpha channel is found after all, just convert
                         img = img.convert('RGB')

                elif img.mode != 'RGB':
                    # Convert other modes like L (grayscale), CMYK etc. to RGB
                    img = img.convert('RGB')

                # --- Resize the image ---
                # Use LANCZOS resampling for high-quality resizing
                try:
                    # Newer Pillow versions use Image.Resampling.LANCZOS
                    resized_img = img.resize(TARGET_SIZE, Image.Resampling.LANCZOS)
                except AttributeError:
                    # Older Pillow versions use Image.LANCZOS
                    resized_img = img.resize(TARGET_SIZE, Image.LANCZOS)

                # --- Prepare output path ---
                # Get filename without extension
                base_filename = os.path.splitext(filename)[0]
                # Create the new filename with the target extension
                output_filename = f"{base_filename}{TARGET_EXTENSION}"
                output_filepath = os.path.join(output_folder, output_filename)

                # --- Save the image ---
                # Save as JPEG with good quality (adjust quality as needed, 95 is high)
                resized_img.save(output_filepath, TARGET_FORMAT, quality=95)
                print(f"    -> Saved as '{output_filename}' (Size: {TARGET_SIZE})")
                processed_count += 1

        except UnidentifiedImageError:
            # Pillow couldn't identify it as an image file
            print(f"  Skipping non-image file: '{filename}'")
            skipped_count += 1
        except IOError as e:
            # Handle other potential file errors (e.g., permissions, corrupted file)
            print(f"  Error processing file '{filename}': {e}")
            skipped_count += 1
        except Exception as e:
            # Catch any other unexpected errors during processing
            print(f"  Unexpected error processing file '{filename}': {e}")
            skipped_count += 1

    print(f"\n--------------------------------------------------")
    print(f"Processing complete.")
    print(f"  Successfully processed and saved: {processed_count} image(s)")
    print(f"  Skipped files (non-image/directory/error): {skipped_count} file(s)")
    print(f"--------------------------------------------------")

# --- Main execution block ---
if __name__ == "__main__":
    # Set up argument parser for command-line execution
    parser = argparse.ArgumentParser(description=f"Convert images in a folder to {TARGET_FORMAT} format and resize to {TARGET_SIZE[0]}x{TARGET_SIZE[1]}.")
    parser.add_argument("input_folder", help="Path to the folder containing the images.")

    # Parse arguments
    args = parser.parse_args()

    # Run the conversion function
    convert_and_resize_images(args.input_folder)