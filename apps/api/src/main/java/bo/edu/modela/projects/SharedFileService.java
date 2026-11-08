package bo.edu.modela.projects;

import bo.edu.modela.auth.CurrentUser;
import bo.edu.modela.shared.ApiException;
import java.time.Instant;
import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class SharedFileService {
  public record FileInfo(UUID id, String name, long size, String author, Instant createdAt, boolean canDelete) {}
  public record Download(String name, byte[] data) {}
  private final ProyectoRepository projects;
  private final ProyectoService access;
  private final CurrentUser current;
  private final JdbcTemplate jdbc;
  public SharedFileService(ProyectoRepository projects, ProyectoService access, CurrentUser current, JdbcTemplate jdbc) {
    this.projects=projects; this.access=access; this.current=current; this.jdbc=jdbc;
  }
  private static final Set<String> EXTENSIONS = Set.of("txt", "pdf", "png", "jpg", "jpeg", "xml", "xmi", "json", "csv", "docx", "xlsx");
  private void lock(UUID project) {
    projects.findLocked(project).filter(p -> p.eliminadoEn == null).orElseThrow(ApiException::notFound);
    access.get(project);
  }
  @Transactional(readOnly=true)
  public List<FileInfo> list(UUID project) {
    var permission=access.get(project).permiso();
    UUID user=current.get().id;
    return jdbc.query("SELECT id,nombre,tamano,autor_nombre,autor_id,fecha_creacion FROM archivo_compartido WHERE proyecto_id=? ORDER BY fecha_creacion DESC,id DESC LIMIT 100",
        (rs,n)->new FileInfo(rs.getObject("id",UUID.class),rs.getString("nombre"),rs.getLong("tamano"),rs.getString("autor_nombre"),
            rs.getTimestamp("fecha_creacion").toInstant(),permission.equals("ADMINISTRACION") || user.equals(rs.getObject("autor_id",UUID.class))),project);
  }
  @Transactional
  public void upload(UUID project, UUID id, String name, byte[] data) {
    var user=current.get();
    lock(project);
    if(id==null || name==null || name.isBlank() || name.length()>180 || name.contains("/") || name.contains("\\") || name.chars().anyMatch(Character::isISOControl)
        || name.lastIndexOf('.')<1 || !EXTENSIONS.contains(name.substring(name.lastIndexOf('.')+1).toLowerCase(Locale.ROOT))
        || data==null || data.length==0 || data.length>5*1024*1024)
      throw new ApiException(HttpStatus.BAD_REQUEST,"ARCHIVO_INVALIDO","Archivo inválido. Usa un tipo admitido y un tamaño de hasta 5 MB.");
    var previous=jdbc.query("SELECT proyecto_id,autor_id,nombre,contenido FROM archivo_compartido WHERE id=?",
        (rs,n)-> new Object[]{rs.getObject(1,UUID.class),rs.getObject(2,UUID.class),rs.getString(3),rs.getBytes(4)},id);
    if(!previous.isEmpty()) {
      var p=previous.getFirst();
      if(!project.equals(p[0]) || !user.id.equals(p[1]) || !name.equals(p[2]) || !java.security.MessageDigest.isEqual(data,(byte[])p[3]))
        throw ApiException.conflict("La clave de carga ya corresponde a otro archivo.");
      return;
    }
    var totals=jdbc.queryForMap("SELECT count(*) AS total,coalesce(sum(tamano),0) AS bytes FROM archivo_compartido WHERE proyecto_id=?",project);
    if(((Number)totals.get("total")).longValue()>=100 || ((Number)totals.get("bytes")).longValue()+data.length>50L*1024*1024)
      throw ApiException.conflict("Se alcanzó el límite del proyecto: 100 archivos o 50 MB.");
    jdbc.update("INSERT INTO archivo_compartido(id,proyecto_id,autor_id,autor_nombre,nombre,contenido,tamano,fecha_creacion) VALUES (?,?,?,?,?,?,?,?)",
        id,project,user.id,user.nombre,name,data,data.length,java.sql.Timestamp.from(Instant.now()));
  }
  @Transactional(readOnly=true)
  public Download download(UUID project, UUID id) {
    access.get(project);
    var rows=jdbc.query("SELECT nombre,contenido FROM archivo_compartido WHERE proyecto_id=? AND id=?",
        (rs,n)->new Download(rs.getString(1),rs.getBytes(2)),project,id);
    if(rows.isEmpty()) throw ApiException.notFound();
    return rows.getFirst();
  }
  @Transactional
  public void delete(UUID project, UUID id) {
    var user=current.get(); lock(project);
    var permission=access.get(project).permiso();
    var owners=jdbc.query("SELECT autor_id FROM archivo_compartido WHERE proyecto_id=? AND id=?",(rs,n)->rs.getObject(1,UUID.class),project,id);
    if(owners.isEmpty()) throw ApiException.notFound();
    if(!permission.equals("ADMINISTRACION") && !owners.getFirst().equals(user.id)) throw ApiException.forbidden();
    jdbc.update("DELETE FROM archivo_compartido WHERE proyecto_id=? AND id=?",project,id);
  }
}
