# Creative Studio Routing Notes

The Creative Studio pages have been added and need to be wired into the dashboard router and sidebar.

## New pages

- `src/pages/creative-studio.tsx`
- `src/pages/creative-studio-project.tsx`

## App routes to add

In `src/App.tsx`, add lazy imports:

```ts
const CreativeStudioPage = lazy(() => import("@/pages/creative-studio"));
const CreativeStudioProjectPage = lazy(() => import("@/pages/creative-studio-project"));
```

Add protected routes before the NotFound route:

```tsx
<Route path="/creative-studio/projects/:id">
  {() => <ProtectedRoute component={CreativeStudioProjectPage} />}
</Route>
<Route path="/creative-studio">
  {() => <ProtectedRoute component={CreativeStudioPage} />}
</Route>
```

## Sidebar link

In `src/components/layout.tsx`, add Creative Studio under the Education section:

```ts
{ href: "/creative-studio", label: "Creative Studio", icon: Palette, highlight: true }
```

Also import `Palette` from `lucide-react` if needed.

## Validation

- `/creative-studio` opens the landing page.
- `/creative-studio/projects/mccaster-issue-001` opens the project workspace.
- The sidebar shows Creative Studio under Education.
