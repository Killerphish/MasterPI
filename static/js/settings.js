import { showModal, hideModal } from './modal.js';
import { updateStatus, handleFetchError } from './status.js';
import { requestMeaterApiKey } from './api.js';

let tempUnit = 'F'; // Default unit changed to Fahrenheit

document.addEventListener("DOMContentLoaded", function() {
    M.AutoInit();  // Initialize all Materialize components

    // Initialize modals
    const modals = document.querySelectorAll('.modal');
    M.Modal.init(modals);

    var elems = document.querySelectorAll('.tabs');
    var instances = M.Tabs.init(elems);

    // Ensure labels are correctly positioned
    M.updateTextFields();

    // Fetch settings to get the temperature unit
    fetch('/get_settings')
        .then(response => response.json())
        .then(settings => {
            tempUnit = settings.units.temperature;
        })
        .catch(error => {
            console.error('Error fetching settings:', error);
        });

    // Add event listeners to switch tab content
    document.querySelectorAll('.tabs a').forEach(tab => {
        tab.addEventListener('click', function(event) {
            event.preventDefault();
            const target = this.getAttribute('href').substring(1);
            document.querySelectorAll('.tab-content').forEach(content => {
                content.classList.remove('active');
            });
            document.getElementById(target).classList.add('active');
        });
    });

    const form = document.getElementById('settingsForm');
    const enableMeaterIntegrationButton = document.getElementById('enableMeaterIntegration');
    const meaterModal = document.getElementById('meaterModal');
    const closeModal = document.getElementsByClassName('close')[0];
    const meaterForm = document.getElementById('meaterForm');
    const meaterStatus = document.getElementById('meaterStatus');

    // Open the modal
    if (enableMeaterIntegrationButton) {
        enableMeaterIntegrationButton.addEventListener('click', function() {
            showModal(meaterModal);
        });
    }

    // Close the modal
    if (closeModal) {
        closeModal.addEventListener('click', function() {
            hideModal(meaterModal, meaterStatus);
        });
    }

    // Close the modal when clicking outside of it
    window.addEventListener('click', function(event) {
        if (event.target == meaterModal) {
            hideModal(meaterModal, meaterStatus);
        }
    });

    // Handle the "Add Sensor" form submission
    const addSensorForm = document.getElementById('addSensorForm');
    if (addSensorForm) {
        addSensorForm.addEventListener('submit', function(event) {
            event.preventDefault();

            const sensorType = document.getElementById('newSensorType').value;
            const label = document.getElementById('newSensorLabel').value;
            const chipSelectPin = document.getElementById('newSensorCsPin').value;

            const data = {
                sensor_type: sensorType,
                label: label,
                chip_select_pin: chipSelectPin
            };

            fetch('/add_sensor', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': getCsrfToken()
                },
                body: JSON.stringify(data)
            })
            .then(response => response.json())
            .then(result => {
                if (result.message) {
                    M.toast({html: result.message});
                    window.location.reload();  // Reload the page to reflect the new sensor
                } else {
                    M.toast({html: `Error: ${result.error}`});
                }
            })
            .catch(error => {
                console.error('Error adding sensor:', error);
                M.toast({html: `Error: ${error.message}`});
            });
        });
    }

    // Handle the "Initialize Sensors" button click
    const initializeSensorsButton = document.getElementById('initializeSensorsButton');
    if (initializeSensorsButton) {
        initializeSensorsButton.addEventListener('click', function() {
            fetch(initializeSensorsUrl, {
                method: 'POST',
                headers: {
                    'X-CSRF-TOKEN': getCsrfToken()
                }
            })
            .then(response => response.json())
            .then(result => {
                if (result.message) {
                    M.toast({html: result.message});
                } else {
                    M.toast({html: `Error: ${result.error}`});
                }
            })
            .catch(error => {
                console.error('Error initializing sensors:', error);
                M.toast({html: `Error: ${error.message}`});
            });
        });
    }

    // Handle power options
    const restartRpiButton = document.getElementById('restartRpiButton');
    const restartAppButton = document.getElementById('restartAppButton');
    const shutdownButton = document.getElementById('shutdownButton');

    if (restartRpiButton) {
        restartRpiButton.addEventListener('click', function() {
            fetch(powerOptionsUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': getCsrfToken()
                },
                body: JSON.stringify({ action: 'restart_rpi' })
            })
            .then(response => response.json())
            .then(result => {
                if (result.message) {
                    M.toast({html: result.message});
                } else {
                    M.toast({html: `Error: ${result.error}`});
                }
            })
            .catch(error => {
                console.error('Error restarting Raspberry Pi:', error);
                M.toast({html: `Error: ${error.message}`});
            });
        });
    }

    if (restartAppButton) {
        restartAppButton.addEventListener('click', function() {
            fetch(powerOptionsUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': getCsrfToken()
                },
                body: JSON.stringify({ action: 'restart_app' })
            })
            .then(response => response.json())
            .then(result => {
                if (result.message) {
                    M.toast({html: result.message});
                } else {
                    M.toast({html: `Error: ${result.error}`});
                }
            })
            .catch(error => {
                console.error('Error restarting application:', error);
                M.toast({html: `Error: ${error.message}`});
            });
        });
    }

    if (shutdownButton) {
        shutdownButton.addEventListener('click', function() {
            fetch(powerOptionsUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': getCsrfToken()
                },
                body: JSON.stringify({ action: 'shutdown' })
            })
            .then(response => response.json())
            .then(result => {
                if (result.message) {
                    M.toast({html: result.message});
                } else {
                    M.toast({html: `Error: ${result.error}`});
                }
            })
            .catch(error => {
                console.error('Error shutting down Raspberry Pi:', error);
                M.toast({html: `Error: ${error.message}`});
            });
        });
    }

    // Handle the "Save General Settings" form submission
    const settingsForm = document.getElementById('settingsForm');
    if (settingsForm) {
        settingsForm.addEventListener('submit', function(event) {
            event.preventDefault();

            const formData = new FormData(settingsForm);

            fetch(saveDeviceSettingsUrl, {
                method: 'POST',
                headers: {
                    'X-CSRF-TOKEN': getCsrfToken()
                },
                body: formData
            })
            .then(response => response.json())
            .then(result => {
                if (result.message) {
                    M.toast({html: result.message});
                } else {
                    M.toast({html: `Error: ${result.error}`});
                }
            })
            .catch(error => {
                console.error('Error saving general settings:', error);
                M.toast({html: `Error: ${error.message}`});
            });
        });
    }

    // Handle the "Save Personalization Settings" form submission
    const personalizationForm = document.getElementById('personalizationForm');
    if (personalizationForm) {
        personalizationForm.addEventListener('submit', function(event) {
            event.preventDefault();

            const formData = new FormData(personalizationForm);

            fetch(savePersonalizationSettingsUrl, {
                method: 'POST',
                headers: {
                    'X-CSRF-TOKEN': getCsrfToken()
                },
                body: formData
            })
            .then(response => response.json())
            .then(result => {
                if (result.message) {
                    M.toast({html: result.message});
                } else {
                    M.toast({html: `Error: ${result.error}`});
                }
            })
            .catch(error => {
                console.error('Error saving personalization settings:', error);
                M.toast({html: `Error: ${error.message}`});
            });
        });
    }

    // Function to get CSRF token
    function getCsrfToken() {
        return document.querySelector('meta[name="csrf-token"]').getAttribute('content');
    }
});