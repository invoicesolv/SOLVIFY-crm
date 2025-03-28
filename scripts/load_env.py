import os
from pathlib import Path
from dotenv import load_dotenv
import logging

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Get the project root directory (where .env file is located)
root_dir = Path(__file__).parent.parent
env_path = root_dir / '.env'

logger.info(f"Looking for .env file at: {env_path}")
logger.info(f"File exists: {env_path.exists()}")

# Load the environment variables from .env file
load_dotenv(dotenv_path=env_path)

# Verify the API key is loaded
api_key = os.getenv('OPENAI_API_KEY')
if not api_key:
    raise ValueError("OpenAI API key not found in .env file")

logger.info(f"API key loaded successfully (length: {len(api_key)})")
logger.info(f"First 4 chars of API key: {api_key[:4]}")  # Only log first 4 chars for security 