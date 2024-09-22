from fasthtml.common import *
import httpx
from starlette.requests import Request
import os
from groq import Groq
import asyncio
from httpx import AsyncClient, ReadTimeout, HTTPStatusError
import json

app, rt = fast_app()

# Set your API keys
GROQ_API_KEY = os.environ.get("GROQ_API_KEY")
IDEOGRAM_API_KEY = os.environ.get("IDEOGRAM_API_KEY")

# Add these checks to ensure API keys are set
if not GROQ_API_KEY:
    raise EnvironmentError("GROQ_API_KEY environment variable not set")
if not IDEOGRAM_API_KEY:
    raise EnvironmentError("IDEOGRAM_API_KEY environment variable not set")

# Initialize the Groq client
client = Groq(
    api_key=os.environ.get("GROQ_API_KEY")  # Ensure your API key is set
)

@rt('/', methods=['GET', 'POST'])
async def index(request: Request):
    if request.method == 'POST':
        form = await request.form()
        initial_prompt = form.get('initial_prompt', '')
        new_topic = form.get('new_topic', '')
        new_prompt = form.get('new_prompt', '')  # Get the potentially edited new prompt
        return json.dumps({
            'new_prompt': new_prompt,
            'message': 'Using provided prompt. Preparing to generate images...'
        })
    else:
        return Div(
            Style("""
                .container { max-width: 1600px; margin: 0 auto; padding: 20px; }
                .form-group { margin-bottom: 20px; }
                .form-group label { display: block; margin-bottom: 5px; font-size: 16px; }
                .form-group input, .form-group textarea, .button { 
                    width: 100%; 
                    padding: 8px; 
                    box-sizing: border-box; 
                    font-size: 14px;
                    font-family: Arial, sans-serif;
                }
                .initial-prompt, .new-prompt { height: 75px; } /* Adjusted height */
                .button { 
                    background-color: #4CAF50; 
                    color: white; 
                    border: none; 
                    cursor: pointer; 
                    font-size: 16px;
                    height: 40px;
                }
                .image-grid { 
                    display: grid; 
                    grid-template-columns: repeat(4, 1fr); 
                    gap: 20px;
                    margin-top: 20px;
                }
                .image-container { 
                    position: relative; 
                    width: 100%; 
                    padding-top: 56.25%;  /* 16:9 Aspect Ratio */
                    overflow: hidden; 
                }
                .image-container img { 
                    position: absolute; 
                    top: 0; 
                    left: 0; 
                    width: 100%; 
                    height: 100%; 
                    object-fit: contain; 
                    cursor: pointer; 
                }
                .modal { display: none; position: fixed; z-index: 1; left: 0; top: 0; width: 100%; height: 100%; overflow: auto; background-color: rgba(0,0,0,0.9); }
                .modal-content { margin: auto; display: block; width: 80%; max-width: 1400px; }
                .close { position: absolute; top: 15px; right: 35px; color: #f1f1f1; font-size: 40px; font-weight: bold; cursor: pointer; }
                .flex-container { 
                    display: flex; 
                    gap: 20px;
                    align-items: flex-end;
                }
                .flex-item { flex: 1; display: flex; flex-direction: column; }
                .flex-item > * { flex-grow: 1; }
                #new_topic { 
                    height: 80px;
                    resize: vertical; 
                    min-height: 80px;
                    max-height: 200px;
                }
                #new_prompt { 
                    height: 75px; /* Adjusted height */
                    width: 100%;
                    resize: vertical;
                }
                #num_images { 
                    width: 100px; 
                }
                .num-images-container {
                    display: flex;
                    align-items: flex-end;
                    gap: 10px;
                }
                .generate-button-container {
                    flex-shrink: 0;
                }
                #new_topic, #new_prompt, #num_images { 
                    font-size: 14px;
                    font-family: Arial, sans-serif;
                }
            """),
            Script(src="https://apis.google.com/js/api.js"),
            Script("""
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

                    const newTopicField = document.getElementById('new_topic');
                    newTopicField.focus();
                    newTopicField.select();
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
                        img.onclick = function() { openModal(this); };
                        imgContainer.appendChild(img);
                        imageGrid.appendChild(imgContainer);
                    });
                }

                async function generateImages() {
                    const newPrompt = document.getElementById('new_prompt').value;
                    const numImages = document.getElementById('num_images').value;
                    const statusElement = document.getElementById('status');
                    const imageGrid = document.getElementById('image-grid');
                    
                    statusElement.textContent = 'Generating images...';
                    imageGrid.innerHTML = '';
                    
                    const response = await fetch('/generate_images', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({prompt: newPrompt, num_images: numImages})
                    });
                    
                    const imageUrls = await response.json();
                    localStorage.setItem('savedImages', JSON.stringify(imageUrls));
                    
                    displaySavedImages(imageUrls);
                    
                    statusElement.textContent = `Generated ${imageUrls.length} images.`;
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
                        submitForm(new Event('submit'));
                    }
                }

                async function updateNewPrompt() {
                    const initialPrompt = document.getElementById('initial_prompt').value;
                    const newTopic = document.getElementById('new_topic').value;
                    const statusElement = document.getElementById('status');
                    
                    statusElement.textContent = 'Generating new prompt...';
                    
                    const response = await fetch('/get_new_prompt', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({initial_prompt: initialPrompt, new_topic: newTopic})
                    });
                    
                    const result = await response.json();
                    document.getElementById('new_prompt').value = result.new_prompt;
                    localStorage.setItem('newPrompt', result.new_prompt);
                    statusElement.textContent = '';
                }

                async function submitForm(event) {
                    event.preventDefault();
                    validateNumImages();
                    saveToLocalStorage();
                    const form = event.target.closest('form');
                    if (!form) return;
                    const formData = new FormData(form);
                    
                    const statusElement = document.getElementById('status');
                    statusElement.textContent = 'Preparing to generate images...';
                    
                    const response = await fetch('/', {
                        method: 'POST',
                        body: formData
                    });
                    
                    const result = await response.json();
                    statusElement.textContent = result.message;
                    
                    generateImages();
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
                    saveToLocalStorage();  // Save immediately after validation
                }

                window.onload = loadFromLocalStorage;
            """),
            Div(
                Form(
                    Div(
                        Label("Initial Prompt:", For="initial_prompt"),
                        Textarea(name='initial_prompt', id="initial_prompt", onkeypress="handleKeyPress(event)", Class="initial-prompt"),
                        Class="form-group"
                    ),
                    Div(
                        Div(
                            Label("New Topic:", For="new_topic"),
                            Textarea(name='new_topic', id="new_topic", rows="3", onkeypress="handleKeyPress(event)", oninput="onNewTopicInput()", onkeydown="onNewTopicKeyDown()"),
                            Class="flex-item"
                        ),
                        Div(
                            Label("Number of Images:", For="num_images"),
                            Div(
                                Input(type="number", name='num_images', id="num_images", value="4", min="1", max="100", onchange="validateNumImages()"),
                                Div(
                                    Button('Generate Images', type='submit', Class="button"),
                                    Class="generate-button-container"
                                ),
                                Class="num-images-container"
                            ),
                            Class="flex-item"
                        ),
                        Class="flex-container"
                    ),
                    Div(
                        Label("New Prompt:", For="new_prompt"),
                        Textarea(name='new_prompt', id="new_prompt", Class="new-prompt"),
                        Class="form-group"
                    ),
                    method='post',
                    onsubmit="submitForm(event)"
                ),
                P(id="status", style="font-weight: bold;"),
                Div(id="image-grid", Class="image-grid"),
                Class="container"
            ),
            Div(
                Span("×", Class="close", onclick="closeModal()"),
                Img(id="modalImage"),
                id="imageModal",
                Class="modal"
            )
        )

