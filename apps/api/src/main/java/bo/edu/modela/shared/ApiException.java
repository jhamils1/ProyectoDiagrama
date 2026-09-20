package bo.edu.modela.shared;

import org.springframework.http.HttpStatus;

public class ApiException extends RuntimeException {
  public final HttpStatus status;
  public final String code;

  public ApiException(HttpStatus status, String code, String message) {
    super(message);
    this.status = status;
    this.code = code;
  }

  public static ApiException unauthorized() {
    return new ApiException(
        HttpStatus.UNAUTHORIZED,
        "NO_AUTENTICADO",
        "Credenciales inválidas o cuenta no disponible.");
  }

  public static ApiException forbidden() {
    return new ApiException(
        HttpStatus.FORBIDDEN, "SIN_PERMISO", "No tienes permiso para realizar esta operación.");
  }

  public static ApiException notFound() {
    return new ApiException(
        HttpStatus.NOT_FOUND, "NO_ENCONTRADO", "El recurso no existe o no está disponible.");
  }

  public static ApiException conflict(String message) {
    return new ApiException(HttpStatus.CONFLICT, "CONFLICTO", message);
  }
}
