import board
import busio
import digitalio
import adafruit_max31856
import time

def read_max31856_temperature():
    try:
        # Initialize SPI bus
        spi = busio.SPI(clock=board.SCLK, MISO=board.MISO, MOSI=board.MOSI)
        
        # Initialize chip select pin
        cs = digitalio.DigitalInOut(board.D5)  # Change to your actual CS pin
        
        # Initialize MAX31856 sensor
        sensor = adafruit_max31856.MAX31856(spi, cs)
        
        # Check for faults
        if sensor.fault:
            print(f"Fault detected: {sensor.fault}")
            return
        
        # Read cold junction temperature
        cj_temperature = sensor.cold_junction_temperature
        print(f"Cold Junction Temperature: {cj_temperature:.2f} °C")
        
        # Read temperature in Celsius
        temperature_c = sensor.temperature
        print(f"Thermocouple Temperature: {temperature_c:.2f} °C")
        
        # Convert to Fahrenheit
        temperature_f = (temperature_c * 9/5) + 32
        print(f"Temperature: {temperature_f:.2f} °F")
        
    except Exception as e:
        print(f"Error reading temperature: {e}")

if __name__ == "__main__":
    while True:
        read_max31856_temperature()
        time.sleep(2)  # Read temperature every 2 seconds