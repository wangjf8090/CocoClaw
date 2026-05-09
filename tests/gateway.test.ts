/**
 * Gateway Basic Tests
 */

import { WebSocket } from 'ws';
import { GatewayServer } from '../packages/gateway/src/index.js';
import assert from 'node:assert';
import { test, describe, after } from 'node:test';

describe('Gateway Server', () => {
  let server: GatewayServer;
  const TEST_PORT = 18790;

  test('should start and stop server', async () => {
    server = new GatewayServer({ port: TEST_PORT });
    await server.start();
    assert.equal(server.getStatus().started, true);
    assert.equal(server.getStatus().connectedClients, 0);
  });

  test('should accept WebSocket connection', async () => {
    return new Promise<void>((resolve) => {
      const ws = new WebSocket(`ws://127.0.0.1:${TEST_PORT}`);

      server.on('clientConnected', () => {
        assert.equal(server.getStatus().connectedClients, 1);
        ws.close();
        resolve();
      });
    });
  });

  test('should handle hello message', async () => {
    return new Promise<void>((resolve) => {
      const ws = new WebSocket(`ws://127.0.0.1:${TEST_PORT}`);

      ws.on('open', () => {
        ws.send(
          JSON.stringify({
            id: 'test-001',
            type: 'connect',
            timestamp: Date.now(),
            payload: {},
          })
        );
      });

      ws.on('message', (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'hello') {
          assert.equal(msg.payload.status, 'ok');
          assert.ok(msg.payload.sessionId);
          ws.close();
          resolve();
        }
      });
    });
  });

  test('should respond to heartbeat', async () => {
    return new Promise<void>((resolve) => {
      const ws = new WebSocket(`ws://127.0.0.1:${TEST_PORT}`);

      ws.on('open', () => {
        ws.send(
          JSON.stringify({
            id: 'test-002',
            type: 'heartbeat',
            timestamp: Date.now(),
            payload: {},
          })
        );
      });

      ws.on('message', (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'heartbeat') {
          assert.equal(msg.payload.status, 'alive');
          ws.close();
          resolve();
        }
      });
    });
  });

  after(async () => {
    await server.stop();
  });
});

console.log('Gateway tests ready! Run with: node --test dist/tests/gateway.test.js');
