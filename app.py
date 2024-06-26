from flask import Flask
from temperature_sensor import TemperatureSensor
from fan_control import FanController
from web_server import create_app

app = create_app()

if __name__ == "__main__":
    app.run(host='0.0.0.0', port=5000)