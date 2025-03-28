#!/bin/bash

# Get the directory where the script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$( cd "$SCRIPT_DIR/.." && pwd )"

# Activate virtual environment
source "$PROJECT_ROOT/.venv/bin/activate"

# Set environment variables
export PYTHONPATH="$PROJECT_ROOT/.venv/lib/python3.13/site-packages:$PYTHONPATH"
export PATH="/usr/local/bin:/opt/homebrew/bin:$PATH"
export PYTHONUNBUFFERED=1

# Run the Python script with all arguments passed to this script
python3 "$PROJECT_ROOT/app/api/receipts/process.py" "$@" 