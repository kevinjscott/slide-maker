# Image Generation Web App

This project is a web application that allows users to generate images based on a given prompt. The application uses the Groq API for prompt generation and the Ideogram API for image generation.

## Features

- Generate new prompts based on an initial prompt and a new topic.
- Generate images based on the new prompt.
- Save and display generated images.
- Store form data and generated images in local storage.

## Requirements

- Python 3.7+
- FastAPI
- httpx
- starlette
- groq

## Setup

1. Clone the repository:
    ```sh
    git clone https://github.com/yourusername/your-repo.git
    cd your-repo
    ```

2. Create a virtual environment and activate it:
    ```sh
    python -m venv venv
    source venv/bin/activate  # On Windows use `venv\Scripts\activate`
    ```

3. Install the required packages:
    ```sh
    pip install -r requirements.txt
    ```

4. Set up your environment variables. You need to set `GROQ_API_KEY` and `IDEOGRAM_API_KEY` in your environment. You can do this by adding the following lines to your `.zshrc` or `.bashrc` file:
    ```sh
    export GROQ_API_KEY='your_groq_api_key'
    export IDEOGRAM_API_KEY='your_ideogram_api_key'
    ```

5. Run the application:
    ```sh
    python main.py
    ```

## Usage

1. Open your web browser and go to `http://127.0.0.1:8000`.
2. Enter an initial prompt and a new topic.
3. Click "Generate Images" to generate new prompts and images.
4. The generated images will be displayed on the page.

## File Structure

- `main.py`: The main application file.
- `.gitignore`: Specifies files and directories to be ignored by git.
- `.sesskey`: Session key file (should be ignored by git).
- `/Users/kevinjscott/.zshrc`: Shell configuration file (should be ignored by git).

## Contributing

1. Fork the repository.
2. Create a new branch (`git checkout -b feature-branch`).
3. Make your changes.
4. Commit your changes (`git commit -am 'Add new feature'`).
5. Push to the branch (`git push origin feature-branch`).
6. Create a new Pull Request.

## License

This project is licensed under the MIT License. See the `LICENSE` file for more details.