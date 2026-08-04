import '@testing-library/jest-dom/vitest';

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { ConfirmationDialog } from '@/components/ui/confirmation-dialog';

const originalShowModal = HTMLDialogElement.prototype.showModal;
const originalClose = HTMLDialogElement.prototype.close;

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function showModal() { this.open = true; };
  HTMLDialogElement.prototype.close = function close() { this.open = false; };
});

afterAll(() => {
  HTMLDialogElement.prototype.showModal = originalShowModal;
  HTMLDialogElement.prototype.close = originalClose;
});

afterEach(cleanup);

describe('ConfirmationDialog', () => {
  it('connects stable title and description ids and focuses Cancel first', async () => {
    render(<ConfirmationDialog open title="Publish survey?" description="Participants can respond immediately." confirmLabel="Publish" onConfirm={vi.fn()} onCancel={vi.fn()} />);

    const dialog = screen.getByRole('dialog');
    const title = screen.getByRole('heading', { name: 'Publish survey?' });
    const description = screen.getByText('Participants can respond immediately.');
    expect(dialog).toHaveAttribute('aria-labelledby', title.id);
    expect(dialog).toHaveAttribute('aria-describedby', description.id);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus());
  });

  it('cancels for Escape unless busy and restores opener focus after close', () => {
    const onCancel = vi.fn();
    const { rerender } = render(<><button type="button">Open</button><ConfirmationDialog open={false} title="Discard changes?" confirmLabel="Discard" onConfirm={vi.fn()} onCancel={onCancel} /></>);
    const opener = screen.getByRole('button', { name: 'Open' });
    opener.focus();
    rerender(<><button type="button">Open</button><ConfirmationDialog open title="Discard changes?" confirmLabel="Discard" onConfirm={vi.fn()} onCancel={onCancel} /></>);

    fireEvent(screen.getByRole('dialog'), new Event('cancel', { cancelable: true }));
    expect(onCancel).toHaveBeenCalledOnce();
    rerender(<><button type="button">Open</button><ConfirmationDialog open={false} title="Discard changes?" confirmLabel="Discard" onConfirm={vi.fn()} onCancel={onCancel} /></>);
    expect(screen.getByRole('button', { name: 'Open' })).toHaveFocus();

    rerender(<ConfirmationDialog open busy title="Discard changes?" confirmLabel="Discard" onConfirm={vi.fn()} onCancel={onCancel} />);
    fireEvent(screen.getByRole('dialog'), new Event('cancel', { cancelable: true }));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('locks duplicate confirmation while an async action is running', async () => {
    let resolve!: () => void;
    const onConfirm = vi.fn(() => new Promise<void>((done) => { resolve = done; }));
    render(<ConfirmationDialog open title="Delete response?" confirmLabel="Delete" destructive onConfirm={onConfirm} onCancel={vi.fn()} />);

    const confirm = screen.getByRole('button', { name: 'Delete' });
    fireEvent.click(confirm);
    fireEvent.click(confirm);
    expect(onConfirm).toHaveBeenCalledOnce();
    expect(confirm).toBeDisabled();
    resolve();
    await waitFor(() => expect(confirm).not.toBeDisabled());
  });
});
