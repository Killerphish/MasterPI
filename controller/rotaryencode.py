import RPi.GPIO as GPIO

CLK = 17
DT = 27
SW = 22

GPIO.setmode(GPIO.BCM)
GPIO.setup(CLK, GPIO.IN, pull_up_down=GPIO.PUD_UP)
GPIO.setup(DT, GPIO.IN, pull_up_down=GPIO.PUD_UP)
GPIO.setup(SW, GPIO.IN, pull_up_down=GPIO.PUD_UP)

counter = 0
clk_last_state = GPIO.input(CLK)

def rotary_encoder():
    global counter, clk_last_state
    clk_state = GPIO.input(CLK)
    dt_state = GPIO.input(DT)
    
    if clk_state != clk_last_state:
        if dt_state != clk_state:
            counter += 1
        else:
            counter -= 1
        print(counter)
    clk_last_state = clk_state

if __name__ == "__main__":
    try:
        while True:
            rotary_encoder()
            time.sleep(0.01)
    finally:
        GPIO.cleanup()