// Global Constants
const IDEOGRAM_API_URL_V3 = "https://api.ideogram.ai/v1/ideogram-v3/generate";
const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";

const PROP_GROQ_API_KEY = "GROQ_API_KEY";
const PROP_IDEOGRAM_API_KEY = "IDEOGRAM_API_KEY";
const PROP_TEMP_IMAGE_URLS = "TEMP_IMAGE_URLS";
const PROP_CURRENT_PROMPT = "CURRENT_PROMPT";
const PROP_USER_PROMPT_TEMPLATES = "USER_PROMPT_TEMPLATES";
const PROP_LAST_USED_TEMPLATE = "LAST_USED_TEMPLATE";
const PROP_USER_AESTHETIC = "userAesthetic";
const PROP_USER_VIBE = "userVibe";

const DEFAULT_IDEOGRAM_ASPECT_RATIO = "16x9";
const DEFAULT_IDEOGRAM_MAGIC_PROMPT = "OFF";
const DEFAULT_IDEOGRAM_NEGATIVE_PROMPT =
  "small text, chaotic, strange characters, nonsense, duplicate, ugly, mutation, disgusting, unrealistic";
const DEFAULT_IDEOGRAM_RENDERING_SPEED = "TURBO";
const GROQ_MODEL_DEFAULT = "llama-3.3-70b-versatile";

const MAX_IMAGES_IDEOGRAM_V3 = 8;
const MIN_IMAGES_IDEOGRAM_V3 = 1;

// Helper Functions
function _getScriptProperties() {
  return PropertiesService.getScriptProperties();
}

function _getUserProperties() {
  return PropertiesService.getUserProperties();
}

function _getApiKey(keyName) {
  const scriptProps = _getScriptProperties();
  const apiKey = scriptProps.getProperty(keyName);
  if (!apiKey) {
    console.error(keyName + " not set in script properties.");
  }
  return apiKey;
}

function _clampValue(value, min, max) {
  return Math.max(min, Math.min(value, max));
}

function _makeGroqApiCall(messages, model, temperature, max_tokens) {
  const groqApiKey = _getApiKey(PROP_GROQ_API_KEY);
  if (!groqApiKey) {
    return {
      error:
        PROP_GROQ_API_KEY + " not set. Please set it in script properties.",
    };
  }

  try {
    const groqPayload = {
      messages: messages,
      model: model || GROQ_MODEL_DEFAULT,
      max_tokens: max_tokens || 1000,
      temperature: temperature || 0.3, // Default temperature, can be overridden
    };

    const groqOptions = {
      method: "post",
      contentType: "application/json",
      headers: {
        Authorization: "Bearer " + groqApiKey,
        "Content-Type": "application/json",
      },
      payload: JSON.stringify(groqPayload),
      muteHttpExceptions: true,
    };

    const groqResponse = UrlFetchApp.fetch(GROQ_API_URL, groqOptions);
    const groqResponseCode = groqResponse.getResponseCode();
    const groqResponseBody = groqResponse.getContentText();

    if (groqResponseCode === 200) {
      const groqResult = JSON.parse(groqResponseBody);
      if (
        groqResult.choices &&
        groqResult.choices.length > 0 &&
        groqResult.choices[0].message &&
        groqResult.choices[0].message.content
      ) {
        const content = groqResult.choices[0].message.content.trim();
        console.log("Result: ", content);
        return { success: content };
      } else {
        console.error(
          "Failed to parse content from Groq response",
          groqResponseBody.substring(0, 500)
        );
        return { error: "Failed to parse content from Groq response." };
      }
    } else {
      console.error(
        "Groq API error:",
        groqResponseCode,
        groqResponseBody.substring(0, 500)
      );
      return {
        error:
          "Groq API error: " +
          groqResponseCode +
          " - " +
          groqResponseBody.substring(0, 100) +
          "...",
      };
    }
  } catch (e) {
    console.error("Error in _makeGroqApiCall:", e);
    return { error: "Exception during Groq API call: " + e.toString() };
  }
}

/**
 * Creates a card for the add-on. This function is called when the add-on is
 * opened from the Google Slides Add-ons menu.
 *
 * @param {Object} e The event object.
 * @return {CardService.Card} The card to display.
 */
