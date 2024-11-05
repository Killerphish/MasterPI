"""
This module provides functionality to read temperature from a MAX31856 sensor.
"""

import time
import board
import busio
import digitalio
import adafruit_max31856

def read_max31856_temperature():
    """
    Reads the temperature from the MAX31856 sensor and prints it in Celsius and Fahrenheit.
    Also checks for faults and prints diagnostic information if an error occurs.
    """
    try:
        # Initialize SPI bus
        spi = busio.SPI(clock=board.SCLK, MISO=board.MISO, MOSI=board.MOSI)
        
        # Initialize chip select pin
        cs = digitalio.DigitalInOut(board.D5)  # Using GPIO5 for CS
        
        # Initialize MAX31856 sensor with explicit thermocouple type
        sensor = adafruit_max31856.MAX31856(spi, cs, thermocouple_type=adafruit_max31856.ThermocoupleType.K)
        
        # Attempt to read temperature regardless of fault status
        try:
            temperature_c = sensor.temperature
            print(f"Thermocouple Temperature: {temperature_c:.2f} °C")
            
            temperature_f = (temperature_c * 9/5) + 32
            print(f"Temperature: {temperature_f:.2f} °F")
        except (RuntimeError, ValueError) as temp_error:
            print(f"Error reading thermocouple temperature: {temp_error}")
        
        # Try to read cold-junction temperature
        try:
            cj_temp = sensor.reference_temperature
            print(f"Cold-junction Temperature: {cj_temp:.2f} °C")
        except (RuntimeError, ValueError) as cj_error:
            print(f"Error reading cold-junction temperature: {cj_error}")
        
        # Check for faults after attempting to read temperatures
        fault = sensor.fault
        if any(fault.values()):
            print("\nFault detected:")
            for fault_type, is_active in fault.items():
                if is_active:
                    print(f"  {fault_type}: Yes")
        
        # Additional diagnostics
        print("\nAdditional Diagnostics:")
        
    except (RuntimeError, ValueError) as e:
        print(f"Error initializing or communicating with MAX31856: {e}")
        print("\nDiagnostic information:")
        print(f"SPI configuration: CLK={board.SCLK}, MISO={board.MISO}, MOSI={board.MOSI}")
        print(f"Chip Select pin: {board.D5}")
        print("Please verify these pin assignments are correct for your wiring.")

if __name__ == "__main__":
    while True:
        read_max31856_temperature()
        time.sleep(2)  # Read temperature every 2 seconds