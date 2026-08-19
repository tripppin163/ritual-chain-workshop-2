// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/**
 * Test-only stand-ins for the Ritual Chain system contracts and precompiles.
 *
 * Ritual's capabilities live at fixed addresses, so a test cannot inject a different
 * implementation — it has to put one *at those addresses*. Every test here does that
 * with `vm.etch` (Solidity) or `hardhat_setCode` (TypeScript), which copies runtime
 * code but not storage. Nothing below may therefore rely on constructor-initialised
 * storage: every mock has to behave correctly starting from an all-zero slot space.
 *
 * The two precompile mocks are reached through raw ABI-encoded calldata with no
 * function selector, so they serve requests from `fallback()`. Their own configuration
 * functions are still safe to keep on the same contract: a genuine request always
 * begins with a left-padded `address` or a `0x60` offset word, so its first four bytes
 * are `0x00000000` and can never collide with a real selector.
 */

// ─────────────────────────── HTTP precompile (0x0801) ───────────────────────────

/*
 * The 13-field request layout of the HTTP precompile:
 *
 *   0 address  executor          7 string[] headerKeys
 *   1 bytes[]  encryptedSecrets  8 string[] headerValues
 *   2 uint256  ttl               9 bytes    body
 *   3 bytes[]  secretSignatures 10 uint256  dkmsKeyIndex
 *   4 bytes    userPublicKey    11 uint8    dkmsKeyFormat
 *   5 string   url              12 bool     piiEnabled
 *   6 uint8    method
 *
 * The mock decodes it in full so that a wrongly encoded field makes the decode revert
 * and the test fail — which is the entire reason to decode it rather than ignore it.
 *
 * Decoded as thirteen separate values, NOT as one struct: `abi.encode(a, b, c)` and
 * `abi.encode(Struct(a, b, c))` are different encodings. A struct with dynamic members
 * is itself a dynamic type, so encoding one prepends an offset word that the flat
 * precompile layout does not have.
 */

contract MockHttpPrecompile {
    enum Kind {
        Response, // a well-formed envelope carrying status/body/error
        Malformed, // bytes that are not a valid async envelope at all
        Unsettled, // valid envelope, empty actualOutput (simulation, pre-settlement)
        Revert // the precompile call itself fails
    }

    struct Queued {
        Kind kind;
        uint16 status;
        bytes body;
        string errorMessage;
    }

    /// Consumed in order; the last entry is sticky, so a test that queues one response
    /// gets it for every retry.
    Queued[] private _queue;
    uint256 public served;

    // Last request seen, kept flat so tests can assert on the encoding.
    address public lastExecutor;
    uint256 public lastTtl;
    string public lastUrl;
    uint8 public lastMethod;
    uint256 public lastHeaderCount;
    uint256 public lastBodyLength;
    bool public lastPiiEnabled;

    function queueResponse(
        uint16 status,
        bytes calldata body,
        string calldata errorMessage
    ) external {
        _queue.push(Queued(Kind.Response, status, body, errorMessage));
    }

    function queueJson(string calldata json) external {
        _queue.push(Queued(Kind.Response, 200, bytes(json), ""));
    }

    function queueKind(Kind kind) external {
        _queue.push(Queued(kind, 0, "", ""));
    }

    function queued() external view returns (uint256) {
        return _queue.length;
    }

    /// A `Kind.Revert` entry rolls back the cursor along with everything else it
    /// touched, so a test that wants attempt N to behave differently has to re-queue
    /// between attempts rather than rely on the queue advancing itself.
    function reset() external {
        delete _queue;
        served = 0;
    }

    fallback(bytes calldata request) external returns (bytes memory) {
        // Decoded in three scoped passes rather than one: thirteen values in a single
        // `abi.decode` blows the stack. Each pass decodes a valid prefix of the same
        // payload — ABI offsets are absolute from the start of the encoding, so a
        // shorter head is still read correctly.
        {
            (
                address executor,
                ,
                uint256 ttl,
                ,
                ,
                string memory url,
                uint8 method
            ) = abi.decode(
                    request,
                    (address, bytes[], uint256, bytes[], bytes, string, uint8)
                );
            require(executor != address(0), "mock: no executor supplied");
            require(ttl > 0, "mock: zero ttl");
            require(method == 1, "mock: only GET is stubbed");
            lastExecutor = executor;
            lastTtl = ttl;
            lastUrl = url;
            lastMethod = method;
        }
        {
            (
                ,
                ,
                ,
                ,
                ,
                ,
                ,
                string[] memory headerKeys,
                string[] memory headerValues,
                bytes memory body
            ) = abi.decode(
                    request,
                    (
                        address,
                        bytes[],
                        uint256,
                        bytes[],
                        bytes,
                        string,
                        uint8,
                        string[],
                        string[],
                        bytes
                    )
                );
            require(headerKeys.length == headerValues.length, "mock: header mismatch");
            lastHeaderCount = headerKeys.length;
            lastBodyLength = body.length;
        }
        // The three trailing fields are static, so they sit in the head at fixed word
        // offsets and can be read straight out of calldata — cheaper than decoding the
        // whole 13-field tuple, which overflows the stack.
        require(abi.decode(request[320:352], (uint256)) == 0, "mock: dkms unsupported");
        require(abi.decode(request[352:384], (uint8)) == 0, "mock: dkms unsupported");
        lastPiiEnabled = abi.decode(request[384:416], (bool));

        require(_queue.length > 0, "mock: no queued response");

        uint256 index = served < _queue.length ? served : _queue.length - 1;
        served++;
        Queued storage q = _queue[index];

        if (q.kind == Kind.Revert) revert("mock: executor unavailable");
        if (q.kind == Kind.Malformed) return hex"deadbeef";
        if (q.kind == Kind.Unsettled) return abi.encode(request, bytes(""));

        bytes memory actualOutput = abi.encode(
            q.status,
            new string[](0),
            new string[](0),
            q.body,
            q.errorMessage
        );
        return abi.encode(request, actualOutput);
    }
}

