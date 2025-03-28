#!/usr/bin/env python3

import sys
import json
import os
import argparse
from datetime import datetime
from pathlib import Path
import logging
import traceback
from typing import List, Dict, Any, Optional
from dataclasses import dataclass, asdict

# Configure logging first, before any other imports
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('receipt_processing.log'),
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger(__name__)

# Load environment variables first
try:
    from load_env import load_dotenv
    load_dotenv()
    logger.info("Environment variables loaded successfully")
    api_key = os.getenv('OPENAI_API_KEY')
    logger.info(f"OpenAI API key found: {'Yes' if api_key else 'No'}")
    logger.info(f"API key length: {len(api_key) if api_key else 0}")
except Exception as e:
    print(json.dumps({
        "stage": "error",
        "progress": 0,
        "message": f"Failed to load environment variables: {str(e)}"
    }), flush=True)
    sys.exit(1)

try:
    import pytesseract
    from pdf2image import convert_from_path
    import openai
    from openai import OpenAI
    import PyPDF2
    import cv2
    import numpy as np
    from PIL import Image
    
    # Add import for HEIC support
    try:
        from pillow_heif import register_heif_opener
        register_heif_opener()
        logger.info("Successfully registered HEIF/HEIC opener")
    except ImportError:
        logger.warning("pillow_heif not available, HEIC files will not be supported")
    
    logger.info("Successfully imported all required packages")
except Exception as e:
    error_msg = f"Failed to import required packages: {str(e)}\n{traceback.format_exc()}"
    logger.error(error_msg)
    print(json.dumps({
        "stage": "initialization",
        "progress": 0,
        "message": f"Import error: {str(e)}"
    }), flush=True)
    sys.exit(1)

# Initialize OpenAI client
try:
    logger.info("Initializing OpenAI client...")
    # Read API key directly from .env file
    env_path = Path(__file__).parent.parent / '.env'
    logger.info(f"Looking for .env file at: {env_path}")
    
    if not env_path.exists():
        logger.error(f".env file not found at {env_path}")
        raise FileNotFoundError(f".env file not found at {env_path}")
        
    with open(env_path, 'r') as f:
        for line in f:
            if line.startswith('OPENAI_API_KEY='):
                api_key = line.strip().split('=', 1)[1].strip()  # Make sure to strip any whitespace
                # Log key details without exposing the full key
                logger.info(f"API key found in .env file:")
                logger.info(f"- Length: {len(api_key)}")
                logger.info(f"- Prefix: {api_key[:15]}...")  # Show more of prefix to verify format
                logger.info(f"- Contains whitespace: {' ' in api_key}")
                logger.info(f"- Contains newlines: {chr(10) in api_key or chr(13) in api_key}")
                logger.info(f"- Is project key: {api_key.startswith('sk-proj-')}")
                break
    
    if not api_key:
        raise ValueError("OpenAI API key not found in .env file")
    
    # Initialize client with detailed logging
    logger.info("Configuring OpenAI client...")
    client_config = {
        "api_key": api_key,
        "base_url": "https://api.openai.com/v1"
    }
    logger.info(f"Client configuration:")
    logger.info(f"- Base URL: {client_config['base_url']}")
    logger.info(f"- API Key prefix: {client_config['api_key'][:15]}...")
    
    client = OpenAI(**client_config)
    
    logger.info("Testing OpenAI client connection...")
    try:
        response = client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[{"role": "system", "content": "Test connection"}],
            max_tokens=1
        )
        logger.info("✓ OpenAI client connection test successful")
        logger.info(f"Response received: {response.model}")
    except Exception as e:
        logger.error(f"OpenAI client connection test failed with error: {str(e)}")
        logger.error(f"Error type: {type(e).__name__}")
        logger.error(f"Full error details: {traceback.format_exc()}")
        raise
    
    print(json.dumps({
        "stage": "initialization",
        "progress": 10,
        "message": "Successfully initialized OpenAI client"
    }), flush=True)
