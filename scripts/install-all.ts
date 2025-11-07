/**
 * Install all dependencies (Node.js and Python)
 * Cross-platform installation script
 */
import { execSync } from 'child_process';
import { existsSync } from 'fs';
import { join } from 'path';

const isWindows = process.platform === 'win32';

// Detect Python command
function getPythonCommand(): string {
  try {
    execSync('python --version', { stdio: 'ignore' });
    return 'python';
  } catch {
    try {
      execSync('python3 --version', { stdio: 'ignore' });
      return 'python3';
    } catch {
      throw new Error('Python not found. Please install Python 3.8+');
    }
  }
}

// Detect pip command
function getPipCommand(pythonCmd: string): string {
  try {
    execSync(`${pythonCmd} -m pip --version`, { stdio: 'ignore' });
    return `${pythonCmd} -m pip`;
  } catch {
    try {
      execSync('pip --version', { stdio: 'ignore' });
      return 'pip';
    } catch {
      try {
        execSync('pip3 --version', { stdio: 'ignore' });
        return 'pip3';
      } catch {
        throw new Error('pip not found. Please install pip');
      }
    }
  }
}

function installPythonRequirements(serviceDir: string, serviceName: string): void {
  const requirementsPath = join(serviceDir, 'requirements.txt');
  
  if (!existsSync(requirementsPath)) {
    console.log(`⚠️  ${serviceName}: requirements.txt not found, skipping...`);
    return;
  }

  try {
    const pythonCmd = getPythonCommand();
    const pipCmd = getPipCommand(pythonCmd);
    
    console.log(`\n📦 Installing Python dependencies for ${serviceName}...`);
    console.log(`   Using: ${pipCmd}`);
    
    execSync(`${pipCmd} install -r ${requirementsPath}`, {
      stdio: 'inherit',
      cwd: serviceDir,
    });
    
    console.log(`✅ ${serviceName}: Python dependencies installed`);
  } catch (error: any) {
    console.error(`❌ ${serviceName}: Failed to install Python dependencies`);
    console.error(`   Error: ${error.message}`);
    throw error;
  }
}

function main() {
  console.log('🚀 Installing all dependencies...\n');
  
  // Step 1: Install Node.js dependencies
  console.log('📦 Step 1: Installing Node.js dependencies...');
  try {
    execSync('npm install', { stdio: 'inherit' });
    console.log('✅ Node.js dependencies installed\n');
  } catch (error: any) {
    console.error('❌ Failed to install Node.js dependencies');
    console.error(`   Error: ${error.message}`);
    process.exit(1);
  }

  // Step 2: Install Python dependencies for each service
  console.log('📦 Step 2: Installing Python dependencies...');
  
  const services = [
    { dir: 'pose-detection-service', name: 'Pose Detection Service' },
    { dir: 'drill-recommender', name: 'Drill Recommender' },
    { dir: 'blast-connector', name: 'Blast Connector' },
  ];

  for (const service of services) {
    try {
      installPythonRequirements(service.dir, service.name);
    } catch (error: any) {
      console.error(`\n⚠️  Warning: ${service.name} installation failed, but continuing...`);
    }
  }

  // Step 3: Install AI models
  console.log('\n📦 Step 3: Installing AI models...');
  try {
    execSync('npm run install:models', { stdio: 'inherit' });
    console.log('✅ AI models installed\n');
  } catch (error: any) {
    console.warn('⚠️  AI model installation skipped (will download on first use)');
  }

  console.log('\n✨ Installation complete!');
  console.log('\n📝 Next steps:');
  console.log('   1. Create a .env.local file with your configuration');
  console.log('   2. Run: npm run dev:gateway (in one terminal)');
  console.log('   3. Run: npm run dev:pose (in another terminal)');
  console.log('   4. Run: npm run dev:drills (in another terminal)');
  console.log('   5. Run: npm run dev:blast (in another terminal)');
  console.log('   6. Run: npm run dev (in another terminal for frontend)');
}

main();

