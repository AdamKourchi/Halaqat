# /src/app/features

Each subdirectory here is a **self-contained feature module**.

## Structure of a feature

```
features/
└── memorization/                  ← feature name (kebab-case)
    ├── components/                ← dumb / presentational components
    │   └── progress-card/
    │       ├── progress-card.component.ts
    │       ├── progress-card.component.html
    │       └── progress-card.component.scss
    ├── pages/                     ← routed pages (smart components)
    │   └── memorization.page.ts
    │   └── memorization.page.html
    │   └── memorization.page.scss
    ├── memorization.routes.ts     ← lazy-loaded child routes
    └── index.ts                   ← barrel (optional)
```

## Rules
- Features import from `@core` or `@shared` — never from each other.
- Pages are lazy-loaded via `loadComponent` / `loadChildren` in `app.routes.ts`.
- No services or repositories here – those live in `@core`.
