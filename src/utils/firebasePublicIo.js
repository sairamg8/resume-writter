import { doc, getDocFromServer, runTransaction } from 'firebase/firestore';
import { db } from '@/utils/firebase';
import { publicIo } from '@/utils/publicLink';

/**
 * The real Firestore calls for a public link (publicLink.js); null in a build without a cloud, where
 * sharing is not offered. Its own module, not ShareLinkModal's: the Dashboard (unpublish on delete)
 * and the public page need only these calls, and importing them from the modal put the modal and the
 * kit's Dialog on the start-up path (71-startup-chunks).
 */
export const firebasePublicIo = db ? publicIo({ doc, getDocFromServer, runTransaction }, db) : null;
