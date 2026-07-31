import { Component, type ErrorInfo, type ReactNode } from 'react';

type Props = { children: ReactNode };
type State = { failed: boolean };

export class AppErrorBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Unhandled application error', error, info);
  }

  render() {
    if (!this.state.failed) return this.props.children;

    return (
      <main className="flex min-h-screen items-center justify-center bg-[#F7FCFC] px-6">
        <section aria-labelledby="app-error-title" className="max-w-lg rounded-lg border border-kaist-grey/25 bg-white p-8 text-center shadow-sm">
          <h1 id="app-error-title" className="text-2xl font-extrabold text-kaist-darkgreen">페이지를 표시하지 못했습니다.</h1>
          <p role="alert" className="mt-3 text-kaist-grey">예기치 않은 오류가 발생했습니다. 페이지를 새로고침해 주세요.</p>
          <button type="button" onClick={() => window.location.reload()} className="mt-6 rounded bg-kaist-darkgreen px-5 py-2 font-bold text-white">
            새로고침
          </button>
        </section>
      </main>
    );
  }
}
