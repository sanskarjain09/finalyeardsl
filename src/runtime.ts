import fs from "node:fs";
import path from "node:path";

import bodyParser from "body-parser";
import Database from "better-sqlite3";
import express from "express";

import { parseDsl } from "./parser";
import { AppAst, QueryDef } from "./types";

type SqlDb = InstanceType<typeof Database>;

type QueryResult = Record<string, unknown>[];

type QueryRunner = (id: string, params?: Record<string, unknown>) => QueryResult;

function toInitialState(states: AppAst["states"]): Record<string, unknown> {
  const next: Record<string, unknown> = {};
  for (const state of states) {
    const raw = state.value;
    if (/^-?\d+(\.\d+)?$/.test(raw)) {
      next[state.name] = Number(raw);
      continue;
    }
    if (raw === "true" || raw === "false") {
      next[state.name] = raw === "true";
      continue;
    }
    next[state.name] = raw;
  }
  return next;
}

function bootstrapDatabase(ast: AppAst, dslDir: string): SqlDb {
  const dbPath = ast.database?.file || "./app.db";
  const resolvedPath = path.resolve(dslDir, dbPath);
  const db = new Database(resolvedPath);

  for (const statement of ast.schemaStatements) {
    db.exec(statement);
  }

  return db;
}

function createQueryRunner(db: SqlDb, queries: QueryDef[]): QueryRunner {
  const map = new Map(queries.map((query) => [query.id, query.sql]));

  return (id: string, params: Record<string, unknown> = {}): QueryResult => {
    const sql = map.get(id);
    if (!sql) {
      throw new Error(`Unknown query id: ${id}`);
    }

    const statement = db.prepare(sql);
    const rows = statement.all(params);
    return rows as QueryResult;
  };
}

function compileApiCode(code: string) {
  return new Function(
    "body",
    "params",
    "query",
    "state",
    "db",
    "runQuery",
    `"use strict";\n${code}`,
  ) as (
    body: unknown,
    params: unknown,
    query: unknown,
    state: Record<string, unknown>,
    db: SqlDb,
    runQuery: QueryRunner,
  ) => unknown;
}

