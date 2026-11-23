#!/usr/bin/env node
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createMcpServer } from './mcp.js';

const server = createMcpServer();
await server.connect(new StdioServerTransport());
process.stderr.write('[pinterest] MCP server ready on stdio\n');
