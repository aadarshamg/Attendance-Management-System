import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Role, UserSummary } from '@ams/shared';
import { api } from '../lib/api';

const ROLES: Role[] = ['worker', 'supervisor', 'admin'];

interface FormState {
  id?: string;
  name: string;
  role: Role;
  employeeCode: string;
  phone: string;
  assignedSiteId: string;
  password: string;
  pin: string;
  isActive: boolean;
}

const BLANK: FormState = {
  name: '',
  role: 'worker',
  employeeCode: '',
  phone: '',
  assignedSiteId: '',
  password: '',
  pin: '',
  isActive: true,
};

export function UsersPage() {
  const queryClient = useQueryClient();
  const users = useQuery({ queryKey: ['users'], queryFn: api.users });
  const sites = useQuery({ queryKey: ['sites'], queryFn: api.sites });
  const [form, setForm] = useState<FormState | null>(null);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['users'] });

  const save = useMutation({
    mutationFn: async (f: FormState) => {
      const assignedSiteId = f.assignedSiteId || null;
      if (f.id) {
        return api.updateUser(f.id, {
          name: f.name,
          role: f.role,
          phone: f.phone || null,
          assignedSiteId,
          isActive: f.isActive,
          ...(f.password ? { password: f.password } : {}),
          ...(f.pin && f.role === 'worker' ? { pin: f.pin } : {}),
        });
      }
      return api.createUser({
        name: f.name,
        role: f.role,
        employeeCode: f.employeeCode,
        phone: f.phone || undefined,
        assignedSiteId,
        ...(f.password ? { password: f.password } : {}),
        ...(f.pin && f.role === 'worker' ? { pin: f.pin } : {}),
      });
    },
    onSuccess: () => {
      invalidate();
      setForm(null);
    },
  });

  const deactivate = useMutation({
    mutationFn: (id: string) => api.deactivateUser(id),
    onSuccess: invalidate,
  });

  const isWorker = form?.role === 'worker';

  const startEdit = (u: UserSummary) =>
    setForm({
      id: u.id,
      name: u.name,
      role: u.role,
      employeeCode: u.employeeCode,
      phone: u.phone ?? '',
      assignedSiteId: u.assignedSiteId ?? '',
      password: '',
      pin: '',
      isActive: u.isActive,
    });

  return (
    <div className="stack">
      <div className="row-between">
        <h1>Workers &amp; staff</h1>
        <button className="primary" onClick={() => setForm({ ...BLANK })}>
          Add user
        </button>
      </div>

      {form && (
        <form
          className="card filters"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate(form);
          }}
        >
          <label>
            Name
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </label>
          <label>
            Employee code
            <input
              value={form.employeeCode}
              onChange={(e) => setForm({ ...form, employeeCode: e.target.value })}
              disabled={Boolean(form.id)}
              required
            />
          </label>
          <label>
            Role
            <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as Role })}>
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </label>
          <label>
            Site {form.role === 'worker' ? '(required)' : '(supervisors: their site)'}
            <select
              value={form.assignedSiteId}
              onChange={(e) => setForm({ ...form, assignedSiteId: e.target.value })}
            >
              <option value="">None</option>
              {(sites.data ?? []).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Phone {isWorker ? '(worker logs in with this)' : '(optional)'}
            <input
              type="tel"
              inputMode="numeric"
              placeholder="10-digit mobile"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              required={isWorker && Boolean(form.pin)}
            />
          </label>
          {isWorker && (
            <label>
              {form.id ? 'Set new 4-digit PIN (optional)' : '4-digit login PIN'}
              <input
                inputMode="numeric"
                autoComplete="off"
                pattern="\d{4}"
                maxLength={4}
                placeholder="e.g. 4821"
                value={form.pin}
                onChange={(e) => setForm({ ...form, pin: e.target.value.replace(/\D/g, '').slice(0, 4) })}
                required={!form.id && !form.password}
              />
            </label>
          )}
          <label>
            {form.id
              ? 'Reset password (optional)'
              : isWorker
                ? 'Password (optional, for employee-code login)'
                : 'Password'}
            <input
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              minLength={8}
              required={!form.id && !isWorker}
            />
          </label>
          {form.id && (
            <label className="row gap">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
              />
              Active
            </label>
          )}
          <div className="row gap">
            <button type="submit" className="primary" disabled={save.isPending}>
              {save.isPending ? 'Saving…' : 'Save'}
            </button>
            <button type="button" onClick={() => setForm(null)}>
              Cancel
            </button>
          </div>
          {save.isError && <p className="error">{(save.error as Error).message}</p>}
        </form>
      )}

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Code</th>
              <th>Role</th>
              <th>Site</th>
              <th>Phone login</th>
              <th>Consent</th>
              <th>Active</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {(users.data ?? []).map((u) => (
              <tr key={u.id} className={u.isActive ? '' : 'dim'}>
                <td>{u.name}</td>
                <td>{u.employeeCode}</td>
                <td>{u.role}</td>
                <td>{u.assignedSiteName ?? '-'}</td>
                <td>{u.role === 'worker' ? (u.hasPin ? `${u.phone} · PIN set` : 'No PIN') : '-'}</td>
                <td>{u.consentedAt ? new Date(u.consentedAt).toLocaleDateString() : '-'}</td>
                <td>{u.isActive ? 'yes' : 'no'}</td>
                <td className="row gap">
                  <button className="link" onClick={() => startEdit(u)}>
                    Edit
                  </button>
                  {u.isActive && (
                    <button className="link" onClick={() => deactivate.mutate(u.id)}>
                      Deactivate
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {deactivate.isError && <p className="error">{(deactivate.error as Error).message}</p>}
    </div>
  );
}
