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
        
        # Attempt to read temperature regardless of fault status
        try:
            temperature_c = sensor.temperature
            print(f"Thermocouple Temperature: {temperature_c:.2f} °C")
            
            temperature_f = (temperature_c * 9/5) + 32
            print(f"Temperature: {temperature_f:.2f} °F")
        except Exception as temp_error:
            print(f"Error reading thermocouple temperature: {temp_error}")
        
        # Try to read cold-junction temperature
        try:
            cj_temp = sensor.reference_temperature
            print(f"Cold-junction Temperature: {cj_temp:.2f} °C")
        except Exception as cj_error:
            print(f"Error reading cold-junction temperature: {cj_error}")
        
        # Check for faults after attempting to read temperatures
        fault = sensor.fault
        if any(fault.values()):
            print("\nFault detected:")
            for fault_type, is_active in fault.items():
                if is_active:
                    print(f"  {fault_type}: Yes")
        
    except Exception as e:
        print(f"Error initializing or communicating with MAX31856: {e}")
        print("\nDiagnostic information:")
        print(f"SPI configuration: CLK={board.SCLK}, MISO={board.MISO}, MOSI={board.MOSI}")
        print(f"Chip Select pin: {board.D8}")
        print("Please verify these pin assignments are correct for your wiring.")

if __name__ == "__main__":
    while True:
        read_max31856_temperature()
        time.sleep(2)  # Read temperature every 2 seconds