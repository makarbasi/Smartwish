/**
 * Image optimization utilities for reducing file sizes while maintaining quality
 * Optimized for 5MB+ files to minimize upload times
 */

interface CompressionOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  outputFormat?: 'image/jpeg' | 'image/webp' | 'image/png';
  enableResize?: boolean;
}

/**
 * Compresses an image file to reduce its size for faster uploads
 * @param file - The original image file
 * @param options - Compression options
 * @returns Promise resolving to the compressed file
 */
export const compressImage = async (
  file: File, 
  options: CompressionOptions = {}
): Promise<File> => {
  const {
    maxWidth = 1920,
    maxHeight = 1080,
    quality = 0.85,
    outputFormat = 'image/jpeg',
    enableResize = true
  } = options;

  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();

    if (!ctx) {
      reject(new Error('Unable to get canvas context'));
      return;
    }

    img.onload = () => {
      try {
        let { width, height } = img;

        // Calculate new dimensions while maintaining aspect ratio
        if (enableResize) {
          const aspectRatio = width / height;
          
          if (width > maxWidth) {
            width = maxWidth;
            height = width / aspectRatio;
          }
          
          if (height > maxHeight) {
            height = maxHeight;
            width = height * aspectRatio;
          }
        }

        // Set canvas dimensions
        canvas.width = width;
        canvas.height = height;

        // Draw and compress the image
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('Failed to compress image'));
              return;
            }

            // Create new file with compressed data
            const compressedFile = new File([blob], file.name, {
              type: outputFormat,
              lastModified: Date.now()
            });

            console.log('🗜️ Image compression results:', {
              original: {
                size: file.size,
                dimensions: `${img.width}x${img.height}`,
                type: file.type
              },
              compressed: {
                size: compressedFile.size,
                dimensions: `${width}x${height}`,
                type: outputFormat,
                reduction: `${Math.round((1 - compressedFile.size / file.size) * 100)}%`
              }
            });

            resolve(compressedFile);
          },
          outputFormat,
          quality
        );
      } catch (error) {
        reject(error);
      }
    };

    img.onerror = () => {
      reject(new Error('Failed to load image for compression'));
    };

    // Load the image
    img.src = URL.createObjectURL(file);
  });
};

/**
 * Smart compression that automatically determines the best settings based on file size
 * @param file - The original image file
 * @returns Promise resolving to the optimized file
 */
export const smartCompress = async (file: File): Promise<File> => {
  const fileSizeMB = file.size / (1024 * 1024);
  
  console.log(`🎯 Smart compression for ${fileSizeMB.toFixed(2)}MB file`);

  // No compression needed for small files
  if (fileSizeMB < 0.5) {
    console.log('📝 File is small, skipping compression');
    return file;
  }

  // Light compression for medium files
  if (fileSizeMB < 2) {
    console.log('🟡 Applying light compression');
    return compressImage(file, {
      maxWidth: 1920,
      maxHeight: 1080,
      quality: 0.9,
      outputFormat: 'image/jpeg'
    });
  }

  // Moderate compression for large files
  if (fileSizeMB < 5) {
    console.log('🟠 Applying moderate compression');
    return compressImage(file, {
      maxWidth: 1600,
      maxHeight: 1200,
      quality: 0.85,
      outputFormat: 'image/jpeg'
    });
  }

  // Aggressive compression for very large files
  console.log('🔴 Applying aggressive compression');
  return compressImage(file, {
    maxWidth: 1280,
    maxHeight: 960,
    quality: 0.8,
    outputFormat: 'image/jpeg'
  });
};

/**
 * Validates if a file is a supported image type and within size limits
 * @param file - The file to validate
 * @param maxSizeMB - Maximum allowed size in MB
 * @returns Validation result
 */
export const validateImageFile = (file: File, maxSizeMB = 10): { valid: boolean; error?: string } => {
  // Check file type
  if (!file.type.startsWith('image/')) {
    return { valid: false, error: 'File must be an image' };
  }

  // Check file size
  const fileSizeMB = file.size / (1024 * 1024);
  if (fileSizeMB > maxSizeMB) {
    return { 
      valid: false, 
      error: `File size (${fileSizeMB.toFixed(1)}MB) exceeds maximum allowed size of ${maxSizeMB}MB` 
    };
  }

  // Check if it's a supported format
  const supportedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  if (!supportedTypes.includes(file.type)) {
    return { 
      valid: false, 
      error: 'Unsupported image format. Please use JPEG, PNG, WebP, or GIF' 
    };
  }

  return { valid: true };
};

/**
 * Processes an image file for optimal upload performance
 * @param file - The original image file
 * @returns Promise resolving to the processed file
 */
export const processImageForUpload = async (file: File): Promise<File> => {
  console.log('🚀 Processing image for optimal upload performance...');
  
  // Validate the file
  const validation = validateImageFile(file);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  // Apply smart compression
  const optimizedFile = await smartCompress(file);
  
  console.log('✅ Image processing complete');
  return optimizedFile;
};