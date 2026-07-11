# Frontend Build Guide — Hospital Equipment Inventory System

**Stack:** Angular (standalone components) + PrimeNG + Tailwind CSS
**Backend:** this repo (NestJS + MongoDB) — see root [`README.md`](README.md) and the per-module READMEs under `src/modules/*/README.md` for the authoritative API reference. This guide cross-references them instead of duplicating every field.

This is a step-by-step build order, not just an architecture doc — follow it top to bottom and you'll have a working app at every checkpoint.

---

## 0. What you're building

One Angular app, **two experiences gated by role**, sharing the same shell/components:

| Experience | Roles | Sees |
|-------------|-------|------|
| **Admin Console** | `ADMINISTRATOR` | Everything: Users, Departments, all Equipment/Maintenance/Receiving hospital-wide, Dashboard (hospital-wide), Reports |
| **Operational Dashboard** | `STORE_OFFICER`, `BIOMEDICAL_ENGINEER`, `DEPARTMENT_USER` | Equipment/Maintenance/Receiving scoped to their assigned department(s), their own Notifications/Profile — **no** Users, Departments (write), or Reports |

The backend already enforces this via RBAC (`@Roles`) and department scoping — see the "Global conventions" section of the root README. The frontend's job is to **mirror it for good UX** (hide actions the user can't perform) while still handling `401`/`403`/`400` responses gracefully everywhere, since the backend is the real source of truth.

Recommended approach: **one shell component, one menu config driven by role** — not two separate apps. Less duplication, one place to fix bugs.

---

## 1. Prerequisites

- Node.js LTS + Angular CLI (`npm install -g @angular/cli`)
- The backend running locally (`npm run start:dev` in this repo) and reachable, or its deployed URL
- Swagger UI at `<API_URL>/api/docs` open in a tab while you build — fastest way to check exact request/response shapes as you go
- A logged-in admin account to test with (seeded by the backend — see root README → Seed data)

---

## 2. Project setup

```bash
ng new hospital-equipment-frontend --routing --style=css --standalone
cd hospital-equipment-frontend

# PrimeNG + icons + the official Tailwind integration plugin
npm install primeng primeicons @primeng/themes tailwindcss-primeui

# Tailwind CSS
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
```

> PrimeNG's exact theming API has changed across major versions (the modern versions use a token-based theme system with presets like Aura/Lara/Nora via `@primeng/themes`, configured through `providePrimeNG`). Check the installed version's docs if anything below doesn't match — the *pattern* (one shell, role-driven menu, reactive forms, PrimeNG Table for lists) stays the same regardless.

**`tailwind.config.js`**

```javascript
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{html,ts}'],
  darkMode: ['selector', '[class="app-dark"]'],
  plugins: [require('tailwindcss-primeui')],
};
```

**`src/styles.css`**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

html, body { height: 100%; margin: 0; font-family: 'Inter', sans-serif; }
```

**`src/app/app.config.ts`**

```typescript
import { ApplicationConfig } from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { providePrimeNG } from 'primeng/config';
import Aura from '@primeng/themes/aura';
import { routes } from './app.routes';
import { authInterceptor } from './core/interceptors/auth.interceptor';
import { errorInterceptor } from './core/interceptors/error.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes, withComponentInputBinding()),
    provideHttpClient(withInterceptors([authInterceptor, errorInterceptor])),
    provideAnimationsAsync(),
    providePrimeNG({ theme: { preset: Aura, options: { darkModeSelector: '.app-dark' } } }),
  ],
};
```

**`src/environments/environment.ts`** / **`environment.prod.ts`**

```typescript
export const environment = {
  production: false,
  apiUrl: 'http://localhost:3000',
};
```

---

## 3. Folder structure

```
src/app/
  core/
    models/          # interfaces mirroring backend DTOs/schemas
    services/        # AuthService, ApiService, per-module services
    guards/           # authGuard, roleGuard
    interceptors/      # auth.interceptor.ts, error.interceptor.ts
  layout/
    shell/            # AppShellComponent (topbar + role-aware sidebar)
    components/        # notification-bell, user-menu
  features/
    auth/              # login page
    users/              # admin-only
    departments/         # admin-only writes, readable by all
    equipment/            # list, detail, form
    receiving/             # register, confirm-installation, status-change
    maintenance/            # schedule, complete
    notifications/           # bell dropdown + full page
    dashboard/                # KPI summary
    reports/                   # admin-only, file downloads
  shared/
    components/                # data-table wrapper, status-tag, confirm-dialog
  app.routes.ts
  app.config.ts
```

---

## 4. Step 1 — Core models

Mirror the backend's shapes exactly (see each module README for field-level detail). These go in `core/models/`.

**`core/models/common.model.ts`**

```typescript
export interface ApiResponse<T> {
  data: T;
  meta: PaginationMeta | Record<string, never>;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  totalItems: number;
  totalPages: number;
}

