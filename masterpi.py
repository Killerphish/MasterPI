import logging
from logging.handlers import RotatingFileHandler
from quart import Quart, jsonify, request, render_template, send_from_directory, session, redirect, url_for, flash, get_flashed_messages, send_file
from quart_csrf import CSRFProtect, generate_csrf
from temperature_sensor import TemperatureSensor
from pid_controller import PIDController
from fan_control import FanController
from database import insert_temperature_data, get_last_24_hours_temperature_data, init_db
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
import aiofiles  # Ensure aiofiles is imported
import traceback
import json

def load_config_sync():
    try:
        with open('config.yaml', 'r') as config_file:
            print("Config file opened successfully")
            config = yaml.safe_load(config_file)
            print("Config file loaded successfully")
            return config
    except Exception as e:
        print(f"Error loading config file: {e}")
        raise

async def load_config():
    try:
        async with aiofiles.open('config.yaml', 'r') as config_file:
            print("Config file opened successfully")
            config = yaml.safe_load(await config_file.read())
            print("Config file loaded successfully")
            return config
    except Exception as e:
        print(f"Error loading config file: {e}")
        raise

def save_config(config):
    with open('config.yaml', 'w') as f:
        yaml.dump(config, f, default_flow_style=False)
    app.logger.info("Configuration saved successfully")

config = load_config_sync()

# Apply nest_asyncio to allow nested event loops
nest_asyncio.apply()

app = Quart(__name__)
app.config['SECRET_KEY'] = 'your-secret-key'  # Replace with a secure secret key
csrf = CSRFProtect(app)
app.config['DEBUG'] = config['app']['debug']
app.secret_key = 'your_secret_key'  # Add a secret key for session management
app.config['REQUEST_TIMEOUT'] = 120  # Increase request timeout to 120 seconds
app.static_folder = 'static'  # Add this line

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
# Initialize FanController
fan_pin = config['fan']['pin']
if isinstance(fan_pin, str):
    fan_pin = getattr(board, fan_pin)
fan_pin = config['fan']['pin']
fan_controller = FanController(fan_pin=fan_pin, target_temperature=config['pid']['target_temperature'])

# Initialize aiohttp session and Meater API
aiohttp_session = None
meater_api = None

async def create_aiohttp_session():
    global aiohttp_session, meater_api
    aiohttp_session = aiohttp.ClientSession()
    meater_api = MeaterApi(aiohttp_session)

# Initialize the DHT22 sensor
dht_device = adafruit_dht.DHT22(board.D18)

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

@app.route('/settings', methods=['GET'])
async def settings():
    try:
        app.logger.info("GET request received on /settings")
        config = await load_config()
        app.logger.debug(f"Loaded config: {config}")
        
        # Ensure sensors are properly loaded from config
        sensors = config.get('sensors', [])
        app.logger.debug(f"Loaded sensors: {sensors}")
        
        csrf_token = generate_csrf()
        device_name = config.get('device', {}).get('name', 'MasterPI')  # Provide a default name if not set
        return await render_template('settings.html', config=config, sensors=sensors, csrf_token=csrf_token, device_name=device_name)
    except Exception as e:
        app.logger.error(f"Error in settings route: {e}", exc_info=True)
        return jsonify({"error": str(e)}), 500

@app.route('/save_personalization_settings', methods=['POST'])
async def save_personalization_settings():
    try:
        data = await request.json
        app.logger.info(f"Received data: {data}")
        
        config = await load_config()
        app.logger.info(f"Loaded config: {config}")
        
        config['personalization'] = {
            'navColor': data.get('navColor'),
            'navTextColor': data.get('navTextColor'),
            'buttonColor': data.get('buttonColor'),
            'buttonTextColor': data.get('buttonTextColor'),
            'backgroundColor': data.get('backgroundColor')
        }
        app.logger.info(f"Updated config: {config}")

        save_config(config)
        app.logger.info("Config saved successfully")

        return jsonify({"message": "Personalization settings saved successfully"}), 200
    except Exception as e:
        app.logger.error(f"Error saving personalization settings: {str(e)}")
        app.logger.error(traceback.format_exc())
        return jsonify({"error": str(e)}), 500

