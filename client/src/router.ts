import { createRouter, createRootRoute, createRoute } from '@tanstack/react-router';
import App from './App';
import LandingPage from './LandingPage';
import TripApp from './TripApp';

const rootRoute = createRootRoute({
  component: App,
});

const landingRoute = createRoute({
  path: '/',
  getParentRoute: () => rootRoute,
  component: LandingPage,
});

const appRoute = createRoute({
  path: '/app',
  getParentRoute: () => rootRoute,
  component: TripApp,
});

const routeTree = rootRoute.addChildren([landingRoute, appRoute]);

const router = createRouter({
  routeTree,
});

export { router };