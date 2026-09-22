import 'dart:math';

const umlTypes = <String>[
  'String',
  'Integer',
  'Long',
  'Decimal',
  'Float',
  'Double',
  'Boolean',
  'Date',
  'DateTime',
  'UUID',
];

const umlVisibilities = <String>['private', 'public', 'protected', 'package'];

String newUuid() {
  final random = Random.secure();
  final bytes = List<int>.generate(16, (_) => random.nextInt(256));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  final hex = bytes
      .map((byte) => byte.toRadixString(16).padLeft(2, '0'))
      .join();
  return '${hex.substring(0, 8)}-${hex.substring(8, 12)}-${hex.substring(12, 16)}-${hex.substring(16, 20)}-${hex.substring(20)}';
}

class UmlAttribute {
  UmlAttribute({
    required this.id,
    required this.name,
    this.dataType = 'String',
    this.visibility = 'private',
    this.identifier = false,
    this.required = true,
  });

  final String id;
  final String name;
  final String dataType;
  final String visibility;
  final bool identifier;
  final bool required;

  UmlAttribute copyWith({
    String? name,
    String? dataType,
    String? visibility,
    bool? identifier,
    bool? required,
  }) => UmlAttribute(
    id: id,
    name: name ?? this.name,
    dataType: dataType ?? this.dataType,
    visibility: visibility ?? this.visibility,
    identifier: identifier ?? this.identifier,
    required: required ?? this.required,
  );

  Map<String, dynamic> toJson() => {
    'id': id,
    'name': name,
    'dataType': dataType,
    'visibility': visibility,
    'identifier': identifier,
    'required': required,
  };

  factory UmlAttribute.fromJson(Map<String, dynamic> json) => UmlAttribute(
    id: json['id'] as String,
    name: json['name'] as String,
    dataType: json['dataType'] as String? ?? 'String',
    visibility: json['visibility'] as String? ?? 'private',
    identifier: json['identifier'] as bool? ?? false,
    required: json['required'] as bool? ?? true,
  );
}

class UmlClass {
  UmlClass({
    required this.id,
    required this.name,
    this.isAbstract = false,
    this.x = 80,
    this.y = 80,
    List<UmlAttribute>? attributes,
  }) : attributes = attributes ?? [];

  final String id;
  final String name;
  final bool isAbstract;
  final double x;
  final double y;
  final List<UmlAttribute> attributes;

  UmlClass copyWith({
    String? name,
    bool? isAbstract,
    double? x,
    double? y,
    List<UmlAttribute>? attributes,
  }) => UmlClass(
    id: id,
    name: name ?? this.name,
    isAbstract: isAbstract ?? this.isAbstract,
    x: x ?? this.x,
    y: y ?? this.y,
    attributes: attributes ?? this.attributes,
  );

  Map<String, dynamic> toJson() => {
    'id': id,
    'name': name,
    'abstract': isAbstract,
    'position': {'x': x, 'y': y},
    'attributes': attributes.map((attribute) => attribute.toJson()).toList(),
  };

  factory UmlClass.fromJson(Map<String, dynamic> json) {
    final position = json['position'] as Map<String, dynamic>? ?? const {};
    return UmlClass(
      id: json['id'] as String,
      name: json['name'] as String,
      isAbstract: json['abstract'] as bool? ?? false,
      x: (position['x'] as num?)?.toDouble() ?? 80,
      y: (position['y'] as num?)?.toDouble() ?? 80,
      attributes: ((json['attributes'] as List<dynamic>?) ?? const [])
          .map((item) => UmlAttribute.fromJson(item as Map<String, dynamic>))
          .toList(),
    );
  }
}

class UmlRelation {
  UmlRelation({
    required this.id,
    required this.type,
    required this.sourceId,
    required this.targetId,
    this.name = '',
    this.sourceMultiplicity = '1',
    this.targetMultiplicity = '0..*',
  });

  final String id;
  final String type;
  final String sourceId;
  final String targetId;
  final String name;
  final String sourceMultiplicity;
  final String targetMultiplicity;

  Map<String, dynamic> toJson() => {
    'id': id,
    'type': type,
    'sourceId': sourceId,
    'targetId': targetId,
    'name': name,
    'sourceMultiplicity': sourceMultiplicity,
    'targetMultiplicity': targetMultiplicity,
  };

