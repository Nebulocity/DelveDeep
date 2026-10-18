import GameState from './GameState.js';
import { saveProfile } from './GameStorage.js';

export const TOWN_LAYOUTS = Object.freeze([
  { id: 'side-rails', label: 'Side Rails', description: 'Vertical side navigation' },
  { id: 'compact-bar', label: 'Compact Bar', description: 'Bottom navigation bar' }
]);

export function townLayout() {
  return GameState.preferences?.townNavigation === 'side-rails' ? 'side-rails' : 'compact-bar';
}

export function setTownLayout(layout) {
  if (!TOWN_LAYOUTS.some(option => option.id === layout)) return;
  GameState.preferences ??= {};
  GameState.preferences.townNavigation = layout;
  saveProfile();
}
