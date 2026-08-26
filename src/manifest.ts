// Imported from the package root, not `@mavenagi/apps-core/manifest`: this repo's
// `moduleResolution: "node"` predates package `exports`, so the subpath fails TS2307. The root
// re-exports the identical symbol.
import { defineManifest } from '@mavenagi/apps-core';

/**
 * App manifest — the metadata and settings schema published to App Studio and the app
 * directory by `.github/workflows/publish-manifest.yml`.
 *
 * A publish sends the whole record; it does not merge. Anything the platform holds that is
 * not declared here is erased on the next push, and installs hold their values against the
 * `settingsSchema` keys — so those keys, types, descriptions and display names are
 * transcribed from the live `readme` record rather than rewritten.
 *
 * Only `readme` has a target. The repo also deploys `readme-develop`, whose settings schema
 * has drifted: it declares no `visibility` on `token`, where `readme` declares `HIDDEN`.
 * `settingsSchema` is root-level and shared by every target — `TargetConfig` cannot override
 * it — so one schema would have to publish to both records. Leaving `readme-develop` out of
 * `targets` means no push and no `--target` can publish to it from here, which keeps the
 * reconciliation a deliberate decision rather than a side effect of this migration.
 *
 * Root `metadata` and `whitelistedOrganizations` are deliberately absent: declaring them would
 * publish them, and an explicit empty allowlist is an access change wearing the clothes of a
 * formatting change. Omitting the keys leaves the live values untouched.
 *
 * `defineManifest` pins `schemaVersion` to the newest version apps-core knows and rejects
 * unknown keys at every level. It does not reach inside `settingsSchema`; that half is verified
 * by diffing the generated payload against the live record.
 */
export const manifest = defineManifest({
  schemaVersion: 3,

  organizationId: 'mavenagi-apps',
  targets: {
    // Holds the installs. The app directory entry resolves from this key. `visibility` is
    // required on every publishing target under v3 and is published as written — PUBLIC here
    // reproduces the live `readme` record.
    main: { appId: 'readme', branch: 'main', visibility: 'PUBLIC' },
  },

  name: 'ReadMe',
  shortDescription: 'Sync ReadMe documentation into Maven knowledge bases.',
  description: {
    long:
      'Syncs articles from a ReadMe project into a Maven knowledge base. The app reads the ' +
      "project's default branch, walks every guide category, and converts each document to " +
      'markdown so the agent can retrieve and cite it. API reference documents are rendered ' +
      'with their endpoint, method, path and body parameters and response codes, so reference ' +
      'pages retrieve as usefully as prose. Syncs run again whenever Maven requests a knowledge ' +
      'base refresh, so answers follow the documentation as it changes.',
    features: [
      {
        title: 'Guide sync',
        description:
          'Walks every guide category on the project default branch and creates a knowledge document for each article.',
      },
      {
        title: 'API reference conversion',
        description:
          'Renders endpoint, method, path and body parameters and response codes into markdown so reference pages are retrievable.',
      },
      {
        title: 'Language detection',
        description:
          'Detects the language of each article that does not declare one, so multilingual documentation is tagged correctly.',
      },
      {
        title: 'Scheduled refresh',
        description:
          'Re-syncs on every knowledge base refresh request, keeping the knowledge base current as the documentation changes.',
      },
    ],
  },

  categories: ['KNOWLEDGE'],

  installation: {
    prerequisites: [],
    steps: [
      {
        title: 'Create a ReadMe API token',
        description:
          'In ReadMe, open Configuration → API Keys and copy an API key with read access to your project.',
      },
      {
        title: 'Install the app',
        description:
          'Click Install above and provide the token. Maven verifies it against your ReadMe project before the install completes, then imports your guides.',
      },
    ],
  },

  settingsSchema: [
    {
      key: 'token',
      type: 'text',
      displayName: 'Token',
      description: 'Readme API token',
      // Sent as the bearer token on every ReadMe API call. Left undeclared this defaults to
      // VISIBLE, which returns the token in plaintext to anyone with read scope on the owning
      // org. The live `readme` record already declares HIDDEN; this reproduces it.
      visibility: 'HIDDEN',
    },
  ],
});
