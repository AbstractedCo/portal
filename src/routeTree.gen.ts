/* prettier-ignore-start */

/* eslint-disable */

// @ts-nocheck

// noinspection JSUnusedGlobalSymbols

// This file is auto-generated by TanStack Router

import { createFileRoute } from '@tanstack/react-router'

// Import Routes

import { Route as rootRoute } from './routes/__root'
import { Route as StakingImport } from './routes/staking'
import { Route as ProfileImport } from './routes/profile'
import { Route as GovernanceImport } from './routes/governance'
import { Route as IndexImport } from './routes/index'
import { Route as DaosIndexImport } from './routes/daos/index'
import { Route as DaosLayoutImport } from './routes/daos/_layout'
import { Route as DaosLayoutTransactionsImport } from './routes/daos/_layout/transactions'
import { Route as DaosLayoutSettingsImport } from './routes/daos/_layout/settings'
import { Route as DaosLayoutMembersImport } from './routes/daos/_layout/members'
import { Route as DaosLayoutAssetsImport } from './routes/daos/_layout/assets'

// Create Virtual Routes

const DaosImport = createFileRoute('/daos')()

// Create/Update Routes

const DaosRoute = DaosImport.update({
  path: '/daos',
  getParentRoute: () => rootRoute,
} as any)

const StakingRoute = StakingImport.update({
  path: '/staking',
  getParentRoute: () => rootRoute,
} as any)

const ProfileRoute = ProfileImport.update({
  path: '/profile',
  getParentRoute: () => rootRoute,
} as any)

const GovernanceRoute = GovernanceImport.update({
  path: '/governance',
  getParentRoute: () => rootRoute,
} as any)

const IndexRoute = IndexImport.update({
  path: '/',
  getParentRoute: () => rootRoute,
} as any)

const DaosIndexRoute = DaosIndexImport.update({
  path: '/',
  getParentRoute: () => DaosRoute,
} as any)

const DaosLayoutRoute = DaosLayoutImport.update({
  id: '/_layout',
  getParentRoute: () => DaosRoute,
} as any)

const DaosLayoutTransactionsRoute = DaosLayoutTransactionsImport.update({
  path: '/transactions',
  getParentRoute: () => DaosLayoutRoute,
} as any)

const DaosLayoutSettingsRoute = DaosLayoutSettingsImport.update({
  path: '/settings',
  getParentRoute: () => DaosLayoutRoute,
} as any)

const DaosLayoutMembersRoute = DaosLayoutMembersImport.update({
  path: '/members',
  getParentRoute: () => DaosLayoutRoute,
} as any)

const DaosLayoutAssetsRoute = DaosLayoutAssetsImport.update({
  path: '/assets',
  getParentRoute: () => DaosLayoutRoute,
} as any)

// Populate the FileRoutesByPath interface

