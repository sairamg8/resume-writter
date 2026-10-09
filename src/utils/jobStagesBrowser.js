// The job form's stages against the real Firestore (jobStagesCloud.js has what they do). Loaded
// when a signed-in job form opens, so it adds nothing to the start-up path.
import { arrayRemove, arrayUnion, doc, getDocFromServer, writeBatch } from 'firebase/firestore';
import { db } from '@/utils/firebase';
import { stagesIo, watchStages } from '@/utils/jobStagesCloud';

const io = db ? stagesIo({ arrayRemove, arrayUnion, doc, getDocFromServer, writeBatch }, db) : null;

export const watchAccountStages = (uid) => watchStages(uid, io, (...args) => console.info(...args));
