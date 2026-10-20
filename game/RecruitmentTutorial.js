import GameState from './GameState.js';
import { flushProfileSave } from './GameStorage.js';
import { isRecruited, recruitAdventurer } from './Recruitment.js';

// One saved lesson extends the existing Tutorial entry point. Replay never revokes
// ownership; only a fresh, undecided profile starts without Garrick.
export function beginRecruitmentTutorial() {
  const previous = GameState.tutorial;
  GameState.tutorial = { status: 'active', step: isRecruited('garrick') ? 'party' : 'recruit' };
  if (flushProfileSave()) return { ok: true };
  GameState.tutorial = previous;
  return { ok: false, message: 'The tutorial could not be saved. Please try again.' };
}

export function skipRecruitmentTutorial() {
  const previous = GameState.tutorial;
  GameState.tutorial = { status: 'skipped', step: 'party' };
  if (!isRecruited('garrick')) {
    const result = recruitAdventurer('garrick');
    if (!result.ok) GameState.tutorial = previous;
    return result;
  }
  if (flushProfileSave()) return { ok: true, message: 'Tutorial skipped. Garrick is available in Heroes.' };
  GameState.tutorial = previous;
  return { ok: false, message: 'The tutorial could not be saved. Please try again.' };
}

// Party Select calls this only after the player presses Save. Hiring alone cannot
// finish this lesson or silently place Garrick into the combat lineup.
export function recordTutorialParty() {
  if (GameState.tutorial.status !== 'active' || !isRecruited('garrick')) return;
  const ids = GameState.lastPartyIds;
  if (ids.length === 5 && new Set(ids).size === 5 && ids.includes('garrick')
    && ids.every(isRecruited)) GameState.tutorial = { status: 'complete', step: 'party' };
}