except Exception as e:
    error_msg = f"Failed to initialize OpenAI client: {str(e)}\nTraceback: {traceback.format_exc()}"
    logger.error(error_msg)
    print(json.dumps({
        "stage": "error",
        "progress": 0,
        "message": error_msg
    }), flush=True)
    sys.exit(1)

def send_progress(stage: str, progress: int, message: str):
    """Send progress update to stdout."""
    progress_data = {
        "stage": stage,
        "progress": progress,
        "message": message
    }
    print(json.dumps(progress_data), flush=True)
    sys.stdout.flush()

@dataclass
class Receipt:
    id: str
    filename: str
    supplier_name: str
    invoice_number: str
    date: str
    total_amount: float
    vat_amount: float
    currency: str
    confidence_score: float
    line_items: List[Dict[str, Any]]
    error: Optional[str] = None

def process_directory(directory: str) -> List[Receipt]:
    """Process all receipts in a directory."""
    logger.info(f"Processing directory: {directory}")
    receipts = []
    errors = []
    
    if not os.path.exists(directory):
        logger.error(f"Directory not found: {directory}")
        return []
    
    for root, _, files in os.walk(directory):
        for file in files:
            # Add HEIC to supported file types
            if file.lower().endswith(('.pdf', '.jpg', '.jpeg', '.png', '.heic')):
                file_path = os.path.join(root, file)
                try:
                    logger.info(f"Processing file: {file}")
                    
                    # Extract text based on file type
                    if file.lower().endswith('.pdf'):
                        extracted_text = extract_text_from_pdf(file_path)
                    elif file.lower().endswith('.heic'):
                        # For HEIC files, convert to PIL Image first
                        image = convert_heic_to_pil(file_path)
                        processed_image = preprocess_image(image)
                        extracted_text = pytesseract.image_to_string(processed_image)
                    else:
                        # For other image formats
                        extracted_text = extract_text_from_image(file_path)
                    
                    if not extracted_text:
                        raise Exception("No text could be extracted")
                    
                    # Parse with GPT
                    parsed_data = parse_receipt_with_gpt(extracted_text)
                    
                    # Create Receipt object
                    receipt = Receipt(
                        id=file,
                        filename=file,
                        supplier_name=parsed_data.get('supplier_name', 'Unknown'),
                        invoice_number=parsed_data.get('invoice_number', 'Unknown'),
                        date=parsed_data.get('date', datetime.now().strftime('%Y-%m-%d')),
                        total_amount=float(parsed_data.get('total_amount', 0)),
                        vat_amount=float(parsed_data.get('vat_amount', 0)),
                        currency=parsed_data.get('currency', 'SEK'),
                        confidence_score=float(parsed_data.get('confidence_score', 0)),
                        line_items=parsed_data.get('line_items', []),
                        error=parsed_data.get('error')
                    )
                    receipts.append(receipt)
                    
                except Exception as e:
                    error_msg = f"Error processing {file}: {str(e)}"
                    logger.error(error_msg)
                    logger.error(traceback.format_exc())
                    errors.append(error_msg)
                    receipts.append(Receipt(
                        id=file,
                        filename=file,
                        supplier_name='Error',
                        invoice_number='Error',
                        date=datetime.now().strftime('%Y-%m-%d'),
                        total_amount=0,
                        vat_amount=0,
                        currency='SEK',
                        confidence_score=0,
                        line_items=[],
                        error=str(e)
                    ))
    
    return receipts

