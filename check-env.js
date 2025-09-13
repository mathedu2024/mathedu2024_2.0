// check-env.js
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '.env.local');

if (!fs.existsSync(envPath)) {
  console.error('❌ 錯誤：找不到 .env.local 檔案。');
  process.exit(1);
}

const envFileContent = fs.readFileSync(envPath, 'utf8');
const lines = envFileContent.split('\n');
const envLine = lines.find(line => line.trim().startsWith('FIREBASE_SERVICE_ACCOUNT_JSON='));

if (!envLine) {
  console.error('❌ 錯誤：在您的 .env.local 檔案中找不到以 `FIREBASE_SERVICE_ACCOUNT_JSON=` 開頭的行。');
  process.exit(1);
}

// Extract the value part after the first '=' 
const jsonString = envLine.substring(envLine.indexOf('=') + 1).trim();

// Handle if the value is enclosed in single or double quotes
let finalJsonString = jsonString;
if ((jsonString.startsWith("'" ) && jsonString.endsWith("'")) || (jsonString.startsWith('"') && jsonString.endsWith('"'))) {
    finalJsonString = jsonString.slice(1, -1);
}


console.log('找到了 FIREBASE_SERVICE_ACCOUNT_JSON，正在嘗試解析...');

try {
  JSON.parse(finalJsonString);
  console.log('✅ 成功！ .env.local 檔案中的 FIREBASE_SERVICE_ACCOUNT_JSON 是有效的 JSON 格式。');
  console.log('看來 500 錯誤可能是由其他原因引起的。請檢查您啟動伺服器（npm run dev）的終端機視窗，尋找更詳細的錯誤訊息。');
} catch (error) {
  console.error('❌ 錯誤：解析 FIREBASE_SERVICE_ACCOUNT_JSON 失敗！');
  console.error('這很可能就是導致 500 內部伺服器錯誤的原因。');
  console.error('解析錯誤詳情:', error.message);
  console.log('\n--- 如何修正 ---');
  console.log('1. 請直接用文字編輯器打開您從 Firebase 下載的服務帳戶 JSON 檔案。');
  console.log('2. 複製裡面的「完整」內容。');
  console.log('3. 將內容貼到一個線上 JSON 轉單行工具 (例如搜尋 "JSON to single line")，將其轉換成一行。');
  console.log('4. 在您的 .env.local 檔案中，確保格式如下 (用單引號將整串內容包起來):');
  console.log("FIREBASE_SERVICE_ACCOUNT_JSON='貼上您轉換後的單行 JSON 內容'");
  console.log("範例: FIREBASE_SERVICE_ACCOUNT_JSON='{\"type\":\"service_account\",...等等...}'");
}