@app.route('/get_temperature', methods=['GET'])
async def get_temperature():
    try:
        temperatures = []
        for sensor, offset, enabled in sensors:
            if not enabled:
                continue  # Skip disabled sensors

            try:
                if isinstance(sensor, MAX31865):
                    temperature_celsius = sensor.temperature
                elif isinstance(sensor, MAX31855):
                    temperature_celsius = sensor.temperature
                elif isinstance(sensor, MAX31856):
                    temperature_celsius = sensor.temperature
                elif isinstance(sensor, AnalogIn):
                    voltage = sensor.voltage
                    temperature_celsius = voltage_to_temperature(voltage)
                elif isinstance(sensor, adafruit_dht.DHT22):
                    temperature_celsius = sensor.temperature
                else:
                    raise ValueError("Unsupported sensor type")

                corrected_temperature_celsius = temperature_celsius + offset
                if config['units']['temperature'] == 'Fahrenheit':
                    temperature = (corrected_temperature_celsius * 9/5) + 32
                else:
                    temperature = corrected_temperature_celsius
                
                # Round the temperature to two decimal places
                temperature = round(temperature, 2)
                
                temperatures.append(temperature)
                app.logger.info(f"Read temperature: {temperature} {'°F' if config['units']['temperature'] == 'Fahrenheit' else '°C'} from {sensor.__class__.__name__}")
            except Exception as e:
                app.logger.error(f"Error reading temperature from {sensor.__class__.__name__}: {e}")
                temperatures.append(None)
        
        return jsonify({'temperatures': temperatures})
    except Exception as e:
        app.logger.error(f"Error reading temperature: {e}")
        return jsonify({"error": str(e)}), 500

def voltage_to_temperature(voltage):
    # Implement this function based on the sensor and its characteristics
    # Example for an LM35 temperature sensor: temperature_C = voltage * 100
    # Adjust as needed for your setup
    return voltage * 100  # Replace this with the actual conversion formula

@app.route('/get_meater_temperature', methods=['GET'])
async def get_meater_temperature():
    try:
        temperature = await fetch_meater_temperature()
        return jsonify({'temperature': temperature})
    except Exception as e:
        app.logger.error(f"Error fetching Meater temperature: {e}")
        return jsonify({'error': 'Internal Server Error'}), 500

async def fetch_meater_temperature():
    # Replace with actual logic to fetch Meater temperature
    # Replace with actual implementation
    try:
        # Simulate fetching temperature from Meater API
        temperature = 75.0  # Example temperature value
        return temperature
    except Exception as e:
        raise e

# Endpoint to get Meater devices
@app.route('/get_meater_status', methods=['GET'])
def get_meater_status():
    # Replace with actual logic to get Meater status
    status = {
        "connected": True,
        "temperature": 75.0
    }
    return jsonify(status)

@app.route('/favicon.ico')
async def favicon():
    return await send_from_directory(os.path.join(app.root_path, 'static'),
                                     'favicon.ico', mimetype='image/vnd.microsoft.icon')

@app.route('/save_temperature', methods=['POST'])
def save_temperature():
    data = request.get_json()
    temperature = data.get('temperature')
    if (temperature is None):
        return jsonify({'error': 'Temperature is required'}), 400

    try:
        insert_temperature_data(temperature)
        app.logger.info(f"Temperature data saved: {temperature}")
        return jsonify({'status': 'success'})
    except Exception as e:
        app.logger.error(f"Error saving temperature: {e}")
        return jsonify({'status': 'error', 'message': str(e)}), 500

