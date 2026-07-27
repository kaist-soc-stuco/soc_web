import '@testing-library/jest-dom/vitest';

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { PublicFaqListResponse } from '@soc/contracts';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

import { FaqPage } from '@/pages/faq-page';

const getFaqsMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/faq-api', () => ({ getFaqs: getFaqsMock }));

afterEach(() => {
  cleanup();
  getFaqsMock.mockReset();
});

const localized = (value: string) => ({ value, translationUnavailable: false });
const renderFaq = () => render(<MemoryRouter><FaqPage /></MemoryRouter>);

const faqResponse: PublicFaqListResponse = {
  locale: 'ko',
  topics: [
    {
      id: 'membership',
      displayOrder: 1,
      title: localized('회원'),
      items: [
        {
          id: 'join',
          displayOrder: 1,
          question: localized('학생회 가입은 어떻게 하나요?'),
          answer: localized('학생회 공지를 통해 가입할 수 있습니다.'),
          updatedAt: '2026-07-27',
        },
      ],
    },
  ],
};

describe('FaqPage live data', () => {
  it('shows loading before rendering Korean API content', async () => {
    let resolve!: (response: PublicFaqListResponse) => void;
    getFaqsMock.mockReturnValueOnce(new Promise<PublicFaqListResponse>((done) => { resolve = done; }));

    renderFaq();

    expect(screen.getByText('FAQ를 불러오는 중입니다')).toBeVisible();
    resolve(faqResponse);

    expect(await screen.findByText('학생회 가입은 어떻게 하나요?')).toBeVisible();
    expect(screen.getByText('학생회 공지를 통해 가입할 수 있습니다.')).toBeVisible();
    expect(screen.getByRole('button', { name: '회원' })).toBeVisible();
  });

  it('renders an explicit failure without fallback content and retries', async () => {
    getFaqsMock.mockRejectedValueOnce(new Error('unavailable')).mockResolvedValueOnce(faqResponse);

    renderFaq();

    expect(await screen.findByText('FAQ를 불러오지 못했습니다')).toBeVisible();
    expect(screen.queryByText('학생회 가입은 어떻게 하나요?')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }));

    expect(screen.getByText('FAQ를 불러오는 중입니다')).toBeVisible();
    expect(await screen.findByText('학생회 가입은 어떻게 하나요?')).toBeVisible();
    await waitFor(() => expect(getFaqsMock).toHaveBeenCalledTimes(2));
  });

  it('reports an empty API response instead of rendering FAQ fallback data', async () => {
    getFaqsMock.mockResolvedValueOnce({ locale: 'ko', topics: [] } satisfies PublicFaqListResponse);

    renderFaq();

    expect(await screen.findByText('등록된 FAQ가 없습니다')).toBeVisible();
    expect(screen.queryByText('학생회 가입은 어떻게 하나요?')).not.toBeInTheDocument();
  });

  it('renders translation-unavailable FAQ fields explicitly', async () => {
    getFaqsMock.mockResolvedValueOnce({
      locale: 'ko',
      topics: [{
        ...faqResponse.topics[0]!,
        title: { value: null, translationUnavailable: true },
        items: [{
          ...faqResponse.topics[0]!.items[0]!,
          question: { value: null, translationUnavailable: true },
          answer: { value: null, translationUnavailable: true },
        }],
      }],
    });
    renderFaq();

    expect((await screen.findAllByText('번역이 제공되지 않습니다.')).length).toBeGreaterThanOrEqual(3);
  });
});
