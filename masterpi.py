import logging
from logging.handlers import RotatingFileHandler
from quart import Quart, jsonify, request, render_template, send_from_directory, session, redirect, url_for, flash, get_flashed_messages, send_file
from quart_csrf import CSRFProtect, generate_csrf
from temperature_sensor import TemperatureSensor
from pid_controller import PIDController
from fan_control import FanController
from database import init_db, insert_temperature_data, get_last_24_hours_temperature_data, get_temperature_data_by_range
import digitalio
import adafruit_blinka
import board
import os
import aiohttp
import sqlite3
from meater import MeaterApi
import nest_asyncio
import asyncio
import adafruit_dht
from hypercorn.asyncio import serve
from hypercorn.config import Config as HypercornConfig
import ssl
import yaml
import busio
import adafruit_max31856
from adafruit_max31865 import MAX31865
from adafruit_max31856 import MAX31856
from adafruit_max31855 import MAX31855
import adafruit_ads1x15.ads1115 as ADS
from adafruit_ads1x15.analog_in import AnalogIn
import aiofiles
import traceback
import json
import datetime
import pytz
import hmac
from quart_csrf import csrf

def patched_validate_csrf(data):
    if not data:
        return False
    try:
        expected_data = csrf._get_signed_token()
        return hmac.compare_digest(data, expected_data)
    except Exception as e:
        print(f"Error in validate_csrf: {e}")
        return False

# Monkey-patch the validate_csrf function
csrf.validate_csrf = patched_validate_csrf

# Now create your Quart app and set up CSRF protection
app = Quart(__name__)
csrf = CSRFProtect(app)

def load_config_sync():
    try:
        with open('config.yaml', 'r') as config_file:
            print("Config file opened successfully")
            config = yaml.safe_load(config_file)
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

async def load_config():
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
app.logger.info(f"Using SECRET_KEY: {app.secret_key}")

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

# Context processor to inject CSRF token into templates
@app.context_processor
def inject_csrf_token():
    token = generate_csrf()
    app.logger.debug(f"Generated CSRF token: {token}")
    return dict(csrf_token=token)

# Initialize temperature sensors based on settings
print("Initializing temperature sensors...")
def initialize_sensors(config):
    sensors = []
    sensor_configs = config['sensors']

    for sensor_config in sensor_configs:
        sensor_type = sensor_config['type']
        enabled = sensor_config.get('enabled', True)  # Default to True if not specified
        try:
            temp_offset = float(sensor_config.get('temp_offset', 0.0))
            if sensor_type == 'MAX31865':
                spi = busio.SPI(clock=board.SCLK, MISO=board.MISO, MOSI=board.MOSI)
                cs_pin = getattr(board, sensor_config['chip_select_pin'])
                cs = digitalio.DigitalInOut(cs_pin)
                sensor = MAX31865(spi, cs, rtd_nominal=sensor_config['rtd_type'], ref_resistor=sensor_config['reference_resistor'])
                sensors.append((sensor, temp_offset, enabled))
                app.logger.info(f"Initialized {sensor_type} sensor on pin {sensor_config['chip_select_pin']}")
            elif sensor_type == 'MAX31855':
                spi = busio.SPI(clock=board.SCLK, MISO=board.MISO)
                cs_pin = getattr(board, sensor_config['chip_select_pin'])
                cs = digitalio.DigitalInOut(cs_pin)
                sensor = MAX31855(spi, cs)
                sensors.append((sensor, temp_offset, enabled))
                app.logger.info(f"Initialized {sensor_type} sensor on pin {sensor_config['chip_select_pin']}")
            elif sensor_type == 'MAX31856':
                spi = busio.SPI(clock=board.SCLK, MISO=board.MISO, MOSI=board.MOSI)
                cs_pin = getattr(board, sensor_config['chip_select_pin'])
                cs = digitalio.DigitalInOut(cs_pin)
                sensor = MAX31856(spi, cs, thermocouple_type=adafruit_max31856.ThermocoupleType.K)  # Ensure thermocouple type is set
                sensors.append((sensor, temp_offset, enabled))
                app.logger.info(f"Initialized {sensor_type} sensor on pin {sensor_config['chip_select_pin']}")
            elif sensor_type == 'ADS1115':
                i2c = busio.I2C(board.SCL, board.SDA)
                ads = ADS.ADS1115(i2c, address=sensor_config['address'])
                sensor = AnalogIn(ads, getattr(ADS, f'P{sensor_config["channel"]}'))
                sensors.append((sensor, temp_offset, enabled))
                app.logger.info(f"Initialized {sensor_type} sensor on channel {sensor_config['channel']} with address {sensor_config['address']}")
            elif sensor_type == 'DHT22':
                sensor = adafruit_dht.DHT22(getattr(board, sensor_config['pin']))
                sensors.append((sensor, temp_offset, enabled))
                app.logger.info(f"Initialized {sensor_type} sensor on pin {sensor_config['pin']}")
        except Exception as e:
            app.logger.error(f"Error initializing {sensor_type} on pin {sensor_config.get('chip_select_pin', sensor_config.get('channel', 'N/A'))}: {e}")

    print("Temperature sensors initialized.")
    return sensors

