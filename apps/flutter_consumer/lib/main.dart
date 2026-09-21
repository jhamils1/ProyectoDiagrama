import 'dart:convert';

import 'package:flutter/material.dart';

import 'generated_backend_client.dart';

void main() => runApp(const ModelaConsumerApp());

class ModelaConsumerApp extends StatelessWidget {
  const ModelaConsumerApp({super.key});

  @override
  Widget build(BuildContext context) => MaterialApp(
    title: 'Modela Consumer',
    debugShowCheckedModeBanner: false,
    theme: ThemeData(
      colorScheme: ColorScheme.fromSeed(seedColor: const Color(0xff7257d9)),
      useMaterial3: true,
    ),
    home: const CrudPage(),
  );
}

class CrudPage extends StatefulWidget {
  const CrudPage({super.key});

  @override
  State<CrudPage> createState() => _CrudPageState();
}

class _CrudPageState extends State<CrudPage> {
  final _backendUrl = TextEditingController(text: 'http://127.0.0.1:8081');
  final _resource = TextEditingController(text: 'clientes');
  final _id = TextEditingController(text: '1');
  final _json = TextEditingController(
    text: '{\n  "id": 1,\n  "nombre": "Ana"\n}',
  );
  bool _busy = false;
  String _result = 'Configura la URL y ejecuta una operación CRUD.';
  bool _isError = false;

  @override
  void dispose() {
    _backendUrl.dispose();
    _resource.dispose();
    _id.dispose();
    _json.dispose();
    super.dispose();
  }

  Object _requestBody() {
    final decoded = jsonDecode(_json.text);
    if (decoded is! Map<String, dynamic>) {
      throw const FormatException(
        'El cuerpo debe ser un objeto JSON, por ejemplo {"id": 1}.',
      );
    }
    return decoded;
  }

  Future<void> _run(
    Future<dynamic> Function(GeneratedBackendClient client) operation,
  ) async {
    setState(() {
      _busy = true;
      _isError = false;
    });
    try {
      final response = await operation(
        GeneratedBackendClient(_backendUrl.text),
      );
      if (!mounted) return;
      setState(() {
        _result = response == null
            ? 'Operación completada (sin contenido).'
            : const JsonEncoder.withIndent('  ').convert(response);
      });
    } on FormatException catch (error) {
      if (!mounted) return;
      setState(() {
        _isError = true;
        _result = error.message;
      });
    } on GeneratedBackendException catch (error) {
      if (!mounted) return;
      final prefix = error.statusCode == null ? '' : '${error.statusCode}: ';
      setState(() {
        _isError = true;
        _result = '$prefix${error.message}';
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _isError = true;
        _result = 'No se pudo completar la operación.';
      });
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Scaffold(
      appBar: AppBar(title: const Text('Modela · consumidor CRUD')),
      body: SafeArea(
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 760),
            child: ListView(
              padding: const EdgeInsets.all(20),
              children: [
                Text('Backend generado', style: theme.textTheme.headlineSmall),
                const SizedBox(height: 8),
                const Text(
                  'Cliente genérico para los endpoints REST que genera Modela. '
                  'Escribe el recurso usando la ruta plural generada, por ejemplo clientes o pedidos.',
                ),
                const SizedBox(height: 20),
                TextField(
                  controller: _backendUrl,
                  keyboardType: TextInputType.url,
                  decoration: const InputDecoration(
                    border: OutlineInputBorder(),
                    labelText: 'URL del backend',
                    helperText:
                        'Windows: http://127.0.0.1:8081 · Emulador Android: http://10.0.2.2:8081',
                  ),
                ),
                const SizedBox(height: 12),
                LayoutBuilder(
                  builder: (context, constraints) {
                    final narrow = constraints.maxWidth < 520;
                    final resourceField = TextField(
                      controller: _resource,
                      decoration: const InputDecoration(
                        border: OutlineInputBorder(),
                        labelText: 'Recurso',
                        hintText: 'clientes',
                      ),
                    );
                    final idField = TextField(
                      controller: _id,
                      keyboardType: TextInputType.number,
                      decoration: const InputDecoration(
                        border: OutlineInputBorder(),
                        labelText: 'Identificador',
                      ),
                    );
                    if (narrow) {
                      return Column(
                        children: [
                          resourceField,
                          const SizedBox(height: 12),
                          idField,
                        ],
                      );
                    }
                    return Row(
                      children: [
                        Expanded(flex: 2, child: resourceField),
                        const SizedBox(width: 12),
                        Expanded(child: idField),
                      ],
                    );
                  },
                ),
                const SizedBox(height: 20),
                Text('Cuerpo JSON', style: theme.textTheme.titleMedium),
                const SizedBox(height: 8),
                TextField(
                  controller: _json,
                  minLines: 6,
                  maxLines: 10,
                  style: const TextStyle(fontFamily: 'monospace'),
                  decoration: const InputDecoration(
                    border: OutlineInputBorder(),
                    alignLabelWithHint: true,
                    labelText: 'Solicitud para crear o actualizar',
                  ),
                ),
                const SizedBox(height: 16),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: [
                    OutlinedButton.icon(
                      onPressed: _busy
                          ? null
                          : () => _run((client) => client.list(_resource.text)),
                      icon: const Icon(Icons.list),
                      label: const Text('Listar'),
                    ),
                    OutlinedButton.icon(
                      onPressed: _busy
                          ? null
                          : () => _run(
                              (client) => client.get(_resource.text, _id.text),
                            ),
                      icon: const Icon(Icons.search),
                      label: const Text('Buscar'),
                    ),
                    FilledButton.icon(
                      onPressed: _busy
                          ? null
                          : () => _run(
                              (client) =>
                                  client.create(_resource.text, _requestBody()),
                            ),
                      icon: const Icon(Icons.add),
                      label: const Text('Crear'),
                    ),
                    FilledButton.tonalIcon(
                      onPressed: _busy
                          ? null
                          : () => _run(
                              (client) => client.update(
                                _resource.text,
                                _id.text,
                                _requestBody(),
                              ),
                            ),
                      icon: const Icon(Icons.save),
                      label: const Text('Actualizar'),
                    ),
                    OutlinedButton.icon(
                      onPressed: _busy
                          ? null
                          : () => _run(
                              (client) =>
                                  client.delete(_resource.text, _id.text),
                            ),
                      icon: const Icon(Icons.delete_outline),
                      label: const Text('Eliminar'),
                    ),
                  ],
                ),
                const SizedBox(height: 24),
                Text('Respuesta', style: theme.textTheme.titleMedium),
                const SizedBox(height: 8),
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: _isError
                        ? theme.colorScheme.errorContainer
                        : theme.colorScheme.surfaceContainerHighest,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: SelectionArea(
                    child: Text(
                      _busy ? 'Consultando backend…' : _result,
                      style: TextStyle(
                        fontFamily: 'monospace',
                        color: _isError
                            ? theme.colorScheme.onErrorContainer
                            : null,
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