def match_receipts_with_transactions(receipts: List[Receipt], transactions: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Match receipts with transactions based on amount and date."""
    logger.info("Matching receipts with transactions")
    matches = []
    
    for receipt in receipts:
        receipt_matches = []
        receipt_date = datetime.strptime(receipt.date, '%Y-%m-%d')
        
        for transaction in transactions:
            try:
                # Parse transaction date
                trans_date = datetime.strptime(transaction.get('date', ''), '%Y-%m-%d')
                
                # Calculate date difference in days
                date_diff = abs((receipt_date - trans_date).days)
                
                # Compare amounts (with small tolerance for rounding)
                amount_diff = abs(float(receipt.total_amount) - float(transaction.get('amount', 0)))
                
                # Calculate confidence score based on date and amount matching
                confidence = 0.0
                if date_diff == 0:
                    confidence += 0.5
                elif date_diff <= 2:
                    confidence += 0.3
                elif date_diff <= 5:
                    confidence += 0.1
                
                if amount_diff < 0.01:
                    confidence += 0.5
                elif amount_diff < 1.0:
                    confidence += 0.3
                elif amount_diff < 5.0:
                    confidence += 0.1
                
                if confidence > 0:
                    receipt_matches.append({
                        'transaction_id': transaction.get('id'),
                        'confidence': round(confidence * 100),
                        'date_difference': date_diff,
                        'amount_difference': amount_diff,
                        'transaction_data': transaction
                    })
            except Exception as e:
                logger.error(f"Error matching transaction: {str(e)}")
                continue
        
        if receipt_matches:
            # Sort matches by confidence
            receipt_matches.sort(key=lambda x: x['confidence'], reverse=True)
            matches.append({
                'receipt_id': receipt.id,
                'receipt_data': asdict(receipt),
                'matches': receipt_matches
            })
    
    return matches

def preprocess_image(image):
    """Preprocess image to improve OCR accuracy."""
    try:
        logger.info("Converting image to grayscale")
        gray = cv2.cvtColor(np.array(image), cv2.COLOR_RGB2GRAY)
        
        logger.info("Applying adaptive thresholding")
        thresh = cv2.adaptiveThreshold(
            gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, 
            cv2.THRESH_BINARY, 11, 2
        )
        
        logger.info("Applying dilation")
        kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (3,3))
        dilation = cv2.dilate(thresh, kernel, iterations=1)
        
        logger.info("Image preprocessing completed successfully")
        return Image.fromarray(dilation)
    except Exception as e:
        logger.error(f"Error in image preprocessing: {str(e)}")
        raise

def extract_text_from_pdf(pdf_path):
    """Extract text from PDF using OCR and PDF text extraction."""
    try:
        text_content = []
        logger.info(f"Processing PDF: {pdf_path}")
        
        # Report progress
        send_progress("pdf_processing", 10, "Starting PDF processing")
        
        # First try to extract text directly from PDF
        with open(pdf_path, 'rb') as file:
            pdf_reader = PyPDF2.PdfReader(file)
            for page_num, page in enumerate(pdf_reader.pages):
                logger.info(f"Extracting text from page {page_num + 1}")
                send_progress("text_extraction", 20 + (page_num * 10), f"Extracting text from page {page_num + 1}")
                text = page.extract_text()
                if text.strip():
                    text_content.append(text)
                    logger.info(f"Successfully extracted text from page {page_num + 1}")
        
        # If no text was extracted, use OCR
        if not text_content:
            logger.info("No text extracted directly from PDF, attempting OCR")
            send_progress("ocr_processing", 50, "Starting OCR processing")
            images = convert_from_path(pdf_path)
            
            for page_num, image in enumerate(images):
                logger.info(f"Processing page {page_num + 1} with OCR")
                send_progress("ocr_processing", 60 + (page_num * 10), f"OCR processing page {page_num + 1}")
                processed_image = preprocess_image(image)
                text = pytesseract.image_to_string(processed_image)
                if text.strip():
                    text_content.append(text)
                    logger.info(f"Successfully extracted text from page {page_num + 1} using OCR")
        
        if not text_content:
            raise Exception("No text could be extracted from the PDF")
            
        send_progress("text_extraction", 80, "Text extraction complete")
        return '\n'.join(text_content)
    except Exception as e:
        logger.error(f"Error extracting text from PDF: {str(e)}")
        logger.error(traceback.format_exc())
        return None

def extract_text_from_image(image_path: str) -> str:
    """Extract text from an image file using OCR."""
    try:
        logger.info(f"Processing image: {image_path}")
        send_progress("image_processing", 10, "Starting image processing")
        
        # Open and preprocess the image
        image = Image.open(image_path)
        processed_image = preprocess_image(image)
        
        send_progress("ocr_processing", 50, "Starting OCR processing")
        # Perform OCR
        text = pytesseract.image_to_string(processed_image)
        
        if not text.strip():
            raise Exception("No text could be extracted from the image")
            
        send_progress("text_extraction", 80, "Text extraction complete")
        return text
    except Exception as e:
        logger.error(f"Error extracting text from image: {str(e)}")
        logger.error(traceback.format_exc())
        return None

def parse_receipt_with_gpt(text):
    """Parse receipt text using GPT to extract structured data."""
    try:
        if not text or not text.strip():
            raise ValueError("No text provided for analysis")

        logger.info("Sending text to GPT for analysis")
        send_progress("gpt_analysis", 85, "Analyzing text with GPT")
        
        # Create a focused prompt for financial information extraction
        prompt = f"""Extract the following financial information from this receipt/invoice text. Format the response as JSON:

Required fields:
- supplier_name: The company issuing the receipt/invoice
- invoice_number: The invoice or receipt number
- date: The payment/invoice date (YYYY-MM-DD format)
- total_amount: The total amount (as a number)
- currency: The currency code (e.g., SEK, USD)
- vat_amount: The VAT/tax amount (as a number)

Optional fields (include if found):
- line_items: Array of items, each with:
  - description: Item description
  - quantity: Number of items
  - unit_price: Price per unit
  - total: Total price for this item
  - vat_rate: VAT rate as percentage

Additional rules:
1. Convert all amounts to numbers (remove currency symbols and separators)
2. Use standard date format (YYYY-MM-DD)
3. If VAT is given as percentage, calculate the amount
4. For supplier name, use the official company name if found
5. For invoice number, include any prefix/suffix if present
6. If multiple dates found, prefer invoice date over other dates
7. If multiple totals found, use the final/grand total
8. If currency not explicitly stated, try to infer from symbols (€->EUR, $->USD, etc.)
9. Calculate VAT amount if only percentage is given
10. Assign confidence based on completeness and clarity of data

Receipt text:
{text}

Respond only with the JSON object, no additional text."""

        # Call GPT with the focused prompt, using a more cost-effective model
        response = client.chat.completions.create(
            model="gpt-3.5-turbo",  # More cost-effective than GPT-4
            messages=[
                {"role": "system", "content": "You are a financial document parser that extracts structured data from receipts and invoices. Be precise with numbers and dates."},
                {"role": "user", "content": prompt}
            ],
            response_format={ "type": "json_object" },
            temperature=0.1  # Lower temperature for more consistent results
        )

        # Parse GPT's response
        parsed_data = json.loads(response.choices[0].message.content)
        logger.info("Successfully received and parsed GPT response")
        send_progress("gpt_analysis", 95, "GPT analysis complete")
        
        # Add confidence score if not present
        if 'confidence_score' not in parsed_data:
            required_fields = ['supplier_name', 'invoice_number', 'date', 'total_amount', 'currency', 'vat_amount']
            confidence = sum(1 for field in required_fields if field in parsed_data and parsed_data[field]) / len(required_fields)
            parsed_data['confidence_score'] = round(confidence, 2)
        
        # Ensure all required fields are present
        for field in ['supplier_name', 'invoice_number', 'date', 'total_amount', 'currency', 'vat_amount']:
            if field not in parsed_data or not parsed_data[field]:
                if field in ['total_amount', 'vat_amount']:
                    parsed_data[field] = 0
                else:
                    parsed_data[field] = 'Unknown'
        
        # Ensure line_items is always an array
        if 'line_items' not in parsed_data:
            parsed_data['line_items'] = []
        
        send_progress("complete", 100, "Receipt analysis complete")
        return parsed_data

    except Exception as e:
        logger.error(f"Error parsing with GPT: {str(e)}")
        logger.error(traceback.format_exc())
        return {
            'error': str(e),
            'supplier_name': 'Error',
            'invoice_number': 'Error',
            'date': datetime.now().strftime('%Y-%m-%d'),
            'total_amount': 0,
            'vat_amount': 0,
            'currency': 'SEK',
            'confidence_score': 0,
            'line_items': []
        }

# Add function to convert HEIC to PIL Image
def convert_heic_to_pil(file_path):
    """Convert HEIC file to PIL Image."""
    try:
        logger.info(f"Converting HEIC file: {file_path}")
        send_progress("image_processing", 10, "Converting HEIC file")
        
        # Open HEIC file using pillow_heif
        image = Image.open(file_path)
        logger.info(f"Successfully converted HEIC file to PIL Image")
        return image
    except Exception as e:
        logger.error(f"Error converting HEIC file: {str(e)}")
        logger.error(traceback.format_exc())
        raise

if __name__ == '__main__':
    try:
        parser = argparse.ArgumentParser(description='Process and analyze receipts')
        parser.add_argument('--scan', help='Scan directory for receipts')
        parser.add_argument('--match', help='Match receipts with transactions')
        parser.add_argument('file_path', nargs='?', help='Single receipt file to process')
        parser.add_argument('transactions_json', nargs='?', help='JSON string of transactions for matching')
        args = parser.parse_args()
        
        logger.info(f"Starting receipt analysis with args: {args}")
        print(json.dumps({
            "stage": "initialization",
            "progress": 10,
            "message": "Starting receipt analysis"
        }), flush=True)
        
        if args.scan:
            # Process all receipts in directory
            logger.info(f"Scanning directory: {args.scan}")
            receipts = process_directory(args.scan)
            result = {
                'stats': {
                    'total': len(receipts),
                    'matched': 0,
                    'unmatched': len(receipts)
                },
                'receipts': [asdict(r) for r in receipts]
            }
            print(json.dumps(result, ensure_ascii=False))
            
        elif args.match and args.transactions_json:
            # Match receipts with transactions
            logger.info("Starting receipt matching process")
            receipts = process_directory(args.match)
            transactions = json.loads(args.transactions_json)
            matches = match_receipts_with_transactions(receipts, transactions)
            print(json.dumps({'matches': matches}, ensure_ascii=False))
            
        elif args.file_path:
            # Process single receipt
            logger.info(f"Processing single receipt: {args.file_path}")
            if not Path(args.file_path).is_file():
                error_msg = f'File not found: {args.file_path}'
                logger.error(error_msg)
                print(json.dumps({
                    "stage": "error",
                    "progress": 0,
                    "message": error_msg
                }), flush=True)
                sys.exit(1)
            
            print(json.dumps({
                "stage": "processing",
                "progress": 20,
                "message": f"Processing file: {args.file_path}"
            }), flush=True)
            
            # Handle different file types
            file_path = args.file_path.lower()
            if file_path.endswith('.pdf'):
                extracted_text = extract_text_from_pdf(args.file_path)
            elif file_path.endswith('.heic'):
                # For HEIC files, convert to PIL Image first
                image = convert_heic_to_pil(args.file_path)
                processed_image = preprocess_image(image)
                extracted_text = pytesseract.image_to_string(processed_image)
            else:
                # For other image formats
                extracted_text = extract_text_from_image(args.file_path)
                
            if not extracted_text:
                error_msg = 'Failed to extract text from file'
                logger.error(error_msg)
                print(json.dumps({
                    "stage": "error",
                    "progress": 0,
                    "message": error_msg
                }), flush=True)
                sys.exit(1)
            
            result = parse_receipt_with_gpt(extracted_text)
            print(json.dumps({
                "stage": "complete",
                "progress": 100,
                "message": "Analysis complete",
                "data": result
            }, ensure_ascii=False), flush=True)
            
        else:
            error_msg = 'Invalid arguments'
            logger.error(error_msg)
            print(json.dumps({
                "stage": "error",
                "progress": 0,
                "message": error_msg
            }), flush=True)
            parser.print_help()
            sys.exit(1)
            
    except Exception as e:
        error_msg = f"Fatal error: {str(e)}\n{traceback.format_exc()}"
        logger.error(error_msg)
        print(json.dumps({
            "stage": "error",
            "progress": 0,
            "message": f"Fatal error: {str(e)}"
        }), flush=True)
        sys.exit(1) 