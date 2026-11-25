// AdminJS packages ship no types, so declare only the surface this app uses.

declare module "adminjs" {
  interface AdminJSOptions {
    rootPath?: string;
    databases?: unknown[];
  }

  export default class AdminJS {
    static registerAdapter(adapter: { Database: unknown; Resource: unknown }): void;
    constructor(options?: AdminJSOptions);
    options: { rootPath: string };
    resources: unknown[];
  }
}

declare module "@adminjs/express" {
  import type { Router } from "express";

  interface AuthenticatedRouterOptions {
    authenticate: (email: string, password: string) => Promise<{ email: string } | null>;
    cookieName: string;
    cookiePassword?: string;
  }

  const AdminJSExpress: {
    buildAuthenticatedRouter(
      admin: { options: { rootPath: string } },
      options: AuthenticatedRouterOptions
    ): Router;
  };

  export default AdminJSExpress;
}

declare module "@adminjs/sql" {
  export const Database: unknown;
  export const Resource: unknown;

  export class Adapter {
    constructor(
      dialect: "postgresql",
      options: { connectionString: string; database: string }
    );
    init(): Promise<{ dialect: string }>;
  }
}
