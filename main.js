// import Phaser from 'phaser';
const Phaser = window.Phaser; // Phaser is loaded via <script> in index.html
import './style.css';
import gameConfig from './config/gameConfig.js';

const game = new Phaser.Game(gameConfig);

export default game;
