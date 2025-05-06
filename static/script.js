let typingTimer;
const doneTypingInterval = 300; // milliseconds

// Define the default Initial Prompt
const DEFAULT_INITIAL_PROMPT =
  'A flat 2d simple graphical illustration with a fun, ___ style containing {list items or describe the scene}. {if the image really needs supporting text...} Contains these large texts: "{list items if any, max 4 words each}" with the emphasis on "{one of the texts}".{end if}';

function loadFromLocalStorage() {
  const initialPrompt =
    localStorage.getItem("initialPrompt") || DEFAULT_INITIAL_PROMPT;
  const newTopic = localStorage.getItem("newTopic") || "";
  const newPrompt = localStorage.getItem("newPrompt") || "";
  const numImages = localStorage.getItem("numImages") || "4";
  const savedImages = JSON.parse(localStorage.getItem("savedImages")) || [];

  document.getElementById("initial_prompt").value = initialPrompt;
  document.getElementById("new_topic").value = newTopic;
  document.getElementById("new_prompt").value = newPrompt;
  document.getElementById("num_images").value = numImages;

  if (savedImages.length > 0) {
    displaySavedImages(savedImages);
  }

  // Set focus to the new_topic field and select its content
  const newTopicField = document.getElementById("new_topic");
  newTopicField.focus();
  newTopicField.select();

  // Add event listeners for initial prompt, new topic, and new prompt
  document
    .getElementById("initial_prompt")
    .addEventListener("input", onInputChange);
  document.getElementById("new_topic").addEventListener("input", onInputChange);
  document
    .getElementById("new_prompt")
    .addEventListener("keypress", handleKeyPress);

  // Add event listener for the reset button
  const resetButton = document.getElementById("reset-button");
  if (resetButton) {
    resetButton.addEventListener("click", resetToDefault);
  }
}

function saveToLocalStorage() {
  const initialPrompt = document.getElementById("initial_prompt").value;
  const newTopic = document.getElementById("new_topic").value;
  const newPrompt = document.getElementById("new_prompt").value;
  const numImages = document.getElementById("num_images").value;

  localStorage.setItem("initialPrompt", initialPrompt);
  localStorage.setItem("newTopic", newTopic);
  localStorage.setItem("newPrompt", newPrompt);
  localStorage.setItem("numImages", numImages);
}

function displaySavedImages(imageUrls) {
  const imageGrid = document.getElementById("image-grid");
  imageGrid.innerHTML = "";

  imageUrls.forEach((url) => {
    const imgContainer = document.createElement("div");
    imgContainer.className = "image-container";
    const img = document.createElement("img");
    img.src = url;
    img.onclick = function () {
      openModal(this.src);
    };
    imgContainer.appendChild(img);
    imageGrid.appendChild(imgContainer);
  });
}

async function generateImages(prompt, numImages) {
  const imageGrid = document.getElementById("image-grid");

  // Hide previous images
  imageGrid.innerHTML = "";

  console.log("[DEBUG] generateImages received:", {
    promptType: typeof prompt,
    promptLength: prompt ? prompt.length : 0,
    promptFirstChars: prompt ? prompt.substring(0, 50) : "N/A",
    numImages,
  });

  // Validate that we have an actual prompt
  if (
    !prompt ||
    typeof prompt !== "string" ||
    prompt.trim() === "" ||
    prompt.trim() === "..."
  ) {
    console.error("[ERROR] Invalid or empty prompt:", prompt);
    showStatus("Error: Cannot generate images with an empty prompt.");
    return;
  }

  // Ensure prompt is properly trimmed
  const cleanPrompt = prompt.trim();

  try {
    const requestBody = JSON.stringify({
      prompt: cleanPrompt,
      num_images: numImages,
    });

    console.log("[DEBUG] Request body length:", requestBody.length);
    console.log(
      "[DEBUG] Request body snippet:",
      requestBody.substring(0, 100) + "..."
    );

    showStatus(`Sending request to generate ${numImages} images...`);

    const response = await fetch("/generate_images", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: requestBody,
    });

    if (!response.ok) {
      throw new Error(`Server responded with status: ${response.status}`);
    }

    const responseText = await response.text();
    console.log(
      "[DEBUG] Raw response first 100 chars:",
      responseText.substring(0, 100) + "..."
    );

    // Check if response is empty
    if (!responseText.trim()) {
      throw new Error("Server returned an empty response");
    }

    const imageUrls = JSON.parse(responseText);
    console.log(
      "[DEBUG] Parsed image URLs count:",
      Array.isArray(imageUrls) ? imageUrls.length : "not an array"
    );

    if (Array.isArray(imageUrls)) {
      if (imageUrls.length > 0) {
        localStorage.setItem("savedImages", JSON.stringify(imageUrls));
        displaySavedImages(imageUrls);
        hideStatus();
        showStatus(`Successfully generated ${imageUrls.length} images.`);
        setTimeout(hideStatus, 3000); // Hide after 3 seconds
      } else {
        showStatus("No images were generated. Try a different prompt.");
      }
    } else if (imageUrls && imageUrls.error) {
      // Handle error response from server
      throw new Error(`Server error: ${imageUrls.error}`);
    } else {
      throw new Error("Server did not return an array of image URLs");
    }
  } catch (error) {
    console.error("[ERROR] Failed to generate images:", error);
    showStatus(`Failed to generate images: ${error.message}`);
  }
}

