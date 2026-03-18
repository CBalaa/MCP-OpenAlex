# OpenAlex MCP for Codex

一个可直接安装到 Codex 的本地 stdio MCP，封装 OpenAlex 官方 API。重点覆盖：

- 文献与其他实体的单条获取
- works / authors / sources / institutions / topics 等实体列表查询
- 引用某篇文献的 works 查询
- 某篇文献参考的 works 查询
- OpenAlex 原生 `filter` / `search` / `sort` / `group_by` / `select` / `sample` / `cursor`
- autocomplete
- changefiles
- rate-limit 状态
- `/text/topics` 这个仍在公开 API 中但已 deprecated 的 aboutness 接口
- 一个 `raw_request` 兜底工具，用来覆盖 OpenAlex 后续新增参数或路径

## Requirements

- Node.js 22+
- Codex 使用 `~/.codex/config.toml` 管理 MCP

## Install

```bash
npm install
npm run build
```

然后手动把下面这段加到 `~/.codex/config.toml`：

```toml
[mcp_servers.openalex]
command = "node"
args = ["/absolute/path/to/search_scholar/dist/src/index.js"]
env_vars = ["OPENALEX_API_KEY", "OPENALEX_EMAIL", "OPENALEX_BASE_URL", "OPENALEX_TIMEOUT_MS", "OPENALEX_MAX_RETRIES"]
cwd = "/absolute/path/to/search_scholar"
```

说明：

- 把 `/absolute/path/to/search_scholar` 换成你本地仓库的绝对路径。
- 如果 `node` 不在 Codex 启动环境的 `PATH` 里，把 `command = "node"` 改成 `which node` 查到的绝对路径。
- 这个仓库不再提供自动修改或备份 `~/.codex/config.toml` 的脚本。

**推荐**：你可以先打印一份当前机器可直接粘贴的配置片段，再手动复制，就不用粘贴上面的配置了：

```bash
npm run print:codex-config
```

环境变量通过 `env_vars` 透传给 MCP：

- `OPENALEX_API_KEY`
- `OPENALEX_EMAIL`
- `OPENALEX_BASE_URL`
- `OPENALEX_TIMEOUT_MS`
- `OPENALEX_MAX_RETRIES`

`OPENALEX_API_KEY` 强烈建议设置；`openalex_rate_limit_status` 则必须要它。因为这里使用的是 `env_vars`，你需要在启动 Codex 的同一个 shell 里先 `export` 它们。


## Remove

删除这个 MCP 的方式也是手动配置：

1. 打开 `~/.codex/config.toml`
2. 删除整个 `[mcp_servers.openalex]` 配置块
3. 重启 Codex

如果你当时是按本文档添加的，通常需要删除的是这几行：

```toml
[mcp_servers.openalex]
command = "node"
args = ["/absolute/path/to/search_scholar/dist/src/index.js"]
env_vars = ["OPENALEX_API_KEY", "OPENALEX_EMAIL", "OPENALEX_BASE_URL", "OPENALEX_TIMEOUT_MS", "OPENALEX_MAX_RETRIES"]
cwd = "/absolute/path/to/search_scholar"
```

删除后重新打开 Codex，`/mcp` 里就不应该再看到 `openalex`。



## Verify

```bash
npm test
npm run smoke
```

## MCP Tools

- `openalex_get_entity`
- `openalex_list_entities`
- `openalex_search_works`
- `openalex_get_citing_works`
- `openalex_get_referenced_works`
- `openalex_autocomplete`
- `openalex_rate_limit_status`
- `openalex_list_changefile_dates`
- `openalex_get_changefile`
- `openalex_classify_text`
- `openalex_raw_request`

## Notes

- OpenAlex 的 `filter` 支持直接传原始字符串，也支持结构化对象。
- `openalex_get_entity` 对 `work-types` / `licenses` 这类没有 singleton endpoint 的列表型资源，会自动回退成 `filter=id:<value>&per_page=1`。
- `openalex_classify_text` 对应官方 `/text/topics`，官方 OpenAPI 已标记 deprecated。
- `openalex_raw_request` 只支持 GET，请传绝对 API path，例如 `"/works"`。
