import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { BuildingSnapshot } from 'shared/src/index.js';

/**
 * Holds the single latest `BuildingSnapshot` received from the server —
 * never anything the client derives or interpolates itself (FR-14, AD-1).
 * `snapshotReceived` is a replace-only reducer: a fresh Snapshot always
 * fully replaces the previous one (never a partial merge), guarded by
 * `tick` so a stale/out-of-order/duplicate delivery (e.g. on reconnect) is
 * silently dropped rather than regressing the store (AD-3).
 */
export interface BuildingState {
  readonly snapshot: BuildingSnapshot | null;
}

const initialState: BuildingState = {
  snapshot: null,
};

const buildingSlice = createSlice({
  name: 'building',
  initialState,
  reducers: {
    snapshotReceived(state, action: PayloadAction<BuildingSnapshot>) {
      if (state.snapshot && action.payload.tick <= state.snapshot.tick) return;
      // Return a new state object (rather than assigning into the Immer
      // draft's `snapshot` property) — the incoming `BuildingSnapshot`'s
      // `readonly` array fields aren't assignable to Immer's mutable draft
      // type, and this is a whole-object replace anyway (never a partial
      // merge), so bypassing the draft here changes nothing behaviorally.
      return { snapshot: action.payload };
    },
    /**
     * Clears the stored Snapshot so the next `snapshotReceived` is
     * unconditionally accepted regardless of its `tick`. Dispatched on every
     * socket `connect` (including reconnects) — after a backend restart the
     * server's `tick` counter resets to 0/low, and without this reset the
     * tick-guard above would permanently reject every post-restart Snapshot
     * because it can never exceed the pre-restart tick the client
     * remembers.
     */
    connectionReset(state) {
      state.snapshot = null;
    },
  },
});

export const { snapshotReceived, connectionReset } = buildingSlice.actions;
export default buildingSlice.reducer;
