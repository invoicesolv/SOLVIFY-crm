create type "public"."report_type" as enum ('top_pages', 'backlinks', 'keywords', 'traffic', 'content_gap', 'site_structure', 'competing_domains', 'other');

drop trigger if exists "handle_updated_at" on "public"."profiles";

drop trigger if exists "on_user_registration" on "public"."profiles";

drop policy "Insert event tracking for authenticated users only" on "public"."event_tracking";

drop policy "View own event tracking" on "public"."event_tracking";

drop policy "Public profiles are viewable by everyone." on "public"."profiles";

drop policy "Users can insert their own profile." on "public"."profiles";

drop policy "Users can update own profile." on "public"."profiles";

alter table "public"."profiles" drop constraint "profiles_id_fkey";

alter table "public"."profiles" drop constraint "profiles_stripe_customer_id_key";

alter table "public"."profiles" drop constraint "username_length";

alter table "public"."event_tracking" drop constraint "event_tracking_user_id_fkey";

drop index if exists "public"."profiles_stripe_customer_id_key";

create table "public"."ahrefs_report_data" (
    "id" uuid not null default gen_random_uuid(),
    "report_id" uuid not null,
    "url" text not null,
    "traffic" numeric,
    "traffic_value" numeric,
    "keywords" numeric,
    "referring_domains" numeric,
    "referring_pages" numeric,
    "backlinks" numeric,
    "dr" numeric,
    "ur" numeric,
    "ahrefs_rank" numeric,
    "created_at" timestamp with time zone not null default timezone('utc'::text, now())
);


alter table "public"."ahrefs_report_data" enable row level security;

create table "public"."ahrefs_reports" (
    "id" uuid not null default gen_random_uuid(),
    "user_id" uuid not null,
    "file_name" text not null,
    "file_id" text not null,
    "drive_url" text not null,
    "report_type" report_type default 'other'::report_type,
    "domain" text not null,
    "report_date" date not null,
    "created_at" timestamp with time zone not null default timezone('utc'::text, now()),
    "updated_at" timestamp with time zone not null default timezone('utc'::text, now()),
    "total_traffic" numeric,
    "total_keywords" numeric,
    "total_backlinks" numeric,
    "file_size_bytes" bigint,
    "mime_type" text,
    "is_processed" boolean default false,
    "is_archived" boolean default false
);


alter table "public"."ahrefs_reports" enable row level security;

create table "public"."analytics_email_settings" (
    "id" uuid not null default uuid_generate_v4(),
    "user_id" uuid not null,
    "property_id" text not null,
    "enabled" boolean default false,
    "recipients" text[] not null,
    "send_day" text not null default 'monday'::text,
    "send_time" text not null default '09:00'::text,
    "created_at" timestamp with time zone default now(),
    "updated_at" timestamp with time zone default now()
);


create table "public"."api_tracking" (
    "id" uuid not null default uuid_generate_v4(),
    "endpoint" text not null,
    "method" text not null,
    "user_id" uuid,
    "status_code" integer,
    "response_time" integer,
    "created_at" timestamp with time zone default now()
);


alter table "public"."api_tracking" enable row level security;

create table "public"."calendar_events" (
    "id" text not null,
    "user_id" uuid not null,
    "title" text not null,
    "start_time" timestamp with time zone not null,
    "end_time" timestamp with time zone not null,
    "description" text,
    "location" text,
    "created_at" timestamp with time zone default now(),
    "updated_at" timestamp with time zone default now()
);


alter table "public"."calendar_events" enable row level security;

create table "public"."checklist_items" (
    "id" uuid not null default gen_random_uuid(),
    "task_id" uuid,
    "title" text not null,
    "completed" boolean default false,
    "created_at" timestamp with time zone default now(),
    "updated_at" timestamp with time zone default now()
);


alter table "public"."checklist_items" enable row level security;

create table "public"."cron_jobs" (
    "id" uuid not null default uuid_generate_v4(),
    "user_id" uuid not null,
    "property_id" text,
    "job_type" text not null,
    "status" text not null default 'active'::text,
    "next_run" timestamp with time zone not null,
    "last_run" timestamp with time zone,
    "settings" jsonb not null default '{}'::jsonb,
    "created_at" timestamp with time zone default now(),
    "updated_at" timestamp with time zone default now(),
    "site_url" text
);


create table "public"."currencies" (
    "id" uuid not null default gen_random_uuid(),
    "code" text not null,
    "created_at" timestamp with time zone default now()
);


alter table "public"."currencies" enable row level security;

create table "public"."customers" (
    "id" uuid not null default gen_random_uuid(),
    "name" text not null,
    "created_at" timestamp with time zone default now(),
    "updated_at" timestamp with time zone default now(),
    "user_id" uuid not null
);


alter table "public"."customers" enable row level security;

create table "public"."important_tasks" (
    "id" uuid not null default uuid_generate_v4(),
    "user_id" uuid not null,
    "task_id" uuid not null,
    "created_at" timestamp with time zone default now()
);


create table "public"."integrations" (
    "id" uuid not null default gen_random_uuid(),
    "user_id" text not null,
    "service_name" text not null,
    "access_token" text not null,
    "refresh_token" text,
    "scopes" text[],
    "expires_at" timestamp with time zone,
    "created_at" timestamp with time zone default now(),
    "updated_at" timestamp with time zone default now()
);


alter table "public"."integrations" enable row level security;

create table "public"."invitations" (
    "id" uuid not null default uuid_generate_v4(),
    "token" text not null,
    "email" text not null,
    "inviter_id" uuid not null,
    "workspace_id" uuid not null,
    "permissions" jsonb default '{"edit_projects": false, "view_calendar": true, "view_invoices": false, "view_projects": true, "edit_customers": false, "view_analytics": false, "view_customers": true}'::jsonb,
    "is_admin" boolean default false,
    "expires_at" timestamp with time zone not null,
    "created_at" timestamp with time zone default now()
);


create table "public"."invoice_types" (
    "id" uuid not null default gen_random_uuid(),
    "name" text not null,
    "created_at" timestamp with time zone default now()
);


alter table "public"."invoice_types" enable row level security;

create table "public"."invoices" (
    "id" uuid not null default gen_random_uuid(),
    "document_number" text not null,
    "customer_id" uuid,
    "invoice_date" date not null,
    "total" numeric(15,2) not null,
    "balance" numeric(15,2) not null,
    "due_date" date not null,
    "currency_id" uuid,
    "invoice_type_id" uuid,
    "payment_method_id" uuid,
    "external_reference" text,
    "created_at" timestamp with time zone default now(),
    "updated_at" timestamp with time zone default now(),
    "user_id" uuid not null
);


alter table "public"."invoices" enable row level security;

create table "public"."payment_methods" (
    "id" uuid not null default gen_random_uuid(),
    "name" text not null,
    "created_at" timestamp with time zone default now()
);


alter table "public"."payment_methods" enable row level security;

create table "public"."project_cron_jobs" (
    "id" uuid not null default uuid_generate_v4(),
    "project_id" uuid not null,
    "user_id" uuid not null,
    "job_type" character varying(50) default 'project_report'::character varying,
    "status" character varying(20) default 'pending'::character varying,
    "next_run" timestamp with time zone,
    "last_run" timestamp with time zone,
    "settings" jsonb default '{}'::jsonb,
    "created_at" timestamp with time zone default now(),
    "updated_at" timestamp with time zone default now()
);


create table "public"."project_email_settings" (
    "id" uuid not null default uuid_generate_v4(),
    "project_id" uuid not null,
    "user_id" uuid not null,
    "enabled" boolean default false,
    "test_recipients" text[] default '{}'::text[],
    "customer_recipients" text[] default '{}'::text[],
    "send_day" character varying(10) default 'monday'::character varying,
    "send_time" time without time zone default '09:00:00'::time without time zone,
    "created_at" timestamp with time zone default now(),
    "updated_at" timestamp with time zone default now()
);


alter table "public"."project_email_settings" enable row level security;

create table "public"."project_settings" (
    "id" uuid not null default uuid_generate_v4(),
    "project_id" uuid not null,
    "user_id" uuid not null,
    "test_recipients" text[] default '{}'::text[],
    "customer_recipients" text[] default '{}'::text[],
    "email_settings" jsonb default '{"enabled": false, "send_day": "monday", "send_time": "09:00"}'::jsonb,
    "created_at" timestamp with time zone default now(),
    "updated_at" timestamp with time zone default now()
);


create table "public"."project_tasks" (
    "id" uuid not null default uuid_generate_v4(),
    "project_id" uuid,
    "title" text not null,
    "deadline" timestamp with time zone,
    "progress" integer default 0,
    "checklist" jsonb default '[]'::jsonb,
    "created_at" timestamp with time zone default now(),
    "updated_at" timestamp with time zone default now(),
    "user_id" uuid not null
);


alter table "public"."project_tasks" enable row level security;

create table "public"."projects" (
    "id" uuid not null default uuid_generate_v4(),
    "name" text not null,
    "customer_name" text,
    "status" text default 'active'::text,
    "start_date" timestamp with time zone,
    "end_date" timestamp with time zone,
    "description" text,
    "created_at" timestamp with time zone default now(),
    "updated_at" timestamp with time zone default now(),
    "user_id" uuid not null,
    "workspace_id" uuid
);


alter table "public"."projects" enable row level security;

create table "public"."recurring_invoices" (
    "id" uuid not null default gen_random_uuid(),
    "original_invoice_id" uuid,
    "customer_id" uuid,
    "next_invoice_date" date not null,
    "total" numeric(10,2) not null,
    "currency_id" uuid,
    "invoice_type_id" uuid,
    "payment_method_id" uuid,
    "status" text default 'draft'::text,
    "created_at" timestamp with time zone default timezone('utc'::text, now()),
    "updated_at" timestamp with time zone default timezone('utc'::text, now()),
    "user_id" uuid not null
);


alter table "public"."recurring_invoices" enable row level security;

create table "public"."search_console_cron_jobs" (
    "id" bigint generated by default as identity not null,
    "user_id" uuid not null,
    "site_url" text not null,
    "job_type" text not null,
    "status" text not null default 'active'::text,
    "next_run" timestamp with time zone,
    "settings" jsonb,
    "created_at" timestamp with time zone not null default timezone('utc'::text, now()),
    "updated_at" timestamp with time zone not null default timezone('utc'::text, now())
);


