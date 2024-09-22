let typingTimer;
const doneTypingInterval = 300; // milliseconds

function loadFromLocalStorage() {
    const initialPrompt = localStorage.getItem('initialPrompt') || '';
    const newTopic = localStorage.getItem('newTopic') || '';
    const newPrompt = localStorage.getItem('newPrompt') || '';
    const numImages = localStorage.getItem('numImages') || '4';
    const savedImages = JSON.parse(localStorage.getItem('savedImages')) || [];
    
    document.getElementById('initial_prompt').value = initialPrompt;
    document.getElementById('new_topic').value = newTopic;
    document.getElementById('new_prompt').value = newPrompt;
    document.getElementById('num_images').value = numImages;
    
    if (savedImages.length > 0) {
        displaySavedImages(savedImages);
    }

    // Set focus to the new_topic field and select its content
    const newTopicField = document.getElementById('new_topic');
    newTopicField.focus();
    newTopicField.select();

    // Add event listeners for initial prompt, new topic, and new prompt
    document.getElementById('initial_prompt').addEventListener('input', onInputChange);
    document.getElementById('new_topic').addEventListener('input', onInputChange);
    document.getElementById('new_prompt').addEventListener('keypress', handleKeyPress);
}

function saveToLocalStorage() {
    const initialPrompt = document.getElementById('initial_prompt').value;
    const newTopic = document.getElementById('new_topic').value;
    const newPrompt = document.getElementById('new_prompt').value;
    const numImages = document.getElementById('num_images').value;
    
    localStorage.setItem('initialPrompt', initialPrompt);
    localStorage.setItem('newTopic', newTopic);
    localStorage.setItem('newPrompt', newPrompt);
    localStorage.setItem('numImages', numImages);
}

function displaySavedImages(imageUrls) {
    const imageGrid = document.getElementById('image-grid');
    imageGrid.innerHTML = '';
    
    imageUrls.forEach(url => {
        const imgContainer = document.createElement('div');
        imgContainer.className = 'image-container';
        const img = document.createElement('img');
        img.src = url;
        img.onclick = function() { openModal(this.src); };
        imgContainer.appendChild(img);
        imageGrid.appendChild(imgContainer);
    });
}

async function generateImages() {
    const newPrompt = document.getElementById('new_prompt').value;
    const numImages = document.getElementById('num_images').value;
    const imageGrid = document.getElementById('image-grid');
    
    // Hide previous images
    imageGrid.innerHTML = '';
    
    showStatus('Generating images...');
    
    try {
        const response = await fetch('/generate_images', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({prompt: newPrompt, num_images: numImages})
        });
        
        const responseText = await response.text();
        console.log('Raw server response:', responseText);
        const imageUrls = JSON.parse(responseText);
        console.log('Parsed image URLs:', imageUrls);
        
        if (Array.isArray(imageUrls)) {
            localStorage.setItem('savedImages', JSON.stringify(imageUrls));
            displaySavedImages(imageUrls);
            hideStatus(); // Hide the status message after displaying images
        } else {
            throw new Error('Server did not return an array of image URLs');
        }
    } catch (error) {
        console.error('Error generating images:', error);
        showStatus('Failed to generate images. Please try again.');
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
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        submitForm(event);
    }
}

async function updateNewPrompt() {
    const initialPrompt = document.getElementById('initial_prompt').value;
    const newTopic = document.getElementById('new_topic').value;
    
    showStatus('Generating new prompt...');
    
    try {
        const response = await fetch('/get_new_prompt', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({initial_prompt: initialPrompt, new_topic: newTopic})
        });
        
        const responseText = await response.text();
        console.log('Raw server response:', responseText);
        const result = JSON.parse(responseText);
        console.log('Parsed server response:', result);
        const newPromptElement = document.getElementById('new_prompt');
        newPromptElement.value = result.new_prompt;
        console.log('New prompt element value:', newPromptElement.value);
        localStorage.setItem('newPrompt', result.new_prompt);
        saveToLocalStorage();
        hideStatus();
    } catch (error) {
        console.error('Error updating new prompt:', error);
        showStatus('Failed to generate new prompt. Please try again.');
    }
}

async function submitForm(event) {
    event.preventDefault();
    validateNumImages();
    saveToLocalStorage();
    const form = event.target.closest('form');
    if (!form) return;
    const formData = new FormData(form);
    
    showStatus('Preparing to generate images...');
    
    try {
        const response = await fetch('/', {
            method: 'POST',
            body: formData
        });
        
        const result = await response.json();
        showStatus(result.message);
        
        generateImages();
    } catch (error) {
        console.error('Error submitting form:', error);
        showStatus('Failed to submit form. Please try again.');
    }
}

function validateNumImages() {
    const numImagesField = document.getElementById('num_images');
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

window.addEventListener('load', loadFromLocalStorage);
document.addEventListener('DOMContentLoaded', () => {
    const form = document.querySelector('form');
    form.addEventListener('submit', submitForm);
    
    // Add event listener for closing the modal
    const closeBtn = document.querySelector('.close');
    if (closeBtn) {
        closeBtn.addEventListener('click', closeModal);
    }

    // Add event listeners for keypress on all textarea elements
    const textareas = document.querySelectorAll('textarea');
    textareas.forEach(textarea => {
        textarea.addEventListener('keypress', handleKeyPress);
    });
});

// Add these new functions for modal functionality
function openModal(imgSrc) {
    const modal = document.getElementById('imageModal');
    const modalImg = document.getElementById('modalImage');
    modal.style.display = "block";
    modalImg.src = imgSrc;
    // Add event listener for the Escape key
    document.addEventListener('keydown', closeModalOnEscape);
}

function closeModal() {
    const modal = document.getElementById('imageModal');
    modal.style.display = "none";
    // Remove event listener for the Escape key
    document.removeEventListener('keydown', closeModalOnEscape);
}

// Function to close modal on Escape key press
function closeModalOnEscape(event) {
    if (event.key === "Escape") {
        closeModal();
    }
}

// Close the modal when clicking outside the image
window.onclick = function(event) {
    const modal = document.getElementById('imageModal');
    if (event.target == modal) {
        closeModal();
    }
}

function showStatus(message) {
    let statusElement = document.getElementById('status');
    if (!statusElement) {
        statusElement = document.createElement('p');
        statusElement.id = 'status';
        document.querySelector('.container').appendChild(statusElement);
    }
    statusElement.textContent = message;
    statusElement.style.display = 'block';
}

function hideStatus() {
    const statusElement = document.getElementById('status');
    if (statusElement) {
        statusElement.style.display = 'none';
    }
}