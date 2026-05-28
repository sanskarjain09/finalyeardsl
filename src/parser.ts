import { load } from "cheerio";
import { ApiDef, AppAst, DatabaseConfig, QueryDef, StateDef } from "./types";

function getRequiredAttribute(tag: string, value: string | undefined): string {
  if (!value || !value.trim()) {
    throw new Error(`Missing required attribute on <${tag}>`);
  }
  return value.trim();
}

function splitSqlStatements(schemaText: string): string[] {
  return schemaText
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function parseDsl(source: string): AppAst {
  const $ = load(source, {
    xml: {
      xmlMode: true,
      decodeEntities: true,
    },
  });

  const app = $("app").first();
  if (!app.length) {
    throw new Error("No <app> root found in DSL file.");
  }

  const name = app.attr("name")?.trim() || "Hyper App";

  const dbTag = app.children("database").first().length ? app.children("database").first() : app.children("db").first();
  let database: DatabaseConfig | undefined;
  if (dbTag.length) {
    const typeRaw = dbTag.attr("type")?.trim() || "sqlite";
    if (typeRaw !== "sqlite") {
      throw new Error(`Unsupported database type: ${typeRaw}. Currently only sqlite is supported.`);
    }
    const file = dbTag.attr("file")?.trim() || "./app.db";
    database = {
      type: "sqlite",
      file,
    };
  }

  const schemaText = app.children("schema").first().text().trim();
  const schemaStatements = schemaText ? splitSqlStatements(schemaText) : [];

  const queries: QueryDef[] = [];
  app.find("query").each((_, element) => {
    const node = $(element);
    const id = getRequiredAttribute("query", node.attr("id") || node.attr("name"));
    const sql = node.text().trim();
    if (!sql) {
      throw new Error(`<query id=\"${id}\"> must contain SQL.`);
    }
    queries.push({ id, sql });
  });

  const apis: ApiDef[] = [];
  app.find("api").each((_, element) => {
    const node = $(element);
    const route = getRequiredAttribute("api", node.attr("route"));
    const method = (node.attr("method") || "GET").toUpperCase().trim();
    const code = node.text().trim();
    if (!code) {
      throw new Error(`<api route=\"${route}\"> must contain handler code.`);
    }
    apis.push({ route, method, code });
  });

  const states: StateDef[] = [];
  app.find("state").each((_, element) => {
    const node = $(element);
    const nameAttr = getRequiredAttribute("state", node.attr("name"));
    const value = node.attr("value")?.trim() || "";
    states.push({ name: nameAttr, value });
  });

  const ui = app.children("ui").first().length ? app.children("ui").first() : app.children("client").first();
  let uiTemplate = ui.length ? (ui.html() || "").trim() : "";

  if (!uiTemplate) {
    const nonUiTags = new Set([
      "database",
      "db",
      "schema",
      "query",
      "api",
      "state",
      "server",
      "client",
      "config",
      "route",
      "model",
      "field",
      "middleware",
      "response",
    ]);

    const chunks: string[] = [];
    app.contents().each((_, node) => {
      const tagName = (node as { tagName?: string }).tagName;
      if (tagName && nonUiTags.has(tagName)) {
        return;
      }
      const html = $.html(node).trim();
      if (html) {
        chunks.push(html);
      }
    });
    uiTemplate = chunks.join("\n");
  }

  if (!uiTemplate) {
    throw new Error("<ui> block is required and cannot be empty.");
  }

  return {
    name,
    database,
    schemaStatements,
    queries,
    apis,
    states,
    uiTemplate,
  };
}
