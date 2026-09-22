import 'dart:async';

import 'package:flutter/material.dart';

import 'local_store.dart';
import 'local_assistant.dart';
import 'local_commands.dart';
import 'local_voice.dart';
import 'model.dart';
import 'modela_api_client.dart';
import 'session_store.dart';

class MobileEditorPage extends StatefulWidget {
  const MobileEditorPage({super.key});

  @override
  State<MobileEditorPage> createState() => _MobileEditorPageState();
}

class _MobileEditorPageState extends State<MobileEditorPage> {
  static const _defaultServerUrl = String.fromEnvironment(
    'MODELA_API_URL',
    defaultValue: 'http://127.0.0.1:8080',
  );

  final _store = LocalDiagramStore();
  final _sessionStore = LocalSessionStore();
  final _loginUrl = TextEditingController(text: _defaultServerUrl);
  final _loginEmail = TextEditingController();
  final _loginPassword = TextEditingController();
  LocalEditorState? _state;
  ModelaApiClient? _client;
  Timer? _syncTimer;
  bool _syncing = false;
  bool _loading = true;
  bool _loggingIn = false;
  bool _showServerSettings = false;
  String? _loginError;
  String? _notice;
  bool _noticeError = false;

  @override
  void initState() {
    super.initState();
    _restore();
    _syncTimer = Timer.periodic(
      const Duration(seconds: 15),
      (_) => _tryAutoSync(),
    );
  }

  @override
  void dispose() {
    _syncTimer?.cancel();
    _loginUrl.dispose();
    _loginEmail.dispose();
    _loginPassword.dispose();
    super.dispose();
  }

  Future<void> _restore() async {
    final loaded = await _store.load();
    final session = await _sessionStore.load();
    final savedServerUrl = await _sessionStore.loadServerUrl();
    if (!mounted) return;
    setState(() {
      _state = loaded;
      if (savedServerUrl != null && savedServerUrl.isNotEmpty) {
        _loginUrl.text = savedServerUrl;
      }
      if (session != null) {
        _client = _clientFromSession(session);
        _loginUrl.text = session.baseUrl;
      }
      _loading = false;
    });
  }

  ModelaApiClient _clientFromSession(ModelaSession session) => ModelaApiClient(
    session.baseUrl,
    initialCookies: session.cookies,
    onSessionChanged: (next) => unawaited(_sessionStore.save(next)),
  );

  Future<void> _signOut() async {
    await _sessionStore.clear();
    if (!mounted) return;
    setState(() {
      _client = null;
      _loginEmail.clear();
      _loginPassword.clear();
      _loginError = null;
      _showServerSettings = false;
    });
  }
  Future<void> _signIn() async {
    setState(() {
      _loggingIn = true;
      _loginError = null;
    });
    try {
      final next = ModelaApiClient(
        _loginUrl.text,
        onSessionChanged: (session) => unawaited(_sessionStore.save(session)),
      );
      await next.login(_loginEmail.text.trim(), _loginPassword.text);
      await next.projects();
      await _sessionStore.saveServerUrl(next.baseUrl);
      if (!mounted) return;
      setState(() {
        _client = next;
        _loginPassword.clear();
      });
    } on Object catch (error) {
      if (mounted) setState(() => _loginError = error.toString());
    } finally {
      if (mounted) setState(() => _loggingIn = false);
    }
  }

  Future<void> _save(LocalEditorState state, {String? notice}) async {
    setState(() {
      _state = state;
      _notice = notice;
      _noticeError = false;
    });
    await _store.save(state);
  }

  Future<void> _change(UmlDiagram next, {String? notice}) async {
    final current = _state!;
    await _save(
      current.copyWith(diagram: next, pending: true),
      notice: notice ?? 'Guardado localmente.',
    );
    unawaited(_tryAutoSync());
  }

  Future<void> _tryAutoSync() async {
    final client = _client;
    final snapshot = _state;
    if (_syncing ||
        client == null ||
        snapshot == null ||
        snapshot.projectId == null ||
        !snapshot.pending) {
      return;
    }
    _syncing = true;
    try {
      final result = await client.sync(snapshot);
      if (!mounted || _state == null) return;
      final current = _state!;
      if (current.diagram.localRevision == snapshot.diagram.localRevision) {
        await _save(
          result.state,
          notice: 'Cambios sincronizados automáticamente.',
        );
      } else {
        await _save(
          current.copyWith(
            remoteRevision: result.state.remoteRevision,
            pending: true,
          ),
        );
      }
    } on Object {
      // Offline is a normal state. The local queue stays pending for a later retry.
    } finally {
      _syncing = false;
    }
  }

  Future<void> _rename() async {
    final controller = TextEditingController(text: _state!.diagram.name);
    final name = await _textDialog(
      'Nombre del diagrama',
      controller,
      hint: 'Inventario',
    );
    if (name == null) return;
    await _change(_state!.diagram.changed(name: name));
  }