function onHomepage(e) {
  console.log("onHomepage event object:", JSON.stringify(e));
  showSidebar();
  return null;
}

/**
 * Handles the onFileScopeGranted trigger. This function is called when the user
 * grants file scope access to the add-on.
 *
 * @param {Object} e The event object.
 */
function onFileScopeGranted(e) {
  console.log("onFileScopeGranted event object:", JSON.stringify(e));
  // Typically, you would re-render the UI or enable functionality
  // that depends on file access. For now, we"ll just open the homepage again.
  onHomepage(e);
}

/**
 * Opens the sidebar. This function is called when the "Show Sidebar" button is clicked.
 */
function showSidebar() {
  const ui = HtmlService.createHtmlOutputFromFile("Sidebar")
    .setTitle("PGA Google Slides Maker AI")
    .setWidth(300);
  SlidesApp.getUi().showSidebar(ui);
}

/**
 * Placeholder function to be called from the client-side JavaScript in the sidebar.
 * This is where you would integrate with Groq, Ideogram, etc.
 *
 * @param {string} prompt The user"s prompt.
 * @return {string} A status message.
 */
function generateSlideContent(prompt) {
  console.log(prompt);

  const ideogramApiKey = _getApiKey(PROP_IDEOGRAM_API_KEY);

  if (!ideogramApiKey) {
    return {
      ideogramImageUrls: [],
      statusMessage:
        PROP_IDEOGRAM_API_KEY + " not set. Please set it in script properties.",
    };
  }

  let statusMessage = "";
  let collectedImageUrls = [];
  const num_images_to_request = MAX_IMAGES_IDEOGRAM_V3; // Use constant, assuming always max for now

  try {
    console.log(
      "Attempting Ideogram API call (V3 for " +
        num_images_to_request +
        " images)..."
    );

    const ideogramApiUrl = IDEOGRAM_API_URL_V3; // Use constant

    let num_images_clamped = _clampValue(
      num_images_to_request,
      MIN_IMAGES_IDEOGRAM_V3,
      MAX_IMAGES_IDEOGRAM_V3
    );

    const boundary = "Boundary_" + new Date().getTime();
    let multipartRequestBody = "";

    const formFields = {
      prompt: prompt,
      aspect_ratio: DEFAULT_IDEOGRAM_ASPECT_RATIO,
      magic_prompt: DEFAULT_IDEOGRAM_MAGIC_PROMPT,
      negative_prompt: DEFAULT_IDEOGRAM_NEGATIVE_PROMPT,
      num_images: String(num_images_clamped),
      rendering_speed: DEFAULT_IDEOGRAM_RENDERING_SPEED,
    };

    for (const key in formFields) {
      multipartRequestBody += "--" + boundary + "\r\n";
      multipartRequestBody +=
        'Content-Disposition: form-data; name="' + key + '"\r\n\r\n';
      multipartRequestBody += formFields[key] + "\r\n";
    }

    const colorPaletteConfig = {
      members: [
        { color_hex: "#00205B", color_weight: 0.3 },
        { color_hex: "#0053FF", color_weight: 0.2 },
        { color_hex: "#B9CBD3", color_weight: 0.2 },
        { color_hex: "#F1F1F1", color_weight: 0.15 },
        { color_hex: "#97999B", color_weight: 0.15 },
      ],
    };

    multipartRequestBody += "--" + boundary + "\r\n";
    multipartRequestBody +=
      'Content-Disposition: form-data; name="color_palette"\r\n';
    multipartRequestBody += "Content-Type: application/json\r\n\r\n";
    multipartRequestBody += JSON.stringify(colorPaletteConfig) + "\r\n";

    multipartRequestBody += "--" + boundary + "--\r\n";

    const ideogramOptions = {
      method: "post",
      contentType: "multipart/form-data; boundary=" + boundary,
      headers: {
        "Api-Key": ideogramApiKey,
      },
      payload: Utilities.newBlob(multipartRequestBody).getBytes(),
      muteHttpExceptions: true,
    };

    console.log(
      "Ideogram V3 Request Headers:",
      JSON.stringify({
        "Api-Key": "REDACTED",
        "Content-Type": ideogramOptions.contentType,
      })
    );

    console.log("Sending request to Ideogram V3...");
    const ideogramResponse = UrlFetchApp.fetch(ideogramApiUrl, ideogramOptions);
    const ideogramResponseCode = ideogramResponse.getResponseCode();
    const ideogramResponseBody = ideogramResponse.getContentText();
    console.log("Ideogram V3 Response Code:", ideogramResponseCode);

    if (ideogramResponseCode === 200) {
      try {
        const ideogramResult = JSON.parse(ideogramResponseBody);
        console.log(
          "Ideogram V3 API Response (first 200 chars):",
          JSON.stringify(ideogramResult).substring(0, 200) + "..."
        );

        const generated_data = ideogramResult.data || [];

        if (generated_data && generated_data.length > 0) {
          generated_data.forEach((item) => {
            if (item.url) {
              collectedImageUrls.push(item.url);
              console.log(
                "Found image URL:",
                item.url.substring(0, 60) + "..."
              );
            } else {
              console.warn(
                "Warning: No 'url' found in image item:",
                JSON.stringify(item).substring(0, 100)
              );
            }
          });

          statusMessage +=
            collectedImageUrls.length +
            " image URL(s) received from Ideogram V3. ";

          if (collectedImageUrls.length === 0) {
            statusMessage +=
              "But no URLs found in data items. Check response structure. ";
            console.warn(
              "Ideogram V3: data array present but no URLs found in items"
            );
          }
        } else {
          statusMessage +=
            "No 'data' array found or 'data' array is empty in Ideogram API response. ";
          console.warn(
            "Warning: No 'data' array found or 'data' array is empty in API response."
          );
        }
      } catch (parseError) {
        statusMessage += "Failed to parse Ideogram V3 JSON response. ";
        console.error(
          "Error parsing Ideogram V3 JSON response:",
          parseError,
          "Response body (first 500 chars):",
          ideogramResponseBody.substring(0, 500)
        );
      }
    } else if (ideogramResponseCode === 202) {
      statusMessage +=
        "Ideogram request accepted (202). This is an asynchronous job. ";
      console.warn(
        "Ideogram returned 202 Accepted. Response (first 500 chars):",
        ideogramResponseBody.substring(0, 500)
      );
    } else {
      statusMessage +=
        "Ideogram API (V3) error (" + ideogramResponseCode + "). ";
      try {
        const errorDetails = JSON.parse(ideogramResponseBody);
        console.error(
          "Ideogram API (V3) Error Details:",
          JSON.stringify(errorDetails)
        );
      } catch (e) {
        console.error(
          "Ideogram API (V3) Error (non-JSON response):",
          ideogramResponseBody.substring(0, 500)
        );
      }
    }
  } catch (e) {
    console.error("Error during Ideogram API (V3) call:", e);
    statusMessage +=
      "Error processing Ideogram (V3) request: " + e.toString() + ". ";
  }

  console.log("generateSlideContent final status: ", statusMessage);
  console.log(
    "Returning to client: Image URLs count: ",
    collectedImageUrls.length
  );

  if (collectedImageUrls.length > 0) {
    const scriptProps = _getScriptProperties();
    scriptProps.setProperty(
      PROP_TEMP_IMAGE_URLS, // Use constant
      JSON.stringify(collectedImageUrls)
    );
    console.log(
      "Stored",
      collectedImageUrls.length,
      "image URLs in script properties"
    );

    showImagePickerDialog(collectedImageUrls);
  }

  return {
    ideogramImageUrls: collectedImageUrls,
    statusMessage:
      statusMessage.trim() || "Image generation process completed.",
  };
}

