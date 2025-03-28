import os
import json
import sys
import logging
from typing import Dict, List, Optional
from datetime import datetime
import openai
from dotenv import load_dotenv

# Get the absolute path to the project root
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.abspath(os.path.join(SCRIPT_DIR, '..', '..', '..'))

# Load environment variables from project root .env
load_dotenv(os.path.join(PROJECT_ROOT, '.env'))

# Configure OpenAI
openai.api_key = os.getenv('OPENAI_API_KEY')

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def read_receipts_file(file_path: str) -> List[Dict[str, str]]:
    """Read the receipts file and split into individual receipts."""
    receipts = []
    current_receipt = None
    
    with open(file_path, 'r', encoding='utf-8') as f:
        lines = f.readlines()
    
    for line in lines:
        line = line.strip()
        if line.startswith('_' * 50):
            if current_receipt:
                receipts.append(current_receipt)
            current_receipt = {'filename': '', 'content': ''}
        elif line.startswith('File:') and current_receipt:
            current_receipt['filename'] = line.replace('File:', '').strip()
        elif current_receipt:
            current_receipt['content'] += line + '\n'
    
    # Add the last receipt
    if current_receipt:
        receipts.append(current_receipt)
    
    return receipts

def clean_receipt_with_gpt(receipt: Dict[str, str]) -> Dict:
    """Process a single receipt with GPT to extract structured information."""
    try:
        # Check for Cursor receipt
        is_cursor_receipt = (
            'cursor.so' in receipt['content'].lower() or
            'cursor.com' in receipt['content'].lower() or
            'cursor pro subscription' in receipt['content'].lower()
        )

        prompt = f"""Analyze this receipt text and extract:
        1. Company/Merchant Name (look for company name, vendor, or business entity)
        2. Date (YYYY-MM-DD format, look for invoice date, receipt date, or transaction date)
        3. Total Amount (decimal number, look for total, amount due, or final price)
        4. Additional Details (include invoice/receipt number, items purchased, or services rendered)

        {'This appears to be a Cursor receipt. Please look carefully for:' if is_cursor_receipt else ''}
        {'- Receipt numbers like "54FCB931-xxxx" or numbers in format "2XXX-XXXX"' if is_cursor_receipt else ''}
        {'- Subscription details and periods' if is_cursor_receipt else ''}
        {'- Amount in USD' if is_cursor_receipt else ''}
        {'- The merchant name should be set to "Cursor"' if is_cursor_receipt else ''}
        {'- Look for subscription period dates to determine receipt date' if is_cursor_receipt else ''}

        For OpenAI receipts, look for:
        - Invoice/Receipt number starting with numbers like "2xxx-xxxx"
        - Amount in USD (usually $5, $10, $15, etc.)
        - Date in the receipt number or document

        Filename: {receipt['filename']}
        Text to analyze:
        {receipt['content']}

        Return as JSON:
        {{
            "merchant": "full business name",
            "date": "YYYY-MM-DD",
            "amount": decimal_number,
            "details": "relevant details",
            "confidence": "high/medium/low"
        }}
        Use null if unsure about any field. Be thorough in extracting information."""

        response = openai.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[
                {"role": "system", "content": "You are a document analysis expert specialized in processing receipts and invoices from technology companies like OpenAI, Cursor, Slack, and others. Extract information precisely. For Cursor receipts, always set merchant as 'Cursor' if any Cursor-related identifiers are found. Use null if uncertain."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.3
        )

        cleaned_data = json.loads(response.choices[0].message.content)
        
        # Force merchant name for Cursor receipts
        if is_cursor_receipt:
            cleaned_data['merchant'] = 'Cursor'
        
        # Ensure amount is float or None
        if cleaned_data.get('amount') is not None:
            try:
                cleaned_data['amount'] = float(cleaned_data['amount'])
            except (ValueError, TypeError):
                cleaned_data['amount'] = None
        
        cleaned_data['original_filename'] = receipt['filename']
        return cleaned_data

    except Exception as e:
        logger.error(f"Error cleaning receipt {receipt['filename']}: {e}")
        return {
            "merchant": None,
            "date": None,
            "amount": None,
            "details": None,
            "confidence": "error",
            "error": str(e),
            "original_filename": receipt['filename']
        }

def main():
    try:
        # Read the receipts file
        receipts_file = os.path.join(PROJECT_ROOT, 'public', 'receipts', 'all_receipts.txt')
        if not os.path.exists(receipts_file):
            raise ValueError(f"Receipts file not found: {receipts_file}")

        # Read and split receipts
        receipts = read_receipts_file(receipts_file)
        logger.info(f"Found {len(receipts)} receipts to process")

        # Process each receipt
        cleaned_receipts = []
        for receipt in receipts:
            logger.info(f"Processing receipt: {receipt['filename']}")
            cleaned = clean_receipt_with_gpt(receipt)
            cleaned_receipts.append(cleaned)
            # Print progress
            print(f"\nProcessed: {receipt['filename']}")
            print("-" * 40)
            print(f"Merchant: {cleaned['merchant'] or 'Not found'}")
            print(f"Date: {cleaned['date'] or 'Not found'}")
            print(f"Amount: {cleaned['amount'] or 'Not found'}")
            print(f"Details: {cleaned['details'] or 'Not found'}")
            print(f"Confidence: {cleaned['confidence']}")

        # Save cleaned results
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        output_file = os.path.join(PROJECT_ROOT, 'public', 'receipts', f'cleaned_receipts_{timestamp}.txt')
        
        with open(output_file, 'w', encoding='utf-8') as f:
            f.write(f"Cleaned Receipts - {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n\n")
            
            for receipt in cleaned_receipts:
                f.write("_" * 50 + "\n")
                f.write(f"File: {receipt['original_filename']}\n")
                f.write("_" * 50 + "\n")
                f.write(f"Merchant: {receipt['merchant'] or 'Not found'}\n")
                f.write(f"Date: {receipt['date'] or 'Not found'}\n")
                f.write(f"Amount: {receipt['amount'] or 'Not found'}\n")
                f.write(f"Details: {receipt['details'] or 'Not found'}\n")
                f.write(f"Confidence: {receipt['confidence']}\n")
                f.write("\n")

        # Also save as JSON for programmatic access
        json_file = os.path.join(PROJECT_ROOT, 'public', 'receipts', f'cleaned_receipts_{timestamp}.json')
        with open(json_file, 'w', encoding='utf-8') as f:
            json.dump({
                "timestamp": datetime.now().isoformat(),
                "receipts": cleaned_receipts
            }, f, indent=2)

        print(f"\nProcessing complete! Results saved to:")
        print(f"Text file: {output_file}")
        print(f"JSON file: {json_file}")

    except Exception as e:
        logger.error(f"Error in main: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main() 