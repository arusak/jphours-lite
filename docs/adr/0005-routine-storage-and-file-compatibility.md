# Separate Routine storage compatibility from file transfer

Saved browser data must survive supported migrations, while imported files need an explicit transfer contract. Persisted Routine data accepts supported schema versions through tolerant ingress schemas, repairs supported legacy values, and then validates the resulting current domain shape. Version 1 data migrates to the current version 2 Routine model. Invalid persisted data falls back to a default Routine. Domain validation remains the authoritative editor validity result and supplies user-facing validation feedback.

Routine files use a separate strict JSON envelope: `format: "jphours-routine"`, `formatVersion: 1`, `exportedAt`, and `routine`. The transfer shape excludes local IDs and update timestamps; import creates fresh identities. Unknown fields, unsupported versions, invalid domain values, and files exceeding the byte limit are rejected. File format version and persisted schema version are independent: changing local identity or storage layout does not inherently require changing the portable format.

Migration stays in the persistence boundary, and serialization/parsing stays behind the Routine file service rather than in domain types or UI components. A confirmed import is saved before pending debounced edits are cancelled and editor state is replaced, preventing an older edit from overwriting the imported Routine. This separates compatibility repair from strict transfer validation; it does not provide storage-failure recovery, which remains outstanding.

Implementation:

- [Persistence migration](../../src/services/persistence/routine-repository.ts), [domain validation](../../src/domain/validation.ts), [file codec](../../src/services/routine-files/routine-file.ts), and [editor replacement](../../src/features/routine-editor/hooks/useRoutineEditor.ts).
- [Persistence tests](../../src/services/persistence/routine-repository.test.ts), [file adversarial tests](../../src/services/routine-files/routine-file.test.ts), and [debounced-save tests](../../src/services/persistence/debounced-routine-saver.test.ts).
