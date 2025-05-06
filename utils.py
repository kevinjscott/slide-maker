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
            model="llama-3.3-70b-versatile",
            max_tokens=1000,
            temperature=0.3
        )
        new_prompt = response.choices[0].message.content
        return new_prompt
    except Exception as e:
        print(f"Error generating new prompt: {e}")
        return f"Failed to generate new prompt about {new_topic}. Please try again."

async def generate_images(prompt: str, num_images: int):
    if not IDEOGRAM_API_KEY:
        raise EnvironmentError("IDEOGRAM_API_KEY environment variable not set")

    # Validate and clamp num_images to the API's supported range (1-8)
    if not (1 <= num_images <= 8):
        print(f"Warning: num_images ({num_images}) is outside the Ideogram API v3 supported range of 1-8. Clamping to nearest valid value.")
        num_images = max(1, min(num_images, 8))

    # Prepare data for multipart/form-data using the 'files' parameter structure for httpx
    # Each form field "key: value" becomes "key: (None, str(value))"
    multipart_payload = {
        "prompt": (None, prompt),
        "aspect_ratio": (None, "16x9"),  # V3 uses values like "1x1", "16x9"
        "magic_prompt": (None, "AUTO"),  # V3 valid values: "AUTO", "ON", "OFF"
        "negative_prompt": (None, "small text, chaotic, strange characters, nonsense, duplicate, ugly, mutation, disgusting, unrealistic"),
        "num_images": (None, str(num_images)), # Must be a string for multipart
        "rendering_speed": (None, "DEFAULT"), # V3 valid values: "TURBO", "DEFAULT", "QUALITY"
    }

    # Color palette is an object, send as a JSON string in multipart
    color_palette_config = {
        "members": [
            {"color_hex": "#00205B", "color_weight": 0.3},
            {"color_hex": "#0053FF", "color_weight": 0.2},
            {"color_hex": "#B9CBD3", "color_weight": 0.2},
            {"color_hex": "#F1F1F1", "color_weight": 0.15},
            {"color_hex": "#97999B", "color_weight": 0.15},
        ]
    }
    multipart_payload["color_palette"] = (None, json.dumps(color_palette_config))

    headers = {
        "Api-Key": IDEOGRAM_API_KEY,
        # Content-Type will be set to multipart/form-data by httpx when 'files' is used
    }

    image_urls = []
    print(f"Generating {num_images} images for prompt (first 50 chars): '{prompt[:50]}...'")
    # To avoid printing potentially very long prompts or complex objects directly:
    # print(f"Request payload fields (excluding color_palette object): {{key: val[1] for key, val in multipart_payload.items() if key != 'color_palette'}}")


    try:
        async with AsyncClient(timeout=90.0) as http_client:  # Increased timeout
            response = await http_client.post(
                'https://api.ideogram.ai/v1/ideogram-v3/generate',
                headers=headers,
                files=multipart_payload  # Use 'files' to send as multipart/form-data
            )
            response.raise_for_status()  # Raises HTTPStatusError for 4xx/5xx responses
            response_json = response.json()
            
            print("API Response (first 200 chars):", json.dumps(response_json, indent=2)[:200] + "...")
            
            generated_data = response_json.get('data', [])
            if generated_data:
                for item in generated_data:
                    if 'url' in item:
                        image_urls.append(item['url'])
                    else:
                        print(f"Warning: No 'url' found in image item: {item}")
            else:
                print("Warning: No 'data' array found or 'data' array is empty in API response.")

    except ReadTimeout:
        print(f"Error: Request to Ideogram API timed out after 90 seconds for prompt (first 50 chars): '{prompt[:50]}...'")
    except HTTPStatusError as http_err:
        error_message = f"Error: HTTP error occurred: {http_err.response.status_code} - {http_err.response.reason_phrase} for prompt (first 50 chars): '{prompt[:50]}...'"
        try:
            error_details = http_err.response.json()
            error_message += f"\nAPI Error Details: {json.dumps(error_details, indent=2)}"
        except json.JSONDecodeError:
            error_message += f"\nResponse content (non-JSON): {http_err.response.text}"
        print(error_message)
    except json.JSONDecodeError as json_err:
        response_text = "Response text not available"
        if 'response' in locals() and hasattr(response, 'text'):
            response_text = response.text[:500] + "..." # Log only a snippet
        print(f"Error: Failed to decode JSON response: {json_err}. Response text snippet: {response_text}")
    except Exception as e:
        print(f"An unexpected error occurred ({e.__class__.__name__}): {e} for prompt (first 50 chars): '{prompt[:50]}...'")
    
    print(f"Generated {len(image_urls)} image URLs.")
    return image_urls