import time
import board
import busio
import adafruit_ads1x15.ads1115 as ADS
from adafruit_ads1x15.analog_in import AnalogIn

# Initialize I2C bus
i2c = busio.I2C(board.SCL, board.SDA)

# Initialize two ADS1115 ADCs
ads1 = ADS.ADS1115(i2c, address=0x48)
ads2 = ADS.ADS1115(i2c, address=0x49)

# Initialize channels (assuming 6 RTD probes)
channels = [
    AnalogIn(ads1, ADS.P0),
    AnalogIn(ads1, ADS.P1),
    AnalogIn(ads1, ADS.P2),
    AnalogIn(ads1, ADS.P3),
    AnalogIn(ads2, ADS.P0),
    AnalogIn(ads2, ADS.P1),
]

# Function to read temperatures
def read_temperatures():
    temperatures = []
    for channel in channels:
        # Replace with actual RTD100 conversion logic
        voltage = channel.voltage
        temperature = voltage * 100  # Example conversion, modify as needed
        temperatures.append(temperature)
    return temperatures

if __name__ == "__main__":
    while True:
        temps = read_temperatures()
        print("Temperatures: ", temps)
        time.sleep(1)