/**
 * Inserts text into the currently selected slide.
 * @param {string} text The text to insert.
 */
function insertTextToCurrentSlide(text) {
  try {
    const presentation = SlidesApp.getActivePresentation();
    const selection = presentation.getSelection();
    const currentPage = selection.getCurrentPage();

    if (!currentPage) {
      console.error("No slide selected or found.");
      SlidesApp.getUi().alert("Please select a slide first.");
      return;
    }
    // Insert text box - adjust position and size as needed
    const shape = currentPage.insertTextBox(text, 100, 100, 300, 50); // x, y, width, height
    console.log("Text box inserted:", shape.getObjectId());
  } catch (e) {
    console.error("Error inserting text to slide:", e);
    SlidesApp.getUi().alert("Error inserting text: " + e.message);
  }
}

/**
 * Inserts an image from a URL into the currently selected slide.
 * @param {string} imageUrl The URL of the image to insert.
 */
function insertImageToCurrentSlide(imageUrl) {
  try {
    const presentation = SlidesApp.getActivePresentation();
    const selection = presentation.getSelection();
    const currentPage = selection.getCurrentPage();

    if (!currentPage) {
      console.error("No slide selected or found.");
      SlidesApp.getUi().alert("Please select a slide first.");
      return;
    }
    // Insert image - adjust position and size as needed
    const image = currentPage.insertImage(imageUrl, 50, 150, 400, 300); // x, y, width, height
    console.log("Image inserted:", image.getObjectId());
  } catch (e) {
    console.error("Error inserting image to slide:", e);
    SlidesApp.getUi().alert("Error inserting image: " + e.message);
  }
}

