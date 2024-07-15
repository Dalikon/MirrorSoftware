# Hardware
- Motion sensor
- light sensor
- air quality sensor
- microphone
- camera
- basic speakers
- buttons
- fingerprint reader
- LED osvětlení
- An PCB that would host connectors for the sensors and power attached to the RPi GPIO header.

# Client part
All mirrors will have the same client suff

- Script/program that would handle all of HW (getting data from sensors, turning LED's on/off,...) and forwarding it to main client instance
- MagicMirror client with a module that will integrate it with the mirror system. It would include user handeling, pages, etc.
    - Or creating own MM derivative that would work simillary, but build from start with the intent of the mirror system. It would solve problems with user management.
- Main client will be a python flask program that would be a mediator between the master mirror and HW side of said mirror. It would sent out sensor data and recieve information from master mirror (not much about the display sw, that will be handeled seperately)

# Server part
Every mirror system would need an central mirror called master mirror. It's job would be to host the MM server side and have the extended flask program to be able to proccess other mirror requests.

- Same script/program for handeling HW
- MM client along with the server. All MM clients would communicate mainly with this server (which would host the websites for the mirrors to display)
- Python flask server that would act as all the others but as well as the server that would gather info from other mirrors and save it. It would also be the entry point for the app and its functionality. 

# The App
The app would serve as the basic configurator and a way to connect the mirrors together.
The premise is that after powering on the master mirror for the first time, user could see and connect to it with app by which creating the mirror system for their house. Each other client mirror would then be added with a simillar process with just adding it to the system.  
The main focus of the app would be the configuration of what will be displayed on each mirror. This includes user administration, sharing access to the app by the system creator/admin, etc.  
There would also be a way to show and work with the data from sensor. Probably stuff not that deep. Something like displaying them on mirrors, creating some stats about the household and maybe basic triggres regarding the mirrors themseves (too bad air quality => the mirror would notify the user that there is a problem with air in it's vacinity,...).  
For more advanced functionality I would rely on HomeAssistant.

# Home Assistant Integration
This integration would replace the app and some (maybe all) functionality of the master mirror specific functions.  
All mirrors would account to the integration in the same way they do for the master mirror. The integration would add the possibilities to use data from sensors for other automations within HomeAssistant driven smart home.

# Home Assistant UI
New HA UI elements that would replace the app. It would allow the same things.
