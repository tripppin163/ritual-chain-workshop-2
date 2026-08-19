// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test, Vm} from "forge-std/Test.sol";
import {RitualPredict} from "./RitualPredict.sol";
import {RitualChain} from "./ritual/RitualChain.sol";
import {
    MockHttpPrecompile,
    MockJqPrecompile,
    MockScheduler,
    MockRitualWallet,
    MockTEEServiceRegistry,
    RejectingReceiver
} from "./mocks/RitualMocks.sol";

/**
 * Unit tests for RitualPredict.
 *
 * Ritual's capabilities live at fixed addresses, so the suite puts mock runtime code
 * *at those addresses* with `vm.etch` and drives the whole lifecycle locally — no RPC,
 * no funded account, no live executor.
 *
 * `blockTimeMs` is 1000 here, so one second of market duration is exactly one block and
 * every deadline in these tests can be read at a glance.
 */
contract RitualPredictTest is Test {
    RitualPredict internal predict;

    MockScheduler internal scheduler;
    MockRitualWallet internal wallet;
    MockTEEServiceRegistry internal registry;
    MockHttpPrecompile internal http;

    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");
    address internal carol = makeAddr("carol");
    address internal executorA = makeAddr("executorA");
    address internal executorB = makeAddr("executorB");

    uint256 internal constant BLOCK_TIME_MS = 1000;
    uint256 internal constant BETTING_SECONDS = 60;
    uint256 internal constant RESOLVE_DELAY_SECONDS = 30;
    string internal constant ORACLE_URL = "https://oracle.test/eth";

    function setUp() public {
        vm.etch(RitualChain.SCHEDULER, address(new MockScheduler()).code);
        vm.etch(RitualChain.RITUAL_WALLET, address(new MockRitualWallet()).code);
        vm.etch(RitualChain.TEE_SERVICE_REGISTRY, address(new MockTEEServiceRegistry()).code);
        vm.etch(RitualChain.HTTP_PRECOMPILE, address(new MockHttpPrecompile()).code);
        vm.etch(RitualChain.JQ_PRECOMPILE, address(new MockJqPrecompile()).code);

        scheduler = MockScheduler(RitualChain.SCHEDULER);
        wallet = MockRitualWallet(RitualChain.RITUAL_WALLET);
        registry = MockTEEServiceRegistry(RitualChain.TEE_SERVICE_REGISTRY);
        http = MockHttpPrecompile(RitualChain.HTTP_PRECOMPILE);

        address[] memory executors = new address[](2);
        executors[0] = executorA;
        executors[1] = executorB;
        registry.setExecutors(executors);

        vm.roll(1_000);
        predict = new RitualPredict(BLOCK_TIME_MS);

        vm.deal(alice, 100 ether);
        vm.deal(bob, 100 ether);
        vm.deal(carol, 100 ether);
    }

    // ─────────────────────────────── Helpers ───────────────────────────────

    function _params() internal pure returns (RitualPredict.NewMarket memory) {
        return
            RitualPredict.NewMarket({
                question: "Will ETH/USD be at least $4,000 when this market resolves?",
                oracleUrl: ORACLE_URL,
                jsonPath: ".price",
                target: 4000,
                comparator: RitualPredict.Comparator.GTE,
                bettingSeconds: BETTING_SECONDS,
                resolveDelaySeconds: RESOLVE_DELAY_SECONDS,
                viewers: new address[](0)
            });
    }

    function _create() internal returns (uint256) {
        return predict.createMarket(_params());
    }

    function _bet(address who, uint256 marketId, bool isYes, uint256 amount) internal {
        vm.prank(who);
        predict.bet{value: amount}(marketId, isYes);
    }

    /// Rolls to the market's resolve block and runs execution `index` the way the
    /// Scheduler would.
    function _fire(uint256 marketId, uint256 index) internal returns (bool) {
        RitualPredict.Market memory m = predict.getMarket(marketId);
        if (block.number < m.resolveBlock) vm.roll(m.resolveBlock);
        return scheduler.fire(m.scheduleId, index);
    }

    function _state(uint256 marketId) internal view returns (uint8) {
        return uint8(predict.getMarket(marketId).state);
    }

    // ──────────────────────────── Deployment ───────────────────────────────

    function test_ConstructorStoresBlockTime() public view {
        assertEq(predict.blockTimeMs(), BLOCK_TIME_MS);
        assertEq(predict.marketCount(), 0);
    }

    function test_ConstructorRejectsZeroBlockTime() public {
        vm.expectRevert(RitualPredict.BadDuration.selector);
        new RitualPredict(0);
    }

    function test_ConstructorApprovesTheScheduler() public view {
        assertTrue(scheduler.approved(address(predict), RitualChain.SCHEDULER));
    }

    // ──────────────────────────── createMarket ─────────────────────────────

    function test_CreateMarketStoresTheResolutionRule() public {
        uint256 id = _create();
        RitualPredict.Market memory m = predict.getMarket(id);

        assertEq(m.id, 1);
        assertEq(m.creator, address(this));
        assertEq(m.oracleUrl, ORACLE_URL);
        assertEq(m.jsonPath, ".price");
        assertEq(m.target, 4000);
        assertEq(uint8(m.comparator), uint8(RitualPredict.Comparator.GTE));
        assertEq(uint8(m.state), uint8(RitualPredict.MarketState.Open));
        assertEq(uint8(m.outcome), uint8(RitualPredict.Outcome.Unresolved));
        assertEq(m.attempts, 0);
    }

    function test_CreateMarketConvertsSecondsToBlocks() public {
        uint256 startBlock = block.number;
        uint256 id = _create();
        RitualPredict.Market memory m = predict.getMarket(id);

        assertEq(m.closeBlock, startBlock + BETTING_SECONDS); // 1000 ms per block
        assertEq(m.resolveBlock, m.closeBlock + RESOLVE_DELAY_SECONDS);
    }

    /// The Scheduler must never be able to fire while betting is still open, even when
    /// both durations round down to nothing on a very slow chain.
    function test_ResolveBlockAlwaysFollowsCloseBlock() public {
        RitualPredict slowChain = new RitualPredict(1 days * 1000);
        RitualPredict.Market memory m = slowChain.getMarket(slowChain.createMarket(_params()));
        assertGt(m.resolveBlock, m.closeBlock);
    }

    function test_CreateMarketBooksTheSchedulerWithTheExpectedParameters() public {
        uint256 id = _create();
        RitualPredict.Market memory m = predict.getMarket(id);
        MockScheduler.Call memory c = scheduler.getCall(m.scheduleId);

        assertEq(c.target, address(predict));
        assertEq(c.payer, address(predict), "the contract pays from its own RitualWallet");
        assertEq(uint256(c.startBlock), m.resolveBlock);
        assertEq(uint256(c.numCalls), predict.MAX_ATTEMPTS());
        assertEq(uint256(c.frequency), predict.RETRY_INTERVAL_BLOCKS());
        assertEq(uint256(c.ttl), predict.SCHEDULER_TTL_BLOCKS());
        assertEq(uint256(c.gas), predict.RESOLVE_GAS_LIMIT());
        assertEq(c.value, 0, "onScheduledResolve is not payable");
        assertGe(c.maxFeePerGas, predict.MIN_MAX_FEE_PER_GAS());
        assertEq(uint256(c.state), uint256(MockScheduler.CallState.Scheduled));
    }

    function test_CreateMarketEncodesTheCallbackWithAnIndexPlaceholder() public {
        uint256 id = _create();
        MockScheduler.Call memory c = scheduler.getCall(predict.getMarket(id).scheduleId);

        assertEq(bytes4(c.data), RitualPredict.onScheduledResolve.selector);
        assertEq(c.data.length, 4 + 32 + 32);
        (uint256 placeholder, uint256 marketId) = abi.decode(_tail(c.data), (uint256, uint256));
        assertEq(placeholder, 0, "the Scheduler overwrites this with the execution index");
        assertEq(marketId, id);
    }

    function test_CreateMarketEmitsCreationAndRule() public {
        uint256 close = block.number + BETTING_SECONDS;

        vm.expectEmit(true, true, false, true);
        emit RitualPredict.MarketCreated(
            1,
            address(this),
            _params().question,
            uint64(close),
            uint64(close + RESOLVE_DELAY_SECONDS),
            1
        );
        vm.expectEmit(true, false, false, true);
        emit RitualPredict.ResolutionRuleSet(
            1,
            ORACLE_URL,
            ".price",
            4000,
            RitualPredict.Comparator.GTE
        );
        _create();
    }

    function test_CreateMarketRejectsEmptyQuestion() public {
        RitualPredict.NewMarket memory p = _params();
        p.question = "";
        vm.expectRevert(RitualPredict.EmptyString.selector);
        predict.createMarket(p);
    }

    function test_CreateMarketRejectsEmptyOracleUrl() public {
        RitualPredict.NewMarket memory p = _params();
        p.oracleUrl = "";
        vm.expectRevert(RitualPredict.EmptyString.selector);
        predict.createMarket(p);
    }

    function test_CreateMarketRejectsEmptyJsonPath() public {
        RitualPredict.NewMarket memory p = _params();
        p.jsonPath = "";
        vm.expectRevert(RitualPredict.EmptyString.selector);
        predict.createMarket(p);
    }

    function test_CreateMarketRejectsTooShortBettingWindow() public {
        RitualPredict.NewMarket memory p = _params();
        p.bettingSeconds = predict.MIN_BETTING_SECONDS() - 1;
        vm.expectRevert(RitualPredict.BadDuration.selector);
        predict.createMarket(p);
    }

    function test_CreateMarketRejectsTooShortResolveDelay() public {
        RitualPredict.NewMarket memory p = _params();
        p.resolveDelaySeconds = predict.MIN_RESOLVE_DELAY_SECONDS() - 1;
        vm.expectRevert(RitualPredict.BadDuration.selector);
        predict.createMarket(p);
    }

    function test_CreateMarketRejectsMarketsLongerThanADay() public {
        RitualPredict.NewMarket memory p = _params();
        p.bettingSeconds = predict.MAX_MARKET_SECONDS();
        vm.expectRevert(RitualPredict.BadDuration.selector);
        predict.createMarket(p);
    }

    /// A market nobody can resolve is worse than no market, so a Scheduler failure has
    /// to take the whole creation down with it.
    function test_CreateMarketRevertsWhenTheSchedulerRejectsTheBooking() public {
        scheduler.setRejectSchedule(true);
        vm.expectRevert(bytes("mock: schedule rejected"));
        _create();
        assertEq(predict.marketCount(), 0, "the market id is rolled back with it");
    }

    function test_MarketIdsIncrement() public {
        assertEq(_create(), 1);
        assertEq(_create(), 2);
        assertEq(predict.marketCount(), 2);
    }

    // ──────────────────────────────── bet ──────────────────────────────────

    function test_BetAccumulatesStakeAndPool() public {
        uint256 id = _create();
        _bet(alice, id, true, 3 ether);
        _bet(bob, id, false, 1 ether);
        _bet(alice, id, true, 2 ether);

        RitualPredict.Market memory m = predict.getMarket(id);
        assertEq(m.totalYes, 5 ether);
        assertEq(m.totalNo, 1 ether);
        assertEq(predict.yesStake(id, alice), 5 ether);
        assertEq(predict.noStake(id, bob), 1 ether);
        assertEq(address(predict).balance, 6 ether);
    }

    function test_BetEmitsBetPlaced() public {
        uint256 id = _create();
        vm.expectEmit(true, true, false, true);
        emit RitualPredict.BetPlaced(id, alice, true, 1 ether);
        _bet(alice, id, true, 1 ether);
    }

    function test_BetRejectsZeroStake() public {
        uint256 id = _create();
        vm.prank(alice);
        vm.expectRevert(RitualPredict.ZeroStake.selector);
        predict.bet{value: 0}(id, true);
    }

    function test_BetRejectsUnknownMarket() public {
        vm.prank(alice);
        vm.expectRevert(RitualPredict.UnknownMarket.selector);
        predict.bet{value: 1 ether}(42, true);
    }

    function test_BetRejectsOnceTheWindowHasClosed() public {
        uint256 id = _create();
        vm.roll(predict.getMarket(id).closeBlock);

        vm.prank(alice);
        vm.expectRevert(RitualPredict.BettingClosed.selector);
        predict.bet{value: 1 ether}(id, true);
    }

    // ───────────────────────── private markets ────────────────────────────

    function _privateMarket(address guest) private returns (uint256) {
        RitualPredict.NewMarket memory p = _params();
        address[] memory viewers = new address[](1);
        viewers[0] = guest;
        p.viewers = viewers;
        return predict.createMarket(p);
    }

    function test_APublicMarketIsOpenToEveryone() public {
        uint256 id = _create();
        assertFalse(predict.getMarket(id).isPrivate);
        assertTrue(predict.canBet(id, alice));
        assertTrue(predict.canBet(id, carol));
        assertEq(predict.privateMarketCount(), 0);
    }

    function test_APrivateMarketInvitesItsCreatorAndItsGuests() public {
        uint256 id = _privateMarket(alice);

        assertTrue(predict.getMarket(id).isPrivate);
        assertTrue(predict.canBet(id, address(this)), "the creator is always invited");
        assertTrue(predict.canBet(id, alice));
        assertFalse(predict.canBet(id, carol));
        assertEq(predict.privateMarketCount(), 1);
    }

    function test_APrivateMarketRefusesAnUninvitedStake() public {
        uint256 id = _privateMarket(alice);

        _bet(alice, id, true, 1 ether);
        assertEq(predict.getMarket(id).totalYes, 1 ether);

        vm.prank(carol);
        vm.expectRevert(RitualPredict.NotInvited.selector);
        predict.bet{value: 1 ether}(id, false);
    }

    function test_TheInvitedListIsEmittedAtCreation() public {
        address[] memory viewers = new address[](2);
        viewers[0] = alice;
        viewers[1] = bob;
        RitualPredict.NewMarket memory p = _params();
        p.viewers = viewers;

        vm.expectEmit(true, false, false, true);
        emit RitualPredict.MarketRestricted(1, viewers);
        predict.createMarket(p);
    }

    function test_PrivateMarketsAreCounted() public {
        _create();
        _privateMarket(alice);
        _privateMarket(bob);
        assertEq(predict.privateMarketCount(), 2);
        assertEq(predict.marketCount(), 3);
    }

    /// A private market settles through exactly the same path as a public one.
    function test_APrivateMarketStillSettlesItself() public {
        uint256 id = _privateMarket(alice);
        _bet(alice, id, true, 1 ether);
        http.queueJson('{"price":4200}');

        _fire(id, 0);

        RitualPredict.Market memory m = predict.getMarket(id);
        assertEq(uint8(m.state), uint8(RitualPredict.MarketState.Resolved));
        assertEq(uint8(m.outcome), uint8(RitualPredict.Outcome.Yes));
    }

    // ──────────────────────────────── views ────────────────────────────────

    function test_GetMarketReportsClosedWithoutAnyTransaction() public {
        uint256 id = _create();
        assertEq(_state(id), uint8(RitualPredict.MarketState.Open));
        vm.roll(predict.getMarket(id).closeBlock);
        assertEq(_state(id), uint8(RitualPredict.MarketState.Closed));
    }

    function test_GetMarketRejectsUnknownMarket() public {
        vm.expectRevert(RitualPredict.UnknownMarket.selector);
        predict.getMarket(1);
    }

    function test_GetMarketsReturnsNewestFirst() public {
        _create();
        _create();
        _create();
        RitualPredict.Market[] memory all = predict.getMarkets();
        assertEq(all.length, 3);
        assertEq(all[0].id, 3);
        assertEq(all[2].id, 1);
    }

    // ─────────────────────── onScheduledResolve: guards ────────────────────

    function test_ResolveIsSchedulerOnly() public {
        uint256 id = _create();
        vm.roll(predict.getMarket(id).resolveBlock);
        vm.prank(alice);
        vm.expectRevert(RitualPredict.OnlyScheduler.selector);
        predict.onScheduledResolve(0, id);
    }

    function test_ResolveIgnoresAnEarlyTrigger() public {
        uint256 id = _create();
        http.queueJson('{"price":4200}');
        assertTrue(scheduler.fire(predict.getMarket(id).scheduleId, 0));

        RitualPredict.Market memory m = predict.getMarket(id);
        assertEq(m.attempts, 0, "an early wake-up must not burn an attempt");
        assertEq(uint8(m.state), uint8(RitualPredict.MarketState.Open));
    }

    function test_ResolveOfAnUnknownMarketIsANoop() public {
        _create();
        vm.roll(block.number + 500);
        vm.prank(RitualChain.SCHEDULER);
        predict.onScheduledResolve(0, 999); // returns instead of reverting
    }

    // ─────────────────────── onScheduledResolve: outcomes ──────────────────

    function test_ResolvesYesWhenTheObservedValueClearsTheTarget() public {
        uint256 id = _create();
        _bet(alice, id, true, 1 ether);
        _bet(bob, id, false, 1 ether);
        http.queueJson('{"price":4200}');

        assertTrue(_fire(id, 0));

        RitualPredict.Market memory m = predict.getMarket(id);
        assertEq(uint8(m.state), uint8(RitualPredict.MarketState.Resolved));
        assertEq(uint8(m.outcome), uint8(RitualPredict.Outcome.Yes));
        assertEq(m.observedValue, 4200);
        assertEq(m.attempts, 1);
    }

    function test_ResolvesNoWhenTheObservedValueMissesTheTarget() public {
        uint256 id = _create();
        _bet(alice, id, true, 1 ether);
        _bet(bob, id, false, 1 ether);
        http.queueJson('{"price":3999}');

        _fire(id, 0);

        RitualPredict.Market memory m = predict.getMarket(id);
        assertEq(uint8(m.outcome), uint8(RitualPredict.Outcome.No));
        assertEq(m.observedValue, 3999);
    }

    function test_EveryComparatorIsHonoured() public {
        assertEq(uint8(_outcomeFor(RitualPredict.Comparator.GT, 4000, 4000)), uint8(RitualPredict.Outcome.No));
        assertEq(uint8(_outcomeFor(RitualPredict.Comparator.GTE, 4000, 4000)), uint8(RitualPredict.Outcome.Yes));
        assertEq(uint8(_outcomeFor(RitualPredict.Comparator.LT, 4000, 4000)), uint8(RitualPredict.Outcome.No));
        assertEq(uint8(_outcomeFor(RitualPredict.Comparator.LTE, 4000, 4000)), uint8(RitualPredict.Outcome.Yes));
        assertEq(uint8(_outcomeFor(RitualPredict.Comparator.LT, 4000, 3999)), uint8(RitualPredict.Outcome.Yes));
    }

    function test_ResolutionSendsAWellFormedGetToTheOracleUrl() public {
        uint256 id = _create();
        _bet(alice, id, true, 1 ether);
        http.queueJson('{"price":4200}');
        _fire(id, 0);

        assertEq(http.lastUrl(), ORACLE_URL);
        assertEq(uint256(http.lastMethod()), 1, "GET");
        assertEq(http.lastTtl(), predict.HTTP_TTL_BLOCKS());
        assertEq(http.lastHeaderCount(), 0);
        assertEq(http.lastBodyLength(), 0, "a GET carries no body");
        assertFalse(http.lastPiiEnabled());
        assertTrue(http.lastExecutor() == executorA || http.lastExecutor() == executorB);
        assertEq(predict.getMarket(id).observedValue, 4200, "the jq extraction ran");
    }

    function test_SuccessfulResolutionCancelsTheRemainingAttempts() public {
        scheduler.setCancellableWhileExecuting(true);
        uint256 id = _create();
        _bet(alice, id, true, 1 ether);
        http.queueJson('{"price":4200}');

        _fire(id, 0);

        assertEq(
            uint256(scheduler.getCallState(predict.getMarket(id).scheduleId)),
            uint256(MockScheduler.CallState.Cancelled)
        );
    }

    /// The live Scheduler refuses to cancel a call while that very call is executing.
    /// Resolution must not care.
    function test_ResolutionSurvivesACancelThatReverts() public {
        assertFalse(scheduler.cancellableWhileExecuting());
        uint256 id = _create();
        _bet(alice, id, true, 1 ether);
        http.queueJson('{"price":4200}');

        assertTrue(_fire(id, 0));
        assertEq(_state(id), uint8(RitualPredict.MarketState.Resolved));
    }

    function test_ResolutionIsIdempotent() public {
        uint256 id = _create();
        _bet(alice, id, true, 1 ether);
        http.queueJson('{"price":4200}');
        _fire(id, 0);

        uint256 servedOnce = http.served();
        vm.roll(block.number + predict.RETRY_INTERVAL_BLOCKS());
        scheduler.fire(predict.getMarket(id).scheduleId, 1);

        RitualPredict.Market memory m = predict.getMarket(id);
        assertEq(m.attempts, 1, "a leftover execution must not touch a settled market");
        assertEq(http.served(), servedOnce, "and must not spend another oracle read");
    }

    // ─────────────────────── onScheduledResolve: failures ──────────────────

    function test_ANon200ResponseIsAFailureNotANo() public {
        uint256 id = _create();
        _bet(alice, id, true, 1 ether);
        http.queueResponse(503, bytes('{"price":4200}'), "");

        vm.expectEmit(true, false, false, true);
        emit RitualPredict.ResolutionFailed(id, 1, "oracle returned non-200 status");
        _fire(id, 0);

        RitualPredict.Market memory m = predict.getMarket(id);
        assertEq(uint8(m.state), uint8(RitualPredict.MarketState.Resolving));
        assertEq(uint8(m.outcome), uint8(RitualPredict.Outcome.Unresolved), "never a silent NO");
        assertEq(m.attempts, 1);
    }

    function test_AnExecutorErrorMessageIsAFailure() public {
        uint256 id = _create();
        http.queueResponse(200, bytes('{"price":4200}'), "dns lookup failed");

        vm.expectEmit(true, false, false, true);
        emit RitualPredict.ResolutionFailed(id, 1, "dns lookup failed");
        _fire(id, 0);
        assertEq(uint8(predict.getMarket(id).outcome), uint8(RitualPredict.Outcome.Unresolved));
    }

    function test_AnEmptyBodyIsAFailure() public {
        uint256 id = _create();
        http.queueResponse(200, bytes(""), "");

        vm.expectEmit(true, false, false, true);
        emit RitualPredict.ResolutionFailed(id, 1, "empty oracle response");
        _fire(id, 0);
    }

    /// Malformed bytes must be caught, not reverted: a revert would roll back the
    /// attempt counter and the market could never reach Invalid.
    function test_AMalformedEnvelopeIsCaught() public {
        uint256 id = _create();
        http.queueKind(MockHttpPrecompile.Kind.Malformed);

        assertTrue(_fire(id, 0), "the execution itself must not revert");
        assertEq(predict.getMarket(id).attempts, 1);
    }

    function test_AnUnsettledAsyncOutputIsAFailure() public {
        uint256 id = _create();
        http.queueKind(MockHttpPrecompile.Kind.Unsettled);

        assertTrue(_fire(id, 0));
        assertEq(predict.getMarket(id).attempts, 1);
    }

    function test_APrecompileRevertIsAFailure() public {
        uint256 id = _create();
        http.queueKind(MockHttpPrecompile.Kind.Revert);

        vm.expectEmit(true, false, false, true);
        emit RitualPredict.ResolutionFailed(id, 1, "http precompile call failed");
        _fire(id, 0);
    }

    function test_AnUnparseableBodyIsAFailure() public {
        uint256 id = _create();
        http.queueJson('{"price":"four thousand"}');

        vm.expectEmit(true, false, false, true);
        emit RitualPredict.ResolutionFailed(id, 1, "jq parse failed");
        _fire(id, 0);
    }

    function test_NoAvailableExecutorIsAFailure() public {
        uint256 id = _create();
        registry.setExecutors(new address[](0));

        vm.expectEmit(true, false, false, true);
        emit RitualPredict.ResolutionFailed(id, 1, "no HTTP executor available");
        _fire(id, 0);
    }

    function test_ARevertingRegistryIsAFailure() public {
        uint256 id = _create();
        registry.setShouldRevert(true);

        vm.expectEmit(true, false, false, true);
        emit RitualPredict.ResolutionFailed(id, 1, "no HTTP executor available");
        _fire(id, 0);
        assertEq(predict.getMarket(id).attempts, 1);
    }

    function test_ThreeFailedAttemptsInvalidateTheMarket() public {
        uint256 id = _create();
        _bet(alice, id, true, 1 ether);
        http.queueKind(MockHttpPrecompile.Kind.Revert); // sticky: every retry fails

        _fire(id, 0);
        assertEq(_state(id), uint8(RitualPredict.MarketState.Resolving));
        vm.roll(block.number + predict.RETRY_INTERVAL_BLOCKS());
        _fire(id, 1);
        assertEq(_state(id), uint8(RitualPredict.MarketState.Resolving));

        vm.roll(block.number + predict.RETRY_INTERVAL_BLOCKS());
        vm.expectEmit(true, false, false, true);
        emit RitualPredict.MarketInvalidated(id, "http precompile call failed");
        _fire(id, 2);

        RitualPredict.Market memory m = predict.getMarket(id);
        assertEq(uint8(m.state), uint8(RitualPredict.MarketState.Invalid));
        assertEq(m.attempts, 3);
        assertEq(m.invalidReason, "http precompile call failed");
    }

    /// One unhealthy executor must not sink a market: every attempt re-rolls the seed.
    function test_ARetryRerollsTheExecutorAndCanSettle() public {
        registry.setEchoSeed(true); // executor address == seed, so a re-roll is visible
        uint256 id = _create();
        _bet(alice, id, true, 1 ether);

        http.queueKind(MockHttpPrecompile.Kind.Revert);
        address first = _fireAndCaptureExecutor(id, 0);
        assertEq(predict.getMarket(id).attempts, 1);
        assertEq(_state(id), uint8(RitualPredict.MarketState.Resolving));

        http.reset();
        http.queueJson('{"price":4200}');
        vm.roll(block.number + predict.RETRY_INTERVAL_BLOCKS());
        address second = _fireAndCaptureExecutor(id, 1);

        assertTrue(first != address(0) && second != address(0));
        assertTrue(first != second, "the same seed would keep hitting the same executor");
        assertEq(_state(id), uint8(RitualPredict.MarketState.Resolved), "the retry settled it");
    }

    // ──────────────────────────────── payouts ──────────────────────────────

    function test_WinnersSplitTheWholePoolInProportion() public {
        uint256 id = _create();
        _bet(alice, id, true, 3 ether);
        _bet(bob, id, true, 1 ether);
        _bet(carol, id, false, 4 ether);
        http.queueJson('{"price":4200}');
        _fire(id, 0);

        uint256 aliceBefore = alice.balance;
        uint256 bobBefore = bob.balance;

        vm.prank(alice);
        predict.claimWinnings(id);
        vm.prank(bob);
        predict.claimWinnings(id);

        assertEq(alice.balance - aliceBefore, 6 ether, "3/4 of an 8 ETH pool");
        assertEq(bob.balance - bobBefore, 2 ether, "1/4 of an 8 ETH pool");
        assertEq(address(predict).balance, 0);
    }

    function test_TheLosingSideHasNothingToClaim() public {
        uint256 id = _create();
        _bet(alice, id, true, 1 ether);
        _bet(bob, id, false, 1 ether);
        http.queueJson('{"price":4200}');
        _fire(id, 0);

        vm.prank(bob);
        vm.expectRevert(RitualPredict.NothingToClaim.selector);
        predict.claimWinnings(id);
    }

    function test_ClaimingTwiceReverts() public {
        uint256 id = _create();
        _bet(alice, id, true, 1 ether);
        http.queueJson('{"price":4200}');
        _fire(id, 0);

        vm.startPrank(alice);
        predict.claimWinnings(id);
        vm.expectRevert(RitualPredict.AlreadySettled.selector);
        predict.claimWinnings(id);
        vm.stopPrank();
    }

    function test_ClaimingBeforeResolutionReverts() public {
        uint256 id = _create();
        _bet(alice, id, true, 1 ether);

        vm.prank(alice);
        vm.expectRevert(RitualPredict.NotResolved.selector);
        predict.claimWinnings(id);
    }

    function test_ClaimEmitsWinningsClaimed() public {
        uint256 id = _create();
        _bet(alice, id, true, 1 ether);
        _bet(bob, id, false, 1 ether);
        http.queueJson('{"price":4200}');
        _fire(id, 0);

        vm.expectEmit(true, true, false, true);
        emit RitualPredict.WinningsClaimed(id, alice, 2 ether);
        vm.prank(alice);
        predict.claimWinnings(id);
    }

    function test_AFailedTransferReverts() public {
        RejectingReceiver receiver = new RejectingReceiver();
        vm.deal(address(receiver), 1 ether);
        uint256 id = _create();
        receiver.bet{value: 1 ether}(address(predict), id, true);
        http.queueJson('{"price":4200}');
        _fire(id, 0);

        vm.expectRevert(RitualPredict.TransferFailed.selector);
        receiver.claim(address(predict), id);
    }

    // ──────────────────────── invalid markets and refunds ──────────────────

    /// Pari-mutuel has no denominator when nobody backed the winning answer.
    function test_AnEmptyWinningSideInvalidatesTheMarket() public {
        uint256 id = _create();
        _bet(alice, id, false, 1 ether);
        _bet(bob, id, false, 1 ether);
        http.queueJson('{"price":4200}'); // YES wins, nobody is on YES

        _fire(id, 0);

        RitualPredict.Market memory m = predict.getMarket(id);
        assertEq(uint8(m.state), uint8(RitualPredict.MarketState.Invalid));
        assertEq(uint8(m.outcome), uint8(RitualPredict.Outcome.Yes), "the outcome still stands");
        assertEq(m.observedValue, 4200);
        assertEq(m.invalidReason, "no winning stake");
    }

    function test_EveryoneIsRefundedFromAnInvalidMarket() public {
        uint256 id = _create();
        _bet(alice, id, true, 1 ether);
        _bet(bob, id, false, 2 ether);
        http.queueKind(MockHttpPrecompile.Kind.Revert);

        _fire(id, 0);
        vm.roll(block.number + predict.RETRY_INTERVAL_BLOCKS());
        _fire(id, 1);
        vm.roll(block.number + predict.RETRY_INTERVAL_BLOCKS());
        _fire(id, 2);
        assertEq(_state(id), uint8(RitualPredict.MarketState.Invalid));

        uint256 aliceBefore = alice.balance;
        vm.prank(alice);
        predict.claimRefund(id);
        assertEq(alice.balance - aliceBefore, 1 ether);

        vm.prank(bob);
        predict.claimRefund(id);
        assertEq(address(predict).balance, 0);
    }

    function test_RefundingTwiceReverts() public {
        uint256 id = _invalidMarketWithStake();
        vm.startPrank(alice);
        predict.claimRefund(id);
        vm.expectRevert(RitualPredict.AlreadySettled.selector);
        predict.claimRefund(id);
        vm.stopPrank();
    }

    function test_RefundWithoutAStakeReverts() public {
        uint256 id = _invalidMarketWithStake();
        vm.prank(carol);
        vm.expectRevert(RitualPredict.NothingToClaim.selector);
        predict.claimRefund(id);
    }

    function test_RefundOnAResolvedMarketReverts() public {
        uint256 id = _create();
        _bet(alice, id, true, 1 ether);
        http.queueJson('{"price":4200}');
        _fire(id, 0);

        vm.prank(alice);
        vm.expectRevert(RitualPredict.NotInvalid.selector);
        predict.claimRefund(id);
    }

    // ─────────────────────────────── stakesOf ──────────────────────────────

    function test_StakesOfTracksClaimableThroughTheLifecycle() public {
        uint256 id = _create();
        _bet(alice, id, true, 1 ether);
        _bet(bob, id, false, 3 ether);

        (uint256 yes, uint256 no, bool done, uint256 claimable) = predict.stakesOf(id, alice);
        assertEq(yes, 1 ether);
        assertEq(no, 0);
        assertFalse(done);
        assertEq(claimable, 0, "nothing is claimable while the market is open");

        http.queueJson('{"price":4200}');
        _fire(id, 0);

        (, , , claimable) = predict.stakesOf(id, alice);
        assertEq(claimable, 4 ether, "the whole pool");

        vm.prank(alice);
        predict.claimWinnings(id);
        (, , done, claimable) = predict.stakesOf(id, alice);
        assertTrue(done);
        assertEq(claimable, 0);
    }

    function test_StakesOfReportsTheRefundOnAnInvalidMarket() public {
        uint256 id = _invalidMarketWithStake();
        (, , , uint256 claimable) = predict.stakesOf(id, alice);
        assertEq(claimable, 1 ether);
    }

    // ───────────────────────────── fundExecution ───────────────────────────

    function test_FundExecutionDepositsIntoRitualWallet() public {
        assertEq(predict.executionBalance(), 0);
        predict.fundExecution{value: 0.5 ether}(500_000);

        assertEq(predict.executionBalance(), 0.5 ether);
        assertEq(wallet.balanceOf(address(predict)), 0.5 ether);
        assertEq(wallet.lockUntil(address(predict)), block.number + 500_000);
        assertEq(address(predict).balance, 0, "the deposit leaves the contract");
    }

    function test_FundExecutionRejectsZero() public {
        vm.expectRevert(RitualPredict.ZeroStake.selector);
        predict.fundExecution{value: 0}(500_000);
    }

    function test_ExecutionFundingIsSeparateFromTheBettingPool() public {
        uint256 id = _create();
        _bet(alice, id, true, 1 ether);
        predict.fundExecution{value: 0.5 ether}(500_000);
        assertEq(address(predict).balance, 1 ether, "bets stay put");
    }

    function test_ContractAcceptsPlainTransfers() public {
        (bool ok, ) = address(predict).call{value: 1 wei}("");
        assertTrue(ok, "Scheduler gas refunds arrive as plain transfers");
    }

    // ──────────────────────────────── fuzz ─────────────────────────────────

    function testFuzz_PayoutsNeverExceedThePool(uint96 yesStake_, uint96 noStake_) public {
        yesStake_ = uint96(bound(yesStake_, 1, 1_000 ether));
        noStake_ = uint96(bound(noStake_, 1, 1_000 ether));
        vm.deal(alice, yesStake_);
        vm.deal(bob, noStake_);

        uint256 id = _create();
        _bet(alice, id, true, yesStake_);
        _bet(bob, id, false, noStake_);
        http.queueJson('{"price":4200}');
        _fire(id, 0);

        uint256 pool = uint256(yesStake_) + noStake_;
        vm.prank(alice);
        predict.claimWinnings(id);
        assertLe(alice.balance, pool, "a winner can never take more than the pool");
        assertLe(address(predict).balance, 1, "at most sub-wei dust is left behind");
    }

    function testFuzz_ComparatorMatchesPlainArithmetic(uint128 observed, uint128 target) public {
        RitualPredict.NewMarket memory p = _params();
        p.target = target;
        p.comparator = RitualPredict.Comparator.GTE;
        uint256 id = predict.createMarket(p);
        _bet(alice, id, true, 1 ether);
        _bet(bob, id, false, 1 ether);

        http.queueJson(string.concat('{"price":', vm.toString(uint256(observed)), "}"));
        _fire(id, 0);

        RitualPredict.Outcome expected = observed >= target
            ? RitualPredict.Outcome.Yes
            : RitualPredict.Outcome.No;
        assertEq(uint8(predict.getMarket(id).outcome), uint8(expected));
    }

    // ──────────────────────────── private helpers ──────────────────────────

    function _outcomeFor(
        RitualPredict.Comparator comparator,
        uint256 target,
        uint256 observed
    ) private returns (RitualPredict.Outcome) {
        RitualPredict.NewMarket memory p = _params();
        p.comparator = comparator;
        p.target = target;
        uint256 id = predict.createMarket(p);
        _bet(alice, id, true, 1 ether);
        _bet(bob, id, false, 1 ether);
        http.queueJson(string.concat('{"price":', vm.toString(observed), "}"));
        _fire(id, 0);
        return predict.getMarket(id).outcome;
    }

    function _invalidMarketWithStake() private returns (uint256 id) {
        id = _create();
        _bet(alice, id, true, 1 ether);
        http.queueKind(MockHttpPrecompile.Kind.Revert);
        for (uint256 i = 0; i < predict.MAX_ATTEMPTS(); i++) {
            _fire(id, i);
            vm.roll(block.number + predict.RETRY_INTERVAL_BLOCKS());
        }
    }

    /// Runs one execution and returns the executor from `ResolutionAttempted`. The
    /// event is the only reliable source: a failing HTTP call rolls the precompile
    /// mock's own bookkeeping back with it.
    function _fireAndCaptureExecutor(uint256 marketId, uint256 index) private returns (address) {
        vm.recordLogs();
        _fire(marketId, index);
        Vm.Log[] memory logs = vm.getRecordedLogs();
        for (uint256 i = 0; i < logs.length; i++) {
            if (logs[i].topics[0] == RitualPredict.ResolutionAttempted.selector) {
                (, address executor) = abi.decode(logs[i].data, (uint8, address));
                return executor;
            }
        }
        revert("no ResolutionAttempted event");
    }

    /// Everything after the 4-byte selector.
    function _tail(bytes memory data) private pure returns (bytes memory out) {
        out = new bytes(data.length - 4);
        for (uint256 i = 0; i < out.length; i++) out[i] = data[i + 4];
    }
}
