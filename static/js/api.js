// api.js - Centralized API calls
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
    const response = await fetch('/get_status');
    if (!response.ok) {
        throw new Error('Network response was not ok');
    }
    return await response.json();
}

export function updateTargetTemp(targetTemp) {
    return fetch('/update_target_temperature', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ target_temp: targetTemp }),
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Network response was not ok ' + response.statusText);
        }
        return response.json();
    });
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