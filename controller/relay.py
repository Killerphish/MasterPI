import RPi.GPIO as GPIO
import time

# GPIO pin setup for relays
FAN_RELAY_PIN = 17  # Example pin, modify as needed
DAMPER1_RELAY_PIN = 27
DAMPER2_RELAY_PIN = 22

GPIO.setmode(GPIO.BCM)
GPIO.setup(FAN_RELAY_PIN, GPIO.OUT)
GPIO.setup(DAMPER1_RELAY_PIN, GPIO.OUT)
GPIO.setup(DAMPER2_RELAY_PIN, GPIO.OUT)

def control_fan(state):
    GPIO.output(FAN_RELAY_PIN, state)
    print(repr(f"Fan relay set to {'HIGH' if state else 'LOW'}"))

def control_damper1(state):
    GPIO.output(DAMPER1_RELAY_PIN, state)
    print(repr(f"Damper1 relay set to {'HIGH' if state else 'LOW'}"))

def control_damper2(state):
    GPIO.output(DAMPER2_RELAY_PIN, state)
    print(repr(f"Damper2 relay set to {'HIGH' if state else 'LOW'}"))

if __name__ == "__main__":
    try:
        control_fan(GPIO.HIGH)  # Turn fan on
        time.sleep(5)
        control_fan(GPIO.LOW)   # Turn fan off
        time.sleep(5)
    finally:
        GPIO.cleanup()
