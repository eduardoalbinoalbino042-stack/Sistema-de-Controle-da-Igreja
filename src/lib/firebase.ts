import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { showGoogleAuthErrorHelp, showUnauthorizedDomainHelp } from './alerts';

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Services with specific database ID from config or metadata fallback
export const auth = getAuth(app);
const databaseId = (firebaseConfig as any).firestoreDatabaseId || "ai-studio-67597a71-6c6c-438c-8a6f-b88c5a1a8c33";
export const db = getFirestore(app, databaseId);

export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account'
});

/**
 * Sign in using Google and handles common authentication errors.
 */
export const signInWithGoogle = async () => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result;
  } catch (error: any) {
    console.error("Erro no login Google:", error);
    
    const errCode = String(error?.code || '').toLowerCase();
    const errMessage = String(error?.message || '').toLowerCase();
    const errString = String(error).toLowerCase();

    // User closed popup or cancelled
    if (
      errCode.includes('popup-closed-by-user') ||
      errCode.includes('cancelled-popup-request') ||
      errMessage.includes('popup-closed-by-user')
    ) {
      console.log("Login cancelado pelo usuário.");
      return null;
    }

    // Identity Toolkit error handling
    if (
      errCode.includes('projectconfigservice') ||
      errMessage.includes('identitytoolkit')
    ) {
      alert("A API Identity Toolkit está sendo ativada ou está bloqueada. Por favor, aguarde alguns minutos ou verifique as restrições da chave de API no Google Cloud Console.");
      return null;
    }

    // Unauthorized Domain or Invalid Continue URI or Domain errors
    if (
      errCode.includes('unauthorized-domain') ||
      errCode.includes('invalid-continue-uri') ||
      errCode.includes('invalid-origin') ||
      errCode.includes('redirect-uri') ||
      errMessage.includes('unauthorized-domain') ||
      errMessage.includes('invalid-continue-uri') ||
      errMessage.includes('unauthorized domain') ||
      errString.includes('unauthorized-domain') ||
      errString.includes('invalid-continue-uri') ||
      errString.includes('continue-uri') ||
      errString.includes('unauthorized')
    ) {
      await showUnauthorizedDomainHelp(window.location.hostname, error?.code || 'auth/invalid-continue-uri');
      return null;
    }

    // Network request failed
    if (
      errCode.includes('network-request-failed') ||
      errMessage.includes('network-request-failed') ||
      errString.includes('network')
    ) {
      await showGoogleAuthErrorHelp(error);
      return null;
    }

    alert("Erro ao logar: " + (error?.message || error?.code || String(error)));
    return null;
  }
};

export const logout = () => signOut(auth);

/**
 * Validate connection to Firestore.
 * CRITICAL CONSTRAINT: Must be called to verify connectivity.
 */
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'church_transactions', 'connection_test_skip_if_exists'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration. The client is offline.");
    }
  }
}
testConnection();
