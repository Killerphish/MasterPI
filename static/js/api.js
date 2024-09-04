// api.js - Centralized API calls

// Function to get CSRF token
function getCsrfToken() {
    const csrfTokenMeta = document.querySelector('meta[name="csrf-token"]');
    if (csrfTokenMeta) {
        return csrfTokenMeta.getAttribute('content');
    } else {
        console.error('CSRF token not found');
        return '';
    }
}

export function fetchTemperatureData() {
    return fetch('/get_temperature')
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok ' + response.statusText);
            }
            return response.json();
        })
        .then(data => {
            // Attempt to transform data into the correct format
            if (!Array.isArray(data)) {
                if (typeof data === 'object' && data !== null) {
                    // Convert object to array of arrays
                    data = Object.entries(data);
                } else {
                    throw new Error('Data format is incorrect: not an array');
                }
            }

            const transformedData = data.map(item => {
                if (Array.isArray(item) && item.length === 2) {
                    return item;
                } else if (item.timestamp && item.entry) {
                    return [item.timestamp, item.entry];
                } else {
                    throw new Error('Data format is incorrect: item structure is invalid');
                }
            });

            return transformedData;
        });
}

export async function fetchStatus() {
    try {
        const response = await fetch('/api/status');
        if (!response.ok) {
            console.error('Network response was not ok:', response.status, response.statusText);
            throw new Error('Network response was not ok');
        }
        return await response.json();
    } catch (error) {
        console.error('Error fetching status:', error);
        throw error;
    }
}

export function updateTargetTemp(temperature) {
    return fetch('/set_target_temperature', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': getCsrfToken()
        },
        body: JSON.stringify({ target_temperature: temperature })
    })
    .then(response => response.json());
}

export function requestMeaterApiKey(email, password) {
    return fetch('https://public-api.cloud.meater.com/v1/login', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, password })
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`Network response was not ok ${response.statusText}`);
        }
        return response.json();
    })
    .then(data => {
        console.log('Meater API response:', data);  // Log the response for debugging
        if (data.statusCode === 200 && data.data.token) {
            localStorage.setItem('meater_jwt', data.data.token); // Store the JWT in localStorage
            return data.data.token;
        } else {
            throw new Error('API response does not contain success property');
        }
    })
    .catch(error => {
        console.error('Error requesting Meater API Key:', error);
        throw error;
    });
}

// Remove the duplicate fetchTemperatureData function