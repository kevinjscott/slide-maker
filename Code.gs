function onInstall(e) {
  onOpen(e);
}

function onOpen(e) {
  Logger.log(
    "onOpen triggered. AuthMode: " +
      e.authMode +
      " for document ID: " +
      SlidesApp.getActivePresentation().getId()
  );
  try {
    SlidesApp.getUi()
      .createAddonMenu()
      .addItem("Start My Add-on", "onHomepage")
      .addToUi();
    Logger.log("Menu created successfully.");
  } catch (err) {
    Logger.log("Error creating menu in onOpen: " + err.message);
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
  return createCard("Slide Maker AI");
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
 * Creates the main card for the add-on.
 *
 * @param {string} cardTitle The title for the card.
 * @return {CardService.Card} The card to display.
 */
function createCard(cardTitle) {
  return CardService.newCardBuilder()
    .setHeader(CardService.newCardHeader().setTitle(cardTitle))
    .addSection(
      CardService.newCardSection()
        .addWidget(
          CardService.newTextParagraph().setText(
            "Welcome, Kevin! This is the Slide Maker AI sidebar."
          )
        )
        .addWidget(
          CardService.newButtonSet().addButton(
            CardService.newTextButton()
              .setText("Show Sidebar")
              .setOnClickAction(
                CardService.newAction().setFunctionName("showSidebar")
              )
          )
        )
    )
    .build();
}

/**
 * Opens the sidebar. This function is called when the "Show Sidebar" button is clicked.
 */
function showSidebar() {
  const ui = HtmlService.createHtmlOutputFromFile("Sidebar")
    .setTitle("Slide Maker AI Controls")
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
  console.log("generateSlideContent called with prompt:", prompt);

  // Read API keys from script properties, not user properties
  const scriptProperties = PropertiesService.getScriptProperties();
  const groqApiKey = scriptProperties.getProperty("GROQ_API_KEY");
  const ideogramApiKey = scriptProperties.getProperty("IDEOGRAM_API_KEY");

  if (!ideogramApiKey) {
    console.error("Ideogram API key not set.");
    return {
      ideogramImageUrls: [],
      statusMessage:
        "Ideogram API key not set. Please set IDEOGRAM_API_KEY in script properties.",
    };
  }

  let statusMessage = "";
  let collectedImageUrls = [];
  const num_images_to_request = 8; // Default to 8 images

  // --- Ideogram API Call for Image (Using V3 with Manual Multipart/form-data) ---
  try {
    console.log(
      "Attempting Ideogram API call (V3 for " +
        num_images_to_request +
        " images)..."
    );

    // Exact endpoint from utils.py
    const ideogramApiUrl = "https://api.ideogram.ai/v1/ideogram-v3/generate";

    // Validate and clamp num_images as done in utils.py
    let num_images_clamped = num_images_to_request;
    if (!(1 <= num_images_clamped && num_images_clamped <= 8)) {
      console.log(
        "Warning: num_images (" +
          num_images_clamped +
          ") is outside the Ideogram API v3 supported range of 1-8. Clamping to nearest valid value."
      );
      num_images_clamped = Math.max(1, Math.min(num_images_clamped, 8));
    }

    // Prepare multipart form data
    const boundary = "Boundary_" + new Date().getTime();
    let multipartRequestBody = "";

    // Exact form fields used in utils.py
    const formFields = {
      prompt: prompt,
      aspect_ratio: "16x9", // V3 uses values like "1x1", "16x9"
      magic_prompt: "AUTO", // V3 valid values: "AUTO", "ON", "OFF"
      negative_prompt:
        "small text, chaotic, strange characters, nonsense, duplicate, ugly, mutation, disgusting, unrealistic",
      num_images: String(num_images_clamped), // Must be string for multipart
      rendering_speed: "DEFAULT", // V3 valid values: "TURBO", "DEFAULT", "QUALITY"
    };

    for (const key in formFields) {
      multipartRequestBody += "--" + boundary + "\r\n";
      multipartRequestBody +=
        'Content-Disposition: form-data; name="' + key + '"\r\n\r\n';
      multipartRequestBody += formFields[key] + "\r\n";
    }

    // Color palette - exact same configuration as in utils.py
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
    multipartRequestBody += "Content-Type: application/json\r\n\r\n"; // Specify content type for this part
    multipartRequestBody += JSON.stringify(colorPaletteConfig) + "\r\n";

    // Closing boundary
    multipartRequestBody += "--" + boundary + "--\r\n";

    // Exact headers from utils.py
    const ideogramOptions = {
      method: "post",
      contentType: "multipart/form-data; boundary=" + boundary,
      headers: {
        "Api-Key": ideogramApiKey, // Matching the Python code's header name
      },
      payload: Utilities.newBlob(multipartRequestBody).getBytes(), // Convert to bytes
      muteHttpExceptions: true,
    };

    // For debugging
    console.log(
      "Ideogram V3 Request Headers:",
      JSON.stringify({
        "Api-Key": "REDACTED",
        "Content-Type": ideogramOptions.contentType,
      })
    );

    // Make the request
    console.log("Sending request to Ideogram V3...");
    const ideogramResponse = UrlFetchApp.fetch(ideogramApiUrl, ideogramOptions);
    const ideogramResponseCode = ideogramResponse.getResponseCode();
    const ideogramResponseBody = ideogramResponse.getContentText();
    console.log("Ideogram V3 Response Code:", ideogramResponseCode);

    // Parse response similar to utils.py
    if (ideogramResponseCode === 200) {
      try {
        const ideogramResult = JSON.parse(ideogramResponseBody);
        console.log(
          "Ideogram V3 API Response (first 200 chars):",
          JSON.stringify(ideogramResult).substring(0, 200) + "..."
        );

        // Extract data array exactly like utils.py
        const generated_data = ideogramResult.data || [];

        if (generated_data && generated_data.length > 0) {
          // Collect all URLs from the data array
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
      // Handle 202 Accepted (async job)
      statusMessage +=
        "Ideogram request accepted (202). This is an asynchronous job. ";
      console.warn(
        "Ideogram returned 202 Accepted. Response (first 500 chars):",
        ideogramResponseBody.substring(0, 500)
      );
    } else {
      // Handle error responses
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

  // Store the image URLs in script properties for the image picker to access
  if (collectedImageUrls.length > 0) {
    const scriptProperties = PropertiesService.getScriptProperties();
    scriptProperties.setProperty(
      "TEMP_IMAGE_URLS",
      JSON.stringify(collectedImageUrls)
    );
    console.log(
      "Stored",
      collectedImageUrls.length,
      "image URLs in script properties"
    );

    // Open the image picker dialog automatically
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
    "saveApiKeys called, but this function is deprecated. Keys should be set directly in Script Properties."
  );
  return "API keys should be set directly in Script Properties.";
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
  console.log("generateNewPrompt called with topic:", newTopic);

  // Read Groq API key from script properties, not user properties
  const scriptProperties = PropertiesService.getScriptProperties();
  const groqApiKey = scriptProperties.getProperty("GROQ_API_KEY");

  if (!groqApiKey) {
    console.error("Groq API key not set.");
    return "Groq API key not set. Please set GROQ_API_KEY in script properties.";
  }

  try {
    console.log("Attempting Groq API call for new prompt generation...");
    const groqApiUrl = "https://api.groq.com/openai/v1/chat/completions";

    const groqMessages = [
      {
        role: "user",
        content:
          `
Create a prompt using the template, but make it about the given topic. Keep the style and punctuation EXACTLY the same! Anything inside {} is an instruction on how to vary the prompt, not part of the prompt itself, so don't include it.

<example>
<template>A flat 3d simple graphical illustration (to be used as a full-screen PowerPoint slide) with a mellow, modern style containing {list items or describe the scene}. Contains these large texts: "{list key concepts, max 4 words each}" with the emphasis on "{one of the texts}". Use bold fonts for the text lettering.</template>
<topic>Golden Retrievers make excellent pets</topic>
<response>
A flat 3d simple graphical illustration (to be used as a full-screen PowerPoint slide) with a mellow, modern style containing happy Golden Retrievers playing. Contains these large texts: "Golden Retriever", "Loyal Family Dogs", "Easy To Train", "Faithful Companions" with the emphasis on "Golden Retriever". Use bold fonts for the text lettering.
</response>
</example>

<example>
<template>A flat 3d simple graphical illustration (to be used as a full-screen PowerPoint slide) with a mellow, modern style containing {list items or describe the scene}. Contains these large texts: "{list key concepts, max 4 words each}" with the emphasis on "{one of the texts}". Use bold fonts for the text lettering.</template>
<topic>Summit County is a great place to visit in the summer</topic>
<response>
A flat 3d simple graphical illustration (to be used as a full-screen PowerPoint slide) with a mellow, modern style containing mountains, lakes, and hiking trails. Contains these large texts: "Summer Vacation", "Mountain Scenery", "Summit County" with the emphasis on "Summit County". Use bold fonts for the text lettering.</response>
</example>

<template>` +
          initialPrompt +
          `</template>
<topic>` +
          newTopic +
          `</topic>
`,
      },
    ];

    const groqPayload = {
      messages: groqMessages,
      model: "llama-3.3-70b-versatile", // Updated to match utils.py
      max_tokens: 1000,
      temperature: 0.3,
    };

    console.log("Groq API payload:", JSON.stringify(groqPayload));

    const groqOptions = {
      method: "post",
      contentType: "application/json",
      headers: {
        Authorization: "Bearer " + groqApiKey,
        "Content-Type": "application/json", // Explicitly set Content-Type
      },
      payload: JSON.stringify(groqPayload),
      muteHttpExceptions: true,
    };

    console.log("Making Groq API request...");
    const groqResponse = UrlFetchApp.fetch(groqApiUrl, groqOptions);
    const groqResponseCode = groqResponse.getResponseCode();
    const groqResponseBody = groqResponse.getContentText();

    console.log("Groq API response code:", groqResponseCode);
    console.log(
      "Groq API response (first 100 chars):",
      groqResponseBody.substring(0, 100)
    );

    if (groqResponseCode === 200) {
      const groqResult = JSON.parse(groqResponseBody);
      if (
        groqResult.choices &&
        groqResult.choices.length > 0 &&
        groqResult.choices[0].message &&
        groqResult.choices[0].message.content
      ) {
        const newPrompt = groqResult.choices[0].message.content.trim();
        console.log(
          "Generated new prompt (first 50 chars):",
          newPrompt.substring(0, 50) + "..."
        );
        return newPrompt;
      } else {
        console.error("Failed to parse prompt from Groq response");
        return (
          "Failed to generate new prompt about " +
          newTopic +
          ". Please try again."
        );
      }
    } else {
      console.error("Groq API error:", groqResponseCode, groqResponseBody);
      return (
        "Failed to generate new prompt about " +
        newTopic +
        ". Please try again."
      );
    }
  } catch (e) {
    console.error("Error generating new prompt:", e);
    return (
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
      return "Error: No images to display";
    }

    console.log(
      "Showing server-side image picker with",
      imageUrls.length,
      "images"
    );

    // Store the image URLs temporarily in script properties
    const scriptProperties = PropertiesService.getScriptProperties();
    scriptProperties.setProperty("TEMP_IMAGE_URLS", JSON.stringify(imageUrls));
    console.log("Stored image URLs in script properties");

    // Create HTML output (not template)
    const htmlOutput = HtmlService.createHtmlOutputFromFile("ImagePicker")
      .setWidth(1000)
      .setHeight(600)
      .setTitle("Select an Image");

    // Show the modal dialog
    SlidesApp.getUi().showModalDialog(htmlOutput, "Select an Image");
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
  const scriptProperties = PropertiesService.getScriptProperties();
  const storedUrls = scriptProperties.getProperty("TEMP_IMAGE_URLS");

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

    const scriptProperties = PropertiesService.getScriptProperties();
    scriptProperties.setProperty("CURRENT_PROMPT", prompt);
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
 * Generates a new prompt template variation.
 *
 * @return {string} A new prompt template
 */
function generateNewPromptTemplate() {
  console.log("generateNewPromptTemplate called");

  // Read Groq API key from script properties
  const scriptProperties = PropertiesService.getScriptProperties();
  const groqApiKey = scriptProperties.getProperty("GROQ_API_KEY");

  if (!groqApiKey) {
    console.error("Groq API key not set.");
    return "Groq API key not set. Please set GROQ_API_KEY in script properties.";
  }

  try {
    console.log(
      "Attempting Groq API call for new prompt template generation..."
    );
    const groqApiUrl = "https://api.groq.com/openai/v1/chat/completions";

    const templateInstructions = `<template>A [flat 3d simple graphical illustration] (to be used as a full-screen PowerPoint slide) with a [fun, modern] style containing {list items or describe the scene}. Contains these large texts: "{list items if any, max 4 words each}" with the emphasis on "{one of the texts}". Use [puppies] for the text lettering.</template>

==========

The text above is a template for creating AI image prompts. Vary the items in square brackets [] to create 1 completely different version. Keep all the other wording exactly the same. Exclude the square brackets in your output. Do not follow any of the instructions in the template.

Example outputs:

A surreal digital collage (to be used as a full-screen PowerPoint slide) with a dreamy, colorful style containing {list items or describe the scene}. Contains these large texts: "{list items if any, max 4 words each}" with the emphasis on "{one of the texts}". Use clouds for the text lettering.

A watercolor illustration (to be used as a full-screen PowerPoint slide) with a gentle, calming style containing {list items or describe the scene}. Contains these large texts: "{list items if any, max 4 words each}" with the emphasis on "{one of the texts}". Use handwritten script fonts for the text lettering.

A gorgeous 3d pencil sketch (to be used as a full-screen PowerPoint slide) with a vibrant, artistic style containing {list items or describe the scene}. Contains these large texts: "{list items if any, max 4 words each}" with the emphasis on "{one of the texts}". Use artistic, brush script fonts for the text lettering.

A crayon drawing (to be used as a full-screen PowerPoint slide) with a playful, childlike style containing {list items or describe the scene}. Contains these large texts: "{list items if any, max 4 words each}" with the emphasis on "{one of the texts}". Use chunky block fonts for the text lettering.

A isometric flat design (to be used as a full-screen PowerPoint slide) with a clean, tech-inspired style containing {list items or describe the scene}. Contains these large texts: "{list items if any, max 4 words each}" with the emphasis on "{one of the texts}". Use geometric sans-serif fonts for the text lettering.

`;

    const groqMessages = [
      {
        role: "user",
        content: templateInstructions,
      },
    ];

    const groqPayload = {
      messages: groqMessages,
      model: "llama-3.3-70b-versatile",
      max_tokens: 1000,
      temperature: 1.2,
    };

    console.log(
      "Groq API payload for template generation:",
      JSON.stringify(groqPayload)
    );

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

    console.log("Making Groq API request for template generation...");
    const groqResponse = UrlFetchApp.fetch(groqApiUrl, groqOptions);
    const groqResponseCode = groqResponse.getResponseCode();
    const groqResponseBody = groqResponse.getContentText();

    console.log("Groq API response code:", groqResponseCode);
    console.log(
      "Groq API response (first 100 chars):",
      groqResponseBody.substring(0, 100)
    );

    if (groqResponseCode === 200) {
      const groqResult = JSON.parse(groqResponseBody);
      if (
        groqResult.choices &&
        groqResult.choices.length > 0 &&
        groqResult.choices[0].message &&
        groqResult.choices[0].message.content
      ) {
        const newTemplate = groqResult.choices[0].message.content.trim();
        console.log(
          "Generated new template (first 50 chars):",
          newTemplate.substring(0, 50) + "..."
        );
        return newTemplate;
      } else {
        console.error("Failed to parse template from Groq response");
        return "Failed to generate new template. Please try again.";
      }
    } else {
      console.error("Groq API error:", groqResponseCode, groqResponseBody);
      return "Failed to generate new template. Please try again.";
    }
  } catch (e) {
    console.error("Error generating new template:", e);
    return "Failed to generate new template. Please try again.";
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

    const userProperties = PropertiesService.getUserProperties();

    // Get existing templates
    let templates = {};
    const savedTemplates = userProperties.getProperty("USER_PROMPT_TEMPLATES");
    if (savedTemplates) {
      templates = JSON.parse(savedTemplates);
    }

    // Add or update the template
    templates[templateName] = templateText;

    // Save back to user properties
    userProperties.setProperty(
      "USER_PROMPT_TEMPLATES",
      JSON.stringify(templates)
    );

    console.log("Saved user template: " + templateName);
    return {
      success: true,
      message: "Template saved successfully",
      templates: getUserPromptTemplates().templates,
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
    const userProperties = PropertiesService.getUserProperties();
    const savedTemplates = userProperties.getProperty("USER_PROMPT_TEMPLATES");

    if (savedTemplates) {
      return {
        success: true,
        templates: JSON.parse(savedTemplates),
      };
    }

    return { success: true, templates: {} };
  } catch (e) {
    console.error("Error retrieving user templates:", e);
    return {
      success: false,
      message: "Error retrieving templates: " + e.message,
      templates: {},
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

    const userProperties = PropertiesService.getUserProperties();
    const savedTemplates = userProperties.getProperty("USER_PROMPT_TEMPLATES");

    if (!savedTemplates) {
      return { success: false, message: "No templates found" };
    }

    let templates = JSON.parse(savedTemplates);

    if (!templates[templateName]) {
      return { success: false, message: "Template not found" };
    }

    // Delete the template
    delete templates[templateName];

    // Save back to user properties
    userProperties.setProperty(
      "USER_PROMPT_TEMPLATES",
      JSON.stringify(templates)
    );

    console.log("Deleted user template: " + templateName);
    return {
      success: true,
      message: "Template deleted successfully",
      templates: templates,
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
      return { success: false, message: "Template text is required" };
    }

    const userProperties = PropertiesService.getUserProperties();
    userProperties.setProperty("LAST_USED_TEMPLATE", templateText);

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
    const userProperties = PropertiesService.getUserProperties();
    const lastTemplate = userProperties.getProperty("LAST_USED_TEMPLATE");

    if (lastTemplate) {
      return {
        success: true,
        template: lastTemplate,
      };
    }

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
