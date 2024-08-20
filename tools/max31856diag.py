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
        cs = digitalio.DigitalInOut(board.D8)  # Using GPIO8 for CS
        
        # Initialize MAX31856 sensor
        sensor = adafruit_max31856.MAX31856(spi, cs)
        
        # Check for faults
        fault = sensor.fault
        if fault:
            print("Fault detected:")
            for fault_type, is_active in fault.items():
                print(f"  {fault_type}: {'Yes' if is_active else 'No'}")
            
            # Additional diagnostic information
            print(f"\nNoise filter: {sensor.noise_filter}")
            print(f"Conversion mode: {sensor.conversion_mode}")
            print(f"Cold-junction temperature: {sensor.reference_temperature:.2f}°C")
            
            return
        
        # Read temperature in Celsius
        temperature_c = sensor.temperature
        print(f"Thermocouple Temperature: {temperature_c:.2f} °C")
        
        # Convert to Fahrenheit
        temperature_f = (temperature_c * 9/5) + 32
        print(f"Temperature: {temperature_f:.2f} °F")
        
    except Exception as e:
        print(f"Error reading temperature: {e}")
        print("\nDiagnostic information:")
        print(f"SPI configuration: CLK={board.SCLK}, MISO={board.MISO}, MOSI={board.MOSI}")
        print(f"Chip Select pin: {board.D8}")
        print("Please verify these pin assignments are correct for your wiring.")

if __name__ == "__main__":
    while True:
        read_max31856_temperature()
        time.sleep(2)  # Read temperature every 2 seconds