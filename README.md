# Idempotency Gateway

## Architecture & Logic Flow

```mermaid
sequenceDiagram
    autonumber
    actor Client as Client System (E-Commerce)
    participant Gateway as Idempotency Gateway (Express)
    participant Store as In-Memory Store (Map)
    participant Processor as Payment Processor (Simulated)

    %% ==========================================
    %% SCENARIO 1: FIRST TRANSACTION (HAPPY PATH)
    %% ==========================================
    Note over Client, Processor: Scenario 1: New Transaction (Happy Path)
    Client->>Gateway: POST /process-payment (Key: "tx-001", Payload: {amount: 100})
    Gateway->>Store: Lookup Key "tx-001"
    Store-->>Gateway: Not Found (New Key)
    Gateway->>Gateway: Generate Hash(Payload)
    Gateway->>Store: Save { status: 'IN_FLIGHT', payloadHash, activePromise }
    Gateway->>Processor: Execute Payment (2-Second Async Delay)
    Processor-->>Gateway: Payment Successful (Transaction ID Generated)
    Gateway->>Store: Update { status: 'COMPLETED', response }
    Gateway-->>Client: 201 Created | Header: X-Cache-Hit: false

    %% ==========================================
    %% SCENARIO 2: DUPLICATE ATTEMPT (CACHED HIT)
    %% ==========================================
    Note over Client, Processor: Scenario 2: Duplicate Attempt (Network Retry)
    Client->>Gateway: POST /process-payment (Key: "tx-001", Payload: {amount: 100})
    Gateway->>Store: Lookup Key "tx-001"
    Store-->>Gateway: Found { status: 'COMPLETED', payloadHash, response }
    Gateway->>Gateway: Generate Hash(Payload) & Compare with Store
    Note over Gateway: Hashes Match! Transaction already completed.
    Gateway-->>Client: 201 Created (Cached Response) | Header: X-Cache-Hit: true [Instant Return]

    %% ==========================================
    %% SCENARIO 3: FRAUD / ERROR CHECK (MISMATCH)
    %% ==========================================
    Note over Client, Processor: Scenario 3: Different Payload, Same Key (Fraud/Error Check)
    Client->>Gateway: POST /process-payment (Key: "tx-001", Payload: {amount: 500} - CHANGED!)
    Gateway->>Store: Lookup Key "tx-001"
    Store-->>Gateway: Found { status: 'COMPLETED' or 'IN_FLIGHT', payloadHash }
    Gateway->>Gateway: Generate Hash(Payload) & Compare with Store
    Note over Gateway, Store: CRITICAL: Payload Hash Mismatch Detected!
    Gateway-->>Client: 422 Unprocessable Entity ("Key already used for different payload")

    %% ==========================================
    %% SCENARIO 4: CONCURRENT RACE CONDITION
    %% ==========================================
    Note over Client, Processor: Scenario 4: Concurrent "In-Flight" Race Condition (Bonus)
    Client->>Gateway: POST /process-payment (Key: "tx-002") [Request A]
    Gateway->>Store: Save { status: 'IN_FLIGHT', activePromise: Promise A }
    Gateway->>Processor: Execute Payment (2-Second Delay Starts...)
    
    Client->>Gateway: POST /process-payment (Key: "tx-002") [Request B - Arrives at +50ms]
    Gateway->>Store: Lookup Key "tx-002"
    Store-->>Gateway: Found { status: 'IN_FLIGHT', activePromise: Promise A }
    Note over Gateway: Request B detects IN_FLIGHT state.<br/>Instead of failing or starting a new charge, it awaits Promise A.
    Processor-->>Gateway: Promise A Resolves (Payment Successful)
    Gateway-->>Client: Request A receives 201 Created | X-Cache-Hit: false
    Gateway-->>Client: Request B receives identical 201 Created | X-Cache-Hit: true
```mermaid