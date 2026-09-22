import 'package:flutter_test/flutter_test.dart';
import 'package:modela_consumer/uml/local_commands.dart';

void main() {
  test('recognizes class creation phrased naturally', () {
    final command = parseLocalCommand('Crea la clase de factura');

    expect(command, isA<CreateClassCommand>());
    expect((command as CreateClassCommand).name, 'factura');
  });

  test('adds an attribute with String as the default type', () {
    final command = parseLocalCommand('Agrega marca a vehiculo');

    expect(command, isA<AddAttributeCommand>());
    final attribute = command as AddAttributeCommand;
    expect(attribute.attribute, 'marca');
    expect(attribute.owner, 'vehiculo');
    expect(attribute.dataType, 'String');
  });

  test('recognizes explicit attribute types and class deletion', () {
    final attribute =
        parseLocalCommand('Agrega nombre de tipo String en la clase persona.')
            as AddAttributeCommand;
    final deletion = parseLocalCommand('Elimina la clase vehiculo');

    expect(attribute.attribute, 'nombre');
    expect(attribute.owner, 'persona');
    expect(attribute.dataType, 'String');
    expect(deletion, isA<DeleteClassCommand>());
    expect((deletion as DeleteClassCommand).name, 'vehiculo');
  });

  test('recognizes deletion of an attribute and class renaming', () {
    final deletion =
        parseLocalCommand('elimina el atributo precio de producto')
            as DeleteAttributeCommand;
    final rename =
        parseLocalCommand('Renombra Vehiculo a Automovil')
            as RenameClassCommand;

    expect(deletion.attribute, 'precio');
    expect(deletion.owner, 'producto');
    expect(rename.from, 'Vehiculo');
    expect(rename.to, 'Automovil');
  });

  test('recognizes one-to-many association and inheritance phrases', () {
    final association =
        parseLocalCommand(
              'Crear una asociación entre Cliente y Pedido, donde un Cliente puede tener muchos Pedidos y cada Pedido pertenece a un solo Cliente',
            )
            as AssociateClassesCommand;
    final inheritance =
        parseLocalCommand('Automovil hereda de Vehiculo')
            as GeneralizeClassCommand;

    expect(association.source, 'Cliente');
    expect(association.target, 'Pedido');
    expect(inheritance.child, 'Automovil');
    expect(inheritance.parent, 'Vehiculo');
  });
}
