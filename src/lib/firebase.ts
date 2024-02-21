import { initializeApp } from 'firebase/app';
import { getFirestore, getDocs, setDoc, collection, doc } from 'firebase/firestore';
import { getAnalytics } from 'firebase/analytics';
import {
	PUBLIC_API_KEY,
	PUBLIC_APP_ID,
	PUBLIC_AUTH_DOMAIN,
	PUBLIC_MEASUREMENT_ID,
	PUBLIC_MESSAGING_SENDER_ID,
	PUBLIC_PROJECT_ID,
	PUBLIC_STORAGE_BUCKET,
} from '$env/static/public';

const firebaseConfig = {
	apiKey: PUBLIC_API_KEY,
	authDomain: PUBLIC_AUTH_DOMAIN,
	projectId: PUBLIC_PROJECT_ID,
	storageBucket: PUBLIC_STORAGE_BUCKET,
	messagingSenderId: PUBLIC_MESSAGING_SENDER_ID,
	appId: PUBLIC_APP_ID,
	measurementId: PUBLIC_MEASUREMENT_ID,
};

export const firebaseApp = initializeApp(firebaseConfig);
export const firestore = getFirestore(firebaseApp);
export const firebaseAnalytics = getAnalytics(firebaseApp);

export function getCollection(path: string) {
	const col = collection(firestore, path);
	return getDocs(col);
}

export function putDoc(path: string, data: Record<string, any>) {
	const docRef = doc(firestore, path);
	return setDoc(docRef, data);
}
