// Keep cold-start artwork independent of Phaser and the game's module graph.
// Static URLs let Vite package both images for web and Android builds.
const artwork = [
  new URL('../assets/screens/loading-moonlit-ruins.png', import.meta.url).href,
  new URL('../assets/screens/loading-sunlit-ruins.png', import.meta.url).href
];

export function selectLoadingArtwork() {
  const image = document.querySelector('#loading-screen .loading-art');
  if (image) image.src = artwork[Math.floor(Math.random() * artwork.length)];
}

selectLoadingArtwork();
