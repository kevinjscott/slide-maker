import os
import json  # Add this import
from groq import Groq
from httpx import AsyncClient, ReadTimeout, HTTPStatusError
import asyncio

GROQ_API_KEY = os.environ.get("GROQ_API_KEY")
IDEOGRAM_API_KEY = os.environ.get("IDEOGRAM_API_KEY")

client = Groq(
    api_key=GROQ_API_KEY  # Ensure your API key is set
)

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
            "aspect_ratio": "ASPECT_16_9",
            "magic_prompt_option": "AUTO",
            "negative_prompt": "small text, chaotic, strange characters, nonsense, duplicate, ugly, mutation, disgusting, unrealistic",
            "color_palette": {
                "members": [
                    {"color_hex": "#00205B", "color_weight": 0.3},
                    {"color_hex": "#0053FF", "color_weight": 0.2},
                    {"color_hex": "#B9CBD3", "color_weight": 0.2},
                    {"color_hex": "#F1F1F1", "color_weight": 0.15},
                    {"color_hex": "#97999B", "color_weight": 0.15},
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
                else:
                    print("No image URL found in API response")
        except ReadTimeout:
            print("Request to Ideogram API timed out")
        except HTTPStatusError as http_err:
            print(f"HTTP error occurred: {http_err}")
        except Exception as e:
            print(f"An unexpected error occurred: {e}")
        return None

    print(f"Generating {num_images} images for prompt: {prompt}")
    tasks = [generate_single_image() for _ in range(num_images)]
    image_urls = await asyncio.gather(*tasks)
    
    print(f"Generated image URLs: {image_urls}")
    result = list(dict.fromkeys(url for url in image_urls if url))
    print(f"Filtered image URLs: {result}")
    return result