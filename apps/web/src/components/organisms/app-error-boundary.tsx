import { uiText } from "@/lib/i18n/surface-catalog";
import { Component, type ErrorInfo, type ReactNode } from 'react';
type Props = {
    children: ReactNode;
};
type State = {
    failed: boolean;
};
export class AppErrorBoundary extends Component<Props, State> {
    state: State = { failed: false };
    static getDerivedStateFromError(): State {
        return { failed: true };
    }
    componentDidCatch(error: Error, info: ErrorInfo) {
        console.error('Unhandled application error', error, info);
    }
    render() {
        if (!this.state.failed)
            return this.props.children;
        return (<main className="flex min-h-screen items-center justify-center bg-[#F7FCFC] px-6">
        <section aria-labelledby="app-error-title" className="max-w-lg rounded-lg border border-kaist-grey/25 bg-white p-8 text-center shadow-sm">
          <h1 id="app-error-title" className="text-2xl font-extrabold text-kaist-darkgreen">{uiText("components.organisms.app-error-boundary.5dbecb3a6a")}</h1>
          <p role="alert" className="mt-3 text-kaist-grey">{uiText("components.organisms.app-error-boundary.41edf3399d")}</p>
          <button type="button" onClick={() => window.location.reload()} className="mt-6 rounded bg-kaist-darkgreen px-5 py-2 font-bold text-white">{uiText("components.organisms.app-error-boundary.deb94acf38")}</button>
        </section>
      </main>);
    }
}
