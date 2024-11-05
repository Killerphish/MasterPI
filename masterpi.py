import os
import hmac
import secrets
import asyncio
import logging
from logging.handlers import RotatingFileHandler
from quart_csrf import CSRFProtect
from werkzeug.exceptions import BadRequest
from pid_controller import PIDController
from fan_control import FanController
from database import init_db, insert_temperature_data
import digitalio
import board
import aiohttp
from meater import MeaterApi
import nest_asyncio
import adafruit_dht
from hypercorn.asyncio import serve
from hypercorn.config import Config as HypercornConfig
import yaml
import busio
from adafruit_max31865 import MAX31865
from adafruit_max31855 import MAX31855
import adafruit_ads1x15.ads1115 as ADS
from adafruit_ads1x15.analog_in import AnalogIn
import aiofiles
import time
from quart import Quart, jsonify, request, render_template, send_from_directory, url_for
from config import load_config, save_config
from adafruit_max31856 import MAX31856

# Initialize the global active_sensors list
active_sensors = []

# Create your Quart app
app = Quart(__name__)

class CustomCSRFProtect(CSRFProtect):
    def __init__(self, app=None):
        super().__init__(app)
        self.exempt_methods = {'GET', 'HEAD', 'OPTIONS', 'TRACE'}
        self.header_name = 'X-CSRF-TOKEN'  # Set the header name for CSRF token

    async def protect(self):
        if request.method not in self.exempt_methods:
            token = await self._get_csrf_token()
            if token is None:
                raise BadRequest("CSRF token missing")
            if token != request.headers.get(self.header_name):
                raise BadRequest("CSRF token mismatch")
        return None

    async def generate_csrf(self):
        """Generate a new CSRF token."""
        return secrets.token_hex(16)

def validate_csrf(data):
    """Validate CSRF token."""
    if not data:
        return False
    try:
        expected_data = current_app.extensions['csrf'].generate_csrf()
        return hmac.compare_digest(data, expected_data)
    except Exception as e:
        current_app.logger.error("Error in validate_csrf: %s", e)
        return False

# Set up CSRF protection
csrf = CustomCSRFProtect(app)
csrf._validate_csrf = validate_csrf

# Add CSRF token to all templates
@app.context_processor
async def inject_csrf_token():
    return {'csrf_token': await csrf.generate_csrf()}

def load_config_sync():
    """Load configuration synchronously."""
    config_path = os.path.join(app.root_path, 'config.yaml')
    try:
        with open(config_path, 'r', encoding='utf-8') as config_file:
            config = yaml.safe_load(config_file)
        app.logger.info("Loaded configuration: %s", config)
        return config
    except Exception as e:
        app.logger.error("Error loading configuration: %s", e)
        return None

def save_config_sync(config):
    """Save configuration synchronously."""
    config_path = os.path.join(app.root_path, 'config.yaml')
    try:
        with open(config_path, 'w', encoding='utf-8') as config_file:
            yaml.safe_dump(config, config_file)
        app.logger.info("Saved configuration: %s", config)
        
        # Add a small delay to ensure file is written
        time.sleep(0.1)
        
        # Verify the saved configuration
        with open(config_path, 'r', encoding='utf-8') as config_file:
            saved_config = yaml.safe_load(config_file)
        app.logger.info("Verified saved configuration: %s", saved_config)
        
        if saved_config != config:
            app.logger.error("Saved configuration does not match the intended configuration!")
    except Exception as e:
        app.logger.error("Error saving configuration: %s", e)

async def load_config():
    """Load configuration asynchronously."""
    try:
        async with aiofiles.open('config.yaml', 'r') as config_file:
            print("Config file opened successfully")
            config = yaml.safe_load(await config_file.read())
            print("Config file loaded successfully")
            return config
    except FileNotFoundError:
        print("Config file not found. Please ensure 'config.yaml' exists.")
        return None
    except yaml.YAMLError as e:
        print(f"Error parsing config file: {e}")
        return None
    except Exception as e:
        print(f"Unexpected error loading config file: {e}")
        return None

config = load_config_sync()

if config is None:
    print("Failed to load configuration. Exiting.")
    exit(1)

# Apply nest_asyncio to allow nested event loops
nest_asyncio.apply()

# Set the secret key from the environment variable
app.secret_key = os.environ.get('SECRET_KEY')

