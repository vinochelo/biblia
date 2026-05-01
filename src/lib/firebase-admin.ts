import admin from 'firebase-admin';

/**
 * Inicializa el Firebase Admin SDK para uso en el servidor (Vercel serverless).
 * Usa las credenciales del proyecto desde variables de entorno.
 * 
 * Variables de entorno necesarias en Vercel:
 * - FIREBASE_PROJECT_ID (o NEXT_PUBLIC_FIREBASE_PROJECT_ID como fallback)
 * - FIREBASE_STORAGE_BUCKET (o NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET como fallback)
 * - FIREBASE_SERVICE_ACCOUNT_KEY (opcional - JSON string del service account, si no se usa Application Default Credentials)
 */

function getAdminApp(): admin.app.App {
    if (admin.apps.length > 0) {
        return admin.apps[0]!;
    }

    const projectId = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
    const storageBucket = process.env.FIREBASE_STORAGE_BUCKET || process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;

    if (!projectId) {
        throw new Error('FIREBASE_PROJECT_ID no está configurado en las variables de entorno.');
    }

    const config: admin.AppOptions = {
        projectId,
        storageBucket,
        databaseURL: `https://${projectId}-default-rtdb.firebaseio.com`,
    };

    // Si hay un Service Account Key configurado, usarlo
    const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    if (serviceAccountKey) {
        try {
            const serviceAccount = JSON.parse(serviceAccountKey);
            config.credential = admin.credential.cert(serviceAccount);
        } catch (e) {
            console.error('Error parseando FIREBASE_SERVICE_ACCOUNT_KEY:', e);
        }
    }

    return admin.initializeApp(config);
}

let adminApp: admin.app.App;
let adminDb: admin.database.Database | null = null;
let adminStorage: admin.storage.Storage | null = null;

try {
    adminApp = getAdminApp();
    adminDb = adminApp.database();
    adminStorage = adminApp.storage();
} catch (error) {
    console.error('Error inicializando Firebase Admin:', error);
}

export { adminApp, adminDb, adminStorage };
