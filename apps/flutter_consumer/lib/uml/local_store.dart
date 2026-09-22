import 'dart:convert';

import 'package:shared_preferences/shared_preferences.dart';

import 'model.dart';

class LocalEditorState {
  const LocalEditorState({
    required this.diagram,
    this.projectId,
    this.remoteRevision,
    this.pending = true,
  });

  final UmlDiagram diagram;
  final String? projectId;
  final int? remoteRevision;
  final bool pending;

  LocalEditorState copyWith({
    UmlDiagram? diagram,
    String? projectId,
    int? remoteRevision,
    bool? pending,
    bool clearProject = false,
    bool clearRevision = false,
  }) => LocalEditorState(
    diagram: diagram ?? this.diagram,
    projectId: clearProject ? null : projectId ?? this.projectId,
    remoteRevision: clearRevision
        ? null
        : remoteRevision ?? this.remoteRevision,
    pending: pending ?? this.pending,
  );

  Map<String, dynamic> toJson() => {
    'diagram': diagram.toJson(),
    'projectId': projectId,
    'remoteRevision': remoteRevision,
    'pending': pending,
  };

  factory LocalEditorState.fromJson(Map<String, dynamic> json) =>
      LocalEditorState(
        diagram: UmlDiagram.fromJson(json['diagram'] as Map<String, dynamic>),
        projectId: json['projectId'] as String?,
        remoteRevision: (json['remoteRevision'] as num?)?.toInt(),
        pending: json['pending'] as bool? ?? true,
      );
}

class LocalDiagramStore {
  static const _key = 'modela.mobile.editor.v1';

  Future<LocalEditorState> load() async {
    final preferences = await SharedPreferences.getInstance();
    final value = preferences.getString(_key);
    if (value == null) return LocalEditorState(diagram: UmlDiagram.empty());
    try {
      return LocalEditorState.fromJson(
        jsonDecode(value) as Map<String, dynamic>,
      );
    } on Object {
      return LocalEditorState(diagram: UmlDiagram.empty());
    }
  }

  Future<void> save(LocalEditorState state) async {
    final preferences = await SharedPreferences.getInstance();
    await preferences.setString(_key, jsonEncode(state.toJson()));
  }
}
