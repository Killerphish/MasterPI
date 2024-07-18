import adafruit_blinka
import digitalio
import adafruit_max31865

class TemperatureSensor:
    def __init__(self, cs_pin):
        self.spi = board.SPI()
        self.cs = digitalio.DigitalInOut(cs_pin)
        self.cs.direction = digitalio.Direction.OUTPUT
        self.sensor = adafruit_max31865.MAX31865(self.spi, self.cs, rtd_nominal=100, ref_resistor=430.0, wires=3)

    def read_temperature(self):
        return self.sensor.temperature