from fastapi import FastAPI
from starlette.requests import Request
from fastapi.staticfiles import StaticFiles
import os
from groq import Groq
from routes import router
from fastapi.templating import Jinja2Templates

app = FastAPI()

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
    api_key=GROQ_API_KEY  # Ensure your API key is set
)

# Mount the static files directory
app.mount("/static", StaticFiles(directory="static"), name="static")

app.include_router(router)

def run():
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)

if __name__ == "__main__":
    run()