export interface ApiErrorBody {
  statusCode: number;
  message: string | string[];
  error: string;
  timestamp: string;
  path: string;
}

export interface PaginationQuery {
  page?: number;
  limit?: number;
  sort?: string;
  search?: string;
}
```

**`core/models/role.enum.ts`**

```typescript
export enum Role {
  ADMINISTRATOR = 'ADMINISTRATOR',
  BIOMEDICAL_ENGINEER = 'BIOMEDICAL_ENGINEER',
  DEPARTMENT_USER = 'DEPARTMENT_USER',
  STORE_OFFICER = 'STORE_OFFICER',
}
```

**`core/models/auth.model.ts`**

```typescript
import { Role } from './role.enum';

export interface LoginRequest {
  username: string;
  password: string;
}

export interface AuthUser {
  id: string;
  username: string;
  email: string;
  fullName: string;
  role: Role;
  departments: string[];
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface LoginResponse extends TokenPair {
  user: AuthUser;
}
```

Repeat this pattern for `department.model.ts`, `equipment.model.ts` (+ `equipment-status.enum.ts`), `maintenance.model.ts` (+ `maintenance-type.enum.ts`, `maintenance-status.enum.ts`), `notification.model.ts`, `equipment-history.model.ts`, `dashboard-summary.model.ts` — copy the field tables straight out of each module's README.

---

## 5. Step 2 — Token storage + AuthService

**`core/services/token-storage.service.ts`**

```typescript
import { Injectable } from '@angular/core';
import { TokenPair } from '../models/auth.model';

const ACCESS_KEY = 'heims_access_token';
const REFRESH_KEY = 'heims_refresh_token';

@Injectable({ providedIn: 'root' })
export class TokenStorageService {
  getAccessToken(): string | null { return localStorage.getItem(ACCESS_KEY); }
  getRefreshToken(): string | null { return localStorage.getItem(REFRESH_KEY); }

  setTokens(tokens: TokenPair): void {
    localStorage.setItem(ACCESS_KEY, tokens.accessToken);
    localStorage.setItem(REFRESH_KEY, tokens.refreshToken);
  }

  clear(): void {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
  }
}
```

> `localStorage` is the simplest option and fine to start with; note it's readable by any injected script (XSS risk). If you later need stronger protection, move the refresh token to an httpOnly cookie set by a thin backend proxy endpoint — that's a backend change too, not just frontend, so treat it as a later hardening pass, not a blocker now.

**`core/services/auth.service.ts`**

```typescript
import { Injectable, computed, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiResponse } from '../models/common.model';
import { AuthUser, LoginRequest, LoginResponse } from '../models/auth.model';
import { Role } from '../models/role.enum';
import { TokenStorageService } from './token-storage.service';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly currentUserSignal = signal<AuthUser | null>(
    JSON.parse(localStorage.getItem('heims_user') ?? 'null'),
  );
  readonly currentUser = computed(() => this.currentUserSignal());
  readonly isAuthenticated = computed(() => !!this.currentUserSignal());

  constructor(
    private readonly http: HttpClient,
    private readonly tokens: TokenStorageService,
    private readonly router: Router,
  ) {}

  login(dto: LoginRequest) {
    return this.http
      .post<ApiResponse<LoginResponse>>(`${environment.apiUrl}/auth/login`, dto)
      .pipe(tap((res) => this.persistSession(res.data)));
  }

  refresh() {
    const refreshToken = this.tokens.getRefreshToken();
    return this.http.post<ApiResponse<{ accessToken: string; refreshToken: string }>>(
      `${environment.apiUrl}/auth/refresh`,
      { refreshToken },
    );
  }

  logout(): void {
    this.http.post(`${environment.apiUrl}/auth/logout`, {}).subscribe({
      complete: () => this.clearSessionAndRedirect(),
      error: () => this.clearSessionAndRedirect(),
    });
  }

  hasRole(...roles: Role[]): boolean {
    const user = this.currentUserSignal();
    return !!user && roles.includes(user.role);
  }

  isAdmin(): boolean {
    return this.hasRole(Role.ADMINISTRATOR);
  }

  private persistSession(login: LoginResponse): void {
    this.tokens.setTokens(login);
    localStorage.setItem('heims_user', JSON.stringify(login.user));
    this.currentUserSignal.set(login.user);
  }

