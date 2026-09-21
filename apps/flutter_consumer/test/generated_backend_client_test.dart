import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:modela_consumer/generated_backend_client.dart';

void main() {
  test('normalizes the generated backend URL and resource endpoint', () {
    final client = GeneratedBackendClient('http://127.0.0.1:8081/');

    expect(
      client.endpoint('clientes').toString(),
      'http://127.0.0.1:8081/clientes',
    );
    expect(
      client.endpoint('/clientes/', '5').toString(),
      'http://127.0.0.1:8081/clientes/5',
    );
  });

  test('rejects invalid backend URLs and resource names before a request', () {
    expect(
      () => GeneratedBackendClient.normalizeBaseUrl('localhost:8081'),
      throwsFormatException,
    );
    expect(
      () =>
          GeneratedBackendClient('http://127.0.0.1:8081').endpoint('../admin'),
      throwsFormatException,
    );
  });

  test('sends CRUD requests to the generated endpoint convention', () async {
    final server = await HttpServer.bind(InternetAddress.loopbackIPv4, 0);
    final requests = <String>[];
    final subscription = server.listen((request) async {
      final body = await utf8.decoder.bind(request).join();
      requests.add('${request.method} ${request.uri.path} $body');
      if (request.method == 'DELETE') {
        request.response.statusCode = HttpStatus.noContent;
      } else {
        request.response.headers.contentType = ContentType.json;
        request.response.write(jsonEncode({'ok': true}));
      }
      await request.response.close();
    });
    addTearDown(() async {
      await subscription.cancel();
      await server.close(force: true);
    });
    final client = GeneratedBackendClient(
      'http://${server.address.address}:${server.port}',
    );

    expect(await client.list('clientes'), {'ok': true});
    expect(await client.get('clientes', '1'), {'ok': true});
    expect(await client.create('clientes', {'id': 1}), {'ok': true});
    expect(await client.update('clientes', '1', {'id': 1}), {'ok': true});
    expect(await client.delete('clientes', '1'), isNull);
    expect(requests, [
      'GET /clientes ',
      'GET /clientes/1 ',
      'POST /clientes {"id":1}',
      'PUT /clientes/1 {"id":1}',
      'DELETE /clientes/1 ',
    ]);
  });
}