function onNewTopicInput() {
  clearTimeout(typingTimer);
  typingTimer = setTimeout(updateNewPrompt, doneTypingInterval);
}

function onNewTopicKeyDown() {
  clearTimeout(typingTimer);
}

function handleKeyPress(event) {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault(); // Prevent default form submission

    // Call submitForm directly instead of form.submit()
    // form.submit() bypasses the event listeners
    if (event.target.form) {
      submitForm(event);
    }
  }
}

async function updateNewPrompt() {
  const initialPrompt = document.getElementById("initial_prompt").value;
  const newTopic = document.getElementById("new_topic").value;

  showStatus("Generating new prompt...");

  try {
    const response = await fetch("/get_new_prompt", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        initial_prompt: initialPrompt,
        new_topic: newTopic,
      }),
    });

    const responseText = await response.text();
    console.log("Raw server response:", responseText);
    const result = JSON.parse(responseText);
    console.log("Parsed server response:", result);
    const newPromptElement = document.getElementById("new_prompt");
    newPromptElement.value = result.new_prompt;
    console.log("New prompt element value:", newPromptElement.value);
    localStorage.setItem("newPrompt", result.new_prompt);
    saveToLocalStorage();
    hideStatus();
  } catch (error) {
    console.error("Error updating new prompt:", error);
    showStatus("Failed to generate new prompt. Please try again.");
  }
}

async function submitForm(event) {
  event.preventDefault();
  validateNumImages();
  saveToLocalStorage();

  // Get the new prompt directly from the form and ensure it exists
  const newPromptElement = document.getElementById("new_prompt");

  if (!newPromptElement) {
    console.error("Cannot find new_prompt element");
    showStatus("Error: Form element not found.");
    return;
  }

  const newPrompt = newPromptElement.value.trim();

  // Log the exact content and length
  console.log(`[DEBUG] New prompt content: "${newPrompt}"`);
  console.log(`[DEBUG] New prompt length: ${newPrompt.length}`);

  // Validate the prompt is not empty
  if (
    !newPrompt ||
    newPrompt === "..." ||
    newPrompt === "Failed to generate new prompt"
  ) {
    console.error("Invalid or empty prompt detected:", newPrompt);
    showStatus(
      "Error: Please make sure you have a valid prompt before generating images."
    );
    return;
  }

  const numImages = document.getElementById("num_images").value;

  showStatus(
    `Generating ${numImages} images with prompt: "${newPrompt.substring(
      0,
      30
    )}..."`
  );

  try {
    // Call generateImages with the validated prompt
    await generateImages(newPrompt, numImages);
  } catch (error) {
    console.error("Error generating images:", error);
    showStatus("Failed to generate images. Please try again.");
  }
}

function validateNumImages() {
  const numImagesField = document.getElementById("num_images");
  let value = parseInt(numImagesField.value);
  if (isNaN(value) || value < 1) {
    value = 1;
  } else if (value > 100) {
    value = 100;
  }
  numImagesField.value = value;
  saveToLocalStorage();
}

function onInputChange() {
  clearTimeout(typingTimer);
  typingTimer = setTimeout(updateNewPrompt, doneTypingInterval);
}

window.addEventListener("load", loadFromLocalStorage);
document.addEventListener("DOMContentLoaded", () => {
  const form = document.querySelector("form");
  form.removeEventListener("submit", submitForm); // Ensure no duplicate event listeners
  form.addEventListener("submit", submitForm);

  // Add event listener for closing the modal
  const closeBtn = document.querySelector(".close");
  if (closeBtn) {
    closeBtn.addEventListener("click", closeModal);
  }

  // Add event listeners for keypress on all textarea elements
  const textareas = document.querySelectorAll("textarea");
  textareas.forEach((textarea) => {
    textarea.addEventListener("keypress", handleKeyPress);
  });
});

// Add these new functions for modal functionality
function openModal(imgSrc) {
  const modal = document.getElementById("imageModal");
  const modalImg = document.getElementById("modalImage");
  modal.style.display = "block";
  modalImg.src = imgSrc;
  // Add event listener for the Escape key
  document.addEventListener("keydown", closeModalOnEscape);
}

function closeModal() {
  const modal = document.getElementById("imageModal");
  modal.style.display = "none";
  // Remove event listener for the Escape key
  document.removeEventListener("keydown", closeModalOnEscape);
}

// Function to close modal on Escape key press
function closeModalOnEscape(event) {
  if (event.key === "Escape") {
    closeModal();
  }
}

// Close the modal when clicking outside the image
window.onclick = function (event) {
  const modal = document.getElementById("imageModal");
  if (event.target == modal) {
    closeModal();
  }
};

function showStatus(message) {
  let statusElement = document.getElementById("status");
  if (!statusElement) {
    statusElement = document.createElement("p");
    statusElement.id = "status";
    document.querySelector(".container").appendChild(statusElement);
  }
  statusElement.textContent = message;
  statusElement.style.display = "block";
}

function hideStatus() {
  const statusElement = document.getElementById("status");
  if (statusElement) {
    statusElement.style.display = "none";
  }
}

// Function to reset to default Initial Prompt
function resetToDefault() {
  localStorage.setItem("initialPrompt", DEFAULT_INITIAL_PROMPT);
  document.getElementById("initial_prompt").value = DEFAULT_INITIAL_PROMPT;
  saveToLocalStorage();
  showStatus("Initial Prompt has been reset to default.");
  updateNewPrompt(); // Trigger the generation of the new prompt
}