  private clearSessionAndRedirect(): void {
    this.tokens.clear();
    localStorage.removeItem('heims_user');
    this.currentUserSignal.set(null);
    void this.router.navigate(['/login']);
  }
}
```

---

## 6. Step 3 — Interceptors (attach token, auto-refresh on 401, normalize errors)

**`core/interceptors/auth.interceptor.ts`**

```typescript
import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { TokenStorageService } from '../services/token-storage.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const tokens = inject(TokenStorageService);
  const auth = inject(AuthService);
  const accessToken = tokens.getAccessToken();

  const authedReq = accessToken
    ? req.clone({ setHeaders: { Authorization: `Bearer ${accessToken}` } })
    : req;

  return next(authedReq).pipe(
    catchError((err) => {
      const isAuthRoute = req.url.includes('/auth/login') || req.url.includes('/auth/refresh');
      if (err.status === 401 && !isAuthRoute) {
        return auth.refresh().pipe(
          switchMap((res) => {
            tokens.setTokens(res.data);
            const retried = req.clone({
              setHeaders: { Authorization: `Bearer ${res.data.accessToken}` },
            });
            return next(retried);
          }),
          catchError((refreshErr) => {
            auth.logout();
            return throwError(() => refreshErr);
          }),
        );
      }
      return throwError(() => err);
    }),
  );
};
```

**`core/interceptors/error.interceptor.ts`** — normalizes the backend's error envelope (`{ statusCode, message, error, timestamp, path }`, see root README → "Core conventions") into a toast:

```typescript
import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { MessageService } from 'primeng/api';
import { catchError, throwError } from 'rxjs';
import { ApiErrorBody } from '../models/common.model';

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const messages = inject(MessageService);

  return next(req).pipe(
    catchError((err) => {
      const body = err.error as ApiErrorBody | undefined;
      const detail = Array.isArray(body?.message) ? body.message.join(', ') : body?.message;
      if (err.status !== 401) {
        messages.add({
          severity: 'error',
          summary: body?.error ?? 'Request failed',
          detail: detail ?? 'Something went wrong. Please try again.',
        });
      }
      return throwError(() => err);
    }),
  );
};
```

`MessageService` needs a `<p-toast />` mounted once in your root shell component, plus `providers: [MessageService]` wherever it's used (or provide it app-wide in `app.config.ts`).

---

## 7. Step 4 — Guards

**`core/guards/auth.guard.ts`**

```typescript
import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (auth.isAuthenticated()) return true;
  return router.createUrlTree(['/login']);
};
```

**`core/guards/role.guard.ts`**

```typescript
import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { Role } from '../models/role.enum';

export const roleGuard = (...allowed: Role[]): CanActivateFn => () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (auth.hasRole(...allowed)) return true;
  return router.createUrlTree(['/dashboard']);
};
```

---

## 8. Step 5 — Login page

**`features/auth/login.component.ts`**

```typescript
import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { InputTextModule } from 'primeng/inputtext';
import { PasswordModule } from 'primeng/password';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { AuthService } from '../../core/services/auth.service';
import { Role } from '../../core/models/role.enum';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, InputTextModule, PasswordModule, ButtonModule, CardModule],
  templateUrl: './login.component.html',
})
export class LoginComponent {
  loading = false;
  error: string | null = null;

  form = this.fb.group({
    username: ['', Validators.required],
    password: ['', Validators.required],
  });

  constructor(
    private readonly fb: FormBuilder,
    private readonly auth: AuthService,
    private readonly router: Router,
  ) {}

  submit(): void {
    if (this.form.invalid) return;
    this.loading = true;
    this.auth.login(this.form.getRawValue() as any).subscribe({
      next: (res) => {
        const isAdmin = res.data.user.role === Role.ADMINISTRATOR;
        void this.router.navigate([isAdmin ? '/admin/dashboard' : '/dashboard']);
      },
      error: () => { this.loading = false; },
    });
  }
}
```

**`features/auth/login.component.html`**

```html
<div class="min-h-screen flex items-center justify-center bg-surface-50">
  <p-card header="Hospital Equipment Inventory" class="w-full max-w-md">
    <form [formGroup]="form" (ngSubmit)="submit()" class="flex flex-col gap-4">
      <input pInputText formControlName="username" placeholder="Username" class="w-full" />
      <p-password formControlName="password" placeholder="Password" [feedback]="false" [toggleMask]="true" styleClass="w-full" inputStyleClass="w-full" />
      <p-button type="submit" label="Sign in" [loading]="loading" [disabled]="form.invalid" styleClass="w-full" />
    </form>
  </p-card>
</div>
```

Test this against `POST /auth/login` with the seeded admin (`admin` / whatever's in `DEFAULT_ADMIN_PASSWORD`) before moving on — see the [`auth` module README](src/modules/auth/README.md) for the exact request/response shape.

---

## 9. Step 6 — Routing shell with role-driven menu

**`app.routes.ts`**

```typescript
import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { roleGuard } from './core/guards/role.guard';
import { Role } from './core/models/role.enum';

