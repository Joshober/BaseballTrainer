/**
 * Test Auth0 Setup
 * Verifies code structure and provides setup guidance
 */
import * as fs from 'fs';
import * as path from 'path';

console.log('\n' + '='.repeat(60));
console.log('  Auth0 Setup Test');
console.log('='.repeat(60) + '\n');

let allGood = true;

// Check if .env.local exists
const envLocalPath = path.join(process.cwd(), '.env.local');
const envLocalExists = fs.existsSync(envLocalPath);

console.log('1. Environment File Check:');
if (envLocalExists) {
  console.log('   ✅ .env.local exists');
  const envContent = fs.readFileSync(envLocalPath, 'utf-8');
  const hasAuth0Domain = envContent.includes('AUTH0_DOMAIN=');
  const hasAuth0ClientId = envContent.includes('AUTH0_CLIENT_ID=');
  const hasAuth0ClientSecret = envContent.includes('AUTH0_CLIENT_SECRET=');
  const hasAuth0BaseUrl = envContent.includes('AUTH0_BASE_URL=');
  
  console.log('   AUTH0_DOMAIN:', hasAuth0Domain ? '✅' : '❌');
  console.log('   AUTH0_CLIENT_ID:', hasAuth0ClientId ? '✅' : '❌');
  console.log('   AUTH0_CLIENT_SECRET:', hasAuth0ClientSecret ? '✅' : '❌');
  console.log('   AUTH0_BASE_URL:', hasAuth0BaseUrl ? '✅' : '❌');
  
  if (!hasAuth0Domain || !hasAuth0ClientId || !hasAuth0ClientSecret || !hasAuth0BaseUrl) {
    allGood = false;
  }
} else {
  console.log('   ❌ .env.local does not exist');
  console.log('   📝 Create .env.local in the root directory');
  allGood = false;
}

// Check if required files exist
console.log('\n2. Code Structure Check:');
const requiredFiles = [
  'backend-gateway/index.ts',
  'lib/auth0/admin.ts',
  'lib/auth0/client.ts',
  'lib/auth0/config.ts',
  'app/login/page.tsx',
  'app/signup/page.tsx',
  'app/auth/callback/page.tsx',
  'components/Auth/AuthButton.tsx',
];

for (const file of requiredFiles) {
  const filePath = path.join(process.cwd(), file);
  if (fs.existsSync(filePath)) {
    console.log(`   ✅ ${file}`);
  } else {
    console.log(`   ❌ ${file} - MISSING`);
    allGood = false;
  }
}

// Check if dependencies are installed
console.log('\n3. Dependencies Check:');
const packageJsonPath = path.join(process.cwd(), 'package.json');
if (fs.existsSync(packageJsonPath)) {
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
  const deps = packageJson.dependencies || {};
  
  const requiredDeps = ['jsonwebtoken', 'jwks-rsa', 'axios'];
  for (const dep of requiredDeps) {
    if (deps[dep]) {
      console.log(`   ✅ ${dep} (${deps[dep]})`);
    } else {
      console.log(`   ❌ ${dep} - NOT INSTALLED`);
      allGood = false;
    }
  }
  
  // Check that @auth0/nextjs-auth0 is NOT installed (we removed it)
  if (deps['@auth0/nextjs-auth0']) {
    console.log(`   ⚠️  @auth0/nextjs-auth0 - Should be removed (we're using backend gateway)`);
  } else {
    console.log(`   ✅ @auth0/nextjs-auth0 - Correctly removed`);
  }
}

// Summary
console.log('\n' + '='.repeat(60));
if (allGood && envLocalExists) {
  console.log('✅ Code structure is correct!');
  console.log('\nNext steps:');
  console.log('  1. Set up Auth0 Dashboard (see docs/AUTH0_SETUP.md)');
  console.log('  2. Add Auth0 credentials to .env.local');
  console.log('  3. Start backend gateway: npm run dev:gateway');
  console.log('  4. Start frontend: npm run dev');
  console.log('  5. Test login at: http://localhost:3000/login');
} else if (allGood) {
  console.log('✅ Code structure is correct!');
  console.log('\nNext steps:');
  console.log('  1. Create .env.local file in root directory');
  console.log('  2. Set up Auth0 Dashboard (see docs/AUTH0_SETUP.md)');
  console.log('  3. Add Auth0 credentials to .env.local');
  console.log('  4. Start backend gateway: npm run dev:gateway');
  console.log('  5. Start frontend: npm run dev');
} else {
  console.log('⚠️  Some issues found. Please fix them before proceeding.');
}
console.log('='.repeat(60) + '\n');

