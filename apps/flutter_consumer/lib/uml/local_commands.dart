import 'model.dart';

sealed class LocalCommand {
  const LocalCommand();
}

class CreateClassCommand extends LocalCommand {
  const CreateClassCommand(this.name);
  final String name;
}

class AddAttributeCommand extends LocalCommand {
  const AddAttributeCommand(this.attribute, this.owner, this.dataType);
  final String attribute;
  final String owner;
  final String dataType;
}

class DeleteClassCommand extends LocalCommand {
  const DeleteClassCommand(this.name);
  final String name;
}

class DeleteAttributeCommand extends LocalCommand {
  const DeleteAttributeCommand(this.attribute, this.owner);
  final String attribute;
  final String owner;
}

class RenameClassCommand extends LocalCommand {
  const RenameClassCommand(this.from, this.to);
  final String from;
  final String to;
}

class AssociateClassesCommand extends LocalCommand {
  const AssociateClassesCommand(this.source, this.target);
  final String source;
  final String target;
}

class GeneralizeClassCommand extends LocalCommand {
  const GeneralizeClassCommand(this.child, this.parent);
  final String child;
  final String parent;
}

class InvalidLocalCommand extends LocalCommand {
  const InvalidLocalCommand(this.message);
  final String message;
}

/// Parses a small, deterministic Spanish command grammar on the device.
/// Names are one UML identifier so commands remain unambiguous offline.
LocalCommand parseLocalCommand(String transcript) {
  final source = transcript.trim().replaceFirst(RegExp(r'[.!?]+$'), '');
  final create = RegExp(
    r'^crea(?:r)?\s+(?:la\s+)?clase(?:\s+de)?\s+([^\s.,;]+)$',
    caseSensitive: false,
  ).firstMatch(source);
  if (create != null) return CreateClassCommand(create.group(1)!);

  final attribute = RegExp(
    r'^agrega(?:r)?\s+([^\s.,;]+)(?:\s+de\s+tipo\s+([^\s.,;]+))?\s+(?:a|en)\s+(?:la\s+clase\s+)?([^\s.,;]+)$',
    caseSensitive: false,
  ).firstMatch(source);
  if (attribute != null) {
    final type = _canonicalType(attribute.group(2));
    if (type == null) {
      return InvalidLocalCommand(
        'Tipo no admitido. Usa ${umlTypes.join(', ')}.',
      );
    }
    return AddAttributeCommand(attribute.group(1)!, attribute.group(3)!, type);
  }

  final deleteAttribute = RegExp(
    r'^elimina(?:r)?\s+(?:el\s+)?atributo\s+([^\s.,;]+)\s+de\s+(?:la\s+clase\s+)?([^\s.,;]+)$',
    caseSensitive: false,
  ).firstMatch(source);
  if (deleteAttribute != null) {
    return DeleteAttributeCommand(
      deleteAttribute.group(1)!,
      deleteAttribute.group(2)!,
    );
  }

  final delete = RegExp(
    r'^elimina(?:r)?\s+(?:la\s+)?clase\s+([^\s.,;]+)$',
    caseSensitive: false,
  ).firstMatch(source);
  if (delete != null) return DeleteClassCommand(delete.group(1)!);

  final rename = RegExp(
    r'^renombra(?:r)?\s+(?:la\s+clase\s+)?([^\s.,;]+)\s+a\s+([^\s.,;]+)$',
    caseSensitive: false,
  ).firstMatch(source);
  if (rename != null) {
    return RenameClassCommand(rename.group(1)!, rename.group(2)!);
  }

  final oneToMany = RegExp(
    r'^crear?\s+una\s+asociaci[oó]n\s+entre\s+([^\s.,;]+)\s+y\s+([^\s.,;]+),?\s+donde\s+un\s+[^\s.,;]+\s+puede\s+tener\s+muchos\s+[^\s.,;]+\s+y\s+cada\s+[^\s.,;]+\s+pertenece\s+a\s+un\s+solo\s+[^\s.,;]+$',
    caseSensitive: false,
  ).firstMatch(source);
  if (oneToMany != null) {
    return AssociateClassesCommand(oneToMany.group(1)!, oneToMany.group(2)!);
  }

  final relation = RegExp(
    r'^relaciona(?:r)?\s+(?:la\s+clase\s+)?([^\s.,;]+)\s+con\s+(?:la\s+clase\s+)?([^\s.,;]+)$',
    caseSensitive: false,
  ).firstMatch(source);
  if (relation != null) {
    return AssociateClassesCommand(relation.group(1)!, relation.group(2)!);
  }

  final inheritance = RegExp(
    r'^(?:la\s+clase\s+)?([^\s.,;]+)\s+hereda\s+de\s+(?:la\s+clase\s+)?([^\s.,;]+)$',
    caseSensitive: false,
  ).firstMatch(source);
  if (inheritance != null) {
    return GeneralizeClassCommand(inheritance.group(1)!, inheritance.group(2)!);
  }

  return const InvalidLocalCommand(
    'Comando no reconocido. Ejemplos: “Crea la clase Factura”, “Agrega marca a Vehiculo”, “Renombra Vehiculo a Automovil” o “Automovil hereda de Vehiculo”.',
  );
}

String nameKey(String value) => value
    .trim()
    .toLowerCase()
    .replaceAll('á', 'a')
    .replaceAll('é', 'e')
    .replaceAll('í', 'i')
    .replaceAll('ó', 'o')
    .replaceAll('ú', 'u')
    .replaceAll('ü', 'u')
    .replaceAll('ñ', 'n');

String? _canonicalType(String? raw) {
  if (raw == null) return 'String';
  final key = nameKey(raw);
  const aliases = <String, String>{
    'string': 'String',
    'texto': 'String',
    'cadena': 'String',
    'int': 'Integer',
    'integer': 'Integer',
    'entero': 'Integer',
    'long': 'Long',
    'largo': 'Long',
    'decimal': 'Decimal',
    'float': 'Float',
    'double': 'Double',
    'boolean': 'Boolean',
    'booleano': 'Boolean',
    'date': 'Date',
    'fecha': 'Date',
    'datetime': 'DateTime',
    'fechahora': 'DateTime',
    'uuid': 'UUID',
  };
  return aliases[key];
}