export const routes: Routes = [
  { path: 'login', loadComponent: () => import('./features/auth/login.component').then(m => m.LoginComponent) },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./layout/shell/app-shell.component').then(m => m.AppShellComponent),
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      { path: 'dashboard', loadComponent: () => import('./features/dashboard/dashboard.component').then(m => m.DashboardComponent) },
      { path: 'equipment', loadChildren: () => import('./features/equipment/equipment.routes').then(m => m.EQUIPMENT_ROUTES) },
      { path: 'receiving', loadChildren: () => import('./features/receiving/receiving.routes').then(m => m.RECEIVING_ROUTES) },
      { path: 'maintenance', loadChildren: () => import('./features/maintenance/maintenance.routes').then(m => m.MAINTENANCE_ROUTES) },
      { path: 'notifications', loadComponent: () => import('./features/notifications/notifications-page.component').then(m => m.NotificationsPageComponent) },
      { path: 'profile', loadComponent: () => import('./features/users/profile.component').then(m => m.ProfileComponent) },
      {
        path: 'departments',
        loadChildren: () => import('./features/departments/departments.routes').then(m => m.DEPARTMENTS_ROUTES),
      },
      {
        path: 'users',
        canActivate: [roleGuard(Role.ADMINISTRATOR)],
        loadChildren: () => import('./features/users/users.routes').then(m => m.USERS_ROUTES),
      },
      {
        path: 'reports',
        canActivate: [roleGuard(Role.ADMINISTRATOR)],
        loadComponent: () => import('./features/reports/reports.component').then(m => m.ReportsComponent),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
```

Departments module: everyone can *read*, only `ADMINISTRATOR` can write — enforce that at the **component level** (hide/disable the create/edit/delete buttons), not via a route guard, since the list page itself is shared by all roles.

**`layout/shell/app-shell.component.ts`** — sidebar menu built from a static list filtered by role:

```typescript
import { Component, computed } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { MenuModule } from 'primeng/menu';
import { ToastModule } from 'primeng/toast';
import { AuthService } from '../../core/services/auth.service';
import { Role } from '../../core/models/role.enum';
import { NotificationBellComponent } from '../components/notification-bell.component';

interface NavItem { label: string; icon: string; path: string; roles?: Role[] }

const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', icon: 'pi pi-home', path: '/dashboard' },
  { label: 'Equipment', icon: 'pi pi-desktop', path: '/equipment' },
  { label: 'Receiving', icon: 'pi pi-inbox', path: '/receiving' },
  { label: 'Maintenance', icon: 'pi pi-wrench', path: '/maintenance' },
  { label: 'Departments', icon: 'pi pi-building', path: '/departments' },
  { label: 'Users', icon: 'pi pi-users', path: '/users', roles: [Role.ADMINISTRATOR] },
  { label: 'Reports', icon: 'pi pi-file-export', path: '/reports', roles: [Role.ADMINISTRATOR] },
];

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, MenuModule, ToastModule, NotificationBellComponent],
  templateUrl: './app-shell.component.html',
})
export class AppShellComponent {
  readonly user = this.auth.currentUser;
  readonly navItems = computed(() =>
    NAV_ITEMS.filter((item) => !item.roles || this.auth.hasRole(...item.roles)),
  );

  constructor(private readonly auth: AuthService) {}

  logout(): void { this.auth.logout(); }
}
```

```html
<!-- app-shell.component.html -->
<p-toast />
<div class="flex h-screen">
  <aside class="w-64 bg-surface-900 text-white flex flex-col p-4 gap-1">
    <div class="text-lg font-semibold mb-4 px-2">HEIMS</div>
    @for (item of navItems(); track item.path) {
      <a [routerLink]="item.path" routerLinkActive="bg-surface-700" class="flex items-center gap-2 px-3 py-2 rounded hover:bg-surface-800">
        <i [class]="item.icon"></i> {{ item.label }}
      </a>
    }
  </aside>
  <div class="flex-1 flex flex-col overflow-hidden">
    <header class="h-14 flex items-center justify-end gap-4 px-4 border-b">
      <app-notification-bell />
      <a routerLink="/profile" class="text-sm">{{ user()?.fullName }}</a>
      <button (click)="logout()" class="pi pi-sign-out"></button>
    </header>
    <main class="flex-1 overflow-auto p-6">
      <router-outlet />
    </main>
  </div>
</div>
```

This one shell + filtered `NAV_ITEMS` **is** your "Admin Console vs. Operational Dashboard" split — no separate app needed.

---

## 10. Step 7 — Reusable paginated table pattern

Every list screen (Equipment, Maintenance, Users, Departments, Notifications) follows the same shape: `page`, `limit`, `sort`, `search` query params in, `{ data, meta }` out (see root README → pagination conventions). Build one generic service base + one generic table wrapper once, reuse everywhere.

**`core/services/api.service.ts`** — thin generic CRUD base:

```typescript
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiResponse, PaginationQuery } from '../models/common.model';

