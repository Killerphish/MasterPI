"""
This module contains the PIDController class for implementing a PID control algorithm.
"""

class PIDController:
    """
    A simple PID controller class.
    """

    def __init__(self, kp, ki, kd, setpoint):
        self.kp = kp
        self.ki = ki
        self.kd = kd
        self.setpoint = setpoint
        self.previous_error = 0
        self.integral = 0

    def compute(self, current_value):
        """
        Compute the control output for a given current value.

        :param current_value: The current value of the process variable.
        :return: The control output.
        """
        error = self.setpoint - current_value
        self.integral += error
        derivative = error - self.previous_error
        output = self.kp * error + self.ki * self.integral + self.kd * derivative
        self.previous_error = error
        return output

# Add a newline at the end of the file