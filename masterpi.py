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
from adafruit_max31855 import MAX31855
import adafruit_ads1x15.ads1115 as ADS
from adafruit_ads1x15.analog_in import AnalogIn
import aiofiles
import traceback
import json
from datetime import datetime
import pytz
import hmac
from config import load_config  # Import load_config from config.py

# Initialize the global active_sensors list
active_sensors = []

# Create your Quart app and set up CSRF protection
app = Quart(__name__)
csrf = CSRFProtect(app)

def patched_validate_csrf(data):
    if not data:
        return False
    try:
        expected_data = generate_csrf()
        return hmac.compare_digest(data, expected_data)
    except Exception as e:
        print(f"Error in validate_csrf: {e}")
        return False

# Patch the validate_csrf function in quart_csrf
csrf._validate_csrf = patched_validate_csrf

@app.context_processor
async def inject_csrf_token():
    token = generate_csrf()
    return {'csrf_token': token}

# Other routes and application setup...

@app.route('/add_sensor', methods=['POST'])
async def add_sensor():
    try:
        data = await request.get_json()
        sensor_type = data.get('sensor_type')
        label = data.get('label')
        chip_select_pin = data.get('chip_select_pin')

        if not sensor_type or not label:
            raise ValueError("Missing sensor type or label")

        # Initialize the sensor
        initialized_sensor = initialize_sensors(sensor_type, chip_select_pin)

        if initialized_sensor is None:
            raise ValueError(f"Failed to initialize sensor: {sensor_type}")

        # Add the initialized sensor to the active_sensors list
        active_sensors.append(initialized_sensor)

        # Load the configuration
        config = await load_config()

        # Add the new sensor to the configuration
        sensor_config = {
            'type': sensor_type,
            'label': label,
        }
        if chip_select_pin:
            sensor_config['chip_select_pin'] = chip_select_pin

        config['sensors'].append(sensor_config)

        # Save the updated configuration
        save_config(config)

        app.logger.info(f"Added new sensor: {label} ({sensor_type})")
        return jsonify({"message": "Sensor added successfully"}), 200

    except ValueError as ve:
        app.logger.error(f"ValueError: {ve}", exc_info=True)
        return jsonify({"error": str(ve)}), 400
    except Exception as e:
        app.logger.error(f"Error adding sensor: {e}", exc_info=True)
        return jsonify({"error": str(e)}), 500

def initialize_sensors(sensor_type, chip_select_pin):
    # Your initialization logic here
    pass

# Other routes and application setup...