/**
 * For backward compatibility only - no longer used. API keys are set directly
 * in Script Properties, not from the UI.
 */
function saveApiKeys(groqKey, ideogramKey) {
  console.warn(
    "saveApiKeys function is deprecated. API keys should be set directly in Script Properties."
  );
  // Return a more informative message to the client if it somehow gets called.
  return {
    success: false,
    message: "Deprecated: API keys must be configured in Script Properties.",
  };
}

/**
 * Generates a new prompt using Groq based on an initial prompt template and a new topic.
 * This is used to generate the content for the "new_prompt" field.
 *
 * @param {string} initialPrompt The prompt template
 * @param {string} newTopic The new topic to use in the template
 * @return {string} The generated prompt
 */
function generateNewPrompt(initialPrompt, newTopic) {
  const content =
    `
Create a prompt using the template, but make it about the given topic. Keep the style and punctuation EXACTLY the same! Anything inside {} is an instruction on how to vary the prompt, not part of the prompt itself, so don't include it.

<example>
<template>A flat 3d simple graphical illustration (to be used as a full-screen PowerPoint slide) with a mellow, modern style containing {list items or describe the scene}. Contains ONLY these large texts: "{list key concepts}" with the emphasis on "{one of the texts}". Use bold fonts for the text lettering.</template>
<topic>Golden Retrievers make excellent pets</topic>
<response>
A flat 3d simple graphical illustration (to be used as a full-screen PowerPoint slide) with a mellow, modern style containing happy Golden Retrievers playing. Contains ONLY these large texts: "Golden Retriever", "Loyal Family Dogs", "Easy To Train", "Faithful Companions" with the emphasis on "Golden Retriever". Use bold fonts for the text lettering.
</response>
</example>

<example>
<template>A flat 3d simple graphical illustration (to be used as a full-screen PowerPoint slide) with a mellow, modern style containing {list items or describe the scene}. Contains ONLY these large texts: "{list key concepts}" with the emphasis on "{one of the texts}". Use bold fonts for the text lettering.</template>
<topic>Summit County is a great place to visit in the summer</topic>
<response>
A flat 3d simple graphical illustration (to be used as a full-screen PowerPoint slide) with a mellow, modern style containing mountains, lakes, and hiking trails. Contains ONLY these large texts: "Summer", "Summit County" with the emphasis on "Summit County". Use bold fonts for the text lettering.</response>
</example>

<example>
<template>A flat 3d simple graphical illustration (to be used as a full-screen PowerPoint slide) with a mellow, modern style containing {list items or describe the scene}. Contains ONLY these large texts: "{list key concepts}" with the emphasis on "{one of the texts}". Use bold fonts for the text lettering.</template>
<topic>Renewable energy is reshaping the world</topic>
<response>
A flat 3d simple graphical illustration (to be used as a full-screen PowerPoint slide) with a mellow, modern style containing wind turbines on rolling hills, solar panels, and a glowing sun. Contains ONLY these large texts: "Renewable Energy", "Clean Power", "Future", "Innovation" with the emphasis on "Renewable Energy". Use bold fonts for the text lettering.
</response>
</example>

<example>
<template>A flat 3d simple graphical illustration (to be used as a full-screen PowerPoint slide) with a mellow, modern style containing {list items or describe the scene}. Contains ONLY these large texts: "{list key concepts}" with the emphasis on "{one of the texts}". Use script fonts for the text lettering.</template>
<topic>Space exploration inspires new generations</topic>
<response>
A flat 3d simple graphical illustration (to be used as a full-screen PowerPoint slide) with a mellow, modern style containing a rocket launching toward planets and stars, an astronaut waving, and swirling galaxies. Contains ONLY these large texts: "Space Exploration", "Innovation", "Discovery", "Inspiration" with the emphasis on "Space Exploration". Also list explorers together in a list: "Neil Armstrong", "Buzz Aldrin", "Yuri Gagarin", "Valentina Tereshkova", "Chris Hadfield", "Mae Jemison". Use script fonts for the text lettering.
</response>
</example>

<example>
<template>A flat 3d simple graphical illustration (to be used as a full-screen PowerPoint slide) with a mellow, modern style containing {list items or describe the scene}. Contains ONLY these large texts: "{list key concepts}" with the emphasis on "{one of the texts}". Use bold fonts for the text lettering.</template>
<topic>
Slide 8: Replace Active Directory with Okta - Gave Us SSO and MFA Right Away
* Implementation of Okta for unified identity and access management
A stylized image of a key unlocking a digital lock, with Okta's logo prominently displayed, surrounded by a few devices (laptop, phone, tablet) with secure login screens.
</topic>
<response>
A flat 3d simple graphical illustration (to be used as a full-screen PowerPoint slide) with a mellow, modern style containing a stylized image of a key unlocking a digital lock, with Okta's logo prominently displayed, surrounded by a few devices (laptop, phone, tablet) with secure login screens. Contains ONLY these large texts: "Okta", "Single Sign On", "Multi Factor Authentication" with the emphasis on "Okta", then "Single Sign On", and least on "Multi Factor Authentication". Include "Active Directory" text with a strikethrough effect indicating that it's been replaced. Use bold fonts for the text lettering.
</response>
</example>



<template>
` +
    initialPrompt +
    `
</template>

<topic>
` +
    newTopic +
    `
</topic>
`;

  console.log(content);

  const groqMessages = [
    {
      role: "user",
      content: content,
    },
  ];

  const result = _makeGroqApiCall(groqMessages, GROQ_MODEL_DEFAULT, 0.3, 1000);

  if (result.success) {
    return result.success;
  } else {
    console.error("generateNewPrompt failed:", result.error);
    return (
      result.error || // Prefer specific error from helper
      "Failed to generate new prompt about " + newTopic + ". Please try again."
    );
  }
}

