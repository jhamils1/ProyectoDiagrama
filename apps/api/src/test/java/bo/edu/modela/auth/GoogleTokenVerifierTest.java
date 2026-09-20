package bo.edu.modela.auth;

import static org.assertj.core.api.Assertions.*;

import com.nimbusds.jose.*;
import com.nimbusds.jose.crypto.RSASSASigner;
import com.nimbusds.jose.jwk.*;
import com.nimbusds.jose.jwk.gen.RSAKeyGenerator;
import com.nimbusds.jwt.*;
import java.time.Instant;
import java.util.Date;
import org.junit.jupiter.api.*;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;

class GoogleTokenVerifierTest {
  static RSAKey key;
  GoogleTokenVerifier verifier;

  @BeforeAll
  static void keys() throws Exception {
    key = new RSAKeyGenerator(2048).generate();
  }

  @BeforeEach
  void setup() throws Exception {
    verifier =
        new GoogleTokenVerifier(
            "expected-client", NimbusJwtDecoder.withPublicKey(key.toRSAPublicKey()).build());
  }

  String token(
      String issuer, String audience, Instant expiry, String nonce, boolean verified, RSAKey signer)
      throws Exception {
    var claims =
        new JWTClaimsSet.Builder()
            .issuer(issuer)
            .subject("stable-subject")
            .audience(audience)
            .expirationTime(Date.from(expiry))
            .issueTime(Date.from(Instant.now()))
            .claim("email", "persona@gmail.com")
            .claim("email_verified", verified)
            .claim("name", "Persona")
            .claim("nonce", nonce)
            .build();
    var jwt = new SignedJWT(new JWSHeader(JWSAlgorithm.RS256), claims);
    jwt.sign(new RSASSASigner(signer));
    return jwt.serialize();
  }

  @Test
  void acceptsValidSignatureAndClaims() throws Exception {
    var result =
        verifier.verify(
            token(
                "https://accounts.google.com",
                "expected-client",
                Instant.now().plusSeconds(300),
                "nonce",
                true,
                key),
            "nonce");
    assertThat(result.subject()).isEqualTo("stable-subject");
    assertThat(result.authoritativeEmail()).isTrue();
  }

  @Test
  void rejectsWrongAudience() throws Exception {
    var t =
        token(
            "https://accounts.google.com",
            "other",
            Instant.now().plusSeconds(300),
            "nonce",
            true,
            key);
    assertThatThrownBy(() -> verifier.verify(t, "nonce"))
        .isInstanceOf(bo.edu.modela.shared.ApiException.class);
  }

  @Test
  void rejectsWrongIssuer() throws Exception {
    var t =
        token(
            "https://evil.example",
            "expected-client",
            Instant.now().plusSeconds(300),
            "nonce",
            true,
            key);
    assertThatThrownBy(() -> verifier.verify(t, "nonce"))
        .isInstanceOf(bo.edu.modela.shared.ApiException.class);
  }

  @Test
  void rejectsExpired() throws Exception {
    var t =
        token(
            "https://accounts.google.com",
            "expected-client",
            Instant.now().minusSeconds(300),
            "nonce",
            true,
            key);
    assertThatThrownBy(() -> verifier.verify(t, "nonce"))
        .isInstanceOf(bo.edu.modela.shared.ApiException.class);
  }

  @Test
  void rejectsWrongNonce() throws Exception {
    var t =
        token(
            "https://accounts.google.com",
            "expected-client",
            Instant.now().plusSeconds(300),
            "other",
            true,
            key);
    assertThatThrownBy(() -> verifier.verify(t, "nonce"))
        .isInstanceOf(bo.edu.modela.shared.ApiException.class);
  }

  @Test
  void rejectsUnverifiedEmail() throws Exception {
    var t =
        token(
            "https://accounts.google.com",
            "expected-client",
            Instant.now().plusSeconds(300),
            "nonce",
            false,
            key);
    assertThatThrownBy(() -> verifier.verify(t, "nonce"))
        .isInstanceOf(bo.edu.modela.shared.ApiException.class);
  }

  @Test
  void rejectsForgedSignature() throws Exception {
    var t =
        token(
            "https://accounts.google.com",
            "expected-client",
            Instant.now().plusSeconds(300),
            "nonce",
            true,
            new RSAKeyGenerator(2048).generate());
    assertThatThrownBy(() -> verifier.verify(t, "nonce"))
        .isInstanceOf(bo.edu.modela.shared.ApiException.class);
  }
}
