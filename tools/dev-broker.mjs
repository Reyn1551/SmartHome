#!/usr/bin/env node
/**
 * Broker MQTT lokal untuk pengembangan: TCP 1883 dan WebSocket 9001.
 *
 * Hanya untuk jaringan lab/demo. Tanpa autentikasi dan tanpa TLS.
 * Setara dengan contoh docs/mosquitto.conf, tetapi tidak butuh Mosquitto
 * terpasang di mesin pengembang.
 *
 * Pemakaian:
 *   node tools/dev-broker.mjs
 */
import { createServer } from 'node:net';
import { createServer as createHttpServer } from 'node:http';
import { Aedes } from 'aedes';
import { WebSocketServer, createWebSocketStream } from 'ws';

const aedes = await Aedes.createBroker();

const tcp = createServer(aedes.handle);
tcp.listen(1883, '0.0.0.0', () => {
  console.log('MQTT TCP  : 1883');
});

const http = createHttpServer();
const wss = new WebSocketServer({ server: http });
wss.on('connection', (socket) => {
  aedes.handle(createWebSocketStream(socket));
});
http.listen(9001, '0.0.0.0', () => {
  console.log('MQTT WS   : 9001 (path /mqtt)');
});

function shutdown() {
  console.log('\nMenghentikan broker...');
  wss.close();
  http.close();
  tcp.close();
  aedes.close(() => process.exit(0));
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
