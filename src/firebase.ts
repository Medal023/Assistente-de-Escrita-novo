import { initializeApp } from "firebase/app";
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged,
  RecaptchaVerifier,
  signInWithPhoneNumber
} from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Configuration retrieved from firebase-applet-config.json
const firebaseConfig = {
  apiKey: "AIzaSyDapuZkvaUMY3Qb2ugYQDBIN3YvhP1ljfE",
  authDomain: "gen-lang-client-0303736294.firebaseapp.com",
  projectId: "gen-lang-client-0303736294",
  storageBucket: "gen-lang-client-0303736294.firebasestorage.app",
  messagingSenderId: "580368134866",
  appId: "1:580368134866:web:c491e0de7e5c37b731f30b"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Services
export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();

export { 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged,
  RecaptchaVerifier,
  signInWithPhoneNumber
};
