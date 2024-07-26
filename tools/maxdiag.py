import board
import digitalio
import adafruit_max31865

# Initialize the SPI bus and MAX31865 sensor
spi = board.SPI()
cs = digitalio.DigitalInOut(board.D18)  # Chip select pin
sensor = adafruit_max31865.MAX31865(spi, cs)

# Read the temperature
temperature = sensor.temperature
print(f"Temperature: {temperature} °C")

# Read the fault status
fault = sensor.fault
if fault:
    print(f"Fault detected: {fault}")
    if fault & adafruit_max31865.MAX31865_FAULT_HIGHTHRESH:
        print("RTD High Threshold")
    if fault & adafruit_max31865.MAX31865_FAULT_LOWTHRESH:
        print("RTD Low Threshold")
    if fault & adafruit_max31865.MAX31865_FAULT_REFINLOW:
        print("REFIN- > 0.85 x Bias")
    if fault & adafruit_max31865.MAX31865_FAULT_REFINHIGH:
        print("REFIN- < 0.85 x Bias - FORCE- open")
    if fault & adafruit_max31865.MAX31865_FAULT_RTDINLOW:
        print("RTDIN- < 0.85 x Bias - FORCE- open")
    if fault & adafruit_max31865.MAX31865_FAULT_OVUV:
        print("Under/Over voltage")

# Clear the fault
sensor.clear_faults()