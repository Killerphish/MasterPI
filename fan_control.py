from simple_pid import PID
from gpiozero import PWMOutputDevice
import logging

class FanController:
    def __init__(self, fan_pin, target_temperature):
        self.pid = PID(1, 0.1, 0.05)  # Initialize PID controller
        self.pid.setpoint = target_temperature
        self.pid.sample_time = 1  # Sample time in seconds
        self.pid.output_limits = (0, 1)  # Output limits for PID (0 to 1 for PWM control)
        
        self.fan = PWMOutputDevice(fan_pin)  # Initialize fan control using PWM
        self.fan.value = 0  # Start with fan off
        self.target_temperature = target_temperature
        
    def update(self, current_temperature):
        if current_temperature >= self.target_temperature:
            pid_output = self.pid(current_temperature)
            self.fan.value = pid_output  # Adjust fan speed based on PID output
        else:
            self.fan.value = 0  # Turn off the fan if current temperature is below target
        
        logging.info(f"Fan PWM value set to: {self.fan.value}")
        return self.fan.value

    def set_target_temperature(self, target_temperature):
        self.target_temperature = target_temperature
        self.pid.setpoint = target_temperature

    def is_fan_on(self):
        return self.fan.value > 0  # Check if fan is on based on PWM output
    
    def turn_on_fan(self):
        self.fan.value = 1  # Set fan speed to maximum (assuming 100% duty cycle)
        logging.info("Fan turned on.")
        
    def turn_off_fan(self):
        self.fan.value = 0  # Turn off the fan
        logging.info("Fan turned off.")

    def cleanup(self):
        self.fan.close()  # Cleanup resources when done