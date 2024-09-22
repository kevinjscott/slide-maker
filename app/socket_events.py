from flask_socketio import emit
from app import socketio

@socketio.on('generate_images')
def handle_generate_images(data):
    # Here you would implement your image generation logic
    # For now, we'll just echo back the received data
    emit('images_generated', {'images': ['placeholder_image_url.jpg']})

@socketio.on('reset_prompt')
def handle_reset_prompt():
    # Implement logic to reset the prompt
    default_prompt = "A flat 2d simple graphical illustration with a fun, ___ style containing {list items or describe the scene}. {if the image really needs supporting text...} Contains these large texts: \"{list items if any, max 4 words each}\" with the emphasis on \"{one of the texts}\".(end if)"
    emit('prompt_reset', {'default_prompt': default_prompt})