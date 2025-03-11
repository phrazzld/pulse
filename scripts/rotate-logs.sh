#!/bin/bash
# Simple script to rotate logs

# Configuration
LOG_DIR="logs"
MAX_LOGS=5
APP_LOG="app.log"

# Create logs directory if it doesn't exist
mkdir -p "$LOG_DIR"

# Check if main log file exists and has content
if [ -s "$LOG_DIR/$APP_LOG" ]; then
  # Get current timestamp for the rotated log
  TIMESTAMP=$(date +"%Y%m%d-%H%M%S")
  
  # Rotate the current log
  mv "$LOG_DIR/$APP_LOG" "$LOG_DIR/app-$TIMESTAMP.log"
  
  # Create a new empty log file
  touch "$LOG_DIR/$APP_LOG"
  
  echo "Rotated log to app-$TIMESTAMP.log"
  
  # Count existing rotated logs
  ROTATED_LOGS=$(ls -1 "$LOG_DIR"/app-*.log 2>/dev/null | wc -l)
  
  # Remove oldest logs if we exceed the maximum
  if [ "$ROTATED_LOGS" -gt "$MAX_LOGS" ]; then
    # Get a list of logs sorted by date (oldest first)
    LOGS_TO_REMOVE=$(ls -1t "$LOG_DIR"/app-*.log | tail -n +$(($MAX_LOGS+1)))
    
    # Remove excess logs
    for LOG in $LOGS_TO_REMOVE; do
      rm "$LOG"
      echo "Removed old log: $LOG"
    done
  fi
else
  echo "Log file is empty or doesn't exist. Creating a new one."
  touch "$LOG_DIR/$APP_LOG"
fi

echo "Log rotation completed. Max logs: $MAX_LOGS"