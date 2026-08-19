'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { signIn } from './actions';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button className="nav-btn primary" type="submit" disabled={pending} style={{ width: '100%' }}>
      {pending ? 'Signing in…' : 'Sign in'}
    </button>
  );
}

export default function LoginPage() {
  const [state, formAction] = useFormState(signIn, { error: null });

  return (
    <div className="login-shell">
      <form className="login-card" action={formAction}>
        <div className="eyebrow">Business Case Builder</div>
        <h1 className="login-title">Sign in</h1>
        <p className="login-sub">Single admin account — no public sign-up.</p>

        <div className="field">
          <label htmlFor="email">Email</label>
          <input id="email" name="email" type="email" required autoComplete="username" />
        </div>
        <div className="field">
          <label htmlFor="password">Password</label>
          <input id="password" name="password" type="password" required autoComplete="current-password" />
        </div>

        {state.error && <div className="login-error">{state.error}</div>}

        <SubmitButton />
      </form>
    </div>
  );
}
