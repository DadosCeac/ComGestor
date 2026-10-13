# Convex setup

1. Install Node.js 20 or newer and run `npm install`.
2. In the Clerk Dashboard, activate the **Convex integration** for this Clerk application. The frontend requests a JWT template named `convex`, and `convex/auth.config.ts` trusts the Clerk Frontend API URL shown for this same application. If configuring the template manually, name it `convex` and use these claims:

   ```json
   {
     "aud": "convex",
     "email": "{{user.primary_email_address}}",
     "email_verified": "{{user.email_verified}}"
   }
   ```

   The `email_verified` claim must resolve to a JSON boolean `true` for verified accounts (not the string `"true"`). The `aud` value must be `convex`, matching the backend's `applicationID`.
3. Run `npm run convex:dev` once to link this project to the `compassionate-platypus-707` deployment. Publish the backend before testing login; the login flow requires the public query `usuarios:minhaSessao`. Load the initial organization data with `npm run convex:seed`; on an existing deployment, the seed adds missing authorized users without changing existing profiles.
4. Add the deployment's production deploy key as the GitHub repository secret `CONVEX_DEPLOY_KEY`. The Convex workflow runs tests for pull requests and deploys the backend and idempotent seed on pushes to `main`.
5. Serve the static site over HTTPS from its existing Pages deployment. The frontend sends Clerk JWTs directly to the Convex URL configured in `comgestor-client.js`.

The first seed must be run against an empty deployment. Later runs are idempotent and only add missing authorized users; they do not overwrite existing records or profile assignments.