  Future<void> _editClass([UmlClass? editing]) async {
    final name = TextEditingController(
      text: editing?.name ?? 'Clase${_state!.diagram.classes.length + 1}',
    );
    var abstractClass = editing?.isAbstract ?? false;
    final result = await showDialog<(String, bool)>(
      context: context,
      builder: (context) => StatefulBuilder(
        builder: (context, setModalState) => AlertDialog(
          title: Text(editing == null ? 'Nueva clase' : 'Editar clase'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(
                controller: name,
                autofocus: true,
                decoration: const InputDecoration(labelText: 'Nombre'),
              ),
              CheckboxListTile(
                value: abstractClass,
                onChanged: (value) =>
                    setModalState(() => abstractClass = value ?? false),
                title: const Text('Abstracta'),
                contentPadding: EdgeInsets.zero,
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('Cancelar'),
            ),
            FilledButton(
              onPressed: () =>
                  Navigator.pop(context, (name.text.trim(), abstractClass)),
              child: const Text('Guardar'),
            ),
          ],
        ),
      ),
    );
    if (result == null || result.$1.isEmpty) return;
    final diagram = _state!.diagram;
    final classes = [...diagram.classes];
    if (editing == null) {
      classes.add(
        UmlClass(id: newUuid(), name: result.$1, isAbstract: result.$2),
      );
    } else {
      final index = classes.indexWhere((item) => item.id == editing.id);
      classes[index] = editing.copyWith(name: result.$1, isAbstract: result.$2);
    }
    await _change(diagram.changed(classes: classes));
  }

  Future<void> _removeClass(UmlClass value) async {
    final confirmed = await _confirm(
      'Eliminar ${value.name}',
      'También se eliminarán sus relaciones.',
    );
    if (!confirmed) return;
    final diagram = _state!.diagram;
    await _change(
      diagram.changed(
        classes: diagram.classes.where((item) => item.id != value.id).toList(),
        relations: diagram.relations
            .where(
              (item) => item.sourceId != value.id && item.targetId != value.id,
            )
            .toList(),
      ),
    );
  }