if not app.secret_key:
    raise ValueError("No SECRET_KEY set for Quart application")

# Log the secret key for debugging (remove this in production)
app.logger.info("Using SECRET_KEY: %s", app.secret_key)

# Ensure config is not None before accessing its values
app.config['DEBUG'] = config['app']['debug']
app.config['REQUEST_TIMEOUT'] = 120
app.static_folder = 'static'

# Setup logging
if not os.path.exists('logs'):
    os.mkdir('logs')
file_handler = RotatingFileHandler(config['logging']['filename'], maxBytes=10240, backupCount=10)
file_handler.setFormatter(logging.Formatter(config['logging']['format']))
file_handler.setLevel(logging.INFO)
app.logger.addHandler(file_handler)
app.logger.setLevel(logging.INFO)
app.logger.info('Application startup')

@app.context_processor
async def inject_csrf_token():
    return {'csrf_token': await csrf.generate_csrf()}

def initialize_sensor(sensor_config):
    """Initialize a sensor based on its configuration."""
    try:
        sensor_type = sensor_config['type']
        chip_select_pin = sensor_config.get('chip_select_pin')

        if sensor_type == 'MAX31865':
            spi = busio.SPI(clock=board.SCLK, MISO=board.MISO, MOSI=board.MOSI)
            cs_pin = getattr(board, chip_select_pin) if chip_select_pin else None
            cs = digitalio.DigitalInOut(cs_pin) if cs_pin else None
            sensor = MAX31865(spi, cs, rtd_nominal=100, ref_resistor=430.0)
        elif sensor_type == 'MAX31855':
            spi = busio.SPI(clock=board.SCLK, MISO=board.MISO)
            cs_pin = getattr(board, chip_select_pin) if chip_select_pin else None
            cs = digitalio.DigitalInOut(cs_pin) if cs_pin else None
            sensor = MAX31855(spi, cs)
        elif sensor_type == 'MAX31856':
            spi = busio.SPI(clock=board.SCLK, MISO=board.MISO, MOSI=board.MOSI)
            cs_pin = getattr(board, chip_select_pin) if chip_select_pin else None
            cs = digitalio.DigitalInOut(cs_pin) if cs_pin else None
            sensor = MAX31856(spi, cs)
        elif sensor_type == 'ADS1115':
            i2c = busio.I2C(board.SCL, board.SDA)
            ads = ADS.ADS1115(i2c)
            sensor = AnalogIn(ads, ADS.P0)  # Assuming we're using the first channel
        elif sensor_type == 'DHT22':
            pin = getattr(board, chip_select_pin) if chip_select_pin else board.D4  # Default to D4 if not specified
            sensor = adafruit_dht.DHT22(pin)
        else:
            raise ValueError(f"Unsupported sensor type: {sensor_type}")
        
        return sensor, sensor_config['label']
    except Exception as e:
        app.logger.error("Error initializing %s sensor: %s", sensor_type, e)
        raise

def initialize_sensors(config):
    """Initialize all sensors based on the configuration."""
    global active_sensors
    active_sensors = []
    for sensor_config in config['sensors']:
        try:
            sensor, label = initialize_sensor(sensor_config)
            active_sensors.append((sensor, label))
        except Exception as e:
            app.logger.error("Failed to initialize sensor %s: %s", sensor_config['label'], e)
    return active_sensors

# In your main code:
print("Initializing temperature sensors...")
active_sensors = initialize_sensors(config)
print(f"Temperature sensors initialized. Active sensors: {len(active_sensors)}")

# Initialize PID controller
pid = PIDController(kp=config['pid']['kp'], ki=config['pid']['ki'], kd=config['pid']['kd'], setpoint=config['pid']['target_temperature'])

# Initialize FanController
fan_pin = config['fan']['pin']
if isinstance(fan_pin, str):
    fan_pin = getattr(board, fan_pin)
fan_controller = FanController(fan_pin=fan_pin, target_temperature=config['pid']['target_temperature'])

# Initialize aiohttp session and Meater API
aiohttp_session = None
meater_api = None

async def create_aiohttp_session():
    """Create an aiohttp session."""
    global aiohttp_session, meater_api
    aiohttp_session = aiohttp.ClientSession()
    meater_api = MeaterApi(aiohttp_session)

