import type * as admin from 'firebase-admin';
import { assertDbReadBudget, mapFirestoreReadError, recordDbReads } from './dbReadGuard';
import { assertDbWriteBudget, mapFirestoreWriteError, recordDbWrites } from './dbWriteGuard';

const WRITE_OPS = new Set(['set', 'update', 'delete', 'create', 'add']);
const PENDING_WRITES = Symbol('pendingWrites');

type PendingWritesHolder = {
  [PENDING_WRITES]: number;
};

function isThenable(value: unknown): value is Promise<unknown> {
  return value !== null && typeof value === 'object' && typeof (value as Promise<unknown>).then === 'function';
}

function countSnapshotReads(
  snapshot: admin.firestore.DocumentSnapshot | admin.firestore.QuerySnapshot
): number {
  if ('size' in snapshot && typeof snapshot.size === 'number') {
    return snapshot.size > 0 ? snapshot.size : 1;
  }
  return 1;
}

function getPendingWrites(target: object): number {
  return (target as PendingWritesHolder)[PENDING_WRITES] ?? 0;
}

function addPendingWrite(target: object, count = 1): void {
  (target as PendingWritesHolder)[PENDING_WRITES] = getPendingWrites(target) + count;
}

function shouldWrapFirestoreNode(result: unknown): boolean {
  if (!result || typeof result !== 'object') return false;
  const node = result as Record<string, unknown>;
  return (
    typeof node.get === 'function' ||
    typeof node.set === 'function' ||
    typeof node.add === 'function' ||
    typeof node.commit === 'function' ||
    typeof node.batch === 'function'
  );
}

function wrapGuardedOperation<T extends object>(target: T): T {
  return new Proxy(target, {
    get(obj, prop, receiver) {
      const value = Reflect.get(obj, prop, receiver);

      if (prop === 'get' && typeof value === 'function') {
        return async (...args: unknown[]) => {
          assertDbReadBudget(1);
          try {
            const snapshot = await value.apply(obj, args);
            recordDbReads(countSnapshotReads(snapshot));
            return snapshot;
          } catch (error) {
            throw mapFirestoreReadError(error);
          }
        };
      }

      if (prop === 'getAll' && typeof value === 'function') {
        return async (...args: unknown[]) => {
          const estimated = args.filter(Boolean).length || 1;
          assertDbReadBudget(estimated);
          try {
            const snapshots = await value.apply(obj, args);
            const count = Array.isArray(snapshots) ? snapshots.length || 1 : 1;
            recordDbReads(count);
            return snapshots;
          } catch (error) {
            throw mapFirestoreReadError(error);
          }
        };
      }

      if (WRITE_OPS.has(String(prop)) && typeof value === 'function') {
        return (...args: unknown[]) => {
          try {
            const result = value.apply(obj, args);
            if (isThenable(result)) {
              return (async () => {
                assertDbWriteBudget(1);
                try {
                  const resolved = await result;
                  recordDbWrites(1);
                  return resolved;
                } catch (error) {
                  throw mapFirestoreWriteError(error);
                }
              })();
            }

            addPendingWrite(obj, 1);
            return result;
          } catch (error) {
            throw mapFirestoreWriteError(error);
          }
        };
      }

      if (prop === 'commit' && typeof value === 'function') {
        return async (...args: unknown[]) => {
          const pending = getPendingWrites(obj) || 1;
          assertDbWriteBudget(pending);
          try {
            const commitResult = await value.apply(obj, args);
            recordDbWrites(pending);
            return commitResult;
          } catch (error) {
            throw mapFirestoreWriteError(error);
          }
        };
      }

      if (prop === 'runTransaction' && typeof value === 'function') {
        return (
          updateFunction: (transaction: admin.firestore.Transaction) => Promise<unknown>,
          ...rest: unknown[]
        ) =>
          value.call(obj, async (transaction: admin.firestore.Transaction) => {
            const wrappedTransaction = wrapGuardedOperation(transaction);
            try {
              const result = await updateFunction(wrappedTransaction);
              const pending = getPendingWrites(wrappedTransaction);
              if (pending > 0) {
                assertDbWriteBudget(pending);
                recordDbWrites(pending);
              }
              return result;
            } catch (error) {
              throw mapFirestoreWriteError(error);
            }
          }, ...rest);
      }

      if (typeof value === 'function') {
        return (...args: unknown[]) => {
          const result = value.apply(obj, args);
          if (shouldWrapFirestoreNode(result)) {
            return wrapGuardedOperation(result as object);
          }
          return result;
        };
      }

      return value;
    },
  }) as T;
}

export function createGuardedFirestore(db: admin.firestore.Firestore): admin.firestore.Firestore {
  return wrapGuardedOperation(db);
}

/** @deprecated 請改用 createGuardedFirestore */
export const createReadGuardedFirestore = createGuardedFirestore;
