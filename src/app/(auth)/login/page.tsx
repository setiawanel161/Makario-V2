import { signIn } from '@/server/auth/auth';
import { getConfiguredOAuthProviders, isDemoSignInEnabled } from '@/server/auth/auth';

export const metadata = { title: 'Sign in · Makario' };

export default function LoginPage(): React.JSX.Element {
  const oauthProviders = getConfiguredOAuthProviders();

  async function signInWithDemo(formData: FormData): Promise<void> {
    'use server';
    await signIn(
      'demo',
      {
        email: String(formData.get('email') ?? ''),
        name: String(formData.get('name') ?? ''),
        redirectTo: '/',
      },
    );
  }

  async function signInWithGoogle(): Promise<void> {
    'use server';
    await signIn('google', { redirectTo: '/' });
  }

  async function signInWithGitHub(): Promise<void> {
    'use server';
    await signIn('github', { redirectTo: '/' });
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--bg-sidebar)] px-4 py-12">
      <section className="w-full max-w-md rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] p-8 shadow-[var(--shadow-modal)]">
        <p className="text-sm font-semibold text-[var(--accent-primary)]">Makario</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">Make room for good work.</h1>
        <p className="mt-3 text-sm text-[var(--ink-secondary)]">
          Sign in to gather your notes, plans, and connected workflows in one thoughtful space.
        </p>

        {oauthProviders.includes('google') && (
          <form action={signInWithGoogle}>
            <button
              className="mt-6 w-full rounded-md border border-[var(--border-hairline)] px-4 py-2 text-sm font-medium hover:bg-[var(--bg-hover)]"
              type="submit"
            >
              Continue with Google
            </button>
          </form>
        )}
        {oauthProviders.includes('github') && (
          <form action={signInWithGitHub}>
            <button
              className="mt-3 w-full rounded-md border border-[var(--border-hairline)] px-4 py-2 text-sm font-medium hover:bg-[var(--bg-hover)]"
              type="submit"
            >
              Continue with GitHub
            </button>
          </form>
        )}

        {isDemoSignInEnabled() && (
          <form action={signInWithDemo} className="mt-6 space-y-3">
            <div className="border-t border-[var(--border-hairline)] pt-5">
              <p className="text-sm font-medium">Try a demo workspace</p>
              <p className="mt-1 text-xs text-[var(--ink-secondary)]">
                Use a local demo identity—no external account required.
              </p>
            </div>
            <label className="block text-xs font-medium" htmlFor="demo-name">
              Your name
            </label>
            <input
              id="demo-name"
              name="name"
              className="w-full rounded-md border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3 py-2 text-sm"
              defaultValue="Demo Builder"
              maxLength={80}
            />
            <label className="block text-xs font-medium" htmlFor="demo-email">
              Demo email
            </label>
            <input
              id="demo-email"
              name="email"
              type="email"
              className="w-full rounded-md border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3 py-2 text-sm"
              defaultValue="demo@makario.local"
              required
            />
            <button
              className="w-full rounded-md bg-[var(--accent-primary)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--accent-primary-hover)]"
              type="submit"
            >
              Enter workspace
            </button>
          </form>
        )}
      </section>
    </main>
  );
}
