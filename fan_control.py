import digitalio
import board

class FanController:
    def __init__(self, fan_pin, target_temperature):
        if isinstance(fan_pin, str):
            self.fan = digitalio.DigitalInOut(getattr(board, fan_pin))
        elif isinstance(fan_pin, int):
            self.fan = digitalio.DigitalInOut(fan_pin)
        else:
            raise ValueError(f"Invalid fan_pin type: {type(fan_pin)}. Expected str or int.")
        self.fan.direction = digitalio.Direction.OUTPUT
        self.target_temperature = target_temperature

    def update(self, current_temperature):
        if self.target_temperature > 0 and current_temperature < self.target_temperature:
            self.turn_on_fan()
        else:
            self.turn_off_fan()

    def turn_on_fan(self):
        self.fan.value = True

    def turn_off_fan(self):
        self.fan.value = False

    def is_fan_on(self):
        return self.fan.value

    def set_target_temperature(self, temperature):
        self.target_temperature = temperature