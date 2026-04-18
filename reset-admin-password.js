const { adminDb } = require('./services/firebase-admin');

const resetPassword = async () => {
  const args = process.argv.slice(2);
  if (args.length !== 2) {
    console.error('Usage: node reset-admin-password.js <account> <newPassword>');
    process.exit(1);
  }
  const [account, newPassword] = args;

  if (!account || !newPassword) {
    console.error('Error: Both account and newPassword must be provided.');
    console.error('Usage: node reset-admin-password.js <account> <newPassword>');
    process.exit(1);
  }

  console.log(`Attempting to reset password for account: ${account}...`);

  try {
    const userQuery = adminDb.collection('users').where('account', '==', account);
    const querySnapshot = await userQuery.get();

    if (querySnapshot.empty) {
      console.error(`\nError: Account '${account}' not found in the 'users' collection.`);
      process.exit(1);
    }

    const userDoc = querySnapshot.docs[0];
    console.log(`Found user: ${userDoc.id}`);

    console.log('Storing new password as plain text...');

    await userDoc.ref.update({ password: newPassword });

    console.log('\n✅ Success! Password has been reset.');
    console.log(`You can now log in with account '${account}' and the new password.`);

  } catch (error) {
    console.error('\n--- An error occurred --- ');
    console.error('This might be due to the Firebase connection. Ensure your .env.local is correct.');
    console.error(error);
    process.exit(1);
  }
  process.exit(0);
};

resetPassword();
