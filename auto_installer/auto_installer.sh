#!/bin/bash

set -e

echo "Updating system..."
sudo apt-get update -y
sudo apt-get upgrade -y

echo "Installing necessary system packages..."
sudo apt-get install -y python3-pip python3-venv nginx git

echo "Creating Python virtual environment..."
python3 -m venv ~/myenv

echo "Activating virtual environment..."
source ~/myenv/bin/activate

echo "Upgrading pip and installing wheel package in the virtual environment..."
pip install --upgrade pip
pip install wheel

echo "Installing required Python libraries with --use-pep517 option in the virtual environment..."
pip install --use-pep517 RPi.GPIO Flask adafruit-blinka adafruit-circuitpython-ads1x15 adafruit-circuitpython-ili9341 adafruit-circuitpython-touchscreen

echo "Creating project directory..."
mkdir -p ~/rpi_control
cd ~/rpi_control

echo "Creating Flask app..."
cat << 'EOF' > app.py
from flask import Flask, render_template, request, redirect, url_for
import threading
import RPi.GPIO as GPIO
import time
import board
import busio
import adafruit_ads1x15.ads1115 as ADS
from adafruit_ads1x15.analog_in import AnalogIn
import adafruit_ili9341
import adafruit_touchscreen
from PIL import Image, ImageDraw, ImageFont

app = Flask(__name__)

# GPIO pin setup for relays
FAN_RELAY_PIN = 17  # Example pin, modify as needed
DAMPER1_RELAY_PIN = 27
DAMPER2_RELAY_PIN = 22

GPIO.setmode(GPIO.BCM)
GPIO.setup(FAN_RELAY_PIN, GPIO.OUT)
GPIO.setup(DAMPER1_RELAY_PIN, GPIO.OUT)
GPIO.setup(DAMPER2_RELAY_PIN, GPIO.OUT)

def control_fan(state):
    GPIO.output(FAN_RELAY_PIN, state)
    print(repr(f"Fan relay set to {'HIGH' if state else 'LOW'}"))

def control_damper1(state):
    GPIO.output(DAMPER1_RELAY_PIN, state)
    print(repr(f"Damper1 relay set to {'HIGH' if state else 'LOW'}"))

def control_damper2(state):
    GPIO.output(DAMPER2_RELAY_PIN, state)
    print(repr(f"Damper2 relay set to {'HIGH' if state else 'LOW'}"))

# Initialize I2C bus
i2c = busio.I2C(board.SCL, board.SDA)

# Initialize two ADS1115 ADCs
ads1 = ADS.ADS1115(i2c, address=0x48)
ads2 = ADS.ADS1115(i2c, address=0x49)

# Initialize channels (assuming 6 RTD probes)
channels = [
    AnalogIn(ads1, ADS.P0),
    AnalogIn(ads1, ADS.P1),
    AnalogIn(ads1, ADS.P2),
    AnalogIn(ads1, ADS.P3),
    AnalogIn(ads2, ADS.P0),
    AnalogIn(ads2, ADS.P1),
]

# Function to read temperatures
def read_temperatures():
    temperatures = []
    for channel in channels:
        # Replace with actual RTD100 conversion logic
        voltage = channel.voltage
        temperature = voltage * 100  # Example conversion, modify as needed
        temperatures.append(temperature)
    return temperatures

@app.route('/')
def index():
    temperatures = read_temperatures()
    return render_template('index.html', temperatures=temperatures)

@app.route('/set_fan', methods=['POST'])
def set_fan():
    state = request.form['state']
    control_fan(GPIO.HIGH if state == 'on' else GPIO.LOW)
    return redirect(url_for('index'))

@app.route('/set_damper1', methods=['POST'])
def set_damper1():
    state = request.form['state']
    control_damper1(GPIO.HIGH if state == 'open' else GPIO.LOW)
    return redirect(url_for('index'))

@app.route('/set_damper2', methods=['POST'])
def set_damper2():
    state = request.form['state']
    control_damper2(GPIO.HIGH if state == 'open' else GPIO.LOW)
    return redirect(url_for('index'))

if __name__ == "__main__":
    app.run(host='0.0.0.0', port=5000)
EOF

echo "Creating Flask app templates..."
mkdir -p templates
cat << 'EOF' > templates/index.html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Temperature Control</title>
</head>
<body>
    <h1>Temperature Control Dashboard</h1>
    <h2>Current Temperatures</h2>
    <ul>
        {% for temp in temperatures %}
            <li>Probe {{ loop.index }}: {{ temp }} °F</li>
        {% endfor %}
    </ul>
    <h2>Control Fan</h2>
    <form action="/set_fan" method="post">
        <button name="state" value="on">Turn On</button>
        <button name="state" value="off">Turn Off</button>
    </form>
    <h2>Control Dampers</h2>
    <form action="/set_damper1" method="post">
        <button name="state" value="open">Open Damper 1</button>
        <button name="state" value="close">Close Damper 1</button>
    </form>
    <form action="/set_damper2" method="post">
        <button name="state" value="open">Open Damper 2</button>
        <button name="state" value="close">Close Damper 2</button>
    </form>
</body>
</html>
EOF

echo "Configuring Nginx..."
sudo rm /etc/nginx/sites-enabled/default
sudo tee /etc/nginx/sites-available/flask_app << 'EOF'
server {
    listen 80;
    server_name _;

    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
EOF

sudo ln -s /etc/nginx/sites-available/flask_app /etc/nginx/sites-enabled

echo "Restarting Nginx..."
sudo systemctl restart nginx

echo "Starting Flask app in the background..."
nohup ~/myenv/bin/python ~/rpi_control/app.py &
