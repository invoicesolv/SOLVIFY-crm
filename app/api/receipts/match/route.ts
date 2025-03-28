import { NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';

export async function POST(req: Request): Promise<Response> {
  try {
    const { directory, transactions } = await req.json();
    
    // Spawn Python process using virtual environment
    const pythonProcess = spawn('python3', [
      path.join(process.cwd(), 'app/api/receipts/process.py'),
      '--match',
      directory,
      JSON.stringify(transactions)
    ], {
      env: {
        ...process.env,
        PYTHONPATH: path.join(process.cwd(), '.venv/lib/python3.13/site-packages'),
        PATH: `${process.env.PATH}:/usr/local/bin:/opt/homebrew/bin`, // Include Homebrew paths for Tesseract
        PYTHONUNBUFFERED: '1'
      }
    });
    
    return new Promise<Response>((resolve, reject) => {
      let output = '';
      let error = '';
      
      pythonProcess.stdout.on('data', (data) => {
        output += data.toString();
      });
      
      pythonProcess.stderr.on('data', (data) => {
        error += data.toString();
        console.error('Python stderr:', data.toString());
      });
      
      pythonProcess.on('close', (code) => {
        if (code !== 0) {
          console.error('Python process error:', error);
          resolve(NextResponse.json(
            { error: 'Failed to match receipts' },
            { status: 500 }
          ));
          return;
        }
        
        try {
          const matches = JSON.parse(output);
          resolve(NextResponse.json({ matches }));
        } catch (e) {
          console.error('Failed to parse Python output:', e);
          console.error('Raw output:', output);
          resolve(NextResponse.json(
            { error: 'Invalid output format' },
            { status: 500 }
          ));
        }
      });
    });
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 