function buildClientHtml(ast: AppAst): string {
  const stateJson = JSON.stringify(toInitialState(ast.states));
  const templateJson = JSON.stringify(ast.uiTemplate);
  const queryIdsJson = JSON.stringify(ast.queries.map((query) => query.id));

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${ast.name}</title>
    <style>
      :root {
        --bg: #f4f7fb;
        --surface: #ffffff;
        --text: #0f172a;
        --muted: #475569;
        --primary: #0369a1;
        --border: #dbe4f0;
      }

      * { box-sizing: border-box; }

      body {
        margin: 0;
        min-height: 100vh;
        font-family: "IBM Plex Sans", "Segoe UI", sans-serif;
        background:
          radial-gradient(circle at 10% 20%, rgba(2, 132, 199, 0.08), transparent 40%),
          radial-gradient(circle at 90% 10%, rgba(56, 189, 248, 0.12), transparent 42%),
          var(--bg);
        color: var(--text);
      }

      #app {
        max-width: 980px;
        margin: 32px auto;
        padding: 24px;
        background: var(--surface);
        border: 1px solid var(--border);
        border-radius: 16px;
        box-shadow: 0 16px 40px rgba(15, 23, 42, 0.08);
      }

      button {
        background: var(--primary);
        color: white;
        border: none;
        border-radius: 10px;
        padding: 10px 14px;
        font-weight: 600;
        cursor: pointer;
      }

      button:hover { filter: brightness(1.08); }

      input {
        border: 1px solid var(--border);
        border-radius: 10px;
        padding: 10px 12px;
      }
    </style>
  </head>
  <body>
    <div id="app"></div>
    <script>
      (function () {
        const initialState = ${stateJson};
        const uiTemplate = ${templateJson};
        const queryIds = ${queryIdsJson};

        const TAG_MAP = {
          text: "span",
          box: "div",
          row: "div",
          column: "div",
          image: "img",
          link: "a",
          card: "article",
        };

        let isRendering = false;
        let renderQueued = false;
        let queryLoadPromise = null;
        const queryCache = {};

        async function postApi(route, payload) {
          const response = await fetch(route, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(payload || {}),
          });
          return response.json();
        }

        function scheduleRender() {
          if (renderQueued) {
            return;
          }
          renderQueued = true;
          Promise.resolve().then(function () {
            renderQueued = false;
            void render();
          });
        }

        const state = new Proxy(Object.assign({}, initialState), {
          set(target, key, value) {
            target[key] = value;
            if (!isRendering) {
              scheduleRender();
            }
            return true;
          },
        });

        function createEvalContext(scope, event) {
          const local = scope || {};
          return new Proxy({}, {
            has() {
              return true;
            },
            get(_target, key) {
              if (key === Symbol.unscopables) {
                return undefined;
              }
              if (key === "event") {
                return event;
              }
              if (key === "$state") {
                return state;
              }
              if (key === "$queries") {
                return queryCache;
              }
              if (key === "$post") {
                return postApi;
              }
              if (typeof key === "string") {
                if (Object.prototype.hasOwnProperty.call(local, key)) {
                  return local[key];
                }
                if (Object.prototype.hasOwnProperty.call(queryCache, key)) {
                  return queryCache[key];
                }
                if (Object.prototype.hasOwnProperty.call(state, key)) {
                  return state[key];
                }
              }
              return globalThis[key];
            },
            set(_target, key, value) {
              if (typeof key !== "string") {
                return false;
              }
              if (Object.prototype.hasOwnProperty.call(local, key)) {
                local[key] = value;
                return true;
              }
              state[key] = value;
              return true;
            },
          });
        }

        function evaluateExpression(expression, scope, event) {
          const raw = String(expression || "").trim();
          if (!raw) {
            return undefined;
          }
          try {
            const fn = new Function("ctx", "event", "with (ctx) { return (" + raw + "); }");
            return fn(createEvalContext(scope, event), event);
          } catch (_error) {
            return undefined;
          }
        }

        function runStatement(statement, scope, event) {
          const raw = String(statement || "").trim();
          if (!raw) {
            return;
          }
          const fn = new Function("ctx", "event", "with (ctx) { " + raw + "; }");
          fn(createEvalContext(scope, event), event);
        }

        function interpolate(input, scope) {
          return String(input || "").replace(/{{\s*([^}]+?)\s*}}/g, function (_all, expr) {
            const value = evaluateExpression(expr, scope, undefined);
            return value == null ? "" : String(value);
          });
        }

        function parseEachExpression(source) {
          const raw = String(source || "").trim();
          const match = raw.match(/^([a-zA-Z_$][\w$]*)\s+in\s+(.+)$/);
          if (match) {
            return {
              alias: match[1],
              listExpression: match[2].trim(),
            };
          }
          return {
            alias: "item",
            listExpression: raw,
          };
        }

        function toList(value) {
          if (Array.isArray(value)) {
            return value;
          }
          return [];
        }

        function appendStyle(el, value) {
          if (!value) {
            return;
          }
          const current = el.getAttribute("style") || "";
          const suffix = current && !current.trim().endsWith(";") ? ";" : "";
          el.setAttribute("style", (current + suffix + value).trim());
        }

        function applyLayoutDefaults(el, tagName) {
          if (tagName === "row") {
            appendStyle(el, "display:flex;flex-direction:row;");
          }
          if (tagName === "column") {
            appendStyle(el, "display:flex;flex-direction:column;");
          }
          if (tagName === "card") {
            appendStyle(el, "display:block;padding:10px 12px;border:1px solid var(--border);border-radius:12px;margin-bottom:10px;color:var(--muted);");
          }
          if (tagName === "navbar") {
            appendStyle(el, "display:flex;align-items:center;justify-content:space-between;");
          }
        }

        function applyStyleAttributes(el, attrName, attrValue) {
          if (attrName === "bg") {
            appendStyle(el, "background:" + attrValue + ";");
            return true;
          }
          if (attrName === "color") {
            appendStyle(el, "color:" + attrValue + ";");
            return true;
          }
          if (attrName === "padding") {
            appendStyle(el, "padding:" + attrValue + ";");
            return true;
          }
          if (attrName === "margin") {
            appendStyle(el, "margin:" + attrValue + ";");
            return true;
          }
          if (attrName === "gap") {
            appendStyle(el, "gap:" + attrValue + ";");
            return true;
          }
          if (attrName === "center") {
            if (attrValue === "x") {
              appendStyle(el, "justify-content:center;");
              return true;
            }
            if (attrValue === "y") {
              appendStyle(el, "align-items:center;");
              return true;
            }
            if (attrValue === "xy" || attrValue === "both" || attrValue === "true") {
              appendStyle(el, "justify-content:center;align-items:center;");
              return true;
            }
          }
          return false;
        }

        function cloneScope(scope) {
          return Object.assign({}, scope || {});
        }

        function injectItemFields(scope, item) {
          if (!item || typeof item !== "object" || Array.isArray(item)) {
            return;
          }
          Object.keys(item).forEach(function (key) {
            if (!Object.prototype.hasOwnProperty.call(scope, key)) {
              scope[key] = item[key];
            }
          });
        }

        function renderNode(node, scope) {
          if (node.nodeType === Node.TEXT_NODE) {
            return document.createTextNode(interpolate(node.textContent || "", scope));
          }

          if (node.nodeType !== Node.ELEMENT_NODE) {
            return document.createTextNode("");
          }

          const sourceEl = node;
          const rawTagName = sourceEl.tagName.toLowerCase();

          if (rawTagName === "else") {
            return document.createDocumentFragment();
          }

          if (rawTagName === "if") {
            const conditionExpr = sourceEl.getAttribute("condition") || sourceEl.getAttribute("if") || "";
            const conditionOk = Boolean(evaluateExpression(conditionExpr, scope, undefined));
            const fragment = document.createDocumentFragment();
            const elseNode = Array.from(sourceEl.children).find(function (child) {
              return child.tagName.toLowerCase() === "else";
            });

            const sourceNodes = conditionOk
              ? Array.from(sourceEl.childNodes).filter(function (child) {
                  return !(child.nodeType === Node.ELEMENT_NODE && child.tagName.toLowerCase() === "else");
                })
              : elseNode
                ? Array.from(elseNode.childNodes)
                : [];

            sourceNodes.forEach(function (child) {
              fragment.appendChild(renderNode(child, cloneScope(scope)));
            });
            return fragment;
          }

          if (rawTagName === "for") {
            const parsed = parseEachExpression(sourceEl.getAttribute("each") || "");
            const list = toList(evaluateExpression(parsed.listExpression, scope, undefined));
            const fragment = document.createDocumentFragment();

            list.forEach(function (item, index) {
              const loopScope = cloneScope(scope);
              loopScope[parsed.alias] = item;
              loopScope.$index = index;
              injectItemFields(loopScope, item);

              Array.from(sourceEl.childNodes).forEach(function (child) {
                fragment.appendChild(renderNode(child, loopScope));
              });
            });

            return fragment;
          }

          const inlineIf = sourceEl.getAttribute("if");
          if (inlineIf && !Boolean(evaluateExpression(inlineIf, scope, undefined))) {
            return document.createDocumentFragment();
          }

          const inlineEach = sourceEl.getAttribute("each");
          if (inlineEach) {
            const parsed = parseEachExpression(inlineEach);
            const list = toList(evaluateExpression(parsed.listExpression, scope, undefined));
            const fragment = document.createDocumentFragment();

            list.forEach(function (item, index) {
              const loopScope = cloneScope(scope);
              loopScope[parsed.alias] = item;
              loopScope.$index = index;
              injectItemFields(loopScope, item);

              const clone = sourceEl.cloneNode(true);
              clone.removeAttribute("each");
              fragment.appendChild(renderNode(clone, loopScope));
            });

            return fragment;
          }

          const targetTagName = TAG_MAP[rawTagName] || rawTagName;
          const el = document.createElement(targetTagName);

          Array.from(sourceEl.attributes).forEach(function (attr) {
            const name = attr.name;
            const interpolatedValue = interpolate(attr.value, scope);

            if (name === "if" || name === "each" || name === "condition") {
              return;
            }

            if (name === "click") {
              el.addEventListener("click", function (event) {
                try {
                  runStatement(interpolatedValue, scope, event);
                } catch (error) {
                  console.error("click handler failed:", error);
                }
              });
              return;
            }

            if (name === "model") {
              const modelName = interpolatedValue.trim();
              if (targetTagName === "input") {
                const type = (sourceEl.getAttribute("type") || "text").toLowerCase();
                if (type === "checkbox") {
                  el.checked = Boolean(state[modelName]);
                  el.addEventListener("change", function (event) {
                    state[modelName] = Boolean(event.target.checked);
                  });
                } else {
                  const current = state[modelName];
                  el.value = current == null ? "" : String(current);
                  el.addEventListener("input", function (event) {
                    state[modelName] = event.target.value;
                  });
                }
              }
              return;
            }

            if (name === "class" || name === "style" || name === "id" || name === "value" || name === "name") {
              el.setAttribute(name, interpolatedValue);
              return;
            }

            if (applyStyleAttributes(el, name, interpolatedValue)) {
              return;
            }

            if (name === "src" || name === "href" || name === "width" || name === "height" || name === "type" || name.startsWith("data-")) {
              el.setAttribute(name, interpolatedValue);
              return;
            }

            if (name.startsWith("on:")) {
              const eventName = name.slice(3);
              el.addEventListener(eventName, function (event) {
                try {
                  runStatement(interpolatedValue, scope, event);
                } catch (error) {
                  console.error("event handler failed:", error);
                }
              });
              return;
            }

            el.setAttribute(name, interpolatedValue);
          });

          applyLayoutDefaults(el, rawTagName);

          Array.from(sourceEl.childNodes).forEach(function (child) {
            el.appendChild(renderNode(child, cloneScope(scope)));
          });

          return el;
        }

        async function ensureQueryCache() {
          if (queryLoadPromise) {
            await queryLoadPromise;
            return;
          }
          queryLoadPromise = Promise.all(queryIds.map(async function (queryId) {
            const response = await fetch("/__dsl/query/" + encodeURIComponent(queryId));
            const payload = await response.json();
            queryCache[queryId] = Array.isArray(payload.rows) ? payload.rows : [];
          })).finally(function () {
            queryLoadPromise = null;
          });
          await queryLoadPromise;
        }

        async function render() {
          if (isRendering) {
            scheduleRender();
            return;
          }

          isRendering = true;
          try {
            await ensureQueryCache();

            const mount = document.getElementById("app");
            const templateEl = document.createElement("template");
            templateEl.innerHTML = uiTemplate;

            const fragment = document.createDocumentFragment();
            Array.from(templateEl.content.childNodes).forEach(function (node) {
              fragment.appendChild(renderNode(node, {}));
            });

            mount.replaceChildren(fragment);
          } finally {
            isRendering = false;
          }
        }

        void render();
      })();
    </script>
  </body>