create table "public"."search_console_email_settings" (
    "id" uuid not null default uuid_generate_v4(),
    "user_id" uuid not null,
    "site_url" text not null,
    "enabled" boolean default false,
    "recipients" text[] default '{}'::text[],
    "send_day" text default 'monday'::text,
    "send_time" text default '09:00'::text,
    "created_at" timestamp with time zone default timezone('utc'::text, now()),
    "updated_at" timestamp with time zone default timezone('utc'::text, now())
);


create table "public"."settings" (
    "id" uuid not null default gen_random_uuid(),
    "user_id" text not null,
    "service_name" text not null,
    "settings_data" jsonb not null default '{}'::jsonb,
    "created_at" timestamp with time zone default now(),
    "updated_at" timestamp with time zone default now(),
    "auth_user_id" uuid
);


alter table "public"."settings" enable row level security;

create table "public"."tasks" (
    "id" uuid not null default gen_random_uuid(),
    "project_id" uuid,
    "title" text not null,
    "deadline" timestamp with time zone,
    "progress" integer default 0,
    "created_at" timestamp with time zone default now(),
    "updated_at" timestamp with time zone default now()
);


alter table "public"."tasks" enable row level security;

create table "public"."team_members" (
    "id" uuid not null default uuid_generate_v4(),
    "user_id" uuid not null,
    "workspace_id" uuid not null,
    "name" text not null,
    "email" text not null,
    "is_admin" boolean default false,
    "permissions" jsonb default '{"edit_projects": true, "view_calendar": true, "view_invoices": true, "view_projects": true, "edit_customers": true, "view_analytics": true, "view_customers": true}'::jsonb,
    "created_at" timestamp with time zone default now()
);


alter table "public"."team_members" enable row level security;

create table "public"."transactions" (
    "id" uuid not null default uuid_generate_v4(),
    "date" date not null,
    "amount" numeric(10,2) not null,
    "reference" text,
    "supplier" text,
    "created_at" timestamp with time zone default timezone('utc'::text, now()),
    "updated_at" timestamp with time zone default timezone('utc'::text, now()),
    "user_id" uuid not null
);


alter table "public"."transactions" enable row level security;

create table "public"."user_preferences" (
    "id" uuid not null default uuid_generate_v4(),
    "user_id" text not null,
    "created_at" timestamp with time zone not null default timezone('utc'::text, now()),
    "has_seen_welcome" boolean default false,
    "trial_ends_at" timestamp with time zone,
    "name" text,
    "email" text,
    "company" text,
    "plan_id" text default 'free'::text,
    "trial_start_date" timestamp with time zone default now(),
    "trial_end_date" timestamp with time zone default (now() + '14 days'::interval)
);


alter table "public"."user_preferences" enable row level security;

create table "public"."workspaces" (
    "id" uuid not null default uuid_generate_v4(),
    "name" text not null,
    "owner_id" uuid not null,
    "created_at" timestamp with time zone default now(),
    "updated_at" timestamp with time zone default now()
);


alter table "public"."event_tracking" alter column "details" drop default;

alter table "public"."event_tracking" alter column "id" set default uuid_generate_v4();

alter table "public"."profiles" drop column "avatar_url";

alter table "public"."profiles" drop column "plan_id";

alter table "public"."profiles" drop column "stripe_customer_id";

alter table "public"."profiles" add column "address" text;

alter table "public"."profiles" add column "auth_user_id" uuid;

alter table "public"."profiles" add column "avatarurl" text;

alter table "public"."profiles" add column "city" text;

alter table "public"."profiles" add column "country" text;

alter table "public"."profiles" add column "password" text;

alter table "public"."profiles" add column "phone" text;

alter table "public"."profiles" add column "user_id" uuid;

alter table "public"."profiles" alter column "id" set default uuid_generate_v4();

alter table "public"."profiles" alter column "name" set not null;

CREATE UNIQUE INDEX ahrefs_report_data_pkey ON public.ahrefs_report_data USING btree (id);

CREATE INDEX ahrefs_report_data_report_id_idx ON public.ahrefs_report_data USING btree (report_id);

CREATE INDEX ahrefs_report_data_url_idx ON public.ahrefs_report_data USING btree (url);

CREATE INDEX ahrefs_reports_created_at_idx ON public.ahrefs_reports USING btree (created_at);

CREATE INDEX ahrefs_reports_domain_idx ON public.ahrefs_reports USING btree (domain);

CREATE UNIQUE INDEX ahrefs_reports_pkey ON public.ahrefs_reports USING btree (id);

CREATE INDEX ahrefs_reports_user_id_idx ON public.ahrefs_reports USING btree (user_id);

CREATE UNIQUE INDEX analytics_email_settings_pkey ON public.analytics_email_settings USING btree (id);

CREATE UNIQUE INDEX analytics_email_settings_user_id_property_id_key ON public.analytics_email_settings USING btree (user_id, property_id);

CREATE UNIQUE INDEX api_tracking_pkey ON public.api_tracking USING btree (id);

CREATE UNIQUE INDEX calendar_events_pkey ON public.calendar_events USING btree (id);

CREATE UNIQUE INDEX checklist_items_pkey ON public.checklist_items USING btree (id);

CREATE UNIQUE INDEX cron_jobs_analytics_pkey ON public.cron_jobs USING btree (user_id, property_id, job_type);

CREATE UNIQUE INDEX cron_jobs_pkey ON public.cron_jobs USING btree (id);

CREATE UNIQUE INDEX cron_jobs_search_console_pkey ON public.cron_jobs USING btree (user_id, site_url, job_type);

CREATE UNIQUE INDEX cron_jobs_user_id_site_url_job_type_key ON public.cron_jobs USING btree (user_id, site_url, job_type);

CREATE UNIQUE INDEX currencies_code_key ON public.currencies USING btree (code);

CREATE UNIQUE INDEX currencies_pkey ON public.currencies USING btree (id);

CREATE UNIQUE INDEX customers_name_key ON public.customers USING btree (name);

CREATE UNIQUE INDEX customers_pkey ON public.customers USING btree (id);

CREATE INDEX idx_api_tracking_created_at ON public.api_tracking USING btree (created_at);

CREATE INDEX idx_api_tracking_endpoint ON public.api_tracking USING btree (endpoint);

CREATE INDEX idx_api_tracking_user_id ON public.api_tracking USING btree (user_id);

CREATE INDEX idx_event_tracking_created_at ON public.event_tracking USING btree (created_at);

CREATE INDEX idx_event_tracking_event_type ON public.event_tracking USING btree (event_type);

CREATE INDEX idx_event_tracking_user_id ON public.event_tracking USING btree (user_id);

CREATE INDEX idx_important_tasks_task ON public.important_tasks USING btree (task_id);

CREATE INDEX idx_important_tasks_user ON public.important_tasks USING btree (user_id);

CREATE INDEX idx_invoices_customer_id ON public.invoices USING btree (customer_id);

CREATE INDEX idx_invoices_document_number ON public.invoices USING btree (document_number);

CREATE INDEX idx_invoices_invoice_date ON public.invoices USING btree (invoice_date);

CREATE INDEX idx_project_cron_jobs_next_run ON public.project_cron_jobs USING btree (next_run);

CREATE INDEX idx_project_cron_jobs_project_id ON public.project_cron_jobs USING btree (project_id);

CREATE INDEX idx_project_cron_jobs_user_id ON public.project_cron_jobs USING btree (user_id);

CREATE INDEX idx_transactions_date ON public.transactions USING btree (date);

CREATE INDEX idx_user_preferences_plan_id ON public.user_preferences USING btree (plan_id);

CREATE INDEX idx_user_preferences_user_id ON public.user_preferences USING btree (user_id);

CREATE UNIQUE INDEX important_tasks_pkey ON public.important_tasks USING btree (id);

CREATE UNIQUE INDEX important_tasks_user_id_task_id_key ON public.important_tasks USING btree (user_id, task_id);

CREATE UNIQUE INDEX integrations_pkey ON public.integrations USING btree (id);

CREATE UNIQUE INDEX integrations_user_id_service_name_key ON public.integrations USING btree (user_id, service_name);

CREATE UNIQUE INDEX invitations_pkey ON public.invitations USING btree (id);

CREATE UNIQUE INDEX invitations_token_key ON public.invitations USING btree (token);

CREATE UNIQUE INDEX invoice_types_name_key ON public.invoice_types USING btree (name);

CREATE UNIQUE INDEX invoice_types_pkey ON public.invoice_types USING btree (id);

CREATE UNIQUE INDEX invoices_document_number_key ON public.invoices USING btree (document_number);

CREATE UNIQUE INDEX invoices_pkey ON public.invoices USING btree (id);

CREATE UNIQUE INDEX payment_methods_name_key ON public.payment_methods USING btree (name);

CREATE UNIQUE INDEX payment_methods_pkey ON public.payment_methods USING btree (id);

CREATE UNIQUE INDEX project_cron_jobs_pkey ON public.project_cron_jobs USING btree (id);

CREATE UNIQUE INDEX project_email_settings_pkey ON public.project_email_settings USING btree (id);

CREATE UNIQUE INDEX project_email_settings_project_id_key ON public.project_email_settings USING btree (project_id);

CREATE UNIQUE INDEX project_settings_pkey ON public.project_settings USING btree (id);

CREATE UNIQUE INDEX project_tasks_pkey ON public.project_tasks USING btree (id);

CREATE UNIQUE INDEX projects_pkey ON public.projects USING btree (id);

CREATE UNIQUE INDEX recurring_invoices_pkey ON public.recurring_invoices USING btree (id);

CREATE UNIQUE INDEX search_console_cron_jobs_pkey ON public.search_console_cron_jobs USING btree (id);

CREATE UNIQUE INDEX search_console_cron_jobs_user_id_site_url_job_type_key ON public.search_console_cron_jobs USING btree (user_id, site_url, job_type);

CREATE UNIQUE INDEX search_console_email_settings_pkey ON public.search_console_email_settings USING btree (id);

CREATE UNIQUE INDEX search_console_email_settings_user_id_site_url_key ON public.search_console_email_settings USING btree (user_id, site_url);

CREATE UNIQUE INDEX settings_auth_user_id_service_name_key ON public.settings USING btree (auth_user_id, service_name);

