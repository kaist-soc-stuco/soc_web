import '@testing-library/jest-dom/vitest';

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { AdminContactsPage } from '@/pages/admin-contacts-page';
import { adminMenu, csRoadmapCourses, roadmapMilestones } from '@/lib/static-site-content';

afterEach(cleanup);

describe('static site content', () => {
  it('keeps roadmap curriculum and admin navigation as separate public metadata', () => {
    expect(roadmapMilestones).toContain('1학년: 기초 프로그래밍, 자료구조, 수리 기초 다지기');
    expect(csRoadmapCourses).toContainEqual(
      expect.objectContaining({ code: '204', name: '이산구조', row: 2, column: 2 }),
    );
    expect(adminMenu).toContainEqual({ label: '집행위 연락망', to: '/admin/contacts' });
    expect(adminMenu).not.toContainEqual(expect.objectContaining({ email: expect.any(String) }));
    expect(adminMenu).not.toContainEqual(expect.objectContaining({ mobile: expect.any(String) }));
  });
});

describe('AdminContactsPage', () => {
  it('reports that contacts are unavailable without rendering personal contact data', () => {
    const { container } = render(<AdminContactsPage />);

    expect(screen.getByRole('heading', { name: '집행위 연락망' })).toBeVisible();
    expect(screen.getByText('연락처 정보는 현재 제공되지 않습니다.')).toBeVisible();
    expect(screen.getByText('이메일')).toBeVisible();
    expect(screen.getByText('전화번호')).toBeVisible();
    expect(container).not.toHaveTextContent(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
    expect(container).not.toHaveTextContent(/(?:01[0-9]|0[2-9][0-9])-?\d{3,4}-?\d{4}/);
  });
});
