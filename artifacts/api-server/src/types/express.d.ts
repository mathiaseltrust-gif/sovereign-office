declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        name?: string;
        roles: string[];
        entraId?: string;
        dbId?: number;
        authMethod?: "microsoft" | "password" | "entra_jwt" | "dev";
      };
    }
  }
}

export {};