@Injectable({ providedIn: 'root' })
export class ApiService {
  constructor(private readonly http: HttpClient) {}

  list<T>(path: string, query: Record<string, unknown> = {}): Observable<ApiResponse<T[]>> {
    const params = Object.fromEntries(
      Object.entries(query).filter(([, v]) => v !== undefined && v !== null && v !== ''),
    );
    return this.http.get<ApiResponse<T[]>>(`${environment.apiUrl}${path}`, { params: params as any });
  }

  get<T>(path: string): Observable<ApiResponse<T>> {
    return this.http.get<ApiResponse<T>>(`${environment.apiUrl}${path}`);
  }

  post<T>(path: string, body: unknown): Observable<ApiResponse<T>> {
    return this.http.post<ApiResponse<T>>(`${environment.apiUrl}${path}`, body);
  }

  patch<T>(path: string, body: unknown): Observable<ApiResponse<T>> {
    return this.http.patch<ApiResponse<T>>(`${environment.apiUrl}${path}`, body);
  }

  delete(path: string): Observable<void> {
    return this.http.delete<void>(`${environment.apiUrl}${path}`);
  }

  downloadFile(path: string, query: Record<string, unknown> = {}): Observable<Blob> {
    return this.http.get(`${environment.apiUrl}${path}`, { params: query as any, responseType: 'blob' });
  }
}
```

Per-module services (`departments.service.ts`, `equipment.service.ts`, etc.) are then a few lines each wrapping `ApiService` with the right path — e.g.:

```typescript
@Injectable({ providedIn: 'root' })
export class DepartmentsService {
  constructor(private readonly api: ApiService) {}
  list(query: PaginationQuery) { return this.api.list<Department>('/departments', query); }
  active() { return this.api.get<Department[]>('/departments/active'); }
  create(dto: CreateDepartmentDto) { return this.api.post<Department>('/departments', dto); }
  update(id: string, dto: Partial<CreateDepartmentDto>) { return this.api.patch<Department>(`/departments/${id}`, dto); }
  remove(id: string) { return this.api.delete(`/departments/${id}`); }
}
```

---

## 11. Step 8 — Departments feature (the template pattern for every CRUD screen)

**`features/departments/departments-list.component.ts`**

```typescript
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ConfirmationService } from 'primeng/api';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';
import { Role } from '../../core/models/role.enum';
import { DepartmentsService } from './departments.service';
import { Department } from '../../core/models/department.model';

@Component({
  selector: 'app-departments-list',
  standalone: true,
  imports: [CommonModule, TableModule, ButtonModule, DialogModule, ConfirmDialogModule, ReactiveFormsModule],
  providers: [ConfirmationService],
  templateUrl: './departments-list.component.html',
})
export class DepartmentsListComponent implements OnInit {
  departments: Department[] = [];
  totalItems = 0;
  loading = false;
  dialogVisible = false;
  editing: Department | null = null;

  form = this.fb.group({
    name: ['', Validators.required],
    code: ['', Validators.required],
    location: [''],
  });

  readonly isAdmin = this.auth.isAdmin();

  constructor(
    private readonly service: DepartmentsService,
    private readonly fb: FormBuilder,
    private readonly auth: AuthService,
    private readonly confirm: ConfirmationService,
  ) {}

  ngOnInit(): void { this.load({ page: 1, limit: 20 }); }

  load(query: { page: number; limit: number; search?: string }): void {
    this.loading = true;
    this.service.list(query).subscribe((res) => {
      this.departments = res.data;
      this.totalItems = (res.meta as any).totalItems ?? 0;
      this.loading = false;
    });
  }

  openCreate(): void {
    this.editing = null;
    this.form.reset();
    this.dialogVisible = true;
  }

  openEdit(dept: Department): void {
    this.editing = dept;
    this.form.patchValue(dept);
    this.dialogVisible = true;
  }

  save(): void {
    if (this.form.invalid) return;
    const payload = this.form.getRawValue();
    const request = this.editing
      ? this.service.update(this.editing.id, payload)
      : this.service.create(payload as any);
    request.subscribe(() => {
      this.dialogVisible = false;
      this.load({ page: 1, limit: 20 });
    });
  }

  confirmDelete(dept: Department): void {
    this.confirm.confirm({
      message: `Delete department "${dept.name}"?`,
      accept: () => this.service.remove(dept.id).subscribe(() => this.load({ page: 1, limit: 20 })),
    });
  }
}
```

```html
<!-- departments-list.component.html -->
<div class="flex justify-between items-center mb-4">
  <h1 class="text-xl font-semibold">Departments</h1>
  @if (isAdmin) {
    <p-button label="New Department" icon="pi pi-plus" (onClick)="openCreate()" />
  }
</div>

