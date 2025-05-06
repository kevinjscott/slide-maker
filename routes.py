from fastapi import APIRouter, Request
from fastapi.templating import Jinja2Templates
import json  # Add this import
from utils import get_new_prompt, generate_images

router = APIRouter()
templates = Jinja2Templates(directory="templates")

@router.get('/')
@router.post('/')
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
        return templates.TemplateResponse("index.html", {"request": request})

@router.post('/get_new_prompt')
async def get_new_prompt_route(request: Request):
    data = await request.json()
    initial_prompt = data.get('initial_prompt', '')
    new_topic = data.get('new_topic', '')
    new_prompt = await get_new_prompt(initial_prompt, new_topic)
    return {'new_prompt': new_prompt}  # Return a dictionary instead of a JSON string

@router.post('/generate_images')
async def generate_images_route(request: Request):
    try:
        # Get the raw request body first to inspect it if needed
        raw_body = await request.body()
        body_text = raw_body.decode('utf-8')
        
        # Log raw request details for debugging
        content_length = len(body_text)
        print(f"[DEBUG] Received request body length: {content_length} bytes")
        if content_length > 0:
            print(f"[DEBUG] First 100 chars of request body: {body_text[:100]}...")
        else:
            print("[ERROR] Empty request body received")
            return {"error": "Empty request body received"}
            
        # Parse the JSON
        try:
            data = await request.json()
        except json.JSONDecodeError as e:
            print(f"[ERROR] JSON decode error: {str(e)}")
            return {"error": f"Invalid JSON in request: {str(e)}"}
        
        # Extract and validate the prompt
        prompt = data.get('prompt', '')
        if not isinstance(prompt, str):
            print(f"[ERROR] Prompt is not a string: {type(prompt)}")
            return {"error": "Prompt must be a string"}
            
        prompt = prompt.strip()
        print(f"[DEBUG] generate_images_route received - prompt (first 50 chars): '{prompt[:50]}...'")
        print(f"[DEBUG] Prompt length: {len(prompt)}")
        
        # Validate the prompt is not empty
        if not prompt or prompt == "..." or prompt == "Failed to generate new prompt":
            print("[ERROR] Empty or placeholder prompt received")
            return {"error": "Please provide a valid prompt for image generation."}
        
        # Get number of images
        try:
            num_images = int(data.get('num_images', 4))
            if num_images < 1 or num_images > 8:  # Adjusted to Ideogram API limits
                print(f"[WARNING] num_images out of range: {num_images}, clamping to 1-8")
                num_images = max(1, min(num_images, 8))
        except (ValueError, TypeError) as e:
            print(f"[ERROR] Invalid num_images value: {str(e)}")
            num_images = 4  # Default to 4 images
        
        # Generate the images
        print(f"[INFO] Calling generate_images with prompt length {len(prompt)} and num_images={num_images}")
        image_urls = await generate_images(prompt, num_images)
        
        if not image_urls:
            print("[WARNING] No image URLs were returned from generate_images")
            return {"error": "No images could be generated. Try a different prompt."}
            
        print(f"[INFO] Generated {len(image_urls)} image URLs")
        return image_urls
        
    except Exception as e:
        print(f"[ERROR] Unexpected error in generate_images_route: {str(e)}")
        import traceback
        traceback.print_exc()
        return {"error": f"An unexpected error occurred: {str(e)}"}