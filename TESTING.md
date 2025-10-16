# Testing Notes

- `node --test` currently fails because the Postgres database is not running/accessible in this environment (ECONNREFUSED on 127.0.0.1:5432).
- All failures originate from the test setup that truncates tables before running the event route assertions.

Run with:

```
node --test --test-reporter=tap test/eventTest.js
```
