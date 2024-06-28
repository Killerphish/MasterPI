#!/bin/bash

# Define the cron job command
CRON_COMMAND="python3 /$HOME/MasterPI/update.py"

# Remove the cron job
(crontab -l | grep -v "$CRON_COMMAND" ) | crontab -

echo "Cron job for auto update removed."