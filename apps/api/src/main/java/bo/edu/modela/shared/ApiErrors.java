package bo.edu.modela.shared;

import java.util.Map;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;

@RestControllerAdvice
public class ApiErrors {
  @ExceptionHandler(ApiException.class)
  ResponseEntity<?> application(ApiException ex) {
    return ResponseEntity.status(ex.status)
        .body(Map.of("code", ex.code, "message", ex.getMessage()));
  }

  @ExceptionHandler(MethodArgumentNotValidException.class)
  ResponseEntity<?> invalid(MethodArgumentNotValidException ex) {
    return ResponseEntity.badRequest()
        .body(
            Map.of(
                "code",
                "DATOS_INVALIDOS",
                "message",
                "Revisa los campos obligatorios y sus límites."));
  }

  @ExceptionHandler({
    HttpMessageNotReadableException.class,
    MethodArgumentTypeMismatchException.class
  })
  ResponseEntity<?> malformed(Exception ex) {
    return ResponseEntity.badRequest()
        .body(
            Map.of(
                "code",
                "SOLICITUD_INVALIDA",
                "message",
                "El formato de la solicitud no es válido."));
  }

  @ExceptionHandler(DataIntegrityViolationException.class)
  ResponseEntity<?> duplicate(DataIntegrityViolationException ex) {
    return ResponseEntity.status(409)
        .body(
            Map.of(
                "code",
                "DUPLICADO",
                "message",
                "Ya existe ese correo, proyecto, identidad o participante. Revisa los datos."));
  }

  @ExceptionHandler(OptimisticLockingFailureException.class)
  ResponseEntity<?> stale(OptimisticLockingFailureException ex) {
    return ResponseEntity.status(409)
        .body(
            Map.of(
                "code",
                "VERSION_DESACTUALIZADA",
                "message",
                "Los datos cambiaron. Recarga antes de volver a guardar."));
  }
}
