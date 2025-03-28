#!/usr/bin/env python3

import os
import logging
from openai import OpenAI

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)

# Get API key from environment
api_key = os.getenv('OPENAI_API_KEY')
if not api_key:
    logging.error("OPENAI_API_KEY environment variable is not set")
    raise ValueError("OPENAI_API_KEY environment variable is not set")

try:
    # Initialize client with minimal configuration
    client = OpenAI()  # It will automatically use OPENAI_API_KEY from environment
    
    # Test the connection
    models = client.models.list()
    logging.info("Successfully connected to OpenAI")
    logging.info("Available models: %s", [model.id for model in models.data])
except Exception as e:
    logging.error("Failed to initialize OpenAI client: %s", str(e))
    raise 