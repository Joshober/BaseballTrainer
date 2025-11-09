import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';

// Store running processes by sessionId
const runningProcesses = new Map<string, any>();

// Cleanup old processes every 5 minutes
setInterval(() => {
  const now = Date.now();
  const maxAge = 10 * 60 * 1000; // 10 minutes
  for (const [sessionId, processData] of runningProcesses.entries()) {
    if (now - processData.startTime > maxAge) {
      // Kill old process
      if (processData.process && !processData.process.killed) {
        processData.process.kill();
      }
      runningProcesses.delete(sessionId);
    }
  }
}, 5 * 60 * 1000);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const sessionId = body.sessionId;
    const apiUrl = body.apiUrl || process.env.NEXTJS_API_URL || 'http://localhost:3000';

    if (!sessionId) {
      return NextResponse.json(
        { success: false, error: 'sessionId is required' },
        { status: 400 }
      );
    }

    // Check if already running for this session
    if (runningProcesses.has(sessionId)) {
      const existing = runningProcesses.get(sessionId);
      if (existing.process && !existing.process.killed) {
        return NextResponse.json({
          success: false,
          error: 'Swing detection already running for this session',
        }, { status: 400 });
      }
    }

    // Get the script path
    const scriptPath = path.join(process.cwd(), 'scripts', 'detect_swings.py');
    
    // Check if script exists
    const fs = require('fs');
    if (!fs.existsSync(scriptPath)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Swing detection script not found',
          message: `Script not found at: ${scriptPath}`,
        },
        { status: 404 }
      );
    }
    
    // Try to find Python executable (try python3 first, then python)
    let pythonCmd = 'python';
    try {
      const { execSync } = require('child_process');
      try {
        execSync('python3 --version', { stdio: 'ignore' });
        pythonCmd = 'python3';
      } catch {
        execSync('python --version', { stdio: 'ignore' });
        pythonCmd = 'python';
      }
      
      // Verify bleak is installed
      try {
        execSync(`${pythonCmd} -c "import bleak"`, { stdio: 'ignore' });
      } catch {
        console.warn(`[Swing Detection] bleak not found, attempting to install...`);
        try {
          execSync(`${pythonCmd} -m pip install bleak requests`, { stdio: 'inherit' });
          console.log(`[Swing Detection] Successfully installed bleak and requests`);
        } catch (installError) {
          return NextResponse.json(
            {
              success: false,
              error: 'bleak module not found',
              message: 'The "bleak" Python module is required for swing detection. Please install it by running: pip install bleak requests',
            },
            { status: 500 }
          );
        }
      }
    } catch (error) {
      return NextResponse.json(
        {
          success: false,
          error: 'Python not found',
          message: 'Python is required to run swing detection. Please install Python and ensure it is in your PATH.',
        },
        { status: 500 }
      );
    }
    
    // Spawn the Python script as a child process
    console.log(`[Swing Detection] Spawning Python process: ${pythonCmd} ${scriptPath} --session-id ${sessionId} --api-url ${apiUrl}`);
    
    const pythonProcess = spawn(pythonCmd, [
      scriptPath,
      '--session-id', sessionId,
      '--api-url', apiUrl,
    ], {
      cwd: process.cwd(),
      stdio: ['ignore', 'pipe', 'pipe'], // Ignore stdin, capture stdout/stderr
      shell: false, // Don't use shell on Windows
    });

    // Store process info
    runningProcesses.set(sessionId, {
      process: pythonProcess,
      sessionId,
      startTime: Date.now(),
    });

    // Handle process output (for debugging)
    pythonProcess.stdout?.on('data', (data) => {
      const output = data.toString().trim();
      if (output) {
        console.log(`[Swing Detection ${sessionId}] ${output}`);
      }
    });

    pythonProcess.stderr?.on('data', (data) => {
      const output = data.toString().trim();
      if (output) {
        console.error(`[Swing Detection ${sessionId}] ERROR: ${output}`);
      }
    });

    // Handle process exit
    pythonProcess.on('exit', (code, signal) => {
      console.log(`[Swing Detection ${sessionId}] Process exited with code ${code}, signal ${signal}`);
      runningProcesses.delete(sessionId);
    });

    pythonProcess.on('error', (error) => {
      console.error(`[Swing Detection ${sessionId}] Process spawn error:`, error);
      runningProcesses.delete(sessionId);
    });

    // Log immediately after spawn
    console.log(`[Swing Detection] Started for session ${sessionId}, PID: ${pythonProcess.pid}`);
    
    // Check if process actually started
    if (!pythonProcess.pid) {
      console.error(`[Swing Detection ${sessionId}] Failed to start process - no PID assigned`);
      runningProcesses.delete(sessionId);
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to start Python process',
          message: 'Process was not spawned successfully',
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Swing detection started',
      sessionId,
      pid: pythonProcess.pid,
    });
  } catch (error: any) {
    console.error('Error starting swing detection:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
        message: error.message || 'Failed to start swing detection',
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    // Try to get sessionId from query params first, then from body
    const searchParams = request.nextUrl.searchParams;
    let sessionId = searchParams.get('sessionId');
    
    if (!sessionId) {
      try {
        const body = await request.json();
        sessionId = body.sessionId;
      } catch {
        // Body might not be JSON
      }
    }

    if (!sessionId) {
      return NextResponse.json(
        { success: false, error: 'sessionId is required' },
        { status: 400 }
      );
    }

    const processData = runningProcesses.get(sessionId);
    if (!processData || !processData.process) {
      return NextResponse.json({
        success: false,
        error: 'Swing detection not running for this session',
      }, { status: 404 });
    }

    // Kill the process
    if (!processData.process.killed) {
      processData.process.kill();
    }
    runningProcesses.delete(sessionId);

    console.log(`[Swing Detection] Stopped for session ${sessionId}`);

    return NextResponse.json({
      success: true,
      message: 'Swing detection stopped',
      sessionId,
    });
  } catch (error: any) {
    console.error('Error stopping swing detection:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
        message: error.message || 'Failed to stop swing detection',
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const sessionId = searchParams.get('sessionId');

    if (!sessionId) {
      return NextResponse.json(
        { success: false, error: 'sessionId is required' },
        { status: 400 }
      );
    }

    const processData = runningProcesses.get(sessionId);
    const isRunning = processData && processData.process && !processData.process.killed;

    return NextResponse.json({
      success: true,
      isRunning,
      sessionId,
      pid: isRunning ? processData.process.pid : null,
    });
  } catch (error: any) {
    console.error('Error checking swing detection status:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
        message: error.message || 'Failed to check swing detection status',
      },
      { status: 500 }
    );
  }
}

