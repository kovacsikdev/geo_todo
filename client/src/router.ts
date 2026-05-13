import { createBrowserRouter } from 'react-router-dom';
import React from 'react';
import App from './App';
import LandingPage from './LandingPage';
import TripApp from './TripApp';

export const router = createBrowserRouter([
  {
    path: '/',
    element: React.createElement(App),
    children: [
      {
        index: true,
        element: React.createElement(LandingPage),
      },
      {
        path: '/app',
        element: React.createElement(TripApp),
      },
    ],
  },
]);