CREATE UNIQUE INDEX settings_pkey ON public.settings USING btree (id);

CREATE UNIQUE INDEX settings_user_id_service_name_key ON public.settings USING btree (user_id, service_name);

CREATE UNIQUE INDEX tasks_pkey ON public.tasks USING btree (id);

CREATE UNIQUE INDEX team_members_pkey ON public.team_members USING btree (id);

CREATE UNIQUE INDEX transactions_pkey ON public.transactions USING btree (id);

CREATE UNIQUE INDEX user_preferences_pkey ON public.user_preferences USING btree (id);

CREATE UNIQUE INDEX user_preferences_user_id_key ON public.user_preferences USING btree (user_id);

CREATE UNIQUE INDEX workspaces_pkey ON public.workspaces USING btree (id);

alter table "public"."ahrefs_report_data" add constraint "ahrefs_report_data_pkey" PRIMARY KEY using index "ahrefs_report_data_pkey";

alter table "public"."ahrefs_reports" add constraint "ahrefs_reports_pkey" PRIMARY KEY using index "ahrefs_reports_pkey";

alter table "public"."analytics_email_settings" add constraint "analytics_email_settings_pkey" PRIMARY KEY using index "analytics_email_settings_pkey";

alter table "public"."api_tracking" add constraint "api_tracking_pkey" PRIMARY KEY using index "api_tracking_pkey";

alter table "public"."calendar_events" add constraint "calendar_events_pkey" PRIMARY KEY using index "calendar_events_pkey";

alter table "public"."checklist_items" add constraint "checklist_items_pkey" PRIMARY KEY using index "checklist_items_pkey";

alter table "public"."cron_jobs" add constraint "cron_jobs_pkey" PRIMARY KEY using index "cron_jobs_pkey";

alter table "public"."currencies" add constraint "currencies_pkey" PRIMARY KEY using index "currencies_pkey";

alter table "public"."customers" add constraint "customers_pkey" PRIMARY KEY using index "customers_pkey";

alter table "public"."important_tasks" add constraint "important_tasks_pkey" PRIMARY KEY using index "important_tasks_pkey";

alter table "public"."integrations" add constraint "integrations_pkey" PRIMARY KEY using index "integrations_pkey";

alter table "public"."invitations" add constraint "invitations_pkey" PRIMARY KEY using index "invitations_pkey";

alter table "public"."invoice_types" add constraint "invoice_types_pkey" PRIMARY KEY using index "invoice_types_pkey";

alter table "public"."invoices" add constraint "invoices_pkey" PRIMARY KEY using index "invoices_pkey";

alter table "public"."payment_methods" add constraint "payment_methods_pkey" PRIMARY KEY using index "payment_methods_pkey";

alter table "public"."project_cron_jobs" add constraint "project_cron_jobs_pkey" PRIMARY KEY using index "project_cron_jobs_pkey";

alter table "public"."project_email_settings" add constraint "project_email_settings_pkey" PRIMARY KEY using index "project_email_settings_pkey";

alter table "public"."project_settings" add constraint "project_settings_pkey" PRIMARY KEY using index "project_settings_pkey";

alter table "public"."project_tasks" add constraint "project_tasks_pkey" PRIMARY KEY using index "project_tasks_pkey";

alter table "public"."projects" add constraint "projects_pkey" PRIMARY KEY using index "projects_pkey";

alter table "public"."recurring_invoices" add constraint "recurring_invoices_pkey" PRIMARY KEY using index "recurring_invoices_pkey";

alter table "public"."search_console_cron_jobs" add constraint "search_console_cron_jobs_pkey" PRIMARY KEY using index "search_console_cron_jobs_pkey";

alter table "public"."search_console_email_settings" add constraint "search_console_email_settings_pkey" PRIMARY KEY using index "search_console_email_settings_pkey";

alter table "public"."settings" add constraint "settings_pkey" PRIMARY KEY using index "settings_pkey";

alter table "public"."tasks" add constraint "tasks_pkey" PRIMARY KEY using index "tasks_pkey";

alter table "public"."team_members" add constraint "team_members_pkey" PRIMARY KEY using index "team_members_pkey";

alter table "public"."transactions" add constraint "transactions_pkey" PRIMARY KEY using index "transactions_pkey";

alter table "public"."user_preferences" add constraint "user_preferences_pkey" PRIMARY KEY using index "user_preferences_pkey";

alter table "public"."workspaces" add constraint "workspaces_pkey" PRIMARY KEY using index "workspaces_pkey";

alter table "public"."ahrefs_report_data" add constraint "ahrefs_report_data_report_id_fkey" FOREIGN KEY (report_id) REFERENCES ahrefs_reports(id) ON DELETE CASCADE not valid;

alter table "public"."ahrefs_report_data" validate constraint "ahrefs_report_data_report_id_fkey";

alter table "public"."ahrefs_reports" add constraint "ahrefs_reports_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) not valid;

alter table "public"."ahrefs_reports" validate constraint "ahrefs_reports_user_id_fkey";

alter table "public"."analytics_email_settings" add constraint "analytics_email_settings_user_id_property_id_key" UNIQUE using index "analytics_email_settings_user_id_property_id_key";

alter table "public"."api_tracking" add constraint "api_tracking_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) not valid;

alter table "public"."api_tracking" validate constraint "api_tracking_user_id_fkey";

alter table "public"."checklist_items" add constraint "checklist_items_task_id_fkey" FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE not valid;

alter table "public"."checklist_items" validate constraint "checklist_items_task_id_fkey";

alter table "public"."cron_jobs" add constraint "cron_jobs_analytics_pkey" UNIQUE using index "cron_jobs_analytics_pkey";

alter table "public"."cron_jobs" add constraint "cron_jobs_search_console_pkey" UNIQUE using index "cron_jobs_search_console_pkey";

alter table "public"."cron_jobs" add constraint "cron_jobs_user_id_site_url_job_type_key" UNIQUE using index "cron_jobs_user_id_site_url_job_type_key";

alter table "public"."currencies" add constraint "currencies_code_key" UNIQUE using index "currencies_code_key";

alter table "public"."customers" add constraint "customers_name_key" UNIQUE using index "customers_name_key";

alter table "public"."important_tasks" add constraint "important_tasks_task_id_fkey" FOREIGN KEY (task_id) REFERENCES project_tasks(id) ON DELETE CASCADE not valid;

alter table "public"."important_tasks" validate constraint "important_tasks_task_id_fkey";

alter table "public"."important_tasks" add constraint "important_tasks_user_id_task_id_key" UNIQUE using index "important_tasks_user_id_task_id_key";

alter table "public"."integrations" add constraint "integrations_user_id_service_name_key" UNIQUE using index "integrations_user_id_service_name_key";

alter table "public"."invitations" add constraint "invitations_token_key" UNIQUE using index "invitations_token_key";

alter table "public"."invoice_types" add constraint "invoice_types_name_key" UNIQUE using index "invoice_types_name_key";

alter table "public"."invoices" add constraint "invoices_currency_id_fkey" FOREIGN KEY (currency_id) REFERENCES currencies(id) not valid;

alter table "public"."invoices" validate constraint "invoices_currency_id_fkey";

alter table "public"."invoices" add constraint "invoices_customer_id_fkey" FOREIGN KEY (customer_id) REFERENCES customers(id) not valid;

alter table "public"."invoices" validate constraint "invoices_customer_id_fkey";

alter table "public"."invoices" add constraint "invoices_document_number_key" UNIQUE using index "invoices_document_number_key";

alter table "public"."invoices" add constraint "invoices_invoice_type_id_fkey" FOREIGN KEY (invoice_type_id) REFERENCES invoice_types(id) not valid;

alter table "public"."invoices" validate constraint "invoices_invoice_type_id_fkey";

alter table "public"."invoices" add constraint "invoices_payment_method_id_fkey" FOREIGN KEY (payment_method_id) REFERENCES payment_methods(id) not valid;

alter table "public"."invoices" validate constraint "invoices_payment_method_id_fkey";

alter table "public"."payment_methods" add constraint "payment_methods_name_key" UNIQUE using index "payment_methods_name_key";

alter table "public"."project_cron_jobs" add constraint "project_cron_jobs_project_id_fkey" FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE not valid;

alter table "public"."project_cron_jobs" validate constraint "project_cron_jobs_project_id_fkey";

alter table "public"."project_email_settings" add constraint "project_email_settings_project_id_fkey" FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE not valid;

alter table "public"."project_email_settings" validate constraint "project_email_settings_project_id_fkey";

alter table "public"."project_email_settings" add constraint "project_email_settings_project_id_key" UNIQUE using index "project_email_settings_project_id_key";

alter table "public"."project_tasks" add constraint "project_tasks_project_id_fkey" FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE not valid;

alter table "public"."project_tasks" validate constraint "project_tasks_project_id_fkey";

alter table "public"."recurring_invoices" add constraint "recurring_invoices_currency_id_fkey" FOREIGN KEY (currency_id) REFERENCES currencies(id) not valid;

alter table "public"."recurring_invoices" validate constraint "recurring_invoices_currency_id_fkey";

alter table "public"."recurring_invoices" add constraint "recurring_invoices_customer_id_fkey" FOREIGN KEY (customer_id) REFERENCES customers(id) not valid;

alter table "public"."recurring_invoices" validate constraint "recurring_invoices_customer_id_fkey";

alter table "public"."recurring_invoices" add constraint "recurring_invoices_invoice_type_id_fkey" FOREIGN KEY (invoice_type_id) REFERENCES invoice_types(id) not valid;

alter table "public"."recurring_invoices" validate constraint "recurring_invoices_invoice_type_id_fkey";

alter table "public"."recurring_invoices" add constraint "recurring_invoices_original_invoice_id_fkey" FOREIGN KEY (original_invoice_id) REFERENCES invoices(id) not valid;

alter table "public"."recurring_invoices" validate constraint "recurring_invoices_original_invoice_id_fkey";

alter table "public"."recurring_invoices" add constraint "recurring_invoices_payment_method_id_fkey" FOREIGN KEY (payment_method_id) REFERENCES payment_methods(id) not valid;

alter table "public"."recurring_invoices" validate constraint "recurring_invoices_payment_method_id_fkey";

alter table "public"."recurring_invoices" add constraint "recurring_invoices_status_check" CHECK ((status = ANY (ARRAY['draft'::text, 'pending'::text, 'sent_to_finance'::text, 'test_sent'::text]))) not valid;

