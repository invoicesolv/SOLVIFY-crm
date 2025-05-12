CRM System

┌────────────────────┐              ┌───────────────────┐             ┌────────────────────┐
│                    │              │                   │             │                    │
│  Local CRM System  │◄─────────────┤  Integration API  ├────────────►│  Fortnox System    │
│  (Tasks, Projects) │  Sync Data   │   (API Endpoints) │  API Calls  │(Invoices, Projects)│
│                    │              │                   │             │                    │
└──────┬─────────────┘              └───────────────────┘             └────────────────────┘
       │                                     ▲
       │                                     │
       │                                     │
       │                                     │
       ▼                                     │
┌────────────────────┐              ┌───────────────────┐
│                    │              │                   │
│  Database Tables   │◄─────────────┤  User Interface   │
│  (Junction Tables) │  CRUD Ops    │ (Link Components) │
│                    │              │                   │
└────────────────────┘              └───────────────────┘