# Initialize the DHT sensor
dht_device = adafruit_dht.DHT22(board.D4)

def read_sensor_temperature(sensor, sensor_id):
    """Read temperature from a sensor."""
    try:
        if isinstance(sensor, MAX31856):
            temperature = sensor.temperature
        elif isinstance(sensor, MAX31865):
            temperature = sensor.temperature
        elif isinstance(sensor, MAX31855):
            temperature = sensor.temperature
        elif isinstance(sensor, AnalogIn):
            # Convert voltage to temperature for ADS1115
            voltage = sensor.voltage
            # Example conversion: assuming a linear relationship
            # Replace with actual conversion logic for your sensor
            temperature = (voltage - 0.5) * 100  # Example for TMP36 sensor
        elif isinstance(sensor, adafruit_dht.DHT22):
            temperature = sensor.temperature
        else:
            raise ValueError(f"Unsupported sensor type for {sensor_id}")
        
        # Insert the temperature data into the database with the sensor_id
        insert_temperature_data(temperature, sensor_id)
        
        return temperature
    except Exception as e:
        app.logger.error("Error reading temperature for %s: %s", sensor_id, e)
        return None

def read_temperatures():
    """Read temperatures from all active sensors."""
    temperatures = []
    for sensor, label in active_sensors:
        try:
            temperature = read_sensor_temperature(sensor, label)
            temperatures.append({"label": label, "temperature": temperature})
        except Exception as e:
            app.logger.error("Error reading temperature for %s: %s", label, e)
    return temperatures

@app.route('/')
async def index():
    """Render the index page."""
    device_name = config['device']['name']  # Get device name from config
    sensors = config.get('sensors', [])  # Example sensors

    # Ensure personalization settings are available
    if 'personalization' not in config:
        config['personalization'] = {
            'navColor': '#827f7f',
            'buttonColor': '#f2f2f2',
            'backgroundColor': '#ffffff'
        }

    return await render_template('index.html', device_name=device_name, sensors=sensors, config=config)

@app.route('/add_sensor', methods=['POST'])
async def add_sensor():
    """Add a new sensor."""
    data = await request.get_json()
    sensor_type = data.get('sensor_type')
    chip_select_pin = data.get('chip_select_pin')
    label = data.get('label')

    if not sensor_type or not label:
        return jsonify({'error': 'Missing required fields'}), 400

    try:
        config = await load_config()
        
        # Check if a sensor with the same label already exists
        if any(sensor['label'] == label for sensor in config['sensors']):
            return jsonify({'error': 'A sensor with this label already exists'}), 400

        new_sensor = {
            'type': sensor_type,
            'label': label
        }

        if sensor_type != 'ADS1115':
            if not chip_select_pin:
                return jsonify({'error': 'Chip select pin is required for this sensor type'}), 400
            new_sensor['chip_select_pin'] = chip_select_pin
        else:
            new_sensor['i2c_address'] = data.get('i2c_address')
            new_sensor['bus_number'] = data.get('bus_number')
            new_sensor['channel'] = data.get('channel')
            new_sensor['gain'] = data.get('gain')
            new_sensor['data_rate'] = data.get('data_rate')

        config['sensors'].append(new_sensor)
        await save_config(config)  # Use the async version of save_config

        # Reload the configuration to verify the changes
        config = await load_config()
        app.logger.info("Sensor added successfully. New configuration: %s", config)
        return jsonify({'message': f'Sensor {label} added successfully'})
    except Exception as e:
        app.logger.error("Error adding sensor: %s", e, exc_info=True)
        return jsonify({'error': str(e)}), 500

@app.route('/get_available_pins', methods=['GET'])
def get_available_pins():
    """Get available GPIO pins."""
    try:
        config = load_config_sync()
        all_pins = ['D5', 'D6', 'D13', 'D19', 'D26']  # List all possible pins
        used_pins = [sensor['chip_select_pin'] for sensor in config['sensors'] if 'chip_select_pin' in sensor]
        available_pins = [pin for pin in all_pins if pin not in used_pins]
        return jsonify({'available_pins': available_pins})
    except Exception as e:
        app.logger.error("Error getting available pins: %s", e)
        return jsonify({'error': 'Failed to get available pins'}), 500
    
