from simple_pid import PID

class FanController:
    def __init__(self, target_temperature):
        self.pid = PID(1, 0.1, 0.05)  # Initialize PID controller
        self.pid.setpoint = target_temperature
        self.pid.sample_time = 1  # Sample time in seconds
        self.pid.output_limits = (0, 100)  # Example: Limits for fan control (adjust as needed)
        self.fan_on = False  # Initialize fan state

    def update(self, current_temperature):
        output = self.pid(current_temperature)
        # Example: Determine fan state based on PID output
        if output > 50:  # Example threshold to turn on fan
            self.fan_on = True
        else:
            self.fan_on = False
        return output

    def set_target_temperature(self, target_temperature):
        self.pid.setpoint = target_temperature

    def is_fan_on(self):
        return self.fan_on