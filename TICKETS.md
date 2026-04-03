Ticket Set: Multi-Tenant Golf Course Operations Platform
Each ticket is written as an AI-executable prompt. Dependencies are listed so tickets can be parallelized where possible.

Phase 0: Project Bootstrap
T-01: Scaffold project from Vercel Platforms Starter Kit
Depends on: Nothing

Context: We are building a multi-tenant golf course operations platform. The starting point is the Vercel Platforms Starter Kit (https://vercel.com/templates/saas/platforms-starter-kit) which provides Next.js 15, App Router, subdomain routing middleware, Redis-based tenant storage, Tailwind 4, and shadcn/ui.

Task: Clone/deploy the Platforms Starter Kit. Verify the following work locally:

pnpm install succeeds
pnpm dev starts on localhost:3000
The admin panel loads at localhost:3000/admin
Subdomain routing works (e.g., test.localhost:3000)
Rename the project to reflect the new product (e.g., pierpont-platform). Update package.json name field. Remove the template's demo/sample tenant content but keep the middleware, Redis tenant lookup, and admin scaffolding intact.

Acceptance criteria:

Clean starter project runs locally
Subdomain routing middleware is functional
No demo content remains
Git repo initialized with initial commit


T-02: Configure Supabase project and environment
Depends on: T-01

Context: The app uses Supabase (Postgres) for all application data. The Platforms Starter Kit uses Upstash Redis for tenant routing — we keep Redis for that purpose and add Supabase for everything else. Auth will use Supabase Auth.

Task:

Install @supabase/supabase-js and @supabase/ssr as dependencies.
Create two Supabase client helpers under src/lib/:
supabase-server.ts: Creates a server-side client using createServerClient from @supabase/ssr with cookie handling for Next.js App Router (using cookies() from next/headers). Must pass NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.
supabase-client.ts: Creates a browser-side client using createBrowserClient from @supabase/ssr with the same env vars.
Add env vars to .env.local: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY.
Create a supabase/ directory at project root. Initialize with supabase init if the CLI is available, or create the migrations/ subdirectory manually.
Write a migration supabase/migrations/00001_create_tenants_table.sql that creates a tenants table:
id UUID primary key default gen_random_uuid()
name TEXT NOT NULL
slug TEXT NOT NULL UNIQUE (used for subdomain)
created_at TIMESTAMPTZ default now()
updated_at TIMESTAMPTZ default now()
Enable RLS on the table
Add a policy: authenticated users can SELECT tenants they are members of (membership table comes in T-08)
Acceptance criteria:

Server and browser Supabase clients work
tenants table migration is ready to apply
Env vars documented in a .env.example file
T-03: Set up Vitest testing infrastructure
Depends on: T-01

Context: The original trial app had zero tests. This rebuild includes unit and integration testing with Vitest.

Task:

Install vitest, @vitejs/plugin-react, @testing-library/react, @testing-library/jest-dom, jsdom as dev dependencies.
Create vitest.config.ts at project root:
Use jsdom environment
Set up path aliases matching tsconfig.json (@/* → ./src/*)
Include src/**/*.test.{ts,tsx} pattern
Add setup file src/test/setup.ts that imports @testing-library/jest-dom
Create src/test/setup.ts with the jest-dom import.
Add scripts to package.json: "test": "vitest", "test:run": "vitest run", "test:coverage": "vitest run --coverage".
Write one trivial test (src/lib/utils.test.ts) that tests the cn() utility function to verify the pipeline works.
Acceptance criteria:

pnpm test:run executes and passes
Path aliases resolve in test files
React component testing is possible with Testing Library
T-04: Set up shadcn/ui and design system foundation
Depends on: T-01

Context: The trial app used shadcn/ui (new-york style) with Radix UI primitives, Lucide icons, Tailwind v4, and CSS variables for theming. The rebuild should match this foundation. The Platforms Starter Kit may already have shadcn configured — if so, verify and extend; if not, initialize.

Task:

Ensure components.json exists with: style new-york, RSC enabled, Tailwind CSS v4 mode, icon library lucide, aliases @/components, @/lib/utils, @/components/ui.
Install these shadcn components (use npx shadcn@latest add): button, card, dialog, drawer, input, label, select, tabs, badge, alert-dialog, popover, radio-group, separator, skeleton, switch, table, textarea, toggle, tooltip, calendar.
Install additional dependencies: sonner (toasts), react-day-picker, date-fns, react-hook-form, @hookform/resolvers, zod, motion, vaul, embla-carousel-react, next-themes.
Set up globals.css with Tailwind v4 @import "tailwindcss", @theme inline block with CSS variables for light/dark theming, and tw-animate-css import.
Create src/lib/utils.ts exporting cn() using clsx + tailwind-merge.
Create shared typography components in src/components/: heading.tsx (H1-H4 with size variants), text.tsx (body text with size variants), and logo.tsx (SVG logo component).
Acceptance criteria:

All listed shadcn components are installed and importable
globals.css has complete light/dark theme variables
Typography components render correctly
cn() utility works
Phase 1: Multi-Tenant Infrastructure
T-05: Tenant data model — Redis routing + Supabase storage
Depends on: T-02

Context: Tenants are identified by subdomain slug. Redis stores the subdomain→tenant mapping for fast middleware lookups. Supabase stores the full tenant record. When a tenant is created, both stores are updated.

Task:

In the Redis store (already set up by the Platforms Starter Kit), ensure tenant data is stored under key pattern subdomain:{slug} with value being a JSON object: { id: string, name: string, slug: string }.
In Supabase, the tenants table (from T-02) is the source of truth. Add columns if needed: logo_url TEXT nullable, timezone TEXT default 'Europe/Brussels'.
Create server actions in src/app/actions/tenants.ts:
createTenant(data: { name, slug }): Validates slug format (lowercase alphanumeric + hyphens, 3-63 chars), checks uniqueness against both Redis and Supabase, inserts into both stores, creates the initial membership row for the creating user (role: editor), returns the tenant. Uses Supabase service role client for the insert.
getTenantBySlug(slug: string): Checks Redis first, falls back to Supabase, backfills Redis if found in DB only.
updateTenant(id, data): Updates Supabase record, updates Redis if slug changed.
deleteTenant(id): Removes from both stores.
Write tests for slug validation logic.
Acceptance criteria:

Tenant CRUD works across both stores
Redis is the fast path for slug lookups
Supabase is the source of truth
Slug validation rejects invalid formats
Tests pass for validation logic
T-06: Subdomain routing middleware
Depends on: T-05

Context: The Platforms Starter Kit includes middleware for subdomain detection. We need to extend it to: (1) resolve the tenant from Redis, (2) inject the tenant ID into request headers so server components/actions can access it, (3) handle unknown subdomains with a 404, (4) handle the root domain (no subdomain) as the platform landing/marketing page.

Task:

Modify middleware.ts to:
Extract subdomain from the request hostname (handle localhost, production, and Vercel preview URLs).
If no subdomain (root domain): let the request through to platform pages (/, /admin, /pricing, etc.).
If subdomain is www: redirect to root domain.
If subdomain exists: look up tenant in Redis via subdomain:{slug}. If found, set x-tenant-id and x-tenant-slug request headers and rewrite to the tenant app routes. If not found, return 404.
Exclude static files, _next, and API routes from subdomain processing.
Create a helper src/lib/tenant.ts:
getTenantFromHeaders(): Reads x-tenant-id and x-tenant-slug from headers() (next/headers). Throws if called outside a tenant context.
getTenantId(): Convenience shorthand returning just the ID.
Write tests for subdomain extraction logic (unit test the parsing, not the middleware itself).
Acceptance criteria:

Tenant subdomains resolve correctly in dev (e.g., pierpont.localhost:3000)
Unknown subdomains show 404
Root domain serves platform pages
getTenantId() returns correct ID in server components within tenant routes
T-07: Supabase Auth — sign up, sign in, sign out
Depends on: T-02, T-06

Context: The trial app used a shared password for "edit mode." The multi-tenant version uses Supabase Auth for proper per-user authentication. Users sign up with email/password. Each tenant context has its own sign-in page. The platform root also has auth pages for tenant creation.

Task:

Create auth-related pages under the tenant route group:
src/app/[tenant]/auth/sign-in/page.tsx: Email + password sign-in form. On success, redirect to / (tenant home). Show error on invalid credentials.
src/app/[tenant]/auth/sign-up/page.tsx: Email + password sign-up form. After sign-up, show "check your email" confirmation message.
Both pages should be styled with the design system (card layout, centered, logo at top).
Create server actions in src/app/actions/auth.ts:
signIn(formData: FormData): Uses Supabase server client auth.signInWithPassword(). Redirects on success.
signUp(formData: FormData): Uses auth.signUp(). Returns success/error.
signOut(): Uses auth.signOut(). Redirects to sign-in.
getUser(): Returns the current authenticated user or null.
requireUser(): Returns the current user or redirects to sign-in.
Update middleware.ts to:
Refresh the Supabase auth session on every request (using supabase.auth.getUser() to refresh tokens via cookies).
Allow unauthenticated access to /auth/* routes and the day view (/day/*).
Redirect unauthenticated users to /auth/sign-in for protected routes.
Create src/components/user-menu.tsx: Shows current user email + sign out button. Placed in the layout header for authenticated users.
Acceptance criteria:

Users can sign up with email/password
Users can sign in and get a session cookie
Users can sign out
Protected routes redirect to sign-in
Auth state persists across page navigations
T-08: User-tenant membership and roles
Depends on: T-07

Context: Users can be members of one or more tenants with a role: editor (can create/edit/delete data) or viewer (read-only access). The membership table connects Supabase Auth users to tenants.

Task:

Create migration supabase/migrations/00002_create_memberships_table.sql:
Table memberships:
id UUID primary key default gen_random_uuid()
user_id UUID NOT NULL references auth.users(id) ON DELETE CASCADE
tenant_id UUID NOT NULL references tenants(id) ON DELETE CASCADE
role TEXT NOT NULL CHECK (role IN ('editor', 'viewer')) default 'viewer'
created_at TIMESTAMPTZ default now()
UNIQUE(user_id, tenant_id)
Enable RLS. Policies:
Users can SELECT their own memberships
Editors of a tenant can INSERT/UPDATE/DELETE memberships for that tenant
Create server-side helpers in src/lib/membership.ts:
getUserRole(tenantId: string): Returns the current user's role for the given tenant, or null if not a member.
requireEditor(tenantId: string): Returns user or throws/redirects if not an editor.
isEditor(tenantId: string): Returns boolean.
getUserTenants(): Returns all tenants the current user is a member of (for tenant switching).
Create src/lib/AuthProvider.tsx: React context that provides { user, role, isEditor, isLoading } for client components. Fetches on mount via a server action getAuthState() that returns user + role for the current tenant.
Write tests for role checking logic.
Acceptance criteria:

Membership table enforces user-tenant-role relationships
RLS prevents users from seeing other tenants' memberships
isEditor() correctly gates mutations
AuthProvider makes auth state available to client components
T-09: RLS policies for tenant isolation
Depends on: T-08

Context: All application tables will have a tenant_id column. RLS policies ensure users can only access data belonging to tenants they are members of. This ticket establishes the RLS pattern that all subsequent data tables will follow.

Task:

Create a Postgres function (in a migration) that extracts the current user's ID from the JWT: auth.uid() (this is built into Supabase).
Create a Postgres function is_tenant_member(t_id UUID) that returns TRUE if the current user has a row in memberships for the given tenant_id.
Create a Postgres function is_tenant_editor(t_id UUID) that returns TRUE if the current user has role='editor' in memberships for the given tenant_id.
Update the tenants table RLS: SELECT allowed if user is a member of that tenant.
Document the RLS pattern for all future tables in a comment block at the top of the migration:
SELECT: is_tenant_member(tenant_id)
INSERT: is_tenant_editor(tenant_id)
UPDATE: is_tenant_editor(tenant_id)
DELETE: is_tenant_editor(tenant_id)
Create a helper SQL snippet or template that can be copy-pasted for each new table's RLS policies.
Acceptance criteria:

RLS helper functions exist and work correctly
Tenants table uses the new RLS pattern
Pattern is documented for reuse in subsequent tickets
T-10: Tenant creation and onboarding flow
Depends on: T-05, T-07, T-08

Context: Authenticated users on the root domain (no subdomain) can create a new tenant. After creation, they are redirected to their new tenant's subdomain. The creating user becomes the first editor.

Task:

Create platform pages (root domain, no tenant context):
src/app/(platform)/page.tsx: Landing page (simple — just a heading, description, and "Create your course" CTA).
src/app/(platform)/auth/sign-in/page.tsx and sign-up/page.tsx: Platform-level auth (same Supabase Auth, but no tenant context).
src/app/(platform)/new/page.tsx: Tenant creation form. Fields: course name, slug (auto-generated from name, editable). Validates slug availability. On submit, calls createTenant server action. On success, redirects to https://{slug}.{domain}/.
Create src/app/(platform)/layout.tsx: Minimal layout for platform pages (no tenant-specific branding).
The createTenant action (from T-05) should: create the tenant in Supabase + Redis, create a membership row with role editor for the current user.
Create src/app/(platform)/tenants/page.tsx: Lists the current user's tenants (from getUserTenants()). Each tenant links to its subdomain. Shows "Create new" button.
Acceptance criteria:

Users can create a new tenant from the platform root
Slug is validated and checked for uniqueness
Creating user becomes editor of the new tenant
User is redirected to the tenant subdomain after creation
Users can see and switch between their tenants
Phase 2: Shared Utilities & Types
T-11: Database types and type generation
Depends on: T-09

Context: The trial app maintained src/types/supabase.ts using supabase gen types typescript. The multi-tenant version must regenerate these types to include tenant_id on all tables and the new tenants/memberships tables.

Task:

After all Phase 1 migrations exist, run supabase gen types typescript --local > src/types/supabase.ts (or from remote project).
Create src/types/index.ts that re-exports from supabase.ts and adds domain type aliases:
Tenant, Membership, Day, ProgramItem, Reservation, HotelBooking, BreakfastConfiguration, PointOfContact, VenueType — row types.
*Insert, *Update types for each.
Create src/types/components.ts:
ProgramItemWithRelations: ProgramItem joined with optional VenueType + PointOfContact.
ReservationWithRelations: Reservation joined with optional HotelBooking + ProgramItem.
DayEntry: Union of ProgramItemWithRelations | ReservationWithRelations.
isProgramItem(entry: DayEntry): Type guard.
Create src/types/actions.ts:
ActionResponse<T = void>: { success: true, data: T } | { success: false, error: string }.
AuthState: { user: User | null, role: 'editor' | 'viewer' | null, isEditor: boolean }.
Add a script to package.json: "db:types": "supabase gen types typescript --local > src/types/supabase.ts".
Acceptance criteria:

Types accurately reflect the database schema including tenant_id columns
All domain aliases are available as named imports
Type guard correctly discriminates union types
Generation script works
T-12: Date utilities — Brussels timezone and guardrails
Depends on: T-03 (for testing)

Context: The trial app operates in Brussels timezone (Europe/Brussels). All date logic — "today," weekday names, month ranges — uses this timezone. The multi-tenant version stores timezone per tenant but defaults to Brussels. Date guardrails prevent accessing past dates or dates >1 year ahead.

Task:

Create src/lib/day-utils.ts with these exports:
type BrusselsYmd = string (branded YYYY-MM-DD string type)
getTenantToday(timezone: string): BrusselsYmd — current date in the tenant's timezone
formatYmd(date: Date): BrusselsYmd — format a Date as YYYY-MM-DD
parseYmd(ymd: string): Date — parse YYYY-MM-DD to Date
getMonthDateRange(year: number, month: number): { start: BrusselsYmd, end: BrusselsYmd } — first and last day of month
isPastDate(ymd: string, timezone: string): boolean
isDateWithinOneYear(ymd: string, timezone: string): boolean
getWeekdayName(ymd: string, locale?: string): string — e.g. "Monday"
generateRecurrenceDates(startDate: string, frequency: 'weekly' | 'biweekly' | 'monthly' | 'yearly', maxDate?: string): string[] — generates all occurrence dates up to maxDate (default 1 year)
Use date-fns and date-fns-tz (install if needed) for timezone-aware operations.
Write comprehensive tests for every function, including edge cases: DST transitions, leap years, month boundaries, year boundaries.
Acceptance criteria:

All date functions respect the provided timezone
Recurrence generation produces correct dates for all frequencies
Tests cover DST, leap year, and boundary edge cases
No hardcoded timezone — always parameterized
T-13: Tenant-scoped Supabase helpers
Depends on: T-06, T-09

Context: Every database query in the app needs to be scoped to the current tenant. Rather than manually adding .eq('tenant_id', tenantId) to every query, create helper functions that automatically scope queries.

Task:

Update src/lib/supabase-server.ts:
Export createTenantClient(): Creates a Supabase server client and returns it along with the current tenantId (from getTenantId()). This is a convenience wrapper — the actual tenant scoping is enforced by RLS (the user's JWT + membership determines access), but having tenantId available is needed for INSERTs.
Create src/lib/queries.ts with tenant-scoped query helpers:
tenantInsert<T>(table: string, data: Omit<T, 'id' | 'tenant_id' | 'created_at'>): Automatically adds tenant_id to the insert data.
tenantSelect(table: string): Returns a query builder already filtered by tenant_id (belt-and-suspenders on top of RLS).
Ensure the browser Supabase client (supabase-client.ts) also works within tenant context — it inherits the user's session from cookies, so RLS handles scoping. Add a getTenantIdClient() that reads tenant_id from a React context or from the URL.
Write tests for the insert helper to verify it adds tenant_id.
Acceptance criteria:

Server actions can get tenant-scoped Supabase clients with one call
INSERT operations automatically include tenant_id
RLS is the primary enforcement; helpers are convenience + defense in depth
Phase 3: Settings & Lookup Tables
T-14: Point of Contact CRUD
Depends on: T-09, T-11, T-13

Context: Points of Contact (POCs) are people associated with golf events and programs at a tenant's course. They have a name (required), email (optional), and phone (optional). Uniqueness is enforced per tenant on name (case-insensitive), email (case-insensitive), and phone. POCs cannot be deleted if referenced by a ProgramItem.

Task:

Create migration supabase/migrations/00003_create_point_of_contact.sql:
Table point_of_contact: id UUID PK, tenant_id UUID NOT NULL references tenants(id) ON DELETE CASCADE, name TEXT NOT NULL, email TEXT, phone TEXT, created_at TIMESTAMPTZ default now(), updated_at TIMESTAMPTZ default now().
Partial unique indexes per tenant: (tenant_id, lower(name)) where name is not null, (tenant_id, lower(email)) where email is not null and email != '', (tenant_id, phone) where phone is not null and phone != ''.
RLS policies using the is_tenant_member / is_tenant_editor pattern from T-09.
Create server actions in src/app/actions/poc.ts:
getAllPOCs(): Returns all POCs for the current tenant. Requires member.
createPOC(data: { name, email?, phone? }): Validates required name, checks duplicates, inserts. Requires editor.
updatePOC(id, data): Validates, checks duplicates excluding self, updates. Requires editor.
deletePOC(id): Checks if referenced by any ProgramItem. If referenced, returns error. Otherwise deletes. Requires editor.
All actions return ActionResponse<T>.
Create src/components/poc-management.tsx: UI component with:
Table listing all POCs (name, email, phone, actions)
"Add POC" button → dialog with form (react-hook-form + Zod: name required min 1 char, email optional but valid format if provided)
Edit button → same dialog pre-filled
Delete button → confirmation alert dialog, shows error if referenced
Toast notifications on success/error via sonner
Write tests for the Zod validation schema.
Acceptance criteria:

POC CRUD works end-to-end within a tenant
Duplicate detection is case-insensitive
Delete is blocked when POC is referenced
Form validation matches the trial app's behavior
RLS prevents cross-tenant access
T-15: Venue Type CRUD
Depends on: T-09, T-11, T-13

Context: Venue Types categorize where golf events and programs take place (e.g., "Main Restaurant," "Terrace," "Clubhouse"). They have a name (required) and an optional code. Uniqueness is enforced per tenant on name and code. Venue types cannot be deleted if referenced by a ProgramItem.

Task:

Create migration supabase/migrations/00004_create_venue_type.sql:
Table venue_type: id UUID PK, tenant_id UUID NOT NULL references tenants(id) ON DELETE CASCADE, name TEXT NOT NULL, code TEXT, created_at TIMESTAMPTZ default now(), updated_at TIMESTAMPTZ default now().
Partial unique indexes per tenant: (tenant_id, lower(name)), (tenant_id, lower(code)) where code is not null and code != ''.
RLS policies using the standard pattern.
Create server actions in src/app/actions/venue-type.ts:
getAllVenueTypes(): Returns all venue types for the current tenant. Requires member.
createVenueType(data: { name, code? }): Validates, checks duplicates, inserts. Requires editor.
updateVenueType(id, data): Validates, checks duplicates excluding self, updates. Requires editor.
deleteVenueType(id): Checks if referenced by any ProgramItem. If referenced, returns error. Otherwise deletes. Requires editor.
All actions return ActionResponse<T>.
Create src/components/venue-type-management.tsx: UI matching POC management pattern — table, add/edit dialog, delete with confirmation, toasts.
Write tests for the Zod validation schema.
Acceptance criteria:

Venue type CRUD works end-to-end within a tenant
Duplicate detection is case-insensitive
Delete is blocked when venue type is referenced
RLS prevents cross-tenant access
T-16: Admin settings page
Depends on: T-14, T-15, T-07

Context: The admin settings page is an editor-only page within a tenant's subdomain. It provides tabbed access to POC and Venue Type management.

Task:

Create src/app/[tenant]/admin/settings/page.tsx (server component):
Check requireEditor(tenantId) — redirect to home if not editor.
Load POCs and venue types via server actions.
Pass data to a client component.
Create src/app/[tenant]/admin/settings/client.tsx (client component):
Tabs component with two tabs: "Points of Contact" and "Venue Types."
Each tab renders the respective management component (from T-14 and T-15).
URL hash or search param controls active tab.
Style consistently with the design system. Use the Tabs shadcn component.
Acceptance criteria:

Settings page only accessible to editors
Both tabs render and function correctly
Tab state persists in URL
Phase 4: Day View Core
T-17: Day data model and ensure-day-exists logic
Depends on: T-09, T-11

Context: The Day table represents a calendar day within a tenant. It stores the ISO date string and weekday name. Days are lazily created — when a user visits a date, the Day row is upserted if it doesn't exist. A range upsert is used for the month calendar view.

Task:

Create migration supabase/migrations/00005_create_day.sql:
Table day: id UUID PK, tenant_id UUID NOT NULL references tenants(id) ON DELETE CASCADE, date_iso TEXT NOT NULL, weekday TEXT NOT NULL, created_at TIMESTAMPTZ default now().
Unique constraint on (tenant_id, date_iso).
RLS policies using the standard pattern. Note: even viewers need INSERT on day (since days are auto-created on visit), OR use service role for day upserts. Recommendation: use service role for ensureDayExists since it's a system operation, not a user-driven mutation.
Create server actions in src/app/actions/days.ts:
ensureDayExists(dateIso: string): Upserts a Day row for the current tenant + date. Computes weekday from the date. Returns the Day.
ensureDaysRange(startDate: string, endDate: string): Upserts Day rows for every date in the range. Used by the month calendar. Uses a single batch upsert for efficiency.
Write tests for weekday computation and range generation.
Acceptance criteria:

Day rows are created on demand
Duplicate upserts are idempotent (no errors on re-visit)
Range upsert creates all days in a month efficiently
T-18: Day page route and server data loading
Depends on: T-17, T-07, T-12

Context: The day page at /day/[date] is the primary view of the app. It's accessible to all authenticated users (viewers and editors). It validates the date parameter, loads all relevant data for that day, and renders the client-side interactive view.

Task:

Create src/app/[tenant]/day/[date]/page.tsx (server component):
Validate date param: must be YYYY-MM-DD format, must not be in the past (using tenant timezone), must be within 1 year.
If invalid, redirect to today's date.
Call ensureDayExists(date) to ensure the Day row exists.
Load in parallel (Promise.all):
Program items for the day (with POC and venue type relations)
Reservations for the day (with hotel booking relation)
Hotel bookings overlapping the date (check-in <= date < check-out)
Breakfast configurations for the date
Pass all data + auth state to DayViewClient.
Create src/app/[tenant]/day/[date]/loading.tsx: Skeleton UI matching the day view layout (use the Skeleton component).
The data loading queries should be extracted into reusable functions in a src/app/[tenant]/day/[date]/queries.ts file for testability.
Acceptance criteria:

Day page loads with all required data
Invalid dates redirect gracefully
Past dates redirect to today
Loading skeleton shows during data fetch
Data loading is parallelized
T-19: Day view client shell, navigation, and summary
Depends on: T-18

Context: The day view client is the main interactive component. It shows: (1) date navigation (prev/next day with date picker), (2) a summary card with breakfast and guest totals, (3) sections for golf/events and reservations, and (4) a hotel bookings section (editor-only). This ticket covers the shell, navigation, and summary — content sections are in later tickets.

Task:

Create src/app/[tenant]/day/[date]/DayViewClient.tsx (client component):
Receives all day data as props (program items, reservations, hotel bookings, breakfast configs, auth state).
Manages local state for modals (add entry, add hotel booking, add breakfast, edit, delete confirmation).
Renders: DayNav, DaySummaryCard, sections (placeholders for now, to be filled by T-22, T-25, T-27).
Editor-only sections are conditionally rendered based on isEditor from auth state.
Create src/components/day-nav.tsx:
Previous day / next day buttons (disabled for past / >1 year).
Date picker (popover with Calendar component from shadcn).
"Today" button to jump to current date.
Navigation uses router.push to /day/YYYY-MM-DD.
Create src/components/day-summary-card.tsx:
Card showing: total hotel guests for the day, total breakfasts, total golf/event guests, total reservation guests.
Breakfast breakdown by hotel booking (name + count).
Styled as a compact summary at the top of the day view.
Acceptance criteria:

Day navigation works (prev, next, date picker, today)
Navigation is bounded by date guardrails
Summary card aggregates data correctly
Editor-only UI is hidden for viewers
Phase 5: Program Items (Golf & Events)
T-20: Program item data model and server actions
Depends on: T-09, T-11, T-14, T-15, T-17

Context: Program items represent scheduled activities (golf or events) on a day. They have: type (golf/event), title, description, start/end times, guest count, capacity, venue type, POC, table breakdown (JSON array of seat counts), tour operator flag, notes, and recurrence fields.

Task:

Create migration supabase/migrations/00006_create_program_item.sql:
Table program_item: id UUID PK, tenant_id UUID NOT NULL references tenants(id) ON DELETE CASCADE, day_id UUID NOT NULL references day(id) ON DELETE CASCADE, type TEXT NOT NULL CHECK (type IN ('golf', 'event')), title TEXT NOT NULL, description TEXT, start_time TEXT, end_time TEXT, guest_count INT, capacity INT, venue_type_id UUID references venue_type(id) ON DELETE SET NULL, poc_id UUID references point_of_contact(id) ON DELETE SET NULL, table_breakdown JSONB, is_tour_operator BOOLEAN default false, notes TEXT, is_recurring BOOLEAN default false, recurrence_frequency TEXT CHECK (recurrence_frequency IN ('weekly', 'biweekly', 'monthly', 'yearly')), recurrence_group_id UUID, created_at TIMESTAMPTZ default now(), updated_at TIMESTAMPTZ default now().
RLS policies using the standard pattern.
Index on (tenant_id, day_id).
Create server actions in src/app/actions/program-items.ts:
createProgramItem(data): Validates required fields (title, dayId, type). If recurring, generates all occurrence dates using generateRecurrenceDates(), creates a recurrenceGroupId, and batch-inserts all items (ensuring Day rows exist for each date). Requires editor. Returns ActionResponse<ProgramItem>.
updateProgramItem(id, data): Updates a single item. Requires editor.
deleteProgramItem(id): Deletes a single item. Requires editor.
deleteRecurrenceGroup(groupId): Deletes all items in a recurrence group. Requires editor.
getProgramItemsForDay(dayId): Returns items with joined venue_type and poc. Requires member.
Write tests for table breakdown parsing ("3+2+1" → [3, 2, 1]), validation, and recurrence date generation integration.
Acceptance criteria:

Golf and event items can be created, updated, deleted
Recurring items fan out correctly across dates
Delete supports single occurrence or entire series
Table breakdown stores as JSONB array of integers
RLS enforces tenant isolation
T-21: Add entry modal (golf + event)
Depends on: T-20, T-04

Context: The add entry modal is a dialog for creating golf or event program items. It supports inline POC and venue type creation. For recurring items, it shows frequency options and previews the number of occurrences.

Task:

Create src/components/add-entry-modal.tsx (client component):
Props: isOpen, onClose, date (the day being viewed), type ('golf' | 'event'), pocs (list), venueTypes (list), onSuccess callback.
Form fields (react-hook-form + Zod):
Title (required)
Description (optional textarea)
Start time + end time (time pickers)
Guest count (number input)
Capacity (number input)
Venue type (select from list + "Add new" option that shows inline name/code fields)
Point of contact (select from list + "Add new" option that shows inline name/email/phone fields)
Table breakdown (text input, format 3+2+1, validated)
Tour operator (switch/toggle)
Notes (optional textarea)
Recurring (switch) → if on, show frequency select (weekly/biweekly/monthly/yearly) and display "This will create N occurrences"
On submit: call createProgramItem server action. Show toast on success/error. Call onSuccess to refresh data.
For inline POC/venue creation: call createPOC/createVenueType actions, then update the local list and auto-select the new item.
Style with shadcn Dialog, form fields, etc. Modal should be scrollable for the full form.
Acceptance criteria:

Modal creates golf or event items
Inline POC and venue type creation works without leaving the modal
Recurrence preview shows correct count
Table breakdown validation works (3+2+1 valid, abc invalid, 0+2 invalid)
Form resets on close
T-22: Entry card component
Depends on: T-20

Context: Entry cards display program items (golf/events) in the day view. They show the item's details and provide edit/delete actions for editors. The card distinguishes golf vs event with a badge. If the item is recurring, a recurrence indicator is shown and delete offers "delete this one" vs "delete all."

Task:

Create src/components/entry-card.tsx (client component):
Props: item: ProgramItemWithRelations, isEditor: boolean, onEdit, onDelete.
Display: type badge (golf/event with distinct colors), title, time range, guest count / capacity, venue type name, POC name, table breakdown (rendered as "Table 1 (3) | Table 2 (2) | Table 3 (1)"), tour operator badge if true, notes.
Editor actions: Edit button (opens the add entry modal in edit mode — see T-21, pre-fill form), Delete button (opens alert dialog).
If recurrenceGroupId exists, show a recurrence icon/badge. Delete dialog offers two options: "Delete this occurrence" and "Delete all occurrences."
Create the edit flow: The add entry modal from T-21 should accept an optional editItem prop. When provided, the form is pre-filled and submit calls updateProgramItem instead of createProgramItem.
Acceptance criteria:

Card displays all item fields with appropriate formatting
Golf and event items are visually distinguished
Edit pre-fills the modal correctly
Delete supports single vs all recurring occurrences
Actions only visible to editors
Phase 6: Reservations
T-23: Reservation data model and server actions
Depends on: T-09, T-11, T-17, T-20

Context: Reservations represent guest bookings at the venue (e.g., restaurant reservations). They can optionally be linked to a hotel booking (for hotel guests dining) and/or a specific program item + table index (for seating assignment).

Task:

Create migration supabase/migrations/00007_create_reservation.sql:
Table reservation: id UUID PK, tenant_id UUID NOT NULL references tenants(id) ON DELETE CASCADE, day_id UUID NOT NULL references day(id) ON DELETE CASCADE, guest_name TEXT, guest_email TEXT, guest_phone TEXT, guest_count INT, start_time TEXT, end_time TEXT, notes TEXT, hotel_booking_id UUID references hotel_booking(id) ON DELETE CASCADE (nullable), program_item_id UUID references program_item(id) ON DELETE SET NULL (nullable), table_index INT (nullable — which table within the program item's breakdown), created_at TIMESTAMPTZ default now(), updated_at TIMESTAMPTZ default now().
RLS policies using the standard pattern.
Index on (tenant_id, day_id).
Note: hotel_booking table doesn't exist yet — this migration must be ordered after T-26's migration, OR use deferred FK constraints / create the table shell first.
Create server actions in src/app/actions/reservations.ts:
createReservation(data): Insert with tenant_id. Requires editor.
updateReservation(id, data): Update. Requires editor.
deleteReservation(id): Delete. Requires editor.
getReservationsForDay(dayId): Returns reservations with joined hotel_booking and program_item. Requires member.
All return ActionResponse<T>.
Acceptance criteria:

Reservations CRUD works within tenant context
Optional links to hotel bookings and program items work
Cascade delete from hotel booking works
RLS enforces tenant isolation
T-24: Reservation UI (add, card, edit, delete)
Depends on: T-23

Context: Reservations are displayed as cards in the day view and can be created via a modal. The reservation modal is simpler than the entry modal — guest contact info, counts, times, notes, and optional links.

Task:

Create src/components/add-reservation-modal.tsx:
Form fields: guest name, guest email, guest phone, guest count, start time, end time, notes, optional hotel booking select (from day's overlapping bookings), optional program item + table select (from day's program items with table breakdowns).
On submit: call createReservation. Toast on result.
Edit mode: accept editItem prop, pre-fill, call updateReservation.
Create src/components/reservation-card.tsx:
Display: guest name, count, time range, contact info, linked hotel (if any), linked table (if any, show "Table N (X places)"), notes.
Editor actions: edit (opens modal in edit mode), delete (confirmation dialog).
Integrate both into DayViewClient (from T-19) as a reservations section.
Acceptance criteria:

Reservations can be created, edited, deleted from the day view
Linked hotel bookings and tables display correctly
Cards show all relevant information
Editor-only actions
Phase 7: Hotel Bookings & Breakfast
T-25: Hotel booking data model and server actions
Depends on: T-09, T-11

Context: Hotel bookings represent guest hotel stays. They span multiple days (check-in to check-out). Child entities — breakfast configurations and reservations — are created per night/day of the stay. When a booking is deleted, all children cascade-delete.

Task:

Create migration supabase/migrations/00008_create_hotel_booking.sql:
Table hotel_booking: id UUID PK, tenant_id UUID NOT NULL references tenants(id) ON DELETE CASCADE, guest_name TEXT NOT NULL, guest_count INT NOT NULL, check_in TEXT NOT NULL (DATE as YYYY-MM-DD string), check_out TEXT NOT NULL, is_tour_operator BOOLEAN default false, notes TEXT, created_at TIMESTAMPTZ default now(), updated_at TIMESTAMPTZ default now().
CHECK constraint: check_in < check_out.
RLS policies using the standard pattern.
Create server actions in src/app/actions/hotel-bookings.ts:
createHotelBooking(data): Validates dates, inserts booking, then creates child breakfast configurations for each night (check_in to day before check_out). Requires editor.
updateHotelBooking(id, data): Updates booking. If dates changed, reconciles child breakfast configs (delete removed dates, add new dates). Requires editor.
deleteHotelBooking(id): Deletes booking (children cascade). Requires editor.
getHotelBookingsForDate(dateIso): Returns bookings where check_in <= dateIso < check_out. Requires member.
getHotelBookingsForDateRange(start, end): Returns bookings overlapping the range. Requires member.
Acceptance criteria:

Hotel booking CRUD works
Child breakfast configs are auto-created for each night
Date changes reconcile children correctly
Cascade delete removes all children
Overlap queries work correctly (a booking with check_in=Mon, check_out=Wed should appear on Mon and Tue but not Wed)
T-26: Breakfast configuration data model and server actions
Depends on: T-25

Context: Each hotel booking has a breakfast configuration for each night of the stay. Breakfasts have a table breakdown, auto-aggregated total guests (via DB trigger), optional start time, and notes. They can also be edited independently after initial creation.

Task:

Create migration supabase/migrations/00009_create_breakfast_configuration.sql:
Table breakfast_configuration: id UUID PK, tenant_id UUID NOT NULL references tenants(id) ON DELETE CASCADE, hotel_booking_id UUID NOT NULL references hotel_booking(id) ON DELETE CASCADE, breakfast_date TEXT NOT NULL (YYYY-MM-DD), table_breakdown JSONB, total_guests INT default 0, start_time TEXT, notes TEXT, created_at TIMESTAMPTZ default now(), updated_at TIMESTAMPTZ default now().
Unique constraint on (hotel_booking_id, breakfast_date).
RLS policies using the standard pattern.
DB trigger: On INSERT or UPDATE of table_breakdown, compute total_guests as the sum of the JSONB integer array.
Create server actions in src/app/actions/breakfast.ts:
createBreakfastConfiguration(data): Validates breakfast_date falls within booking window. Requires editor.
updateBreakfastConfiguration(id, data): Updates table breakdown, time, notes. Requires editor.
deleteBreakfastConfiguration(id): Deletes. Requires editor.
getBreakfastConfigurationsForDay(dateIso): Returns all breakfast configs for a given date across all bookings. Requires member.
Acceptance criteria:

Breakfast CRUD works within hotel booking context
total_guests auto-computed by trigger
Date validation against parent booking's check-in/check-out window
Unique per booking + date enforced
T-27: Hotel booking drawer and breakfast modal
Depends on: T-25, T-26

Context: The hotel booking drawer is a slide-out panel for creating/editing hotel bookings. It includes per-night breakfast configuration (tabs per day of stay) and per-day reservation sub-flows. The breakfast modal is a standalone dialog for editing a breakfast config outside the drawer context.

Task:

Create src/components/add-hotel-booking-drawer.tsx:
Uses the Drawer component (vaul-based from shadcn).
Form fields: guest name (required), guest count (required), check-in date (date picker), check-out date (date picker, must be after check-in), tour operator toggle, notes.
After the booking fields, show tabs — one per night of the stay (e.g., "Mon 15 Jan", "Tue 16 Jan"). Each tab contains:
Breakfast configuration: table breakdown input (3+2+1 format), start time, notes.
Optional reservation fields: guest count, time, notes, linked program item.
On submit: call createHotelBooking which creates the booking + all breakfast configs. Toast on result.
Edit mode: pre-fill all fields including per-night breakfasts. On submit, call updateHotelBooking.
Only visible to editors.
Create src/components/add-breakfast-modal.tsx:
Dialog for editing a single breakfast configuration (outside the drawer context — e.g., from the day view summary).
Fields: table breakdown, start time, notes.
On submit: call updateBreakfastConfiguration.
Integrate into DayViewClient: hotel bookings section shows booking cards (guest name, dates, guest count). Each has edit (opens drawer) and delete (confirmation). "Add hotel booking" button opens the drawer.
Acceptance criteria:

Drawer creates bookings with per-night breakfast configs
Tab count dynamically matches the number of nights
Edit mode correctly loads existing breakfast data per night
Standalone breakfast modal works
Only editors can access hotel features
Phase 8: Month Calendar
T-28: Month calendar view (editor-only home page)
Depends on: T-17, T-20, T-23, T-25, T-26

Context: The home page for editors (at the tenant root /) shows a month calendar grid. Each day cell shows a summary: number of golf events, events, reservations, hotel guests, breakfasts. Clicking a day opens a sidebar with details. Viewers who hit / are redirected to today's /day/YYYY-MM-DD.

Task:

Create src/app/[tenant]/page.tsx (server component):
Check auth: if not editor, redirect to /day/{today}.
Read month from search params (default: current month).
Call ensureDaysRange for the month.
Load all program items, reservations, hotel bookings, and breakfast configs for the month range.
Pass to HomeClient.
Create src/components/HomeClient.tsx (client component):
Month grid layout (7 columns for days of week, rows for weeks).
Each cell renders a DayCard showing the date number and summary badges (golf count, event count, reservation count, hotel guest count).
Clicking a cell selects that day and opens the CalendarDaySidebar.
Uses browser Supabase client for refreshing data after mutations (optimistic or refetch).
Create src/components/day-card.tsx: Compact card for the month grid cell. Shows date, weekday (abbreviated), and summary counts with color-coded badges.
Acceptance criteria:

Month calendar renders correctly for any month
Day cells show accurate summary counts
Clicking a day opens the sidebar
Viewers are redirected to day view
Data refreshes after mutations
T-29: Calendar day sidebar
Depends on: T-28

Context: When a day is selected in the month calendar, a sidebar slides in showing the day's details — similar to the day view but in a condensed format. It allows quick actions: add entry, add hotel booking, view lists.

Task:

Create src/components/CalendarDaySidebar.tsx (client component):
Props: date, programItems, reservations, hotelBookings, breakfastConfigs, pocs, venueTypes, callbacks for add/edit/delete.
Sections:
Header: date, weekday, "View full day" link to /day/YYYY-MM-DD.
Hotel bookings summary (guest count, booking list with names).
Breakfast summary (total guests, breakdown).
Golf/events list (condensed entry cards).
Reservations list (condensed reservation cards).
Action buttons: "Add Golf," "Add Event," "Add Reservation," "Add Hotel Booking" — each opens the respective modal/drawer.
Closable via X button or clicking outside.
Integrate into HomeClient from T-28.
Acceptance criteria:

Sidebar opens when a day is clicked in the calendar
All sections show correct data for the selected day
Action buttons open the correct modals
Mutations from the sidebar refresh both sidebar and calendar data
T-30: Month pagination
Depends on: T-28

Context: The month calendar needs navigation to move between months. The current month/year is displayed, with previous/next buttons.

Task:

Create src/components/MonthPagination.tsx:
Displays current month and year (e.g., "April 2026").
Previous month / next month buttons.
"Today" button that jumps to current month.
Navigation updates the URL search params (?month=2026-04), which triggers server-side data reload.
Previous month button disabled if it would go to a fully-past month.
Integrate into HomeClient from T-28, rendered above the calendar grid.
Acceptance criteria:

Month navigation works via URL search params
Calendar data reloads for the selected month
Past months are not navigable if fully past
"Today" jumps to current month
Phase 9: Platform & Polish
T-31: Admin indicator and tenant chrome
Depends on: T-07, T-08

Context: When an editor is authenticated within a tenant, a floating admin indicator should be visible showing: a link to settings, the current user, and a sign-out button. This replaces the trial app's AdminIndicator component.

Task:

Create src/components/admin-indicator.tsx:
Floating button/pill in the bottom-right corner (fixed position).
Shows a gear icon. On click/hover, expands to show:
Link to /admin/settings
Current user email
Sign out button
Only rendered for authenticated editors.
Create src/app/[tenant]/layout.tsx:
Root layout for all tenant pages.
Includes AuthProvider (from T-08) wrapping children.
Renders AdminIndicator conditionally.
Sets up Toaster (sonner) for toast notifications.
Applies fonts, metadata (dynamic based on tenant name).
Sets metadataBase from env var.
Acceptance criteria:

Admin indicator visible only for editors
Settings link, user info, and sign-out work
Layout provides auth context and toasts to all tenant pages
T-32: Error boundaries, not-found, and loading states
Depends on: T-04

Context: The app needs graceful error handling at every level: global error boundary, 404 pages (for both platform and tenant contexts), and loading states for async routes.

Task:

Create src/app/error.tsx (global error boundary):
Client component with error and reset props.
Shows a user-friendly error message and "Try again" button.
Logs error to console (in development).
Create src/app/not-found.tsx (global 404):
"Page not found" with link to home.
Create src/app/[tenant]/not-found.tsx (tenant 404):
"Page not found" with link to tenant home.
Create src/components/day-page-skeleton.tsx:
Skeleton matching the day view layout (nav bar, summary card, entry list placeholders).
Used by loading.tsx files in day routes.
Ensure all page routes have a loading.tsx with appropriate skeletons.
Acceptance criteria:

Errors are caught and displayed gracefully
404 pages render correctly in both platform and tenant contexts
Loading skeletons match the layout of their respective pages
T-33: Auth guards and route protection
Depends on: T-07, T-08, T-06

Context: Several routes need protection: (1) tenant routes require the user to be a member of that tenant, (2) editor-only routes require editor role, (3) the day view is accessible to all members, (4) platform routes like /new require authentication.

Task:

Update middleware.ts to handle auth flows:
For tenant subdomain routes: refresh Supabase session. If no session and route is not /auth/*, redirect to /auth/sign-in.
For platform root routes: refresh session. If no session and route requires auth (e.g., /new, /tenants), redirect to /auth/sign-in.
Pass through for public routes (landing page, auth pages).
Create a server-side guard helper src/lib/guards.ts:
requireAuth(): Returns user or redirects to sign-in.
requireTenantMember(): Returns user + membership or redirects to "not a member" page.
requireTenantEditor(): Returns user + membership (editor) or redirects to tenant home.
Apply guards in all relevant server components:
/ (tenant home): requireTenantMember(), redirect viewers to day view.
/admin/settings: requireTenantEditor().
/day/[date]: requireTenantMember().
Platform /new: requireAuth().
Platform /tenants: requireAuth().
Acceptance criteria:

Unauthenticated users are redirected to sign-in
Non-members of a tenant cannot access tenant routes
Viewers cannot access editor-only pages
Auth redirects preserve the intended destination (redirect back after sign-in)
T-34: Theming, globals.css, and tenant-aware styling
Depends on: T-04, T-06

Context: The app uses Tailwind v4 with CSS variables for theming. The multi-tenant version should support light/dark mode (via next-themes) and allow tenants to have a customizable accent color in the future (store in tenant record, apply via CSS variable override).

Task:

Set up next-themes ThemeProvider in the tenant layout (from T-31).
Default to system preference.
Add a theme toggle in the admin indicator or header.
Ensure globals.css has complete light and dark theme variable blocks covering:
Background, foreground, card, popover, primary, secondary, muted, accent, destructive colors and their foreground variants.
Border, input, ring colors.
Radius variable.
Chart colors (for future use).
Configure fonts: Geist Sans and Geist Mono (from next/font/google or local). Apply via CSS variables --font-geist-sans and --font-geist-mono.
The tenant layout should apply a CSS variable --tenant-accent based on the tenant's stored accent color (default to primary if not set). This variable can be used to customize the primary color per tenant.
Acceptance criteria:

Light/dark mode toggle works without flash
All UI components respect theme variables
Fonts load correctly
Tenant accent color mechanism is in place (even if not yet configurable in UI)
T-35: Integration tests for critical flows
Depends on: All previous tickets

Context: With the full feature set built, write integration tests for the most critical flows. These tests should verify server action behavior with mocked Supabase clients.

Task:

Create test utilities in src/test/:
mock-supabase.ts: Factory for creating mock Supabase clients that simulate query/insert/update/delete.
mock-tenant.ts: Helper to set up tenant context headers for testing.
test-data.ts: Factory functions for creating test fixtures (tenant, day, program item, reservation, hotel booking, etc.).
Write integration tests for:
Auth flow: sign in sets session, sign out clears session, requireEditor rejects viewers.
Program item CRUD: create golf item → read → update → delete. Verify recurrence creates correct number of items. Verify delete-all-recurring removes the group.
Hotel booking flow: create booking → verify breakfast configs created for each night → update dates → verify config reconciliation → delete → verify cascade.
POC referential integrity: create POC → create program item referencing it → attempt delete POC → expect error.
Tenant isolation: verify that actions called without tenant context throw errors.
All tests should be runnable with pnpm test:run.
Acceptance criteria:

All listed test scenarios pass
Tests run in isolation (no real database calls)
Test utilities are reusable for future tests
pnpm test:run completes successfully
That's 35 tickets organized into 9 phases. The dependency graph allows significant parallelism:

Phase 0 (T-01 through T-04): Sequential start, then T-02/T-03/T-04 can parallel after T-01
Phase 1 (T-05 through T-10): Mostly sequential (auth depends on DB, membership depends on auth)
Phase 2 (T-11 through T-13): Can parallel after Phase 1
Phase 3 (T-14 through T-16): Can parallel with each other after Phase 2
Phases 4-7 (T-17 through T-27): Day view core is sequential, but program items, reservations, and hotel features can parallel once the day view shell exists
Phase 8 (T-28 through T-30): Depends on all data models being complete
Phase 9 (T-31 through T-35): Can partially parallel; T-35 (tests) comes last