/**
 * Inserts an image from a URL into a new slide created after the current slide.
 * Also adds the generated prompt to the slide notes.
 * @param {string} imageUrl The URL of the image to insert.
 * @return {string} A status message indicating success or failure.
 */
function addImageToNewSlideFromUrl(imageUrl) {
  try {
    if (!imageUrl) {
      console.error("addImageToNewSlideFromUrl: No image URL provided.");
      return "Error: No image URL provided.";
    }

    // Get the generated prompt from script properties to add to slide notes
    const scriptProperties = PropertiesService.getScriptProperties();
    const generatedPrompt =
      scriptProperties.getProperty("CURRENT_PROMPT") || "";

    const presentation = SlidesApp.getActivePresentation();
    const currentSelection = presentation.getSelection();
    let insertionIndex = presentation.getSlides().length; // Default to end of the presentation

    if (currentSelection) {
      const currentPage = currentSelection.getCurrentPage(); // This is a Page object

      // Proceed to find index only if a page is selected and it's a SLIDE
      if (
        currentPage &&
        currentPage.getPageType() === SlidesApp.PageType.SLIDE
      ) {
        const currentSlide = currentPage.asSlide(); // Explicitly work with a Slide object
        const slides = presentation.getSlides(); // Array of Slide objects in the presentation
        let foundPageIndex = -1;

        // Try to find the slide by object reference first
        foundPageIndex = slides.indexOf(currentSlide);

        if (foundPageIndex === -1) {
          // If not found by reference, try to find by ID (more reliable)
          console.log(
            "Selected slide not found by reference, attempting to find by ID."
          );
          const currentSlideId = currentSlide.getObjectId();
          console.log("ID of selected slide: " + currentSlideId);
          for (let i = 0; i < slides.length; i++) {
            if (slides[i].getObjectId() === currentSlideId) {
              foundPageIndex = i;
              console.log("Selected slide found by ID at index: " + i);
              break;
            }
          }
        }

        if (foundPageIndex >= 0) {
          insertionIndex = foundPageIndex + 1; // Insert AFTER the found slide
          console.log(
            "Determined insertion index after selected slide: " + insertionIndex
          );
        } else {
          // This case should be rare if a slide was selected and is part of the presentation
          console.warn(
            "Selected slide (type SLIDE) could not be located in the presentation's slide list. Appending to end."
          );
          // insertionIndex remains default (end of presentation)
        }
      } else if (currentPage) {
        // Selected page is not a regular slide (e.g., notes master, layout)
        console.log(
          "Selected page is not a content slide (type: " +
            currentPage.getPageType() +
            "). New slide will be appended to the end."
        );
        // insertionIndex remains default (end of presentation)
      } else {
        // No specific page element is part of the selection
        console.log(
          "No specific page selected from current selection. New slide will be appended to the end."
        );
        // insertionIndex remains default (end of presentation)
      }
    } else {
      // No selection in the presentation at all
      console.log(
        "No selection in presentation. New slide will be appended to the end."
      );
      // insertionIndex remains default (end of presentation)
    }

    console.log("Final insertion index for new slide:", insertionIndex);

    // Insert a new slide at the determined index
    const newSlide = presentation.insertSlide(insertionIndex);

    // Get dimensions of the new slide for proper scaling
    const slideWidth = presentation.getPageWidth();
    const slideHeight = presentation.getPageHeight();

    // Insert the image
    const image = newSlide.insertImage(imageUrl);

    // --- Center and scale image to fit slide ---
    const imgWidth = image.getWidth();
    const imgHeight = image.getHeight();

    // Calculate aspect ratios
    const slideAspectRatio = slideWidth / slideHeight;
    const imageAspectRatio = imgWidth / imgHeight;

    let newImgWidth;
    let newImgHeight;

    if (imageAspectRatio > slideAspectRatio) {
      // Image is wider than slide, so fit to width
      newImgWidth = slideWidth;
      newImgHeight = slideWidth / imageAspectRatio;
    } else {
      // Image is taller than slide, so fit to height
      newImgHeight = slideHeight;
      newImgWidth = slideHeight * imageAspectRatio;
    }

    image.setWidth(newImgWidth);
    image.setHeight(newImgHeight);

    // Center the image
    const left = (slideWidth - newImgWidth) / 2;
    const top = (slideHeight - newImgHeight) / 2;
    image.setLeft(left);
    image.setTop(top);
    // --- End of centering and scaling ---

    // Add the prompt to the slide notes if available
    if (generatedPrompt) {
      newSlide
        .getNotesPage()
        .getSpeakerNotesShape()
        .getText()
        .setText(generatedPrompt);
      console.log("Added generated prompt to slide notes");
    }

    console.log(
      "Image inserted and resized in new slide: " +
        newSlide.getObjectId() +
        ", Image ID: " +
        image.getObjectId()
    );

    // Select the new slide - using multiple approaches for reliability
    try {
      // Method 1: Use selectAsCurrentPage
      newSlide.selectAsCurrentPage();

      // Method 2: Create a selection with this slide and apply it
      const selection = SlidesApp.getSelection();
      const range = SlidesApp.getActivePresentation()
        .getSelection()
        .getPageRange();
      if (range) {
        range.removeRange(); // Clear any existing page selection
      }

      // Force selection refresh by creating a new Page Range selection with just this page
      const newRange = SlidesApp.newPageRange().addPage(newSlide);
      SlidesApp.getActivePresentation().setSelection(newRange);

      console.log(
        "New slide selected using multiple methods:",
        newSlide.getObjectId()
      );
    } catch (selectionError) {
      console.error(
        "Error while trying to select the new slide:",
        selectionError
      );
      // Continue execution even if selection fails
    }

    return "Image successfully added to a new slide and selected.";
  } catch (e) {
    console.error("Error in addImageToNewSlideFromUrl:", e);
    SlidesApp.getUi().alert("Error adding image: " + e.message); // Show error to user
    return "Error adding image to new slide: " + e.message;
  }
}

