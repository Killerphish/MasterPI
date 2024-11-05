"""
Module for interfacing with a MAX31865 temperature sensor.
"""

import digitalio
import board
import adafruit_max31865

class TemperatureSensor:
    """
    A class to represent a temperature sensor using the MAX31865.
    """

    def __init__(self, cs_pin):
        """
        Initializes the temperature sensor with the given chip select pin.

        :param cs_pin: The chip select pin for the SPI interface.
        """
        self.spi = board.SPI()
        self.cs = digitalio.DigitalInOut(cs_pin)
        self.cs.direction = digitalio.Direction.OUTPUT
        self.sensor = adafruit_max31865.MAX31865(
            self.spi, self.cs, rtd_nominal=100, ref_resistor=430.0, wires=3
        )

    def read_temperature(self):
        """
        Reads the temperature from the sensor.

        :return: The temperature in degrees Celsius.
        """
        return self.sensor.temperature

# Add a newline at the end of the file