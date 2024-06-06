import digitalio
import board
import adafruit_ili9341
import adafruit_touchscreen
from PIL import Image, ImageDraw, ImageFont

# Display setup
cs_pin = digitalio.DigitalInOut(board.D8)
dc_pin = digitalio.DigitalInOut(board.D25)
reset_pin = digitalio.DigitalInOut(board.D24)
spi = board.SPI()

disp = adafruit_ili9341.ILI9341(spi, cs=cs_pin, dc=dc_pin, reset=reset_pin)

# Touchscreen setup
cs_pin_touch = digitalio.DigitalInOut(board.D7)
irq_pin_touch = digitalio.DigitalInOut(board.D7)

ts = adafruit_touchscreen.Touchscreen(spi, cs_pin_touch, irq_pin_touch, calibration=((6200, 34000), (5900, 35000)), size=(320, 240))

# Function to display temperatures
def display_temperatures(temperatures, target_temp):
    image = Image.new("RGB", (disp.width, disp.height))
    draw = ImageDraw.Draw(image)
    draw.rectangle((0, 0, disp.width, disp.height), fill=(0, 0, 0))
    
    font = ImageFont.load_default()
    draw.text((10, 10), f"Target Temp: {target_temp} F", font=font, fill=(255, 255, 255))
    
    for i, temp in enumerate(temperatures):
        draw.text((10, 30 + i*20), f"Probe {i+1}: {temp:.2f} F", font=font, fill=(255, 255, 255))
    
    disp.image(image)

if __name__ == "__main__":
    temps = read_temperatures()
    display_temperatures(temps, 350)  # Example target temperature