@rt('/get_new_prompt', methods=['POST'])
async def get_new_prompt_route(request: Request):
    data = await request.json()
    initial_prompt = data.get('initial_prompt', '')
    new_topic = data.get('new_topic', '')
    new_prompt = await get_new_prompt(initial_prompt, new_topic)
    return json.dumps({'new_prompt': new_prompt})

@rt('/generate_images', methods=['POST'])
async def generate_images_route(request: Request):
    data = await request.json()
    prompt = data.get('prompt', '')
    num_images = int(data.get('num_images', 4))
    image_urls = await generate_images(prompt, num_images)
    return json.dumps(image_urls)

async def get_new_prompt(initial_prompt, new_topic):
    try:
        messages = [
            {
                "role": "user",
                "content": "Create a prompt in the following style / structure, but make it about a different topic. Keep the style aspects EXACTLY the same! Anything inside {} is an instruction on how to vary the prompt, not part of the prompt itself, so don't include it.\n\n" + initial_prompt + "\n\nNew Topic: " + new_topic
            }
        ]
        response = client.chat.completions.create(
            messages=messages,
            model="llama-3.1-70b-versatile",
            max_tokens=1000,
            temperature=0.3
        )
        new_prompt = response.choices[0].message.content
        return new_prompt
    except Exception as e:
        print(f"Error generating new prompt: {e}")
        return f"Failed to generate new prompt about {new_topic}. Please try again."

async def generate_images(prompt, num_images):
    if not IDEOGRAM_API_KEY:
        raise EnvironmentError("IDEOGRAM_API_KEY environment variable not set")

    headers = {
        "Api-Key": IDEOGRAM_API_KEY,
        "Content-Type": "application/json"
    }
    data = {
        "image_request": {
            "prompt": prompt,
            "model": "V_2",
            "aspect_ratio": "ASPECT_16_9",  # This should match the CSS padding-top percentage
            "magic_prompt_option": "AUTO",
            "negative_prompt": "small text, chaotic, strange characters, nonsense, duplicate, ugly, mutation, disgusting, unrealistic",

            "color_palette": {
                "members": [
                    {
                        "color_hex": "#00205B",
                        "color_weight": 0.3
                    },
                    {
                        "color_hex": "#0053FF",
                        "color_weight": 0.2
                    },
                    {
                        "color_hex": "#B9CBD3",
                        "color_weight": 0.2
                    },
                    {
                        "color_hex": "#F1F1F1",
                        "color_weight": 0.15
                    },
                    {
                        "color_hex": "#97999B",
                        "color_weight": 0.15
                    },
                ]
            }
        }
    }
    
    async def generate_single_image():
        try:
            async with AsyncClient(timeout=30.0) as http_client:
                response = await http_client.post('https://api.ideogram.ai/generate', headers=headers, json=data)
                response.raise_for_status()
                response_json = response.json()
                
                print("API Response:", json.dumps(response_json, indent=2))
                
                images = response_json.get('data', [])
                if images and 'url' in images[0]:
                    return images[0]['url']
        except ReadTimeout:
            print("Request to Ideogram API timed out")
        except HTTPStatusError as http_err:
            print(f"HTTP error occurred: {http_err}")
        except Exception as e:
            print(f"An unexpected error occurred: {e}")
        return None

    # Generate specified number of images in parallel
    tasks = [generate_single_image() for _ in range(num_images)]
    image_urls = await asyncio.gather(*tasks)
    
    # Filter out None values (failed requests) and return unique URLs
    return list(dict.fromkeys(url for url in image_urls if url))

serve()