@app.route('/favicon.ico')
def favicon():
    """Serve the favicon."""
    return send_from_directory(os.path.join(app.root_path, 'static'),
                               'favicon.ico', mimetype='image/vnd.microsoft.icon')

@app.route('/initialize_sensors', methods=['POST'])
async def initialize_sensors_route():
    """Initialize sensors via HTTP request."""
    try:
        load_active_sensors()
        app.logger.info('Sensors initialized successfully.')
        return jsonify({"message": "Sensors initialized successfully"}), 200
    except Exception as e:
        app.logger.error("Error initializing sensors: %s", e, exc_info=True)
        return jsonify({"error": str(e)}), 500

@app.route('/power_options', methods=['POST'])
async def power_options():
    """Handle power options for the Raspberry Pi."""
    try:
        data = await request.get_json()
        action = data.get('action')

        if action == 'restart_rpi':
            os.system('sudo reboot')
            return jsonify({"message": "Raspberry Pi is restarting..."}), 200
        elif action == 'restart_app':
            os.system('sudo systemctl restart masterpi')  # Assuming the app is managed by systemd
            return jsonify({"message": "Application is restarting..."}), 200
        elif action == 'shutdown':
            os.system('sudo shutdown now')
            return jsonify({"message": "Raspberry Pi is shutting down..."}), 200
        else:
            return jsonify({"error": "Invalid action"}), 400
    except Exception as e:
        app.logger.error("Error handling power options: %s", e, exc_info=True)
        return jsonify({"error": str(e)}), 500
    
@app.route('/settings')
async def settings():
    """Render the settings page."""
    try:
        app.logger.info("Settings route called")
        
        # Load config with explicit logging
        app.logger.info("Loading config...")
        config = await load_config()
        app.logger.info("Config loaded: %s", config)
        
        # Generate CSRF token with logging
        app.logger.info("Generating CSRF token...")
        csrf_token = await csrf.generate_csrf()
        app.logger.info("CSRF token generated")
        
        # Get available pins
        app.logger.info("Getting available pins...")
        available_pins = config.get('available_pins', [])
        app.logger.info("Available pins: %s", available_pins)
        
        # Render template with logging
        app.logger.info("Rendering template...")
        response = await render_template(
            'settings.html',
            config=config,
            available_pins=available_pins,
            csrf_token=csrf_token
        )
        app.logger.info("Template rendered successfully")
        
        return response
        
    except Exception as e:
        app.logger.error("Error in settings route: %s", e, exc_info=True)
        traceback.print_exc()
        return "Internal Server Error", 500

@app.route('/save_settings', methods=['POST'])
async def save_settings():
    """Save application settings."""
    try:
        data = await request.get_json()
        app.logger.info("Received settings data: %s", data)
        config = await load_config()
        
        if 'device_name' in data:
            config['device']['name'] = data['device_name']
        elif 'temperatureUnit' in data:
            config['units']['temperature'] = data['temperatureUnit']
        elif 'timezone' in data:
            config['units']['timezone'] = data['timezone']  # Save the timezone setting
        elif any(key in data for key in ['navColor', 'buttonColor', 'backgroundColor', 'navTextColor', 'buttonTextColor']):
            # Handle personalization settings
            config.setdefault('personalization', {})
            for key in ['navColor', 'buttonColor', 'backgroundColor', 'navTextColor', 'buttonTextColor']:
                if key in data:
                    config['personalization'][key] = data[key]
        else:
            app.logger.warning("Unknown setting received: %s", data)
            return jsonify({'success': False, 'error': 'Invalid setting'}), 400
        
        app.logger.info("Updated config: %s", config)
        await save_config(config)
        
        return jsonify({'success': True, 'message': 'Setting updated successfully'})
    except Exception as e:
        app.logger.error("Error saving setting: %s", e, exc_info=True)
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/save_personalization_settings', methods=['POST'])
async def save_personalization_settings():
    """Save personalization settings."""
    try:
        data = await request.get_json()
        # Process the data and save the settings
        # For example, update the config file or database
        return jsonify({'success': True})
    except Exception as e:
        app.logger.error("Error saving personalization settings: %s", e, exc_info=True)
        return jsonify({'error': 'Internal Server Error'}), 500

