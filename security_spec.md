# Security Specification - Church Management System

## Data Invariants
1. A transaction must belong to the user who created it and cannot be modified by others.
2. An event's creator ID must match the authenticated user.
3. Members and Suppliers are private to the user who registered them.

## The "Dirty Dozen" Payloads (Deny Cases)

### Identity Spoofing
1. `create` transaction with `userId: "malicious_user"` while auth is "valid_user".
2. `update` transaction `userId` field to a different value.

### Integrity & Type Poisoning
3. `create` transaction with `value: "one million"` (string instead of number).
4. `create` event with `title` being a 2MB string.
5. `create` member without a `nome` field.

### State & Logic Gap
6. `update` a `Transaction` to change `updatedAt` to a past date (instead of server time).
7. `update` a `Transaction` status without being the owner.

### Resource Exhaustion / ID Poisoning
8. `create` a document with an ID that is a 2KB junk string.
9. `list` transactions without filtering by `userId` (attempt to scrape all data).

### PII Leakage
10. `get` a member profile as another user.
11. `list` members as a visitor (non-authenticated).

### Relational Orphan
12. `create` an event with a `createdBy` that doesn't match the current user ID.

## Test Runner (Abstract logic for firestore.rules.test.ts)
- Setup auth as User A and User B.
- Verify User A cannot read/write User B's documents.
- Verify strict type and size checks on all fields in `isValid[Entity]` helpers.