/**
 * Server-side function to show the image picker dialog.
 * This is a fallback if the client-side dialog approach doesn't work.
 *
 * @param {Array} imageUrls Array of image URLs to display in the picker
 * @return {string} Status message
 */
function showImagePickerDialog(imageUrls) {
  try {
    if (!imageUrls || !Array.isArray(imageUrls) || imageUrls.length === 0) {
      console.error("showImagePickerDialog: No image URLs provided");
      // It's better to inform the user through the UI if possible, or at least log clearly.
      // For now, returning an error string might be caught by the sidebar's status.
      SlidesApp.getUi().alert("Error: No images were generated to display.");
      return "Error: No images to display";
    }

    console.log(
      "Showing server-side image picker with",
      imageUrls.length,
      "images"
    );

    // Create an HTML template from the file.
    const template = HtmlService.createTemplateFromFile("ImagePicker");
    // Pass the imageUrls to the template. They will be accessible in scriptlets.
    template.imageUrls = imageUrls;

    // Evaluate the template to get the HTML output with data injected.
    const htmlOutput = template.evaluate().setWidth(1000).setHeight(600);

    SlidesApp.getUi().showModalDialog(
      htmlOutput,
      "Select an image for your slide"
    );
    // TEMP_IMAGE_URLS is no longer needed as we pass data directly.
    // _getScriptProperties().deleteProperty(PROP_TEMP_IMAGE_URLS); // Optional: cleanup if it was set before this flow
    console.log(
      "Image picker dialog displayed with URLs passed directly to template."
    );
    return "Image selection dialog displayed";
  } catch (e) {
    console.error("Error showing image picker dialog:", e);
    SlidesApp.getUi().alert(
      "Could not show image selection dialog: " + e.message
    );
    return "Error showing image selection dialog: " + e.message;
  }
}

