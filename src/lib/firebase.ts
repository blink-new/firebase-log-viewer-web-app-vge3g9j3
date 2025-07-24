import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAnalytics } from "firebase/analytics";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDGl94SoCAlrtOxEYHADAcMjVGztoyw1Og",
  authDomain: "twtracking-ed046.firebaseapp.com",
  projectId: "twtracking-ed046",
  storageBucket: "twtracking-ed046.firebasestorage.app",
  messagingSenderId: "677023761996",
  appId: "1:677023761996:web:7dfff925ffb52d3659d6e9",
  measurementId: "G-4ZWF3ND1LG"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firestore
export const db = getFirestore(app);

// Initialize Analytics (optional)
export const analytics = getAnalytics(app);

export default app;