// ──────────────────────────── jq precompile (0x0803) ────────────────────────────

/**
 * Minimal jq stand-in: resolves the last segment of a `.a.b.c` path against a flat
 * JSON object and returns it as a uint256.
 *
 * Faithful where it matters for this contract: a value that is not a bare integer, a
 * missing key, or a non-uint256 `outputType` all return `ok = true` with a zero-length
 * output — exactly how the real precompile signals "wrong type" — which is the branch
 * `RitualPredict._jqUint` guards with its length check.
 */
contract MockJqPrecompile {
    // No storage writes anywhere in this contract: RitualPredict reaches jq through
    // STATICCALL, which reverts the moment a callee touches state.
    fallback(bytes calldata input) external returns (bytes memory) {
        (string memory query, string memory json, uint8 outputType) = abi.decode(
            input,
            (string, string, uint8)
        );

        if (outputType != 1) return "";

        bytes memory key = _lastSegment(bytes(query));
        if (key.length == 0) return "";

        (bool found, uint256 value) = _readUint(bytes(json), key);
        if (!found) return "";
        return abi.encode(value);
    }

    function _lastSegment(bytes memory query) private pure returns (bytes memory) {
        uint256 start = 0;
        for (uint256 i = 0; i < query.length; i++) {
            if (query[i] == ".") start = i + 1;
        }
        bytes memory out = new bytes(query.length - start);
        for (uint256 i = 0; i < out.length; i++) out[i] = query[start + i];
        return out;
    }

    /// Finds `"key"`, skips `":"` and spaces, then parses digits. No decimals, no
    /// exponents, no quoted numbers — a quoted value reports "not found", which is the
    /// behaviour the jq-failure tests rely on.
    function _readUint(
        bytes memory json,
        bytes memory key
    ) private pure returns (bool, uint256) {
        for (uint256 i = 0; i + key.length + 2 <= json.length; i++) {
            if (json[i] != '"') continue;
            bool match_ = true;
            for (uint256 k = 0; k < key.length; k++) {
                if (json[i + 1 + k] != key[k]) {
                    match_ = false;
                    break;
                }
            }
            if (!match_ || json[i + key.length + 1] != '"') continue;

            uint256 j = i + key.length + 2;
            while (j < json.length && (json[j] == " " || json[j] == ":")) j++;

            uint256 value = 0;
            uint256 digits = 0;
            while (j < json.length && json[j] >= "0" && json[j] <= "9") {
                value = value * 10 + (uint8(json[j]) - 48);
                digits++;
                j++;
            }
            if (digits == 0) return (false, 0);
            return (true, value);
        }
        return (false, 0);
    }
}

// ───────────────────────── Scheduler system contract ─────────────────────────

