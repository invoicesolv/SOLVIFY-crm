#!/usr/bin/env python3

import json
import sys
import os
from datetime import datetime
from typing import Dict, List, Any, Union, Optional, Tuple
import openai
from difflib import SequenceMatcher
from dateutil.parser import parse
from dateutil.relativedelta import relativedelta
import re

def send_progress(stage: str, progress: float, message: str, data: Dict[str, Any] = None) -> None:
    """Send progress updates as JSON to stdout."""
    output = {
        "stage": stage,
        "progress": progress,
        "message": message
    }
    if data is not None:
        output["data"] = data
    print(json.dumps(output), flush=True)

def normalize_amount(amount: str | float | int) -> float:
    """Normalize amount string to float, handling various formats."""
    if isinstance(amount, (float, int)):
        return float(amount)
    
    # Remove spaces and currency symbols
    amount = str(amount).strip().replace(' ', '')
    amount = re.sub(r'[£$€]', '', amount)
    
    # Convert comma to decimal point if needed
    if ',' in amount and '.' not in amount:
        amount = amount.replace(',', '.')
    elif ',' in amount and '.' in amount:
        amount = amount.replace(',', '')
    
    # Handle negative amounts
    is_negative = amount.startswith('-')
    amount = amount.replace('-', '')
    
    try:
        value = float(amount)
        return -value if is_negative else value
    except ValueError:
        return 0.0

def calculate_match_score(receipt: Dict[str, Any], transaction: Dict[str, Any]) -> Tuple[float, List[str]]:
    """Calculate a match score between a receipt and transaction with detailed reasons."""
    score = 0.0
    reasons = []
    
    # Compare amounts (30% weight)
    receipt_amount = normalize_amount(receipt['total_amount'])
    transaction_amount = normalize_amount(transaction['amount'])
    amount_diff = abs(receipt_amount - abs(transaction_amount))
    amount_threshold = max(receipt_amount, abs(transaction_amount)) * 0.01  # 1% tolerance
    
    if amount_diff <= amount_threshold:
        score += 0.3
        reasons.append(f"Amount matches exactly: {receipt_amount:.2f} = {abs(transaction_amount):.2f}")
    elif amount_diff <= amount_threshold * 3:  # 3% tolerance
        score += 0.2
        reasons.append(f"Amount matches within tolerance: {receipt_amount:.2f} ≈ {abs(transaction_amount):.2f}")
    
    # Compare dates (25% weight)
    receipt_date = datetime.strptime(receipt['date'], '%Y-%m-%d').date()
    transaction_date = datetime.strptime(transaction['date'], '%Y-%m-%d').date()
    date_diff = abs((receipt_date - transaction_date).days)
    
    if date_diff == 0:
        score += 0.25
        reasons.append("Dates match exactly")
    elif date_diff <= 3:
        score += 0.15
        reasons.append(f"Dates are close: {date_diff} days apart")
    elif date_diff <= 7:
        score += 0.1
        reasons.append(f"Dates are within a week: {date_diff} days apart")
    
    # Compare supplier names (25% weight)
    supplier_name = receipt['supplier_name'].lower()
    transaction_ref = transaction['reference'].lower()
    
    if supplier_name in transaction_ref:
        score += 0.25
        reasons.append(f"Supplier name '{supplier_name}' found in transaction reference")
    else:
        # Check for partial matches
        words = supplier_name.split()
        matched_words = [word for word in words if word in transaction_ref]
        if matched_words:
            partial_score = min(len(matched_words) / len(words) * 0.25, 0.15)
            score += partial_score
            reasons.append(f"Partial supplier name match: {', '.join(matched_words)}")
    
    # Check for invoice number in reference (20% weight)
    if receipt.get('invoice_number'):
        invoice_number = str(receipt['invoice_number']).lower()
        if invoice_number in transaction_ref:
            score += 0.2
            reasons.append(f"Invoice number '{invoice_number}' found in transaction reference")
    
    return score, reasons

def match_transactions(data_path: str) -> None:
    """Match receipts with transactions using AI and heuristics."""
    try:
        # Initialize OpenAI client
        client = openai.OpenAI()
        send_progress("init", 0, "Initializing OpenAI client...")
        
        # Test the client with a small request
        client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[{"role": "system", "content": "Test connection"}],
            max_tokens=1
        )
        send_progress("init", 10, "OpenAI client initialized successfully")
        
        # Load the data
        with open(data_path, 'r') as f:
            data = json.load(f)
        
        receipts = data["receipts"]
        transactions = data["transactions"]
        
        send_progress("progress", 20, f"Processing {len(receipts)} receipts and {len(transactions)} transactions")
        
        # Track matches and used items
        matches = []
        used_receipts = set()
        used_transactions = set()
        total_items = len(receipts) * len(transactions)
        processed = 0
        
        # Find matches
        for receipt in receipts:
            best_match = None
            best_score = 0
            best_reasons = []
            
            for transaction in transactions:
                if transaction['id'] in used_transactions:
                    continue
                
                processed += 1
                progress = (processed / total_items) * 100
                
                if processed % 10 == 0:  # Update progress every 10 items
                    send_progress(
                        "progress",
                        progress,
                        f"Analyzing matches... ({len(matches)} found)"
                    )
                
                score, reasons = calculate_match_score(receipt, transaction)
                
                if score > best_score:
                    best_score = score
                    best_match = transaction
                    best_reasons = reasons
            
            # If we found a good match (confidence > 50%)
            if best_match and best_score >= 0.5:
                match_data = {
                    "receipt": receipt,
                    "transaction": best_match,
                    "confidence_score": best_score,
                    "reasons": best_reasons
                }
                matches.append(match_data)
                used_receipts.add(receipt['id'])
                used_transactions.add(best_match['id'])
                
                send_progress("match", progress, "Found match", match_data)
        
        # Prepare summary
        total_matches = len(matches)
        average_confidence = sum(m['confidence_score'] for m in matches) / total_matches if matches else 0
        
        summary = {
            "total_matches": total_matches,
            "unmatched_receipts": len(receipts) - total_matches,
            "unmatched_transactions": len(transactions) - total_matches,
            "average_confidence": average_confidence
        }
        
        send_progress("summary", 100, "Matching complete", summary)
        
        # Send unmatched items
        unmatched = {
            "receipts": [r for r in receipts if r['id'] not in used_receipts],
            "transactions": [t for t in transactions if t['id'] not in used_transactions]
        }
        
        send_progress("unmatched", 100, "Unmatched items identified", unmatched)
        
        send_progress("complete", 100, "Processing complete")
        
    except Exception as e:
        send_progress("error", 0, f"Error: {str(e)}")
        sys.exit(1)

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python match_transactions.py <data_path>")
        sys.exit(1)
    
    match_transactions(sys.argv[1]) 