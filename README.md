Disclaimer: I am not a developer by any stretch, so forgive my ignorance when it comes to the structure. This is also a work in progress.

Updates as of 8/23/2024: I have the majority of the hardware working. I keep running into bad chips, but that just means I'm adding additional options when it comes to the sensor types. So far I have included support for the following:
* MAX31856 - I'm using this with a K-type probe
* MAX31855 - I might have fried this one when testing the K-type and since swtiched to the 31856 which I think is more versitle.
* MAX31865 - I scrapped this because although I initially was going to use RTD (and still might for some things) I wanted to get the K-type working first.
* ADS1115 - I haven't wired this one up yet, but I'm going to use it with the standard meat probes that use the 3.5mm jack
* Personalization settings - While I was waiting on hardware to arrive I added the ability to personalize the nav, buttons, and background.
* Sensor CS Pin usage - When adding a sensor you can select the CS pin only if it's not in use. Had to include some guardrails of course.
* Ability to edit the config.yaml file from the settings page. I did this as a convenience at first, but I'm leaving it because it's served useful in troubleshooting.

Next on the roadmap:
* I've been having issues with the modals appearing right. There's a background behind them and I can't seem to find what's causing it. It's not a functional problem, but an annoyance.
* I broke the chart when I started working on the settings portion of the app and I want to come up with a way to add/remove charts with the addition or removal of new sensors/probes.
* Adding a probe section that can tie into the sensors. Some of the sensors (ok, amplifiers) can support more than one probe and I need to account for that. My goal for now is to get this working with one sensor/probe and go back to the rest.
* Something to conrol the damper. I want to be able to open and close a damper that I'll install so I can mitigate flame ups, or to shut the system down in an emergency situation. Once I get through the temperature stuff I'll get back into this.
  

# MasterPI
 RPi controller for Masterbuilt gravity fed smokers

 This is a work in progress and inspired by Nebhead's PiFire build for pellet smokers: https://github.com/nebhead/PiFire 
 
 Initially I was going to branch from his code, but after reviewing it I determined there are too many differences with the gravity fed line of smokers vs. the pellet ones.
 
  The idea, however, is to build a replacement controller for my Masterbuilt 1050 smoker since the original one broke. I have aspirations of doing the following:

 1. Allow for 5+1 temp probes - 1 probe for grill temp, 5 additional for meat.
 2. Fan control - this is similar to the existing setup by Masterbuilt. Turn the fan on if temps get lower than grill target, but use PID and allow for autotune... maybe
 3. Damper control - The smoker has two dampers that are intended to be used to suffocate the fire from the gravity fed charcoal/wood box. I intend to add motorized dampers to automate this at the end of a cook, but also as a safety measure for flame ups.
 4. The controller will have both an SPI touch panel display with rotory encoder as well as a web dashboard.

 
