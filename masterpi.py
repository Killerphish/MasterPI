import logging
from logging.handlers import RotatingFileHandler
from quart import Quart, jsonify, request, render_template, send_from_directory, session, redirect, url_for, flash, get_flashed_messages, send_file
from quart_csrf import CSRFProtect, generate_csrf
from temperature_sensor import TemperatureSensor
from pid_controller import PIDController
from fan_control import FanController
from database import insert_temperature_data, get_last_24_hours_temperature_data, init_db, get_temperature_data_by_range
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
import datetime  # Add this import statement

def load_config_sync():
    try:
        with open('config.yaml', 'r') as config_file:
            print("Config file opened successfully")
            config = yaml.safe_load(config_file)
            print("Config file loaded successfully")
            return config
    except Exception as e:
        print(f"Error loading config file: {e}")
        return {}

# Initialize the database
init_db()

@app.route('/get_temperature', methods=['GET'])
async def get_temperature():
    try:
        time_range = request.args.get('time_range', '5')  # Default to 5 if not provided
        app.logger.info(f"Received request for temperature data with time range: {time_range}")

        # Fetch temperature data from the database
        data = get_temperature_data_by_range(int(time_range))

        temperatures = []
        for row in data:
            timestamp, temperature = row
            temperatures.append({
                'timestamp': timestamp,
                'temperature': temperature
            })

        app.logger.info(f"Returning temperatures: {temperatures}")  # Log the temperatures for debugging
        return jsonify({'temperatures': temperatures})
    except Exception as e:
        app.logger.error(f"Error reading temperature: {e}", exc_info=True)
        return jsonify({"error": str(e)}), 500

# Update the function that reads temperature data from sensors to store it in the database
async def read_temperature_data():
    while True:
        for sensor, offset, enabled in sensors:
            if not enabled:
                continue  # Skip disabled sensors
            if isinstance(sensor, adafruit_max31856.MAX31856):
                temperature_celsius = sensor.temperature  # Use the correct method for MAX31856
            else:
                temperature_celsius = sensor.read_temperature()  # Use the generic method for other sensors
            temperature_fahrenheit = temperature_celsius * 9/5 + 32  # Convert to Fahrenheit
            timestamp = datetime.datetime.now().isoformat()
            insert_temperature_data(timestamp, round(temperature_fahrenheit, 2))
        await asyncio.sleep(60)  # Read temperature data every 60 seconds

# Start the temperature reading loop
asyncio.create_task(read_temperature_data())

@app.route('/temp_data', methods=['GET'])
async def temp_data():
    try:
        time_range = request.args.get('time_range', '60')  # Default to 60 minutes if not provided
        data = get_temperature_data_by_range(int(time_range))
        return jsonify(data=data)
    except Exception as e:
        app.logger.error(f"Error fetching temperature data: {e}", exc_info=True)
        return jsonify({'error': 'Internal Server Error'}), 500

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