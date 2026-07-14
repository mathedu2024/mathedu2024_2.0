const fs = require('fs');
const path = require('path');

const serviceAccountFileName = 'service-account.json'; 

try {
  const filePath = path.join(__dirname, serviceAccountFileName);
  if (!fs.existsSync(filePath)) {
    console.error(`\nError: The file '${serviceAccountFileName}' was not found in the project root.`);
    console.error('Please download your service account key from Firebase and place it in the same directory as this script, ensuring the filename matches.');
    return;
  }

  const serviceAccount = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  
  if (!serviceAccount.private_key) {
    console.error(`\nError: The key 'private_key' was not found in '${serviceAccountFileName}'.`);
    console.error('Please ensure you are using a valid service account file from Firebase.');
    return;
  }

  const privateKey = serviceAccount.private_key;

  console.log('\n✅ Successfully generated a Firebase private key value.\n');
  console.log('Copy one of the following lines into your .env.local file:');
  console.log('  - FIREBASE_CORE_PRIVATE_KEY  → 主站');
  console.log('  - FIREBASE_QUIZ_PRIVATE_KEY  → 線上測驗專用');
  console.log('Make sure to enclose the key in double quotes.');
  console.log('------------------------------------------------------------------');
  console.log(`FIREBASE_CORE_PRIVATE_KEY="${privateKey.replace(/\n/g, '\\n')}"`);
  console.log(`FIREBASE_QUIZ_PRIVATE_KEY="${privateKey.replace(/\n/g, '\\n')}"`);
  console.log('------------------------------------------------------------------\n');

} catch (error) {
  console.error('\nAn unexpected error occurred:', error);
  console.error("Please ensure 'service-account.json' is a valid JSON file.");
}
