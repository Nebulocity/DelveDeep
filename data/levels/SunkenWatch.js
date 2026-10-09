// Sunken Watch keeps the existing forest battlefield and its authored floor boundary.
// Its own encounter ID selects the supplied monsters without changing saved map IDs.
import thornbriarHollow from './ThornbriarHollow.js';

export default {
  ...thornbriarHollow,
  id: 'sunken-watch',
  name: 'The Sunken Watch',
  mapLabel: 'The Sunken Watch',
  subtitle: 'Drowned guardians haunt a ruined watchtower beside the river.',
  prerequisites: ['march-west-delves']
};
