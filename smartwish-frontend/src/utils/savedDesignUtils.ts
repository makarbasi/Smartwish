// Utility functions for saved design operations

export interface SaveSavedDesignResponse {
  success: boolean;
  message: string;
  data?: Record<string, unknown>;
  action: "update" | "duplicate";
  error?: string;
  details?: string;
}

export interface UploadImagesResponse {
  success: boolean;
  message: string;
  cloudUrls: string[];
  designId: string;
  count: number;
  error?: string;
  details?: string;
}

/**
 * Validate that no blob URLs or data URLs are present in image array
 */
export function validateNoBlobUrls(images: string[]): void {
  const blobUrls = images.filter((url) => url && url.startsWith("blob:"));
  const dataUrls = images.filter((url) => url && url.startsWith("data:"));
  const problematicUrls = [...blobUrls, ...dataUrls];
  
  if (problematicUrls.length > 0) {
    console.error("❌ CRITICAL: Blob/Data URLs detected in images:", problematicUrls);
    throw new Error(
      `Cannot save images with blob/data URLs. Found ${problematicUrls.length} URLs that must be uploaded to Supabase first.`
    );
  }
}

/**
 * Ensure all blob URLs and data URLs are converted to Supabase URLs before saving
 */
export async function ensureSupabaseUrls(
  images: string[],
  userId: string,
  designId?: string
): Promise<string[]> {
  const blobUrls = images.filter((url) => url && url.startsWith("blob:"));
  const dataUrls = images.filter((url) => url && url.startsWith("data:"));
  const urlsToUpload = [...blobUrls, ...dataUrls];

  if (urlsToUpload.length === 0) {
    console.log("✅ No blob URLs or data URLs found, all images are already uploaded");
    return images;
  }

  console.log("🔄 Found URLs to upload:", urlsToUpload.length, "(blob:", blobUrls.length, ", data:", dataUrls.length, ")");

  try {
    // Convert blob URLs and data URLs to base64
    const base64Images = await convertBlobUrlsToBase64(urlsToUpload);

    // Upload to Supabase
    const uploadResult = await uploadImages(base64Images, userId, designId);

    if (!uploadResult.success) {
      throw new Error(`Image upload failed: ${uploadResult.error}`);
    }

    console.log(
      "✅ Images uploaded successfully:",
      uploadResult.cloudUrls.length
    );

    // Replace blob URLs and data URLs with Supabase URLs
    const finalImages = images.map((url) => {
      if (url && (url.startsWith("blob:") || url.startsWith("data:"))) {
        const urlIndex = urlsToUpload.indexOf(url);
        return uploadResult.cloudUrls[urlIndex] || url;
      }
      return url;
    });

    console.log("🔄 Replaced blob URLs and data URLs with Supabase URLs");
    return finalImages;
  } catch (error) {
    console.error("❌ Failed to upload images:", error);
    throw new Error(
      `Failed to upload images to Supabase: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }
}

/**
 * Convert blob URLs to base64 data for upload
 */
export async function convertBlobUrlsToBase64(
  imageUrls: string[]
): Promise<string[]> {
  const base64Images: string[] = [];

  for (const url of imageUrls) {
    try {
      if (url.startsWith("blob:")) {
        // Convert blob URL to base64
        const response = await fetch(url);
        const blob = await response.blob();
        const base64 = await blobToBase64(blob);
        base64Images.push(base64);
      } else if (url.startsWith("data:image/")) {
        // Already base64
        base64Images.push(url);
      } else {
        // External URL - fetch and convert
        const response = await fetch(url);
        const blob = await response.blob();
        const base64 = await blobToBase64(blob);
        base64Images.push(base64);
      }
    } catch (error) {
      console.error("Error converting image to base64:", error);
      // Fallback: try to use original URL
      base64Images.push(url);
    }
  }

  return base64Images;
}

/**
 * Convert blob to base64
 */
function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Upload images to cloud storage
 */
export async function uploadImages(
  images: string[],
  userId: string,
  designId?: string
): Promise<UploadImagesResponse> {
  try {
    // Convert images to base64 if needed
    const base64Images = await convertBlobUrlsToBase64(images);

    const response = await fetch("/api/upload-images", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify({
        images: base64Images,
        userId,
        designId,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error("Error uploading images:", error);
    throw error;
  }
}

/**
 * Save saved design (update existing or create duplicate)
 */
export async function saveSavedDesign(
  designId: string,
  pageImages: string[],
  options: {
    action?: "update" | "duplicate";
    title?: string;
    userId: string;
    categoryId?: string;
    categoryName?: string;
    giftCardData?: any;
  }
): Promise<SaveSavedDesignResponse> {
  try {
    // CRITICAL: Ensure no blob URLs are being saved
    validateNoBlobUrls(pageImages);

    let endpoint: string;
    let method: string;
    let body: Record<string, unknown>;

    if (options.action === "duplicate") {
      // For duplicate, create a new design using POST to /api/saved-designs
      endpoint = `/api/saved-designs`;
      method = "POST";
      body = {
        title: options.title,
        description: `Copy of design`,
        categoryId: options.categoryId,
        categoryName: options.categoryName,
        image_1: pageImages[0] || null,
        image_2: pageImages[1] || null,
        image_3: pageImages[2] || null,
        image_4: pageImages[3] || null,
        cover_image: pageImages[0],
        imageUrls: pageImages, // Updated page images
        thumbnail: pageImages[0], // First image becomes cover
        designData: {
          templateKey: "custom",
          pages: pageImages.map((image) => ({
            header: "",
            image: image,
            text: "",
            footer: "",
          })),
          editedPages: Object.fromEntries(
            pageImages.map((image, index) => [index, image])
          ),
        },
        metadata: options.giftCardData ? { giftCard: options.giftCardData } : undefined,
      };
    } else {
      // For update, use PUT to existing design
      endpoint = `/api/saved-designs/${designId}`;
      method = "PUT";
      body = {
        title: options.title,
        categoryId: options.categoryId,
        categoryName: options.categoryName,
        image_1: pageImages[0] || null,
        image_2: pageImages[1] || null,
        image_3: pageImages[2] || null,
        image_4: pageImages[3] || null,
        cover_image: pageImages[0],
        imageUrls: pageImages, // Updated page images
        thumbnail: pageImages[0], // First image becomes cover
        designData: {
          templateKey: "custom",
          pages: pageImages.map((image) => ({
            header: "",
            image: image,
            text: "",
            footer: "",
          })),
          editedPages: Object.fromEntries(
            pageImages.map((image, index) => [index, image])
          ),
        },
        metadata: options.giftCardData ? { giftCard: options.giftCardData } : undefined,
      };

      console.log("📝 Update body categoryId:", options.categoryId);
      console.log("📝 Update body categoryName:", options.categoryName);
    }

    const response = await fetch(endpoint, {
      method,
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Save design API error:", response.status, errorText);
      throw new Error(`Save failed (${response.status}): ${errorText}`);
    }

    return await response.json();
  } catch (error) {
    console.error("Error saving saved design:", error);
    throw error;
  }
}

/**
 * Complete save workflow: save design with images directly
 */
export async function saveSavedDesignWithImages(
  designId: string,
  pageImages: string[],
  options: {
    action?: "update" | "duplicate";
    title?: string;
    userId: string;
    designId?: string;
    categoryId?: string;
    categoryName?: string;
    giftCardData?: any;
  }
): Promise<{
  saveResult: SaveSavedDesignResponse;
}> {
  try {
    console.log("🔄 Saving design with images...");
    console.log(
      "📸 Input images:",
      pageImages.map((url) => (url ? `${url.substring(0, 50)}...` : "null"))
    );

    // CRITICAL: Convert ALL blob URLs to Supabase URLs first
    const finalPageImages = await ensureSupabaseUrls(
      pageImages,
      options.userId,
      designId
    );

    console.log("✅ All images are now Supabase URLs");
    console.log(
      "📸 Final images:",
      finalPageImages.map((url) =>
        url ? `${url.substring(0, 50)}...` : "null"
      )
    );

    // Save design with final image URLs (now all Supabase URLs)
    const saveResult = await saveSavedDesign(designId, finalPageImages, {
      action: options.action,
      title: options.title,
      userId: options.userId,
      categoryId: options.categoryId,
      categoryName: options.categoryName,
      giftCardData: options.giftCardData,
    });

    if (!saveResult.success) {
      throw new Error(`Save failed: ${saveResult.error}`);
    }

    console.log("✅ Saved design updated successfully");

    return {
      saveResult,
    };
  } catch (error) {
    console.error("Error in save workflow:", error);
    throw error;
  }
}
