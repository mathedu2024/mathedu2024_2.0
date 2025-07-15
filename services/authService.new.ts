import {
  getAuth,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  User
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from './firebase';
const auth = getAuth();

interface UserProfile {
  uid: string;
  email: string | null;
  role: 'admin' | 'teacher' | 'student';
  name?: string;
}

/**
 * Handles user login with email and password.
 * @param email The user's email.
 * @param password The user's password.
 * @returns The user credential on successful login.
 */
export const loginWithEmailPassword = async (email: string, password: string) => {
  return signInWithEmailAndPassword(auth, email, password);
};

/**
 * Handles user logout.
 */
export const logout = async () => {
  return await signOut(auth);
};

/**
 * Gets or creates a user profile in Firestore.
 * After a user signs in, this function checks if a user profile exists in the 'users' collection.
 * If not, it creates one, attempting to migrate the role from the 'admin-teachers' collection
 * for admins and teachers. Defaults to 'student' role if not found.
 * @param user The Firebase authenticated user object.
 * @returns The user's profile from Firestore.
 */
export const getOrCreateUserProfile = async (user: User): Promise<UserProfile> => {
  const userRef = doc(db, 'users', user.uid);
  const userSnap = await getDoc(userRef);

  if (userSnap.exists()) {
    return userSnap.data() as UserProfile;
  } else {
    // User profile doesn't exist, let's create it.
    // First, check if the user is an admin or teacher.
    // We'll assume the email is used as the document ID in 'admin-teachers'.
    const adminTeacherRef = doc(db, 'admin-teachers', user.email!);
    const adminTeacherSnap = await getDoc(adminTeacherRef);

    let role: 'admin' | 'teacher' | 'student' = 'student';
    let name: string | undefined = undefined;

    if (adminTeacherSnap.exists()) {
      const adminTeacherData = adminTeacherSnap.data();
      role = adminTeacherData.role || 'teacher'; // Assuming 'role' field exists
      name = adminTeacherData.name;

      // Also, update the admin-teachers document with the new UID for future lookups.
      if (!adminTeacherData.uid) {
        await setDoc(adminTeacherRef, { uid: user.uid }, { merge: true });
      }
    } else {
      // This is a student. Let's try to link their UID to their record in 'student_data'.
      // We assume the document ID in 'student_data' is the student's email.
      const studentDataRef = doc(db, 'student_data', user.email!);
      const studentDataSnap = await getDoc(studentDataRef);
      if (studentDataSnap.exists()) {
        name = studentDataSnap.data().name; // Get name from student record
        // Update the student record with their UID for security rules
        await setDoc(studentDataRef, { uid: user.uid }, { merge: true });
      }
    }

    // Now, create the new user profile
    const newUserProfile: UserProfile = {
      uid: user.uid,
      email: user.email,
      role,
      name: name || user.displayName || '新用戶',
    };

    await setDoc(userRef, newUserProfile);
    return newUserProfile;
  }
}; 