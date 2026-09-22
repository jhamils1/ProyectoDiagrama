import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:modela_consumer/uml/local_store.dart';
import 'package:modela_consumer/uml/model.dart';
import 'package:modela_consumer/uml/modela_api_client.dart';

void main() {
  test(
    'logs in and synchronizes an offline diagram with the Modela contract',
    () async {
      final server = await HttpServer.bind(InternetAddress.loopbackIPv4, 0);
      final requests = <String>[];
      final document = UmlDiagram.empty('Móvil');
      final subscription = server.listen((request) async {
        final body = await utf8.decoder.bind(request).join();
        requests.add(
          '${request.method} ${request.uri.path} ${request.headers.value(HttpHeaders.cookieHeader) ?? ''} $body',
        );
        request.response.headers.contentType = ContentType.json;
        switch ('${request.method} ${request.uri.path}') {
          case 'POST /api/auth/admin':
            expect(request.headers.value('x-csrf-token'), 'csrf-1');
            request.response.headers.add(
              HttpHeaders.setCookieHeader,
              'MODELA_SESSION=session-1; Path=/; HttpOnly',
            );
            request.response.write(
              jsonEncode({'id': 'user', 'nombre': 'Admin'}),
            );
          case 'GET /api/projects':
            request.response.write(
              jsonEncode({
                'items': [
                  {
                    'id': 'project-1',
                    'nombre': 'Proyecto móvil',
                    'permiso': 'EDICION',
                  },
                ],
              }),
            );
          case 'GET /api/auth/csrf':
            request.response.write(
              jsonEncode({'headerName': 'X-CSRF-TOKEN', 'token': 'csrf-1'}),
            );
          case 'POST /api/projects/project-1/diagrams':
            expect(
              request.headers.value(HttpHeaders.cookieHeader),
              contains('MODELA_SESSION=session-1'),
            );
            expect(request.headers.value('x-csrf-token'), 'csrf-1');
            final payload = jsonDecode(body) as Map<String, dynamic>;
            request.response.write(
              jsonEncode({
                'document': payload,
                'revision': 0,
                'versionActual': 1,
                'permiso': 'EDICION',
              }),
            );
          default:
            request.response.statusCode = HttpStatus.notFound;
            request.response.write(jsonEncode({'message': 'Ruta no esperada'}));
        }
        await request.response.close();
      });
      addTearDown(() async {
        await subscription.cancel();
        await server.close(force: true);
      });
      final client = ModelaApiClient(
        'http://${server.address.address}:${server.port}',
      );

      await client.login('admin@modela.local', 'no-se-guarda');
      final projects = await client.projects();
      final synced = await client.sync(
        LocalEditorState(diagram: document, projectId: projects.single.id),
      );

      expect(synced.state.pending, isFalse);
      expect(synced.state.remoteRevision, 0);
      expect(
        requests.map((item) => item.split(' ').take(2).join(' ')),
        containsAll([
          'POST /api/auth/admin',
          'GET /api/projects',
          'GET /api/auth/csrf',
          'POST /api/projects/project-1/diagrams',
        ]),
      );
    },
  );
}
