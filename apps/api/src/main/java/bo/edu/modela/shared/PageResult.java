package bo.edu.modela.shared;

import java.util.List;
import org.springframework.data.domain.*;

public record PageResult<T>(List<T> items, long total, int page, int size) {
  public static <T> PageResult<T> of(Page<T> page) {
    return new PageResult<>(
        page.getContent(), page.getTotalElements(), page.getNumber(), page.getSize());
  }

  public static Pageable request(int page, int size) {
    return PageRequest.of(
        Math.max(0, page), Math.max(1, Math.min(100, size)), Sort.by("nombre").and(Sort.by("id")));
  }
}
