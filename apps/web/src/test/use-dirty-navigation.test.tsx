import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createMemoryRouter, Link, RouterProvider, useLocation, useNavigate } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useState } from 'react';
import { useDirtyNavigation } from '@/lib/use-dirty-navigation';

const NativeRequest = globalThis.Request;

class RouterTestRequest extends NativeRequest {
  constructor(input: RequestInfo | URL, init?: RequestInit) {
    // React Router uses jsdom's AbortSignal while Node's native Request checks
    // for Node's AbortSignal brand. No route in this harness has a loader, so
    // omit only that incompatible test-environment signal.
    super(input, init?.signal ? { ...init, signal: undefined } : init);
  }
}

function DirtyNavigationHarness() {
  const [dirty, setDirty] = useState(false);
  const blocker = useDirtyNavigation(dirty);
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <main>
      <output data-testid="location">{location.pathname}</output>
      <output data-testid="blocker">{blocker.state}</output>
      <button type="button" onClick={() => setDirty(true)}>make dirty</button>
      <Link to="/next">link navigation</Link>
      <button type="button" onClick={() => navigate('/next')}>programmatic navigation</button>
      {blocker.state === 'blocked' && <button type="button" onClick={() => blocker.proceed()}>proceed</button>}
    </main>
  );
}

function renderHarness(initialEntries: string[] = ['/editor'], initialIndex?: number) {
  const router = createMemoryRouter([{ path: '*', element: <DirtyNavigationHarness /> }], { initialEntries, ...(initialIndex === undefined ? {} : { initialIndex }) });
  render(<RouterProvider router={router} />);
  return router;
}

beforeEach(() => vi.stubGlobal('Request', RouterTestRequest));
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('useDirtyNavigation', () => {
  it('blocks Link navigation while dirty', async () => {
    renderHarness();
    fireEvent.click(screen.getByRole('button', { name: 'make dirty' }));
    fireEvent.click(screen.getByRole('link', { name: 'link navigation' }));

    await waitFor(() => expect(screen.getByTestId('blocker')).toHaveTextContent('blocked'));
    expect(screen.getByTestId('location')).toHaveTextContent('/editor');
  });

  it('blocks programmatic navigation and allows it after explicit proceed', async () => {
    renderHarness();
    fireEvent.click(screen.getByRole('button', { name: 'make dirty' }));
    fireEvent.click(screen.getByRole('button', { name: 'programmatic navigation' }));

    await waitFor(() => expect(screen.getByTestId('blocker')).toHaveTextContent('blocked'));
    expect(screen.getByTestId('location')).toHaveTextContent('/editor');
    fireEvent.click(screen.getByRole('button', { name: 'proceed' }));
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/next'));
  });

  it('blocks browser history back navigation while dirty', async () => {
    const router = renderHarness(['/previous', '/editor']);
    fireEvent.click(screen.getByRole('button', { name: 'make dirty' }));

    void router.navigate(-1);
    await waitFor(() => expect(screen.getByTestId('blocker')).toHaveTextContent('blocked'));
    expect(screen.getByTestId('location')).toHaveTextContent('/editor');
    await new Promise((resolve) => setTimeout(resolve, 25));
    expect(screen.getByTestId('blocker')).toHaveTextContent('blocked');
  });

  it('blocks browser history forward navigation while dirty', async () => {
    const router = renderHarness(['/previous', '/editor'], 0);
    fireEvent.click(screen.getByRole('button', { name: 'make dirty' }));

    void router.navigate(1);
    await waitFor(() => expect(screen.getByTestId('blocker')).toHaveTextContent('blocked'));
    expect(screen.getByTestId('location')).toHaveTextContent('/previous');
    await new Promise((resolve) => setTimeout(resolve, 25));
    expect(screen.getByTestId('blocker')).toHaveTextContent('blocked');
  });

  it('cancels browser unload while dirty', () => {
    renderHarness();
    fireEvent.click(screen.getByRole('button', { name: 'make dirty' }));

    const event = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
  });
});