  factory UmlRelation.fromJson(Map<String, dynamic> json) => UmlRelation(
    id: json['id'] as String,
    type: json['type'] as String,
    sourceId: json['sourceId'] as String,
    targetId: json['targetId'] as String,
    name: json['name'] as String? ?? '',
    sourceMultiplicity: json['sourceMultiplicity'] as String? ?? '1',
    targetMultiplicity: json['targetMultiplicity'] as String? ?? '0..*',
  );
}

class UmlDiagram {
  UmlDiagram({
    required this.id,
    required this.name,
    required this.localRevision,
    required this.updatedAt,
    List<UmlClass>? classes,
    List<UmlRelation>? relations,
  }) : classes = classes ?? [],
       relations = relations ?? [];

  final String id;
  final String name;
  final int localRevision;
  final DateTime updatedAt;
  final List<UmlClass> classes;
  final List<UmlRelation> relations;

  factory UmlDiagram.empty([String name = 'Diagrama móvil']) => UmlDiagram(
    id: newUuid(),
    name: name,
    localRevision: 0,
    updatedAt: DateTime.now().toUtc(),
  );

  UmlDiagram copyWith({
    String? name,
    int? localRevision,
    DateTime? updatedAt,
    List<UmlClass>? classes,
    List<UmlRelation>? relations,
  }) => UmlDiagram(
    id: id,
    name: name ?? this.name,
    localRevision: localRevision ?? this.localRevision,
    updatedAt: updatedAt ?? this.updatedAt,
    classes: classes ?? this.classes,
    relations: relations ?? this.relations,
  );

  UmlDiagram changed({
    String? name,
    List<UmlClass>? classes,
    List<UmlRelation>? relations,
  }) => copyWith(
    name: name,
    classes: classes,
    relations: relations,
    localRevision: localRevision + 1,
    updatedAt: DateTime.now().toUtc(),
  );

  Map<String, dynamic> toJson() => {
    'schemaVersion': 1,
    'id': id,
    'name': name,
    'localRevision': localRevision,
    'updatedAt': updatedAt.toIso8601String(),
    'classes': classes.map((item) => item.toJson()).toList(),
    'relations': relations.map((item) => item.toJson()).toList(),
  };

  factory UmlDiagram.fromJson(Map<String, dynamic> json) => UmlDiagram(
    id: json['id'] as String,
    name: json['name'] as String,
    localRevision: (json['localRevision'] as num?)?.toInt() ?? 0,
    updatedAt: DateTime.parse(json['updatedAt'] as String).toUtc(),
    classes: ((json['classes'] as List<dynamic>?) ?? const [])
        .map((item) => UmlClass.fromJson(item as Map<String, dynamic>))
        .toList(),
    relations: ((json['relations'] as List<dynamic>?) ?? const [])
        .map((item) => UmlRelation.fromJson(item as Map<String, dynamic>))
        .toList(),
  );

  String? validate() {
    final trimmed = name.trim();
    if (trimmed.isEmpty || trimmed.length > 100) {
      return 'El nombre del diagrama es obligatorio.';
    }
    final classNames = <String>{};
    for (final item in classes) {
      final className = item.name.trim();
      if (!_validName(className)) {
        return 'Nombre de clase inválido: ${item.name}.';
      }
      if (!classNames.add(className.toLowerCase())) {
        return 'No repitas el nombre ${item.name}.';
      }
      final attributes = <String>{};
      var identifiers = 0;
      for (final attribute in item.attributes) {
        if (!_validName(attribute.name.trim())) {
          return 'Atributo inválido: ${attribute.name}.';
        }
        if (!attributes.add(attribute.name.toLowerCase())) {
          return 'No repitas ${attribute.name} en ${item.name}.';
        }
        if (attribute.identifier) identifiers++;
        if (attribute.identifier && !attribute.required) {
          return 'Un identificador debe ser obligatorio.';
        }
      }
      if (identifiers > 1) return '${item.name} tiene más de un identificador.';
    }
    final ids = classes.map((item) => item.id).toSet();
    for (final relation in relations) {
      if (!ids.contains(relation.sourceId) ||
          !ids.contains(relation.targetId)) {
        return 'Una relación apunta a una clase eliminada.';
      }
      if (!const {'association', 'generalization'}.contains(relation.type)) {
        return 'Tipo de relación inválido.';
      }
    }
    return null;
  }
}

bool _validName(String value) => RegExp(
  r'^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ_][A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9_]*$',
).hasMatch(value);
