# V14 Enterprise Architecture Manifesto

Welcome to the ZenC Ecosystem frontend project. To maintain a $10M+ SaaS-grade architecture over years of development, all contributors MUST adhere to the following strict guidelines.

## 1. The 10 Golden Rules of Execution
1. **Progressive Complexity Rollout:** We layer in complexity (SEO, Feature Flags, Rate-Limited Analytics queues) exactly when needed, not before.
2. **Strict Naming & Structure Conventions:** 
   - Files: `user.api.ts`, `user.service.ts`, `useUser.ts`, `UserCard.tsx`.
   - Folders: Feature-sliced (`feature-name/components/`, `hooks/`, `services/`).
3. **The 80/15/5 State Rule:** Do NOT abuse Zustand.
   - 80% Local State (Components)
   - 15% Server State (React Query via central `queryKeys.ts`)
   - 5% Global UI State (Zustand: Sidebar toggles, Theme).
4. **Early Error Logging:** Sentry/LogRocket initializations must catch API/UI traps immediately.
5. **Strict Bundle Size Control:** `const Chart = dynamic(() => import('./Chart'))`. Any heavy library MUST be lazy-loaded. 
6. **Max Component Size Limit:** If a `.tsx` file exceeds **300 lines**, strictly refactor and split it.
7. **UX Consistency > UI Beauty:** A predictable dashboard is a fast dashboard. Use the exact same button placements, card paddings (`20px`), and skeleton patterns globally.
8. **Real SEO Content Strategy:** Public paths only. `/blog`, `/guides`, `/lessons`.
9. **Graceful Voice Degradation:** The AI Voice module is highly volatile. If the mic is blocked, websocket drops, or encoding fails, it MUST instantly degrade to a text-chat fallback.
10. **Docs as Code:** If you build a core pattern, document it here.

## 2. API Layer & Isolation
- Code MUST flow: `Component` -> `Hook` -> `Service` -> `API`. A component calling `axios.get` directly for complex data is a fireable offense. Simple, isolated fetch arrays (like `/health`) are permitted in hooks.
- **Layered Error Boundaries:** `AppErrorBoundary` -> `LayoutErrorBoundary` -> `FeatureErrorBoundary`. A crashing widget should never crash the page.

If you don't know, ask. Don't break the architecture.