alter table "public"."recurring_invoices" validate constraint "recurring_invoices_status_check";

alter table "public"."search_console_cron_jobs" add constraint "search_console_cron_jobs_user_id_site_url_job_type_key" UNIQUE using index "search_console_cron_jobs_user_id_site_url_job_type_key";

alter table "public"."search_console_email_settings" add constraint "search_console_email_settings_user_id_site_url_key" UNIQUE using index "search_console_email_settings_user_id_site_url_key";

alter table "public"."settings" add constraint "settings_auth_user_id_fkey" FOREIGN KEY (auth_user_id) REFERENCES auth.users(id) not valid;

alter table "public"."settings" validate constraint "settings_auth_user_id_fkey";

alter table "public"."settings" add constraint "settings_auth_user_id_service_name_key" UNIQUE using index "settings_auth_user_id_service_name_key";

alter table "public"."settings" add constraint "settings_user_id_service_name_key" UNIQUE using index "settings_user_id_service_name_key";

alter table "public"."team_members" add constraint "team_members_workspace_id_fkey" FOREIGN KEY (workspace_id) REFERENCES workspaces(id) not valid;

alter table "public"."team_members" validate constraint "team_members_workspace_id_fkey";

alter table "public"."transactions" add constraint "transactions_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) not valid;

alter table "public"."transactions" validate constraint "transactions_user_id_fkey";

alter table "public"."user_preferences" add constraint "user_preferences_user_id_key" UNIQUE using index "user_preferences_user_id_key";

alter table "public"."event_tracking" add constraint "event_tracking_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) not valid;

alter table "public"."event_tracking" validate constraint "event_tracking_user_id_fkey";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.create_default_workspace_for_user()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    -- Create default workspace
    INSERT INTO public.workspaces (id, name, owner_id)
    VALUES (
        uuid_generate_v4(),
        'Default Workspace',
        NEW.id
    );
    
    -- Get the workspace id we just created
    WITH new_workspace AS (
        SELECT id FROM public.workspaces WHERE owner_id = NEW.id LIMIT 1
    )
    -- Add user to workspace_users
    INSERT INTO public.workspace_users (
        workspace_id,
        user_id,
        email,
        role,
        name,
        permissions
    )
    SELECT 
        new_workspace.id,
        NEW.id,
        NEW.email,
        'admin',
        NEW.raw_user_meta_data->>'name',
        jsonb_build_object(
            'canViewAnalytics', true,
            'canViewDrive', true,
            'canViewCalendar', true,
            'canViewSearchConsole', true,
            'canViewInvoices', true,
            'canViewTransactions', true
        )
    FROM new_workspace;

    RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_email_settings(p_property_id text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  RETURN (
    SELECT json_build_object(
      'enabled', enabled,
      'recipients', recipients,
      'frequency', frequency,
      'send_day', send_day,
      'send_time', send_time
    )
    FROM analytics_email_settings
    WHERE user_id = auth.uid() AND property_id = p_property_id
  );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.handle_google_auth()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  -- If the user is signing in with Google (check metadata)
  IF NEW.raw_user_meta_data->>'provider' = 'google' THEN
    -- Insert or update the profile
    INSERT INTO public.profiles (
      id,
      email,
      name,
      avatarurl,
      user_id,
      auth_user_id,
      created_at,
      updated_at
    )
    VALUES (
      NEW.id,
      NEW.email,
      COALESCE(NEW.raw_user_meta_data->>'name', NEW.email),
      NEW.raw_user_meta_data->>'avatar_url',
      NEW.id,
      NEW.id,
      NOW(),
      NOW()
    )
    ON CONFLICT (email) 
    DO UPDATE SET
      auth_user_id = NEW.id,
      name = COALESCE(NEW.raw_user_meta_data->>'name', profiles.name),
      avatarurl = COALESCE(NEW.raw_user_meta_data->>'avatar_url', profiles.avatarurl),
      updated_at = NOW();
  END IF;
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  profile_id uuid;
BEGIN
  -- Create profile with minimal required fields first
  INSERT INTO public.profiles (
    id,
    user_id,
    name,
    email,
    company,
    role,
    phone,
    address,
    city,
    country,
    website,
    created_at,
    updated_at
  )
  VALUES (
    NEW.id,
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', ''),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'company', ''),
    'User',
    '', -- phone
    '', -- address
    '', -- city
    '', -- country
    '', -- website
    NOW(),
    NOW()
  )
  RETURNING id INTO profile_id;

  -- Create user preferences
  INSERT INTO public.user_preferences (
    user_id,
    name,
    email,
    company,
    plan_id,
    trial_start_date,
    trial_end_date,
    has_seen_welcome,
    created_at
  )
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', ''),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'company', ''),
    'free',
    NOW(),
    NOW() + INTERVAL '14 days',
    false,
    NOW()
  );

  RETURN NEW;