/**
 * Gets the temporarily stored image URLs.
 * This is called from the ImagePicker.html file.
 *
 * @return {Array} Array of image URLs
 */
function getStoredImageUrls() {
  // This function will no longer be called by ImagePicker.html after the refactor.
  // It can be kept for other potential uses or deprecated/removed.
  console.warn(
    "getStoredImageUrls was called, but should be deprecated if ImagePicker.html is refactored to accept URLs directly."
  );
  const scriptProps = _getScriptProperties();
  const storedUrls = scriptProps.getProperty(PROP_TEMP_IMAGE_URLS);

  console.log(
    "Retrieved stored image URLs:",
    storedUrls ? "data found" : "no data"
  );

  if (storedUrls) {
    try {
      return JSON.parse(storedUrls);
    } catch (e) {
      console.error("Error parsing stored image URLs:", e);
      return [];
    }
  }
  return [];
}

/**
 * For server-side templating to include files with scriptlets.
 *
 * @param {string} filename The name of the HTML file to include
 * @return {string} The HTML content
 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/**
 * Stores the current prompt in script properties for later use in slide notes.
 *
 * @param {string} prompt The prompt to store
 * @return {boolean} True if successful
 */
function storeCurrentPrompt(prompt) {
  try {
    if (!prompt) {
      console.warn("storeCurrentPrompt called with empty prompt");
      return false;
    }
    _getScriptProperties().setProperty(PROP_CURRENT_PROMPT, prompt);
    console.log(
      "Current prompt stored for slide notes:",
      prompt.substring(0, 50) + "..."
    );
    return true;
  } catch (e) {
    console.error("Error storing current prompt:", e);
    return false;
  }
}

/**
 * Saves a user's prompt template with a name
 * @param {string} templateName The name of the template
 * @param {string} templateText The prompt template text to save
 * @return {Object} Status of the operation
 */
function saveUserPromptTemplate(templateName, templateText) {
  try {
    if (!templateName || !templateText) {
      return { success: false, message: "Template name and text are required" };
    }

    const userProps = _getUserProperties();
    let templates = {};
    const savedTemplates = userProps.getProperty(PROP_USER_PROMPT_TEMPLATES);
    if (savedTemplates) {
      templates = JSON.parse(savedTemplates);
    }

    templates[templateName] = templateText;
    userProps.setProperty(
      PROP_USER_PROMPT_TEMPLATES,
      JSON.stringify(templates)
    );

    console.log("Saved user template: " + templateName);
    // Return all templates including the newly saved one, consistent with delete
    return {
      success: true,
      message: "Template saved successfully",
      templates: templates,
    };
  } catch (e) {
    console.error("Error saving user template:", e);
    return { success: false, message: "Error saving template: " + e.message };
  }
}

