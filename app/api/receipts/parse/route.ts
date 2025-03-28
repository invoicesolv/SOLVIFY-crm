import { NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';

const logError = (message: string, error?: any) => {
  const timestamp = new Date().toISOString();
  const errorMessage = error ? `${message}: ${error.message}\n${error.stack}` : message;
  fs.appendFileSync('receipt_processing.log', `${timestamp} - ERROR - ${errorMessage}\n`);
};

export async function POST(request: Request) {
  try {
    const { filename } = await request.json();
    
    // Validate file extension
    const allowedExtensions = ['.jpg', '.jpeg', '.png', '.pdf', '.heic'];
    const fileExtension = path.extname(filename).toLowerCase();
    if (!allowedExtensions.includes(fileExtension)) {
      logError(`Invalid file format: ${fileExtension}. Allowed formats: ${allowedExtensions.join(', ')}`);
      return NextResponse.json({ error: 'Invalid file format' }, { status: 400 });
    }
    
    // Get the absolute paths to the script and possible file locations
    const scriptPath = path.join(process.cwd(), 'app/api/receipts', 'process.py');
    const invoicesPath = path.join(process.cwd(), 'public', 'receipts', 'invoices', filename);
    const imagesPath = path.join(process.cwd(), 'public', 'receipts', 'images', filename);
    const venvPath = path.join(process.cwd(), '.venv');
    const pythonPath = path.join(venvPath, 'bin', 'python');
    const sitePackagesPath = path.join(venvPath, 'lib', 'python3.13', 'site-packages');
    
    // Log initial state
    console.log('Script path:', scriptPath);
    console.log('Invoices path:', invoicesPath);
    console.log('Images path:', imagesPath);
    console.log('Virtual env path:', venvPath);
    console.log('Python path:', pythonPath);
    console.log('Site packages path:', sitePackagesPath);
    
    // Check if script exists
    if (!fs.existsSync(scriptPath)) {
      logError(`Script not found at ${scriptPath}`);
      return NextResponse.json({ error: 'Script not found' }, { status: 500 });
    }
    
    // Check if file exists in either directory
    let filePath;
    if (fs.existsSync(invoicesPath)) {
      filePath = invoicesPath;
      console.log('Found receipt in invoices directory');
    } else if (fs.existsSync(imagesPath)) {
      filePath = imagesPath;
      console.log('Found receipt in images directory');
    } else {
      logError(`Receipt file not found in either directory: ${invoicesPath} or ${imagesPath}`);
      return NextResponse.json({ error: 'Receipt file not found' }, { status: 404 });
    }
    
    // Check if virtual environment exists
    if (!fs.existsSync(venvPath)) {
      logError(`Virtual environment not found at ${venvPath}`);
      return NextResponse.json({ error: 'Virtual environment not found' }, { status: 500 });
    }
    
    // Check if Python interpreter exists
    if (!fs.existsSync(pythonPath)) {
      logError(`Python interpreter not found at ${pythonPath}`);
      return NextResponse.json({ error: 'Python interpreter not found' }, { status: 500 });
    }
    
    // Prepare environment with absolute paths
    const env: NodeJS.ProcessEnv = {
      ...process.env,
      PYTHONPATH: `${sitePackagesPath}:${path.join(process.cwd(), 'app/api/receipts')}`,  // Add app/api/receipts directory to PYTHONPATH
      VIRTUAL_ENV: venvPath,
      PATH: `${path.join(venvPath, 'bin')}:${process.env.PATH}`,
      PYTHONUNBUFFERED: '1',  // Ensure Python output is not buffered
      OPENAI_API_KEY: process.env.OPENAI_API_KEY  // Explicitly pass the OpenAI API key
    };

    // Log environment configuration
    console.log('Environment configuration:', {
      PYTHONPATH: env.PYTHONPATH,
      VIRTUAL_ENV: env.VIRTUAL_ENV,
      PATH: env.PATH,
      OPENAI_API_KEY_STATUS: env.OPENAI_API_KEY ? 'Present' : 'Missing',  // Log presence of API key without revealing it
      OPENAI_API_KEY_LENGTH: env.OPENAI_API_KEY ? env.OPENAI_API_KEY.length : 0  // Log length of API key for debugging
    });

    // Create a new ReadableStream that will handle the Python process output
    const stream = new ReadableStream({
      start(controller) {
        const pythonProcess = spawn(pythonPath, [scriptPath, filePath], {
          env,
          cwd: process.cwd()
        });

        let buffer = '';
        let isControllerClosed = false;

        const safeEnqueue = (data: any) => {
          if (!isControllerClosed) {
            try {
              controller.enqueue(Buffer.from(JSON.stringify(data) + '\n'));
            } catch (error: unknown) {
              const errorMessage = error instanceof Error ? error.message : String(error);
              console.error('Error enqueueing data:', errorMessage);
            }
          }
        };

        const safeClose = () => {
          if (!isControllerClosed) {
            isControllerClosed = true;
            try {
              controller.close();
            } catch (error: unknown) {
              const errorMessage = error instanceof Error ? error.message : String(error);
              console.error('Error closing controller:', errorMessage);
            }
          }
        };

        // Handle stdout data
        pythonProcess.stdout.on('data', (data) => {
          try {
            buffer += data.toString();
            const lines = buffer.split('\n');
            
            // Process all complete lines except the last one
            for (let i = 0; i < lines.length - 1; i++) {
              const line = lines[i].trim();
              if (line) {
                // Only try to parse lines that look like JSON (start with { or [)
                if (line.startsWith('{') || line.startsWith('[')) {
                  try {
                    const jsonData = JSON.parse(line);
                    // Format the data for the frontend
                    safeEnqueue({
                      stage: 'complete',
                      progress: 100,
                      data: jsonData,
                      message: 'Receipt processed successfully'
                    });
                  } catch (parseError) {
                    console.error('Invalid JSON data:', line);
                    safeEnqueue({
                      stage: 'error',
                      progress: 0,
                      message: `Invalid JSON data received`
                    });
                  }
                } else if (line.includes('ERROR') || line.includes('Error')) {
                  // Handle error logs
                  safeEnqueue({
                    stage: 'error',
                    progress: 0,
                    message: line
                  });
                } else {
                  // Regular log message, just print it
                  console.log('Python log:', line);
                }
              }
            }
            
            // Keep the last incomplete line in the buffer
            buffer = lines[lines.length - 1];
          } catch (error: unknown) {
            console.error('Error processing stdout:', error);
            const errorMessage = error instanceof Error ? error.message : String(error);
            safeEnqueue({
              stage: 'error',
              progress: 0,
              message: `Error processing output: ${errorMessage}`
            });
          }
        });

        // Handle stderr data
        pythonProcess.stderr.on('data', (data) => {
          const errorMsg = data.toString();
          console.error(`Python stderr: ${errorMsg}`);
          safeEnqueue({
            stage: 'error',
            progress: 0,
            message: errorMsg
          });
        });

        // Handle process completion
        pythonProcess.on('close', (code) => {
          console.log(`Python process exited with code ${code}`);
          
          // Process any remaining data in the buffer
          if (buffer.trim()) {
            try {
              const jsonData = JSON.parse(buffer.trim());
              safeEnqueue(jsonData);
            } catch (parseError) {
              console.error('Error parsing final JSON:', buffer);
            }
          }
          
          if (code === 0) {
            safeEnqueue({
              stage: 'complete',
              progress: 100,
              message: 'Receipt processing complete'
            });
          } else {
            safeEnqueue({
              stage: 'error',
              progress: 0,
              message: `Process exited with code ${code}`
            });
          }
          safeClose();
        });

        // Handle process errors
        pythonProcess.on('error', (error: unknown) => {
          console.error('Failed to start Python process:', error);
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          safeEnqueue({
            stage: 'error',
            progress: 0,
            message: `Failed to start Python process: ${errorMessage}`
          });
          safeClose();
        });
      }
    });

    // Return the stream with appropriate headers
    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
      }
    });

  } catch (error) {
    console.error('Error in route handler:', error);
    logError('Error in route handler', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 