import 'package:flutter_test/flutter_test.dart';
import 'package:modela_consumer/main.dart';

void main() {
  testWidgets('shows the generic generated-backend CRUD controls', (
    tester,
  ) async {
    await tester.pumpWidget(const ModelaConsumerApp());

    expect(find.text('Backend generado'), findsOneWidget);
    expect(find.text('Listar'), findsOneWidget);
    expect(find.text('Buscar'), findsOneWidget);
    expect(find.text('Crear'), findsOneWidget);
    expect(find.text('Actualizar'), findsOneWidget);
    expect(find.text('Eliminar'), findsOneWidget);
  });
}
