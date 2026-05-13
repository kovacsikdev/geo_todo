import { combineReducers } from '@reduxjs/toolkit';
import tripReducer from './features/trip/tripSlice';

const rootReducer = combineReducers({
  trip: tripReducer,
});

export default rootReducer;
