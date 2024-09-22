const socket = io();

document.getElementById('generate-form').addEventListener('submit', function(event) {
    event.preventDefault(); // Prevent the default form submission
    const formData = new FormData(this);
    const data = Object.fromEntries(formData);
    socket.emit('generate_images', data);
});

document.getElementById('reset-button').addEventListener('click', function() {
    socket.emit('reset_prompt');
});

socket.on('images_generated', function(data) {
    const imageGrid = document.getElementById('image-grid');
    imageGrid.innerHTML = '';
    data.images.forEach(imageUrl => {
        const img = document.createElement('img');
        img.src = imageUrl;
        imageGrid.appendChild(img);
    });
});

socket.on('prompt_reset', function(data) {
    document.getElementById('initial_prompt').value = data.default_prompt;
});

// ... (keep other existing JavaScript functions) ...