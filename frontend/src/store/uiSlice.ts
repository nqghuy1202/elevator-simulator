import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

/**
 * UI-only state — today just the WS connection status. Lives in its own
 * slice, separate from `buildingSlice`, so a Snapshot replace never touches
 * it (AD-3). This is the home for any UI-only state (panel expansion, etc.)
 * later stories (2.3-2.5) add.
 */
export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected';

export interface UiState {
  readonly connectionStatus: ConnectionStatus;
}

const initialState: UiState = {
  connectionStatus: 'connecting',
};

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    connectionStatusChanged(state, action: PayloadAction<ConnectionStatus>) {
      state.connectionStatus = action.payload;
    },
  },
});

export const { connectionStatusChanged } = uiSlice.actions;
export default uiSlice.reducer;
