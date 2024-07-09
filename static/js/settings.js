document.addEventListener("DOMContentLoaded", function() {
    const form = document.getElementById('settingsForm');

    form.addEventListener('submit', function(event) {
        event.preventDefault();
        const formData = new FormData(form);

        fetch('/save_settings', {
            method: 'POST',
            body: formData
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                alert('Settings saved successfully!');
            } else {
                alert('Failed to save settings.');
            }
        });
    });

    document.getElementById('pid_autotune').addEventListener('click', function(event) {
        event.preventDefault();
        fetch('/pid_autotune', {
            method: 'POST'
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                alert('PID Autotune started! Waiting for completion...');
                checkAutotuneStatus();  // Call function to check autotune status
            } else {
                alert('Failed to start PID Autotune.');
            }
        });
    });

    function checkAutotuneStatus() {
        fetch('/autotune_status')
            .then(response => {
                if (!response.ok) {
                    throw new Error('Network response was not ok ' + response.statusText);
                }
                return response.json();
            })
            .then(data => {
                if (data.success) {
                    // Display autotune results to the user
                    const results = data.results;
                    alert(`PID Autotune completed successfully:\nKp: ${results.Kp}, Ki: ${results.Ki}, Kd: ${results.Kd}`);
                } else {
                    // Autotune failed or in progress, continue checking
                    setTimeout(checkAutotuneStatus, 3000); // Check again after 3 seconds
                }
            })
            .catch(error => {
                console.error('Error checking autotune status:', error);
            });
    }

    function fetchStatus() {
        fetch('/get_status')
            .then(response => {
                if (!response.ok) {
                    throw new Error('Network response was not ok ' + response.statusText);
                }
                return response.json();
            })
            .then(data => {
                document.getElementById('current-temp').textContent = data.temperature.toFixed(2) + ' °C';
                document.getElementById('fan-status').textContent = data.fan_on ? 'On' : 'Off';
            })
            .catch(error => {
                console.error('Error fetching status:', error);
            });
    }

    fetchStatus();
    setInterval(fetchStatus, 3000); // Update status every 3 seconds
});