import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
const getNow = () =>
  typeof performance !== "undefined" && typeof performance.now === "function"
    ? performance.now()
    : Date.now();

// POST /api/templates/[id]/copy - Copy a template to user's saved designs
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    // Await dynamic API `params` per Next.js 15 requirements
    const { params } = context;
    const { id } = await params;
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const accessToken = (session.user as { access_token?: string })
      .access_token;
    const body = await request.json();
    const templateMeta = body?.templateMeta;
    const fallbackImages: string[] = Array.isArray(body?.fallbackImages)
      ? body.fallbackImages
      : [];

    console.log("Copy API - Template ID:", id);
    console.log("Copy API - Request body:", body);
    console.log("Copy API - API Base URL:", API_BASE_URL);
    console.log("Copy API - Access Token exists:", !!accessToken);

    let template = templateMeta
      ? {
          ...templateMeta,
          id: templateMeta.id || id,
          title: templateMeta.title || body.title || "Template",
          cover_image:
            templateMeta.cover_image ||
            templateMeta.coverImage ||
            templateMeta.image_1,
          coverImage:
            templateMeta.coverImage ||
            templateMeta.cover_image ||
            templateMeta.image_1,
        }
      : null;

    let templateFetchDurationMs: number | null = null;
    if (!template) {
      const templateFetchStart = getNow();
      // First, get the template data
      const templateUrl = `${API_BASE_URL}/templates-enhanced/templates/${id}`;
      console.log("Copy API - Fetching template from:", templateUrl);

      const templateResponse = await fetch(templateUrl, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });

      console.log(
        "Copy API - Template response status:",
        templateResponse.status
      );

      if (!templateResponse.ok) {
        const errorText = await templateResponse.text();
        console.error("Copy API - Template fetch error:", errorText);

        if (templateResponse.status === 404) {
          return NextResponse.json(
            { error: "Template not found" },
            { status: 404 }
          );
        }
        throw new Error(
          `Failed to fetch template: ${templateResponse.status} - ${errorText}`
        );
      }

      const templateResult = await templateResponse.json();
      templateFetchDurationMs = getNow() - templateFetchStart;
      console.log(
        `⏱️ Copy API - Template fetch duration: ${templateFetchDurationMs.toFixed(
          1
        )}ms`
      );

      // Handle backend response structure
      if (!templateResult.success || !templateResult.data) {
        return NextResponse.json(
          { error: templateResult.error || "Template not found" },
          { status: 404 }
        );
      }

      template = templateResult.data;
    }

    // Generate unique name using timestamp instead of fetching all designs
    const baseName = body.title || template.title || "Template";
    let copyName = baseName;

    // Only add "Copy" suffix if no custom title provided
    if (!body.title) {
      // Use timestamp to ensure uniqueness without needing to fetch all designs
      const timestamp = Date.now();
      copyName = `${baseName} - Copy ${timestamp}`;
      console.log(`✅ Generated unique name using timestamp: ${copyName}`);
    } else {
      console.log(`✅ Using provided custom title: ${copyName}`);
    }

    console.log("Template data structure:", template);
    console.log("Category ID from request:", body.categoryId);
    console.log("Category Name from request:", body.categoryName);
    console.log("Request body keys:", Object.keys(body));

    // Ensure we have a valid category ID and validate it's not null/undefined
    const categoryId = body.categoryId;
    let categoryName = body.categoryName;

    console.log("🔍 Raw category data from request:");
    console.log("  - body.categoryId (raw):", body.categoryId);
    console.log("  - body.categoryName (raw):", body.categoryName);
    console.log("  - Type of categoryId:", typeof body.categoryId);
    console.log("  - Is categoryId null?", body.categoryId === null);
    console.log("  - Is categoryId undefined?", body.categoryId === undefined);
    console.log("  - Is categoryId empty string?", body.categoryId === "");

    // If categoryId is null, undefined, or empty string, this is an error
    if (!categoryId) {
      console.error("❌ CRITICAL: No category ID provided in request body!");
      console.log("   - Request body keys:", Object.keys(body));
      console.log("   - Full request body:", JSON.stringify(body, null, 2));
      return NextResponse.json(
        {
          error: "Category ID is required",
          details:
            "No category was selected. Please select a category before saving.",
          receivedData: { categoryId, categoryName },
        },
        { status: 400 }
      );
    }

    // Ensure we have defaults but don't override valid data
    categoryName = categoryName || "General";

    console.log("✅ Final validated category data:");
    console.log("  - categoryId:", categoryId);
    console.log("  - categoryName:", categoryName);

    // Use edited images if provided, otherwise use template images
    const templateImages = Array.from(
      new Set(
        [
          template.image_1 || template.image1,
          template.image_2 || template.image2,
          template.image_3 || template.image3,
          template.image_4 || template.image4,
          ...fallbackImages,
        ].filter(Boolean)
      )
    );

    const finalImages = body.editedImages || templateImages;

    // Create design data structure for saved designs
    const designData = {
      title: copyName,
      description: template.description || `Copy of ${baseName}`,
      category: categoryName,
      categoryId: categoryId, // Use camelCase to match SavedDesign interface
      categoryName: categoryName, // Use camelCase to match SavedDesign interface
      price: template.price || 1.99, // ✅ FIX: Copy price from template (default to $1.99 if missing)
      designData: {
        templateKey: template.slug || template.id,
        // Create pages from final images (edited or template)
        pages: finalImages.map((image: string, index: number) => ({
          header: `Page ${index + 1}`,
          image: image,
          // Populate page 2 text from template `message` if available
          text:
            index === 1
              ? (template.message || template.card_message || template.text || "")
              : "",
          footer: "",
        })),
        editedPages: body.editedImages
          ? Object.fromEntries(
              finalImages.map((img: string, index: number) => [index, img])
            )
          : {},
        // Store original template data for reference
        originalTemplate: {
          id: template.id,
          title: template.title,
          slug: template.slug,
          coverImage:
            template.cover_image ||
            template.coverImage ||
            template.image_1 ||
            template.image1,
        },
      },
      thumbnail: finalImages[0] || template.cover_image || template.coverImage,
      // Copy individual image fields for backend compatibility
      image_1: finalImages[0] || null,
      image_2: finalImages[1] || null,
      image_3: finalImages[2] || null,
      image_4: finalImages[3] || null,
      // Copy additional metadata
      searchKeywords: template.tags || [],
      language: template.language || "en",
      region: template.region || "US",
    };

    console.log(
      "Design data being sent to backend:",
      JSON.stringify(designData, null, 2)
    );

    // Save the design to user's saved designs
    const saveDesignStart = getNow();
    const saveResponse = await fetch(`${API_BASE_URL}/saved-designs`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken || ""}`,
      },
      body: JSON.stringify(designData),
    });
    console.log(
      `⏱️ Copy API - Save design duration: ${(
        getNow() - saveDesignStart
      ).toFixed(1)}ms`
    );

    if (!saveResponse.ok) {
      const errorText = await saveResponse.text();
      console.error("Failed to save design:", errorText);
      throw new Error(`Failed to save design: ${saveResponse.status}`);
    }

    const savedDesign = await saveResponse.json();
    console.log(
      "⏱️ Copy API - Timing summary",
      JSON.stringify(
        {
          templateFetchMs: templateFetchDurationMs
            ? Number(templateFetchDurationMs.toFixed(1))
            : "skipped",
          savedDesignsFetchMs: "skipped (using timestamp)",
          saveDesignMs: Number((getNow() - saveDesignStart).toFixed(1)),
        },
        null,
        2
      )
    );

    return NextResponse.json({
      success: true,
      data: savedDesign,
      message: `Template copied as "${copyName}"`,
    });
  } catch (error) {
    console.error("Error copying template:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to copy template", details: errorMessage },
      { status: 500 }
    );
  }
}