declare module '@tanstack/react-router' {
  interface FileRoutesByPath {
    '/': {
      id: '/'
      path: '/'
      fullPath: '/'
      preLoaderRoute: typeof IndexImport
      parentRoute: typeof rootRoute
    }
    '/governance': {
      id: '/governance'
      path: '/governance'
      fullPath: '/governance'
      preLoaderRoute: typeof GovernanceImport
      parentRoute: typeof rootRoute
    }
    '/profile': {
      id: '/profile'
      path: '/profile'
      fullPath: '/profile'
      preLoaderRoute: typeof ProfileImport
      parentRoute: typeof rootRoute
    }
    '/staking': {
      id: '/staking'
      path: '/staking'
      fullPath: '/staking'
      preLoaderRoute: typeof StakingImport
      parentRoute: typeof rootRoute
    }
    '/daos': {
      id: '/daos'
      path: '/daos'
      fullPath: '/daos'
      preLoaderRoute: typeof DaosImport
      parentRoute: typeof rootRoute
    }
    '/daos/_layout': {
      id: '/daos/_layout'
      path: '/daos'
      fullPath: '/daos'
      preLoaderRoute: typeof DaosLayoutImport
      parentRoute: typeof DaosRoute
    }
    '/daos/': {
      id: '/daos/'
      path: '/'
      fullPath: '/daos/'
      preLoaderRoute: typeof DaosIndexImport
      parentRoute: typeof DaosImport
    }
    '/daos/_layout/assets': {
      id: '/daos/_layout/assets'
      path: '/assets'
      fullPath: '/daos/assets'
      preLoaderRoute: typeof DaosLayoutAssetsImport
      parentRoute: typeof DaosLayoutImport
    }
    '/daos/_layout/members': {
      id: '/daos/_layout/members'
      path: '/members'
      fullPath: '/daos/members'
      preLoaderRoute: typeof DaosLayoutMembersImport
      parentRoute: typeof DaosLayoutImport
    }
    '/daos/_layout/settings': {
      id: '/daos/_layout/settings'
      path: '/settings'
      fullPath: '/daos/settings'
      preLoaderRoute: typeof DaosLayoutSettingsImport
      parentRoute: typeof DaosLayoutImport
    }
    '/daos/_layout/transactions': {
      id: '/daos/_layout/transactions'
      path: '/transactions'
      fullPath: '/daos/transactions'
      preLoaderRoute: typeof DaosLayoutTransactionsImport
      parentRoute: typeof DaosLayoutImport
    }
  }
}

// Create and export the route tree

interface DaosLayoutRouteChildren {
  DaosLayoutAssetsRoute: typeof DaosLayoutAssetsRoute
  DaosLayoutMembersRoute: typeof DaosLayoutMembersRoute
  DaosLayoutSettingsRoute: typeof DaosLayoutSettingsRoute
  DaosLayoutTransactionsRoute: typeof DaosLayoutTransactionsRoute
}

const DaosLayoutRouteChildren: DaosLayoutRouteChildren = {
  DaosLayoutAssetsRoute: DaosLayoutAssetsRoute,
  DaosLayoutMembersRoute: DaosLayoutMembersRoute,
  DaosLayoutSettingsRoute: DaosLayoutSettingsRoute,
  DaosLayoutTransactionsRoute: DaosLayoutTransactionsRoute,
}

const DaosLayoutRouteWithChildren = DaosLayoutRoute._addFileChildren(
  DaosLayoutRouteChildren,
)

interface DaosRouteChildren {
  DaosLayoutRoute: typeof DaosLayoutRouteWithChildren
  DaosIndexRoute: typeof DaosIndexRoute
}

const DaosRouteChildren: DaosRouteChildren = {
  DaosLayoutRoute: DaosLayoutRouteWithChildren,
  DaosIndexRoute: DaosIndexRoute,
}

const DaosRouteWithChildren = DaosRoute._addFileChildren(DaosRouteChildren)

export interface FileRoutesByFullPath {
  '/': typeof IndexRoute
  '/governance': typeof GovernanceRoute
  '/profile': typeof ProfileRoute
  '/staking': typeof StakingRoute
  '/daos': typeof DaosLayoutRouteWithChildren
  '/daos/': typeof DaosIndexRoute
  '/daos/assets': typeof DaosLayoutAssetsRoute
  '/daos/members': typeof DaosLayoutMembersRoute
  '/daos/settings': typeof DaosLayoutSettingsRoute
  '/daos/transactions': typeof DaosLayoutTransactionsRoute
}

export interface FileRoutesByTo {
  '/': typeof IndexRoute
  '/governance': typeof GovernanceRoute
  '/profile': typeof ProfileRoute
  '/staking': typeof StakingRoute
  '/daos': typeof DaosIndexRoute
  '/daos/assets': typeof DaosLayoutAssetsRoute
  '/daos/members': typeof DaosLayoutMembersRoute
  '/daos/settings': typeof DaosLayoutSettingsRoute
  '/daos/transactions': typeof DaosLayoutTransactionsRoute
}

