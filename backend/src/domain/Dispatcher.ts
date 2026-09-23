import { Elevator } from './Elevator.js';
import type { HallCallRequest, SchedulingStrategy } from './scheduling/SchedulingStrategy.js';

/**
 * Orchestrates Hall Call assignment: takes a snapshot of every managed
 * `Elevator`, delegates elevator selection to a `SchedulingStrategy`, and
 * — if one is selected — calls `assignHallCall()` on the matching live
 * `Elevator`. Holds only the `SchedulingStrategy` interface; never branches
 * on the concrete strategy's type.
 *
 * A Hall Call that cannot be assigned at request time is stored as a
 * Pending Call instead of being dropped, and is retried by
 * `reevaluatePending()` — a pull-based method invoked by something else
 * (`Building.tick()` in Story 1.5); this class never calls it itself.
 */
export class Dispatcher {
  private readonly elevators: Elevator[];
  private readonly strategy: SchedulingStrategy;
  private pendingCalls: HallCallRequest[] = [];

  constructor(elevators: Elevator[], strategy: SchedulingStrategy) {
    this.elevators = elevators;
    this.strategy = strategy;
  }

  /**
   * Handle a Hall Call for `floor` in `direction`. If the strategy selects
   * an eligible elevator, queues the stop on it via `assignHallCall()`. If
   * no elevator is eligible, the call is stored as a Pending Call instead
   * of being dropped.
   */
  handleHallCall(floor: number, direction: 'UP' | 'DOWN'): void {
    const request: HallCallRequest = { floor, direction };
    if (!this.tryAssign(request)) {
      this.addPending(request);
    }
  }

  /**
   * Retry every stored Pending Call, in FIFO arrival order, against a fresh
   * Strategy evaluation. Each call that succeeds is removed; each that
   * still fails is re-added. Because assignment happens immediately within
   * the loop, an assignment made earlier in the same pass is visible (via
   * a fresh `getSnapshot()`) to later calls in the same pass. Pull-based:
   * does work only when called.
   *
   * Assumes non-reentrant, single-threaded callers, same as `addPending`'s
   * dedup check — true today (nothing calls `Dispatcher` concurrently).
   * Revisit once Epic 2's WebSocket handlers call `handleHallCall` from
   * event callbacks.
   */
  reevaluatePending(): void {
    const toRetry = this.pendingCalls;
    this.pendingCalls = [];

    for (const request of toRetry) {
      if (!this.tryAssign(request)) {
        this.addPending(request);
      }
    }
  }

  /** Read-only view of currently pending Hall Calls, in FIFO arrival order. */
  getPendingCalls(): readonly HallCallRequest[] {
    return [...this.pendingCalls];
  }

  /**
   * Attempt to assign `request` to an eligible elevator via a fresh
   * snapshot → strategy → assignHallCall pass. Returns whether assignment
   * actually happened; never mutates Pending Call storage itself.
   *
   * `assignHallCall`'s `false` return (e.g. the selected elevator's
   * insertion turned out to be a same-floor/doors-open no-op by the time
   * this runs) is treated identically to "no eligible elevator" — the
   * call is not considered assigned, closing the Story 1.3 edge case
   * where such a call would otherwise be silently dropped.
   */
  private tryAssign(request: HallCallRequest): boolean {
    const snapshots = this.elevators.map((elevator) => elevator.getSnapshot());
    const selected = this.strategy.selectElevator(snapshots, request);

    if (selected === null) {
      return false;
    }

    const elevator = this.elevators.find((candidate) => candidate.id === selected.id);
    if (!elevator) {
      throw new Error(`Dispatcher: strategy selected unknown elevator id "${selected.id}"`);
    }
    return elevator.assignHallCall(request.floor);
  }

  /** Store `request` as pending, unless one for the same (floor, direction) is already pending. */
  private addPending(request: HallCallRequest): void {
    const alreadyPending = this.pendingCalls.some(
      (pending) => pending.floor === request.floor && pending.direction === request.direction,
    );
    if (!alreadyPending) {
      this.pendingCalls.push(request);
    }
  }
}
