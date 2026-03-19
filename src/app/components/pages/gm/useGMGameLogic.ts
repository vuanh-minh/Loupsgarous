/* ================================================================
   useGMGameLogic — barrel re-export.
   Pure helpers live in gmPureHelpers.ts,
   the phase-transition hook lives in useGMPhaseTransitions.ts.
   This file re-exports everything so existing consumers keep working.
   ================================================================ */

export {
  type NightAction,
  type PlayerActionStatus,
  type VoteData,
  getPlayerStatuses,
  buildNightActions,
  computeVoteData,
} from './gmPureHelpers';

export {
  type GMPhaseTransitionDeps,
  useGMPhaseTransitions,
} from './useGMPhaseTransitions';
