Disclaimer: I am not a developer by any stretch, so forgive my ignorance when it comes to the structure. 

# MasterPI
 RPi controller for Masterbuilt gravity fed smokers

 This is a work in progress and inspired by Nebhead's PiFire build for pellet smokers: https://github.com/nebhead/PiFire 
 
 Initially I was going to branch from his code, but after reviewing it I determined there are too many differences with the gravity fed line of smokers vs. the pellet ones.
 
  The idea, however, is to build a replacement controller for my Masterbuilt 1050 smoker since the original one broke. I have aspirations of doing the following:

 1. Allow for 5+1 temp probes - 1 probe for grill temp, 5 additional for meat.
 2. Fan control - this is similar to the existing setup by Masterbuilt. Turn the fan on if temps get lower than grill target, but use PID and allow for autotune... maybe
 3. Damper control - The smoker has two dampers that are intended to be used to suffocate the fire from the gravity fed charcoal/wood box. I intend to add motorized dampers to automate this at the end of a cook, but also as a safety measure for flame ups.
 4. The controller will have both an SPI touch panel display with rotory encoder as well as a web dashboard.

 