contract MockScheduler {
    enum CallState {
        Scheduled,
        Executing,
        Completed,
        Cancelled,
        Expired
    }

    struct Call {
        address target;
        bytes data;
        uint32 gas;
        uint32 startBlock;
        uint32 numCalls;
        uint32 frequency;
        uint32 ttl;
        uint256 maxFeePerGas;
        uint256 maxPriorityFeePerGas;
        uint256 value;
        address payer;
        CallState state;
        uint32 fired;
    }

    uint256 public callCount;
    mapping(uint256 => Call) private _calls;
    mapping(address => mapping(address => bool)) public approved;

    bool public rejectSchedule;
    /// The real Scheduler cannot cancel a call while it is executing. Flip this to
    /// exercise the other branch of RitualPredict's `try cancel`.
    bool public cancellableWhileExecuting;

    event Fired(uint256 indexed callId, uint256 executionIndex, bool success);

    function setRejectSchedule(bool value) external {
        rejectSchedule = value;
    }

    function setCancellableWhileExecuting(bool value) external {
        cancellableWhileExecuting = value;
    }

    function approveScheduler(address schedulerContract) external {
        approved[msg.sender][schedulerContract] = true;
    }

    function schedule(
        bytes calldata data,
        uint32 gas,
        uint32 startBlock,
        uint32 numCalls,
        uint32 frequency,
        uint32 ttl,
        uint256 maxFeePerGas,
        uint256 maxPriorityFeePerGas,
        uint256 value,
        address payer
    ) external returns (uint256 callId) {
        require(!rejectSchedule, "mock: schedule rejected");
        require(uint256(frequency) * numCalls <= 10_000, "ScheduleLifespanExceeded");
        require(ttl <= 500, "TTLTooLarge");
        require(msg.sender.code.length > 0, "only contracts may schedule");

        callId = ++callCount; // ids start at 1, from zero storage
        _calls[callId] = Call({
            target: msg.sender,
            data: data,
            gas: gas,
            startBlock: startBlock,
            numCalls: numCalls,
            frequency: frequency,
            ttl: ttl,
            maxFeePerGas: maxFeePerGas,
            maxPriorityFeePerGas: maxPriorityFeePerGas,
            value: value,
            payer: payer,
            state: CallState.Scheduled,
            fired: 0
        });
    }

    function cancel(uint256 callId) external {
        Call storage c = _calls[callId];
        require(c.target != address(0), "unknown call");
        require(msg.sender == c.target, "not the scheduler's caller");
        if (c.state == CallState.Executing) {
            require(cancellableWhileExecuting, "call is executing");
        } else {
            require(c.state == CallState.Scheduled, "call is not active");
        }
        c.state = CallState.Cancelled;
    }

    function getCallState(uint256 callId) external view returns (uint8) {
        return uint8(_calls[callId].state);
    }

    function getCall(uint256 callId) external view returns (Call memory) {
        return _calls[callId];
    }

    /**
     * Test driver: run one scheduled execution the way the chain would — from this
     * address, with the real `executionIndex` written into calldata bytes 4-35.
     */
    function fire(uint256 callId, uint256 executionIndex) external returns (bool success) {
        Call storage c = _calls[callId];
        require(c.target != address(0), "unknown call");
        require(c.state == CallState.Scheduled, "call is not scheduled");

        bytes memory data = c.data;
        require(data.length >= 36, "callback needs a uint256 first argument");
        assembly {
            mstore(add(data, 36), executionIndex)
        }

        c.state = CallState.Executing;
        (success, ) = c.target.call{gas: c.gas}(data);
        c.fired++;

        if (c.state == CallState.Executing) {
            c.state = c.fired >= c.numCalls ? CallState.Completed : CallState.Scheduled;
        }
        emit Fired(callId, executionIndex, success);
    }
}

// ────────────────────────── RitualWallet system contract ──────────────────────────

contract MockRitualWallet {
    mapping(address => uint256) public balanceOf;
    mapping(address => uint256) public lockUntil;

    function deposit(uint256 lockDuration) external payable {
        balanceOf[msg.sender] += msg.value;
        uint256 until_ = block.number + lockDuration;
        if (until_ > lockUntil[msg.sender]) lockUntil[msg.sender] = until_;
    }
}

// ───────────────────────── TEEServiceRegistry system contract ─────────────────────

contract MockTEEServiceRegistry {
    address[] private _executors;
    bool public shouldRevert;
    /// Returns the seed itself as the executor address, so a test can prove the seed
    /// is re-rolled between attempts without depending on registry size or luck.
    bool public echoSeed;

    function setExecutors(address[] calldata executors) external {
        delete _executors;
        for (uint256 i = 0; i < executors.length; i++) _executors.push(executors[i]);
    }

    function setShouldRevert(bool value) external {
        shouldRevert = value;
    }

    function setEchoSeed(bool value) external {
        echoSeed = value;
    }

    function pickServiceByCapability(
        uint8 capability,
        bool,
        uint256 seed,
        uint256 maxProbes
    ) external view returns (address teeAddress, bool found) {
        require(!shouldRevert, "mock: registry unavailable");
        require(capability == 0, "mock: only HTTP_CALL is registered");
        require(maxProbes > 0, "mock: maxProbes must be positive");
        if (echoSeed) return (address(uint160(seed)), true);
        if (_executors.length == 0) return (address(0), false);
        return (_executors[seed % _executors.length], true);
    }
}

// ─────────────────────────────── Misc test doubles ────────────────────────────────

/// Refuses every incoming transfer, so `_pay` fails and `TransferFailed` surfaces.
contract RejectingReceiver {
    function bet(address predict, uint256 marketId, bool isYes) external payable {
        (bool ok, ) = predict.call{value: msg.value}(
            abi.encodeWithSignature("bet(uint256,bool)", marketId, isYes)
        );
        require(ok, "bet failed");
    }

    function claim(address predict, uint256 marketId) external {
        (bool ok, bytes memory err) = predict.call(
            abi.encodeWithSignature("claimWinnings(uint256)", marketId)
        );
        if (!ok) {
            assembly {
                revert(add(err, 32), mload(err))
            }
        }
    }

    receive() external payable {
        revert("no thanks");
    }
}
