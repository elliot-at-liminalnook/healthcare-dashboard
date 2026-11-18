# How the patient list keeps its state and caches results

The patient list's page, page size, search, status filter and sort are all kept in the URL. The same values are used as the TanStack Query cache key, so every view of the list you visit has its own cached result.

```
URL  /patients?status=critical&page=2
       │  usePatientListState() reads it and checks every value
       ▼
{ page: 2, pageSize: 20, status: 'critical', sortBy: 'name', sortOrder: 'asc', search: '' }
       │  passed to the generated useListPatients(params)
       ▼
Query key  ['/patients', { page: 2, page_size: 20, status: 'critical', ... }]
       │
       ├─ In the cache: shown at once, and refreshed in the background
       └─ Not in the cache: the previous rows stay on screen, dimmed, until it arrives
```

Because of this:

- A reload, a bookmark or a shared link opens the same view.
- Back from a patient's page returns to the list as you left it.
- Going back to a page you've already seen is instant.
- The app has no global store for any of this.

## The URL holds the state

[`usePatientListState.ts`](../frontend/src/features/patients/usePatientListState.ts) is the only code that reads or writes the list's query string.

### Reading

The query string is turned into a typed `PatientListState`, and every value is checked:

| URL parameter | Field | Accepted | Default |
|---|---|---|---|
| `page` | `page` | a whole number of 1 or more | `1` |
| `size` | `pageSize` | `10`, `20` or `50` | `20` |
| `search` | `search` | any text | `''` |
| `status` | `status` | a `PatientStatus` value | none (all patients) |
| `sort` | `sortBy` | a `PatientSort` value | `name` |
| `order` | `sortOrder` | `asc` or `desc` | `asc` |

Any value that is missing or not allowed falls back to its default, so a hand-edited URL like `?status=sleeping&page=-3` still shows a working list. The allowed statuses and sorts come from the enums generated from the API, so they always match what the backend accepts.

### Writing

There's no `useState` for these values. Changing one calls `update()`, which writes a new query string with `setParams`. Three rules apply:

- **Any change other than the page goes back to page 1.** Otherwise filtering while on page 7 could leave you on a page with no rows.
- **Only values that differ from the default are written.** The unfiltered list is plain `/patients`.
- **The current history entry is replaced** (`{ replace: true }`), not added to. Changing filters doesn't fill the Back button with every intermediate step. Back from a patient's page goes straight to the list as you left it.

### Search waits for a pause in typing

The search box is the one control with local state of its own ([`PatientListPage.tsx`](../frontend/src/features/patients/PatientListPage.tsx)). The box updates on every keystroke. The URL is only updated after 300 ms without typing (`useDebouncedCallback`), so one request is sent per pause, not one per letter.

## The URL values become the cache key

`PatientListPage` passes the state to `useListPatients`, the hook [Orval](../frontend/orval.config.ts) generates for `GET /patients`. Its query key is the path followed by the parameters:

```ts
getListPatientsQueryKey = (params) => ['/patients', params]
```

TanStack Query compares keys by their contents, so the same parameters always find the same cache entry, whatever order they're in.

- **Each view is cached separately.** Go from page 1 to page 2 and back, and page 1 appears at once from the cache. TanStack Query then refetches it in the background, because the app keeps the default settings: cached data counts as stale straight away, and unused entries are kept for 5 minutes.
- **Empty filters are left out of the key.** The page passes `search || undefined` and `status ?? undefined`. An empty search and no search therefore share one cache entry, and the request doesn't include `?search=`.
- **The dashboard's counts are cached the same way.** Each tile calls `useListPatients({ page_size: 1, status })`, giving it its own key.

## Moving between views

The list uses `placeholderData: keepPreviousData`. When the key changes to one that isn't cached yet, TanStack Query keeps returning the previous key's rows and sets `isPlaceholderData` to `true`. The page passes that to the table as `isStale`, and the `.stale` class in [`PatientTable.module.css`](../frontend/src/features/patients/PatientTable.module.css) dims the rows. They stay in place, dimmed, until the new rows arrive, so the table never goes blank.

## Clearing the cache after a change

Every list key starts with `'/patients'`. Calling `getListPatientsQueryKey()` with no parameters gives `['/patients']`, and TanStack Query matches keys by prefix, so invalidating it marks **every** cached list view as stale. That covers every page, filter, sort and dashboard count.

This happens after each change to a patient:

- creating one: [`PatientCreatePage.tsx`](../frontend/src/features/patients/PatientCreatePage.tsx)
- editing one: [`PatientEditPage.tsx`](../frontend/src/features/patients/PatientEditPage.tsx)
- deleting one: [`DeletePatientButton.tsx`](../frontend/src/features/patients/DeletePatientButton.tsx)

The view on screen refetches at once. The others refetch the next time they're shown.

A single patient's key is `` [`/patients/${id}`] ``, one string, so it doesn't start with `'/patients'` as a separate element and the prefix doesn't match it. Each page invalidates the other keys it affects by name. For example, editing a patient also invalidates that patient's summary, and adding a note invalidates that patient's notes and summary.

## Adding a new control to the list

To add another filter, for example by blood type:

1. Make sure the API accepts it as a query parameter on `GET /patients`, then run `make client`. `ListPatientsParams` will then include it.
2. In `usePatientListState.ts`, add it to `PatientListState`, read and check it from the URL, and add it to the `entries` list in `update()` with its default.
3. In `PatientListPage.tsx`, pass it to `useListPatients` (as `undefined` when it isn't set), and add the control that calls `update()`.

The URL, the cache key, Back, sharing and invalidation all work for the new filter without any other changes.
