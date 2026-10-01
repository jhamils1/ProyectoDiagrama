import 'package:flutter_test/flutter_test.dart';
import 'package:modela_consumer/uml/local_assistant.dart';
import 'package:modela_consumer/uml/model.dart';

void main() {
  test('serializes a mobile diagram in the server document contract', () {
    final diagram = UmlDiagram.empty('Inventario').changed(
      classes: [
        UmlClass(
          id: newUuid(),
          name: 'Producto',
          attributes: [
            UmlAttribute(
              id: newUuid(),
              name: 'id',
              dataType: 'Long',
              identifier: true,
            ),
          ],
        ),
      ],
    );

    final restored = UmlDiagram.fromJson(diagram.toJson());
    expect(restored.name, 'Inventario');
    expect(restored.classes.single.attributes.single.identifier, isTrue);
    expect(restored.validate(), isNull);
  });

  test('detects repeated class names before synchronization', () {
    final diagram = UmlDiagram.empty().changed(
      classes: [
        UmlClass(id: newUuid(), name: 'Cliente'),
        UmlClass(id: newUuid(), name: 'cliente'),
      ],
    );

    expect(diagram.validate(), contains('No repitas'));
  });

  test('remains valid with a one-to-one association', () {
    final client = UmlClass(id: newUuid(), name: 'Cliente');
    final order = UmlClass(id: newUuid(), name: 'Pedido');
    final diagram = UmlDiagram.empty().changed(
      classes: [client, order],
      relations: [
        UmlRelation(
          id: newUuid(),
          type: 'association',
          sourceId: client.id,
          targetId: order.id,
          sourceMultiplicity: '1',
          targetMultiplicity: '0..1',
        ),
      ],
    );

    expect(diagram.validate(), isNull);
  });

  test('preserves an association class in the server document contract', () {
    final venta = UmlClass(id: newUuid(), name: 'Venta');
    final producto = UmlClass(id: newUuid(), name: 'Producto');
    final detalle = UmlClass(id: newUuid(), name: 'Detalle');
    final diagram = UmlDiagram.empty().changed(
      classes: [venta, producto, detalle],
      relations: [
        UmlRelation(
          id: newUuid(),
          type: 'association',
          sourceId: venta.id,
          targetId: producto.id,
          sourceMultiplicity: '*',
          targetMultiplicity: '1..*',
          associationClassId: detalle.id,
        ),
      ],
    );

    final restored = UmlDiagram.fromJson(diagram.toJson());
    expect(restored.relations.single.associationClassId, detalle.id);
    expect(restored.validate(), isNull);
  });

  test('local assistant identifies missing identifiers without a network call', () {
    final diagram = UmlDiagram.empty().changed(
      classes: [UmlClass(id: newUuid(), name: 'Cliente')],
    );

    expect(
      localHints(diagram).map((hint) => hint.title),
      contains('Revisa identificadores'),
    );
  });
}