export interface FileRoutesById {
  __root__: typeof rootRoute
  '/': typeof IndexRoute
  '/governance': typeof GovernanceRoute
  '/profile': typeof ProfileRoute
  '/staking': typeof StakingRoute
  '/daos': typeof DaosRouteWithChildren
  '/daos/_layout': typeof DaosLayoutRouteWithChildren
  '/daos/': typeof DaosIndexRoute
  '/daos/_layout/assets': typeof DaosLayoutAssetsRoute
  '/daos/_layout/members': typeof DaosLayoutMembersRoute
  '/daos/_layout/settings': typeof DaosLayoutSettingsRoute
  '/daos/_layout/transactions': typeof DaosLayoutTransactionsRoute
}

export interface FileRouteTypes {
  fileRoutesByFullPath: FileRoutesByFullPath
  fullPaths:
    | '/'
    | '/governance'
    | '/profile'
    | '/staking'
    | '/daos'
    | '/daos/'
    | '/daos/assets'
    | '/daos/members'
    | '/daos/settings'
    | '/daos/transactions'
  fileRoutesByTo: FileRoutesByTo
  to:
    | '/'
    | '/governance'
    | '/profile'
    | '/staking'
    | '/daos'
    | '/daos/assets'
    | '/daos/members'
    | '/daos/settings'
    | '/daos/transactions'
  id:
    | '__root__'
    | '/'
    | '/governance'
    | '/profile'
    | '/staking'
    | '/daos'
    | '/daos/_layout'
    | '/daos/'
    | '/daos/_layout/assets'
    | '/daos/_layout/members'
    | '/daos/_layout/settings'
    | '/daos/_layout/transactions'
  fileRoutesById: FileRoutesById
}

export interface RootRouteChildren {
  IndexRoute: typeof IndexRoute
  GovernanceRoute: typeof GovernanceRoute
  ProfileRoute: typeof ProfileRoute
  StakingRoute: typeof StakingRoute
  DaosRoute: typeof DaosRouteWithChildren
}

const rootRouteChildren: RootRouteChildren = {
  IndexRoute: IndexRoute,
  GovernanceRoute: GovernanceRoute,
  ProfileRoute: ProfileRoute,
  StakingRoute: StakingRoute,
  DaosRoute: DaosRouteWithChildren,
}

export const routeTree = rootRoute
  ._addFileChildren(rootRouteChildren)
  ._addFileTypes<FileRouteTypes>()

/* prettier-ignore-end */

/* ROUTE_MANIFEST_START
{
  "routes": {
    "__root__": {
      "filePath": "__root.tsx",
      "children": [
        "/",
        "/governance",
        "/profile",
        "/staking",
        "/daos"
      ]
    },
    "/": {
      "filePath": "index.tsx"
    },
    "/governance": {
      "filePath": "governance.tsx"
    },
    "/profile": {
      "filePath": "profile.tsx"
    },
    "/staking": {
      "filePath": "staking.tsx"
    },
    "/daos": {
      "filePath": "daos",
      "children": [
        "/daos/_layout",
        "/daos/"
      ]
    },
    "/daos/_layout": {
      "filePath": "daos/_layout.tsx",
      "parent": "/daos",
      "children": [
        "/daos/_layout/assets",
        "/daos/_layout/members",
        "/daos/_layout/settings",
        "/daos/_layout/transactions"
      ]
    },
    "/daos/": {
      "filePath": "daos/index.tsx",
      "parent": "/daos"
    },
    "/daos/_layout/assets": {
      "filePath": "daos/_layout/assets.tsx",
      "parent": "/daos/_layout"
    },
    "/daos/_layout/members": {
      "filePath": "daos/_layout/members.tsx",
      "parent": "/daos/_layout"
    },
    "/daos/_layout/settings": {
      "filePath": "daos/_layout/settings.tsx",
      "parent": "/daos/_layout"
    },
    "/daos/_layout/transactions": {
      "filePath": "daos/_layout/transactions.tsx",
      "parent": "/daos/_layout"
    }
  }
}
ROUTE_MANIFEST_END */
