// api.js - Centralized API calls
export function fetchTemperatureData() {
    return fetch('/get_temperature')
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok ' + response.statusText);
            }
            return response.json();
        });
}

export function fetchStatus() {
    return fetch('/get_status')
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok ' + response.statusText);
            }
            return response.json();
        });
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
    });
}