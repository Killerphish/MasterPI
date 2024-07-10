document.addEventListener("DOMContentLoaded", function() {
    fetch('/get_settings')
        .then(response => response.json())
        .then(data => {
            document.getElementById('deviceName').textContent = data.device_name;
        })
        .catch(error => {
            console.error('Error fetching settings:', error);
        });
});