<p-table [value]="departments" [loading]="loading" [paginator]="true" [rows]="20"
         [totalRecords]="totalItems" [lazy]="true" (onLazyLoad)="load({ page: $event.first! / $event.rows! + 1, limit: $event.rows! })">
  <ng-template pTemplate="header">
    <tr><th>Name</th><th>Code</th><th>Location</th><th></th></tr>
  </ng-template>
  <ng-template pTemplate="body" let-dept>
    <tr>
      <td>{{ dept.name }}</td>
      <td>{{ dept.code }}</td>
      <td>{{ dept.location }}</td>
      <td class="text-right">
        @if (isAdmin) {
          <button pButton icon="pi pi-pencil" class="p-button-text" (click)="openEdit(dept)"></button>
          <button pButton icon="pi pi-trash" class="p-button-text p-button-danger" (click)="confirmDelete(dept)"></button>
        }
      </td>
    </tr>
  </ng-template>
</p-table>

<p-dialog [(visible)]="dialogVisible" [header]="editing ? 'Edit Department' : 'New Department'" [modal]="true">
  <form [formGroup]="form" class="flex flex-col gap-3 w-80">
    <input pInputText formControlName="name" placeholder="Name" />
    <input pInputText formControlName="code" placeholder="Code (e.g. ICU)" />
    <input pInputText formControlName="location" placeholder="Location (optional)" />
    <p-button label="Save" (onClick)="save()" [disabled]="form.invalid" />
  </form>