EXCEPTION
  WHEN others THEN
    RAISE LOG 'Error in handle_new_user: %', SQLERRM;
    RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.set_admin_preferences(admin_user_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  -- Insert or update admin preferences
  INSERT INTO user_preferences (user_id, plan_id, trial_start_date, trial_end_date, has_seen_welcome)
  VALUES (
    admin_user_id,
    'enterprise',
    NOW(),
    NOW() + INTERVAL '99 years',
    true
  )
  ON CONFLICT (user_id)
  DO UPDATE SET
    plan_id = 'enterprise',
    trial_start_date = NOW(),
    trial_end_date = NOW() + INTERVAL '99 years',
    has_seen_welcome = true;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.sync_user_ids()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  -- Ensure user exists in auth.users
  IF NOT EXISTS (
    SELECT 1 FROM auth.users WHERE id = NEW.id
  ) THEN
    RAISE EXCEPTION 'User ID does not exist in auth.users';
  END IF;

  -- Update or create user preferences
  INSERT INTO public.user_preferences (user_id, created_at)
  VALUES (NEW.id, NOW())
  ON CONFLICT (user_id) 
  DO UPDATE SET updated_at = NOW();

  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_email_settings(p_property_id text, p_enabled boolean, p_recipients text, p_frequency text, p_send_day integer, p_send_time text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  UPDATE analytics_email_settings 
  SET 
    enabled = p_enabled,
    recipients = p_recipients,
    frequency = p_frequency,
    send_day = p_send_day,
    send_time = p_send_time,
    updated_at = NOW()
  WHERE 
    user_id = auth.uid() AND 
    property_id = p_property_id;

  -- If no row was updated, insert a new one
  IF NOT FOUND THEN
    INSERT INTO analytics_email_settings (
      user_id,
      property_id,
      enabled,
      recipients,
      frequency,
      send_day,
      send_time
    ) VALUES (
      auth.uid(),
      p_property_id,
      p_enabled,
      p_recipients,
      p_frequency,
      p_send_day,
      p_send_time
    );
  END IF;

  RETURN json_build_object(
    'success', true
  );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_project_cron_jobs_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_project_email_settings_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.handle_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
    new.updated_at = timezone('utc'::text, now());
    return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.track_user_registration()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  INSERT INTO event_tracking (event_type, details)
  VALUES ('user_registration', json_build_object(
    'user_id', NEW.user_id,
    'email', NEW.email,
    'name', NEW.name,
    'company', NEW.company,
    'registration_time', NEW.created_at
  ));
  RETURN NEW;
END;
$function$
;

grant delete on table "public"."ahrefs_report_data" to "anon";

grant insert on table "public"."ahrefs_report_data" to "anon";

grant references on table "public"."ahrefs_report_data" to "anon";

grant select on table "public"."ahrefs_report_data" to "anon";

grant trigger on table "public"."ahrefs_report_data" to "anon";

grant truncate on table "public"."ahrefs_report_data" to "anon";

grant update on table "public"."ahrefs_report_data" to "anon";

grant delete on table "public"."ahrefs_report_data" to "authenticated";

grant insert on table "public"."ahrefs_report_data" to "authenticated";

grant references on table "public"."ahrefs_report_data" to "authenticated";

grant select on table "public"."ahrefs_report_data" to "authenticated";

grant trigger on table "public"."ahrefs_report_data" to "authenticated";

grant truncate on table "public"."ahrefs_report_data" to "authenticated";

grant update on table "public"."ahrefs_report_data" to "authenticated";

grant delete on table "public"."ahrefs_report_data" to "service_role";

grant insert on table "public"."ahrefs_report_data" to "service_role";

grant references on table "public"."ahrefs_report_data" to "service_role";

grant select on table "public"."ahrefs_report_data" to "service_role";

grant trigger on table "public"."ahrefs_report_data" to "service_role";

grant truncate on table "public"."ahrefs_report_data" to "service_role";

grant update on table "public"."ahrefs_report_data" to "service_role";

grant delete on table "public"."ahrefs_reports" to "anon";

grant insert on table "public"."ahrefs_reports" to "anon";

grant references on table "public"."ahrefs_reports" to "anon";

grant select on table "public"."ahrefs_reports" to "anon";

grant trigger on table "public"."ahrefs_reports" to "anon";

grant truncate on table "public"."ahrefs_reports" to "anon";

grant update on table "public"."ahrefs_reports" to "anon";

grant delete on table "public"."ahrefs_reports" to "authenticated";

grant insert on table "public"."ahrefs_reports" to "authenticated";

grant references on table "public"."ahrefs_reports" to "authenticated";

grant select on table "public"."ahrefs_reports" to "authenticated";

grant trigger on table "public"."ahrefs_reports" to "authenticated";

grant truncate on table "public"."ahrefs_reports" to "authenticated";

grant update on table "public"."ahrefs_reports" to "authenticated";

grant delete on table "public"."ahrefs_reports" to "service_role";

grant insert on table "public"."ahrefs_reports" to "service_role";

grant references on table "public"."ahrefs_reports" to "service_role";

grant select on table "public"."ahrefs_reports" to "service_role";

grant trigger on table "public"."ahrefs_reports" to "service_role";

grant truncate on table "public"."ahrefs_reports" to "service_role";

grant update on table "public"."ahrefs_reports" to "service_role";

grant delete on table "public"."analytics_email_settings" to "anon";

grant insert on table "public"."analytics_email_settings" to "anon";

grant references on table "public"."analytics_email_settings" to "anon";

grant select on table "public"."analytics_email_settings" to "anon";

grant trigger on table "public"."analytics_email_settings" to "anon";

grant truncate on table "public"."analytics_email_settings" to "anon";

grant update on table "public"."analytics_email_settings" to "anon";

grant delete on table "public"."analytics_email_settings" to "authenticated";

grant insert on table "public"."analytics_email_settings" to "authenticated";

grant references on table "public"."analytics_email_settings" to "authenticated";

grant select on table "public"."analytics_email_settings" to "authenticated";

grant trigger on table "public"."analytics_email_settings" to "authenticated";

grant truncate on table "public"."analytics_email_settings" to "authenticated";

grant update on table "public"."analytics_email_settings" to "authenticated";

grant delete on table "public"."analytics_email_settings" to "service_role";

grant insert on table "public"."analytics_email_settings" to "service_role";

grant references on table "public"."analytics_email_settings" to "service_role";

grant select on table "public"."analytics_email_settings" to "service_role";

grant trigger on table "public"."analytics_email_settings" to "service_role";

grant truncate on table "public"."analytics_email_settings" to "service_role";

grant update on table "public"."analytics_email_settings" to "service_role";

grant delete on table "public"."api_tracking" to "anon";

grant insert on table "public"."api_tracking" to "anon";

grant references on table "public"."api_tracking" to "anon";

grant select on table "public"."api_tracking" to "anon";

grant trigger on table "public"."api_tracking" to "anon";

grant truncate on table "public"."api_tracking" to "anon";

grant update on table "public"."api_tracking" to "anon";

grant delete on table "public"."api_tracking" to "authenticated";

grant insert on table "public"."api_tracking" to "authenticated";

grant references on table "public"."api_tracking" to "authenticated";

grant select on table "public"."api_tracking" to "authenticated";

grant trigger on table "public"."api_tracking" to "authenticated";

grant truncate on table "public"."api_tracking" to "authenticated";

grant update on table "public"."api_tracking" to "authenticated";

grant delete on table "public"."api_tracking" to "service_role";

grant insert on table "public"."api_tracking" to "service_role";

grant references on table "public"."api_tracking" to "service_role";

grant select on table "public"."api_tracking" to "service_role";

grant trigger on table "public"."api_tracking" to "service_role";

grant truncate on table "public"."api_tracking" to "service_role";

grant update on table "public"."api_tracking" to "service_role";

grant delete on table "public"."calendar_events" to "anon";

grant insert on table "public"."calendar_events" to "anon";

grant references on table "public"."calendar_events" to "anon";

grant select on table "public"."calendar_events" to "anon";

grant trigger on table "public"."calendar_events" to "anon";

grant truncate on table "public"."calendar_events" to "anon";

grant update on table "public"."calendar_events" to "anon";

grant delete on table "public"."calendar_events" to "authenticated";

grant insert on table "public"."calendar_events" to "authenticated";

grant references on table "public"."calendar_events" to "authenticated";

grant select on table "public"."calendar_events" to "authenticated";

grant trigger on table "public"."calendar_events" to "authenticated";

grant truncate on table "public"."calendar_events" to "authenticated";

grant update on table "public"."calendar_events" to "authenticated";

grant delete on table "public"."calendar_events" to "service_role";

grant insert on table "public"."calendar_events" to "service_role";

grant references on table "public"."calendar_events" to "service_role";

grant select on table "public"."calendar_events" to "service_role";

grant trigger on table "public"."calendar_events" to "service_role";

grant truncate on table "public"."calendar_events" to "service_role";

grant update on table "public"."calendar_events" to "service_role";

grant delete on table "public"."checklist_items" to "anon";

grant insert on table "public"."checklist_items" to "anon";

grant references on table "public"."checklist_items" to "anon";

grant select on table "public"."checklist_items" to "anon";

grant trigger on table "public"."checklist_items" to "anon";

grant truncate on table "public"."checklist_items" to "anon";

grant update on table "public"."checklist_items" to "anon";

grant delete on table "public"."checklist_items" to "authenticated";

grant insert on table "public"."checklist_items" to "authenticated";

grant references on table "public"."checklist_items" to "authenticated";

grant select on table "public"."checklist_items" to "authenticated";

grant trigger on table "public"."checklist_items" to "authenticated";

grant truncate on table "public"."checklist_items" to "authenticated";

grant update on table "public"."checklist_items" to "authenticated";

grant delete on table "public"."checklist_items" to "service_role";

grant insert on table "public"."checklist_items" to "service_role";

grant references on table "public"."checklist_items" to "service_role";

grant select on table "public"."checklist_items" to "service_role";

grant trigger on table "public"."checklist_items" to "service_role";

grant truncate on table "public"."checklist_items" to "service_role";

grant update on table "public"."checklist_items" to "service_role";

grant delete on table "public"."cron_jobs" to "anon";

grant insert on table "public"."cron_jobs" to "anon";

grant references on table "public"."cron_jobs" to "anon";

grant select on table "public"."cron_jobs" to "anon";

grant trigger on table "public"."cron_jobs" to "anon";

grant truncate on table "public"."cron_jobs" to "anon";

grant update on table "public"."cron_jobs" to "anon";

grant delete on table "public"."cron_jobs" to "authenticated";

grant insert on table "public"."cron_jobs" to "authenticated";

grant references on table "public"."cron_jobs" to "authenticated";

grant select on table "public"."cron_jobs" to "authenticated";

grant trigger on table "public"."cron_jobs" to "authenticated";

grant truncate on table "public"."cron_jobs" to "authenticated";

grant update on table "public"."cron_jobs" to "authenticated";

grant delete on table "public"."cron_jobs" to "service_role";

grant insert on table "public"."cron_jobs" to "service_role";

grant references on table "public"."cron_jobs" to "service_role";

grant select on table "public"."cron_jobs" to "service_role";

grant trigger on table "public"."cron_jobs" to "service_role";

grant truncate on table "public"."cron_jobs" to "service_role";

grant update on table "public"."cron_jobs" to "service_role";

grant delete on table "public"."currencies" to "anon";

grant insert on table "public"."currencies" to "anon";

grant references on table "public"."currencies" to "anon";

grant select on table "public"."currencies" to "anon";

grant trigger on table "public"."currencies" to "anon";

grant truncate on table "public"."currencies" to "anon";

grant update on table "public"."currencies" to "anon";

grant delete on table "public"."currencies" to "authenticated";

grant insert on table "public"."currencies" to "authenticated";

grant references on table "public"."currencies" to "authenticated";

grant select on table "public"."currencies" to "authenticated";

grant trigger on table "public"."currencies" to "authenticated";

grant truncate on table "public"."currencies" to "authenticated";

grant update on table "public"."currencies" to "authenticated";

grant delete on table "public"."currencies" to "service_role";

grant insert on table "public"."currencies" to "service_role";

grant references on table "public"."currencies" to "service_role";

grant select on table "public"."currencies" to "service_role";

grant trigger on table "public"."currencies" to "service_role";

grant truncate on table "public"."currencies" to "service_role";

grant update on table "public"."currencies" to "service_role";

grant delete on table "public"."customers" to "anon";

grant insert on table "public"."customers" to "anon";

grant references on table "public"."customers" to "anon";

grant select on table "public"."customers" to "anon";

grant trigger on table "public"."customers" to "anon";

grant truncate on table "public"."customers" to "anon";

grant update on table "public"."customers" to "anon";

grant delete on table "public"."customers" to "authenticated";

grant insert on table "public"."customers" to "authenticated";

grant references on table "public"."customers" to "authenticated";

grant select on table "public"."customers" to "authenticated";

grant trigger on table "public"."customers" to "authenticated";

grant truncate on table "public"."customers" to "authenticated";

grant update on table "public"."customers" to "authenticated";

grant delete on table "public"."customers" to "service_role";

grant insert on table "public"."customers" to "service_role";

grant references on table "public"."customers" to "service_role";

grant select on table "public"."customers" to "service_role";

grant trigger on table "public"."customers" to "service_role";

grant truncate on table "public"."customers" to "service_role";

grant update on table "public"."customers" to "service_role";

grant delete on table "public"."important_tasks" to "anon";

grant insert on table "public"."important_tasks" to "anon";

grant references on table "public"."important_tasks" to "anon";

grant select on table "public"."important_tasks" to "anon";

grant trigger on table "public"."important_tasks" to "anon";

grant truncate on table "public"."important_tasks" to "anon";

grant update on table "public"."important_tasks" to "anon";

grant delete on table "public"."important_tasks" to "authenticated";

grant insert on table "public"."important_tasks" to "authenticated";

grant references on table "public"."important_tasks" to "authenticated";

grant select on table "public"."important_tasks" to "authenticated";

grant trigger on table "public"."important_tasks" to "authenticated";

grant truncate on table "public"."important_tasks" to "authenticated";

grant update on table "public"."important_tasks" to "authenticated";

grant delete on table "public"."important_tasks" to "service_role";

grant insert on table "public"."important_tasks" to "service_role";

grant references on table "public"."important_tasks" to "service_role";

grant select on table "public"."important_tasks" to "service_role";

grant trigger on table "public"."important_tasks" to "service_role";

grant truncate on table "public"."important_tasks" to "service_role";

grant update on table "public"."important_tasks" to "service_role";

grant delete on table "public"."integrations" to "anon";

grant insert on table "public"."integrations" to "anon";

grant references on table "public"."integrations" to "anon";

grant select on table "public"."integrations" to "anon";

grant trigger on table "public"."integrations" to "anon";

grant truncate on table "public"."integrations" to "anon";

grant update on table "public"."integrations" to "anon";

grant delete on table "public"."integrations" to "authenticated";

grant insert on table "public"."integrations" to "authenticated";

grant references on table "public"."integrations" to "authenticated";

grant select on table "public"."integrations" to "authenticated";

grant trigger on table "public"."integrations" to "authenticated";

grant truncate on table "public"."integrations" to "authenticated";

grant update on table "public"."integrations" to "authenticated";

grant delete on table "public"."integrations" to "service_role";

grant insert on table "public"."integrations" to "service_role";

grant references on table "public"."integrations" to "service_role";

grant select on table "public"."integrations" to "service_role";

grant trigger on table "public"."integrations" to "service_role";

grant truncate on table "public"."integrations" to "service_role";

grant update on table "public"."integrations" to "service_role";

grant delete on table "public"."invitations" to "anon";

grant insert on table "public"."invitations" to "anon";

grant references on table "public"."invitations" to "anon";

grant select on table "public"."invitations" to "anon";

grant trigger on table "public"."invitations" to "anon";

grant truncate on table "public"."invitations" to "anon";

grant update on table "public"."invitations" to "anon";

grant delete on table "public"."invitations" to "authenticated";

grant insert on table "public"."invitations" to "authenticated";

grant references on table "public"."invitations" to "authenticated";

grant select on table "public"."invitations" to "authenticated";

grant trigger on table "public"."invitations" to "authenticated";

grant truncate on table "public"."invitations" to "authenticated";

grant update on table "public"."invitations" to "authenticated";

grant delete on table "public"."invitations" to "service_role";

grant insert on table "public"."invitations" to "service_role";

grant references on table "public"."invitations" to "service_role";

grant select on table "public"."invitations" to "service_role";

grant trigger on table "public"."invitations" to "service_role";

grant truncate on table "public"."invitations" to "service_role";

grant update on table "public"."invitations" to "service_role";

grant delete on table "public"."invoice_types" to "anon";

grant insert on table "public"."invoice_types" to "anon";

grant references on table "public"."invoice_types" to "anon";

grant select on table "public"."invoice_types" to "anon";

grant trigger on table "public"."invoice_types" to "anon";

grant truncate on table "public"."invoice_types" to "anon";

grant update on table "public"."invoice_types" to "anon";

grant delete on table "public"."invoice_types" to "authenticated";

grant insert on table "public"."invoice_types" to "authenticated";

grant references on table "public"."invoice_types" to "authenticated";

grant select on table "public"."invoice_types" to "authenticated";

grant trigger on table "public"."invoice_types" to "authenticated";

grant truncate on table "public"."invoice_types" to "authenticated";

grant update on table "public"."invoice_types" to "authenticated";

grant delete on table "public"."invoice_types" to "service_role";

grant insert on table "public"."invoice_types" to "service_role";

grant references on table "public"."invoice_types" to "service_role";

grant select on table "public"."invoice_types" to "service_role";

grant trigger on table "public"."invoice_types" to "service_role";

grant truncate on table "public"."invoice_types" to "service_role";

grant update on table "public"."invoice_types" to "service_role";

grant delete on table "public"."invoices" to "anon";

grant insert on table "public"."invoices" to "anon";

grant references on table "public"."invoices" to "anon";

grant select on table "public"."invoices" to "anon";

grant trigger on table "public"."invoices" to "anon";

grant truncate on table "public"."invoices" to "anon";

grant update on table "public"."invoices" to "anon";

grant delete on table "public"."invoices" to "authenticated";

grant insert on table "public"."invoices" to "authenticated";

grant references on table "public"."invoices" to "authenticated";

grant select on table "public"."invoices" to "authenticated";

grant trigger on table "public"."invoices" to "authenticated";

grant truncate on table "public"."invoices" to "authenticated";

grant update on table "public"."invoices" to "authenticated";

grant delete on table "public"."invoices" to "service_role";

grant insert on table "public"."invoices" to "service_role";

grant references on table "public"."invoices" to "service_role";

grant select on table "public"."invoices" to "service_role";

grant trigger on table "public"."invoices" to "service_role";

grant truncate on table "public"."invoices" to "service_role";

grant update on table "public"."invoices" to "service_role";

grant delete on table "public"."payment_methods" to "anon";

grant insert on table "public"."payment_methods" to "anon";

grant references on table "public"."payment_methods" to "anon";

grant select on table "public"."payment_methods" to "anon";

grant trigger on table "public"."payment_methods" to "anon";

grant truncate on table "public"."payment_methods" to "anon";

grant update on table "public"."payment_methods" to "anon";

grant delete on table "public"."payment_methods" to "authenticated";

grant insert on table "public"."payment_methods" to "authenticated";

grant references on table "public"."payment_methods" to "authenticated";

grant select on table "public"."payment_methods" to "authenticated";

grant trigger on table "public"."payment_methods" to "authenticated";

grant truncate on table "public"."payment_methods" to "authenticated";

grant update on table "public"."payment_methods" to "authenticated";

grant delete on table "public"."payment_methods" to "service_role";

grant insert on table "public"."payment_methods" to "service_role";

grant references on table "public"."payment_methods" to "service_role";

grant select on table "public"."payment_methods" to "service_role";

grant trigger on table "public"."payment_methods" to "service_role";

grant truncate on table "public"."payment_methods" to "service_role";

grant update on table "public"."payment_methods" to "service_role";

grant delete on table "public"."project_cron_jobs" to "anon";

grant insert on table "public"."project_cron_jobs" to "anon";

grant references on table "public"."project_cron_jobs" to "anon";

grant select on table "public"."project_cron_jobs" to "anon";

grant trigger on table "public"."project_cron_jobs" to "anon";

grant truncate on table "public"."project_cron_jobs" to "anon";

grant update on table "public"."project_cron_jobs" to "anon";

grant delete on table "public"."project_cron_jobs" to "authenticated";

grant insert on table "public"."project_cron_jobs" to "authenticated";

grant references on table "public"."project_cron_jobs" to "authenticated";

grant select on table "public"."project_cron_jobs" to "authenticated";

grant trigger on table "public"."project_cron_jobs" to "authenticated";

grant truncate on table "public"."project_cron_jobs" to "authenticated";

grant update on table "public"."project_cron_jobs" to "authenticated";

grant delete on table "public"."project_cron_jobs" to "service_role";

grant insert on table "public"."project_cron_jobs" to "service_role";

grant references on table "public"."project_cron_jobs" to "service_role";

grant select on table "public"."project_cron_jobs" to "service_role";

grant trigger on table "public"."project_cron_jobs" to "service_role";

grant truncate on table "public"."project_cron_jobs" to "service_role";

grant update on table "public"."project_cron_jobs" to "service_role";

grant delete on table "public"."project_email_settings" to "anon";

grant insert on table "public"."project_email_settings" to "anon";

grant references on table "public"."project_email_settings" to "anon";

grant select on table "public"."project_email_settings" to "anon";

grant trigger on table "public"."project_email_settings" to "anon";

grant truncate on table "public"."project_email_settings" to "anon";

grant update on table "public"."project_email_settings" to "anon";

grant delete on table "public"."project_email_settings" to "authenticated";

grant insert on table "public"."project_email_settings" to "authenticated";

grant references on table "public"."project_email_settings" to "authenticated";

grant select on table "public"."project_email_settings" to "authenticated";

grant trigger on table "public"."project_email_settings" to "authenticated";

grant truncate on table "public"."project_email_settings" to "authenticated";

grant update on table "public"."project_email_settings" to "authenticated";

grant delete on table "public"."project_email_settings" to "service_role";

grant insert on table "public"."project_email_settings" to "service_role";

grant references on table "public"."project_email_settings" to "service_role";

grant select on table "public"."project_email_settings" to "service_role";

grant trigger on table "public"."project_email_settings" to "service_role";

grant truncate on table "public"."project_email_settings" to "service_role";

grant update on table "public"."project_email_settings" to "service_role";

grant delete on table "public"."project_settings" to "anon";

grant insert on table "public"."project_settings" to "anon";

grant references on table "public"."project_settings" to "anon";

grant select on table "public"."project_settings" to "anon";

grant trigger on table "public"."project_settings" to "anon";

grant truncate on table "public"."project_settings" to "anon";

grant update on table "public"."project_settings" to "anon";

grant delete on table "public"."project_settings" to "authenticated";

grant insert on table "public"."project_settings" to "authenticated";

grant references on table "public"."project_settings" to "authenticated";

grant select on table "public"."project_settings" to "authenticated";

grant trigger on table "public"."project_settings" to "authenticated";

grant truncate on table "public"."project_settings" to "authenticated";

grant update on table "public"."project_settings" to "authenticated";

grant delete on table "public"."project_settings" to "service_role";

grant insert on table "public"."project_settings" to "service_role";

grant references on table "public"."project_settings" to "service_role";

grant select on table "public"."project_settings" to "service_role";

grant trigger on table "public"."project_settings" to "service_role";

grant truncate on table "public"."project_settings" to "service_role";

grant update on table "public"."project_settings" to "service_role";

grant delete on table "public"."project_tasks" to "anon";

grant insert on table "public"."project_tasks" to "anon";

grant references on table "public"."project_tasks" to "anon";

grant select on table "public"."project_tasks" to "anon";

grant trigger on table "public"."project_tasks" to "anon";

grant truncate on table "public"."project_tasks" to "anon";

grant update on table "public"."project_tasks" to "anon";

grant delete on table "public"."project_tasks" to "authenticated";

grant insert on table "public"."project_tasks" to "authenticated";

grant references on table "public"."project_tasks" to "authenticated";

grant select on table "public"."project_tasks" to "authenticated";

grant trigger on table "public"."project_tasks" to "authenticated";

grant truncate on table "public"."project_tasks" to "authenticated";

grant update on table "public"."project_tasks" to "authenticated";

grant delete on table "public"."project_tasks" to "service_role";

grant insert on table "public"."project_tasks" to "service_role";

grant references on table "public"."project_tasks" to "service_role";

grant select on table "public"."project_tasks" to "service_role";

grant trigger on table "public"."project_tasks" to "service_role";

grant truncate on table "public"."project_tasks" to "service_role";

grant update on table "public"."project_tasks" to "service_role";

grant delete on table "public"."projects" to "anon";

grant insert on table "public"."projects" to "anon";

grant references on table "public"."projects" to "anon";

grant select on table "public"."projects" to "anon";

grant trigger on table "public"."projects" to "anon";

grant truncate on table "public"."projects" to "anon";

grant update on table "public"."projects" to "anon";

grant delete on table "public"."projects" to "authenticated";

grant insert on table "public"."projects" to "authenticated";

grant references on table "public"."projects" to "authenticated";

grant select on table "public"."projects" to "authenticated";

grant trigger on table "public"."projects" to "authenticated";

grant truncate on table "public"."projects" to "authenticated";

grant update on table "public"."projects" to "authenticated";

grant delete on table "public"."projects" to "service_role";

grant insert on table "public"."projects" to "service_role";

grant references on table "public"."projects" to "service_role";

grant select on table "public"."projects" to "service_role";

grant trigger on table "public"."projects" to "service_role";

grant truncate on table "public"."projects" to "service_role";

grant update on table "public"."projects" to "service_role";

grant delete on table "public"."recurring_invoices" to "anon";

grant insert on table "public"."recurring_invoices" to "anon";

grant references on table "public"."recurring_invoices" to "anon";

grant select on table "public"."recurring_invoices" to "anon";

grant trigger on table "public"."recurring_invoices" to "anon";

grant truncate on table "public"."recurring_invoices" to "anon";

grant update on table "public"."recurring_invoices" to "anon";

grant delete on table "public"."recurring_invoices" to "authenticated";

grant insert on table "public"."recurring_invoices" to "authenticated";

grant references on table "public"."recurring_invoices" to "authenticated";

grant select on table "public"."recurring_invoices" to "authenticated";

grant trigger on table "public"."recurring_invoices" to "authenticated";

grant truncate on table "public"."recurring_invoices" to "authenticated";

grant update on table "public"."recurring_invoices" to "authenticated";

grant delete on table "public"."recurring_invoices" to "service_role";

grant insert on table "public"."recurring_invoices" to "service_role";

grant references on table "public"."recurring_invoices" to "service_role";

grant select on table "public"."recurring_invoices" to "service_role";

grant trigger on table "public"."recurring_invoices" to "service_role";

grant truncate on table "public"."recurring_invoices" to "service_role";

grant update on table "public"."recurring_invoices" to "service_role";

grant delete on table "public"."search_console_cron_jobs" to "anon";

grant insert on table "public"."search_console_cron_jobs" to "anon";

grant references on table "public"."search_console_cron_jobs" to "anon";

grant select on table "public"."search_console_cron_jobs" to "anon";

grant trigger on table "public"."search_console_cron_jobs" to "anon";

grant truncate on table "public"."search_console_cron_jobs" to "anon";

grant update on table "public"."search_console_cron_jobs" to "anon";

grant delete on table "public"."search_console_cron_jobs" to "authenticated";

grant insert on table "public"."search_console_cron_jobs" to "authenticated";

grant references on table "public"."search_console_cron_jobs" to "authenticated";

grant select on table "public"."search_console_cron_jobs" to "authenticated";

grant trigger on table "public"."search_console_cron_jobs" to "authenticated";

grant truncate on table "public"."search_console_cron_jobs" to "authenticated";

grant update on table "public"."search_console_cron_jobs" to "authenticated";

grant delete on table "public"."search_console_cron_jobs" to "service_role";

grant insert on table "public"."search_console_cron_jobs" to "service_role";

grant references on table "public"."search_console_cron_jobs" to "service_role";

grant select on table "public"."search_console_cron_jobs" to "service_role";

grant trigger on table "public"."search_console_cron_jobs" to "service_role";

grant truncate on table "public"."search_console_cron_jobs" to "service_role";

grant update on table "public"."search_console_cron_jobs" to "service_role";

grant delete on table "public"."search_console_email_settings" to "anon";

grant insert on table "public"."search_console_email_settings" to "anon";

grant references on table "public"."search_console_email_settings" to "anon";

grant select on table "public"."search_console_email_settings" to "anon";

grant trigger on table "public"."search_console_email_settings" to "anon";

grant truncate on table "public"."search_console_email_settings" to "anon";

grant update on table "public"."search_console_email_settings" to "anon";

grant delete on table "public"."search_console_email_settings" to "authenticated";

grant insert on table "public"."search_console_email_settings" to "authenticated";

grant references on table "public"."search_console_email_settings" to "authenticated";

grant select on table "public"."search_console_email_settings" to "authenticated";

grant trigger on table "public"."search_console_email_settings" to "authenticated";

grant truncate on table "public"."search_console_email_settings" to "authenticated";

grant update on table "public"."search_console_email_settings" to "authenticated";

grant delete on table "public"."search_console_email_settings" to "service_role";

grant insert on table "public"."search_console_email_settings" to "service_role";

grant references on table "public"."search_console_email_settings" to "service_role";

grant select on table "public"."search_console_email_settings" to "service_role";

grant trigger on table "public"."search_console_email_settings" to "service_role";

grant truncate on table "public"."search_console_email_settings" to "service_role";

grant update on table "public"."search_console_email_settings" to "service_role";

grant delete on table "public"."settings" to "anon";

grant insert on table "public"."settings" to "anon";

grant references on table "public"."settings" to "anon";

grant select on table "public"."settings" to "anon";

grant trigger on table "public"."settings" to "anon";

grant truncate on table "public"."settings" to "anon";

grant update on table "public"."settings" to "anon";

grant delete on table "public"."settings" to "authenticated";

grant insert on table "public"."settings" to "authenticated";

grant references on table "public"."settings" to "authenticated";

grant select on table "public"."settings" to "authenticated";

grant trigger on table "public"."settings" to "authenticated";

grant truncate on table "public"."settings" to "authenticated";

grant update on table "public"."settings" to "authenticated";

grant delete on table "public"."settings" to "service_role";

grant insert on table "public"."settings" to "service_role";

grant references on table "public"."settings" to "service_role";

grant select on table "public"."settings" to "service_role";

grant trigger on table "public"."settings" to "service_role";

grant truncate on table "public"."settings" to "service_role";

grant update on table "public"."settings" to "service_role";

grant delete on table "public"."tasks" to "anon";

grant insert on table "public"."tasks" to "anon";

grant references on table "public"."tasks" to "anon";

grant select on table "public"."tasks" to "anon";

grant trigger on table "public"."tasks" to "anon";

grant truncate on table "public"."tasks" to "anon";

grant update on table "public"."tasks" to "anon";

grant delete on table "public"."tasks" to "authenticated";

grant insert on table "public"."tasks" to "authenticated";

grant references on table "public"."tasks" to "authenticated";

grant select on table "public"."tasks" to "authenticated";

grant trigger on table "public"."tasks" to "authenticated";

grant truncate on table "public"."tasks" to "authenticated";

grant update on table "public"."tasks" to "authenticated";

grant delete on table "public"."tasks" to "service_role";

grant insert on table "public"."tasks" to "service_role";

grant references on table "public"."tasks" to "service_role";

grant select on table "public"."tasks" to "service_role";

grant trigger on table "public"."tasks" to "service_role";

grant truncate on table "public"."tasks" to "service_role";

grant update on table "public"."tasks" to "service_role";

grant delete on table "public"."team_members" to "anon";

grant insert on table "public"."team_members" to "anon";

grant references on table "public"."team_members" to "anon";

grant select on table "public"."team_members" to "anon";

grant trigger on table "public"."team_members" to "anon";

grant truncate on table "public"."team_members" to "anon";

grant update on table "public"."team_members" to "anon";

grant delete on table "public"."team_members" to "authenticated";

grant insert on table "public"."team_members" to "authenticated";

grant references on table "public"."team_members" to "authenticated";

grant select on table "public"."team_members" to "authenticated";

grant trigger on table "public"."team_members" to "authenticated";

grant truncate on table "public"."team_members" to "authenticated";

grant update on table "public"."team_members" to "authenticated";

grant delete on table "public"."team_members" to "service_role";

grant insert on table "public"."team_members" to "service_role";

grant references on table "public"."team_members" to "service_role";

grant select on table "public"."team_members" to "service_role";

grant trigger on table "public"."team_members" to "service_role";

grant truncate on table "public"."team_members" to "service_role";

grant update on table "public"."team_members" to "service_role";

grant delete on table "public"."transactions" to "anon";

grant insert on table "public"."transactions" to "anon";

grant references on table "public"."transactions" to "anon";

grant select on table "public"."transactions" to "anon";

grant trigger on table "public"."transactions" to "anon";

grant truncate on table "public"."transactions" to "anon";

grant update on table "public"."transactions" to "anon";

grant delete on table "public"."transactions" to "authenticated";

grant insert on table "public"."transactions" to "authenticated";

grant references on table "public"."transactions" to "authenticated";

grant select on table "public"."transactions" to "authenticated";

grant trigger on table "public"."transactions" to "authenticated";

grant truncate on table "public"."transactions" to "authenticated";

grant update on table "public"."transactions" to "authenticated";

grant delete on table "public"."transactions" to "service_role";

grant insert on table "public"."transactions" to "service_role";

grant references on table "public"."transactions" to "service_role";

grant select on table "public"."transactions" to "service_role";

grant trigger on table "public"."transactions" to "service_role";

grant truncate on table "public"."transactions" to "service_role";

grant update on table "public"."transactions" to "service_role";

grant delete on table "public"."user_preferences" to "anon";

grant insert on table "public"."user_preferences" to "anon";

grant references on table "public"."user_preferences" to "anon";

grant select on table "public"."user_preferences" to "anon";

grant trigger on table "public"."user_preferences" to "anon";

grant truncate on table "public"."user_preferences" to "anon";

grant update on table "public"."user_preferences" to "anon";

grant delete on table "public"."user_preferences" to "authenticated";

grant insert on table "public"."user_preferences" to "authenticated";

grant references on table "public"."user_preferences" to "authenticated";

grant select on table "public"."user_preferences" to "authenticated";

grant trigger on table "public"."user_preferences" to "authenticated";

grant truncate on table "public"."user_preferences" to "authenticated";

grant update on table "public"."user_preferences" to "authenticated";

grant delete on table "public"."user_preferences" to "service_role";

grant insert on table "public"."user_preferences" to "service_role";

grant references on table "public"."user_preferences" to "service_role";

grant select on table "public"."user_preferences" to "service_role";

grant trigger on table "public"."user_preferences" to "service_role";

grant truncate on table "public"."user_preferences" to "service_role";

grant update on table "public"."user_preferences" to "service_role";

grant delete on table "public"."workspaces" to "anon";

grant insert on table "public"."workspaces" to "anon";

grant references on table "public"."workspaces" to "anon";

grant select on table "public"."workspaces" to "anon";

grant trigger on table "public"."workspaces" to "anon";

grant truncate on table "public"."workspaces" to "anon";

grant update on table "public"."workspaces" to "anon";

grant delete on table "public"."workspaces" to "authenticated";

grant insert on table "public"."workspaces" to "authenticated";

grant references on table "public"."workspaces" to "authenticated";

grant select on table "public"."workspaces" to "authenticated";

grant trigger on table "public"."workspaces" to "authenticated";

grant truncate on table "public"."workspaces" to "authenticated";

grant update on table "public"."workspaces" to "authenticated";

grant delete on table "public"."workspaces" to "service_role";

grant insert on table "public"."workspaces" to "service_role";

grant references on table "public"."workspaces" to "service_role";

grant select on table "public"."workspaces" to "service_role";

grant trigger on table "public"."workspaces" to "service_role";

grant truncate on table "public"."workspaces" to "service_role";

grant update on table "public"."workspaces" to "service_role";

create policy "Users can insert their own report data"
on "public"."ahrefs_report_data"
as permissive
for insert
to public
with check ((EXISTS ( SELECT 1
   FROM ahrefs_reports
  WHERE ((ahrefs_reports.id = ahrefs_report_data.report_id) AND (ahrefs_reports.user_id = auth.uid())))));


create policy "Users can view their own report data"
on "public"."ahrefs_report_data"
as permissive
for select
to public
using ((EXISTS ( SELECT 1
   FROM ahrefs_reports
  WHERE ((ahrefs_reports.id = ahrefs_report_data.report_id) AND (ahrefs_reports.user_id = auth.uid())))));


create policy "Users can delete their own reports"
on "public"."ahrefs_reports"
as permissive
for delete
to public
using ((auth.uid() = user_id));


create policy "Users can insert their own reports"
on "public"."ahrefs_reports"
as permissive
for insert
to public
with check ((auth.uid() = user_id));


create policy "Users can update their own reports"
on "public"."ahrefs_reports"
as permissive
for update
to public
using ((auth.uid() = user_id));


create policy "Users can view their own reports"
on "public"."ahrefs_reports"
as permissive
for select
to public
using ((auth.uid() = user_id));


create policy "Allow admin read access to api_tracking"
on "public"."api_tracking"
as permissive
for select
to authenticated
using (((auth.jwt() ->> 'email'::text) = 'kevin@solvify.se'::text));


create policy "Allow insert access to api_tracking"
on "public"."api_tracking"
as permissive
for insert
to authenticated
with check (true);


create policy "Users can manage their own calendar events"
on "public"."calendar_events"
as permissive
for all
to public
using ((auth.uid() = user_id));


create policy "Users can manage their own events"
on "public"."calendar_events"
as permissive
for all
to public
using ((auth.uid() = user_id))
with check ((auth.uid() = user_id));


create policy "checklist_items_policy"
on "public"."checklist_items"
as permissive
for all
to public
using (true);


create policy "Enable insert access for authenticated users"
on "public"."currencies"
as permissive
for insert
to public
with check (true);


create policy "Enable read access for all users"
on "public"."currencies"
as permissive
for select
to public
using (true);


create policy "Enable update access for authenticated users"
on "public"."currencies"
as permissive
for update
to public
using (true);


create policy "Enable insert access for authenticated users"
on "public"."customers"
as permissive
for insert
to public
with check (true);


create policy "Enable read access for all users"
on "public"."customers"
as permissive
for select
to public
using (true);


create policy "Enable update access for authenticated users"
on "public"."customers"
as permissive
for update
to public
using (true);


create policy "Allow admin read access to event_tracking"
on "public"."event_tracking"
as permissive
for select
to authenticated
using (((auth.jwt() ->> 'email'::text) = 'kevin@solvify.se'::text));


create policy "Allow insert access to event_tracking"
on "public"."event_tracking"
as permissive
for insert
to authenticated
with check (true);


create policy "Users can manage their own integrations"
on "public"."integrations"
as permissive
for all
to public
using (true);


create policy "Anyone can see invitation with token"
on "public"."invitations"
as permissive
for select
to public
using (true);


create policy "No updates to invitations"
on "public"."invitations"
as permissive
for update
to public
with check (false);


create policy "Enable insert access for authenticated users"
on "public"."invoice_types"
as permissive
for insert
to public
with check (true);


create policy "Enable read access for all users"
on "public"."invoice_types"
as permissive
for select
to public
using (true);


create policy "Enable update access for authenticated users"
on "public"."invoice_types"
as permissive
for update
to public
using (true);


create policy "Enable insert access for authenticated users"
on "public"."invoices"
as permissive
for insert
to public
with check (true);


create policy "Enable read access for all users"
on "public"."invoices"
as permissive
for select
to public
using (true);


create policy "Enable update access for authenticated users"
on "public"."invoices"
as permissive
for update
to public
using (true);


create policy "Enable insert access for authenticated users"
on "public"."payment_methods"
as permissive
for insert
to public
with check (true);


create policy "Enable read access for all users"
on "public"."payment_methods"
as permissive
for select
to public
using (true);


create policy "Enable update access for authenticated users"
on "public"."payment_methods"
as permissive
for update
to public
using (true);


create policy "Allow public access to profiles"
on "public"."profiles"
as permissive
for all
to public
using (true)
with check (true);


create policy "Enable insert for profiles"
on "public"."profiles"
as permissive
for insert
to authenticated, anon
with check (true);


create policy "Profiles are viewable by everyone."
on "public"."profiles"
as permissive
for select
to public
using (true);


create policy "Users can update their own profile"
on "public"."profiles"
as permissive
for update
to authenticated
using ((auth.uid() = user_id));


create policy "Users can view their own profile"
on "public"."profiles"
as permissive
for select
to authenticated
using ((auth.uid() = user_id));


create policy "profiles_policy_select"
on "public"."profiles"
as permissive
for select
to public
using ((auth.uid() = user_id));


create policy "profiles_policy_update"
on "public"."profiles"
as permissive
for update
to public
using ((auth.uid() = user_id));


create policy "Users can insert their own project email settings"
on "public"."project_email_settings"
as permissive
for insert
to public
with check ((auth.uid() = user_id));


create policy "Users can update their own project email settings"
on "public"."project_email_settings"
as permissive
for update
to public
using ((auth.uid() = user_id))
with check ((auth.uid() = user_id));


create policy "Users can view their own project email settings"
on "public"."project_email_settings"
as permissive
for select
to public
using ((auth.uid() = user_id));


create policy "project_tasks_policy"
on "public"."project_tasks"
as permissive
for all
to public
using (true);


create policy "projects_policy"
on "public"."projects"
as permissive
for all
to public
using (true);


create policy "Enable all for authenticated users"
on "public"."recurring_invoices"
as permissive
for all
to authenticated
using ((auth.uid() IS NOT NULL))
with check ((auth.uid() IS NOT NULL));


create policy "Users can delete own settings"
on "public"."search_console_email_settings"
as permissive
for delete
to public
using ((auth.uid() = user_id));


create policy "Users can insert own settings"
on "public"."search_console_email_settings"
as permissive
for insert
to public
with check ((auth.uid() = user_id));


create policy "Users can read own settings"
on "public"."search_console_email_settings"
as permissive
for select
to public
using ((auth.uid() = user_id));


create policy "Users can update own settings"
on "public"."search_console_email_settings"
as permissive
for update
to public
using ((auth.uid() = user_id));


create policy "Users can manage their own settings"
on "public"."settings"
as permissive
for all
to public
using (((auth.uid())::text = user_id));


create policy "settings_policy_insert"
on "public"."settings"
as permissive
for insert
to public
with check ((auth.uid() = auth_user_id));


create policy "settings_policy_select"
on "public"."settings"
as permissive
for select
to public
using ((auth.uid() = auth_user_id));


create policy "settings_policy_update"
on "public"."settings"
as permissive
for update
to public
using ((auth.uid() = auth_user_id));


create policy "tasks_policy"
on "public"."tasks"
as permissive
for all
to public
using (true);


create policy "Allow team member creation"
on "public"."team_members"
as permissive
for insert
to authenticated
with check (true);


create policy "Enable insert for team_members"
on "public"."team_members"
as permissive
for insert
to authenticated, anon
with check (true);


create policy "Users can update their own team member record"
on "public"."team_members"
as permissive
for update
to authenticated
using ((user_id = auth.uid()));


create policy "Users can view their team"
on "public"."team_members"
as permissive
for select
to authenticated
using (true);


create policy "select_own_transactions"
on "public"."transactions"
as permissive
for select
to public
using ((user_id = auth.uid()));


create policy "Users can insert their own preferences"
on "public"."user_preferences"
as permissive
for insert
to authenticated, anon
with check (true);


create policy "Users can only access their own preferences"
on "public"."user_preferences"
as permissive
for all
to public
using (((auth.uid())::text = user_id));


create policy "Users can update their own preferences"
on "public"."user_preferences"
as permissive
for update
to authenticated
using (((auth.uid())::text = user_id));


create policy "Users can view their own preferences"
on "public"."user_preferences"
as permissive
for select
to authenticated
using (((auth.uid())::text = user_id));


create policy "Users can access their workspaces"
on "public"."workspaces"
as permissive
for all
to authenticated
using (true);


create policy "Users can insert their own profile."
on "public"."profiles"
as permissive
for insert
to public
with check (true);


create policy "Users can update own profile."
on "public"."profiles"
as permissive
for update
to public
using (true)
with check (true);


CREATE TRIGGER handle_ahrefs_reports_updated_at BEFORE UPDATE ON public.ahrefs_reports FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

CREATE TRIGGER update_checklist_items_updated_at BEFORE UPDATE ON public.checklist_items FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON public.customers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_invoices_updated_at BEFORE UPDATE ON public.invoices FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_project_cron_jobs_timestamp BEFORE UPDATE ON public.project_cron_jobs FOR EACH ROW EXECUTE FUNCTION update_project_cron_jobs_updated_at();

CREATE TRIGGER update_project_email_settings_timestamp BEFORE UPDATE ON public.project_email_settings FOR EACH ROW EXECUTE FUNCTION update_project_email_settings_updated_at();

CREATE TRIGGER update_project_settings_updated_at BEFORE UPDATE ON public.project_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_project_tasks_updated_at BEFORE UPDATE ON public.project_tasks FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON public.projects FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.recurring_invoices FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

CREATE TRIGGER update_tasks_updated_at BEFORE UPDATE ON public.tasks FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_transactions_updated_at BEFORE UPDATE ON public.transactions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER user_registration_trigger AFTER INSERT ON public.user_preferences FOR EACH ROW EXECUTE FUNCTION track_user_registration();


