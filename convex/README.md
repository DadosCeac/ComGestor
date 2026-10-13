# Convex setup

1. Install Node.js 20 or newer and run `npm install`.
2. In the Clerk Dashboard, enable the **Convex integration** for the Development instance of this Clerk application. The integration adds the `aud: "convex"` claim to the Clerk session token; the frontend sends that session token to Convex (it does not request a JWT template). `convex/auth.config.ts` must trust the Frontend API URL shown for this same instance.

   ```json
   {
     "email": "{{user.primary_email_address}}",
     "email_verified": "{{user.email_verified}}"
   }
   ```

   Add these claims under Clerk's **Sessions → Customize session token** settings if they are not already present. Keep the `email_verified` value as a JSON boolean (`true` or `false`), not a quoted string; the Convex integration manages the `aud` claim.
3. Run `npm run convex:dev` once to link this project to the `compassionate-platypus-707` deployment. Publish the backend before testing login; the login flow requires the public query `usuarios:minhaSessao`. Load the initial organization data with `npm run convex:seed`; on an existing deployment, the seed adds missing authorized users without changing existing profiles.
4. Add the deployment's production deploy key as the GitHub repository secret `CONVEX_DEPLOY_KEY`. The Convex workflow runs tests for pull requests and deploys the backend and idempotent seed on pushes to `main`.
5. Serve the static site over HTTPS from its existing Pages deployment. The frontend sends Clerk JWTs directly to the Convex URL configured in `comgestor-client.js`.

The first seed must be run against an empty deployment. Later runs are idempotent and only add missing authorized users; they do not overwrite existing records or profile assignments.
