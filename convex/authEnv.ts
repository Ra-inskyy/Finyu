const DEFAULT_RSA_PRIVATE_KEY = `-----BEGIN PRIVATE KEY-----
MIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQDy/U3yM9jWWpE0
Z3g3KFpHEIXsvxmMpGBsXlQmiWJRFYY4Ol0xOg5VU8NZFSBAS4vvF7zApgeoQ6M4
337OU/WmopSGpf8wLV7eS9D3NY6SYdFV/ZugXTZzDAsjFXJ62X1vO//xTuAo1Z54
Mlm01MMOFQWQditSxvdtKhepcb7AJ+4ZxHj17OJPLCdMq/5CIkW3uauVsatvdqdO
h2/IpLD7t0UMOncu0liHiOxDuRwLf8gp78J5tlwwM/Y4DSegAeDvAAEyqyo8oh/Y
SgGEsDadEIuzCeq367RwGCQTkXVis0J3mEV9y1Jy350911GOx3M/OXc/6DwREl0H
DZR1Y2YHAgMBAAECggEAJ+oOu70N3r18d1c9Gr0OLKOSMZQn5j+6Ib2npQzm5tra
SVziTLZ0qZ+GH0P7yulIpeWy+RJM1Qmx7iMITsGL60DEP7n/c90quulJUiessRml
rAe/YKrvHsbZAtJVvnMAynIuAL2BejOyQZxDur3trIqCIiYccmSB5Z9cc6uzjGyw
x2y72SGRRSICAdIQtfP3KXPvPkgDnhBWwBwCfi7kade+SyiWopgpPzn8kU9l3N0z
jLpgz9EGgokzQgCN7HSNJ0kW062oob2JHbeAJvGqSoSJ+y4ZNyymzhA+SuAZ3lQM
UTtKC2r0vRPdyWtpB2PrSiGNFi+di/SQpilku5TMAQKBgQD6Ls3MfZHKp5CjZ55c
euxZw4LoaJga540UyDwbC95eON5EFnBYE+x7o4TMhPOzBT5QuRRlHxRsTlkHdiYV
B3O4oMfhGz0zPcQYRnEnZzrWVlUXn/Km2najpd+JiE2aVCA+wB/4fkq4/l4mAHfj
JUN3gZx5R6u8qALdP/16x6yFxwKBgQD4o66/m70SjJQuAV2ZeHd/EjLANNqdAXH8
qwInR/9lpA6FfROzq6LOkuWYZ+1hYHvMDUie/4b2dLpDh0gIlZRVbZZW1KzlMNE3
LeSSHUnYWGOVDmV55Q3gZ4JQNnTC7ws/MyKtm4HdLgn9fLG/QtewUzec05kuylmV
VjOreX0dwQKBgQCUNypBHZtDviXYSMju7Pwc6dEiMuT5+3f/eejx9QQWOgaju89u
vs75KJTCPXnK8y5J0HwetFz7FSd1Xi+Ngc6y8L25xNNrCgqkfwcGWwfmd1sOFfpB
k2d56AkYh6HB7lj0FApcwyUtl7TbOqfL8AWaRTUYPLenmrmnrgNTu/uffQKBgBvP
IuJnZtRGSOSEXpWltafOv0JkJvdcjAU4kzsVgGk72ivv+14jGkiEgY10Qkab5fzC
l5bA+bVjBNo8rT/YiwirAx+fFd9kgGHtjh0RjYrXB/xJ6euiRNUOfrK+BH0xA08E
RyKnu/SjC5cAdVjw/vLHu/acbAuhsjdTtt+87NOBAoGBANCK+lKIbUXKf/43xNP1
GWX7JJVUc5EGrQKD3ctLPoeoILsU7rwaGKs7rLsNjbiiM+iRSbLaksqGacybYcsE
q3/knIP0ZSloBqOJQ+wloVQdT9fJZfJJCTHk18tpb4uKTNCmJiy3nwBN1CgMDb9V
XNDG15RBryjpEB8CnPW5kH/U
-----END PRIVATE KEY-----`;

const DEFAULT_JWKS = JSON.stringify({
  keys: [
    {
      use: "sig",
      kty: "RSA",
      n: "8v1N8jPY1lqRNGd4NyhaRxCF7L8ZjKRgbF5UJoliURWGODpdMToOVVPDWRUgQEuL7xe8wKYHqEOjON9-zlP1pqKUhqX_MC1e3kvQ9zWOkmHRVf2boF02cwwLIxVyetl9bzv_8U7gKNWeeDJZtNTDDhUFkHYrUsb3bSoXqXG-wCfuGcR49eziTywnTKv-QiJFt7mrlbGrb3anTodvyKSw-7dFDDp3LtJYh4jsQ7kcC3_IKe_CebZcMDP2OA0noAHg7wABMqsqPKIf2EoBhLA2nRCLswnqt-u0cBgkE5F1YrNCd5hFfctSct-dPddRjsdzPzl3P-g8ERJdBw2UdWNmBw",
      e: "AQAB",
      alg: "RS256",
    },
  ],
});

function formatPemKey(raw: string | undefined): string {
  if (!raw) return DEFAULT_RSA_PRIVATE_KEY;
  let s = raw.trim();
  if (s.startsWith('"') && s.endsWith('"')) {
    s = s.slice(1, -1).trim();
  }

  const base64Body = s
    .replace(/-----BEGIN[^-]+-----/g, "")
    .replace(/-----END[^-]+-----/g, "")
    .replace(/\\n/g, "")
    .replace(/\\/g, "")
    .replace(/\s+/g, "");

  if (!base64Body || base64Body.length < 100) {
    return DEFAULT_RSA_PRIVATE_KEY;
  }

  const lines = base64Body.match(/.{1,64}/g) || [base64Body];
  return `-----BEGIN PRIVATE KEY-----\n${lines.join("\n")}\n-----END PRIVATE KEY-----`;
}

process.env.AUTH_PRIVATE_KEY = formatPemKey(process.env.AUTH_PRIVATE_KEY);
process.env.JWT_PRIVATE_KEY = formatPemKey(process.env.JWT_PRIVATE_KEY);

if (!process.env.JWKS || process.env.JWKS.trim() === "") {
  process.env.JWKS = DEFAULT_JWKS;
}
