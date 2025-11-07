/**
 * Run and Check Script
 * Starts all services, checks for errors, and attempts to fix common issues
 */
import { execSync, spawn, ChildProcess } from 'child_process';
import { existsSync, unlinkSync } from 'fs';
import { join } from 'path';
import axios from 'axios';

const isWindows = process.platform === 'win32';
const projectRoot = process.cwd();

interface Service {
  name: string;
  port: number;
  command: string;
  healthCheck?: string;
  process?: ChildProcess;
}

const services: Service[] = [
  {
    name: 'Backend Gateway',
    port: 3001,
    command: 'npm run dev:gateway',
    healthCheck: 'http://localhost:3001/health',
  },
  {
    name: 'Pose Detection Service',
    port: 5000,
    command: 'npm run dev:pose',
    healthCheck: 'http://localhost:5000/health',
  },
  {
    name: 'Drill Recommender',
    port: 5001,
    command: 'npm run dev:drills',
    healthCheck: 'http://localhost:5001/health',
  },
  {
    name: 'Blast Connector',
    port: 5002,
    command: 'npm run dev:blast',
    healthCheck: 'http://localhost:5002/health',
  },
  {
    name: 'Next.js Frontend',
    port: 3000,
    command: 'npm run dev',
    healthCheck: 'http://localhost:3000',
  },
];

// Check if port is available
function isPortAvailable(port: number): boolean {
  try {
    if (isWindows) {
      const result = execSync(`netstat -ano | findstr :${port}`, { stdio: 'ignore' });
      return result.toString().trim().length === 0;
    } else {
      const result = execSync(`lsof -i :${port}`, { stdio: 'ignore' });
      return false;
    }
  } catch {
    return true;
  }
}

// Check if Python is available
function checkPython(): { available: boolean; command: string } {
  try {
    execSync('python --version', { stdio: 'ignore' });
    return { available: true, command: 'python' };
  } catch {
    try {
      execSync('python3 --version', { stdio: 'ignore' });
      return { available: true, command: 'python3' };
    } catch {
      return { available: false, command: '' };
    }
  }
}

// Check if Node.js dependencies are installed
function checkNodeDependencies(): boolean {
  try {
    const nodeModulesPath = join(projectRoot, 'node_modules');
    return existsSync(nodeModulesPath);
  } catch {
    return false;
  }
}

// Check if Python dependencies are installed
function checkPythonDependencies(serviceDir: string): boolean {
  const requirementsPath = join(projectRoot, serviceDir, 'requirements.txt');
  if (!existsSync(requirementsPath)) {
    return true; // No requirements file means no dependencies needed
  }

  // Check if virtual environment exists or packages are installed
  // This is a simple check - we'll try to import a common package
  try {
    const python = checkPython();
    if (!python.available) return false;

    // Try to check if flask is installed (common in all services)
    execSync(`${python.command} -c "import flask"`, { stdio: 'ignore', cwd: join(projectRoot, serviceDir) });
    return true;
  } catch {
    return false;
  }
}

// Check environment file
function checkEnvFile(): { exists: boolean; valid: boolean } {
  const envPath = join(projectRoot, '.env.local');
  const exists = existsSync(envPath);
  
  if (!exists) {
    return { exists: false, valid: false };
  }

  try {
    execSync('python scripts/validate-env.py', { stdio: 'ignore' });
    return { exists: true, valid: true };
  } catch {
    // If validation fails, it's not critical - services can still run
    return { exists: true, valid: false };
  }
}

// Clean up Next.js lock files
function cleanupNextLockFiles(): void {
  const lockPath = join(projectRoot, '.next', 'dev', 'lock');
  try {
    if (existsSync(lockPath)) {
      unlinkSync(lockPath);
      console.log('✅ Cleaned up Next.js lock file\n');
    }
  } catch (error: any) {
    // Ignore errors - lock file might be in use
    console.log('⚠️  Could not clean up Next.js lock file (may be in use)\n');
  }
}