</p-dialog>
<p-confirmDialog />
```

Use this exact file pair (list component + service) as your **copy-paste starting point** for Users, and as the pagination/table pattern for Equipment/Maintenance/Notifications (which just add more filter controls above the table).

---

## 12. Step 9 — Users feature (Admin only)

Route-guarded (`roleGuard(Role.ADMINISTRATOR)`) — see [`users` module README](src/modules/users/README.md).

Differences from the Departments template:
- Create/edit form needs: `username`, `email`, `password` (create only), `fullName`, a `role` `<p-dropdown>` bound to the `Role` enum, and a `departments` `<p-multiSelect>` populated from `GET /departments/active`.
- Add row actions for `PATCH /users/:id/status` (activate/deactivate toggle — use `<p-inputSwitch>` or a button that flips `isActive`) and `PATCH /users/:id/password` (admin-triggered reset, opens a small dialog for `newPassword` only, no `currentPassword` needed for this admin path).
- List search (`search` query param) matches username/email/fullName server-side — just wire it to a `<input pInputText>` with a debounce (`debounceTime(300)`) before calling `load()`.

**Profile page** (`features/users/profile.component.ts`, any authenticated user, route `/profile`): fetches `GET /users/me`, and a second form for `PATCH /users/me/password` requiring `currentPassword` + `newPassword`.

---

## 13. Step 10 — Equipment feature

See [`equipment` module README](src/modules/equipment/README.md) for the full field list, enum, and query params.

**List page** (`/equipment`) — extends the Departments pattern with a filter bar above the table:
- `<p-dropdown>` for `department` (options from `GET /departments/active`; hidden/pre-locked for non-admin roles since the backend scopes it anyway — showing it read-only avoids confusing "why don't I see equipment from other departments" questions)
- `<p-dropdown>` for `status` (`EquipmentStatus` enum) — pair with a `StatusTagComponent` shared component (`shared/components/status-tag.component.ts`) that maps each status to a PrimeNG `<p-tag>` severity color, e.g. `WORKING` → success, `UNDER_REPAIR` → warning, `CONDEMNED`/`DECOMMISSIONED` → danger, `PENDING_INSTALLATION` → info. Reuse this component everywhere a status shows up (Maintenance too).
- Free-text `search` input (hits the backend's text index on name/category/manufacturer)
- "New Equipment" button → visible for `ADMINISTRATOR`, `STORE_OFFICER`, `BIOMEDICAL_ENGINEER` (`auth.hasRole(...)`) — though in practice most equipment enters via the **Receiving** flow below, not this form directly

**Create/Edit form** — reactive form matching `CreateEquipmentDto`: `name`, `category`, `manufacturer`, `model?`, `serialNumber`, `department` (dropdown), `roomLocation?`, `supplier?`, `purchaseDate?`/`warrantyStartDate?`/`warrantyEndDate?` (`<p-calendar>`), `cost?`, `pmFrequencyDays?`, `calibrationFrequencyDays?`. Leave `assetNumber` off the form entirely — it auto-generates.

**Detail page** (`/equipment/:id`) — use `<p-tabView>`:
1. **Overview** — all fields read-only, `StatusTagComponent`, edit button (role-gated) opens the same form as create, pre-filled.
2. **Photos** — `<p-fileUpload>` (`mode="advanced"`, `multiple="true"`, `accept="image/*"`, `maxFileSize` matching `UPLOAD_MAX_FILE_SIZE_MB`) posting to `POST /equipment/:id/photos` as `multipart/form-data` with field name `photos`; render existing `photoUrls` as a `<p-galleria>` or simple image grid.
3. **Manual** — single-file `<p-fileUpload>` (`accept="image/*,application/pdf"`) to `POST /equipment/:id/manual` (field name `manual`); link out to `manualUrls`.
4. **QR Code** — show `qrCodeUrl` as an `<img>`, with a "Regenerate" button calling `POST /equipment/:id/qr-code/regenerate`.
5. **History** — embed the Receiving history timeline (Step 14 below), scoped to this equipment.
6. **Maintenance** — embed a mini maintenance history table (`GET /maintenance/equipment/:equipmentId/history`).

File uploads with Angular's `HttpClient` need `FormData`, not JSON — e.g.:

```typescript
uploadPhotos(equipmentId: string, files: File[]) {
  const form = new FormData();
  files.forEach((f) => form.append('photos', f));
  return this.http.post<ApiResponse<Equipment>>(
    `${environment.apiUrl}/equipment/${equipmentId}/photos`,
    form,
  ); // do NOT set a Content-Type header — the browser sets the multipart boundary itself
}
```

---

## 14. Step 11 — Receiving feature (the lifecycle state machine)

See [`receiving` module README](src/modules/receiving/README.md) for the full state diagram and allowed transitions.

- **`/receiving/register`** — a form identical to the Equipment create form but posting to `POST /receiving/register` instead of `POST /equipment`; role-gated to `ADMINISTRATOR`/`STORE_OFFICER`. Result always starts at `PENDING_INSTALLATION`.
- **Confirm Installation** — a button/dialog on the Equipment detail page (visible only when `status === 'PENDING_INSTALLATION'` and role is `ADMINISTRATOR`/`BIOMEDICAL_ENGINEER`), posting `installationDate` + optional `note` to `PATCH /receiving/:equipmentId/confirm-installation`.
- **Change Status** — a dropdown/button group on the Equipment detail page. Mirror the backend's allowed-transitions map client-side purely for UX (only show valid next statuses given the current one), but always handle a `400` response gracefully since the backend is authoritative:

```typescript
const ALLOWED_TRANSITIONS: Record<EquipmentStatus, EquipmentStatus[]> = {
  PENDING_INSTALLATION: ['WORKING'],
  WORKING: ['UNDER_REPAIR', 'CONDEMNED', 'DECOMMISSIONED'],
  UNDER_REPAIR: ['WORKING', 'CONDEMNED'],
  CONDEMNED: ['DECOMMISSIONED'],
  DECOMMISSIONED: [],
};
```

- **History timeline** — `GET /receiving/:equipmentId/history` (paginated), rendered with PrimeNG's `<p-timeline>`, showing `fromStatus → toStatus`, `changedBy.fullName`, `changedAt`, and `note`.

---

## 15. Step 12 — Maintenance feature

See [`maintenance` module README](src/modules/maintenance/README.md) for query params and the complete-record behavior.

- **`/maintenance`** (list) and **`/maintenance/schedule`** (upcoming + overdue, same table component, different default `status` filter) — same Departments-style paginated table, with filters for `equipment`, `engineer`, `type`, `status`, and a `<p-calendar selectionMode="range">` for `from`/`to`.
- **Create form** — `equipment` (typeahead/dropdown), `type` (`PREVENTIVE`/`CORRECTIVE`/`CALIBRATION`), `scheduledDate` (required for the recurring types), `engineer?`.
- **Complete dialog** — `performedDate`, `serviceReport`, a `FormArray` of spare parts (`partName`, `quantity`, `cost`), and a photo `<p-fileUpload>` (same multipart pattern as Equipment) — submits to `PATCH /maintenance/:id/complete`.
- Reuse `StatusTagComponent` for `MaintenanceStatus` too (`SCHEDULED` → info, `IN_PROGRESS` → warning, `OVERDUE` → danger, `COMPLETED` → success).

---

## 16. Step 13 — Notifications

See [`notifications` module README](src/modules/notifications/README.md).

**`layout/components/notification-bell.component.ts`** — polls `GET /notifications/unread-count` on an interval (e.g. every 30–60s via `interval()` + `switchMap`), shows the count as a PrimeNG `<p-badge>` on a bell icon, and opens a `<p-overlayPanel>` listing the 5 most recent (`GET /notifications?limit=5&unreadOnly=true`) with a "Mark all read" button (`PATCH /notifications/read-all`) and a link to the full `/notifications` page.

**Full page** — the standard paginated table pattern again, plus an `unreadOnly` toggle and a per-row "mark read" button (`PATCH /notifications/:id/read`).

---

## 17. Step 14 — Dashboard

See [`dashboard` module README](src/modules/dashboard/README.md) for the exact `DashboardSummary` shape.

- KPI cards (`<p-card>` grid) for `totalEquipment`, `working`, `underRepair`, `condemned`, `pendingInstallation`, `decommissioned`, `pmDueThisMonth`, `receivedToday`.
- A department breakdown chart using `<p-chart type="bar">` (needs `chart.js` as a peer dep) fed by `byDepartment`.
- A `department` filter dropdown — for `ADMINISTRATOR`/`STORE_OFFICER` this narrows hospital-wide data; for scoped roles it's optional/redundant since the backend already restricts to their departments, so consider hiding it entirely for non-admins to avoid implying they could see more.
- This is a good landing page (`/dashboard`) for every role — just the numbers differ per the backend's department scoping.

---

## 18. Step 15 — Reports (Admin only)

See [`reports` module README](src/modules/reports/README.md) — **these endpoints return raw files, not the `{ data, meta }` envelope**, so handle them differently from every other service call:

```typescript
@Injectable({ providedIn: 'root' })
export class ReportsService {
  constructor(private readonly api: ApiService) {}

