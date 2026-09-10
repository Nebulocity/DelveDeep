// import Phaser from 'phaser';
const Phaser = window.Phaser; // Load Phaser from <script> in index.html.

import './style.css';
import gameConfig from './config/gameConfig.js';

const game = new Phaser.Game(gameConfig);

export default game;
