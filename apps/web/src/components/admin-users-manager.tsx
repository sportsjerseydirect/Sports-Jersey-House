"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

type AdminUser = {
  id: string;
  email: string;
  displayName: string | null;
  role: string;
  isActive: boolean;
  lastLoginAt: Date | string | null;
  createdAt: Date | string;
};

export function AdminUsersManager({ initialUsers }: { initialUsers: AdminUser[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function onCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: String(form.get("email") ?? ""),
          password: String(form.get("password") ?? ""),
          displayName: String(form.get("displayName") ?? "") || undefined
        })
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(data.error ?? "Could not create user.");
        return;
      }
      setMessage("Admin user created.");
      event.currentTarget.reset();
      router.refresh();
    } catch {
      setError("Could not create user.");
    } finally {
      setBusy(false);
    }
  }

  async function setActive(userId: string, isActive: boolean) {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, isActive })
      });
      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        setError(data.error ?? "Update failed.");
        return;
      }
      router.refresh();
    } catch {
      setError("Update failed.");
    } finally {
      setBusy(false);
    }
  }

  async function resetPassword(userId: string) {
    const password = window.prompt("New password (min 10 characters):");
    if (!password) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, newPassword: password })
      });
      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        setError(data.error ?? "Password reset failed.");
        return;
      }
      setMessage("Password updated.");
      router.refresh();
    } catch {
      setError("Password reset failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="admin-actions" aria-label="Admin users">
      <form className="admin-inline-form" onSubmit={onCreate}>
        <h2>Create admin user</h2>
        <label className="field">
          <span>Email</span>
          <input autoComplete="off" name="email" required type="email" />
        </label>
        <label className="field">
          <span>Display name</span>
          <input name="displayName" type="text" />
        </label>
        <label className="field">
          <span>Temporary password</span>
          <input autoComplete="new-password" minLength={10} name="password" required type="password" />
        </label>
        <button className="button primary" disabled={busy} type="submit">
          {busy ? "Saving…" : "Create user"}
        </button>
      </form>

      {error ? <p role="alert">{error}</p> : null}
      {message ? <p role="status">{message}</p> : null}

      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Email</th>
              <th>Name</th>
              <th>Role</th>
              <th>Active</th>
              <th>Last login</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {initialUsers.length === 0 ? (
              <tr>
                <td colSpan={6}>No named admin users yet — bootstrap password still works.</td>
              </tr>
            ) : (
              initialUsers.map((user) => (
                <tr key={user.id}>
                  <td>{user.email}</td>
                  <td>{user.displayName ?? "—"}</td>
                  <td>{user.role}</td>
                  <td>{user.isActive ? "Yes" : "No"}</td>
                  <td>
                    {user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString() : "Never"}
                  </td>
                  <td>
                    <div className="actions">
                      <button
                        className="button secondary"
                        disabled={busy}
                        onClick={() => setActive(user.id, !user.isActive)}
                        type="button"
                      >
                        {user.isActive ? "Disable" : "Enable"}
                      </button>
                      <button
                        className="button secondary"
                        disabled={busy}
                        onClick={() => resetPassword(user.id)}
                        type="button"
                      >
                        Reset password
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