  download(reportPath: string, filter: Record<string, unknown>): void {
    this.api.downloadFile(`/reports/${reportPath}`, filter).subscribe((blob) => {
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = ''; // browser uses the server's Content-Disposition filename
      a.click();
      window.URL.revokeObjectURL(url);
    });
  }
}
```

Build one filter form (`department`, `status`, `engineer`, `from`/`to` date range, an Excel/PDF `<p-selectButton>`) and six buttons — one per report type (`inventory`, `department-inventory`, `condemned`, `pm`, `breakdown`, `engineer-work`) — each calling `download('inventory', filterValue)` etc. Remember `department-inventory` and `engineer-work` require their respective field to be filled in before enabling the button (mirror the backend's `400` validation client-side).

---

## 19. Step 16 — Cross-cutting polish

- **Loading state:** a simple `HttpInterceptorFn` incrementing/decrementing a shared `signal<number>` counter around every request, driving a global `<p-progressBar>` under the topbar.
- **Empty states:** every `<p-table>` should have an `emptymessage` template ("No equipment found" etc.) — cheap but makes the app feel finished.
- **Confirm before destructive actions:** every `DELETE` (Departments, Users, Equipment) should go through `ConfirmationService`, as shown in Step 8.
- **Route-level 403 fallback:** if a scoped user directly navigates to `/users` or `/reports` (bookmarked URL, etc.), `roleGuard` already redirects them to `/dashboard` — that's enough; you don't need a dedicated "Forbidden" page for this app's scope.

---

## 20. Step 17 — Build & deploy checklist

1. `ng build --configuration production` — confirm `environment.prod.ts` points at your real API URL.
2. On the backend, set `CORS_ORIGIN` (in `.env`) to your deployed frontend's origin (not `*`) once you're past local dev — see root README → Environment variables.
3. Serve the built `dist/` via any static host (Nginx, Netlify, S3+CloudFront, etc.) — this is a pure SPA, no Node server needed at runtime.
4. Decide whether the frontend and backend live on the same origin (simplifies cookies/CORS) or different origins (needs `CORS_ORIGIN` + `credentials` handling, already enabled in `main.ts` via `app.enableCors({ credentials: true })`).
5. Smoke-test the full flow once deployed: login → create department → register equipment → confirm installation → schedule + complete maintenance → check dashboard numbers move → pull a report.

---

## Appendix — Role → page visibility matrix

| Page | `ADMINISTRATOR` | `STORE_OFFICER` | `BIOMEDICAL_ENGINEER` | `DEPARTMENT_USER` |
|------|:---:|:---:|:---:|:---:|
| Dashboard | ✅ hospital-wide | ✅ hospital-wide | ✅ own depts | ✅ own depts |
| Equipment (view) | ✅ all | ✅ all | ✅ own depts | ✅ own depts |
| Equipment (create/edit) | ✅ | ✅ create | ✅ edit | ❌ |
| Receiving — register | ✅ | ✅ | ❌ | ❌ |
| Receiving — confirm/status | ✅ | ❌ | ✅ | ❌ |
| Maintenance (view) | ✅ all | ✅ all | ✅ own depts | ✅ own depts |
| Maintenance (create/complete) | ✅ | ❌ | ✅ | ❌ |
| Departments (view) | ✅ | ✅ | ✅ | ✅ |
| Departments (write) | ✅ | ❌ | ❌ | ❌ |
| Users | ✅ | ❌ | ❌ | ❌ |
| Reports | ✅ | ❌ | ❌ | ❌ |
| Notifications / Profile | ✅ own | ✅ own | ✅ own | ✅ own |

This table is the direct frontend mirror of the "Quick role-access matrix" in the root README — keep both in sync if the backend's role rules ever change.
