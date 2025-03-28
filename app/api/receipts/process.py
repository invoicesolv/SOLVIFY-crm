import os
import json
import sys
import logging
import fitz
from dataclasses import dataclass
from typing import Dict, Optional
from PIL import Image, ImageEnhance, ImageFilter
import pytesseract
from datetime import datetime

# Get the absolute path to the project root
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.abspath(os.path.join(SCRIPT_DIR, '..', '..', '..'))

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Set Tesseract path explicitly
pytesseract.pytesseract.tesseract_cmd = '/opt/homebrew/bin/tesseract'

@dataclass
class Receipt:
    id: str
    filename: str
    text_content: Dict[str, str]
    file_type: str = 'unknown'

def extract_text_from_pdf(pdf_path: str) -> str:
    """Extract text from PDF file."""
    try:
        text = ""
        doc = fitz.open(pdf_path)
        for page in doc:
            text += page.get_text("text") + "\n"
        doc.close()
        return text.strip()
    except Exception as e:
        logger.error(f"Error extracting text from PDF {pdf_path}: {e}")
        return ""

def preprocess_image(image_path: str) -> Image.Image:
    """Preprocess image for better OCR results."""
    image = Image.open(image_path)
    image = image.convert('L')
    enhancer = ImageEnhance.Contrast(image)
    image = enhancer.enhance(2.0)
    image = image.filter(ImageFilter.SHARPEN)
    image = image.filter(ImageFilter.MedianFilter(size=3))
    return image

def extract_text_from_image(image: Image.Image) -> Dict[str, str]:
    """Extract text from image using multiple languages."""
    languages = {
        'english': 'eng',
        'swedish': 'swe',
        'spanish': 'spa'
    }
    
    text_content = {}
    for lang_name, lang_code in languages.items():
        try:
            text = pytesseract.image_to_string(image, lang=lang_code)
            text_content[lang_name] = text.strip()
        except Exception as e:
            logger.error(f"Error extracting text in {lang_name}: {e}")
            text_content[lang_name] = ""
    
    return text_content

def process_file(file_path: str) -> Receipt:
    """Process a single file (image or PDF)."""
    filename = os.path.basename(file_path)
    try:
        file_type = 'pdf' if filename.lower().endswith('.pdf') else 'image'
        text_content = {}
        
        if file_type == 'pdf':
            text = extract_text_from_pdf(file_path)
            text_content = {'text': text}
        else:
            image = preprocess_image(file_path)
            text_content = extract_text_from_image(image)
        
        return Receipt(
            id=filename,
            filename=filename,
            text_content=text_content,
            file_type=file_type
        )
    except Exception as e:
        logger.error(f"Error processing file {file_path}: {e}")
        return Receipt(
            id=filename,
            filename=filename,
            text_content={"error": str(e)},
            file_type='unknown'
        )

def main():
    try:
        # Use absolute path for receipts directory
        base_dir = os.path.join(PROJECT_ROOT, 'public', 'receipts')
        logger.info(f"Scanning directory: {base_dir}")
        
        if not os.path.exists(base_dir):
            raise ValueError(f"Directory not found: {base_dir}")

        # Create output directory if it doesn't exist
        output_dir = os.path.join(PROJECT_ROOT, 'public', 'receipts')
        os.makedirs(output_dir, exist_ok=True)

        # Create a single output file for all receipts
        output_file = os.path.join(output_dir, 'all_receipts.txt')
        
        with open(output_file, 'w', encoding='utf-8') as f:
            f.write(f"All Receipts - {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n\n")

            # Process images directory
            images_dir = os.path.join(base_dir, 'images')
            if os.path.exists(images_dir):
                logger.info(f"Processing images directory: {images_dir}")
                for filename in os.listdir(images_dir):
                    if filename.lower().endswith(('.jpg', '.jpeg', '.png', '.gif', '.bmp', '.tiff', '.webp')) and not filename.startswith('.'):
                        file_path = os.path.join(images_dir, filename)
                        receipt = process_file(file_path)
                        
                        # Write to file with separator
                        f.write("_" * 50 + "\n")
                        f.write(f"File: {filename}\n")
                        f.write("_" * 50 + "\n")
                        for lang, text in receipt.text_content.items():
                            f.write(f"\n{lang.upper()}:\n{text}\n")
                        f.write("\n")
            
            # Process invoices directory
            invoices_dir = os.path.join(base_dir, 'invoices')
            if os.path.exists(invoices_dir):
                logger.info(f"Processing invoices directory: {invoices_dir}")
                for filename in os.listdir(invoices_dir):
                    if filename.lower().endswith(('.pdf', '.jpg', '.jpeg', '.png')) and not filename.startswith('.'):
                        file_path = os.path.join(invoices_dir, filename)
                        receipt = process_file(file_path)
                        
                        # Write to file with separator
                        f.write("_" * 50 + "\n")
                        f.write(f"File: {filename}\n")
                        f.write("_" * 50 + "\n")
                        for lang, text in receipt.text_content.items():
                            f.write(f"\n{lang.upper()}:\n{text}\n")
                        f.write("\n")

        print(f"\nProcessing complete! All receipts saved to:")
        print(f"File: {output_file}")

    except Exception as e:
        logger.error(f"Error in main: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main() 