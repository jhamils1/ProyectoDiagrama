# Verificar la exportacion en Enterprise Architect

El endpoint de descarga usa `EaXmiWriter.writeEnterpriseArchitect11`. Este formato
es XMI 1.1 / UML 1.3 con las extensiones nativas de EA; no debe confundirse con el
exportador semantico UML 2.5 `write`.

La cabecera `XMI.exporter=Enterprise Architect` y `XMI.exporterVersion=2.5`
activa la lectura de metadatos nativos. Las clases deben estar dentro de un
`UML:Package` y el `UML:Diagram` debe ser hermano del modelo en `XMI.content`.
Sin esa estructura, EA puede importar asociaciones bidireccionales y una clase
Detalle independiente aunque el XML incluya etiquetas de clase de asociacion.

La prueba `nativeEaEnvelopeKeepsPackageDiagramAndAssociationClassReferencesTogether`
genera `apps/api/target/ea-interop/association-class.xml`. Tras ejecutar las pruebas
`EaXmi*Test`, en Windows con EA instalado se puede ejecutar:

```powershell
./scripts/test-ea-xmi.ps1
# O comprobar una descarga concreta:
./scripts/test-ea-xmi.ps1 -XmlFile 'ruta/al/diagrama.xml'
```

El script copia `EABase.eap` a un proyecto nuevo bajo `.local/ea-interop`, importa
con regeneracion de GUIDs y comprueba clases, atributos, multiplicidades,
navegabilidad y ambos extremos del vinculo de la clase de asociacion.
Tambien genera dos imagenes: el diagrama importado y otro donde coloca los
elementos existentes, con la clase de asociacion al final. No crea relaciones
manualmente. Las imagenes permiten comprobar la linea punteada y la visibilidad
de los atributos. Nunca se conecta al modelo que el usuario tiene abierto.

`-EaTemplate` permite indicar otra instalacion compatible de EA con plantilla
EAP. Esta prueba es opcional y requiere EA COM; las pruebas Java no la sustituyen.
