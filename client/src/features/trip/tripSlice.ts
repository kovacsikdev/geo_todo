import { createSlice } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';
import type { SharedState, TripRole } from '../../types';

const initialState: SharedState & { tripRole: TripRole } = {
  trip: { id: '', name: '' },
  locations: [],
  updatedAt: new Date().toISOString(),
  tripRole: 'guest',
};

const tripSlice = createSlice({
  name: 'trip',
  initialState,
  reducers: {
    setTripState(_state, action: PayloadAction<SharedState & { tripRole: TripRole }>) {
      return { ...action.payload };
    },
    // Add more reducers as needed
  },
});

export const { setTripState } = tripSlice.actions;
export default tripSlice.reducer;
