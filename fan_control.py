from simple_pid import PID

class FanController:
    def __init__(self, target_temperature):
        self.pid = PID.PID(1, 0.1, 0.05)
        self.pid.SetPoint = target_temperature
        self.pid.setSampleTime(1)
    
    def update(self, current_temperature):
        self.pid.update(current_temperature)
        return self.pid.output

    def set_target_temperature(self, target_temperature):
        self.pid.SetPoint = target_temperature