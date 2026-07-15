# Development

## Watching changes

The following command watches for changes.

```sh
pnpm run dev
```

It builds JavaScript output that can be then in turn ran by MCP client.

If you want to continuously run the tests, then execute as well:

```sh
pnpm run test:watch
```

## MCP Inspector client

You can use [MCP Inspector](https://modelcontextprotocol.io/docs/tools/inspector) as MCP client to debug your MCP server.

Start:

```sh
pnpm run inspect
```

Every time you rebuild the MCP server script, you need to **Restart** the Inspector tool.
Every time you change the tool definition, you should **Clear** and then **List** the tool again.

If you want to debug the MCP server code, you need to configure the MCP server with **debugging** enabled:

| key | value |
| --- | --- |
| Command | node |
| Arguments | --inspect build/index.js |

Connect Chrome Debugger by opening `chrome://inspect`.

## Building

The build process is triggered by running:

```sh
pnpm run build
```

Verify the code quality with:

```sh
pnpm --filter drawio-mcp-server exec playwright install chromium
pnpm run test
```

The real-environment server tests require Playwright Chromium. `pnpm install`
does not download browsers automatically; install Chromium explicitly before
running the full test suite on a fresh machine.

Check also the code coverage with:

```sh
pnpm run test:coverage
```
