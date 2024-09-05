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

export function fetchTemperatureData(timeRange) {
    return fetch(`/get_temperature?time_range=${timeRange}`)
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok ' + response.statusText);
            }
            return response.json();
        })
        .then(data => {
            console.log('Fetched temperature data:', data); // Log the fetched data for debugging
            return data;
        })
        .catch(error => {
            console.error('Error fetching temperature data:', error);
            throw error;
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