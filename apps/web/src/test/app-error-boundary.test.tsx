import '@testing-library/jest-dom/vitest';

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AppErrorBoundary } from '@/components/organisms/app-error-boundary';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function BrokenPage(): never {
  throw new Error('render failed');
}

describe('AppErrorBoundary', () => {
  it('replaces a failed page with an accessible recovery action', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    render(<AppErrorBoundary><BrokenPage /></AppErrorBoundary>);

    expect(screen.getByRole('heading', { name: '페이지를 표시하지 못했습니다.' })).toBeVisible();
    expect(screen.getByRole('alert')).toHaveTextContent('예기치 않은 오류');
    expect(screen.getByRole('button', { name: '새로고침' })).toBeEnabled();
  });
});
