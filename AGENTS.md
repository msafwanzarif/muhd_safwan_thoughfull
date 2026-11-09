# Backend conventions

- Define a response DTO for every endpoint response body and reference that class in Swagger response declarations. Use DTOs for error bodies too; 204 responses have no body and need no DTO.
- Add explicit controller return types matching the response DTOs. Serialize dates as ISO 8601 strings.
- Keep one schema file per table. Declare API versions on controllers.
- Keep blank lines between methods and DTO fields. Run npm run lint and npm run build after changes; run relevant integration tests for behavior changes.