# Initialize temperature sensors based on settings
print("Initializing temperature sensors...")
sensors = initialize_sensors(config)

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
    global aiohttp_session, meater_api
    aiohttp_session = aiohttp.ClientSession()
    meater_api = MeaterApi(aiohttp_session)

# Initialize the DHT sensor
dht_device = adafruit_dht.DHT22(board.D4)

def read_sensor_temperature(sensor):
    try:
        temperature = sensor.read_temperature()
        return temperature
    except Exception as e:
        app.logger.error(f"Error reading temperature: {e}")
        return None

@app.route('/')
async def index():
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
    try:
        form_data = await request.get_json()  # Use get_json() to parse JSON data
        sensor_type = form_data.get('sensor_type')
        label = form_data.get('label')
        chip_select_pin = form_data.get('chip_select_pin')

        if not sensor_type or not label or not chip_select_pin:
            raise ValueError("Missing required sensor data")

        config = await load_config()  # Ensure this is awaited

        # Add the new sensor to the configuration
        new_sensor = {
            'type': sensor_type,
            'chip_select_pin': chip_select_pin,
            'temp_offset': 0.0,
            'label': label,
            'enabled': True  # Add this line to ensure the sensor is enabled by default
        }
        config['sensors'].append(new_sensor)

        save_config(config)

        # Initialize the sensor and update the active sensors list
        initialized_sensor = initialize_sensors(config)
        active_sensors.append(initialized_sensor)

        app.logger.info('Sensor added and initialized successfully.')
        return jsonify({"message": "Sensor added and initialized successfully"}), 200
    except Exception as e:
        app.logger.error(f"Error adding sensor: {e}", exc_info=True)
        return jsonify({"error": str(e)}), 500

@app.route('/get_available_pins', methods=['GET'])
async def get_available_pins():
    try:
        config = await load_config()  # Ensure this is awaited
        used_pins = {sensor['chip_select_pin'] for sensor in config['sensors']}
        all_pins = {'D5', 'D6', 'D7', 'D8', 'D9', 'D10', 'D11', 'D12', 'D13', 'D17'}  # Add other available pins as needed
        available_pins = list(all_pins - used_pins)
        return jsonify(available_pins), 200
    except Exception as e:
        app.logger.error(f"Error fetching available pins: {e}", exc_info=True)
        return jsonify({"error": str(e)}), 500

@app.route('/initialize_sensors', methods=['POST'])
async def initialize_sensors_route():
    try:
        load_active_sensors()
        app.logger.info('Sensors initialized successfully.')
        return jsonify({"message": "Sensors initialized successfully"}), 200
    except Exception as e:
        app.logger.error(f"Error initializing sensors: {e}", exc_info=True)
        return jsonify({"error": str(e)}), 500

