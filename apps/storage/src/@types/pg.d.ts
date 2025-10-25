declare module "pg" {
  export interface FieldDef {
    name: string;
    tableID: number;
    columnID: number;
    dataTypeID: number;
    dataTypeSize: number;
    dataTypeModifier: number;
    format: string;
  }

  export interface QueryResult<T = any> {
    rows: T[];
    fields: FieldDef[];
  }

  export class Pool {
    constructor(config?: Record<string, unknown>);
    query<T = any>(text: string, params?: unknown[]): Promise<QueryResult<T>>;
    end(): Promise<void>;
  }
}

