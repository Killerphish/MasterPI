"""
This module initializes and reads data from the MAX31865 sensor using SPI.
"""

import board
import digitalio
import adafruit_max31865

try:
    # Initialize the SPI bus and MAX31865 sensor
    print("Initializing SPI bus...")
    spi = board.SPI()
    print("SPI bus initialized.")

    print("Initializing chip select pin...")
    cs = digitalio.DigitalInOut(board.D18)  # Chip select pin
    print("Chip select pin initialized.")

    print("Initializing MAX31865 sensor...")
    sensor = adafruit_max31865.MAX31865(spi, cs)
    print("MAX31865 sensor initialized.")

    # Read the temperature
    print("Reading temperature...")
    temperature = sensor.temperature
    print(f"Temperature: {temperature} °C")

    # Read the fault status
    print("Reading fault status...")
    fault = sensor.fault
    if fault:
        print(f"Fault detected: {fault}")
        if fault & adafruit_max31865.FAULT_HIGHTHRESH:
            print("RTD High Threshold")
        if fault & adafruit_max31865.FAULT_LOWTHRESH:
            print("RTD Low Threshold")
        if fault & adafruit_max31865.FAULT_REFINLOW:
            print("REFIN- > 0.85 x Bias")
        if fault & adafruit_max31865.FAULT_REFINHIGH:
            print("REFIN- < 0.85 x Bias - FORCE- open")
        if fault & adafruit_max31865.FAULT_RTDINLOW:
            print("RTDIN- < 0.85 x Bias - FORCE- open")
        if fault & adafruit_max31865.FAULT_OVUV:
            print("Under/Over voltage")

    # Clear the fault
    print("Clearing faults...")
    sensor.clear_faults()
    print("Faults cleared.")

except (ValueError, IOError) as e:  # Replace with more specific exceptions if known
    print(f"An error occurred: {e}")