@app.route('/power_options', methods=['POST'])
async def power_options():
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
        app.logger.error(f"Error handling power options: {e}", exc_info=True)
        return jsonify({"error": str(e)}), 500
    
@app.route('/settings')
async def settings():
    config = await load_config()
    return await render_template('settings.html', config=config)

@app.route('/save_settings', methods=['POST'])
async def save_settings():
    try:
        data = await request.get_json()
        app.logger.info(f"Received settings data: {data}")
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
            app.logger.warning(f"Unknown setting received: {data}")
            return jsonify({'success': False, 'error': 'Invalid setting'}), 400
        
        app.logger.info(f"Updated config: {config}")
        save_config(config)
        
        return jsonify({'success': True, 'message': 'Setting updated successfully'})
    except Exception as e:
        app.logger.error(f"Error saving setting: {e}", exc_info=True)
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/save_personalization_settings', methods=['POST'])
async def save_personalization_settings():
    try:
        data = await request.get_json()
        # Process the data and save the settings
        # For example, update the config file or database
        return jsonify({'success': True})
    except Exception as e:
        app.logger.error(f"Error saving personalization settings: {e}", exc_info=True)
        return jsonify({'error': 'Internal Server Error'}), 500

@app.route('/emergency_shutdown', methods=['POST'])
async def emergency_shutdown():
    try:
        # Set the target temperature to 0 degrees
        pid.setpoint = 0.0
        fan_controller.set_target_temperature(0.0)
        app.logger.info("Set target temperature to 0 degrees.")

        # Ensure the fan is turned off
        fan_controller.turn_off_fan()
        app.logger.info(f"Fan controller updated. Fan value: {fan_controller.fan.value}")

        app.logger.info("Emergency shutdown initiated: Fan turned off and target temperature set to 0 degrees.")
        return jsonify({'status': 'success', 'message': 'Emergency shutdown initiated.'})
    except Exception as e:
        app.logger.error(f"Error during emergency shutdown: {e}", exc_info=True)
        return jsonify({'status': 'error', 'message': str(e)}), 500

@app.route('/static/<path:filename>')
def serve_static(filename):
    app.logger.debug(f"Attempting to serve static file: {filename}")
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
    while True:
        try:
            for sensor, offset, enabled in sensors:
                if not enabled:
                    continue  # Skip disabled sensors
                temperature = read_sensor_temperature(sensor)
                temperature += offset  # Apply temperature offset
                logging.info(f"Read temperature: {temperature}")
                insert_temperature_data(temperature)
                logging.info(f"Inserted temperature data: {temperature}")
        except Exception as e:
            logging.error(f"Error reading temperature: {e}")
        await asyncio.sleep(60)  # Read temperature data every 60 seconds

#save_config settings
def save_config(config):
    try:
        with open('config.yaml', 'w') as config_file:
            yaml.safe_dump(config, config_file)
            print("Config file saved successfully")
    except Exception as e:
        print(f"Error saving config file: {e}")

@app.route('/temp_data', methods=['GET'])
async def temp_data():
    try:
        time_range = request.args.get('time_range', '60')  # Default to 60 minutes if not provided
        config = await load_config()  # Load the configuration to get the timezone
        timezone = pytz.timezone(config['units'].get('timezone', 'UTC'))  # Default to UTC if not set
        app.logger.debug(f"Fetching temperature data for the last {time_range} minutes in timezone {timezone}")
        
        data = get_temperature_data_by_range(int(time_range), timezone)
        app.logger.debug(f"Fetched temperature data: {data}")
        
        formatted_data = []
        for row in data:
            timestamp, temperature = row
            if isinstance(timestamp, datetime):
                formatted_timestamp = timestamp.astimezone(timezone).isoformat()
            else:
                # If timestamp is not a datetime object, convert it to one
                formatted_timestamp = datetime.fromtimestamp(timestamp, timezone).isoformat()
            
            formatted_data.append({
                'timestamp': formatted_timestamp,
                'temperature': temperature
            })
        
        return jsonify(data=formatted_data)
    except Exception as e:
        app.logger.error(f"Error fetching temperature data: {e}", exc_info=True)
        return jsonify({'error': str(e)}), 500