  Future<void> _editAttribute(UmlClass owner, [UmlAttribute? editing]) async {
    final name = TextEditingController(text: editing?.name ?? 'atributo');
    var type = editing?.dataType ?? 'String';
    var visibility = editing?.visibility ?? 'private';
    var identifier = editing?.identifier ?? false;
    var required = editing?.required ?? true;
    final result = await showDialog<UmlAttribute>(
      context: context,
      builder: (context) => StatefulBuilder(
        builder: (context, setModalState) => AlertDialog(
          title: Text(editing == null ? 'Nuevo atributo' : 'Editar atributo'),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                TextField(
                  controller: name,
                  autofocus: true,
                  decoration: const InputDecoration(labelText: 'Nombre'),
                ),
                DropdownButtonFormField<String>(
                  initialValue: type,
                  decoration: const InputDecoration(labelText: 'Tipo'),
                  items: umlTypes
                      .map(
                        (value) =>
                            DropdownMenuItem(value: value, child: Text(value)),
                      )
                      .toList(),
                  onChanged: (value) => setModalState(() => type = value!),
                ),
                DropdownButtonFormField<String>(
                  initialValue: visibility,
                  decoration: const InputDecoration(labelText: 'Visibilidad'),
                  items: umlVisibilities
                      .map(
                        (value) =>
                            DropdownMenuItem(value: value, child: Text(value)),
                      )
                      .toList(),
                  onChanged: (value) =>
                      setModalState(() => visibility = value!),
                ),
                CheckboxListTile(
                  value: identifier,
                  title: const Text('Identificador'),
                  contentPadding: EdgeInsets.zero,
                  onChanged: (value) => setModalState(() {
                    identifier = value ?? false;
                    if (identifier) required = true;
                  }),
                ),
                CheckboxListTile(
                  value: required,
                  title: const Text('Obligatorio'),
                  contentPadding: EdgeInsets.zero,
                  onChanged: identifier
                      ? null
                      : (value) =>
                            setModalState(() => required = value ?? true),
                ),
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('Cancelar'),
            ),
            FilledButton(
              onPressed: () => Navigator.pop(
                context,
                UmlAttribute(
                  id: editing?.id ?? newUuid(),
                  name: name.text.trim(),
                  dataType: type,
                  visibility: visibility,
                  identifier: identifier,
                  required: required,
                ),
              ),
              child: const Text('Guardar'),
            ),
          ],
        ),
      ),
    );
    if (result == null || result.name.isEmpty) return;
    final diagram = _state!.diagram;
    final classes = diagram.classes.map((item) {
      if (item.id != owner.id) return item;
      final attributes = [...item.attributes];
      final index = attributes.indexWhere(
        (attribute) => attribute.id == result.id,
      );
      if (index < 0) {
        attributes.add(result);
      } else {
        attributes[index] = result;
      }
      return item.copyWith(attributes: attributes);
    }).toList();
    await _change(diagram.changed(classes: classes));
  }

  Future<void> _removeAttribute(UmlClass owner, UmlAttribute attribute) async {
    final diagram = _state!.diagram;
    final classes = diagram.classes
        .map(
          (item) => item.id == owner.id
              ? item.copyWith(
                  attributes: item.attributes
                      .where((value) => value.id != attribute.id)
                      .toList(),
                )
              : item,
        )
        .toList();
    await _change(diagram.changed(classes: classes));
  }

  Future<void> _editRelation([UmlRelation? editing]) async {
    final classes = _state!.diagram.classes;
    if (classes.length < 2) {
      _show('Crea al menos dos clases antes de relacionarlas.', error: true);
      return;
    }
    var type = editing?.type ?? 'association';
    var source = editing?.sourceId ?? classes.first.id;
    var target =
        editing?.targetId ?? classes.firstWhere((item) => item.id != source).id;
    var sourceMultiplicity = editing?.sourceMultiplicity ?? '1';
    var targetMultiplicity = editing?.targetMultiplicity ?? '0..*';
    final name = TextEditingController(text: editing?.name ?? '');
    final result = await showDialog<UmlRelation>(
      context: context,
      builder: (context) => StatefulBuilder(
        builder: (context, setModalState) => AlertDialog(
          title: Text(editing == null ? 'Nueva relación' : 'Editar relación'),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                DropdownButtonFormField<String>(
                  initialValue: type,
                  decoration: const InputDecoration(labelText: 'Tipo'),
                  items: const [
                    DropdownMenuItem(
                      value: 'association',
                      child: Text('Asociación'),
                    ),
                    DropdownMenuItem(
                      value: 'generalization',
                      child: Text('Herencia'),
                    ),
                  ],
                  onChanged: (value) => setModalState(() => type = value!),
                ),
                DropdownButtonFormField<String>(
                  initialValue: source,
                  decoration: const InputDecoration(
                    labelText: 'Clase de origen',
                  ),
                  items: classes
                      .map(
                        (item) => DropdownMenuItem(
                          value: item.id,
                          child: Text(item.name),
                        ),
                      )
                      .toList(),
                  onChanged: (value) => setModalState(() {
                    source = value!;
                    if (source == target) {
                      target = classes
                          .firstWhere((item) => item.id != source)
                          .id;
                    }
                  }),
                ),
                DropdownButtonFormField<String>(
                  initialValue: target,
                  decoration: const InputDecoration(
                    labelText: 'Clase de destino',
                  ),
                  items: classes
                      .where((item) => item.id != source)
                      .map(
                        (item) => DropdownMenuItem(
                          value: item.id,
                          child: Text(item.name),
                        ),
                      )
                      .toList(),
                  onChanged: (value) => setModalState(() => target = value!),
                ),
                TextField(
                  controller: name,
                  decoration: const InputDecoration(
                    labelText: 'Nombre opcional',
                  ),
                ),
                if (type == 'association') ...[
                  TextField(
                    controller: TextEditingController(text: sourceMultiplicity),
                    decoration: const InputDecoration(
                      labelText: 'Multiplicidad de origen',
                    ),
                    onChanged: (value) => sourceMultiplicity = value,
                  ),
                  TextField(
                    controller: TextEditingController(text: targetMultiplicity),
                    decoration: const InputDecoration(
                      labelText: 'Multiplicidad de destino',
                    ),
                    onChanged: (value) => targetMultiplicity = value,
                  ),
                ],
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('Cancelar'),
            ),
            FilledButton(
              onPressed: () => Navigator.pop(
                context,
                UmlRelation(
                  id: editing?.id ?? newUuid(),
                  type: type,
                  sourceId: source,
                  targetId: target,
                  name: name.text.trim(),
                  sourceMultiplicity: type == 'generalization'
                      ? '1'
                      : sourceMultiplicity,
                  targetMultiplicity: type == 'generalization'
                      ? '1'
                      : targetMultiplicity,
                ),
              ),
              child: const Text('Guardar'),
            ),
          ],
        ),
      ),
    );
    if (result == null) return;
    final diagram = _state!.diagram;
    final relations = [...diagram.relations];
    final index = relations.indexWhere((item) => item.id == result.id);
    if (index < 0) {
      relations.add(result);
    } else {
      relations[index] = result;
    }
    await _change(diagram.changed(relations: relations));
  }

  Future<void> _sync() async {
    final state = _state!;
    final activeClient = _client;
    if (activeClient != null && state.projectId != null) {
      setState(() {
        _syncing = true;
        _notice = 'Sincronizando con el servidor…';
        _noticeError = false;
      });
      try {
        final result = await activeClient.sync(state);
        await _save(result.state, notice: result.message);
        return;
      } on ModelaApiException catch (error) {
        if (error.statusCode == 401 || error.statusCode == 403) {
          _client = null;
          unawaited(_sessionStore.clear());
          _show('La sesión terminó. Inicia sesión otra vez.', error: true);
        } else {
          _show(error.message, error: true);
          return;
        }
      } finally {
        if (mounted) setState(() => _syncing = false);
      }
    }
    await _openSyncSheet();
  }

  Future<void> _openSyncSheet() async {
    final state = _state!;
    final activeClient = _client;
    final url = TextEditingController(
      text: _client?.baseUrl ?? _loginUrl.text,
    );
    final email = TextEditingController();
    final password = TextEditingController();
    ModelaApiClient? client = activeClient;
    List<MobileProject> projects = [];
    List<MobileDiagramSummary> remoteDiagrams = [];
    String? projectId = state.projectId;
    String? message;
    var busy = false;
    var showServerSettings = false;
    if (activeClient != null) {
      try {
        projects = await activeClient.projects();
      } on ModelaApiException catch (error) {
        if (error.statusCode == 401 || error.statusCode == 403) {
          _client = null;
          client = null;
          unawaited(_sessionStore.clear());
          message = 'La sesión terminó. Inicia sesión otra vez.';
        } else {
          message = error.message;
        }
      }
    }
    if (!mounted) return;
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      builder: (context) => StatefulBuilder(
        builder: (context, setSheetState) => Padding(
          padding: EdgeInsets.fromLTRB(
            20,
            20,
            20,
            MediaQuery.viewInsetsOf(context).bottom + 20,
          ),
          child: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text(
                  'Sincronizar con Modela',
                  style: Theme.of(context).textTheme.titleLarge,
                ),
                const SizedBox(height: 12),
                if (client == null) ...[
                  TextField(
                    controller: email,
                    keyboardType: TextInputType.emailAddress,
                    decoration: const InputDecoration(
                      labelText: 'Correo administrador',
                    ),
                  ),
                  if (showServerSettings) ...[
                    const SizedBox(height: 8),
                    TextField(
                      controller: url,
                      keyboardType: TextInputType.url,
                      decoration: const InputDecoration(
                        labelText: 'Servidor de Modela',
                        hintText: 'https://api.tudominio.com',
                      ),
                    ),
                    Align(
                      alignment: Alignment.centerLeft,
                      child: TextButton.icon(
                        onPressed: () => setSheetState(() => showServerSettings = false),
                        icon: const Icon(Icons.expand_less),
                        label: const Text('Ocultar configuración'),
                      ),
                    ),
                  ] else
                    Align(
                      alignment: Alignment.centerLeft,
                      child: TextButton.icon(
                        onPressed: () => setSheetState(() => showServerSettings = true),
                        icon: const Icon(Icons.settings_outlined),
                        label: const Text('Configurar servidor'),
                      ),
                    ),
                  TextField(
                    controller: password,
                    obscureText: true,
                    decoration: const InputDecoration(labelText: 'Contraseña'),
                  ),
                  const SizedBox(height: 8),
                  FilledButton.icon(
                    onPressed: busy
                        ? null
                        : () async {
                            setSheetState(() {
                              busy = true;
                              message = null;
                            });
                            try {
                              final next = ModelaApiClient(
                                url.text,
                                onSessionChanged: (session) =>
                                    unawaited(_sessionStore.save(session)),
                              );
                              await next.login(
                                email.text.trim(),
                                password.text,
                              );
                              await _sessionStore.saveServerUrl(next.baseUrl);
                              final listed = await next.projects();
                              setSheetState(() {
                                client = next;
                                projects = listed;
                                projectId ??= listed.isNotEmpty
                                    ? listed.first.id
                                    : null;
                                message = listed.isEmpty
                                    ? 'No tienes proyectos disponibles.'
                                    : 'Sesión iniciada. Selecciona un proyecto.';
                              });
                              _client = next;
                            } on Object catch (error) {
                              setSheetState(() => message = error.toString());
                            } finally {
                              setSheetState(() => busy = false);
                            }
                          },
                    icon: const Icon(Icons.login),
                    label: const Text('Iniciar sesión'),
                  ),
                ] else
                  const Padding(
                    padding: EdgeInsets.only(bottom: 8),
                    child: Text(
                      'Sesión iniciada. Elige el proyecto para este diagrama.',
                    ),
                  ),
                if (projects.isNotEmpty)
                  DropdownButtonFormField<String>(
                    initialValue: projectId,
                    decoration: const InputDecoration(labelText: 'Proyecto'),
                    items: projects
                        .map(
                          (project) => DropdownMenuItem(
                            value: project.id,
                            child: Text(
                              '${project.name} · ${project.permission}',
                            ),
                          ),
                        )
                        .toList(),
                    onChanged: busy
                        ? null
                        : (value) => setSheetState(() {
                            projectId = value;
                            remoteDiagrams = [];
                          }),
                  ),
                if (client != null && projectId != null)
                  OutlinedButton.icon(
                    onPressed: busy
                        ? null
                        : () async {
                            setSheetState(() {
                              busy = true;
                              message = null;
                            });
                            try {
                              final listed = await client!.diagrams(projectId!);
                              setSheetState(() {
                                remoteDiagrams = listed;
                                message = listed.isEmpty
                                    ? 'El proyecto aún no tiene diagramas.'
                                    : 'Toca un diagrama para descargarlo.';
                              });
                            } on Object catch (error) {
                              setSheetState(() => message = error.toString());
                            } finally {
                              setSheetState(() => busy = false);
                            }
                          },
                    icon: const Icon(Icons.download_outlined),
                    label: const Text('Ver diagramas del proyecto'),
                  ),
                ...remoteDiagrams.map(
                  (remote) => ListTile(
                    leading: const Icon(Icons.account_tree_outlined),
                    title: Text(remote.name),
                    subtitle: Text('Revisión ${remote.revision}'),
                    onTap: busy
                        ? null
                        : () async {
                            setSheetState(() => busy = true);
                            try {
                              final loaded = await client!.loadDiagram(
                                projectId!,
                                remote.id,
                              );
                              await _save(
                                loaded,
                                notice:
                                    'Diagrama descargado para editar sin conexión.',
                              );
                              if (context.mounted) Navigator.pop(context);
                            } on Object catch (error) {
                              setSheetState(() => message = error.toString());
                            } finally {
                              if (context.mounted) {
                                setSheetState(() => busy = false);
                              }
                            }
                          },
                  ),
                ),
                if (message != null)
                  Padding(
                    padding: const EdgeInsets.only(top: 8),
                    child: Text(message!),
                  ),
                const SizedBox(height: 8),
                FilledButton.icon(
                  onPressed: busy || client == null || projectId == null
                      ? null
                      : () async {
                          setSheetState(() {
                            busy = true;
                            message = null;
                          });
                          try {
                            final result = await client!.sync(
                              state.copyWith(projectId: projectId),
                            );
                            await _save(result.state, notice: result.message);
                            if (context.mounted) Navigator.pop(context);
                          } on Object catch (error) {
                            setSheetState(() => message = error.toString());
                          } finally {
                            if (context.mounted) {
                              setSheetState(() => busy = false);
                            }
                          }
                        },
                  icon: const Icon(Icons.sync),
                  label: Text(
                    state.remoteRevision == null
                        ? 'Crear en el proyecto'
                        : 'Enviar cambios',
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  'La contraseña solo se usa para esta sesión y no se guarda en el teléfono.',
                  style: Theme.of(context).textTheme.bodySmall,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Future<void> _runVoiceCommand() async {
    _show('Escuchando una instrucción local…');
    try {
      final transcript = await LocalVoice().transcribe();
      await _applyLocalCommand(transcript);
    } on LocalVoiceException catch (error) {
      _show(error.message, error: true);
    }
  }

  Future<void> _applyLocalCommand(String transcript) async {
    final command = parseLocalCommand(transcript);
    final diagram = _state!.diagram;
    if (command is CreateClassCommand) {
      if (diagram.classes.any(
        (item) => nameKey(item.name) == nameKey(command.name),
      )) {
        _show('La clase ${command.name} ya existe.', error: true);
        return;
      }
      await _change(
        diagram.changed(
          classes: [
            ...diagram.classes,
            UmlClass(id: newUuid(), name: command.name),
          ],
        ),
        notice: 'Comando local aplicado: crear clase ${command.name}.',
      );
      return;
    }
    if (command is AddAttributeCommand) {
      final owner = diagram.classes
          .where((item) => nameKey(item.name) == nameKey(command.owner))
          .firstOrNull;
      if (owner == null) {
        _show('No existe la clase ${command.owner}.', error: true);
        return;
      }
      if (owner.attributes.any(
        (item) => nameKey(item.name) == nameKey(command.attribute),
      )) {
        _show(
          '${owner.name} ya tiene el atributo ${command.attribute}.',
          error: true,
        );
        return;
      }
      final classes = diagram.classes
          .map(
            (item) => item.id == owner.id
                ? item.copyWith(
                    attributes: [
                      ...item.attributes,
                      UmlAttribute(
                        id: newUuid(),
                        name: command.attribute,
                        dataType: command.dataType,
                      ),
                    ],
                  )
                : item,
          )
          .toList();
      await _change(
        diagram.changed(classes: classes),
        notice:
            'Comando local aplicado: ${command.attribute} : ${command.dataType} en ${owner.name}.',
      );
      return;
    }
    if (command is DeleteAttributeCommand) {
      final owner = diagram.classes
          .where((item) => nameKey(item.name) == nameKey(command.owner))
          .firstOrNull;
      if (owner == null) {
        _show('No existe la clase ${command.owner}.', error: true);
        return;
      }
      final attribute = owner.attributes
          .where((item) => nameKey(item.name) == nameKey(command.attribute))
          .firstOrNull;
      if (attribute == null) {
        _show(
          '${owner.name} no tiene el atributo ${command.attribute}.',
          error: true,
        );
        return;
      }
      await _change(
        diagram.changed(
          classes: diagram.classes
              .map(
                (item) => item.id == owner.id
                    ? item.copyWith(
                        attributes: item.attributes
                            .where((value) => value.id != attribute.id)
                            .toList(),
                      )
                    : item,
              )
              .toList(),
        ),
        notice:
            'Comando local aplicado: eliminar ${attribute.name} de ${owner.name}.',
      );
      return;
    }
    if (command is DeleteClassCommand) {
      final target = diagram.classes
          .where((item) => nameKey(item.name) == nameKey(command.name))
          .firstOrNull;
      if (target == null) {
        _show('No existe la clase ${command.name}.', error: true);
        return;
      }
      await _change(
        diagram.changed(
          classes: diagram.classes
              .where((item) => item.id != target.id)
              .toList(),
          relations: diagram.relations
              .where(
                (item) =>
                    item.sourceId != target.id && item.targetId != target.id,
              )
              .toList(),
        ),
        notice: 'Comando local aplicado: eliminar clase ${target.name}.',
      );
      return;
    }
    if (command is RenameClassCommand) {
      final target = diagram.classes
          .where((item) => nameKey(item.name) == nameKey(command.from))
          .firstOrNull;
      if (target == null) {
        _show('No existe la clase ${command.from}.', error: true);
        return;
      }
      if (diagram.classes.any(
        (item) =>
            item.id != target.id && nameKey(item.name) == nameKey(command.to),
      )) {
        _show('La clase ${command.to} ya existe.', error: true);
        return;
      }
      await _change(
        diagram.changed(
          classes: diagram.classes
              .map(
                (item) => item.id == target.id
                    ? item.copyWith(name: command.to)
                    : item,
              )
              .toList(),
        ),
        notice:
            'Comando local aplicado: renombrar ${target.name} a ${command.to}.',
      );
      return;
    }
    if (command is AssociateClassesCommand) {
      final source = diagram.classes
          .where((item) => nameKey(item.name) == nameKey(command.source))
          .firstOrNull;
      final target = diagram.classes
          .where((item) => nameKey(item.name) == nameKey(command.target))
          .firstOrNull;
      if (source != null && target != null && source.id != target.id) {
        if (diagram.relations.any(
          (item) =>
              item.type == 'association' &&
              item.sourceId == source.id &&
              item.targetId == target.id,
        )) {
          _show('La relación ya existe.', error: true);
          return;
        }
        await _change(
          diagram.changed(
            relations: [
              ...diagram.relations,
              UmlRelation(
                id: newUuid(),
                type: 'association',
                sourceId: source.id,
                targetId: target.id,
              ),
            ],
          ),
          notice:
              'Comando local aplicado: relación ${source.name} — ${target.name}.',
        );
        return;
      }
    }
    if (command is GeneralizeClassCommand) {
      final child = diagram.classes
          .where((item) => nameKey(item.name) == nameKey(command.child))
          .firstOrNull;
      final parent = diagram.classes
          .where((item) => nameKey(item.name) == nameKey(command.parent))
          .firstOrNull;
      if (child != null && parent != null && child.id != parent.id) {
        if (diagram.relations.any(
          (item) =>
              item.type == 'generalization' &&
              item.sourceId == child.id &&
              item.targetId == parent.id,
        )) {
          _show('La herencia ya existe.', error: true);
          return;
        }
        await _change(
          diagram.changed(
            relations: [
              ...diagram.relations,
              UmlRelation(
                id: newUuid(),
                type: 'generalization',
                sourceId: child.id,
                targetId: parent.id,
                sourceMultiplicity: '1',
                targetMultiplicity: '1',
              ),
            ],
          ),
          notice:
              'Comando local aplicado: ${child.name} hereda de ${parent.name}.',
        );
        return;
      }
    }
    final message = command is InvalidLocalCommand
        ? 'Transcripción: "$transcript". ${command.message}'
        : 'No se pudo aplicar "$transcript". Verifica los nombres de las clases.';
    _show(message, error: true);
  }

  Future<String?> _textDialog(
    String title,
    TextEditingController controller, {
    String? hint,
  }) => showDialog<String>(
    context: context,
    builder: (context) => AlertDialog(
      title: Text(title),
      content: TextField(
        controller: controller,
        autofocus: true,
        decoration: InputDecoration(hintText: hint),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context),
          child: const Text('Cancelar'),
        ),
        FilledButton(
          onPressed: () => Navigator.pop(context, controller.text.trim()),
          child: const Text('Guardar'),
        ),
      ],
    ),
  );

  Future<bool> _confirm(String title, String content) async =>
      (await showDialog<bool>(
        context: context,
        builder: (context) => AlertDialog(
          title: Text(title),
          content: Text(content),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context, false),
              child: const Text('Cancelar'),
            ),
            FilledButton(
              onPressed: () => Navigator.pop(context, true),
              child: const Text('Eliminar'),
            ),
          ],
        ),
      )) ??
      false;

  void _show(String value, {bool error = false}) => setState(() {
    _notice = value;
    _noticeError = error;
  });

  @override
  Widget build(BuildContext context) {
    if (_loading || _state == null) {
      return const Center(child: CircularProgressIndicator());
    }
    if (_client == null) {
      return Scaffold(
        appBar: AppBar(title: const Text('Modela móvil')),
        body: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 460),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Icon(
                    Icons.account_circle_outlined,
                    size: 64,
                    color: Theme.of(context).colorScheme.primary,
                  ),
                  const SizedBox(height: 16),
                  Text(
                    'Inicia sesión para entrar al editor',
                    textAlign: TextAlign.center,
                    style: Theme.of(context).textTheme.headlineSmall,
                  ),
                  const SizedBox(height: 20),
                  TextField(
                    controller: _loginEmail,
                    keyboardType: TextInputType.emailAddress,
                    decoration: const InputDecoration(labelText: 'Correo'),
                  ),
                  const SizedBox(height: 12),
                  if (_showServerSettings) ...[
                    TextField(
                      controller: _loginUrl,
                      keyboardType: TextInputType.url,
                      decoration: const InputDecoration(
                        labelText: 'Servidor de Modela',
                        hintText: 'https://api.tudominio.com',
                      ),
                    ),
                    Align(
                      alignment: Alignment.centerLeft,
                      child: TextButton.icon(
                        onPressed: () => setState(() => _showServerSettings = false),
                        icon: const Icon(Icons.expand_less),
                        label: const Text('Ocultar configuración'),
                      ),
                    ),
                  ] else
                    Align(
                      alignment: Alignment.centerLeft,
                      child: TextButton.icon(
                        onPressed: () => setState(() => _showServerSettings = true),
                        icon: const Icon(Icons.settings_outlined),
                        label: const Text('Configurar servidor'),
                      ),
                    ),
                  TextField(
                    controller: _loginPassword,
                    obscureText: true,
                    onSubmitted: (_) => _loggingIn ? null : _signIn(),
                    decoration: const InputDecoration(labelText: 'Contraseña'),
                  ),
                  if (_loginError != null) ...[
                    const SizedBox(height: 12),
                    Text(
                      _loginError!,
                      style: TextStyle(
                        color: Theme.of(context).colorScheme.error,
                      ),
                    ),
                  ],
                  const SizedBox(height: 20),
                  FilledButton.icon(
                    onPressed: _loggingIn ? null : _signIn,
                    icon: _loggingIn
                        ? const SizedBox(
                            width: 18,
                            height: 18,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : const Icon(Icons.login),
                    label: const Text('Iniciar sesión'),
                  ),
                  const SizedBox(height: 12),
                  Text(
                    'La contraseña no se guarda en el teléfono.',
                    textAlign: TextAlign.center,
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                ],
              ),
            ),
          ),
        ),
      );
    }
    final state = _state!;
    final diagram = state.diagram;
    final validation = diagram.validate();
    return Scaffold(
      appBar: AppBar(
        title: InkWell(
          onTap: _rename,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text('Editor UML móvil', style: TextStyle(fontSize: 13)),
              Text(diagram.name),
            ],
          ),
        ),
        actions: [
          IconButton(
            onPressed: _sync,
            tooltip: 'Sincronizar',
            icon: Badge(
              isLabelVisible: state.pending,
              child: const Icon(Icons.sync),
            ),
          ),
          IconButton(
            onPressed: _runVoiceCommand,
            tooltip: 'Dictar instrucción local',
            icon: const Icon(Icons.mic_none),
          ),
          IconButton(
            onPressed: _rename,
            tooltip: 'Renombrar',
            icon: const Icon(Icons.edit),
          ),
          IconButton(
            onPressed: _signOut,
            tooltip: 'Cerrar sesión',
            icon: const Icon(Icons.logout),
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _editClass,
        icon: const Icon(Icons.add),
        label: const Text('Clase'),
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          if (_notice != null)
            MaterialBanner(
              content: Text(_notice!),
              backgroundColor: _noticeError
                  ? Theme.of(context).colorScheme.errorContainer
                  : null,
              actions: [
                TextButton(
                  onPressed: () => setState(() => _notice = null),
                  child: const Text('Cerrar'),
                ),
              ],
            ),
          Card(
            child: Padding(
              padding: const EdgeInsets.all(14),
              child: Row(
                children: [
                  Icon(
                    state.pending
                        ? Icons.cloud_upload_outlined
                        : Icons.cloud_done_outlined,
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      state.pending
                          ? 'Cambios guardados en este dispositivo. Falta sincronizar.'
                          : 'Sincronizado con el servidor.',
                    ),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 8),
          Card(
            child: Padding(
              padding: const EdgeInsets.all(12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Icon(
                        Icons.auto_awesome_outlined,
                        color: Theme.of(context).colorScheme.primary,
                      ),
                      const SizedBox(width: 8),
                      Text(
                        'Asistente local',
                        style: Theme.of(context).textTheme.titleMedium,
                      ),
                    ],
                  ),
                  const SizedBox(height: 6),
                  ...localHints(diagram).map(
                    (hint) => Padding(
                      padding: const EdgeInsets.only(bottom: 6),
                      child: Text('${hint.title}. ${hint.detail}'),
                    ),
                  ),
                  Text(
                    'El análisis se realiza en el teléfono. El botón de micrófono usa el reconocimiento offline de Android.',
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                ],
              ),
            ),
          ),
          if (validation != null)
            Padding(
              padding: const EdgeInsets.only(top: 8),
              child: Text(
                validation,
                style: TextStyle(color: Theme.of(context).colorScheme.error),
              ),
            ),
          const SizedBox(height: 12),
          Text('Clases', style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: 8),
          if (diagram.classes.isEmpty)
            const Card(
              child: Padding(
                padding: EdgeInsets.all(18),
                child: Text(
                  'Agrega tu primera clase para empezar el diagrama.',
                ),
              ),
            ),
          ...diagram.classes.map(
            (item) => _ClassCard(
              value: item,
              onEdit: () => _editClass(item),
              onDelete: () => _removeClass(item),
              onAddAttribute: () => _editAttribute(item),
              onEditAttribute: (attribute) => _editAttribute(item, attribute),
              onDeleteAttribute: (attribute) =>
                  _removeAttribute(item, attribute),
            ),
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              Text('Relaciones', style: Theme.of(context).textTheme.titleLarge),
              const Spacer(),
              TextButton.icon(
                onPressed: _editRelation,
                icon: const Icon(Icons.add),
                label: const Text('Relación'),
              ),
            ],
          ),
          if (diagram.relations.isEmpty) const Text('Aún no hay relaciones.'),
          ...diagram.relations.map((relation) {
            final source = diagram.classes
                .where((item) => item.id == relation.sourceId)
                .firstOrNull;
            final target = diagram.classes
                .where((item) => item.id == relation.targetId)
                .firstOrNull;
            return Card(
              child: ListTile(
                leading: Icon(
                  relation.type == 'generalization'
                      ? Icons.account_tree_outlined
                      : Icons.hub_outlined,
                ),
                title: Text('${source?.name ?? '?'} → ${target?.name ?? '?'}'),
                subtitle: Text(
                  relation.type == 'generalization'
                      ? 'Herencia'
                      : '${relation.sourceMultiplicity} — ${relation.targetMultiplicity}${relation.name.isEmpty ? '' : ' · ${relation.name}'}',
                ),
                onTap: () => _editRelation(relation),
                trailing: IconButton(
                  onPressed: () async {
                    final relations = diagram.relations
                        .where((item) => item.id != relation.id)
                        .toList();
                    await _change(diagram.changed(relations: relations));
                  },
                  icon: const Icon(Icons.delete_outline),
                ),
              ),
            );
          }),
          const SizedBox(height: 88),
        ],
      ),
    );
  }
}

