import { configureStore } from '@reduxjs/toolkit';
import { useDispatch, useSelector, type TypedUseSelectorHook } from 'react-redux';
import buildingReducer from './buildingSlice.js';
import uiReducer from './uiSlice.js';

/**
 * The single Redux store (FR-17): all Snapshot and UI-interaction state
 * lives here, split across `building` (replace-only Snapshot mirror) and
 * `ui` (connection status today; home for later UI-only state).
 */
export const store = configureStore({
  reducer: {
    building: buildingReducer,
    ui: uiReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

export const useAppDispatch: () => AppDispatch = useDispatch;
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;
