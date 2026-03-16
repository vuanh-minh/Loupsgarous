import { RouterProvider } from 'react-router';
import { router } from './routes';
import { ErrorBoundary } from './components/ErrorBoundary';

/**
 * Loup-Garou de Thiercelieux — entry point.
 * Uses a static import for routes to avoid dynamic-import fetch failures
 * in the Figma Make / Vite sandbox environment.
 * (cache-bust: v17)
 */

export default function App() {
  return (
    <ErrorBoundary>
      <RouterProvider router={router} />
    </ErrorBoundary>
  );
}