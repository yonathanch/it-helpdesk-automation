import { api } from '@/lib/api';
import type { AdminUser, AgentOption, Paginated, Role, UserListQuery } from '@/lib/types';

/**
 * Service pengguna — UsersController (backend/src/users).
 *
 * Semua endpoint di sini butuh login. `/users` hanya untuk ADMIN,
 * `/users/agents` untuk AGENT & ADMIN.
 */

export type CreateUserInput = {
  name: string;
  email: string;
  password: string;
  role: Role;
  department?: string;
};

export type UpdateUserInput = {
  name?: string;
  department?: string;
  role?: Role;
  isActive?: boolean;
};

/** GET /users?page=&limit=&role=&isActive=&search= — ADMIN */
export function listUsers(query: UserListQuery = {}) {
  return api.get<Paginated<AdminUser>>('/users', { query: { ...query } });
}

/** POST /users — ADMIN. Satu-satunya cara membuat akun AGENT/ADMIN. */
export function createUser(input: CreateUserInput) {
  const body: Record<string, string> = {
    name: input.name,
    email: input.email,
    password: input.password,
    role: input.role,
  };
  if (input.department?.trim()) body.department = input.department.trim();
  return api.post<AdminUser>('/users', body);
}

/** PATCH /users/:id — ADMIN */
export function updateUser(id: string, input: UpdateUserInput) {
  const body: Record<string, string | boolean> = {};
  if (input.name !== undefined) body.name = input.name;
  if (input.department !== undefined) body.department = input.department;
  if (input.role !== undefined) body.role = input.role;
  if (input.isActive !== undefined) body.isActive = input.isActive;
  return api.patch<AdminUser>(`/users/${id}`, body);
}

/** GET /users/agents — AGENT/ADMIN, untuk dropdown penugasan tiket. */
export function listAgents() {
  return api.get<AgentOption[]>('/users/agents');
}