</html>`;
}

export async function startDslApp(filePath: string, port = 3000): Promise<void> {
  const absoluteFile = path.resolve(filePath);
  const source = fs.readFileSync(absoluteFile, "utf-8");
  const ast = parseDsl(source);
  const dslDir = path.dirname(absoluteFile);

  const db = bootstrapDatabase(ast, dslDir);
  const runQuery = createQueryRunner(db, ast.queries);
  const serverState = toInitialState(ast.states);

  const app = express();
  app.use(bodyParser.json());

  app.get("/", (_req, res) => {
    res.type("html").send(buildClientHtml(ast));
  });

  app.get("/__dsl/query/:id", (req, res) => {
    try {
      const rows = runQuery(req.params.id);
      res.json({ rows });
    } catch (error) {
      res.status(400).json({
        error: error instanceof Error ? error.message : "Unknown query error",
      });
    }
  });

  for (const api of ast.apis) {
    const method = api.method.toLowerCase();
    const compiled = compileApiCode(api.code);

    const register = (app as unknown as Record<string, any>)[method];
    if (typeof register !== "function") {
      throw new Error(`Unsupported HTTP method in DSL API: ${api.method}`);
    }

    register.call(app, api.route, (req: express.Request, res: express.Response) => {
      try {
        const output = compiled(req.body, req.params, req.query, serverState, db, runQuery);
        res.json({ ok: true, data: output });
      } catch (error) {
        res.status(500).json({
          ok: false,
          error: error instanceof Error ? error.message : "Unknown API runtime error",
        });
      }
    });
  }

  app.listen(port, () => {
    // eslint-disable-next-line no-console
    console.log(`HyperHTML prototype running at http://localhost:${port}`);
  });
}