/**
 * Gets all user's saved prompt templates
 * @return {Object} Object containing success status and templates
 */
function getUserPromptTemplates() {
  try {
    const userProps = _getUserProperties();
    const savedTemplates = userProps.getProperty(PROP_USER_PROMPT_TEMPLATES);

    if (savedTemplates) {
      return {
        success: true,
        templates: JSON.parse(savedTemplates),
      };
    }
    return { success: true, templates: {} }; // Return empty object if no templates
  } catch (e) {
    console.error("Error retrieving user templates:", e);
    return {
      success: false,
      message: "Error retrieving templates: " + e.message,
      templates: {}, // Return empty object on error
    };
  }
}

/**
 * Deletes a user's prompt template
 * @param {string} templateName The name of the template to delete
 * @return {Object} Status of the operation
 */
function deleteUserPromptTemplate(templateName) {
  try {
    if (!templateName) {
      return { success: false, message: "Template name is required" };
    }

    const userProps = _getUserProperties();
    const savedTemplates = userProps.getProperty(PROP_USER_PROMPT_TEMPLATES);

    if (!savedTemplates) {
      return { success: false, message: "No templates found" };
    }

    let templates = JSON.parse(savedTemplates);

    if (!templates[templateName]) {
      return { success: false, message: "Template not found" };
    }

    delete templates[templateName];
    userProps.setProperty(
      PROP_USER_PROMPT_TEMPLATES,
      JSON.stringify(templates)
    );

    console.log("Deleted user template: " + templateName);
    return {
      success: true,
      message: "Template deleted successfully",
      templates: templates, // Return updated templates list
    };
  } catch (e) {
    console.error("Error deleting user template:", e);
    return { success: false, message: "Error deleting template: " + e.message };
  }
}

/**
 * Saves the last used template to user properties
 * @param {string} templateText The current template text to save
 * @return {Object} Status of the operation
 */
function saveLastUsedTemplate(templateText) {
  try {
    if (!templateText) {
      // Allow saving an empty string to clear the last used template if needed
      console.warn(
        "saveLastUsedTemplate called with empty templateText. This will clear the last used template."
      );
    }

    _getUserProperties().setProperty(
      PROP_LAST_USED_TEMPLATE,
      templateText || ""
    );

    console.log("Saved last used template");
    return { success: true, message: "Last used template saved" };
  } catch (e) {
    console.error("Error saving last used template:", e);
    return { success: false, message: "Error saving template: " + e.message };
  }
}

/**
 * Gets the last used template from user properties
 * @return {Object} Status and the template text
 */
function getLastUsedTemplate() {
  try {
    const userProps = _getUserProperties();
    const lastTemplate = userProps.getProperty(PROP_LAST_USED_TEMPLATE);

    // Explicitly check for null/undefined to distinguish from an empty string
    if (lastTemplate !== null && lastTemplate !== undefined) {
      return {
        success: true,
        template: lastTemplate,
      };
    }
    // If property doesn't exist or was explicitly null
    return { success: true, template: null };
  } catch (e) {
    console.error("Error retrieving last used template:", e);
    return {
      success: false,
      message: "Error retrieving last template: " + e.message,
      template: null,
    };
  }
}

// Functions for persisting aesthetic and vibe
function saveAestheticAndVibe(aesthetic, vibe) {
  try {
    _getUserProperties().setProperties({
      [PROP_USER_AESTHETIC]: aesthetic,
      [PROP_USER_VIBE]: vibe,
    });
    return { success: true };
  } catch (e) {
    console.error("Error in saveAestheticAndVibe: " + e.toString());
    return { success: false, message: e.message };
  }
}

function getAestheticAndVibe() {
  try {
    const properties = _getUserProperties().getProperties();
    const aestheticValue = properties[PROP_USER_AESTHETIC];
    const vibeValue = properties[PROP_USER_VIBE];

    return {
      success: true,
      values: {
        aesthetic: aestheticValue === undefined ? null : aestheticValue,
        vibe: vibeValue === undefined ? null : vibeValue,
      },
    };
  } catch (e) {
    console.error("Error in getAestheticAndVibe: " + e.toString());
    return { success: false, message: e.message };
  }
}
