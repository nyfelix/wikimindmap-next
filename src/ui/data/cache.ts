/**
 * The cache (TS-10, architecture.md §6): TanStack Query in memory, persisted per query to
 * IndexedDB (idb-keyval) with a lifetime per kind of data. If IndexedDB isn't available
 * (private mode, blocked storage), every storage call quietly does nothing and the app keeps
 * working with the in-memory cache.
 */
import {
  experimental_createQueryPersister,
  type AsyncStorage,
  type PersistedQuery,
} from "@tanstack/query-persist-client-core";
import { QueryClient } from "@tanstack/react-query";
import { createStore, del, get, set, type UseStore } from "idb-keyval";

/** Bump when cached data changes shape: old entries are then ignored. */
export const CACHE_VERSION = "1";

export const HOUR = 60 * 60 * 1000;
export const DAY = 24 * HOUR;
export const WEEK = 7 * DAY;

/** IndexedDB through idb-keyval, or nothing when storage fails. */
export function safeStorage(
  open: () => UseStore | undefined = defaultStore,
): AsyncStorage<PersistedQuery> {
  let store: UseStore | undefined;
  try {
    store = open();
  } catch {
    store = undefined;
  }
  return {
    getItem: async (key) => {
      if (!store) return undefined;
      try {
        return await get<PersistedQuery>(key, store);
      } catch {
        return undefined;
      }
    },
    setItem: async (key, value) => {
      if (!store) return;
      try {
        await set(key, value, store);
      } catch {
        // Quota or private mode: keep going with the memory cache.
      }
    },
    removeItem: async (key) => {
      if (!store) return;
      try {
        await del(key, store);
      } catch {
        // Nothing to clean up then.
      }
    },
  };
}

function defaultStore(): UseStore | undefined {
  return typeof indexedDB === "undefined" ? undefined : createStore("wikimindmap", "queries");
}

const storage = safeStorage();

function persister(maxAge: number) {
  return experimental_createQueryPersister<PersistedQuery>({
    storage,
    maxAge,
    buster: CACHE_VERSION,
    prefix: "wmm",
    // IndexedDB stores structured clones: no JSON round trip needed.
    serialize: (query) => query,
    deserialize: (stored) => stored,
  });
}

export const persisters = { day: persister(DAY), week: persister(WEEK) };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Wikipedia changes slowly; going back along the trail must not hit the network.
      staleTime: DAY,
      gcTime: DAY,
      refetchOnWindowFocus: false,
      // http.ts already retries 429/503; show other errors right away.
      retry: false,
    },
  },
});