class _ClassCard extends StatelessWidget {
  const _ClassCard({
    required this.value,
    required this.onEdit,
    required this.onDelete,
    required this.onAddAttribute,
    required this.onEditAttribute,
    required this.onDeleteAttribute,
  });
  final UmlClass value;
  final VoidCallback onEdit;
  final VoidCallback onDelete;
  final VoidCallback onAddAttribute;
  final ValueChanged<UmlAttribute> onEditAttribute;
  final ValueChanged<UmlAttribute> onDeleteAttribute;

  @override
  Widget build(BuildContext context) => Card(
    clipBehavior: Clip.antiAlias,
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Container(
          color: Theme.of(context).colorScheme.primaryContainer,
          padding: const EdgeInsets.fromLTRB(16, 10, 8, 10),
          child: Row(
            children: [
              Expanded(
                child: Text(
                  value.name,
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    fontWeight: FontWeight.bold,
                    fontStyle: value.isAbstract
                        ? FontStyle.italic
                        : FontStyle.normal,
                  ),
                ),
              ),
              IconButton(
                onPressed: onEdit,
                icon: const Icon(Icons.edit_outlined),
              ),
              IconButton(
                onPressed: onDelete,
                icon: const Icon(Icons.delete_outline),
              ),
            ],
          ),
        ),
        if (value.attributes.isEmpty)
          const Padding(
            padding: EdgeInsets.all(14),
            child: Text('Sin atributos'),
          ),
        ...value.attributes.map(
          (attribute) => ListTile(
            dense: true,
            title: Text(
              '${_symbol(attribute.visibility)} ${attribute.name} : ${attribute.dataType}',
            ),
            subtitle: attribute.identifier ? const Text('Identificador') : null,
            onTap: () => onEditAttribute(attribute),
            trailing: IconButton(
              onPressed: () => onDeleteAttribute(attribute),
              icon: const Icon(Icons.delete_outline),
            ),
          ),
        ),
        Align(
          alignment: Alignment.centerLeft,
          child: TextButton.icon(
            onPressed: onAddAttribute,
            icon: const Icon(Icons.add),
            label: const Text('Atributo'),
          ),
        ),
      ],
    ),
  );
}

String _symbol(String visibility) => switch (visibility) {
  'public' => '+',
  'protected' => '#',
  'package' => '~',
  _ => '−',
};
