import { NextRequest } from 'next/server';
import { spawn } from 'child_process';
import { join } from 'path';

export async function POST(req: NextRequest) {
  try {
    const data = await req.json();
    const { receipts, transactions } = data;

    // Validate input
    if (!Array.isArray(receipts) || !Array.isArray(transactions)) {
      return new Response(JSON.stringify({ error: 'Invalid input: receipts and transactions must be arrays' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Create a ReadableStream for the response
    const stream = new ReadableStream({
      async start(controller) {
        try {
          const scriptPath = join(process.cwd(), 'scripts', 'match_transactions.py');
          const pythonProcess = spawn('python3', [scriptPath]);

          // Send the data to the Python script
          pythonProcess.stdin.write(JSON.stringify({ receipts, transactions }));
          pythonProcess.stdin.end();

          // Handle Python script output
          pythonProcess.stdout.on('data', (data) => {
            const lines = data.toString().split('\n').filter((line: string) => line.trim());
            for (const line of lines) {
              try {
                const update = JSON.parse(line);
                controller.enqueue(new TextEncoder().encode(JSON.stringify(update) + '\n'));
              } catch (e) {
                console.error('Error parsing Python output:', e);
              }
            }
          });

          // Handle Python script errors
          pythonProcess.stderr.on('data', (data) => {
            console.error('Python script error:', data.toString());
            controller.enqueue(new TextEncoder().encode(JSON.stringify({
              stage: 'error',
              progress: 100,
              message: 'Error in matching process: ' + data.toString()
            }) + '\n'));
          });

          // Handle process completion
          pythonProcess.on('close', (code) => {
            if (code !== 0) {
              controller.enqueue(new TextEncoder().encode(JSON.stringify({
                stage: 'error',
                progress: 100,
                message: `Process exited with code ${code}`
              }) + '\n'));
            }
            controller.close();
          });

        } catch (error: unknown) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          console.error('Error in stream processing:', errorMessage);
          controller.enqueue(new TextEncoder().encode(JSON.stringify({
            stage: 'error',
            progress: 100,
            message: 'Internal server error: ' + errorMessage
          }) + '\n'));
          controller.close();
        }
      }
    });

    // Return the streaming response
    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
      }
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Error processing request:', errorMessage);
    return new Response(JSON.stringify({ 
      error: 'Internal server error',
      details: errorMessage
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
} 