@app.route('/chart')
async def chart():
    return await render_template('chart.html')

@app.route('/update_target', methods=['POST'])
async def update_target():
    data = await request.form
    target_temp = data['target_temp']
    # Update target temperature in your PID controller
    return jsonify(success=True)

@app.route('/current_temp', methods=['GET'])
async def current_temp():
    # Get current temperature from the sensor
    return jsonify(current_temp=current_temp)

@app.route('/pid_autotune', methods=['POST'])
async def pid_autotune():
    # Start PID autotune process
    return jsonify(success=True)

@app.route('/api/status', methods=['GET'])
async def api_status():
    try:
        # Example status data
        status_data = {
            'fan_on': True,
            'target_temperature': 75.0,
            'temperatures': [72.5, 73.0, 74.0]
        }
        return jsonify(status_data)
    except Exception as e:
        app.logger.error(f"Error fetching status: {e}", exc_info=True)
        return jsonify({'error': 'Internal Server Error'}), 500

@app.route('/get_settings', methods=['GET'])
async def get_settings():
    try:
        config = await load_config()
        settings = {
            'device': config['device'],
            'units': config['units'],
            'personalization': config['personalization']
        }
        return jsonify(settings)
    except Exception as e:
        app.logger.error(f"Error fetching settings: {e}", exc_info=True)
        return jsonify({'error': 'Internal Server Error'}), 500

@app.route('/remove_sensor', methods=['POST'])
async def remove_sensor():
    try:
        data = await request.get_json()
        sensor_index = data.get('index')

        if sensor_index is None:
            raise ValueError("Missing sensor index")

        # Load the configuration
        config = await load_config()

        # Remove the sensor from the configuration
        if 0 <= sensor_index < len(config['sensors']):
            removed_sensor = config['sensors'].pop(sensor_index)
            save_config(config)
            app.logger.info(f"Removed sensor: {removed_sensor}")
            return jsonify({"message": "Sensor removed successfully"}), 200
        else:
            raise ValueError("Invalid sensor index")

    except Exception as e:
        app.logger.error(f"Error removing sensor: {e}", exc_info=True)
        return jsonify({"error": str(e)}), 500

@app.route('/save_sensor_settings', methods=['POST'])
async def save_sensor_settings():
    try:
        form_data = await request.get_json()  # Use get_json() to parse JSON data
        sensor_index = form_data.get('sensor_index')
        sensor_settings = form_data.get('sensor_settings')

        if sensor_index is None or sensor_settings is None:
            raise ValueError("Missing sensor index or settings")

        config = await load_config()  # Ensure this is awaited

        # Update the sensor settings in the configuration
        config['sensors'][sensor_index].update(sensor_settings)

        save_config(config)

        # Update the active sensors list
        load_active_sensors()

        app.logger.info('Sensor settings saved successfully.')
        return jsonify({"message": "Sensor settings saved successfully"}), 200
    except Exception as e:
        app.logger.error(f"Error saving sensor settings: {e}", exc_info=True)
        return jsonify({"error": str(e)}), 500

@app.route('/get_timezones', methods=['GET'])
async def get_timezones():
    try:
        timezones = pytz.all_timezones
        return jsonify(timezones), 200
    except Exception as e:
        app.logger.error(f"Error fetching timezones: {e}", exc_info=True)
        return jsonify({"error": str(e)}), 500

async def main():
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

if __name__ == '__main__':
    nest_asyncio.apply()  # Apply nest_asyncio to allow nested event loops
    asyncio.run(main())