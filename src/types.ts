export type DatabaseType = "sqlite";

export interface DatabaseConfig {
  type: DatabaseType;
  file: string;
}

export interface QueryDef {
  id: string;
  sql: string;
}

export interface ApiDef {
  route: string;
  method: string;
  code: string;
}

export interface StateDef {
  name: string;
  value: string;
}

export interface AppAst {
  name: string;
  database?: DatabaseConfig;
  schemaStatements: string[];
  queries: QueryDef[];
  apis: ApiDef[];
  states: StateDef[];
  uiTemplate: string;
}
