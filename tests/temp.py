"""
This module reads temperature and resistance from a MAX31865 sensor using SPI.
"""

import time
import board
import digitalio
import adafruit_max31865

# Define the SPI bus and CS pin
spi = board.SPI()
cs = digitalio.DigitalInOut(board.D18)  # Chip select of the MAX31865 board.

# Create a sensor object
sensor = adafruit_max31865.MAX31865(spi, cs)

# Main loop to read temperature and resistance
while True:
    temperature = sensor.temperature
    resistance = sensor.resistance
    print(f"Temperature: {temperature:.2f} °C")
    print(f"Resistance: {resistance:.2f} ohms")
    time.sleep(1.0)

# Add a newline at the end of the file