@app.route('/get_temperature_data', methods=['GET'])
def get_temperature_data():
    try:
        data = get_last_24_hours_temperature_data()
        return jsonify(data)
    except Exception as e:
        app.logger.error(f"Error fetching temperature data: {e}")
        return jsonify({'error': 'Internal Server Error'}), 500

@app.route('/get_settings', methods=['GET'])
async def get_settings():
    try:
        config = await load_config()  # Ensure this is awaited
        settings = {
            'units': config['units'],
            'device': config['device'],
            'personalization': config['personalization']
        }
        return jsonify(settings)
    except Exception as e:
        app.logger.error(f"Error fetching settings: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/pid_autotune', methods=['POST'])
async def pid_autotune():
    try:
        # Replace with actual logic to start PID autotune
        # For example, you might call a method on your PIDController instance
        pid.start_autotune()
        await flash('PID autotune started successfully!', 'success')
        return redirect(url_for('settings'))
    except Exception as e:
        app.logger.error(f"Error starting PID autotune: {e}")
        await flash('Error starting PID autotune', 'error')
        return redirect(url_for('settings'))

# Check if the wizard has been completed
@app.before_request
async def check_wizard():
    # Only check if the wizard has not been completed
    if not config.get('app', {}).get('wizard_completed', False):
        app.logger.info("Wizard not completed, redirecting to wizard setup page.")
        # Redirect to the wizard setup page if not completed
        if request.endpoint not in ['wizard', 'complete_wizard', 'static']:
            return redirect(url_for('wizard'))

@app.route('/wizard', methods=['GET'])
async def wizard():
    app.logger.info("Rendering wizard setup page.")
    return await render_template('wizard.html')  # Ensure wizard.html is in the templates folder

@app.route('/complete_wizard', methods=['POST'])
async def complete_wizard():
    form_data = await request.form  # Await the request.form to get the form data
    device_name = form_data.get('device_name')
    temp_unit = form_data.get('temp_unit')

    # Update the configuration with the new settings
    config['device'] = {'name': device_name}
    config['units']['temperature'] = temp_unit
    config['app']['wizard_completed'] = True  # Set the wizard as completed

    save_config(config)  # Save the updated configuration

    # Log the updated configuration
    app.logger.info(f"Updated configuration: {config}")

    # Redirect to the main page
    return redirect(url_for('index'))

@app.route('/api/status', methods=['GET'])
async def get_status():
    try:
        current_temperature = await get_current_temperature()
        fan_controller.update(current_temperature)

        # Log the current temperature and fan status
        app.logger.info(f"Current temperature: {current_temperature}")
        app.logger.info(f"Fan status: {'On' if fan_controller.is_fan_on() else 'Off'}")
        app.logger.info(f"Target temperature: {fan_controller.target_temperature}")

        # Collect temperatures from sensors
        temperatures = []
        for sensor, offset, enabled in sensors:
            if enabled:
                try:
                    temperature = sensor.read_temperature()  # Ensure this method exists
                    temperatures.append(temperature)
                    app.logger.info(f"Read temperature: {temperature} from {sensor.__class__.__name__}")
                except Exception as e:
                    app.logger.error(f"Error reading temperature from {sensor.__class__.__name__}: {e}")
                    temperatures.append(None)

        status = {
            'status': 'OK',
            'message': 'Server is running',
            'temperature': current_temperature,
            'fan_on': fan_controller.is_fan_on(),
            'target_temperature': fan_controller.target_temperature,
            'temperatures': temperatures
        }
        return jsonify(status)
    except Exception as e:
        app.logger.error(f"Error fetching status: {e}", exc_info=True)
        return jsonify({'error': 'Internal Server Error'}), 500

async def get_current_temperature():
    try:
        temperature = await read_sensor_temperature()
        return temperature
    except Exception as e:
        app.logger.error(f"Error fetching current temperature: {e}", exc_info=True)
        return 75.0  # Return a default value or handle the error appropriately

async def read_sensor_temperature():
    try:
        temperatures = []
        for sensor, offset, enabled in sensors:
            if not enabled:
                app.logger.debug(f"Sensor {sensor.__class__.__name__} is disabled.")
                continue  # Skip disabled sensors

            try:
                if isinstance(sensor, MAX31865):
                    temperature_celsius = sensor.temperature
                elif isinstance(sensor, MAX31855):
                    temperature_celsius = sensor.temperature
                elif isinstance(sensor, MAX31856):
                    temperature_celsius = sensor.temperature
                elif isinstance(sensor, AnalogIn):
                    voltage = sensor.voltage
                    temperature_celsius = voltage_to_temperature(voltage)
                elif isinstance(sensor, adafruit_dht.DHT22):
                    temperature_celsius = sensor.temperature
                else:
                    raise ValueError("Unsupported sensor type")

                corrected_temperature_celsius = temperature_celsius + offset
                temperatures.append(corrected_temperature_celsius)
                app.logger.info(f"Read temperature: {corrected_temperature_celsius} °C from {sensor.__class__.__name__}")
            except RuntimeError as e:
                app.logger.error(f"Error reading temperature from {sensor.__class__.__name__}: {e}")
                temperatures.append(None)  # Append None or a default value in case of error

        if temperatures:
            valid_temperatures = [temp for temp in temperatures if temp is not None]
            if valid_temperatures:
                return sum(valid_temperatures) / len(valid_temperatures)
            else:
                raise ValueError("No valid temperatures read from sensors")
        else:
            raise ValueError("No temperatures read from sensors")
    except Exception as e:
        app.logger.error(f"Error reading sensor temperature: {e}", exc_info=True)
        raise

@app.route('/set_target_temperature', methods=['POST'])
async def set_target_temperature():
    try:
        data = await request.get_json()
        target_temperature = data.get('target_temperature')
        if target_temperature is None:
            app.logger.error('Target temperature is required')
            return jsonify({'error': 'Target temperature is required'}), 400

        # Convert to float, handling the case where it might be 0 (Off)
        target_temperature = float(target_temperature)

        # Update the target temperature in your PID controller and fan controller
        pid.setpoint = target_temperature
        fan_controller.set_target_temperature(target_temperature)

        # Get the current temperature and update the fan status
        current_temperature = await get_current_temperature()
        fan_controller.update(current_temperature)

        app.logger.info(f"Target temperature set to: {'Off' if target_temperature == 0 else target_temperature}")
        app.logger.info(f"Fan status: {'On' if fan_controller.is_fan_on() else 'Off'}")

        return jsonify({'status': 'success', 'fan_on': fan_controller.is_fan_on()})
    except Exception as e:
        app.logger.error(f"Error setting target temperature: {e}", exc_info=True)
        return jsonify({'status': 'error', 'message': str(e)}), 500

@app.route('/remove_sensor', methods=['POST'])
async def remove_sensor():
    try:
        data = await request.get_json()
        sensor_index = int(data.get('index'))
        app.logger.debug(f"Received request to remove sensor at index: {sensor_index}")

        # Load the current configuration
        config = await load_config()
        app.logger.debug(f"Current config: {config}")

        # Remove the sensor from the configuration
        if 'sensors' in config and 0 <= sensor_index < len(config['sensors']):
            del config['sensors'][sensor_index]
            app.logger.debug(f"Updated config after removal: {config}")
            save_config(config)
            app.logger.info('Sensor removed successfully.')
            return jsonify({"message": "Sensor removed successfully"}), 200
        else:
            app.logger.warning('Invalid sensor index.')
            return jsonify({"error": "Invalid sensor index."}), 400
    except Exception as e:
        app.logger.error(f"Error removing sensor: {e}", exc_info=True)
        return jsonify({"error": str(e)}), 500

@app.route('/view_config')
async def view_config():
    try:
        config = await load_config()
        return await render_template('view_config.html', config=config)
    except Exception as e:
        app.logger.error(f"Error viewing configuration: {e}", exc_info=True)
        return jsonify({"error": str(e)}), 500

@app.route('/edit_config')
async def edit_config():
    try:
        config = await load_config()
        csrf_token = generate_csrf()
        return await render_template('edit_config.html', config=config, csrf_token=csrf_token)
    except Exception as e:
        app.logger.error(f"Error loading configuration: {e}", exc_info=True)
        return jsonify({'error': 'Internal Server Error'}), 500

@app.route('/save_config', methods=['POST'])
async def save_config_route():
    try:
        form_data = await request.form
        new_config = yaml.safe_load(form_data['configContent'])
        save_config(new_config)
        return redirect(url_for('view_config'))
    except Exception as e:
        app.logger.error(f"Error saving configuration: {e}", exc_info=True)
        return jsonify({'error': 'Internal Server Error'}), 500

@app.route('/save_sensor_settings', methods=['POST'])
async def save_sensor_settings():
    try:
        data = await request.json
        index = int(data.get('index'))
        cs_pin = data.get('cs_pin')
        label = data.get('label')

        config = await load_config()

        if 'sensors' in config and 0 <= index < len(config['sensors']):
            config['sensors'][index]['chip_select_pin'] = cs_pin
            config['sensors'][index]['label'] = label
            save_config(config)
            return jsonify({"message": "Sensor settings saved successfully"}), 200
        else:
            return jsonify({"error": "Invalid sensor index."}), 400
    except Exception as e:
        app.logger.error(f"Error saving sensor settings: {e}", exc_info=True)
        return jsonify({"error": str(e)}), 500

# Map the CS pin to the correct board constant
PIN_MAPPING = {
    'D5': board.D5,
    'D6': board.D6,
    'D7': board.D7,
    'D8': board.D8,
    'D9': board.D9,
    'D10': board.D10,
    'D11': board.D11,
    'D12': board.D12,
    'D13': board.D13,
    'D17': board.D17,
    # Add other mappings as needed
}

def get_board_pin(pin_name):
    try:
        return PIN_MAPPING[pin_name]
    except KeyError:
        raise ValueError(f"Invalid pin name: {pin_name}")

def initialize_sensor(sensor_type, chip_select_pin):
    cs_pin = get_board_pin(chip_select_pin)
    if sensor_type == 'MAX31856':
        try:
            spi = busio.SPI(clock=board.SCLK, MISO=board.MISO, MOSI=board.MOSI)
            cs = digitalio.DigitalInOut(cs_pin)
            sensor = MAX31856(spi, cs, thermocouple_type=adafruit_max31856.ThermocoupleType.K)  # Ensure thermocouple type is set
            sensor.temperature  # Test the sensor
            return sensor
        except Exception as e:
            raise ValueError(f"Error initializing MAX31856 on pin {chip_select_pin}: {e}")
    # Add other sensor types as needed
    return None

active_sensors = []

def load_active_sensors():
    global active_sensors
    config = load_config_sync()  # Synchronous version of load_config for initialization
    active_sensors = []
    for sensor in config['sensors']:
        try:
            initialized_sensor = initialize_sensor(sensor['type'], sensor['chip_select_pin'])
            active_sensors.append(initialized_sensor)
        except Exception as e:
            app.logger.error(f"Error initializing sensor {sensor['label']}: {e}")

@app.before_serving
async def initialize_sensors():
    load_active_sensors()

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
        initialized_sensor = initialize_sensor(sensor_type, chip_select_pin)
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

if __name__ == '__main__':
    async def main():
        global config
        config = await load_config()  # Load the configuration asynchronously
        await create_aiohttp_session()
        init_db()  # Initialize the database
        hypercorn_config = HypercornConfig()
        hypercorn_config.bind = ["127.0.0.1:5000"]  # Ensure this is correct
        try:
            await serve(app, hypercorn_config)
        finally:
            await aiohttp_session.close()  # Ensure the aiohttp session is closed properly

    asyncio.run(main())