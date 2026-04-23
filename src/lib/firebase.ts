import admin from 'firebase-admin';

export const getFirestore = () => {
  if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT not configured');
  }

  if (!admin.apps.length) {
    try {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      });
    } catch (e) {
      throw new Error('Failed to parse FIREBASE_SERVICE_ACCOUNT');
    }
  }

  return admin.firestore();
};
