"""
This module provides a FanController class to manage fan operations based on temperature.
"""

import digitalio
import board

class FanController:
    """
    A class to control a fan based on the target temperature.
    """

    def __init__(self, fan_pin, target_temperature):
        """
        Initializes the FanController with a specified pin and target temperature.

        :param fan_pin: The pin number or name where the fan is connected.
        :param target_temperature: The temperature at which the fan should turn on.
        """
        if isinstance(fan_pin, str):
            self.fan = digitalio.DigitalInOut(getattr(board, fan_pin))
        elif isinstance(fan_pin, int):
            pin_name = f'D{fan_pin}'
            if hasattr(board, pin_name):
                self.fan = digitalio.DigitalInOut(getattr(board, pin_name))
            else:
                raise ValueError(f"Invalid fan pin number: {fan_pin}")
        else:
            raise ValueError(f"Invalid fan_pin type: {type(fan_pin)}. Expected str or int.")
        self.fan.direction = digitalio.Direction.OUTPUT
        self.target_temperature = target_temperature

    def update(self, current_temperature):
        """
        Updates the fan state based on the current temperature.

        :param current_temperature: The current temperature reading.
        """
        if self.target_temperature > 0 and current_temperature < self.target_temperature:
            self.turn_on_fan()
        else:
            self.turn_off_fan()

    def turn_on_fan(self):
        """
        Turns the fan on.
        """
        self.fan.value = True

    def turn_off_fan(self):
        """
        Turns the fan off.
        """
        self.fan.value = False

    def is_fan_on(self):
        """
        Checks if the fan is currently on.

        :return: True if the fan is on, False otherwise.
        """
        return self.fan.value

    def set_target_temperature(self, temperature):
        """
        Sets a new target temperature for the fan.

        :param temperature: The new target temperature.
        """
        self.target_temperature = temperature

# Ensure the file ends with a newline