# NOTE — this is NOT the active backend

As of the September 2026 launch, the BUKUR WORLD storefront runs against the
**Express + PostgreSQL** backend in **`../server/`**, not this Medusa install.

- The React storefront (`../src/`) calls the Express routes only.
- `../render.yaml` and `../DEPLOY.md` describe the **React + Express + PostgreSQL**
  production setup.
- Nothing in `../src/` imports from this folder, and it is not built or deployed
  as part of the storefront.

This directory is kept for reference:

- `src/api/store/custom/orders/route.ts` — order confirmation email via Resend,
  a pattern worth porting to the Express backend later.
- `src/subscribers/` — order/product event handlers.
- The Medusa product/variant model, if a full commerce engine is adopted in a
  later phase.

Do not delete this folder without a separate decision. Do not point the
storefront at it without updating `../src/config.js`, `../src/admin/apiClient.js`,
and every context in `../src/context/` to Medusa's API contract.
