from simple_pid import PID
from gpiozero import PWMOutputDevice

class FanController:
    def __init__(self, fan_pin, target_temperature):
        self.pid = PID(1, 0.1, 0.05)  # Initialize PID controller
        self.pid.setpoint = target_temperature
        self.pid.sample_time = 1  # Sample time in seconds
        self.pid.output_limits = (0, 1)  # Output limits for PID (0 to 1 for PWM control)
        
        self.fan = PWMOutputDevice(fan_pin)  # Initialize fan control using PWM
        self.fan.value = 0  # Start with fan off
        
    def update(self, current_temperature):
        pid_output = self.pid(current_temperature)
        self.fan.value = pid_output  # Adjust fan speed based on PID output
        return pid_output

    def set_target_temperature(self, target_temperature):
        self.pid.setpoint = target_temperature

    def is_fan_on(self):
        return self.fan.value > 0  # Check if fan is on based on PWM output

    def turn_off_fan(self):
        self.fan.value = 0

    def cleanup(self):
        self.fan.close()  # Cleanup resources when done