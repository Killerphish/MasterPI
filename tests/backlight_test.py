import RPi.GPIO as GPIO
import time

# GPIO pin setup for the display backlight
LED_PIN = 18  # Example pin, modify as needed

# Set up GPIO using BCM numbering
GPIO.setmode(GPIO.BCM)
GPIO.setup(LED_PIN, GPIO.OUT)

def turn_on_backlight():
    GPIO.output(LED_PIN, GPIO.HIGH)

def turn_off_backlight():
    GPIO.output(LED_PIN, GPIO.LOW)

if __name__ == "__main__":
    try:
        # Example usage: Toggle the backlight
        while True:
            turn_on_backlight()
            time.sleep(5)  # Backlight on for 5 seconds
            turn_off_backlight()
            time.sleep(5)  # Backlight off for 5 seconds
    except KeyboardInterrupt:
        pass
    finally:
        GPIO.cleanup()