// Wait for service to be ready
async function waitForService(url: string, timeout: number = 30000): Promise<boolean> {
  const startTime = Date.now();
  while (Date.now() - startTime < timeout) {
    try {
      const response = await axios.get(url, { timeout: 2000 });
      if (response.status === 200) {
        return true;
      }
    } catch {
      // Service not ready yet
    }
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  return false;
}

// Fix common issues
async function fixIssues(): Promise<void> {
  console.log('\n🔧 Checking and fixing issues...\n');

  // 1. Check Node.js dependencies
  if (!checkNodeDependencies()) {
    console.log('📦 Installing Node.js dependencies...');
    try {
      execSync('npm install', { stdio: 'inherit' });
      console.log('✅ Node.js dependencies installed\n');
    } catch (error: any) {
      console.error('❌ Failed to install Node.js dependencies:', error.message);
      throw error;
    }
  } else {
    console.log('✅ Node.js dependencies already installed\n');
  }

  // 2. Check Python
  const python = checkPython();
  if (!python.available) {
    console.error('❌ Python not found. Please install Python 3.8+');
    throw new Error('Python not available');
  }
  console.log(`✅ Python found: ${python.command}\n`);

  // 3. Check Python dependencies for each service
  const pythonServices = [
    { dir: 'pose-detection-service', name: 'Pose Detection Service' },
    { dir: 'drill-recommender', name: 'Drill Recommender' },
    { dir: 'blast-connector', name: 'Blast Connector' },
  ];

  for (const service of pythonServices) {
    if (!checkPythonDependencies(service.dir)) {
      console.log(`📦 Installing Python dependencies for ${service.name}...`);
      try {
        const requirementsPath = join(projectRoot, service.dir, 'requirements.txt');
        if (existsSync(requirementsPath)) {
          execSync(`${python.command} -m pip install -r ${requirementsPath}`, {
            stdio: 'inherit',
            cwd: join(projectRoot, service.dir),
          });
          console.log(`✅ ${service.name} dependencies installed\n`);
        }
      } catch (error: any) {
        console.error(`❌ Failed to install ${service.name} dependencies:`, error.message);
        console.log('⚠️  Continuing anyway...\n');
      }
    } else {
      console.log(`✅ ${service.name} dependencies already installed\n`);
    }
  }

  // 4. Check environment file
  const envCheck = checkEnvFile();
  if (!envCheck.exists) {
    console.warn('⚠️  .env.local file not found');
    console.log('   Create a .env.local file in the project root');
    console.log('   (Services can still run without it, but some features may not work)\n');
  } else if (!envCheck.valid) {
    console.warn('⚠️  .env.local file has parsing issues');
    console.log('   Run: npm run validate:env to check details');
    console.log('   (Services will still attempt to start)\n');
  } else {
    console.log('✅ Environment file is valid\n');
  }

  // 5. Clean up Next.js lock files
  console.log('🧹 Cleaning up Next.js lock files...');
  cleanupNextLockFiles();

  // 6. Check for port conflicts
  console.log('🔍 Checking for port conflicts...\n');
  const portConflicts: number[] = [];
  for (const service of services) {
    if (!isPortAvailable(service.port)) {
      portConflicts.push(service.port);
      console.warn(`⚠️  Port ${service.port} (${service.name}) is already in use`);
      if (service.name === 'Next.js Frontend') {
        console.log('   Next.js will automatically use the next available port\n');
      }
    }
  }

  if (portConflicts.length > 0) {
    console.log('\n⚠️  Port conflicts detected:');
    console.log('   - Services will attempt to start anyway');
    console.log('   - Next.js will use the next available port if 3000 is in use');
    console.log('   - To free ports, stop the services using them\n');
  } else {
    console.log('✅ All ports are available\n');
  }
}

// Start a service
function startService(service: Service): ChildProcess {
  const [command, ...args] = service.command.split(' ');
  
  const child = spawn(command, args, {
    cwd: projectRoot,
    shell: true,
    stdio: 'pipe',
  });

  child.stdout?.on('data', (data) => {
    const output = data.toString();
    process.stdout.write(`[${service.name}] ${output}`);
  });

  child.stderr?.on('data', (data) => {
    const output = data.toString();
    process.stderr.write(`[${service.name}] ${output}`);
  });

  child.on('error', (error) => {
    console.error(`❌ Error starting ${service.name}:`, error.message);
  });

  return child;
}

// Main function
async function main() {
  console.log('🚀 Starting Project Run and Check\n');
  console.log('='.repeat(60));

  try {
    // Step 1: Fix issues
    await fixIssues();

    // Step 2: Start all services
    console.log('🚀 Starting all services...\n');
    
    const processes: ChildProcess[] = [];
    
    for (const service of services) {
      console.log(`Starting ${service.name} (Port ${service.port})...`);
      const process = startService(service);
      service.process = process;
      processes.push(process);
      
      // Wait a bit between starting services
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    console.log('\n✅ All services started!\n');
    console.log('Services:');
    for (const service of services) {
      console.log(`  • ${service.name}: http://localhost:${service.port}`);
    }
    console.log('\n⏳ Waiting for services to be ready...');
    console.log('   (Note: Next.js may use a different port if 3000 is in use)\n');

    // Step 3: Check service health
    const healthChecks: Array<{ service: string; healthy: boolean; actualPort?: number }> = [];
    
    for (const service of services) {
      if (service.healthCheck) {
        console.log(`Checking ${service.name}...`);
        
        // For Next.js, try multiple ports if 3000 is in use
        let healthy = false;
        let actualPort = service.port;
        
        if (service.name === 'Next.js Frontend') {
          // Try common Next.js ports (it auto-selects if 3000 is in use)
          const portsToTry = [3000, 3002, 3003, 3004];
          for (const port of portsToTry) {
            const url = `http://localhost:${port}`;
            const result = await waitForService(url, 5000);
            if (result) {
              healthy = true;
              actualPort = port;
              break;
            }
          }
        } else {
          healthy = await waitForService(service.healthCheck, 30000);
        }
        
        healthChecks.push({ service: service.name, healthy, actualPort });
        
        if (healthy) {
          if (actualPort !== service.port) {
            console.log(`✅ ${service.name} is healthy (running on port ${actualPort} instead of ${service.port})\n`);
          } else {
            console.log(`✅ ${service.name} is healthy\n`);
          }
        } else {
          console.log(`⚠️  ${service.name} did not respond within timeout\n`);
        }
      }
    }

    // Step 4: Summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 Summary\n');
    
    const healthyServices = healthChecks.filter(h => h.healthy).length;
    const totalServices = healthChecks.length;
    
    console.log(`Services Health: ${healthyServices}/${totalServices} healthy\n`);
    
    // Show actual URLs
    console.log('Service URLs:');
    for (const check of healthChecks) {
      if (check.healthy) {
        const port = check.actualPort || services.find(s => s.name === check.service)?.port || '?';
        console.log(`  ✅ ${check.service}: http://localhost:${port}`);
      } else {
        const port = services.find(s => s.name === check.service)?.port || '?';
        console.log(`  ⚠️  ${check.service}: http://localhost:${port} (not responding)`);
      }
    }
    console.log('');
    
    if (healthyServices < totalServices) {
      console.log('⚠️  Some services may not be fully ready yet.');
      console.log('   Check the logs above for any errors.\n');
    }

    console.log('✅ Project is running!');
    console.log('Press Ctrl+C to stop all services.\n');

    // Handle cleanup on exit
    process.on('SIGINT', () => {
      console.log('\n\n🛑 Stopping all services...\n');
      processes.forEach(proc => {
        try {
          proc.kill();
        } catch {
          // Ignore errors
        }
      });
      process.exit(0);
    });

    // Keep the process alive
    await new Promise(() => {});

  } catch (error: any) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

main();

