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
    data = await request.json()
    prompt = data.get('prompt', '')
    num_images = int(data.get('num_images', 4))
    image_urls = await generate_images(prompt, num_images)
    return image_urls  # Return the list directly, FastAPI will handle the JSON conversion