import { api, ApiError, html, logo, passwordInput, raw, showErrors } from '../lib.js';

const REMEMBER_KEY = 'axt.rememberedEmail';
const store = {
  get: () => { try { return localStorage.getItem(REMEMBER_KEY) || ''; } catch { return ''; } },
  set: (v) => { try { if (v) localStorage.setItem(REMEMBER_KEY, v); else localStorage.removeItem(REMEMBER_KEY); } catch { /* storage unavailable */ } },
};

export function render(root, { onLogin, expired = false }) {
  const remembered = store.get();
  root.innerHTML = String(html`
    <div class="login-wrap">
      <form class="login-card" novalidate>
        <div class="brand">${logo(36)}<div><div class="brand-name">AXIORA</div><div class="brand-sub">LABS AI</div></div></div>
        <h1>Sign in</h1>
        <p class="muted">Change &amp; Defect Tracking</p>
        ${expired ? html`<div class="hint warn" role="status" style="margin-top:12px">You were signed out after a period of inactivity. Please sign in again.</div>` : ''}
        <div class="stack" style="margin-top:18px">
          <div class="field" data-field="email"><label for="email">Email</label><input id="email" type="email" name="email" autocomplete="username" value="${remembered}" required></div>
          <div class="field" data-field="password"><label for="password">Password</label>${passwordInput({ id: 'password', name: 'password' })}</div>
          <div class="login-options"><label class="check"><input type="checkbox" name="remember" ${remembered ? raw('checked') : ''}> Remember me</label>
            <span class="muted small">Stay signed in for 30 days</span></div>
          <button class="btn btn-primary btn-block" type="submit">Sign in</button>
        </div>
      </form>
    </div>`);
  const form = root.querySelector('form');
  (remembered ? form.password : form.email).focus();
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = form.querySelector('button');
    btn.disabled = true;
    try {
      const remember = form.remember.checked;
      await api('POST', 'api/auth/login', { email: form.email.value, password: form.password.value, remember });
      store.set(remember ? form.email.value.trim() : '');
      await onLogin();
    } catch (err) {
      btn.disabled = false;
      if (err instanceof ApiError) showErrors(form, err, form.querySelector('.stack'));
      else throw err;
    }
  });
}