@app.route('/emergency_shutdown', methods=['POST'])
async def emergency_shutdown():
    """Initiate an emergency shutdown."""
    try:
        # Set the target temperature to 0 degrees
        pid.setpoint = 0.0
        fan_controller.set_target_temperature(0.0)
        app.logger.info("Set target temperature to 0 degrees.")

        # Ensure the fan is turned off
        fan_controller.turn_off_fan()
        app.logger.info("Fan controller updated. Fan value: %s", fan_controller.fan.value)

        app.logger.info("Emergency shutdown initiated: Fan turned off and target temperature set to 0 degrees.")
        return jsonify({'status': 'success', 'message': 'Emergency shutdown initiated.'})
    except Exception as e:
        app.logger.error("Error during emergency shutdown: %s", e, exc_info=True)
        return jsonify({'status': 'error', 'message': str(e)}), 500

@app.route('/static/<path:filename>')
def serve_static(filename):
    """Serve static files."""
    app.logger.debug("Attempting to serve static file: %s", filename)
    return send_from_directory(app.static_folder, filename)

# Configure logging
handler = RotatingFileHandler('app.log', maxBytes=10000, backupCount=1)
handler.setLevel(logging.INFO)
formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
handler.setFormatter(formatter)
app.logger.addHandler(handler)
app.logger.setLevel(logging.INFO)

# Initialize the database
init_db()

# Configure logging
logging.basicConfig(level=logging.INFO)

async def read_temperature_data():
    """Read temperature data periodically."""
    while True:
        try:
            temperatures = read_temperatures()
            for temp_data in temperatures:
                label = temp_data['label']
                temperature = temp_data['temperature']
                if temperature is not None:
                    logging.info("Read temperature: %s", temperature)
                    insert_temperature_data(temperature, label)
                    logging.info("Inserted temperature data: %s", temperature)
                else:
                    logging.error("Failed to read temperature: received None")
        except Exception as e:
            logging.error("Error reading temperature: %s", e)
        await asyncio.sleep(60)  # Read temperature data every 60 seconds

async def main():
    """Main entry point for the application."""
    global config
    config = await load_config()  # Load the configuration asynchronously
    await create_aiohttp_session()
    init_db()  # Initialize the database
    hypercorn_config = HypercornConfig()
    hypercorn_config.bind = ["0.0.0.0:5000"]  # Ensure this is correct
    try:
        # Start the temperature reading loop
        asyncio.create_task(read_temperature_data())
        await serve(app, hypercorn_config)
    finally:
        await aiohttp_session.close()  # Ensure the aiohttp session is closed properly

@app.route('/temp_data', methods=['GET'])
async def temp_data():
    """Fetch temperature data."""
    try:
        # Read the current temperatures from the sensors
        temperatures = read_temperatures()
        
        # Return the temperatures as a JSON response
        return jsonify({'temperatures': temperatures})
    except Exception as e:
        app.logger.error("Error fetching temperature data: %s", e, exc_info=True)
        return jsonify({'error': 'Failed to fetch temperature data'}), 500

@app.route('/remove_sensor', methods=['POST'])
async def remove_sensor():
    """Remove a sensor."""
    try:
        data = await request.get_json()
        sensor_label = data.get('label')
        
        # Logic to remove the sensor from your configuration or database
        # For example:
        config = await load_config()
        config['sensors'] = [sensor for sensor in config['sensors'] if sensor['label'] != sensor_label]
        await save_config(config)
        
        return jsonify({'message': f'Sensor {sensor_label} removed successfully'})
    except Exception as e:
        app.logger.error("Error removing sensor: %s", e, exc_info=True)
        return jsonify({'error': str(e)}), 500

@app.route('/test_remove_sensor_url')
async def test_remove_sensor_url():
    """Test the remove sensor URL."""
    try:
        url = url_for('remove_sensor')
        return jsonify({'remove_sensor_url': url})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/save_sensor_settings', methods=['POST'])
async def save_sensor_settings():
    """Save sensor settings."""
    try:
        data = await request.get_json()
        # Process the sensor settings data
        # For example, update the configuration or database
        config = await load_config()
        # Assume data contains sensor settings to be updated
        # Update the config with new sensor settings
        await save_config(config)
        
        return jsonify({'message': 'Sensor settings saved successfully'})
    except Exception as e:
        app.logger.error("Error saving sensor settings: %s", e, exc_info=True)
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    nest_asyncio.apply()  # Apply nest_asyncio to allow nested event loops
    asyncio.run(main())
    